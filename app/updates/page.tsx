import Link from 'next/link';

interface Update {
  date: string;
  title: string;
  items: { type: 'new' | 'improvement' | 'fix'; text: string }[];
}

const UPDATES: Update[] = [
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
