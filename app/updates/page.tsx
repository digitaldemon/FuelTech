import Link from 'next/link';

interface Update {
  date: string;
  title: string;
  items: { type: 'new' | 'improvement' | 'fix'; text: string }[];
}

const UPDATES: Update[] = [
  {
    date: 'June 2026',
    title: 'Remote Monitor, ATG Direct Connect Expansion & Print to ATG Printer',
    items: [
      { type: 'new', text: 'Remote Monitor — leave the laptop connected to the ATG and watch live data from your phone. Open the 📡 Remote Monitor link in the chat menu, start a session in Console Connect on the laptop, and commands you send from your phone run on the laptop and appear on screen within ~10 seconds.' },
      { type: 'improvement', text: 'ATG Direct Connect now supports TLS-350 and TLS-350R in addition to TLS-450PLUS — same RS-232 serial and Ethernet workflow for all three consoles. The page header and docs have been updated to reflect this.' },
      { type: 'new', text: 'Print to ATG Printer — two new buttons send P-code commands directly to the ATG\'s built-in thermal printer: Print Alarm History (P20600, 1-year date range) and Print Console Setup Report (P10100).' },
      { type: 'improvement', text: 'Command input on the ATG Direct Connect page now recognizes S-codes (SET commands) and P-codes (print commands) as raw VR codes, so they are sent directly to the ATG instead of being routed through the AI interpreter.' },
    ],
  },
  {
    date: 'June 2026',
    title: 'Console Connect Desktop App, Atlas AI & Account Portal',
    items: [
      { type: 'new', text: 'FuelTech AI Console Connect — free Windows desktop app included with any subscription. Connects directly to a TLS console via RS-232 serial (USB adapter), pulls alarm history and console setup, and saves compliance-ready PDFs. Download from the landing page or your Account page.' },
      { type: 'new', text: 'Atlas — the AI assistant inside FuelTech AI Pro now has a name. Atlas appears in the chat interface alongside every response.' },
      { type: 'new', text: 'Account page — sign in and visit My Account (··· menu) to see your subscription expiry and copy your Console App License Key at any time.' },
      { type: 'new', text: 'Console license keys are now automatically generated and included in the welcome email when you subscribe. Enter the key on first launch of the Console Connect app to activate it on your machine.' },
      { type: 'improvement', text: 'Step-by-step troubleshooting restructured: every guided response now follows a Root Cause → Diagnostics (pass/fail branching) → Fix → Verify → Escalate format for clearer field use.' },
      { type: 'improvement', text: 'Chat header decluttered — secondary options (theme, language, What\'s New, Suggest, FAQ, Account) moved into a ··· overflow menu so primary actions are always visible.' },
      { type: 'new', text: 'Add to Home Screen — install FuelTech AI Pro as a PWA on iPhone or Android and open straight to your session without logging in each time. Setup instructions in the Help & FAQ.' },
    ],
  },
  {
    date: 'June 2026',
    title: 'AI Alarm Diagnosis & Auto-Fix',
    items: [
      { type: 'new', text: 'AI Diagnose now includes a Fix Steps section — for each active alarm Atlas provides the specific corrective action the TLS "Action" button recommends, plus the exact ATG SET command to apply the fix where possible (e.g. S80200 03 PROBETYPE ISPI for probe type mismatches). Physical repairs are described step by step when hardware work is required.' },
      { type: 'new', text: 'Fix command chips now appear alongside diagnostic chips in amber — one click sends the SET command directly to the ATG to apply the configuration correction without typing.' },
      { type: 'improvement', text: 'AI analysis prompt updated to include all ATG commands — both query (I-code) and SET (S-code) commands are rendered as clickable "Send to ATG" buttons so technicians can act on findings immediately.' },
    ],
  },
  {
    date: 'June 2026',
    title: 'ATG Direct Connect & Serial Dashboard',
    items: [
      { type: 'new', text: 'RS-232 serial connection to TLS-450PLUS directly from the browser — no software install required. Supports Chrome and Edge on Windows and Mac.' },
      { type: 'new', text: 'Ethernet tab to open the TLS-450PLUS built-in web interface at a custom IP address, with one-click connectivity test.' },
      { type: 'new', text: 'Auto COM port detection — previously authorized adapters are listed on page load with friendly chip names (Prolific PL2303, FTDI FT232R, Silicon Labs CP210x, CH340, and more). Scan button refreshes the list if you plug in a new adapter.' },
      { type: 'new', text: 'Configurable serial parameters — Baud Rate, Data Bits, Parity, and Stop Bits are all individually selectable. TLS-450PLUS defaults (9600 8-N-1) are pre-set.' },
      { type: 'new', text: 'One-year alarm history quick action — pulls exactly 12 months of alarm events directly from the ATG with a single click. Covers leak, overfill, sensor, delivery, and system alarms.' },
      { type: 'new', text: 'Console setup quick action — retrieves the full ATG configuration: tank dimensions, product assignment, probe types, alarm setpoints, and leak test thresholds.' },
      { type: 'new', text: 'Save PDF — exports the terminal output as a properly formatted letter-size PDF with headers, page numbers, and generated timestamp. Ready for TCEQ and state environmental compliance documentation.' },
      { type: 'new', text: 'AI command prompt — type a plain-English request ("show tank inventory", "delivery report for tank 2") and the assistant converts it to the correct Veeder-Root function code and sends it to the ATG automatically. Raw VR codes (e.g. I20100) are sent directly.' },
      { type: 'new', text: 'Offline mode — the serial dashboard caches itself and works without an internet connection. Serial commands, quick actions, and PDF saving all function offline. AI interpretation requires internet; an inline banner tells the tech exactly what is and isn\'t available.' },
    ],
  },
  {
    date: 'June 2026',
    title: 'App Improvements',
    items: [
      { type: 'new', text: 'Dark / Light mode toggle in the chat header. Theme preference is saved and restored between sessions with no flash on page load.' },
      { type: 'fix', text: 'Fixed "thinkin g …" display bug — the thinking indicator now uses an animated dot animation instead of text that was breaking across the word boundary.' },
      { type: 'improvement', text: 'Landing page updated to include ATG Direct Connect in the feature list, hero check marks, and pricing.' },
      { type: 'improvement', text: 'User Guide (? button) expanded with a full ATG Direct Connect section covering RS-232, Ethernet, offline use, and raw VR codes.' },
    ],
  },
];

const BADGE: Record<'new' | 'improvement' | 'fix', { label: string; cls: string }> = {
  new:         { label: 'New',         cls: 'upd-badge-new' },
  improvement: { label: 'Improvement', cls: 'upd-badge-impr' },
  fix:         { label: 'Fix',         cls: 'upd-badge-fix' },
};

export default function UpdatesPage() {
  return (
    <div className="upd-page">
      <header className="upd-header">
        <Link href="/chat" className="upd-back">← Back to app</Link>
        <div className="upd-header-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" className="upd-logo" />
          <div>
            <div className="upd-title">Platform Updates</div>
            <div className="upd-sub">FuelTech AI Pro — release notes &amp; feature announcements</div>
          </div>
        </div>
      </header>

      <div className="upd-body">
        {UPDATES.map((u, ui) => (
          <div key={ui} className="upd-card">
            <div className="upd-card-date">{u.date}</div>
            <div className="upd-card-title">{u.title}</div>
            <ul className="upd-list">
              {u.items.map((item, ii) => {
                const badge = BADGE[item.type];
                return (
                  <li key={ii} className="upd-item">
                    <span className={`upd-badge ${badge.cls}`}>{badge.label}</span>
                    <span className="upd-item-text">{item.text}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
