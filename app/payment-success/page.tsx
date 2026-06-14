"use client";

import { useState } from "react";
import { registerAccount } from "./actions";

type Credentials = { username: string; password: string };

export default function PaymentSuccessPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [copied, setCopied] = useState<"username" | "password" | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await registerAccount(email);
      if (!result.ok) throw new Error(result.error);
      setCredentials({ username: result.username, password: result.password });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copy = async (field: "username" | "password", value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="success-wrapper">
      <div className="success-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="FuelTech AI Pro" className="success-logo" />

        {!credentials ? (
          <>
            <div className="success-checkmark">✓</div>
            <h1>Payment received!</h1>
            <p className="success-sub">
              Enter your email below and your login credentials will be created instantly.
            </p>

            <form onSubmit={handleSubmit} className="success-form">
              <input
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
              {error && <p className="success-error">{error}</p>}
              <button type="submit" disabled={loading}>
                {loading ? "Creating your account…" : "Create my account →"}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="success-checkmark">✓</div>
            <h1>Your account is ready!</h1>
            <p className="success-sub">
              Save these credentials — you&apos;ll need them to log in.
            </p>

            <div className="cred-box">
              <div className="cred-row">
                <span className="cred-label">Username</span>
                <span className="cred-value">{credentials.username}</span>
                <button
                  type="button"
                  className="cred-copy"
                  onClick={() => copy("username", credentials.username)}
                >
                  {copied === "username" ? "Copied!" : "Copy"}
                </button>
              </div>
              <div className="cred-row">
                <span className="cred-label">Password</span>
                <span className="cred-value">{credentials.password}</span>
                <button
                  type="button"
                  className="cred-copy"
                  onClick={() => copy("password", credentials.password)}
                >
                  {copied === "password" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <p className="success-note">
              Screenshot or write these down — this page won&apos;t show them again.
            </p>

            <a href="/login" className="success-home-btn">Go to login →</a>
          </>
        )}
      </div>
    </div>
  );
}
