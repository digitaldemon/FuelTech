"use client";

import { useState, useRef, useCallback } from "react";
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

function getSecret(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("ft_admin_secret") ?? "";
}

export default function AdminUpload() {
  const [secret, setSecret] = useState(getSecret);
  const [source, setSource] = useState("pei");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [authError, setAuthError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (!secret.trim()) { setAuthError("Enter the admin secret."); return; }
    const idle = entries.filter((e) => e.phase === "idle");
    if (!idle.length) return;

    localStorage.setItem("ft_admin_secret", secret);
    setAuthError("");
    setRunning(true);

    for (const entry of idle) {
      const { file } = entry;

      // ── Phase 1: upload directly to Vercel Blob CDN ──
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

      // ── Phase 2: extract text, chunk, embed ──
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

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logoRow}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" style={s.logo} />
          <div>
            <div style={s.h1}>FuelTech Admin</div>
            <div style={s.sub}>PDF Knowledge Base Upload</div>
          </div>
        </div>

        {/* Auth */}
        <label style={s.label}>Admin Secret</label>
        <input
          type="password"
          style={s.input}
          value={secret}
          onChange={(e) => { setSecret(e.target.value); setAuthError(""); }}
          placeholder="Paste admin secret key"
          autoComplete="current-password"
        />
        {authError && <p style={s.errMsg}>{authError}</p>}

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
                {(e.phase === "uploading") && (
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
  );
}

// Inline styles (no class name collisions with main app)
const s = {
  page: {
    minHeight: "100vh",
    background: "#020617",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "48px 16px",
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
