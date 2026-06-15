"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { upload } from "@vercel/blob/client";

type FileResult = {
  name: string;
  title: string;
  chunks: number;
  url: string;
};

type FileEntry = {
  file: File;
  phase: "idle" | "uploading" | "processing" | "done" | "error";
  progress: number;
  result?: FileResult;
  error?: string;
};

const SOURCES = [
  { value: "pei",               label: "PEI" },
  { value: "veeder-root",       label: "Veeder-Root" },
  { value: "gilbarco",          label: "Gilbarco" },
  { value: "gilbarco-extranet", label: "Gilbarco Extranet" },
  { value: "franklin",          label: "Franklin Fueling" },
  { value: "dover",             label: "Dover / Wayne" },
  { value: "manual",            label: "Other / Manual" },
];

function getSavedSecret(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("ft_admin_secret") ?? "";
}

// ── Lock screen ───────────────────────────────────────────────────────────────

function LockScreen({ onUnlock }: { onUnlock: (secret: string) => void }) {
  const [input, setInput]     = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) { setError("Enter the admin password."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: input.trim() }),
      });
      if (res.ok) {
        localStorage.setItem("ft_admin_secret", input.trim());
        onUnlock(input.trim());
      } else {
        setError("Incorrect password.");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <form style={s.lockCard} onSubmit={submit}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" style={s.lockLogo} />
        <div style={s.lockTitle}>Admin Access</div>
        <div style={s.lockSub}>FuelTech AI Pro</div>
        <input
          type="password"
          style={{ ...s.input, marginTop: 28 }}
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(""); }}
          placeholder="Admin password"
          autoComplete="current-password"
          autoFocus
        />
        {error && <p style={s.errMsg}>{error}</p>}
        <button type="submit" style={{ ...s.btn, marginTop: 16 }} disabled={loading}>
          {loading ? "Checking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}

// ── Main upload UI ────────────────────────────────────────────────────────────

export default function AdminUpload() {
  const saved = getSavedSecret();
  const [secret, setSecret]   = useState(saved);
  const [unlocked, setUnlocked] = useState(!!saved);
  const [source, setSource]   = useState("pei");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUnlock = (s: string) => { setSecret(s); setUnlocked(true); };

  const logout = () => {
    localStorage.removeItem("ft_admin_secret");
    setSecret("");
    setUnlocked(false);
    setEntries([]);
  };

  const updateEntry = (name: string, patch: Partial<FileEntry>) =>
    setEntries((prev) =>
      prev.map((e) => (e.file.name === name ? { ...e, ...patch } : e))
    );

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const pdfs = Array.from(incoming).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    setEntries((prev) => {
      const existing = new Set(prev.map((e) => e.file.name));
      const fresh: FileEntry[] = pdfs
        .filter((f) => !existing.has(f.name))
        .map((f) => ({ file: f, phase: "idle", progress: 0 }));
      return [...prev, ...fresh];
    });
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, []);

  const removeEntry = (name: string) =>
    setEntries((prev) => prev.filter((e) => e.file.name !== name));

  const processAll = async () => {
    const idle = entries.filter((e) => e.phase === "idle");
    if (!idle.length) return;
    setRunning(true);

    for (const entry of idle) {
      const { file } = entry;

      updateEntry(file.name, { phase: "uploading", progress: 0 });
      let blobUrl = "";
      try {
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
          clientPayload: JSON.stringify({ secret, source }),
          onUploadProgress: ({ percentage }) =>
            updateEntry(file.name, { progress: Math.round(percentage) }),
        });
        blobUrl = blob.url;
      } catch (err) {
        updateEntry(file.name, {
          phase: "error",
          error: `Upload failed: ${(err as Error).message}`,
        });
        continue;
      }

      updateEntry(file.name, { phase: "processing", progress: 100 });
      try {
        const res = await fetch("/api/upload/process", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-secret": secret,
          },
          body: JSON.stringify({ url: blobUrl, source }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Processing failed");
        updateEntry(file.name, {
          phase: "done",
          result: { name: file.name, title: json.title, chunks: json.chunks, url: blobUrl },
        });
      } catch (err) {
        updateEntry(file.name, {
          phase: "error",
          error: `Processing failed: ${(err as Error).message}`,
        });
      }
    }

    setRunning(false);
  };

  const totalChunks = entries
    .filter((e) => e.phase === "done")
    .reduce((sum, e) => sum + (e.result?.chunks ?? 0), 0);

  const allDone =
    entries.length > 0 && entries.every((e) => e.phase === "done" || e.phase === "error");

  // ── Web user creation ────────────────────────────────────────────────────
  const [newUserEmail,    setNewUserEmail]    = useState("");
  const [newUserDuration, setNewUserDuration] = useState("365");
  const [creatingUser,    setCreatingUser]    = useState(false);
  const [userResult,      setUserResult]      = useState<{ username: string; password: string; expires: string } | null>(null);
  const [userError,       setUserError]       = useState("");
  const [copiedUser,      setCopiedUser]      = useState<"username" | "password" | "">("");

  const createWebUser = async () => {
    if (!newUserEmail.trim() || creatingUser) return;
    setCreatingUser(true);
    setUserError("");
    setUserResult(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ email: newUserEmail.trim(), durationDays: Number(newUserDuration) || 365 }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        const days = Number(newUserDuration) || 365;
        const exp  = new Date(Date.now() + days * 86_400_000).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
        setUserResult({ username: json.username, password: json.password, expires: exp });
        setNewUserEmail("");
      } else {
        setUserError(json.error ?? "Failed to create user.");
      }
    } catch {
      setUserError("Network error. Try again.");
    } finally {
      setCreatingUser(false);
    }
  };

  const copyUserField = (field: "username" | "password", value: string) => {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopiedUser(field);
    setTimeout(() => setCopiedUser(""), 2000);
  };

  // ── Reviews moderation ───────────────────────────────────────────────────
  type ReviewRow = {
    id: string; name: string; company: string | null;
    rating: number; review_text: string; created_at: string;
  };
  const [pendingReviews,  setPendingReviews]  = useState<ReviewRow[]>([]);
  const [revLoading,      setRevLoading]      = useState(false);
  const [revError,        setRevError]        = useState("");

  const loadPendingReviews = useCallback(async () => {
    if (!secret) return;
    setRevLoading(true);
    setRevError("");
    try {
      const res = await fetch("/api/reviews?pending=1", { headers: { "x-admin-secret": secret } });
      const json = await res.json();
      if (res.ok) setPendingReviews(json.reviews ?? []);
      else setRevError(`Failed to load reviews: ${json.error ?? res.status}`);
    } catch {
      setRevError("Network error loading reviews.");
    } finally {
      setRevLoading(false);
    }
  }, [secret]);

  const moderateReview = async (id: string, approved: boolean) => {
    await fetch("/api/reviews", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-secret": secret },
      body: JSON.stringify({ id, approved }),
    });
    setPendingReviews(prev => prev.filter(r => r.id !== id));
  };

  useEffect(() => { if (unlocked) loadPendingReviews(); }, [unlocked, loadPendingReviews]);

  // ── License key management ───────────────────────────────────────────────
  type LicenseRow = {
    license_key: string; tech_name: string; machine_id: string | null;
    activated_at: string | null; expires_at: string; active: boolean; created_at: string;
  };
  const [licenses,     setLicenses]     = useState<LicenseRow[]>([]);
  const [licLoading,   setLicLoading]   = useState(false);
  const [newTechName,  setNewTechName]  = useState("");
  const [newDuration,  setNewDuration]  = useState("365");
  const [issuing,      setIssuing]      = useState(false);
  const [issueResult,  setIssueResult]  = useState<{ key: string; expires: string } | null>(null);
  const [issueError,   setIssueError]   = useState("");
  const [copied,       setCopied]       = useState("");

  const loadLicenses = useCallback(async () => {
    if (!secret) return;
    setLicLoading(true);
    try {
      const res = await fetch("/api/console/licenses", { headers: { "x-admin-secret": secret } });
      const json = await res.json();
      if (res.ok) setLicenses(json.licenses ?? []);
      else setIssueError(`Failed to load licenses: ${json.error ?? res.status}`);
    } catch {
      setIssueError("Network error loading licenses.");
    } finally {
      setLicLoading(false);
    }
  }, [secret]);

  useEffect(() => { if (unlocked) loadLicenses(); }, [unlocked, loadLicenses]);

  const issueKey = async () => {
    if (!newTechName.trim()) return;
    setIssuing(true);
    setIssueError("");
    setIssueResult(null);
    try {
      const res = await fetch("/api/console/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ techName: newTechName.trim(), durationDays: Number(newDuration) || 365 }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setIssueResult({ key: json.licenseKey, expires: json.expiresAt });
        setNewTechName("");
        loadLicenses();
      } else {
        setIssueError(json.error ?? "Failed to issue key.");
      }
    } catch {
      setIssueError("Network error. Try again.");
    } finally {
      setIssuing(false);
    }
  };

  const revokeKey = async (licenseKey: string) => {
    if (!confirm(`Revoke ${licenseKey}? This cannot be undone.`)) return;
    await fetch("/api/console/issue", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-admin-secret": secret },
      body: JSON.stringify({ licenseKey }),
    });
    loadLicenses();
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  };

  if (!unlocked) return <LockScreen onUnlock={handleUnlock} />;

  return (
    <div style={{ ...s.page, alignItems: "flex-start", gap: 24, flexDirection: "column" }}>
      {/* Upload card */}
      <div style={{ width: "100%", maxWidth: 580, margin: "0 auto" }}>
      <div style={s.card}>
        <div style={s.logoRow}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" style={s.logo} />
          <div style={{ flex: 1 }}>
            <div style={s.h1}>FuelTech Admin</div>
            <div style={s.sub}>PDF Knowledge Base Upload</div>
          </div>
          <button style={s.logoutBtn} onClick={logout} title="Sign out">
            Sign out
          </button>
        </div>

        {/* Source */}
        <label style={s.label}>Document Source</label>
        <select
          style={s.select}
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          {SOURCES.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Drop zone */}
        <label style={s.label}>PDF Files</label>
        <div
          style={{ ...s.drop, ...(dragging ? s.dropActive : {}) }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            style={{ display: "none" }}
            onChange={(e) => addFiles(e.target.files)}
          />
          <div style={{ fontSize: 34, marginBottom: 8 }}>📄</div>
          <p style={s.dropText}>
            Drag &amp; drop PDFs here or{" "}
            <span style={{ color: "#22d3ee", textDecoration: "underline" }}>browse</span>
          </p>
          <p style={s.dropHint}>Any size — files upload directly to storage, not through the server</p>
        </div>

        {/* File list */}
        {entries.length > 0 && (
          <ul style={s.list}>
            {entries.map((e) => (
              <li key={e.file.name} style={s.item}>
                <div style={s.itemTop}>
                  <span style={s.itemName}>{e.file.name}</span>
                  <span style={s.itemSize}>
                    {(e.file.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                  {e.phase === "idle" && (
                    <button style={s.rmBtn} onClick={() => removeEntry(e.file.name)}>✕</button>
                  )}
                  {e.phase === "uploading" && (
                    <span style={s.badge("#3b82f6")}>Uploading {e.progress}%</span>
                  )}
                  {e.phase === "processing" && (
                    <span style={s.badge("#a855f7")}>Processing…</span>
                  )}
                  {e.phase === "done" && (
                    <span style={s.badge("#22c55e")}>✓ {e.result?.chunks} chunks</span>
                  )}
                  {e.phase === "error" && (
                    <span style={s.badge("#ef4444")}>Error</span>
                  )}
                </div>
                {e.phase === "uploading" && (
                  <div style={s.barTrack}>
                    <div style={{ ...s.barFill, width: `${e.progress}%` }} />
                  </div>
                )}
                {e.phase === "done" && e.result && (
                  <p style={s.resultTitle}>{e.result.title}</p>
                )}
                {e.phase === "error" && (
                  <p style={s.errLine}>{e.error}</p>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Upload button */}
        <button
          style={{ ...s.btn, ...(running ? s.btnDisabled : {}) }}
          disabled={running || entries.filter((e) => e.phase === "idle").length === 0}
          onClick={processAll}
        >
          {running
            ? "Processing…"
            : `Upload & Process ${entries.filter((e) => e.phase === "idle").length || ""} PDF${entries.filter((e) => e.phase === "idle").length !== 1 ? "s" : ""}`}
        </button>

        {/* Summary */}
        {allDone && totalChunks > 0 && (
          <div style={s.summary}>
            <p style={{ margin: "0 0 6px", color: "#86efac", fontSize: 14 }}>
              ✅ <strong>{totalChunks.toLocaleString()} chunks</strong> added to the knowledge base
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
              To extract diagrams from the uploaded PDFs, run a figure backfill:{" "}
              <code style={s.code}>
                POST /api/scrape &nbsp;&#123; &quot;source&quot;: &quot;figures&quot;,
                &quot;recheck&quot;: true, &quot;limit&quot;: 8 &#125;
              </code>
            </p>
          </div>
        )}
      </div>
      </div>

      {/* Web user creation */}
      <div style={{ width: "100%", maxWidth: 580, margin: "0 auto" }}>
      <div style={s.card}>
        <div style={s.logoRow}>
          <div style={{ flex: 1 }}>
            <div style={s.h1}>Create Web User</div>
            <div style={s.sub}>Generate login credentials for a paying customer</div>
          </div>
        </div>

        <label style={s.label}>Customer Email</label>
        <input
          style={s.input}
          type="email"
          placeholder="customer@example.com"
          value={newUserEmail}
          onChange={(e) => { setNewUserEmail(e.target.value); setUserError(""); setUserResult(null); }}
          onKeyDown={(e) => e.key === "Enter" && createWebUser()}
          disabled={creatingUser}
        />

        <label style={{ ...s.label, marginTop: 16 }}>Access Plan</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
          {[
            { label: "Monthly (31 days)", value: "31" },
            { label: "Annual (365 days)", value: "365" },
            { label: "Trial (7 days)", value: "7" },
          ].map(opt => (
            <button
              key={opt.value}
              style={{
                ...s.logoutBtn,
                padding: "7px 16px",
                color: newUserDuration === opt.value ? "#22d3ee" : "#475569",
                borderColor: newUserDuration === opt.value ? "rgba(34,211,238,0.5)" : "rgba(255,255,255,0.1)",
                background: newUserDuration === opt.value ? "rgba(34,211,238,0.07)" : "none",
                fontWeight: newUserDuration === opt.value ? 700 : 400,
              }}
              onClick={() => setNewUserDuration(opt.value)}
            >
              {opt.label}
            </button>
          ))}
          <input
            style={{ ...s.input, width: 110, marginTop: 0 }}
            type="number"
            min="1"
            max="3650"
            value={newUserDuration}
            onChange={(e) => setNewUserDuration(e.target.value)}
            title="Custom number of days"
          />
        </div>

        {userError && <p style={{ ...s.errMsg, marginTop: 10 }}>{userError}</p>}

        {userResult && (
          <div style={{ marginTop: 14, background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>Account created — copy and send to the customer:</div>
            {(["username", "password"] as const).map(field => (
              <div key={field} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "#475569", width: 64, flexShrink: 0, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>{field}</span>
                <code style={{ flex: 1, fontSize: 15, fontWeight: 700, color: "#e2e8f0", fontFamily: "monospace" }}>
                  {userResult[field]}
                </code>
                <button
                  style={{ ...s.logoutBtn, color: copiedUser === field ? "#4ade80" : "#22d3ee", borderColor: "rgba(34,211,238,0.3)" }}
                  onClick={() => copyUserField(field, userResult[field])}
                >
                  {copiedUser === field ? "Copied ✓" : "Copy"}
                </button>
              </div>
            ))}
            <div style={{ fontSize: 11, color: "#475569", marginTop: 6 }}>
              Expires: {userResult.expires} &nbsp;·&nbsp; Login at fueltechaipro.com/login
            </div>
          </div>
        )}

        <button
          style={{ ...s.btn, ...(creatingUser ? s.btnDisabled : {}), marginTop: 20 }}
          onClick={createWebUser}
          disabled={creatingUser || !newUserEmail.trim()}
        >
          {creatingUser ? "Creating account…" : "Create Account & Generate Credentials"}
        </button>
      </div>
      </div>

      {/* License key manager */}
      <div style={{ width: "100%", maxWidth: 700, margin: "0 auto" }}>
      <div style={{ ...s.card, maxWidth: "100%" }}>
        <div style={s.logoRow}>
          <div style={{ flex: 1 }}>
            <div style={s.h1}>Console License Keys</div>
            <div style={s.sub}>FuelTech AI Console Connect — issue &amp; manage tech licenses</div>
          </div>
          <button style={s.logoutBtn} onClick={loadLicenses} disabled={licLoading}>
            {licLoading ? "Loading…" : "⟳ Refresh"}
          </button>
        </div>

        {/* Issue new key */}
        <label style={s.label}>Issue New Key</label>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 5 }}>Tech Name</div>
            <input
              style={s.input}
              value={newTechName}
              onChange={(e) => { setNewTechName(e.target.value); setIssueError(""); setIssueResult(null); }}
              placeholder="e.g. John Smith"
              onKeyDown={(e) => e.key === "Enter" && issueKey()}
            />
          </div>
          <div style={{ width: 110 }}>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 5 }}>Duration (days)</div>
            <input
              style={s.input}
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
              type="number"
              min="1"
              max="3650"
            />
          </div>
          <button
            style={{ ...s.btn, marginTop: 0, width: "auto", padding: "10px 22px", flexShrink: 0 }}
            onClick={issueKey}
            disabled={issuing || !newTechName.trim()}
          >
            {issuing ? "Issuing…" : "Issue Key"}
          </button>
        </div>

        {issueResult && (
          <div style={{ marginTop: 12, background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>New license key — copy and send to the tech:</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <code style={{ flex: 1, fontSize: 16, fontWeight: 700, color: "#22d3ee", letterSpacing: "0.1em", fontFamily: "monospace" }}>
                {issueResult.key}
              </code>
              <button
                style={{ ...s.logoutBtn, color: copied === issueResult.key ? "#4ade80" : "#22d3ee", borderColor: "rgba(34,211,238,0.3)" }}
                onClick={() => copyKey(issueResult.key)}
              >
                {copied === issueResult.key ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 6 }}>
              Expires: {new Date(issueResult.expires).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </div>
          </div>
        )}

        {issueError && <p style={{ ...s.errMsg, marginTop: 8 }}>{issueError}</p>}

        {/* License list */}
        <label style={{ ...s.label, marginTop: 28 }}>
          All Keys ({licenses.length})
        </label>

        {licenses.length === 0 && !licLoading && (
          <div style={{ fontSize: 13, color: "#334155", padding: "12px 0" }}>No license keys yet.</div>
        )}

        {licenses.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {licenses.map((lic) => {
              const expired = new Date(lic.expires_at) < new Date();
              const status  = !lic.active ? "Revoked" : expired ? "Expired" : lic.machine_id ? "Active" : "Unactivated";
              const statusColor = !lic.active ? "#ef4444" : expired ? "#f59e0b" : lic.machine_id ? "#4ade80" : "#64748b";
              return (
                <div key={lic.license_key} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <code style={{ fontSize: 13, fontWeight: 700, color: "#22d3ee", fontFamily: "monospace", letterSpacing: "0.06em" }}>{lic.license_key}</code>
                      <span style={{ fontSize: 11, fontWeight: 600, color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}30`, borderRadius: 5, padding: "1px 7px" }}>{status}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>
                      <strong style={{ color: "#cbd5e1" }}>{lic.tech_name}</strong>
                      {" · "}Expires {new Date(lic.expires_at).toLocaleDateString()}
                      {lic.activated_at && ` · Activated ${new Date(lic.activated_at).toLocaleDateString()}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button style={{ ...s.logoutBtn, color: copied === lic.license_key ? "#4ade80" : "#64748b" }} onClick={() => copyKey(lic.license_key)}>
                      {copied === lic.license_key ? "✓" : "Copy"}
                    </button>
                    {lic.active && (
                      <button style={{ ...s.logoutBtn, color: "#ef4444", borderColor: "rgba(239,68,68,0.2)" }} onClick={() => revokeKey(lic.license_key)}>
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>

      {/* Pending reviews moderation */}
      <div style={{ width: "100%", maxWidth: 700, margin: "0 auto" }}>
      <div style={{ ...s.card, maxWidth: "100%" }}>
        <div style={s.logoRow}>
          <div style={{ flex: 1 }}>
            <div style={s.h1}>Review Moderation</div>
            <div style={s.sub}>Approve or reject submitted reviews before they appear on the landing page</div>
          </div>
          <button style={s.logoutBtn} onClick={loadPendingReviews} disabled={revLoading}>
            {revLoading ? "Loading…" : "⟳ Refresh"}
          </button>
        </div>

        {revError && <p style={{ ...s.errMsg, marginTop: 0, marginBottom: 12 }}>{revError}</p>}

        {pendingReviews.length === 0 && !revLoading ? (
          <div style={{ fontSize: 13, color: "#334155", padding: "12px 0" }}>No pending reviews. 🎉</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pendingReviews.map(r => (
              <div key={r.id} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 16, color: "#facc15", letterSpacing: 2 }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                  <strong style={{ color: "#e2e8f0", fontSize: 14 }}>{r.name}</strong>
                  {r.company && <span style={{ fontSize: 12, color: "#64748b" }}>— {r.company}</span>}
                  <span style={{ fontSize: 11, color: "#475569", marginLeft: "auto" }}>
                    {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>&ldquo;{r.review_text}&rdquo;</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    style={{ ...s.logoutBtn, color: "#4ade80", borderColor: "rgba(74,222,128,0.3)", padding: "6px 16px" }}
                    onClick={() => moderateReview(r.id, true)}
                  >
                    ✓ Approve
                  </button>
                  <button
                    style={{ ...s.logoutBtn, color: "#f87171", borderColor: "rgba(248,113,113,0.3)", padding: "6px 16px" }}
                    onClick={() => moderateReview(r.id, false)}
                  >
                    ✗ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>

    </div>
  );
}

// Inline styles
const s = {
  page: {
    minHeight: "100vh",
    background: "#020617",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "48px 16px",
  } as React.CSSProperties,
  lockCard: {
    background: "#0f172a",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 20,
    padding: "48px 40px 40px",
    width: "100%",
    maxWidth: 380,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    textAlign: "center" as const,
  } as React.CSSProperties,
  lockLogo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    boxShadow: "0 0 0 1px rgba(34,211,238,0.2), 0 0 32px rgba(34,211,238,0.2)",
    marginBottom: 18,
  } as React.CSSProperties,
  lockTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: "#e2e8f0",
  } as React.CSSProperties,
  lockSub: {
    fontSize: 13,
    color: "#475569",
    marginTop: 4,
  } as React.CSSProperties,
  card: {
    background: "#0f172a",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 20,
    padding: "36px 40px",
    width: "100%",
    maxWidth: 580,
  } as React.CSSProperties,
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 28,
  } as React.CSSProperties,
  logo: { width: 44, height: 44, borderRadius: 10 } as React.CSSProperties,
  h1: { fontSize: 20, fontWeight: 700, color: "#e2e8f0" } as React.CSSProperties,
  sub: { fontSize: 13, color: "#64748b", marginTop: 2 } as React.CSSProperties,
  logoutBtn: {
    background: "none",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    color: "#475569",
    fontSize: 12,
    padding: "5px 12px",
    cursor: "pointer",
  } as React.CSSProperties,
  label: {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#475569",
    marginBottom: 6,
    marginTop: 20,
  } as React.CSSProperties,
  input: {
    width: "100%",
    padding: "10px 14px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    color: "#e2e8f0",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  } as React.CSSProperties,
  select: {
    width: "100%",
    padding: "10px 14px",
    background: "#0a1020",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    color: "#e2e8f0",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    cursor: "pointer",
  } as React.CSSProperties,
  drop: {
    border: "2px dashed rgba(255,255,255,0.12)",
    borderRadius: 14,
    padding: "28px 20px",
    textAlign: "center",
    cursor: "pointer",
    transition: "border-color 0.2s, background 0.2s",
    marginTop: 4,
  } as React.CSSProperties,
  dropActive: {
    borderColor: "#22d3ee",
    background: "rgba(34,211,238,0.04)",
  } as React.CSSProperties,
  dropText: { margin: "0 0 4px", fontSize: 14, color: "#94a3b8" } as React.CSSProperties,
  dropHint: { margin: 0, fontSize: 12, color: "#334155" } as React.CSSProperties,
  list: {
    listStyle: "none",
    margin: "14px 0 0",
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  } as React.CSSProperties,
  item: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 10,
    padding: "10px 14px",
  } as React.CSSProperties,
  itemTop: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  } as React.CSSProperties,
  itemName: {
    flex: 1,
    fontSize: 13,
    color: "#cbd5e1",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } as React.CSSProperties,
  itemSize: { fontSize: 12, color: "#334155", flexShrink: 0 } as React.CSSProperties,
  rmBtn: {
    background: "none",
    border: "none",
    color: "#334155",
    cursor: "pointer",
    fontSize: 11,
    padding: "2px 4px",
    flexShrink: 0,
  } as React.CSSProperties,
  badge: (color: string) =>
    ({
      flexShrink: 0,
      fontSize: 11,
      fontWeight: 600,
      color,
      background: `${color}18`,
      border: `1px solid ${color}30`,
      borderRadius: 6,
      padding: "2px 7px",
    } as React.CSSProperties),
  barTrack: {
    height: 3,
    background: "rgba(255,255,255,0.06)",
    borderRadius: 2,
    marginTop: 8,
    overflow: "hidden",
  } as React.CSSProperties,
  barFill: {
    height: "100%",
    background: "#3b82f6",
    borderRadius: 2,
    transition: "width 0.3s ease",
  } as React.CSSProperties,
  resultTitle: {
    margin: "6px 0 0",
    fontSize: 12,
    color: "#475569",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } as React.CSSProperties,
  errLine: { margin: "5px 0 0", fontSize: 12, color: "#ef4444" } as React.CSSProperties,
  errMsg: {
    margin: "6px 0 0",
    fontSize: 12,
    color: "#ef4444",
    background: "rgba(239,68,68,0.07)",
    borderRadius: 6,
    padding: "5px 10px",
    width: "100%",
    boxSizing: "border-box",
    textAlign: "left",
  } as React.CSSProperties,
  btn: {
    display: "block",
    width: "100%",
    marginTop: 24,
    padding: "13px 0",
    background: "#22d3ee",
    color: "#020617",
    border: "none",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  } as React.CSSProperties,
  btnDisabled: {
    background: "#164e63",
    color: "#475569",
    cursor: "not-allowed",
  } as React.CSSProperties,
  summary: {
    marginTop: 20,
    background: "rgba(34,197,94,0.05)",
    border: "1px solid rgba(34,197,94,0.15)",
    borderRadius: 12,
    padding: "14px 16px",
  } as React.CSSProperties,
  code: {
    background: "rgba(255,255,255,0.06)",
    borderRadius: 4,
    padding: "1px 5px",
    fontFamily: "monospace",
    fontSize: 11,
  } as React.CSSProperties,
};
