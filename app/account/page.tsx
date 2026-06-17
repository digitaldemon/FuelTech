"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface AccountData {
  username: string;
  email: string | null;
  expiresAt: string | null;
  consoleLicenseKey: string | null;
}

export default function AccountPage() {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/account')
      .then(r => {
        if (r.status === 401) { window.location.href = '/login'; return null; }
        return r.json();
      })
      .then(d => {
        if (d) setAccount(d as AccountData);
        setLoading(false);
      })
      .catch(() => { window.location.href = '/login'; });
  }, []);

  const copyKey = () => {
    if (!account?.consoleLicenseKey) return;
    navigator.clipboard.writeText(account.consoleLicenseKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return 'No expiry';
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
  };

  return (
    <div className="acct-wrapper">
      <div className="acct-card">
        <div className="acct-header">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="FuelTech AI Pro" className="acct-logo" />
          <div>
            <h1 className="acct-title">My Account</h1>
            <p className="acct-sub">FuelTech AI Pro</p>
          </div>
        </div>

        {loading ? (
          <div className="acct-loading">Loading…</div>
        ) : account ? (
          <>
            <div className="acct-section">
              <div className="acct-label">Username</div>
              <div className="acct-value">{account.username}</div>
            </div>

            {account.email && (
              <div className="acct-section">
                <div className="acct-label">Email</div>
                <div className="acct-value">{account.email}</div>
              </div>
            )}

            <div className="acct-section">
              <div className="acct-label">Subscription expires</div>
              <div className="acct-value">{formatDate(account.expiresAt)}</div>
            </div>

            <div className="acct-divider" />

            <div className="acct-section">
              <div className="acct-label">Console App License Key</div>
              <p className="acct-key-desc">
                Enter this key when you first launch the <strong>FuelTech AI Console Connect</strong> desktop app.
                It activates your copy on this machine and is included with your subscription.
              </p>
              {account.consoleLicenseKey ? (
                <div className="acct-key-row">
                  <div className="acct-key-box">{account.consoleLicenseKey}</div>
                  <button
                    type="button"
                    className={`acct-copy-btn${copied ? ' copied' : ''}`}
                    onClick={copyKey}
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              ) : (
                <div className="acct-key-missing">
                  No console key found — contact{' '}
                  <a href="mailto:info@fueltechaipro.com">info@fueltechaipro.com</a>.
                </div>
              )}
            </div>

            <div className="acct-divider" />

            <div className="acct-download-row">
              <div>
                <div className="acct-download-title">FuelTech AI Console Connect</div>
                <div className="acct-download-sub">Windows · Free with your plan</div>
              </div>
              <a href="/api/download" className="acct-download-btn">↓ Download</a>
            </div>
          </>
        ) : null}

        <div className="acct-footer">
          <Link href="/chat" className="acct-back-link">← Back to chat</Link>
          <button
            type="button"
            className="acct-signout-btn"
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/login';
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
