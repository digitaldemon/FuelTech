"use client";

import ChatBubble from '../components/ChatBubble';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Footprints, Camera, Sun, Moon } from 'lucide-react';

function FaqModal({ onClose }: { onClose: () => void }) {
  const [section, setSection] = useState<string>('overview');
  const code = (s: string) => (
    <code style={{ fontFamily: 'Consolas, monospace', fontSize: 12, background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: 4, color: '#22d3ee' }}>{s}</code>
  );
  const note = (s: string) => (
    <p style={{ marginTop: 8, color: '#64748b', fontSize: 13 }}>{s}</p>
  );
  const step = (n: number, text: React.ReactNode) => (
    <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
      <span style={{ minWidth: 22, height: 22, borderRadius: '50%', background: 'rgba(34,211,238,0.15)', color: '#22d3ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, flexShrink: 0, marginTop: 1 }}>{n}</span>
      <span>{text}</span>
    </div>
  );

  const NAV = [
    { id: 'overview',    label: '📖 Overview' },
    { id: 'chat',        label: '💬 AI Chat' },
    { id: 'direct',      label: '🔌 Direct Connect' },
    { id: 'desktop',     label: '🖥 Desktop App' },
    { id: 'remote',      label: '📡 Remote Monitor' },
    { id: 'homescreen',  label: '📱 Home Screen' },
    { id: 'tips',        label: '✅ Tips' },
    { id: 'videos',      label: '▶ Video Tutorials' },
  ];

  return (
    <div className="faq-overlay" onClick={onClose}>
      <div className="faq-modal faq-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="faq-header">
          <span className="faq-title">FuelTech AI Pro — Help &amp; User Guide</span>
          <button className="faq-close" onClick={onClose}>✕</button>
        </div>

        <div className="faq-layout">
          {/* Sidebar nav */}
          <nav className="faq-nav">
            {NAV.map(n => (
              <button key={n.id} className={`faq-nav-btn${section === n.id ? ' active' : ''}`} onClick={() => setSection(n.id)}>
                {n.label}
              </button>
            ))}
          </nav>

          <div className="faq-body">

            {/* ── Overview ── */}
            {section === 'overview' && <>
              <div className="faq-section">
                <div className="faq-section-title">What is FuelTech AI Pro?</div>
                <p>FuelTech AI Pro is an AI-powered field assistant built specifically for fuel system service technicians. It is trained on manufacturer documentation from Gilbarco, Veeder-Root, Franklin Fueling, Wayne/Tokheim, Red Jacket, and PEI — covering dispensers, ATG consoles, submersible pumps, sensors, and environmental compliance.</p>
                <p style={{ marginTop: 10 }}>Ask it anything you would normally look up in a service manual: error codes, calibration procedures, wiring diagrams, programming steps, startup checklists, regulatory requirements, and more. Atlas, the AI assistant, cites the exact document it used for every answer so you can verify before performing work on live equipment.</p>
              </div>

              <div className="faq-section">
                <div className="faq-section-title">What's included in your subscription</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                  {[
                    { icon: '💬', title: 'AI Chat Assistant', desc: 'Ask about any Gilbarco or Veeder-Root equipment — error codes, procedures, wiring, programming.' },
                    { icon: '🔌', title: 'ATG Direct Connect (Browser)', desc: 'Connect to a TLS console via RS-232 serial or Ethernet directly from Chrome or Edge — no install.' },
                    { icon: '🖥', title: 'Console Connect Desktop App', desc: 'Free Windows app for RS-232 serial with quick-action PDF exports, remote session, and AI analysis.' },
                    { icon: '📡', title: 'Remote Monitor', desc: 'Watch a live ATG from your phone while the laptop sits in the equipment room.' },
                    { icon: '📷', title: 'Photo Diagnosis', desc: 'Snap a photo of a display, label, or wiring and ask Atlas to identify the fault or explain the screen.' },
                    { icon: '📋', title: 'Compliance PDFs', desc: 'One-click alarm history and console setup reports — properly formatted for TCEQ and state docs.' },
                  ].map(f => (
                    <div key={f.title} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 18, marginBottom: 4 }}>{f.icon}</div>
                      <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 13, marginBottom: 4 }}>{f.title}</div>
                      <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{f.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="faq-section">
                <div className="faq-section-title">Supported equipment</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {['TLS-450PLUS', 'TLS-350', 'TLS-350R', 'TLS-300', 'Encore 500S', 'Encore 700', 'Edge Series', 'G-SITE', 'Passport', 'Wayne Ovation', 'Red Jacket', 'Franklin Fueling VST', 'OPW sensors', 'Veeder-Root probes & sensors'].map(eq => (
                    <span key={eq} style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)', borderRadius: 20, padding: '3px 10px', fontSize: 12, color: '#94a3b8' }}>{eq}</span>
                  ))}
                </div>
              </div>
            </>}

            {/* ── AI Chat ── */}
            {section === 'chat' && <>
              <div className="faq-section">
                <div className="faq-section-title">Equipment Selector</div>
                <p>Tap a model chip at the top of the chat screen before asking your question. This locks the context to that specific console or dispenser so every answer targets your exact equipment. The TLS-450PLUS and TLS-350 have different menu paths and alarm codes — selecting the right model makes a significant difference in accuracy.</p>
                <p style={{ marginTop: 10 }}>To clear your selection, tap the <strong>✕</strong> that appears next to the selected chip. You can change models at any point mid-conversation.</p>
              </div>

              <div className="faq-section">
                <div className="faq-section-title">Quick Question Chips</div>
                <p>The shortcut chips below the equipment selector (Error code lookup, Startup procedure, Wiring help, etc.) pre-build a question for your selected model. Some send immediately; others pre-fill the input box so you can add a specific code or detail before sending.</p>
                <p style={{ marginTop: 8, color: '#64748b', fontSize: 13 }}>Example: Select <em>TLS-450PLUS</em>, tap <em>Error code lookup</em>, then type the code — e.g. "0A02" — in the pre-filled input and send. Atlas returns the exact fault description and corrective action from Veeder-Root documentation.</p>
              </div>

              <div className="faq-section">
                <div className="faq-section-title">Guided Mode — Step-by-Step Procedures</div>
                <p>Toggle <strong style={{ color: '#22d3ee' }}>Guided</strong> in the chat header before asking a procedure question. Instead of giving you the full procedure at once, Atlas presents one step, waits for you to confirm it&apos;s done, then gives you the next step.</p>
                <p style={{ marginTop: 10 }}>Use the <strong>Next step →</strong> button to advance hands-free — no typing required. This is especially useful when you&apos;re doing a startup checkout or sensor replacement and need to keep your place without scrolling through a wall of text.</p>
                {note('Guided Mode works best with Chrome on a tablet propped on the equipment.')}
              </div>

              <div className="faq-section">
                <div className="faq-section-title">Photo Diagnosis</div>
                <p>Tap the camera icon in the chat input to attach a photo. Atlas can read ATG display screens, sensor labels, wiring terminals, nameplate data, and error messages from photos. Use it to:</p>
                <ul style={{ marginTop: 8, paddingLeft: 18, lineHeight: 2, fontSize: 14 }}>
                  <li>Identify an unfamiliar alarm or fault code on the console screen</li>
                  <li>Confirm a sensor part number from its label</li>
                  <li>Diagnose wiring issues from a photo of the terminal block</li>
                  <li>Read a dispenser nameplate to confirm model and serial number</li>
                </ul>
              </div>

              <div className="faq-section">
                <div className="faq-section-title">Sources &amp; Citations</div>
                <p>Every Atlas response includes a <strong>Sources</strong> section listing the exact documents it referenced. Click any title to open the original PDF in a new tab. Always verify critical steps against the original documentation before performing work — AI can misinterpret ambiguous text.</p>
              </div>

              <div className="faq-section">
                <div className="faq-section-title">Chat History</div>
                <p>Your conversation is automatically saved in your browser. Close the tab, refresh, or come back the next day — your chat picks up exactly where you left off. Press <strong>New chat</strong> in the header to clear history and start fresh. History is saved per device, not per account.</p>
              </div>
            </>}

            {/* ── ATG Direct Connect ── */}
            {section === 'direct' && <>
              <div className="faq-section">
                <div className="faq-section-title">What is ATG Direct Connect?</div>
                <p>ATG Direct Connect is a browser-based serial terminal built into the TLS page. It connects your laptop to a TLS console over RS-232 or Ethernet and lets you run Veeder-Root function codes, pull compliance reports, and save formatted PDFs — directly from Chrome or Edge without installing any software.</p>
                <p style={{ marginTop: 10 }}>Access it via the <strong>🔌 TLS</strong> button in the chat header or the Field Tools card on the chat screen.</p>
              </div>

              <div className="faq-section">
                <div className="faq-section-title">RS-232 Serial Connection</div>
                <p><strong>What you need:</strong> A USB-to-RS-232 adapter (available on Amazon for ~$10) and a cable from the adapter to the ATG&apos;s <strong>COMPUTER</strong> port (the 9-pin DB9 port on the front panel, labeled &quot;Computer&quot;).</p>
                <p style={{ marginTop: 10 }}><strong>Supported adapters:</strong> Silicon Labs CP210x (most common), FTDI FT232R, Prolific PL2303, CH340. If your adapter isn&apos;t detected, install the driver from the manufacturer&apos;s website — links are in the Console Connect desktop app setup wizard.</p>
                {step(1, 'Open the TLS page and click the RS-232 Serial tab.')}
                {step(2, <>Click <strong>Scan Ports</strong> to list detected COM ports. Your adapter will appear (e.g. <em>COM3 — Silicon Labs CP210x</em>).</>)}
                {step(3, 'Select your port and verify the baud rate matches the ATG — TLS-450PLUS and TLS-350 default to 9600 8-N-1.')}
                {step(4, <>Click <strong>Open Port</strong>. The status indicator turns cyan (<em>Connected</em>) when the port is open.</>)}
                {step(5, 'Use quick actions (Alarm History, Console Setup) or type any VR function code in the command box.')}
                {note('Requires Chrome or Edge on Windows or Mac. Safari and Firefox do not support the Web Serial API.')}
              </div>

              <div className="faq-section">
                <div className="faq-section-title">Quick Actions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  {[
                    { label: '🕐 1-Year Alarm History (I20600)', desc: 'Retrieves all alarm events from the past 12 months. Covers leak, overfill, sensor, delivery, and system alarms. Saves as a PDF ready for state environmental reporting.' },
                    { label: '⚙ Console Setup Report (I10100)', desc: 'Retrieves the full ATG configuration: tank dimensions, product assignment, probe types, manifold groupings, alarm setpoints, and leak test thresholds.' },
                    { label: '📊 System Status (I20500)', desc: 'Checks current active alarms, probe status, and system health in real time.' },
                    { label: '📦 Tank Inventory (I20100)', desc: 'Current product volume, ullage, water level, and temperature for all tanks.' },
                    { label: '🖨 Print Alarm History (P20600)', desc: 'Sends the alarm history print command directly to the ATG\'s built-in thermal printer.' },
                    { label: '🖨 Print Console Setup (P10100)', desc: 'Sends the setup report print command to the ATG thermal printer.' },
                  ].map(a => (
                    <div key={a.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 7, padding: '9px 12px' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0', marginBottom: 3 }}>{a.label}</div>
                      <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{a.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="faq-section">
                <div className="faq-section-title">AI Command Interpreter</div>
                <p>Type a plain-English request in the command box and press Enter. Atlas converts it to the correct VR function code and sends it automatically:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10, fontSize: 13 }}>
                  {['"show tank inventory"→I20100', '"delivery report for tank 2"→I20200', '"check active alarms"→I20500', '"system status"→I30100'].map(ex => {
                    const [q, r] = ex.split('→');
                    return (
                      <div key={q} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#94a3b8' }}>{q}</span>
                        <span style={{ color: '#334155' }}>→</span>
                        {code(r)}
                      </div>
                    );
                  })}
                </div>
                <p style={{ marginTop: 10, fontSize: 13 }}>You can also type raw VR codes directly (e.g. {code('I20600')}) — they&apos;re sent as-is without going through the AI interpreter. S-codes and P-codes are also recognized.</p>
              </div>

              <div className="faq-section">
                <div className="faq-section-title">Ethernet Connection</div>
                <p>Some TLS consoles have a built-in web interface accessible over your local network. Enter the ATG&apos;s IP address in the Ethernet tab and click <strong>Test Connection</strong> to verify reachability. Click <strong>Open Web Interface</strong> to launch it in a new tab.</p>
                {note('The ATG must be on the same local network as your laptop. Requires the ATG to have an optional Ethernet module installed.')}
              </div>

              <div className="faq-section">
                <div className="faq-section-title">Save PDF</div>
                <p>After any command output appears in the terminal, click <strong>Save PDF</strong> to export it as a properly formatted letter-size PDF. The file includes the site name, date, and page numbers — ready for submission to TCEQ, SWRCB, or other state environmental agencies.</p>
              </div>

              <div className="faq-section">
                <div className="faq-section-title">Offline Mode</div>
                <p>The TLS Direct Connect page caches itself after your first visit. Serial port commands, quick actions, and PDF saving all work without an internet connection. The AI command interpreter requires internet — an inline banner in the command box tells you when you&apos;re offline. Use raw VR codes offline.</p>
              </div>
            </>}

            {/* ── Desktop App ── */}
            {section === 'desktop' && <>
              <div className="faq-section">
                <div className="faq-section-title">FuelTech AI Console Connect — Overview</div>
                <p>Console Connect is a free Windows desktop application included with any FuelTech AI Pro subscription. It provides the same RS-232 serial connection as the browser-based Direct Connect page, plus additional features that require a native app: Remote Session, offline PDF saving, and more reliable port handling on older hardware.</p>
                <p style={{ marginTop: 10 }}>Download the installer from the landing page or your Account page (<strong>My Account → Download Console App</strong>). The current version is <strong>v1.0.44</strong>.</p>
              </div>

              <div className="faq-section">
                <div className="faq-section-title">Installation</div>
                {step(1, <>Download <strong>FuelTech AI Console Connect Setup 1.0.44.exe</strong> from your Account page or the main website.</>)}
                {step(2, 'Run the installer. Windows SmartScreen may warn you — click "More info" then "Run anyway." The app is signed but may not yet have enough install history to avoid the warning.')}
                {step(3, 'Click through the installer prompts. The app installs to your user profile — no admin rights required.')}
                {step(4, 'Launch the app from the Start Menu or Desktop shortcut.')}
              </div>

              <div className="faq-section">
                <div className="faq-section-title">License Activation</div>
                <p>On first launch you&apos;ll see the activation screen. Enter your license key (format: <strong>FTAI-XXXX-XXXX-XXXX</strong>) and click <strong>Activate</strong>. The app validates your key against the FuelTech server — requires internet for this one-time step only. After activation, the app works offline.</p>
                <p style={{ marginTop: 10 }}>Your license key is in your welcome email and always available on your <strong>Account page</strong> at fueltechaipro.com.</p>
                {note('One license key activates one machine. Contact support to transfer your activation to a new laptop.')}
              </div>

              <div className="faq-section">
                <div className="faq-section-title">First-Time Setup Wizard</div>
                <p>After activation, a short setup wizard guides you through installing your USB adapter driver and selecting the correct COM port. The wizard appears once on first launch — you can always skip it and configure settings manually on the Serial tab.</p>
                <div style={{ marginTop: 10, background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.2)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#22d3ee', marginBottom: 6 }}>Recommended USB drivers</div>
                  <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.8 }}>
                    <div><strong>Silicon Labs CP210x</strong> — most blue-chip adapters sold on Amazon</div>
                    <div><strong>FTDI FT232R</strong> — common in industrial-grade adapters</div>
                    <div><strong>Prolific PL2303</strong> — older cable-style adapters</div>
                    <div><strong>CH340/CH341</strong> — common in budget adapters</div>
                  </div>
                </div>
              </div>

              <div className="faq-section">
                <div className="faq-section-title">Connecting to the ATG</div>
                {step(1, 'On the Serial tab, click Scan Ports to detect available COM ports. The wizard runs this automatically — you can re-scan any time.')}
                {step(2, <>Select your USB adapter port from the list. Friendly names are shown (e.g. <em>COM4 — Silicon Labs CP210x USB to UART Bridge</em>).</>)}
                {step(3, 'Verify the baud rate matches the ATG. TLS-450PLUS and TLS-350 default to 9600. If you get no response, try 2400 or 19200.')}
                {step(4, <>Click <strong>Open Port</strong>. The status indicator in the top-right turns cyan (<em>Connected</em>).</>)}
                {step(5, 'Use quick actions or type a command. Output appears in the terminal below.')}
              </div>

              <div className="faq-section">
                <div className="faq-section-title">Demo Mode</div>
                <p>No ATG available? Enable <strong>Demo Mode</strong> in the connect section. The app returns realistic simulated ATG responses for all commands — useful for training, familiarizing yourself with the interface, or demonstrating the app to a customer. All quick actions, PDF saving, and AI analysis work in Demo Mode.</p>
              </div>

              <div className="faq-section">
                <div className="faq-section-title">AI Analysis (Console Setup)</div>
                <p>After pulling a <strong>Console Setup</strong> report, click the <strong>AI Analyze</strong> button. Atlas reads the raw ATG output and returns a structured plain-English summary: tanks, products, probes, sensor assignments, alarm configurations, and any potential issues it detects. Saves time on new-site commissioning and audit prep.</p>
              </div>
            </>}

            {/* ── Remote Monitor ── */}
            {section === 'remote' && <>
              <div className="faq-section">
                <div className="faq-section-title">What is Remote Monitor?</div>
                <p>Remote Monitor lets you watch a live ATG from your phone or tablet while the laptop stays physically connected to the ATG in the equipment room or behind a locked panel. Every 10 seconds, the laptop pushes the latest ATG data to the cloud. You view it — and send commands — from any browser on your phone.</p>
                <p style={{ marginTop: 10, fontSize: 13, color: '#64748b' }}>Practical example: The laptop is plugged into the ATG inside the wet bay. You walk outside to open a dispenser, pull a sensor, or check a sump. Your phone shows live ATG data and you can send a status check or inventory command without going back inside.</p>
              </div>

              <div className="faq-section">
                <div className="faq-section-title">Requirements</div>
                <ul style={{ marginTop: 8, paddingLeft: 18, lineHeight: 2.2, fontSize: 14 }}>
                  <li><strong>FuelTech AI Console Connect</strong> installed on a Windows laptop</li>
                  <li>Laptop connected to the ATG via RS-232 serial cable</li>
                  <li>Laptop connected to the internet (cell hotspot works fine)</li>
                  <li>Your FuelTech AI Pro account logged in on your phone</li>
                </ul>
              </div>

              <div className="faq-section">
                <div className="faq-section-title">Starting a Remote Session</div>
                {step(1, 'Open Console Connect on the laptop. Connect to the ATG via serial (see Desktop App → Connecting to the ATG).')}
                {step(2, <>Once connected, scroll down to the <strong>Remote Session</strong> card on the Serial tab. Click <strong>📡 Start Remote Session</strong>.</>)}
                {step(3, 'A cyan blinking dot appears in the card — confirming the laptop is pushing ATG data to the cloud every 10 seconds.')}
                {step(4, <>On your phone, log in to <strong>fueltechaipro.com</strong> and open the <strong>📡 Remote Monitor</strong> link (in the ··· chat menu).</>)}
                {step(5, 'The status badge turns cyan and shows Live within 10 seconds. ATG data and quick actions appear on your phone.')}
              </div>

              <div className="faq-section">
                <div className="faq-section-title">Sending Commands from Your Phone</div>
                <p>The Remote Monitor page has the same quick-action buttons as the desktop app: System Status, Tank Inventory, Alarm History. Tap one to queue the command. The laptop picks it up on its next 10-second cycle and the result appears on your phone.</p>
                <p style={{ marginTop: 10 }}>You can also type any VR function code directly in the command input on the Remote Monitor page — e.g. {code('I20600')} for alarm history or {code('I30100')} for system status.</p>
                {note('Commands sent while the session is temporarily offline (laptop lost internet) are queued and run as soon as the laptop reconnects.')}
              </div>

              <div className="faq-section">
                <div className="faq-section-title">Stopping the Session</div>
                <p>Click <strong>⏹ Stop Remote</strong> on the Remote Session card in Console Connect. The session is also automatically stopped if the serial port disconnects or the app is closed.</p>
              </div>
            </>}

            {/* ── Home Screen ── */}
            {section === 'homescreen' && <>
              <div className="faq-section">
                <div className="faq-section-title">Add to Home Screen — Skip the Login Every Time</div>
                <p>Install FuelTech AI Pro as a PWA (Progressive Web App) on your phone or tablet. Once installed, it opens straight to your session — no browser bar, no login screen, no typing the URL. It feels like a native app.</p>
              </div>

              <div className="faq-section">
                <div className="faq-section-title">📱 iPhone / iPad (Safari)</div>
                {step(1, 'Open fueltechaipro.com in Safari — must be Safari, not Chrome or Firefox on iOS.')}
                {step(2, 'Log in to your account.')}
                {step(3, <span>Tap the <strong>Share</strong> button — the box with an arrow pointing up, at the bottom of the screen on iPhone or top on iPad.</span>)}
                {step(4, 'Scroll down in the share sheet and tap Add to Home Screen.')}
                {step(5, 'Tap Add in the top-right corner.')}
                {step(6, 'The FuelTech AI Pro icon appears on your home screen. Tap it to open directly into the app, already logged in.')}
                {note('Your session stays active as long as you don\'t clear Safari data. You may need to log in again after a browser update.')}
              </div>

              <div className="faq-section">
                <div className="faq-section-title">🤖 Android (Chrome)</div>
                {step(1, 'Open fueltechaipro.com in Chrome.')}
                {step(2, 'Log in to your account.')}
                {step(3, 'Tap the three-dot menu ⋮ in the top-right corner.')}
                {step(4, 'Tap Add to Home screen (or Install App if Chrome shows a banner).')}
                {step(5, 'Tap Add to confirm.')}
                {step(6, 'The icon appears on your home screen. Tap it to open directly into the app.')}
                {note('On some Android devices the option is labeled "Install App" instead of "Add to Home screen." Both do the same thing.')}
              </div>
            </>}

            {/* ── Tips ── */}
            {section === 'tips' && <>
              <div className="faq-section">
                <div className="faq-section-title">Getting the Best Results from Atlas</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                  {[
                    { icon: '🎯', tip: 'Always select your equipment model first', detail: 'The TLS-450PLUS and TLS-350 have different alarm codes, menu paths, and programming procedures. Selecting the model before asking makes answers dramatically more specific and accurate.' },
                    { icon: '🔢', tip: 'Include the exact error code', detail: 'When asking about a fault, include the full code — e.g. "Error 0A02 on TLS-450PLUS." Atlas maps directly to the Veeder-Root alarm table and returns the exact cause and corrective action.' },
                    { icon: '📍', tip: 'Describe the location and symptom', detail: '"Dispenser 3 side B not shutting off" gives Atlas enough context to distinguish a solenoid issue from a flow meter issue from a programming problem. More detail = better answer.' },
                    { icon: '🔧', tip: 'Use Guided Mode for multi-step procedures', detail: 'Probe replacements, startup checkouts, and sensor calibrations involve many steps. Use Guided Mode so you get one step at a time and can\'t miss anything under time pressure.' },
                    { icon: '📷', tip: 'Attach a photo when you\'re unsure what you\'re looking at', detail: 'If you see an unfamiliar display, warning light, or label, snap a photo and ask Atlas to identify it. It can read ATG screens, dispenser displays, and sensor labels.' },
                    { icon: '✅', tip: 'Always verify critical steps against the original documentation', detail: 'Atlas cites every source. Before performing work on live fuel equipment, click through to the original VR or Gilbarco PDF and confirm the procedure. AI can misinterpret ambiguous text.' },
                    { icon: '⚡', tip: 'Use raw VR codes for fastest ATG access', detail: 'If you know the function code, type it directly — I20100, I10100, S201, etc. Raw codes bypass the AI interpreter and execute immediately. Essential for offline work.' },
                    { icon: '🌐', tip: 'Cache the Direct Connect page for offline use', detail: 'Visit the TLS Direct Connect page at least once with an internet connection to cache it. After that, serial commands and PDF saving work with no connection — crucial at sites without Wi-Fi.' },
                  ].map(t => (
                    <div key={t.tip} style={{ display: 'flex', gap: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{t.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 13, marginBottom: 4 }}>{t.tip}</div>
                        <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>{t.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="faq-section">
                <div className="faq-section-title">Common Questions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  {[
                    { q: 'The ATG isn\'t responding to serial commands', a: 'Check baud rate (TLS-450PLUS default: 9600), cable connection to the COMPUTER port (not the printer port), and that the adapter driver is installed. Try Demo Mode to confirm the app itself is working.' },
                    { q: 'My USB adapter isn\'t showing up in the port list', a: 'Install or reinstall the driver for your specific adapter chip. In Console Connect, use the driver links in the setup wizard. Unplug and replug the adapter after installing.' },
                    { q: 'Atlas gave me a wrong procedure', a: 'Click the source links in the response and read the original document. If the procedure doesn\'t match, start a New Chat with the equipment model selected and rephrase your question with more specific details.' },
                    { q: 'The Remote Monitor shows "No session" on my phone', a: 'Confirm the laptop has an active serial connection and that "Start Remote Session" was clicked. The laptop must have internet access (cell hotspot works). Allow up to 30 seconds for the first data push.' },
                    { q: 'I lost my license key', a: 'Log in to fueltechaipro.com, open the ··· menu, and go to My Account. Your Console App License Key is always displayed there.' },
                  ].map(faq => (
                    <div key={faq.q} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                      <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 13, marginBottom: 5 }}>Q: {faq.q}</div>
                      <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>A: {faq.a}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>}

            {/* ── Video Tutorials ── */}
            {section === 'videos' && <>
              <div className="faq-section">
                <div className="faq-section-title">Video Tutorials</div>
                <p style={{ color: '#64748b', fontSize: 13 }}>Step-by-step walkthrough videos for the most common tasks. New tutorials are added regularly.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                {[
                  { title: 'Getting Started — First Login & Chat', desc: 'Setting up your account, selecting equipment, and asking your first question.', available: false },
                  { title: 'RS-232 Serial Connection to TLS-450PLUS', desc: 'Adapter selection, driver install, port settings, and pulling your first alarm history report.', available: false },
                  { title: 'Console Connect Desktop App Setup', desc: 'Download, install, activate, and connect to a TLS console in under 5 minutes.', available: false },
                  { title: 'Remote Monitor — Watch a Live ATG from Your Phone', desc: 'Start a remote session on the laptop and access live ATG data from anywhere on your phone.', available: false },
                  { title: 'Pulling & Saving a Compliance Report', desc: 'Alarm history export, console setup report, and saving a properly formatted PDF for your records.', available: false },
                  { title: 'Guided Mode — Step-by-Step Procedure Walkthrough', desc: 'Using Guided Mode to complete a probe replacement without losing your place.', available: false },
                  { title: 'Photo Diagnosis — Identifying Faults from a Photo', desc: 'Taking a photo of an ATG display and having Atlas identify the error and fix steps.', available: false },
                  { title: 'Add to Home Screen on iPhone & Android', desc: 'Install FuelTech AI Pro as a PWA for instant one-tap access from your phone.', available: false },
                ].map(v => (
                  <div key={v.title} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', aspectRatio: '16/5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>▶</div>
                      <div style={{ fontSize: 11, color: '#334155' }}>Coming soon</div>
                    </div>
                    <div style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 13 }}>{v.title}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 1.5 }}>{v.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>}

          </div>
        </div>
      </div>
    </div>
  );
}

interface SourceDoc {
  url: string;
  title: string;
  source: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: string[];
  docs?: SourceDoc[];
  figures?: string[];
  streaming?: boolean;
  imagePreview?: string; // data URL shown in the bubble
}

interface PendingImage {
  base64: string;
  mediaType: string;
  preview: string; // data URL for display
}

function compressImage(file: File): Promise<PendingImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 1120;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve({ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg', preview: dataUrl });
    };
    img.onerror = (e) => { URL.revokeObjectURL(objectUrl); reject(e); };
    img.src = objectUrl;
  });
}

const HISTORY_KEY = 'ft_chat_history';
const GUIDED_KEY  = 'ft_guided_mode';
const LANG_KEY    = 'ft_lang';
const MAX_STORED  = 60;


function loadHistory(): Message[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Message[];
    // Strip any stale streaming flags
    return parsed.map((m) => ({ ...m, streaming: false }));
  } catch {
    return [];
  }
}

function saveHistory(msgs: Message[]) {
  if (typeof window === 'undefined') return;
  try {
    const toSave = msgs
      .filter((m) => !m.streaming)
      .slice(-MAX_STORED)
      .map((m) => ({ role: m.role, content: m.content, docs: m.docs, figures: m.figures }));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(toSave));
  } catch { /* storage full — skip */ }
}

const EQUIPMENT_MODELS = [
  'Encore 700', 'Encore 500', 'Eclipse', 'CRIND', 'FlexPay IV',
  'TLS-450PLUS', 'TLS-450', 'TLS-350', 'TLS-300', 'Red Jacket', 'FE Petro',
];

const SUGGESTED_PROMPTS: { label: string; build: (model: string) => string; partial?: boolean }[] = [
  {
    label: 'Error code lookup',
    build: (m) => m ? `What does error code  mean on the ${m}?` : '',
    partial: true,
  },
  {
    label: 'Startup procedure',
    build: (m) => m ? `Walk me through the complete startup procedure for the ${m}` : 'Walk me through the complete startup procedure for ',
  },
  {
    label: 'Clear an alarm',
    build: (m) => m ? `How do I clear active alarms on the ${m}?` : 'How do I clear active alarms on ',
  },
  {
    label: 'Programming mode',
    build: (m) => m ? `How do I access programming mode on the ${m}?` : 'How do I access programming mode on ',
  },
  {
    label: 'Wiring & install',
    build: (m) => m ? `What are the wiring and installation requirements for the ${m}?` : 'What are the wiring and installation requirements for ',
  },
  {
    label: 'Communication setup',
    build: (m) => m ? `How do I configure communications on the ${m}?` : 'How do I configure communications on ',
  },
  {
    label: 'EMV upgrade',
    build: (m) => m ? `What are the EMV upgrade steps and requirements for the ${m}?` : 'What are the EMV upgrade steps for ',
  },
  {
    label: 'Probe / sensor install',
    build: (m) => m ? `How do I install and configure a probe or sensor on the ${m}?` : 'How do I install a probe on ',
  },
];

export default function ChatPage() {
  const [messages, setMessages]       = useState<Message[]>([]);
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [modelPrompt, setModelPrompt] = useState(false);
  const [guidedMode, setGuidedMode]   = useState(false);
  const [showFaq, setShowFaq]         = useState(false);
  const [hydrated, setHydrated]       = useState(false);
  const [username, setUsername]       = useState('');
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [lang, setLang] = useState<'en' | 'es'>('en');
  const [showMore, setShowMore] = useState(false);
  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const inputRef        = useRef<HTMLInputElement>(null);
  const modelSectionRef = useRef<HTMLDivElement>(null);
  const imageInputRef   = useRef<HTMLInputElement>(null);

  // Hydrate from localStorage after first render
  useEffect(() => {
    const saved = loadHistory();
    if (saved.length > 0) setMessages(saved);
    const savedGuided = localStorage.getItem(GUIDED_KEY);
    if (savedGuided === 'true') setGuidedMode(true);
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.username) {
          setUsername(d.username);
        } else if (d.expired) {
          window.location.href = '/expired';
        } else {
          window.location.href = '/login';
        }
      })
      .catch(() => { window.location.href = '/login'; });
    const savedTheme = localStorage.getItem('ft_theme') as 'dark' | 'light' | null;
    if (savedTheme) setTheme(savedTheme);
    const savedLang = localStorage.getItem(LANG_KEY) as 'en' | 'es' | null;
    if (savedLang) setLang(savedLang);
    setHydrated(true);
  }, []);

  // Persist messages whenever they change (after hydration)
  useEffect(() => {
    if (!hydrated) return;
    saveHistory(messages);
  }, [messages, hydrated]);

  // Persist guided mode preference
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(GUIDED_KEY, String(guidedMode));
  }, [guidedMode, hydrated]);

  // Persist language preference
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(LANG_KEY, lang);
  }, [lang, hydrated]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (question: string) => {
    if ((!question.trim() && !pendingImage) || loading) return;
    const history = messages.map(({ role, content }) => ({ role, content }));
    const image = pendingImage;

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: question, imagePreview: image?.preview },
      { role: 'assistant', content: '', streaming: true },
    ]);
    setInput('');
    setPendingImage(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question || 'Please analyze this image.',
          history,
          guidedMode,
          lang,
          ...(image ? { imageBase64: image.base64, imageMediaType: image.mediaType } : {}),
        }),
      });

      if (res.status === 401) { window.location.href = '/login'; return; }
      if (res.status === 403) { window.location.href = '/expired'; return; }
      if (!res.ok || !res.body) throw new Error('Request failed');

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let payload: any;
          try { payload = JSON.parse(line.slice(6)); } catch { continue; }

          if (payload.type === 'sources') {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === 'assistant') next[next.length - 1] = { ...last, citations: payload.urls, docs: payload.docs ?? [] };
              return next;
            });
          } else if (payload.type === 'figures') {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === 'assistant') next[next.length - 1] = { ...last, figures: payload.urls };
              return next;
            });
          } else if (payload.type === 'text') {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === 'assistant') next[next.length - 1] = { ...last, content: last.content + payload.text };
              return next;
            });
          } else if (payload.type === 'done') {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === 'assistant') next[next.length - 1] = { ...last, streaming: false };
              return next;
            });
          } else if (payload.type === 'error') {
            throw new Error(payload.message);
          }
        }
      }
    } catch (err) {
      const errorText = err instanceof Error ? err.message : 'Error fetching response';
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant') {
          next[next.length - 1] = { role: 'assistant', content: errorText, streaming: false };
        } else {
          next.push({ role: 'assistant', content: errorText });
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (input.trim() || pendingImage) sendMessage(input.trim());
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setPendingImage(compressed);
    } catch {
      // ignore — file picker stays closed
    }
  };

  const handleChip = (prompt: { label: string; build: (m: string) => string; partial?: boolean }) => {
    if (!selectedModel) {
      setModelPrompt(true);
      modelSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setTimeout(() => setModelPrompt(false), 2500);
      return;
    }
    const text = prompt.build(selectedModel);
    if (prompt.partial) {
      setInput(text);
      inputRef.current?.focus();
      setTimeout(() => {
        if (inputRef.current) {
          const pos = text.indexOf('  mean') + 1;
          inputRef.current.setSelectionRange(pos, pos);
        }
      }, 0);
    } else {
      sendMessage(text);
    }
  };

  const handleModelSelect = (model: string) => {
    setSelectedModel((prev) => (prev === model ? '' : model));
    setModelPrompt(false);
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('ft_theme', next);
    document.documentElement.setAttribute('data-theme', next === 'light' ? 'light' : '');
  };

  const clearChat = () => {
    setMessages([]);
    setInput('');
    setSelectedModel('');
    localStorage.removeItem(HISTORY_KEY);
  };

  const lastMsg = messages[messages.length - 1];
  const showNextStep = guidedMode && !loading && lastMsg?.role === 'assistant' && !lastMsg.streaming;

  return (
    <div className="chat-wrapper">
      {showFaq && <FaqModal onClose={() => setShowFaq(false)} />}
      <header className="chat-header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="FuelTech AI Pro" className="chat-header-logo" />
        <div>
          <h1>FuelTech AI Pro</h1>
          <p>Your fueling systems assistant</p>
        </div>

        <div className="chat-header-actions">
          {/* Primary actions — always visible */}
          <button
            type="button"
            onClick={() => setGuidedMode((v) => !v)}
            className={`guided-mode-btn${guidedMode ? ' active' : ''}`}
            title={guidedMode ? 'Guided mode on — click to turn off' : 'Turn on step-by-step guided mode'}
          >
            <Footprints size={14} />
            <span className="guided-label">Guided</span>
            {guidedMode && <span className="guided-mode-dot" />}
          </button>
          <Link
            href="/tls"
            className="chat-tls-btn"
            title="ATG Direct Connect — pull alarm history and console setup via RS-232"
          >
            🔌 TLS
          </Link>
          <button type="button" onClick={clearChat} className="new-chat-btn" title="Start a new conversation">
            New chat
          </button>
          <button
            type="button"
            className="logout-btn"
            title="Sign out"
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/login';
            }}
          >
            Sign out
          </button>

          {/* Overflow menu — secondary actions */}
          <div className="chat-more-wrap">
            <button
              type="button"
              className="chat-more-btn"
              title="More options"
              onClick={() => setShowMore((v) => !v)}
            >
              ···
            </button>
            {showMore && (
              <div className="chat-more-menu" onClick={() => setShowMore(false)}>
                <button
                  type="button"
                  className="chat-theme-btn chat-more-item"
                  onClick={toggleTheme}
                >
                  {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                  {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </button>
                <button
                  type="button"
                  className={`guided-mode-btn chat-more-item${lang === 'es' ? ' active' : ''}`}
                  onClick={() => setLang((l) => (l === 'en' ? 'es' : 'en'))}
                >
                  <span>{lang === 'en' ? 'EN' : 'ES'}</span>
                  {lang === 'en' ? ' → Español' : ' → English'}
                </button>
                <Link href="/account" className="chat-more-item chat-more-link">
                  🔑 My Account &amp; License
                </Link>
                <Link href="/remote" className="chat-more-item chat-more-link">
                  📡 Remote Monitor
                </Link>
                <Link href="/updates" className="chat-more-item chat-more-link">
                  📋 What&apos;s New
                </Link>
                <Link href="/suggestions" className="chat-more-item chat-more-link">
                  💡 Suggest a feature
                </Link>
                <button
                  type="button"
                  className="chat-more-item"
                  onClick={() => setShowFaq(true)}
                >
                  ? Help &amp; FAQ
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="chat-body">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <div className="chat-welcome-title">What do you need help with?</div>

            <div ref={modelSectionRef}>
              <div className={`chat-model-label${modelPrompt ? ' chat-model-label-warn' : ''}`}>
                {modelPrompt ? '⚠ Select your equipment first' : 'Select equipment'}
              </div>
              <div className={`chat-model-chips${modelPrompt ? ' chat-model-chips-warn' : ''}`}>
                {EQUIPMENT_MODELS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`chat-model-chip${selectedModel === m ? ' active' : ''}`}
                    onClick={() => handleModelSelect(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="chat-prompt-label" style={{ marginTop: 20 }}>
              Quick questions {!selectedModel && <span className="chat-prompt-hint">(select equipment above for best results)</span>}
            </div>
            <div className="chat-prompt-chips">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className={`chat-prompt-chip${p.partial ? ' chat-prompt-chip-partial' : ''}`}
                  onClick={() => handleChip(p)}
                >
                  {p.label}
                  {p.partial && <span className="chat-prompt-chip-tag">type code</span>}
                </button>
              ))}
            </div>

            <div className="chat-prompt-label" style={{ marginTop: 28 }}>
              Field Tools
            </div>
            <div className="chat-pwa-tip">
              <span>📲</span>
              <span>Add to your home screen for instant access — no login every time. Tap <strong>Share → Add to Home Screen</strong> on iPhone or <strong>⋮ → Add to Home screen</strong> on Android. <button type="button" onClick={() => setShowFaq(true)} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', padding: 0, fontSize: 'inherit', textDecoration: 'underline' }}>More info →</button></span>
            </div>

            <div className="chat-field-tools">
              <Link href="/tls" className="chat-field-tool-card">
                <div className="chat-field-tool-icon">🔌</div>
                <div>
                  <div className="chat-field-tool-name">ATG Direct Connect</div>
                  <div className="chat-field-tool-desc">
                    RS-232 serial connection — pull alarm history and console setup for environmental reporting. Supports TLS-450PLUS, TLS-350 &amp; TLS-350R.
                  </div>
                </div>
                <span className="chat-field-tool-arrow">→</span>
              </Link>
              <a
                href="/api/download"
                className="chat-field-tool-card"
              >
                <div className="chat-field-tool-icon">🖥️</div>
                <div>
                  <div className="chat-field-tool-name">FuelTech AI Console Connect</div>
                  <div className="chat-field-tool-desc">
                    Windows desktop app — direct RS-232 serial access, alarm history, console setup &amp; PDF export
                  </div>
                </div>
                <span className="chat-field-tool-arrow">↓</span>
              </a>
            </div>
          </div>
        )}

        {messages.length > 0 && (
          <div className="chat-messages">
            {messages.map((msg, idx) => (
              <ChatBubble key={idx} message={msg} figures={msg.figures} username={username} />
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      <footer className="chat-footer">
        {guidedMode && (
          <div className="guided-mode-banner">
            <Footprints size={13} />
            <span>Guided mode — the assistant will walk you through one step at a time</span>
          </div>
        )}
        {selectedModel && (
          <div className="chat-active-model">
            <span>Model: <strong>{selectedModel}</strong></span>
            <button type="button" onClick={() => setSelectedModel('')} className="chat-active-model-clear">✕</button>
          </div>
        )}
        {showNextStep && (
          <button
            type="button"
            className="next-step-btn"
            onClick={() => sendMessage("Ready, continue to the next step.")}
          >
            Next step →
          </button>
        )}
        {pendingImage && (
          <div className="chat-image-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pendingImage.preview} alt="Attached" />
            <button type="button" className="chat-image-preview-remove" onClick={() => { setPendingImage(null); if (imageInputRef.current) imageInputRef.current.value = ''; }}>✕</button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="chat-input-container">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleImageSelect}
          />
          <button
            type="button"
            className={`chat-camera-btn${pendingImage ? ' has-image' : ''}`}
            onClick={() => imageInputRef.current?.click()}
            title="Attach a photo"
          >
            <Camera size={18} />
          </button>
          <input
            ref={inputRef}
            type="text"
            placeholder={pendingImage ? 'Describe the issue or tap Send to analyze…' : guidedMode ? 'Describe what you see or type a question…' : selectedModel ? `Ask about ${selectedModel}…` : 'Ask a question or pick one above…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button type="submit" disabled={loading || (!input.trim() && !pendingImage)}>
            {loading ? '…' : 'Send'}
          </button>
        </form>
        <p className="chat-disclaimer">
          AI responses are for reference only. Always verify procedures against official manufacturer documentation before performing any work. Not a substitute for professional judgment or certified technician guidance.
        </p>
      </footer>
    </div>
  );
}
