"use client";

import { Gauge, ShieldCheck, FileText, MessageSquare, ArrowRight, Zap, Menu } from 'lucide-react';
import { useState } from 'react';

// ── Set your access fee here ──────────────────────────────────────────────────
const ACCESS_PRICE = 49.99; // USD per year (limited time)

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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-192.png" alt="FuelTech AI Pro" className="brand-logo-img" />
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
            <a href="#pricing">Pricing</a>
            <a href="/login">Login</a>
          </nav>
          {/* CTA button visible on larger screens */}
          <a className="button join-button" href="#pricing">
            Get Access
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
          <a href="#pricing" onClick={() => setMenuOpen(false)}>
            Pricing
          </a>
          <a href="/login" onClick={() => setMenuOpen(false)}>
            Login
          </a>
          <a className="button" href="#pricing" onClick={() => setMenuOpen(false)}>
            Get Access
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
              <a href="#pricing" className="button">
                Get Access — ${ACCESS_PRICE}/yr <ArrowRight size={24} />
              </a>
              <a href="#features" className="button secondary">
                See Features
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icon-192.png" alt="FuelTech AI Pro" className="brand-logo-img" />
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

      {/* Pricing / payment section */}
      <section id="pricing" className="section">
        <div className="container">
          <span className="badge">Simple pricing</span>
          <h2 style={{ textAlign: 'center', marginBottom: 8 }}>One plan. Full access.</h2>
          <p style={{ textAlign: 'center', color: 'var(--color-subtext)', marginBottom: 48 }}>
            Everything you need to put AI-powered documentation in every tech&apos;s pocket.
          </p>

          <div className="pricing-card">
            <div className="pricing-limited-badge">Limited Time Offer</div>
            <div className="pricing-header">
              <Zap size={32} style={{ color: 'var(--color-primary)' }} />
              <h3>FuelTech AI Pro</h3>
              <div className="pricing-price">
                <span className="pricing-amount">${ACCESS_PRICE}</span>
                <span className="pricing-period">/year</span>
              </div>
              <p className="pricing-tagline">Full access for an entire year</p>
            </div>

            <ul className="pricing-features">
              <li>✓ Unlimited questions from any device</li>
              <li>✓ Gilbarco &amp; Veeder-Root documentation library</li>
              <li>✓ Error code lookups, wiring diagrams &amp; procedures</li>
              <li>✓ ATG startup, programming &amp; alarm guidance</li>
              <li>✓ Dispenser troubleshooting &amp; EMV support</li>
              <li>✓ Works on phone, tablet &amp; desktop</li>
            </ul>

            <a
              className="paypal-btn"
              href={`https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=digitaldemon%40wskandsons.com&item_name=FuelTech+AI+Pro+Annual+Access&amount=49.99&currency_code=USD&no_shipping=1&return=https%3A%2F%2Fwww.fueltechaipro.com%2Fpayment-success&cancel_return=https%3A%2F%2Fwww.fueltechaipro.com%2F%23pricing`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src="https://www.paypalobjects.com/webstatic/en_US/i/buttons/PP_logo_h_100x26.png"
                alt="PayPal"
                style={{ height: 20, verticalAlign: 'middle', marginRight: 8 }}
              />
              Pay with PayPal — $49.99/year
            </a>

            <p className="pricing-note">
              After payment you&apos;ll receive your login credentials within one business day.
              Questions? Email <a href="mailto:digitaldemon@wskandsons.com" style={{ color: 'var(--color-primary)' }}>digitaldemon@wskandsons.com</a>
            </p>
          </div>
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