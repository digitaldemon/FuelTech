i'use client';
mport { Gauge, ShieldCheck, Wrench, FileText, MessageSquare, ArrowRight, Zap, Building2, Menu } from 'lucide-react';
import { useState } from 'react';

/**
 * The landing page showcases the FuelTech AI Pro product and its key benefits.  
 * It reuses many of the styles defined in `globals.css` for consistency and
 * responsiveness. Icons from the Lucide library illustrate the different
 * features and steps. Feel free to adjust the text to better suit your
 * marketing copy.
 */

const features = [
  {
    icon: <MessageSquare />, // Real-time Q&A support
    title: 'Ask Field Questions Instantly',
    text:
      'Technicians can ask practical troubleshooting questions about alarms, startup checks, dispenser issues, tank monitoring and service workflow.',
  },
  {
    icon: <Gauge />, // Equipment and ATG support
    title: 'ATG & Fueling Equipment Support',
    text:
      'Designed around real fueling-site work: tank monitoring, leak detection, sensors, pumps, dispensers, compliance checks and startup support.',
  },
  {
    icon: <FileText />, // Documentation management
    title: 'SOPs, Checklists & Job Notes',
    text:
      'Turn tribal knowledge into repeatable checklists for new hires, annual certifications, PM visits, inspections and service calls.',
  },
  {
    icon: <ShieldCheck />, // Safety first
    title: 'Safety‑First Guidance',
    text:
      'Built to reinforce safe, compliant workflows and elevate technicians back to manuals, supervisors or certified procedures when needed.',
  },
];

const audiences = [
  'Fueling service companies',
  'Gas station maintenance teams',
  'ATG testers and startup techs',
  'New technicians learning the trade',
  'Operations managers and dispatchers',
  'Compliance and inspection teams',
];

const steps = [
  'Upload your manuals, SOPs, forms and field notes',
  'Train FuelTech AI Pro on your company workflow',
  'Let technicians ask questions from the field',
  'Capture knowledge, reduce callbacks and speed up training',
];

export default function Home() {
  // Track whether the mobile navigation menu is open on small screens
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <main>
      {/* Primary navigation header */}
      <header className="header">
        <div className="container nav">
          <div className="brand">
            <div className="logo">
              {/* Use a simple icon instead of a static logo image */}
              <Gauge size={32} />
            </div>
            <div>
              <div className="brand-title">FuelTech AI Pro</div>
              <div className="brand-sub">AI for fueling technicians</div>
            </div>
          </div>
          {/* Standard navigation links for larger screens */}
          <nav className="navlinks">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#demo">Demo</a>
            <a href="/login">Login</a>
          </nav>
          {/* CTA button visible on larger screens */}
          <a className="button join-button" href="#demo">
            Join Waitlist
          </a>
          {/* Mobile menu toggle button visible on small screens */}
          <button
            className="mobile-toggle"
            aria-label="Toggle navigation menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Menu size={28} />
          </button>
        </div>
        {/* Mobile navigation menu appears when toggled */}
        <nav className={`mobile-menu${menuOpen ? ' open' : ''}`}>
          <a href="#features" onClick={() => setMenuOpen(false)}>
            Features
          </a>
          <a href="#how" onClick={() => setMenuOpen(false)}>
            How it works
          </a>
          <a href="#demo" onClick={() => setMenuOpen(false)}>
            Demo
          </a>
          <a href="/login" onClick={() => setMenuOpen(false)}>
            Login
          </a>
          <a className="button" href="#demo" onClick={() => setMenuOpen(false)}>
            Join Waitlist
          </a>
        </nav>
      </header>

      {/* Hero section with chat preview */}
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="badge">Built for the gasoline station industry</span>
            <h1 className="h1">The AI field assistant for fueling technicians.</h1>
            <p className="lead">
              FuelTech AI Pro helps technicians troubleshoot faster, follow company procedures, train new hires and access critical fueling‑site knowledge from any
              job site.
            </p>
            <div className="cta-row">
              <a href="#demo" className="button">
                Request Early Access <ArrowRight size={24} />
              </a>
              <a href="#features" className="button secondary">
                See Use Cases
              </a>
            </div>
            <div className="ai-note">
              Powered by advanced OpenAI models and customized specifically for fueling service companies, ATG technicians, startup specialists and petroleum
              maintenance teams. This allows FuelTech AI Pro to provide intelligent troubleshooting assistance, training support, document interpretation and
              real‑time field guidance far beyond a traditional chatbot.
            </div>
            <div className="checks">
              <span>✓ ATG support</span>
              <span>✓ Field checklists</span>
              <span>✓ Training assistant</span>
            </div>
          </div>
          <div className="card chat">
            <div className="chat-inner">
              <div className="chat-head">
                <div className="logo">
                  {/* Icon representing FuelTech AI Pro */}
                  <Gauge size={24} />
                </div>
                <div>
                  <strong>FuelTech AI Pro Assistant</strong>
                  <div className="brand-sub">Online · Technician support mode</div>
                </div>
              </div>
              {/* Example conversation preview */}
              <div className="bubble-user">
                My Veeder‑Root TLS450 Plus is showing a sudden loss alarm after a delivery. What should I verify before clearing it?
              </div>
              <div className="bubble-bot">
                Verify the tank product level has stabilized after delivery, confirm no active leaks or line test failures exist, review delivery data for possible
                overfill or reconciliation issues and inspect probes and sensors for communication errors before acknowledging the alarm.
              </div>
              <div className="quick-grid">
                <div className="quick">Review delivery report</div>
                <div className="quick">Check probe status</div>
                <div className="quick">Verify tank reconciliation</div>
                <div className="quick">Inspect alarm history</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features section */}
      <section id="features" className="section">
        <div className="container">
          <span className="badge">Core features</span>
          <h2>Built for real field work, not generic chatbot answers.</h2>
          <p>
            FuelTech AI Pro is powered by advanced AI technology from OpenAI, combined with your own manuals, procedures, technician notes and company workflows
            to create a specialized field assistant for the fueling industry.
          </p>
          <div className="features">
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

      {/* Audiences section */}
      <section className="section alt">
        <div className="container two-col">
          <div>
            <span className="badge">Who it helps</span>
            <h2>A smarter support system for every fueling team.</h2>
            <p>
              Whether you run a service company, manage technicians or train new hires, FuelTech AI Pro helps standardize knowledge and reduce time wasted
              searching for answers.
            </p>
          </div>
          <div className="audiences">
            {audiences.map((a) => (
              <div className="audience" key={a}>
                ✓ {a}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works section */}
      <section id="how" className="section">
        <div className="container">
          <span className="badge">How it works</span>
          <h2>Launch your company knowledge bot in four steps.</h2>
          <div className="steps">
            {steps.map((s, i) => (
              <div className="feature" key={s}>
                <div className="num">{i + 1}</div>
                <h3>{s}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo / CTA section */}
      <section id="demo" className="section">
        <div className="container">
          <div className="cta-box">
            <Zap size={44} />
            <h2>Be one of the first fueling companies to test FuelTech AI Pro.</h2>
            <p>
              Join the early access list and help shape the AI assistant built specifically for gas station technicians, ATG testers, startup techs and fueling
              service teams.
            </p>
            <div className="email-row">
              <input placeholder="Enter your email" />
              <a
                className="button"
                href="mailto:digitaldemon@wskandsons.com?subject=FuelTech%20AI%20Pro%20Early%20Access"
              >
                Get Early Access
              </a>
            </div>
            <p style={{ fontSize: 14, color: '#94a3b8' }}>No spam. Just product updates, beta invites and launch details.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container footer-flex">
          <div className="brand">
            <div className="logo">
              <Building2 size={24} />
            </div>
            <div>
              <strong>FuelTechAIPro.com</strong>
              <div className="brand-sub">AI‑powered support for the fueling industry.</div>
            </div>
          </div>
          <div>© 2026 FuelTech AI Pro. All rights reserved.</div>
        </div>
      </footer>
    </main>
  );
}
