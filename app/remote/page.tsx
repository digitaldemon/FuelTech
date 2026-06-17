"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

export default function RemotePage() {
  const [output,     setOutput]     = useState("");
  const [connStatus, setConnStatus] = useState("");
  const [updatedAt,  setUpdatedAt]  = useState<Date | null>(null);
  const [noSession,  setNoSession]  = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [cmdInput,   setCmdInput]   = useState("");
  const [sending,    setSending]    = useState(false);
  const [sendMsg,    setSendMsg]    = useState<{ ok: boolean; text: string } | null>(null);
  const termRef    = useRef<HTMLPreElement>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendMsgRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/remote");
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (res.status === 403) { window.location.href = "/expired"; return; }
      const data = await res.json() as {
        noSession?: boolean;
        output?: string;
        connStatus?: string;
        updatedAt?: string;
      };
      if (data.noSession) {
        setNoSession(true);
        setOutput("");
        setUpdatedAt(null);
      } else {
        setNoSession(false);
        setOutput(data.output ?? "");
        setConnStatus(data.connStatus ?? "");
        setUpdatedAt(data.updatedAt ? new Date(data.updatedAt) : null);
      }
    } catch { /* keep last known state on network error */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    poll();
    pollRef.current = setInterval(poll, 6_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (sendMsgRef.current) clearTimeout(sendMsgRef.current);
    };
  }, [poll]);

  // Auto-scroll terminal on new output
  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [output]);

  const sendCommand = useCallback(async (command: string, label: string) => {
    if (sending) return;
    setSending(true);
    setSendMsg(null);
    try {
      const res = await fetch("/api/remote/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, label }),
      });
      const data = await res.json() as { error?: string };
      if (res.ok) {
        setSendMsg({ ok: true, text: `${label} queued — results appear in ~10 seconds.` });
        setCmdInput("");
      } else {
        setSendMsg({ ok: false, text: data.error ?? "Failed to send command." });
      }
    } catch {
      setSendMsg({ ok: false, text: "Network error. Try again." });
    } finally {
      setSending(false);
      if (sendMsgRef.current) clearTimeout(sendMsgRef.current);
      sendMsgRef.current = setTimeout(() => setSendMsg(null), 6_000);
    }
  }, [sending]);

  const handleCmdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = cmdInput.trim().toUpperCase();
    if (!raw) return;
    if (!/^[IiSsPp]\d{5}/.test(raw)) {
      setSendMsg({ ok: false, text: "Enter a VR function code (e.g. I30100, I20100, I20600)." });
      return;
    }
    sendCommand(raw, raw);
  };

  const QUICK = [
    { label: "System Status", command: "I30100" },
    { label: "Tank Inventory", command: "I20100" },
    { label: "Alarm History", command: "I20600" },
  ];

  const ageSeconds   = updatedAt ? (Date.now() - updatedAt.getTime()) / 1000 : null;
  const isLive       = ageSeconds !== null && ageSeconds < 90;
  const isStale      = ageSeconds !== null && ageSeconds >= 90;
  const sessionGone  = noSession || !updatedAt;

  const dotColor  = sessionGone ? "#64748b" : isLive ? "#22d3ee" : "#f59e0b";
  const statusTxt = sessionGone
    ? "No active session"
    : isLive
      ? "Live"
      : `Last seen ${Math.round(ageSeconds! / 60)}m ago`;

  const canSend = isLive && !sending && connStatus !== "disconnected";

  return (
    <div className="rem-page">
      <header className="rem-header">
        <Link href="/chat" className="rem-back">← Chat</Link>
        <div className="rem-header-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" className="rem-logo" />
          <div>
            <div className="rem-title">Remote Monitor</div>
            <div className="rem-sub">ATG Live View</div>
          </div>
        </div>
        <div
          className="rem-status"
          style={{ color: dotColor, borderColor: dotColor + "55", background: dotColor + "1a" }}
        >
          <span className="rem-dot" style={{ background: dotColor }} />
          {statusTxt}
        </div>
      </header>

      <div className="rem-body">
        {loading ? (
          <div className="rem-loading">Connecting…</div>
        ) : noSession ? (
          <div className="rem-no-session">
            <div className="rem-no-session-icon">📡</div>
            <div className="rem-no-session-title">No active session</div>
            <p className="rem-no-session-desc">
              No laptop is currently pushing data. Follow the steps below to get connected.
            </p>
            <div className="rem-setup-card">
              <div className="rem-setup-title">How to start a Remote Session</div>
              <ol className="rem-setup-steps">
                <li>
                  <span className="rem-step-num">1</span>
                  <span>Open <strong>FuelTech AI Console Connect</strong> on the Windows laptop that is physically connected to the ATG.</span>
                </li>
                <li>
                  <span className="rem-step-num">2</span>
                  <span>In the <strong>Serial Port</strong> tab, select the correct COM port and set baud rate to <strong>9600, 8N1</strong> (or match your ATG's port settings), then click <strong>Open Port</strong>.</span>
                </li>
                <li>
                  <span className="rem-step-num">3</span>
                  <span>Scroll down to the <strong>Remote Session</strong> card and click <strong>Start Remote Session</strong>. A blinking cyan dot confirms the laptop is pushing live data.</span>
                </li>
                <li>
                  <span className="rem-step-num">4</span>
                  <span>This page updates automatically — the status badge above will turn cyan and show <strong>Live</strong> within 10 seconds.</span>
                </li>
              </ol>
              <p className="rem-setup-note">
                The laptop must stay online (cell hotspot is fine) with Console Connect open. The serial port must remain connected to the ATG for commands to run.
              </p>
            </div>
          </div>
        ) : (
          <>
            {isStale && (
              <div className="rem-stale-banner">
                Session may be offline — last update was {Math.round(ageSeconds! / 60)} min ago. Check the laptop.
              </div>
            )}

            <div className="rem-card">
              <div className="rem-card-title">ATG Output</div>
              <pre className="rem-terminal" ref={termRef}>
                {output || "Waiting for ATG data…"}
              </pre>
              {updatedAt && (
                <div className="rem-updated">Updated {updatedAt.toLocaleTimeString()}</div>
              )}
            </div>

            <div className="rem-card">
              <div className="rem-card-title">Send Command</div>
              <div className="rem-quick-btns">
                {QUICK.map(a => (
                  <button
                    key={a.command}
                    className="rem-quick-btn"
                    disabled={!canSend}
                    onClick={() => sendCommand(a.command, a.label)}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <form className="rem-cmd-form" onSubmit={handleCmdSubmit}>
                <input
                  type="text"
                  className="rem-cmd-input"
                  placeholder="VR code (e.g. I30100, I20600)…"
                  value={cmdInput}
                  onChange={e => { setCmdInput(e.target.value.toUpperCase()); setSendMsg(null); }}
                  disabled={!canSend}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="submit"
                  className="rem-cmd-send"
                  disabled={!canSend || !cmdInput.trim()}
                >
                  {sending ? "…" : "Send"}
                </button>
              </form>
              {sendMsg && (
                <div className={`rem-send-msg${sendMsg.ok ? "" : " rem-send-msg-err"}`}>
                  {sendMsg.ok ? "↳ " : "⚠ "}{sendMsg.text}
                </div>
              )}
              {!canSend && !noSession && (
                <div className="rem-send-msg rem-send-msg-err">
                  ⚠ Session offline — commands unavailable until the laptop reconnects.
                </div>
              )}
              <p className="rem-cmd-hint">
                Commands run on the laptop — results appear here within ~10 seconds.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
