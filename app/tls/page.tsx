'use client';

import { useState, useRef, useCallback, useEffect, FormEvent } from 'react';
import Link from 'next/link';

// ── Web Serial API type shims ─────────────────────────────────────────────────
interface SerialOpenOpts {
  baudRate: number;
  dataBits?: number;
  stopBits?: number;
  parity?: 'none' | 'even' | 'odd';
  flowControl?: 'none' | 'hardware';
}
interface SerialPortInfo { usbVendorId?: number; usbProductId?: number; }
interface AppSerialPort {
  open(opts: SerialOpenOpts): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  getInfo(): SerialPortInfo;
}
interface AppSerial {
  requestPort(): Promise<AppSerialPort>;
  getPorts(): Promise<AppSerialPort[]>;
}
function getSerial(): AppSerial | null {
  if (typeof navigator === 'undefined') return null;
  return (navigator as unknown as { serial?: AppSerial }).serial ?? null;
}

// Known USB-to-serial adapter chip names keyed by "VID:PID" (uppercase hex)
const USB_CHIP_NAMES: Record<string, string> = {
  '067B:2303': 'Prolific PL2303',
  '067B:23A3': 'Prolific PL2303HXA',
  '0403:6001': 'FTDI FT232R',
  '0403:6015': 'FTDI FT231X',
  '0403:6010': 'FTDI FT2232',
  '1A86:7523': 'CH340',
  '1A86:55D4': 'CH9102',
  '10C4:EA60': 'Silicon Labs CP210x',
  '04B4:0044': 'Cypress CY7C65213',
};

function portLabel(port: AppSerialPort, idx: number): string {
  const { usbVendorId: vid, usbProductId: pid } = port.getInfo();
  if (vid !== undefined && pid !== undefined) {
    const hex = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');
    const key = `${hex(vid)}:${hex(pid)}`;
    return USB_CHIP_NAMES[key] ?? `USB Serial (${key})`;
  }
  return `Serial Port ${idx + 1}`;
}

// ── VR TLS protocol helpers ───────────────────────────────────────────────────
// Frame: SOH (0x01) + function code (ASCII) + ETX (0x03)
function buildCmd(code: string): Uint8Array {
  const body = new TextEncoder().encode(code);
  const frame = new Uint8Array(body.length + 2);
  frame[0] = 0x01;
  frame.set(body, 1);
  frame[frame.length - 1] = 0x03;
  return frame;
}

// Format a date as MMDDYYYY for VR date-range parameters
function vrDate(d: Date): string {
  return (
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0') +
    d.getFullYear()
  );
}

// I20600 + start/end dates = 1-year alarm history range
function buildAlarmHistoryCmd(): { cmd: Uint8Array; dateRange: string } {
  const end = new Date();
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 1);
  const cmd = buildCmd(`I20600${vrDate(start)}${vrDate(end)}`);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return { cmd, dateRange: `${fmt(start)} – ${fmt(end)}` };
}

// I10100 — full console / system setup report
const CONSOLE_SETUP_CMD  = buildCmd('I10100');
// I30100 — brief system status (active alarms, health)
const SYSTEM_STATUS_CMD  = buildCmd('I30100');
// I20100 — tank inventory (levels, water, temp, ullage)
const INVENTORY_CMD      = buildCmd('I20100');

// VR raw function code pattern — if the user types one directly, skip AI
const VR_CODE_RE = /^[Ii][0-9]{5}$/;

// ── PDF generation (lazy-loaded so jsPDF doesn't bloat initial bundle) ────────
async function savePdf(opts: {
  title: string;
  subtitle: string;
  filename: string;
  content: string;
}) {
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });
  const pageW = doc.internal.pageSize.width;
  const pageH = doc.internal.pageSize.height;
  const ml = 36; // margin left
  const mr = 36; // margin right
  const mt = 36; // margin top
  const mb = 36; // margin bottom
  const contentW = pageW - ml - mr;
  const lineH = 10; // line height at 8pt Courier

  // ── Header (first page only) ─────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('TLS-450PLUS — ' + opts.title, ml, mt + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(opts.subtitle, ml, mt + 27);
  doc.text(`Generated: ${new Date().toLocaleString()}`, ml, mt + 39);
  doc.setTextColor(0, 0, 0);

  // Rule under header
  doc.setDrawColor(180, 180, 180);
  doc.line(ml, mt + 46, pageW - mr, mt + 46);

  // ── Content ──────────────────────────────────────────────────────────────
  doc.setFont('Courier', 'normal');
  doc.setFontSize(8);

  let y = mt + 58;
  const rawLines = opts.content.split('\n');

  for (const rawLine of rawLines) {
    const line = rawLine.replace(/\r/g, '');
    const wrapped: string[] = doc.splitTextToSize(line || ' ', contentW);
    for (const wl of wrapped) {
      if (y + lineH > pageH - mb) {
        doc.addPage();
        // Minimal page header on continuation pages
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(`TLS-450PLUS — ${opts.title}`, ml, mt);
        doc.setDrawColor(200, 200, 200);
        doc.line(ml, mt + 6, pageW - mr, mt + 6);
        doc.setTextColor(0, 0, 0);
        doc.setFont('Courier', 'normal');
        doc.setFontSize(8);
        y = mt + 18;
      }
      doc.text(wl, ml, y);
      y += lineH;
    }
  }

  // Page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${totalPages}`, pageW - mr, pageH - 18, { align: 'right' });
  }

  doc.save(opts.filename);
}

type ConnStatus = 'idle' | 'connecting' | 'connected' | 'running' | 'error';
type ReportType = 'alarm-history' | 'console-setup' | 'custom' | 'mixed' | null;

const STATUS_LABEL: Record<ConnStatus, string> = {
  idle:       'Not connected',
  connecting: 'Connecting…',
  connected:  'Connected',
  running:    'Retrieving…',
  error:      'Error',
};
const STATUS_COLOR: Record<ConnStatus, string> = {
  idle:       '#64748b',
  connecting: '#f59e0b',
  connected:  '#22d3ee',
  running:    '#a78bfa',
  error:      '#f87171',
};

export default function TlsPage() {
  const [ready,        setReady]       = useState(false);
  const [authed,       setAuthed]      = useState(false);
  const [activeTab,    setActiveTab]   = useState<'serial' | 'ethernet'>('serial');
  const [isOnline,     setIsOnline]    = useState(true);

  // ── Serial state ───────────────────────────────────────────────────────────
  const [status,       setStatus]      = useState<ConnStatus>('idle');
  const [connErr,      setConnErr]     = useState('');
  const [output,       setOutput]      = useState('');
  const [baud,         setBaud]        = useState(9600);
  const [dataBits,     setDataBits]    = useState<7 | 8>(8);
  const [parity,       setParity]      = useState<'none' | 'even' | 'odd'>('none');
  const [stopBits,     setStopBits]    = useState<1 | 2>(1);
  const [availPorts,   setAvailPorts]  = useState<AppSerialPort[]>([]);
  const [selectedPort, setSelectedPort] = useState<AppSerialPort | null>(null);
  const [reportType,   setReportType]  = useState<ReportType>(null);
  const [alarmRange,   setAlarmRange]  = useState('');
  const [saving,       setSaving]      = useState(false);
  const [analyzing,    setAnalyzing]   = useState(false);
  const [aiAnalysis,   setAiAnalysis]  = useState('');
  const [cmdInput,     setCmdInput]    = useState('');
  const [cmdBusy,      setCmdBusy]     = useState(false);
  const [cmdFeedback,  setCmdFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const portRef           = useRef<AppSerialPort | null>(null);
  const cmdInputRef       = useRef<HTMLInputElement>(null);
  const readerRef         = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const termRef           = useRef<HTMLPreElement>(null);
  const pendingAnalyzeRef = useRef(false);

  // ── Ethernet state ─────────────────────────────────────────────────────────
  const [ethIp,        setEthIp]       = useState('');
  const [ethPort,      setEthPort]     = useState('80');
  const [ethTesting,   setEthTesting]  = useState(false);
  const [ethResult,    setEthResult]   = useState<{ ok: boolean; msg: string } | null>(null);

  // Track online/offline status
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const up   = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener('online',  up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  // Auth check on mount — offline fallback uses localStorage flag set on last successful login
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.username) {
          localStorage.setItem('ft_tls_authed', '1');
          setAuthed(true);
        } else {
          window.location.href = '/login';
        }
      })
      .catch(() => {
        if (!navigator.onLine && localStorage.getItem('ft_tls_authed') === '1') {
          setAuthed(true);
        } else {
          window.location.href = '/login';
        }
      })
      .finally(() => setReady(true));
  }, []);

  // Auto-scroll terminal as output grows
  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [output]);

  // Populate previously-granted ports on mount
  useEffect(() => {
    const serial = getSerial();
    if (!serial) return;
    serial.getPorts().then(ports => {
      setAvailPorts(ports);
      if (ports.length === 1) setSelectedPort(ports[0]);
    }).catch(() => {});
  }, []);

  const chooseDifferentPort = useCallback(async () => {
    const serial = getSerial();
    if (!serial) return;
    try {
      const port = await serial.requestPort();
      setSelectedPort(port);
      serial.getPorts().then(setAvailPorts).catch(() => {});
    } catch { /* user cancelled picker */ }
  }, []);

  const connect = useCallback(async () => {
    const serial = getSerial();
    if (!serial) return;
    setStatus('connecting');
    setConnErr('');
    try {
      let port: AppSerialPort;
      if (selectedPort) {
        port = selectedPort;
      } else {
        port = await serial.requestPort();
        setSelectedPort(port);
        serial.getPorts().then(setAvailPorts).catch(() => {});
      }
      await port.open({ baudRate: baud, dataBits, stopBits, parity, flowControl: 'none' });
      portRef.current = port;
      setStatus('connected');
      setOutput('');
      setReportType(null);
    } catch (e: unknown) {
      const err = e as Error;
      if (err.name === 'NotFoundError') setStatus('idle');
      else { setConnErr(err.message ?? 'Could not open port.'); setStatus('error'); }
    }
  }, [baud, dataBits, stopBits, parity, selectedPort]);

  const disconnect = useCallback(async () => {
    try {
      if (readerRef.current) await readerRef.current.cancel();
      readerRef.current = null;
      if (portRef.current) await portRef.current.close();
    } catch { /* ignore */ }
    portRef.current = null;
    setStatus('idle');
  }, []);

  const runCommand = useCallback(async (
    cmd: Uint8Array,
    label: string,
    type: Exclude<ReportType, 'mixed' | null>,
  ) => {
    const port = portRef.current;
    if (!port?.writable || !port?.readable) return;

    setStatus('running');
    setReportType(prev =>
      prev === null ? type : prev === type ? type : 'mixed'
    );
    setOutput(prev =>
      prev + `\n${'─'.repeat(44)}\n▶  ${label}\n${'─'.repeat(44)}\n`
    );

    // Write command frame to ATG
    const writer = port.writable.getWriter();
    try { await writer.write(cmd); } finally { writer.releaseLock(); }

    // Read until ETX or timeout (8s idle resets per chunk; 90s total)
    const reader = port.readable.getReader();
    readerRef.current = reader;
    const decoder = new TextDecoder('ascii');
    let gotData = false;

    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => reader.cancel(), 8_000);
    };
    const totalTimer = setTimeout(() => reader.cancel(), 90_000);
    resetIdle();

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done || !value) break;
        gotData = true;
        resetIdle();
        const text = decoder.decode(value, { stream: true }).replace(/[\x01\x03]/g, '');
        if (text) setOutput(prev => prev + text);
        if (value.indexOf(0x03) !== -1) break;
      }
    } catch { /* cancel() expected */ }
    finally {
      if (idleTimer) clearTimeout(idleTimer);
      clearTimeout(totalTimer);
      try { reader.releaseLock(); } catch { /* ignore */ }
      readerRef.current = null;
    }

    if (!gotData) {
      setOutput(prev =>
        prev + '[No response — verify cable, ATG power, and baud rate]\n'
      );
    }

    setStatus('connected');
  }, []);

  const handleAlarmHistory = useCallback(() => {
    const { cmd, dateRange } = buildAlarmHistoryCmd();
    setAlarmRange(dateRange);
    runCommand(cmd, `Alarm History  (I20600) — ${dateRange}`, 'alarm-history');
  }, [runCommand]);

  const handleConsoleSetup = useCallback(() => {
    runCommand(CONSOLE_SETUP_CMD, 'Console Setup Report  (I10100)', 'console-setup');
  }, [runCommand]);

  const handleSystemStatus = useCallback(() => {
    runCommand(SYSTEM_STATUS_CMD, 'System Status  (I30100)', 'custom');
  }, [runCommand]);

  const handleInventory = useCallback(() => {
    runCommand(INVENTORY_CMD, 'Tank Inventory — All Tanks  (I20100)', 'custom');
  }, [runCommand]);

  const handleAutoDiagnose = useCallback(() => {
    if (status !== 'connected' || analyzing) return;
    // Clear terminal so Claude sees only the fresh system status
    setOutput('');
    setReportType(null);
    setAlarmRange('');
    setAiAnalysis('');
    pendingAnalyzeRef.current = true;
    runCommand(SYSTEM_STATUS_CMD, 'System Status — Auto-Diagnose  (I30100)', 'custom');
  }, [status, analyzing, runCommand]);

  const handleAnalyze = useCallback(async () => {
    if (!output || analyzing) return;
    setAnalyzing(true);
    setAiAnalysis('');
    try {
      const res = await fetch('/api/tls/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ output }),
      });
      if (!res.ok || !res.body) throw new Error('failed');
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setAiAnalysis(prev => prev + dec.decode(value, { stream: true }));
      }
    } catch {
      setAiAnalysis('Analysis failed — check your connection and try again.');
    } finally {
      setAnalyzing(false);
    }
  }, [output, analyzing]);

  // Trigger AI analysis automatically after auto-diagnose command finishes
  useEffect(() => {
    if (pendingAnalyzeRef.current && status === 'connected') {
      pendingAnalyzeRef.current = false;
      handleAnalyze();
    }
  }, [status, handleAnalyze]);

  const handleSavePdf = useCallback(async () => {
    if (!output || saving) return;
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    try {
      if (reportType === 'alarm-history') {
        await savePdf({
          title: 'Alarm History Report',
          subtitle: `Date range: ${alarmRange}`,
          filename: `TLS450-AlarmHistory-${today}.pdf`,
          content: output,
        });
      } else if (reportType === 'console-setup') {
        await savePdf({
          title: 'Console Setup Report',
          subtitle: `Retrieved: ${new Date().toLocaleDateString()}`,
          filename: `TLS450-ConsoleSetup-${today}.pdf`,
          content: output,
        });
      } else {
        await savePdf({
          title: 'ATG Report',
          subtitle: `Retrieved: ${new Date().toLocaleString()}`,
          filename: `TLS450-Report-${today}.pdf`,
          content: output,
        });
      }
    } catch {
      if (!navigator.onLine) {
        alert('PDF library not yet cached. Open this page once with internet and click "Save PDF" to enable offline PDF saving.');
      }
    } finally {
      setSaving(false);
    }
  }, [output, saving, reportType, alarmRange]);

  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); };
  }, []);
  const handleCopy = () => {
    navigator.clipboard.writeText(output)
      .then(() => {
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        setCmdFeedback({ ok: true, text: 'Output copied to clipboard.' });
        copyTimerRef.current = setTimeout(() => { setCmdFeedback(null); copyTimerRef.current = null; }, 2000);
      })
      .catch(() => { setCmdFeedback({ ok: false, text: 'Clipboard access denied.' }); });
  };

  const handleClear = () => {
    setOutput('');
    setReportType(null);
    setAlarmRange('');
    setAiAnalysis('');
  };

  const handleCmdSend = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    const raw = cmdInput.trim();
    if (!raw || cmdBusy || status === 'running' || !portRef.current) return;

    setCmdFeedback(null);
    setCmdBusy(true);

    try {
      let code: string;
      let label: string;

      if (VR_CODE_RE.test(raw)) {
        // Raw VR function code entered directly — send as-is (uppercase)
        code  = raw.toUpperCase();
        label = `Direct command  (${code})`;
      } else {
        // Natural language — needs internet for AI interpretation
        if (!navigator.onLine) {
          setCmdFeedback({ ok: false, text: 'No internet — AI unavailable offline. Enter a raw VR code directly (e.g. I20100, I20600, I10100).' });
          setCmdBusy(false);
          return;
        }
        setCmdFeedback({ ok: true, text: 'Interpreting request…' });
        const res  = await fetch('/api/tls/interpret', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ request: raw }),
        });
        const data = await res.json();

        if (!data.code) {
          setCmdFeedback({ ok: false, text: data.explanation ?? 'Could not map to a VR command.' });
          setCmdBusy(false);
          return;
        }

        code  = data.code as string;
        label = `${data.label ?? code}  (${code})`;
        setCmdFeedback({ ok: true, text: `Sending: ${label}` });
      }

      setCmdInput('');
      await runCommand(buildCmd(code), label, 'custom');
    } catch {
      setCmdFeedback({ ok: false, text: 'Request failed. Check connection.' });
    } finally {
      setCmdBusy(false);
      cmdInputRef.current?.focus();
    }
  }, [cmdInput, cmdBusy, status, runCommand]);

  // ── Ethernet handlers ──────────────────────────────────────────────────────
  const ethUrl = `http://${ethIp.trim()}:${ethPort.trim() || '80'}`;

  const handleEthTest = useCallback(async () => {
    if (!ethIp.trim()) return;
    setEthTesting(true);
    setEthResult(null);
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const ctrl = new AbortController();
      timer = setTimeout(() => ctrl.abort(), 6_000);
      // mode: 'no-cors' — fetch resolves (opaque) if device responds, throws if unreachable
      await fetch(ethUrl, { signal: ctrl.signal, mode: 'no-cors' });
      setEthResult({ ok: true, msg: `Device is responding at ${ethIp.trim()}` });
    } catch (e: unknown) {
      const name = (e as Error).name;
      setEthResult({
        ok:  false,
        msg: name === 'AbortError'
          ? 'Connection timed out — verify the IP and that the ATG is on this network'
          : 'Could not reach device — check IP address and network connection',
      });
    } finally {
      if (timer) clearTimeout(timer);
      setEthTesting(false);
    }
  }, [ethIp, ethUrl]);

  const handleEthOpen = useCallback(() => {
    if (!ethIp.trim()) return;
    window.open(ethUrl, '_blank', 'noopener,noreferrer');
  }, [ethIp, ethUrl]);

  if (!ready || !authed) return null;

  const hasSerial = !!getSerial();
  const isConn    = status === 'connected' || status === 'running';
  const isBusy    = status === 'running';
  const dot       = STATUS_COLOR[status];

  return (
    <div className="tls-page">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="tls-header">
        <Link href="/chat" className="tls-back-link">← Chat</Link>
        <div className="tls-header-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" className="tls-header-logo" />
          <div>
            <div className="tls-header-title">TLS-450PLUS Direct Connect</div>
            <div className="tls-header-sub">RS-232 Serial &amp; Ethernet Web Interface</div>
          </div>
        </div>
        <div
          className="tls-status-badge"
          style={{ background: dot + '1a', color: dot, borderColor: dot + '55' }}
        >
          <span className="tls-status-dot" style={{ background: dot }} />
          {STATUS_LABEL[status]}
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="tls-body">

        {/* Tab bar */}
        <div className="tls-tabs">
          <button
            className={`tls-tab${activeTab === 'serial' ? ' tls-tab-active' : ''}`}
            onClick={() => setActiveTab('serial')}
          >
            🔌 RS-232 Serial
          </button>
          <button
            className={`tls-tab${activeTab === 'ethernet' ? ' tls-tab-active' : ''}`}
            onClick={() => setActiveTab('ethernet')}
          >
            🌐 Ethernet / Web Interface
          </button>
        </div>

        {/* ── Serial tab ─────────────────────────────────────────────────── */}
        {activeTab === 'serial' && <>

        {!hasSerial && (
          <div className="tls-no-serial">
            <span className="tls-no-serial-icon">⚠</span>
            <div>
              <strong>This browser does not support serial port access.</strong>
              <br />
              Open this page in <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong>{' '}
              on the laptop or PC that is physically connected to the ATG via USB-to-RS-232 adapter.
              Safari, Firefox, and mobile browsers will not work — a desktop Chrome or Edge window is required.
            </div>
          </div>
        )}

        {/* Offline notice */}
        {!isOnline && (
          <div className="tls-offline-banner">
            <span>📡</span>
            <span>
              <strong>Working offline.</strong> RS-232 serial commands, quick actions, and PDF saving work normally.
              AI command interpretation is unavailable — use raw VR codes (e.g. <code>I20100</code>) instead.
            </span>
          </div>
        )}

        {/* Connection settings */}
        <div className="tls-card">
          <div className="tls-card-title">Serial Connection</div>

          {/* COM port detection */}
          <div className="tls-ports-section">
            <div className="tls-ports-header">
              <span className="tls-field-label">COM Port</span>
              <button
                className="tls-port-scan-btn"
                onClick={chooseDifferentPort}
                disabled={isConn || !hasSerial}
                title="Open browser port picker to select a COM port"
              >
                Browse Ports…
              </button>
            </div>

            {availPorts.length === 0 ? (
              <div className="tls-port-empty">
                No saved ports yet — click <strong>Browse Ports…</strong> to select your
                USB-to-serial adapter from the browser&apos;s port list. Your browser will remember
                it for next time.
              </div>
            ) : (
              <div className="tls-ports-list">
                {availPorts.map((p, i) => (
                  <label
                    key={i}
                    className={`tls-port-item${selectedPort === p ? ' tls-port-item-active' : ''}`}
                  >
                    <input
                      type="radio"
                      name="com-port"
                      checked={selectedPort === p}
                      onChange={() => setSelectedPort(p)}
                      disabled={isConn}
                    />
                    <span className="tls-port-name">{portLabel(p, i)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Serial parameters */}
          <div className="tls-serial-params">
            <div className="tls-field">
              <div className="tls-field-label">Baud Rate</div>
              <select className="tls-select" value={baud} onChange={e => setBaud(Number(e.target.value))} disabled={isConn || !hasSerial}>
                <option value={9600}>9600</option>
                <option value={19200}>19200</option>
                <option value={38400}>38400</option>
                <option value={57600}>57600</option>
                <option value={115200}>115200</option>
              </select>
            </div>
            <div className="tls-field">
              <div className="tls-field-label">Data Bits</div>
              <select className="tls-select" value={dataBits} onChange={e => setDataBits(Number(e.target.value) as 7 | 8)} disabled={isConn || !hasSerial}>
                <option value={8}>8</option>
                <option value={7}>7</option>
              </select>
            </div>
            <div className="tls-field">
              <div className="tls-field-label">Parity</div>
              <select className="tls-select" value={parity} onChange={e => setParity(e.target.value as 'none' | 'even' | 'odd')} disabled={isConn || !hasSerial}>
                <option value="none">None</option>
                <option value="even">Even</option>
                <option value="odd">Odd</option>
              </select>
            </div>
            <div className="tls-field">
              <div className="tls-field-label">Stop Bits</div>
              <select className="tls-select" value={stopBits} onChange={e => setStopBits(Number(e.target.value) as 1 | 2)} disabled={isConn || !hasSerial}>
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </div>
            <div className="tls-field">
              <div className="tls-field-label">Flow Control</div>
              <div className="tls-field-fixed">None</div>
            </div>
          </div>

          {/* Connect / Disconnect */}
          <div className="tls-conn-actions">
            {isConn ? (
              <button className="tls-btn tls-btn-disconnect" onClick={disconnect} disabled={isBusy}>
                Disconnect
              </button>
            ) : (
              <button
                className="tls-btn tls-btn-connect"
                onClick={connect}
                disabled={!hasSerial || status === 'connecting'}
              >
                {status === 'connecting'
                  ? 'Connecting…'
                  : selectedPort
                    ? `Connect — ${portLabel(selectedPort, availPorts.indexOf(selectedPort))}`
                    : 'Choose Port & Connect'}
              </button>
            )}
          </div>

          {connErr && <div className="tls-conn-error">{connErr}</div>}
          <div className="tls-conn-hint">
            Requires a <strong>USB-to-RS-232 adapter</strong> plugged into your PC and connected
            to the TLS-450PLUS computer port (DB9 or DB25). TLS-450PLUS default is{' '}
            <strong>9600 baud, 8-N-1</strong> — only change if the ATG is configured differently.
          </div>
        </div>

        {/* Quick actions */}
        <div className="tls-card">
          <div className="tls-card-title">Quick Actions</div>
          <div className="tls-actions-grid">

            <button
              className="tls-action"
              disabled={!isConn || isBusy}
              onClick={handleAlarmHistory}
            >
              <div className="tls-action-icon">🔔</div>
              <div>
                <div className="tls-action-name">Alarm History — 1 Year</div>
                <div className="tls-action-desc">
                  Requests the last 12 months of alarm events directly from the ATG. Covers all
                  leak, overfill, sensor, delivery, and system alarms. Required for TCEQ and state
                  environmental compliance documentation.
                </div>
              </div>
            </button>

            <button
              className="tls-action"
              disabled={!isConn || isBusy}
              onClick={handleSystemStatus}
            >
              <div className="tls-action-icon">📊</div>
              <div>
                <div className="tls-action-name">System Status</div>
                <div className="tls-action-desc">
                  Current ATG health and active alarms via I30100. Shows real-time fault
                  conditions and system alerts — fastest way to see what&apos;s wrong right now.
                </div>
              </div>
            </button>

            <button
              className="tls-action"
              disabled={!isConn || isBusy}
              onClick={handleInventory}
            >
              <div className="tls-action-icon">🛢️</div>
              <div>
                <div className="tls-action-name">Tank Inventory</div>
                <div className="tls-action-desc">
                  Current fuel levels, water levels, temperature, and ullage for all tanks
                  via I20100. Instant snapshot of what&apos;s in the ground right now.
                </div>
              </div>
            </button>

            <button
              className="tls-action"
              disabled={!isConn || isBusy}
              onClick={handleConsoleSetup}
            >
              <div className="tls-action-icon">⚙️</div>
              <div>
                <div className="tls-action-name">Console Setup Report</div>
                <div className="tls-action-desc">
                  Full ATG configuration: tank dimensions, product assignment, probe types, alarm
                  setpoints, leak test thresholds, and sensor wiring. Use to verify or document
                  setup for compliance or service records.
                </div>
              </div>
            </button>

            <button
              className="tls-action tls-action-ai"
              disabled={!isConn || isBusy || analyzing}
              onClick={handleAutoDiagnose}
            >
              <div className="tls-action-icon">🤖</div>
              <div>
                <div className="tls-action-name">Auto-Diagnose Active Alarms</div>
                <div className="tls-action-desc">
                  Pulls live system status from the ATG and immediately sends it to Claude for AI
                  diagnosis — one click to read active alarms and get numbered corrective action
                  steps with documentation references.
                </div>
              </div>
            </button>

          </div>
          {!isConn && (
            <div className="tls-actions-lock">Connect to the ATG first to enable quick actions</div>
          )}
        </div>

        {/* Output terminal */}
        <div className="tls-card tls-terminal-card">
          <div className="tls-card-header">
            <div className="tls-card-title" style={{ margin: 0 }}>Output</div>
            <div className="tls-term-tools">
              {isBusy && <span className="tls-spin" />}
              <button className="tls-tool-btn" onClick={handleClear} disabled={!output}>Clear</button>
              <button className="tls-tool-btn" onClick={handleCopy} disabled={!output}>Copy</button>
              <button
                className="tls-tool-btn tls-tool-primary"
                onClick={handleSavePdf}
                disabled={!output || saving}
              >
                {saving ? 'Saving…' : 'Save PDF'}
              </button>
            </div>
          </div>
          <pre className="tls-terminal" ref={termRef}>
            {output || (isConn
              ? 'Ready — select a quick action above to pull a report.'
              : 'Connect to the ATG to begin.'
            )}
          </pre>
          {cmdFeedback && (
            <div className={`tls-cmd-feedback${cmdFeedback.ok ? '' : ' tls-cmd-feedback-err'}`}>
              {cmdFeedback.ok ? '↳ ' : '⚠ '}{cmdFeedback.text}
            </div>
          )}
        </div>

        {/* ── AI Diagnosis ──────────────────────────────────────────────────── */}
        {output && (
          <div className="tls-card tls-ai-card">
            <div className="tls-card-header">
              <div className="tls-card-title" style={{ margin: 0 }}>AI Diagnosis</div>
              <button
                className="tls-btn tls-btn-connect tls-cmd-send"
                onClick={handleAnalyze}
                disabled={analyzing || !isOnline}
                style={{ minWidth: 140 }}
              >
                {analyzing ? 'Analyzing…' : 'Analyze with AI'}
              </button>
            </div>
            {!isOnline && (
              <div className="tls-cmd-feedback tls-cmd-feedback-err">
                ⚠ Internet connection required for AI diagnosis.
              </div>
            )}
            {analyzing && !aiAnalysis && (
              <div className="tls-cmd-feedback">
                ↳ Searching documentation and generating diagnosis…
              </div>
            )}
            {aiAnalysis && (() => {
              const suggestedCodes = [...new Set(
                [...aiAnalysis.matchAll(/`([Ii]\d{5}[^`]*)`/g)].map(m => m[1].trim())
              )];
              return (
                <>
                  <pre className="tls-terminal tls-ai-result">{aiAnalysis}</pre>
                  {suggestedCodes.length > 0 && (
                    <div className="tls-suggested-cmds">
                      <div className="tls-suggested-label">Suggested commands — click to send to ATG:</div>
                      <div className="tls-suggested-chips">
                        {suggestedCodes.map(code => (
                          <button
                            key={code}
                            className="tls-cmd-ex-chip tls-cmd-ex-chip-send"
                            disabled={!isConn || isBusy}
                            onClick={() => runCommand(
                              buildCmd(code.split(/\s+/)[0].toUpperCase()),
                              `${code} (suggested)`,
                              'custom'
                            )}
                          >
                            {code} ↗
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
            {!aiAnalysis && !analyzing && (
              <p className="tls-cmd-desc">
                Click <strong>Analyze with AI</strong> to search the Veeder-Root documentation
                database and get a detailed breakdown of any alarms, faults, and readings in the
                terminal output above.
              </p>
            )}
            <div className="tls-cmd-desc" style={{ marginTop: 8, opacity: 0.6, fontSize: '0.75rem' }}>
              Requires internet — AI uses your terminal output and Veeder-Root documentation to generate the diagnosis.
            </div>
          </div>
        )}

        {/* ── AI Command Prompt ─────────────────────────────────────────────── */}
        <div className="tls-card tls-cmd-card">
          <div className="tls-card-title">Command Prompt</div>
          <p className="tls-cmd-desc">
            Ask a question in plain English or enter a VR function code directly (e.g.{' '}
            <code className="tls-cmd-code">I20100</code>). The AI will translate your request
            into the correct serial command and send it to the ATG.
          </p>
          <form className="tls-cmd-form" onSubmit={handleCmdSend}>
            <input
              ref={cmdInputRef}
              type="text"
              className="tls-cmd-input"
              placeholder={isConn ? 'Ask a question or enter a VR code…' : 'Connect to the ATG first…'}
              value={cmdInput}
              onChange={e => { setCmdInput(e.target.value); setCmdFeedback(null); }}
              disabled={!isConn || isBusy || cmdBusy}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="submit"
              className="tls-btn tls-btn-connect tls-cmd-send"
              disabled={!isConn || isBusy || cmdBusy || !cmdInput.trim()}
            >
              {cmdBusy ? '…' : 'Send'}
            </button>
          </form>
          <div className="tls-cmd-examples">
            <span className="tls-cmd-ex-label">Examples:</span>
            {[
              'Show tank inventory',
              'Delivery report for tank 2',
              'Current system status',
              'I20500',
            ].map(ex => (
              <button
                key={ex}
                type="button"
                className="tls-cmd-ex-chip"
                disabled={!isConn || isBusy || cmdBusy}
                onClick={() => { setCmdInput(ex); setCmdFeedback(null); cmdInputRef.current?.focus(); }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        </> /* end serial tab */}

        {/* ── Ethernet tab ───────────────────────────────────────────────── */}
        {activeTab === 'ethernet' && (
          <div className="tls-card tls-eth-card">
            <div className="tls-card-title">Ethernet / Web Interface</div>
            <p className="tls-eth-desc">
              Enter the TLS-450PLUS IP address to open its built-in web interface directly
              in a new browser tab. The ATG must be on the same network as this PC.
              Contact your network administrator or check the ATG's network settings screen
              for the IP address.
            </p>

            <div className="tls-eth-form">
              <div className="tls-eth-fields">
                <div className="tls-field">
                  <div className="tls-field-label">ATG IP Address</div>
                  <input
                    type="text"
                    className="tls-cmd-input tls-eth-ip"
                    placeholder="e.g. 192.168.1.100"
                    value={ethIp}
                    onChange={e => { setEthIp(e.target.value); setEthResult(null); }}
                    spellCheck={false}
                    autoComplete="off"
                  />
                </div>
                <div className="tls-field">
                  <div className="tls-field-label">Port</div>
                  <input
                    type="text"
                    className="tls-cmd-input tls-eth-port"
                    placeholder="80"
                    value={ethPort}
                    onChange={e => { setEthPort(e.target.value); setEthResult(null); }}
                    spellCheck={false}
                  />
                </div>
              </div>
              <div className="tls-eth-btns">
                <button
                  className="tls-btn tls-btn-disconnect"
                  onClick={handleEthTest}
                  disabled={!ethIp.trim() || ethTesting}
                >
                  {ethTesting ? 'Testing…' : 'Test Connection'}
                </button>
                <button
                  className="tls-btn tls-btn-connect"
                  onClick={handleEthOpen}
                  disabled={!ethIp.trim()}
                >
                  Open Web Interface →
                </button>
              </div>
            </div>

            {ethResult && (
              <div className={`tls-eth-result${ethResult.ok ? ' tls-eth-result-ok' : ' tls-eth-result-err'}`}>
                {ethResult.ok ? '✓' : '✗'} {ethResult.msg}
              </div>
            )}

            <div className="tls-eth-hints">
              <div className="tls-eth-hint-row">
                <span className="tls-eth-hint-icon">ℹ</span>
                <span>
                  The web interface opens on <strong>port 80</strong> by default. Only change the
                  port if your ATG is configured to use a different one.
                </span>
              </div>
              <div className="tls-eth-hint-row">
                <span className="tls-eth-hint-icon">ℹ</span>
                <span>
                  If you cannot reach the ATG, verify the unit has an active Ethernet connection,
                  the IP is correctly set under <strong>Setup → Communication → TCP/IP</strong>,
                  and this PC is on the same subnet.
                </span>
              </div>
              <div className="tls-eth-hint-row">
                <span className="tls-eth-hint-icon">⚠</span>
                <span>
                  Some network configurations block cross-subnet traffic. You may need to connect
                  directly to the ATG's network port or a dedicated service VLAN.
                </span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
