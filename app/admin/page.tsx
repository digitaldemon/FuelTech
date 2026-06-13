"use client";

import { useState, useRef, useCallback } from "react";

type FileResult = {
  name: string;
  title: string;
  chunks: number;
  url: string;
};

type UploadState = "idle" | "uploading" | "done" | "error";

const SOURCES = [
  { value: "pei",              label: "PEI" },
  { value: "veeder-root",      label: "Veeder-Root" },
  { value: "gilbarco",         label: "Gilbarco" },
  { value: "gilbarco-extranet",label: "Gilbarco Extranet" },
  { value: "franklin",         label: "Franklin Fueling" },
  { value: "dover",            label: "Dover / Wayne" },
  { value: "manual",           label: "Other / Manual" },
];

export default function AdminUpload() {
  const [secret, setSecret] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("ft_admin_secret") ?? "" : ""
  );
  const [source, setSource] = useState("pei");
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<UploadState>("idle");
  const [results, setResults] = useState<FileResult[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const pdfs = Array.from(incoming).filter((f) => f.type === "application/pdf" || f.name.endsWith(".pdf"));
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...pdfs.filter((f) => !names.has(f.name))];
    });
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, []);

  const removeFile = (name: string) =>
    setFiles((prev) => prev.filter((f) => f.name !== name));

  const upload = async () => {
    if (!secret.trim()) { setError("Enter the admin secret first."); return; }
    if (!files.length)  { setError("Add at least one PDF."); return; }

    localStorage.setItem("ft_admin_secret", secret);
    setState("uploading");
    setError("");
    setResults([]);

    const form = new FormData();
    form.append("source", source);
    for (const f of files) form.append("file", f);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "x-admin-secret": secret },
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setResults(json.files ?? []);
      setTotalChunks(json.total_chunks ?? 0);
      setState("done");
      setFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.h1}>FuelTech Admin</h1>
          <p style={styles.sub}>PDF Knowledge Base Upload</p>
        </div>

        {/* Auth */}
        <label style={styles.label}>Admin Secret</label>
        <input
          type="password"
          style={styles.input}
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Admin secret key"
          autoComplete="current-password"
        />

        {/* Source */}
        <label style={styles.label}>Document Source</label>
        <select
          style={styles.select}
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          {SOURCES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {/* Drop zone */}
        <label style={styles.label}>PDF Files</label>
        <div
          style={{
            ...styles.dropzone,
            ...(dragging ? styles.dropzoneActive : {}),
          }}
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
          <div style={styles.dropIcon}>📄</div>
          <p style={styles.dropText}>
            Drag &amp; drop PDFs here, or <span style={styles.dropLink}>browse</span>
          </p>
          <p style={styles.dropHint}>Multiple files supported</p>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <ul style={styles.fileList}>
            {files.map((f) => (
              <li key={f.name} style={styles.fileItem}>
                <span style={styles.fileName}>{f.name}</span>
                <span style={styles.fileSize}>{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                <button style={styles.removeBtn} onClick={() => removeFile(f.name)}>✕</button>
              </li>
            ))}
          </ul>
        )}

        {error && <p style={styles.errorMsg}>{error}</p>}

        {/* Upload button */}
        <button
          style={{
            ...styles.uploadBtn,
            ...(state === "uploading" ? styles.uploadBtnDisabled : {}),
          }}
          disabled={state === "uploading"}
          onClick={upload}
        >
          {state === "uploading" ? "Uploading & processing…" : `Upload ${files.length ? `${files.length} PDF${files.length > 1 ? "s" : ""}` : "PDFs"}`}
        </button>

        {/* Results */}
        {state === "done" && results.length > 0 && (
          <div style={styles.results}>
            <p style={styles.resultsHeader}>
              ✅ Done &mdash; <strong>{totalChunks.toLocaleString()} chunks</strong> added to the knowledge base
            </p>
            <ul style={styles.resultList}>
              {results.map((r) => (
                <li key={r.name} style={styles.resultItem}>
                  <span style={styles.resultTitle}>{r.title || r.name}</span>
                  <span style={styles.resultChunks}>{r.chunks} chunks</span>
                </li>
              ))}
            </ul>
            <p style={styles.resultsNote}>
              Figures will be extracted automatically during the next backfill run.
              To trigger it now, call:{" "}
              <code style={styles.code}>
                POST /api/scrape &nbsp;&#123; &quot;source&quot;: &quot;figures&quot;, &quot;recheck&quot;: true, &quot;limit&quot;: 8 &#125;
              </code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#020617",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "48px 16px",
  },
  card: {
    background: "#0f172a",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 20,
    padding: "36px 40px",
    width: "100%",
    maxWidth: 580,
  },
  header: { marginBottom: 28 },
  h1: { margin: 0, fontSize: 24, fontWeight: 700, color: "#e2e8f0" },
  sub: { margin: "6px 0 0", fontSize: 14, color: "#64748b" },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.07em",
    color: "#64748b",
    marginBottom: 6,
    marginTop: 20,
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    color: "#e2e8f0",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box" as const,
  },
  select: {
    width: "100%",
    padding: "10px 14px",
    background: "#0f172a",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    color: "#e2e8f0",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box" as const,
    cursor: "pointer",
  },
  dropzone: {
    border: "2px dashed rgba(255,255,255,0.15)",
    borderRadius: 14,
    padding: "32px 20px",
    textAlign: "center" as const,
    cursor: "pointer",
    transition: "border-color 0.2s, background 0.2s",
    marginTop: 4,
  },
  dropzoneActive: {
    borderColor: "#22d3ee",
    background: "rgba(34,211,238,0.05)",
  },
  dropIcon: { fontSize: 36, marginBottom: 10 },
  dropText: { margin: "0 0 4px", fontSize: 14, color: "#94a3b8" },
  dropLink: { color: "#22d3ee", textDecoration: "underline" },
  dropHint: { margin: 0, fontSize: 12, color: "#475569" },
  fileList: {
    listStyle: "none",
    margin: "14px 0 0",
    padding: 0,
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  fileItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 13,
  },
  fileName: { flex: 1, color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  fileSize: { color: "#475569", flexShrink: 0 },
  removeBtn: {
    background: "none",
    border: "none",
    color: "#475569",
    cursor: "pointer",
    fontSize: 12,
    padding: "2px 4px",
    flexShrink: 0,
  },
  errorMsg: {
    margin: "12px 0 0",
    fontSize: 13,
    color: "#f87171",
    background: "rgba(248,113,113,0.08)",
    border: "1px solid rgba(248,113,113,0.2)",
    borderRadius: 8,
    padding: "8px 12px",
  },
  uploadBtn: {
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
    transition: "background 0.2s",
  },
  uploadBtnDisabled: {
    background: "#164e63",
    color: "#94a3b8",
    cursor: "not-allowed",
  },
  results: {
    marginTop: 24,
    background: "rgba(34,197,94,0.05)",
    border: "1px solid rgba(34,197,94,0.2)",
    borderRadius: 12,
    padding: "16px 18px",
  },
  resultsHeader: { margin: "0 0 12px", fontSize: 14, color: "#86efac" },
  resultList: { listStyle: "none", margin: "0 0 12px", padding: 0, display: "flex", flexDirection: "column" as const, gap: 6 },
  resultItem: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "#cbd5e1" },
  resultTitle: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, marginRight: 12 },
  resultChunks: { color: "#64748b", flexShrink: 0 },
  resultsNote: { margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.6 },
  code: { background: "rgba(255,255,255,0.06)", borderRadius: 4, padding: "2px 6px", fontFamily: "monospace", fontSize: 11 },
};
