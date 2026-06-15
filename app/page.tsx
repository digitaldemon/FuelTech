"use client";

import { Gauge, ShieldCheck, FileText, MessageSquare, ArrowRight, Zap, Menu, BookOpen, Image, ClipboardList, Cable } from 'lucide-react';
import { useState } from 'react';
import ReviewsSection from './components/ReviewsSection';

const ANNUAL_PRICE = 99;
const MONTHLY_PRICE = 14.99;

type EnterpriseStatus = 'idle' | 'form' | 'loading' | 'done' | 'error';

const features = [
  {
    icon: <MessageSquare size={22} />,
    title: 'Alarm & Error Code Diagnosis',
    text: 'Describe an alarm or error condition and the AI interprets it in context — explaining the cause and walking you through the correct resolution the way an experienced tech would.',
  },
  {
    icon: <Image size={22} />,
    title: 'Diagrams & Schematics On Demand',
    text: 'Ask about any diagram — wiring, installation, component layout, flow, or schematic — and the AI identifies the right figure from the manufacturer documentation and displays it directly alongside the explanation.',
  },
  {
    icon: <Gauge size={22} />,
    title: 'Step-by-Step Troubleshooting',
    text: 'Walk through a problem in conversation. The AI asks the right follow-up questions, narrows down the root cause, and gives you a structured path to resolution — without leaving the job site.',
  },
  {
    icon: <ShieldCheck size={22} />,
    title: 'Startup & Programming Guidance',
    text: 'Get step-by-step ATG startup procedures, probe configuration, tank setup, and programming sequences for Veeder-Root, Gilbarco, Red Jacket, and Franklin Fueling equipment — pulled from the correct manual for your model.',
  },
  {
    icon: <BookOpen size={22} />,
    title: 'Expert Answers with Source Citations',
    text: 'The AI reasons through your question using deep manufacturer knowledge — then cites the exact manual and page it drew from, so you can verify and trust every answer.',
  },
  {
    icon: <FileText size={22} />,
    title: 'Cross-Brand ATG & Dispenser Knowledge',
    text: 'Trained across Veeder-Root TLS consoles, Gilbarco dispensers, Wayne/Tokheim/Dover dispensers, Red Jacket and FE Petro submersible systems, and Franklin Fueling equipment — the AI reasons across equipment families, not just one brand at a time.',
  },
  {
    icon: <ClipboardList size={22} />,
    title: 'Field Testing & Compliance Protocols',
    text: 'Get step-by-step guidance on line leak detection testing, precision line testing, tank tightness tests, and field tester operation — including test frequency requirements, pass/fail criteria, and manufacturer-specified compliance procedures.',
  },
  {
    icon: <Cable size={22} />,
    title: 'ATG Direct Connect & Serial Dashboard',
    text: 'Connect directly to a TLS-350 or TLS-450 console from your browser via RS-232 serial — no additional software required. Pull current active alarms, a full year of alarm history, and the complete console setup report with one click, then save them as a PDF for environmental compliance documentation.',
  },
];

const brands = [
  {
    name: 'Veeder-Root',
    items: ['TLS-450PLUS', 'TLS-450i / 450iS', 'TLS-350 / 350R', 'TLS-300', 'Mag Plus Probes', 'Leak Detection Sensors'],
  },
  {
    name: 'Gilbarco',
    items: ['Encore 700 / 700S', 'Eclipse Dispenser', 'CRIND', 'FlexPay IV', 'Passport POS', 'Tech Bulletins'],
  },
  {
    name: 'Wayne · Red Jacket · Franklin',
    items: ['Wayne / Tokheim / Dover Dispensers', 'Red Jacket Submersible Pumps', 'FE Petro Products', 'Franklin Fueling Systems', 'Industry Service Manuals'],
  },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [enterpriseStatus, setEnterpriseStatus] = useState<EnterpriseStatus>('idle');
  const [enterpriseEmail, setEnterpriseEmail] = useState('');
  const [enterpriseCompany, setEnterpriseCompany] = useState('');
  const [enterpriseError, setEnterpriseError] = useState('');

  const handleEnterpriseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnterpriseStatus('loading');
    setEnterpriseError('');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: enterpriseEmail, company: enterpriseCompany }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong.');
      setEnterpriseStatus('done');
    } catch (err) {
      setEnterpriseError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setEnterpriseStatus('error');
    }
  };

  return (
    <main>
      <header className="header">
        <div className="container nav">
          <div className="brand">
            <div className="logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-192.png" alt="FuelTech AI Pro" className="brand-logo-img" />
            </div>
            <div>
              <div className="brand-title">FuelTech AI Pro</div>
              <div className="brand-sub">AI for fueling technicians</div>
            </div>
          </div>
          <nav className="navlinks">
            <a href="/demo">Demo</a>
            <a href="#features">Features</a>
            <a href="#library">Documentation</a>
            <a href="#reviews">Reviews</a>
            <a href="#pricing">Pricing</a>
            <a href="/login">Login</a>
          </nav>
          <a className="button join-button" href="#pricing">
            Get Access
          </a>
          <button
            className="mobile-toggle"
            aria-label="Toggle navigation menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Menu size={28} />
          </button>
        </div>
        <nav className={`mobile-menu${menuOpen ? ' open' : ''}`}>
          <a href="/demo" onClick={() => setMenuOpen(false)}>Demo</a>
          <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
          <a href="#library" onClick={() => setMenuOpen(false)}>Documentation</a>
          <a href="#reviews" onClick={() => setMenuOpen(false)}>Reviews</a>
          <a href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</a>
          <a href="/login" onClick={() => setMenuOpen(false)}>Login</a>
          <a className="button" href="#pricing" onClick={() => setMenuOpen(false)}>Get Access</a>
        </nav>
      </header>

      {/* Hero */}
      <section className="hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className="hero-bg-logo" aria-hidden="true" />
        <div className="container">
          <div className="lp-hero-brandmark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-192.png" alt="FuelTech AI Pro" className="lp-hero-brandmark-img" />
          </div>
        </div>
        <div className="container hero-grid">
          <div>
            <span className="badge">Built for the gasoline station industry</span>
            <h1 className="h1">Stop searching. Start fixing.</h1>
            <p className="lead">
              FuelTech AI Pro turns the average technician into a super tech. Every alarm code, wiring diagram, startup procedure, and compliance protocol — answered in plain English, right from the job site. No hold queues. No guesswork.
            </p>
            <p className="lead" style={{ marginTop: '0.75em', fontSize: '0.95em' }}>
              And you&rsquo;re not just getting answers — you&rsquo;re getting the hands-on training that no classroom can replicate. Every response explains the why, walks you through the reasoning, and builds the kind of deep equipment knowledge that takes years to develop on your own.
            </p>
            <div className="cta-row">
              <a href="#pricing" className="button">
                Get Access — from ${MONTHLY_PRICE}/mo <ArrowRight size={24} />
              </a>
              <a href="#features" className="button secondary">
                See Features
              </a>
            </div>
            <div className="checks">
              <span>✓ Error code lookup</span>
              <span>✓ Diagrams &amp; schematics</span>
              <span>✓ Step-by-step troubleshooting</span>
              <span>✓ Startup &amp; programming</span>
              <span>✓ Testing &amp; compliance protocols</span>
              <span>✓ ATG direct connect (RS-232 &amp; Ethernet)</span>
              <span>✓ Source citations</span>
              <span>✓ Works on any device</span>
            </div>
          </div>

          {/* Chat preview */}
          <div className="card chat">
            <div className="chat-inner">
              <div className="chat-head">
                <div className="logo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icon-192.png" alt="FuelTech AI Pro" className="brand-logo-img" />
                </div>
                <div>
                  <strong>FuelTech AI Pro</strong>
                  <div className="brand-sub">● Online &nbsp;·&nbsp; ATG &amp; Fueling Support</div>
                </div>
              </div>

              <div className="chat-model-row" style={{ marginBottom: 18 }}>
                <span className="chat-model-chip active">TLS-450PLUS</span>
                <span className="chat-model-chip chat-model-chip--dim">Encore 700</span>
                <span className="chat-model-chip chat-model-chip--dim">Eclipse</span>
                <span className="chat-model-chip chat-model-chip--dim">CRIND</span>
              </div>

              <div className="bubble-user">
                Show me the wiring diagram for a mag probe on the TLS‑450PLUS.
              </div>

              <div className="bubble-bot">
                <p style={{ margin: '0 0 10px', fontSize: 15 }}>
                  The mag probe connects to the <strong>Universal Sensor Module (USM)</strong>.
                  Wire <strong>BLACK → (–) Negative</strong> and <strong>WHITE → (+) Plus</strong> — reversed polarity will cause a probe fault on startup.
                </p>
                <p style={{ margin: '0 0 12px', fontSize: 12, color: '#64748b' }}>
                  Source: Manual 577014-073, Figure 43, p. 47
                </p>
                <div className="lp-figure-pill">
                  <span className="lp-figure-icon">🗺</span>
                  <span>Wiring diagram retrieved from documentation</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Power note */}
      <div className="lp-power-bar">
        <div className="container lp-power-inner">
          <span>Powered by</span>
          <strong>Anthropic Claude</strong>
          <span>+</span>
          <strong>OpenAI</strong>
          <span>·</span>
          <span>Reasons through your question using manufacturer expertise</span>
          <span>·</span>
          <span>Acts like a senior tech who has read every manual</span>
        </div>
      </div>

      {/* Features */}
      <section id="features" className="section">
        <div className="container">
          <span className="badge">What it can do</span>
          <h2>AI that reasons like a senior tech — backed by real manufacturer knowledge.</h2>
          <p>
            FuelTech AI Pro uses Anthropic Claude and OpenAI to understand the intent behind your question,
            draw on a curated knowledge base of Gilbarco, Veeder-Root, Wayne, Red Jacket, Franklin Fueling,
            and industry documentation, and reason through the right answer — combining AI intelligence
            with industry-specific expertise so you get a professional-grade response, not a keyword match.
          </p>
          <div className="features" style={{ marginTop: 48 }}>
            {features.map((f) => (
              <div className="feature" key={f.title}>
                <div className="icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Library */}
      <section id="library" className="section alt">
        <div className="container">
          <span className="badge">Built-in expertise</span>
          <h2>The knowledge that makes the AI a specialist.</h2>
          <p>
            Every answer FuelTech AI Pro gives is informed by a continuously updated knowledge base built from
            official Gilbarco, Veeder-Root, Wayne, Red Jacket, Franklin Fueling, and industry documentation —
            giving the AI the same reference material a certified technician relies on, but accessible in
            seconds from any job site.
          </p>
          <div className="lp-update-note">
            <span className="lp-update-dot" />
            <div>
              <strong>Live in production &mdash; and always growing.</strong>{' '}
              FuelTech AI Pro is an active production system, not a demo. As new Gilbarco, Veeder-Root,
              Wayne, Red Jacket, and Franklin Fueling documentation is released — including
              service bulletins — it is automatically ingested and indexed into the knowledge
              base. The AI you use today is more capable than it was last month, and it will continue to
              evolve as the industry does.
            </div>
          </div>
          <div className="lp-brands" style={{ marginTop: 48 }}>
            {brands.map((b) => (
              <div className="lp-brand-card" key={b.name}>
                <div className="lp-brand-name">{b.name}</div>
                <ul className="lp-brand-list">
                  {b.items.map((item) => (
                    <li key={item}>✓ {item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="section">
        <div className="container two-col">
          <div>
            <span className="badge">Who it helps</span>
            <h2>Built for field techs, service companies and ATG specialists.</h2>
            <p>
              Whether you&apos;re on a startup, running a service call, or training a new hire, FuelTech AI Pro
              acts as the senior technician in your pocket — one who understands your equipment, knows
              the procedures, and can explain them clearly on the spot.
            </p>
          </div>
          <div className="audiences">
            <div className="audience">✓ ATG startup technicians</div>
            <div className="audience">✓ Fueling equipment service companies</div>
            <div className="audience">✓ Gas station maintenance teams</div>
            <div className="audience">✓ New hires learning ATG &amp; dispenser equipment</div>
            <div className="audience">✓ Gilbarco authorized contractors</div>
            <div className="audience">✓ Operations managers and dispatchers</div>
          </div>
        </div>
      </section>

      {/* Reviews */}
      <ReviewsSection />

      {/* Pricing */}
      <section id="pricing" className="section alt">
        <div className="container">
          <span className="badge">Introductory Beta Pricing</span>
          <h2 style={{ textAlign: 'center', marginBottom: 8 }}>Simple, transparent pricing.</h2>
          <p style={{ textAlign: 'center', color: 'var(--color-subtext)', marginBottom: 4 }}>
            Everything you need to put AI-powered documentation in every tech&apos;s pocket.
          </p>
          <p className="pricing-beta-note">
            🔒 Beta phase pricing — these rates are locked in for early adopters and will increase when we exit beta.
          </p>

          <div className="pricing-cards-row">

            {/* Monthly */}
            <div className="pricing-card">
              <div className="pricing-limited-badge pricing-beta-badge">Beta Introductory Rate</div>
              <div className="pricing-header">
                <Zap size={32} style={{ color: 'var(--color-primary)' }} />
                <h3>FuelTech AI Pro</h3>
                <div className="pricing-price">
                  <span className="pricing-amount">${MONTHLY_PRICE}</span>
                  <span className="pricing-period">/month</span>
                </div>
                <p className="pricing-tagline">Per user &mdash; billed monthly, cancel any time</p>
              </div>

              <ul className="pricing-features">
                <li>✓ Unlimited questions from any device</li>
                <li>✓ Multi-brand documentation library (Gilbarco, Veeder-Root, Wayne, Red Jacket &amp; more)</li>
                <li>✓ Error code lookups &amp; alarm diagnosis</li>
                <li>✓ Diagrams, schematics &amp; installation figures</li>
                <li>✓ Step-by-step troubleshooting in conversation</li>
                <li>✓ ATG startup, programming &amp; configuration guidance</li>
                <li>✓ Field testing procedures &amp; compliance protocols</li>
                <li>✓ ATG Direct Connect — pull alarm history &amp; setup reports via RS-232 or Ethernet</li>
                <li>✓ Dispenser, CRIND &amp; EMV support</li>
                <li>✓ Source citations on every answer</li>
                <li>✓ Works on phone, tablet &amp; desktop (PWA)</li>
              </ul>

              <a
                className="paypal-btn"
                href="https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=digitaldemon%40wskandsons.com&item_name=FuelTech+AI+Pro+Monthly&a3=14.99&p3=1&t3=M&src=1&currency_code=USD&no_shipping=1&return=https%3A%2F%2Fwww.fueltechaipro.com%2Fpayment-success%3Fplan%3Dmonthly&cancel_return=https%3A%2F%2Fwww.fueltechaipro.com%2F%23pricing"
                target="_blank"
                rel="noopener noreferrer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://www.paypalobjects.com/webstatic/en_US/i/buttons/PP_logo_h_100x26.png"
                  alt="PayPal"
                  style={{ height: 20, verticalAlign: 'middle', marginRight: 8 }}
                />
                Subscribe — $14.99/month
              </a>

              <p className="pricing-note">
                After payment you&apos;ll receive login credentials automatically.
              </p>
            </div>

            {/* Annual — recommended */}
            <div className="pricing-card pricing-card-featured">
              <div className="pricing-limited-badge">Best Value — Save $81/year</div>
              <div className="pricing-header">
                <Zap size={32} style={{ color: 'var(--color-primary)' }} />
                <h3>FuelTech AI Pro</h3>
                <div className="pricing-price">
                  <span className="pricing-amount">${ANNUAL_PRICE}</span>
                  <span className="pricing-period">/year</span>
                </div>
                <p className="pricing-tagline">Per user &mdash; full access for an entire year</p>
              </div>

              <ul className="pricing-features">
                <li>✓ Unlimited questions from any device</li>
                <li>✓ Multi-brand documentation library (Gilbarco, Veeder-Root, Wayne, Red Jacket &amp; more)</li>
                <li>✓ Error code lookups &amp; alarm diagnosis</li>
                <li>✓ Diagrams, schematics &amp; installation figures</li>
                <li>✓ Step-by-step troubleshooting in conversation</li>
                <li>✓ ATG startup, programming &amp; configuration guidance</li>
                <li>✓ Field testing procedures &amp; compliance protocols</li>
                <li>✓ ATG Direct Connect — pull alarm history &amp; setup reports via RS-232 or Ethernet</li>
                <li>✓ Dispenser, CRIND &amp; EMV support</li>
                <li>✓ Source citations on every answer</li>
                <li>✓ Works on phone, tablet &amp; desktop (PWA)</li>
              </ul>

              <a
                className="paypal-btn"
                href="https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=digitaldemon%40wskandsons.com&item_name=FuelTech+AI+Pro+Annual+Access&amount=99.00&currency_code=USD&no_shipping=1&return=https%3A%2F%2Fwww.fueltechaipro.com%2Fpayment-success%3Fplan%3Dannual&cancel_return=https%3A%2F%2Fwww.fueltechaipro.com%2F%23pricing"
                target="_blank"
                rel="noopener noreferrer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://www.paypalobjects.com/webstatic/en_US/i/buttons/PP_logo_h_100x26.png"
                  alt="PayPal"
                  style={{ height: 20, verticalAlign: 'middle', marginRight: 8 }}
                />
                Pay with PayPal — $99/year
              </a>

              <p className="pricing-note">
                After payment you&apos;ll receive login credentials automatically.
                Questions? Email{' '}
                <a href="mailto:info@fueltechaipro.com" style={{ color: 'var(--color-primary)' }}>
                  info@fueltechaipro.com
                </a>
              </p>
            </div>

            {/* Enterprise — coming soon */}
            <div className="pricing-card pricing-card-enterprise">
              <div className="pricing-coming-soon-badge">Coming Soon</div>
              <div className="pricing-header">
                <Zap size={32} style={{ color: '#a78bfa' }} />
                <h3>FuelTech AI Enterprise</h3>
                <div className="pricing-price">
                  <span className="pricing-amount pricing-amount-enterprise">Custom</span>
                </div>
                <p className="pricing-tagline">Per organization &mdash; contact us for pricing</p>
              </div>

              <ul className="pricing-features pricing-features-enterprise">
                <li>⬡ Everything in Pro, for your whole team</li>
                <li>⬡ Multi-user accounts with admin dashboard</li>
                <li>⬡ Upload your own proprietary documentation</li>
                <li>⬡ Usage analytics &amp; activity reporting</li>
                <li>⬡ Priority support &amp; dedicated onboarding</li>
                <li>⬡ API access for integrations</li>
                <li>⬡ Custom branding options</li>
                <li>⬡ Volume licensing for service fleets</li>
              </ul>

              {enterpriseStatus === 'done' ? (
                <div className="pricing-enterprise-success">
                  ✓ You&apos;re on the list! We&apos;ll email you when Enterprise launches.
                </div>
              ) : enterpriseStatus === 'form' || enterpriseStatus === 'loading' || enterpriseStatus === 'error' ? (
                <form className="pricing-enterprise-form" onSubmit={handleEnterpriseSubmit}>
                  <input
                    type="email"
                    placeholder="Your email address"
                    value={enterpriseEmail}
                    onChange={e => setEnterpriseEmail(e.target.value)}
                    required
                    disabled={enterpriseStatus === 'loading'}
                    className="pricing-enterprise-input"
                  />
                  <input
                    type="text"
                    placeholder="Company name (optional)"
                    value={enterpriseCompany}
                    onChange={e => setEnterpriseCompany(e.target.value)}
                    disabled={enterpriseStatus === 'loading'}
                    className="pricing-enterprise-input"
                  />
                  {enterpriseError && (
                    <p className="pricing-enterprise-error">{enterpriseError}</p>
                  )}
                  <button
                    type="submit"
                    className="paypal-btn pricing-enterprise-btn"
                    disabled={enterpriseStatus === 'loading'}
                  >
                    {enterpriseStatus === 'loading' ? 'Saving…' : 'Notify Me When Available'}
                  </button>
                </form>
              ) : (
                <button
                  className="paypal-btn pricing-enterprise-btn"
                  onClick={() => setEnterpriseStatus('form')}
                >
                  Notify Me When Available
                </button>
              )}

              <p className="pricing-note">
                Interested in enterprise access? Email{' '}
                <a href="mailto:info@fueltechaipro.com" style={{ color: '#a78bfa' }}>
                  info@fueltechaipro.com
                </a>{' '}
                to get on the early access list.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="lp-disclaimer">
        <div className="container">
          <p className="lp-disclaimer-title">Disclaimer &amp; Limitations of Use</p>
          <p>
            FuelTech AI Pro is an AI-assisted reference tool intended for use by qualified fueling equipment
            technicians. It is not a substitute for professional training, manufacturer-approved procedures,
            or official certification. AI-generated responses may occasionally be incomplete, outdated, or
            inaccurate — always verify critical procedures against the applicable Gilbarco, Veeder-Root, or
            manufacturer service manual before performing any work.
          </p>
          <p>
            For safety-critical decisions, regulatory compliance questions, or operations involving
            hazardous materials, defer to manufacturer guidance, local codes, and certified professionals.
            FuelTech AI Pro and Gen X Data Acquisitions LLC assume no liability for damages, injuries,
            or losses arising from reliance on information provided by this service.
          </p>
          <p>
            FuelTech AI Pro is not affiliated with, endorsed by, or sponsored by Gilbarco Veeder-Root,
            Dover Fueling Solutions, or their parent companies. All manufacturer names and trademarks are
            the property of their respective owners and are referenced solely to identify the equipment
            this service supports.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container footer-flex">
          <div className="brand">
            <div className="logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-192.png" alt="FuelTech AI Pro" className="brand-logo-img" />
            </div>
            <div>
              <strong>FuelTech AI Pro™</strong>
              <div className="brand-sub">AI-powered support for the fueling industry.</div>
            </div>
          </div>
          <div style={{ textAlign: 'right', color: 'var(--color-subtext)', fontSize: 13 }}>
            <div>© 2026 Gen X Data Acquisitions LLC. All rights reserved.</div>
            <div style={{ marginTop: 4 }}>FuelTech AI Pro™ is a trademark of Gen X Data Acquisitions LLC.</div>
            <div style={{ marginTop: 12 }}>
              <a href="/admin" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: 12, fontWeight: 600, border: '1px solid rgba(34,211,238,0.3)', borderRadius: 6, padding: '4px 12px' }}>Admin Portal</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
