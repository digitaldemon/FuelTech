"use client";

import ChatBubble from '../components/ChatBubble';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Footprints, Camera, Sun, Moon } from 'lucide-react';

function FaqModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="faq-overlay" onClick={onClose}>
      <div className="faq-modal" onClick={(e) => e.stopPropagation()}>
        <div className="faq-header">
          <span className="faq-title">FuelTech AI Pro — User Guide</span>
          <button className="faq-close" onClick={onClose}>✕</button>
        </div>
        <div className="faq-body">

          <div className="faq-section">
            <div className="faq-section-title">What is this?</div>
            <p>FuelTech AI Pro is an AI assistant trained on Gilbarco, Veeder-Root, Franklin Fueling, Wayne/Tokheim, Red Jacket, and PEI documentation. Ask it anything you&apos;d normally look up in a service manual — error codes, procedures, wiring, programming, compliance, and more.</p>
          </div>

          <div className="faq-section">
            <div className="faq-section-title">Equipment Selector</div>
            <p>Tap a model chip (Encore 700, TLS-450PLUS, etc.) before asking a question. This tells the assistant exactly which equipment you&apos;re working on and makes answers more specific and accurate. You can clear your selection with the ✕ that appears next to your chosen model.</p>
          </div>

          <div className="faq-section">
            <div className="faq-section-title">Quick Questions</div>
            <p>The shortcut chips (Error code lookup, Startup procedure, etc.) auto-build a question for your selected equipment. Tap one and it either sends immediately or pre-fills the input so you can add a specific code or detail.</p>
          </div>

          <div className="faq-section">
            <div className="faq-section-title">Guided Mode</div>
            <p>Toggle <strong style={{ color: '#22d3ee' }}>Guided</strong> in the header to enable step-by-step mode. Instead of giving you the full procedure at once, the assistant presents one step at a time and waits for you to confirm before continuing. Use the <strong>Next step →</strong> button to advance hands-free. Ideal when you&apos;re actively working on equipment.</p>
          </div>

          <div className="faq-section">
            <div className="faq-section-title">Sources</div>
            <p>Every assistant response shows the exact documentation it pulled from under a <strong>Sources</strong> section. Click any document title to open the original PDF or page. Use this to verify steps or read the full context before performing work on live equipment.</p>
          </div>

          <div className="faq-section">
            <div className="faq-section-title">Chat History</div>
            <p>Your conversation is automatically saved on this device. If you close the browser or refresh the page, your chat picks up exactly where you left off. Press <strong>New chat</strong> in the header to start a fresh session and clear the history.</p>
          </div>

          <div className="faq-section">
            <div className="faq-section-title">ATG Direct Connect</div>
            <p>The <strong>TLS-450PLUS Direct Connect</strong> tool lets you connect to an ATG directly from your browser — no extra software required. Access it from the <strong>🔌 TLS</strong> button in the header or the Field Tools card on this screen.</p>
            <p style={{ marginTop: 10 }}><strong>RS-232 Serial</strong> — Connect a USB-to-RS-232 adapter from your laptop to the ATG computer port (DB9/DB25). Requires <strong>Chrome or Edge</strong> on a desktop or laptop. One-click quick actions pull a full year of alarm history and the complete console setup report, then save them as a PDF for environmental compliance documentation.</p>
            <p style={{ marginTop: 10 }}><strong>Ethernet</strong> — Enter the ATG&apos;s IP address to open its built-in web interface directly in a new browser tab. The ATG must be on the same local network as your PC.</p>
            <p style={{ marginTop: 10 }}><strong>Works offline.</strong> Once you&apos;ve visited the Direct Connect page with internet, it caches itself and works without a connection — serial port commands, quick actions, and PDF saving all function normally. Click &quot;Save PDF&quot; once while online to cache the PDF library for offline use. The AI command interpreter requires internet; use raw VR codes offline (e.g. <code style={{ fontFamily: 'Consolas, monospace', fontSize: 12, background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 4 }}>I20100</code>).</p>
          </div>

          <div className="faq-section">
            <div className="faq-section-title">Tips for best results</div>
            <div className="faq-tip"><span className="faq-tip-icon">🎯</span><span>Always select your equipment model first — the TLS-450PLUS and TLS-350 have different procedures for the same task.</span></div>
            <div className="faq-tip"><span className="faq-tip-icon">🔢</span><span>Include the exact error code when asking about faults (e.g. &quot;Error 0A02 on TLS-450PLUS&quot;) for the most precise answer.</span></div>
            <div className="faq-tip"><span className="faq-tip-icon">🔧</span><span>Use Guided Mode for complex multi-step jobs so you don&apos;t lose your place or skip a step under pressure.</span></div>
            <div className="faq-tip"><span className="faq-tip-icon">⚠️</span><span>Always verify critical procedures against official manufacturer documentation before performing work. AI can make mistakes.</span></div>
          </div>

        </div>
      </div>
    </div>
  );
}

interface SourceDoc {
  url: string;
  title: string;
  source: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: string[];
  docs?: SourceDoc[];
  figures?: string[];
  streaming?: boolean;
  imagePreview?: string; // data URL shown in the bubble
}

interface PendingImage {
  base64: string;
  mediaType: string;
  preview: string; // data URL for display
}

function compressImage(file: File): Promise<PendingImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 1120;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve({ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg', preview: dataUrl });
    };
    img.onerror = reject;
    img.src = objectUrl;
  });
}

const HISTORY_KEY = 'ft_chat_history';
const GUIDED_KEY  = 'ft_guided_mode';
const LANG_KEY    = 'ft_lang';
const MAX_STORED  = 60;


function loadHistory(): Message[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Message[];
    // Strip any stale streaming flags
    return parsed.map((m) => ({ ...m, streaming: false }));
  } catch {
    return [];
  }
}

function saveHistory(msgs: Message[]) {
  if (typeof window === 'undefined') return;
  try {
    const toSave = msgs
      .filter((m) => !m.streaming)
      .slice(-MAX_STORED)
      .map((m) => ({ role: m.role, content: m.content, docs: m.docs, figures: m.figures }));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(toSave));
  } catch { /* storage full — skip */ }
}

const EQUIPMENT_MODELS = [
  'Encore 700', 'Encore 500', 'Eclipse', 'CRIND', 'FlexPay IV',
  'TLS-450PLUS', 'TLS-450', 'TLS-350', 'TLS-300', 'Red Jacket', 'FE Petro',
];

const SUGGESTED_PROMPTS: { label: string; build: (model: string) => string; partial?: boolean }[] = [
  {
    label: 'Error code lookup',
    build: (m) => m ? `What does error code  mean on the ${m}?` : '',
    partial: true,
  },
  {
    label: 'Startup procedure',
    build: (m) => m ? `Walk me through the complete startup procedure for the ${m}` : 'Walk me through the complete startup procedure for ',
  },
  {
    label: 'Clear an alarm',
    build: (m) => m ? `How do I clear active alarms on the ${m}?` : 'How do I clear active alarms on ',
  },
  {
    label: 'Programming mode',
    build: (m) => m ? `How do I access programming mode on the ${m}?` : 'How do I access programming mode on ',
  },
  {
    label: 'Wiring & install',
    build: (m) => m ? `What are the wiring and installation requirements for the ${m}?` : 'What are the wiring and installation requirements for ',
  },
  {
    label: 'Communication setup',
    build: (m) => m ? `How do I configure communications on the ${m}?` : 'How do I configure communications on ',
  },
  {
    label: 'EMV upgrade',
    build: (m) => m ? `What are the EMV upgrade steps and requirements for the ${m}?` : 'What are the EMV upgrade steps for ',
  },
  {
    label: 'Probe / sensor install',
    build: (m) => m ? `How do I install and configure a probe or sensor on the ${m}?` : 'How do I install a probe on ',
  },
];

export default function ChatPage() {
  const [messages, setMessages]       = useState<Message[]>([]);
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [modelPrompt, setModelPrompt] = useState(false);
  const [guidedMode, setGuidedMode]   = useState(false);
  const [showFaq, setShowFaq]         = useState(false);
  const [hydrated, setHydrated]       = useState(false);
  const [username, setUsername]       = useState('');
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [lang, setLang] = useState<'en' | 'es'>('en');
  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const inputRef        = useRef<HTMLInputElement>(null);
  const modelSectionRef = useRef<HTMLDivElement>(null);
  const imageInputRef   = useRef<HTMLInputElement>(null);

  // Hydrate from localStorage after first render
  useEffect(() => {
    const saved = loadHistory();
    if (saved.length > 0) setMessages(saved);
    const savedGuided = localStorage.getItem(GUIDED_KEY);
    if (savedGuided === 'true') setGuidedMode(true);
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.username) {
          setUsername(d.username);
        } else if (d.expired) {
          window.location.href = '/expired';
        } else {
          window.location.href = '/login';
        }
      })
      .catch(() => { window.location.href = '/login'; });
    const savedTheme = localStorage.getItem('ft_theme') as 'dark' | 'light' | null;
    if (savedTheme) setTheme(savedTheme);
    const savedLang = localStorage.getItem(LANG_KEY) as 'en' | 'es' | null;
    if (savedLang) setLang(savedLang);
    setHydrated(true);
  }, []);

  // Persist messages whenever they change (after hydration)
  useEffect(() => {
    if (!hydrated) return;
    saveHistory(messages);
  }, [messages, hydrated]);

  // Persist guided mode preference
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(GUIDED_KEY, String(guidedMode));
  }, [guidedMode, hydrated]);

  // Persist language preference
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(LANG_KEY, lang);
  }, [lang, hydrated]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (question: string) => {
    if ((!question.trim() && !pendingImage) || loading) return;
    const history = messages.map(({ role, content }) => ({ role, content }));
    const image = pendingImage;

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: question, imagePreview: image?.preview },
      { role: 'assistant', content: '', streaming: true },
    ]);
    setInput('');
    setPendingImage(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question || 'Please analyze this image.',
          history,
          guidedMode,
          lang,
          ...(image ? { imageBase64: image.base64, imageMediaType: image.mediaType } : {}),
        }),
      });

      if (res.status === 401) { window.location.href = '/login'; return; }
      if (res.status === 403) { window.location.href = '/expired'; return; }
      if (!res.ok || !res.body) throw new Error('Request failed');

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let payload: any;
          try { payload = JSON.parse(line.slice(6)); } catch { continue; }

          if (payload.type === 'sources') {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === 'assistant') next[next.length - 1] = { ...last, citations: payload.urls, docs: payload.docs ?? [] };
              return next;
            });
          } else if (payload.type === 'figures') {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === 'assistant') next[next.length - 1] = { ...last, figures: payload.urls };
              return next;
            });
          } else if (payload.type === 'text') {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === 'assistant') next[next.length - 1] = { ...last, content: last.content + payload.text };
              return next;
            });
          } else if (payload.type === 'done') {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === 'assistant') next[next.length - 1] = { ...last, streaming: false };
              return next;
            });
          } else if (payload.type === 'error') {
            throw new Error(payload.message);
          }
        }
      }
    } catch (err) {
      const errorText = err instanceof Error ? err.message : 'Error fetching response';
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant') {
          next[next.length - 1] = { role: 'assistant', content: errorText, streaming: false };
        } else {
          next.push({ role: 'assistant', content: errorText });
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (input.trim() || pendingImage) sendMessage(input.trim());
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setPendingImage(compressed);
    } catch {
      // ignore — file picker stays closed
    }
  };

  const handleChip = (prompt: { label: string; build: (m: string) => string; partial?: boolean }) => {
    if (!selectedModel) {
      setModelPrompt(true);
      modelSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setTimeout(() => setModelPrompt(false), 2500);
      return;
    }
    const text = prompt.build(selectedModel);
    if (prompt.partial) {
      setInput(text);
      inputRef.current?.focus();
      setTimeout(() => {
        if (inputRef.current) {
          const pos = text.indexOf('  mean') + 1;
          inputRef.current.setSelectionRange(pos, pos);
        }
      }, 0);
    } else {
      sendMessage(text);
    }
  };

  const handleModelSelect = (model: string) => {
    setSelectedModel((prev) => (prev === model ? '' : model));
    setModelPrompt(false);
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('ft_theme', next);
    document.documentElement.setAttribute('data-theme', next === 'light' ? 'light' : '');
  };

  const clearChat = () => {
    setMessages([]);
    setInput('');
    setSelectedModel('');
    localStorage.removeItem(HISTORY_KEY);
  };

  const lastMsg = messages[messages.length - 1];
  const showNextStep = guidedMode && !loading && lastMsg?.role === 'assistant' && !lastMsg.streaming;

  return (
    <div className="chat-wrapper">
      {showFaq && <FaqModal onClose={() => setShowFaq(false)} />}
      <header className="chat-header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="FuelTech AI Pro" className="chat-header-logo" />
        <div>
          <h1>FuelTech AI Pro</h1>
          <p>Your fueling systems assistant</p>
        </div>

        <div className="chat-header-actions">
          <button
            type="button"
            className="chat-theme-btn"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button
            type="button"
            className={`guided-mode-btn${lang === 'es' ? ' active' : ''}`}
            onClick={() => setLang((l) => (l === 'en' ? 'es' : 'en'))}
            title={lang === 'en' ? 'Cambiar a español / Switch to Spanish' : 'Switch to English / Volver a inglés'}
          >
            <span className="guided-label">{lang === 'en' ? 'EN' : 'ES'}</span>
            {lang === 'es' && <span className="guided-mode-dot" />}
          </button>
          <button
            type="button"
            onClick={() => setGuidedMode((v) => !v)}
            className={`guided-mode-btn${guidedMode ? ' active' : ''}`}
            title={guidedMode ? 'Guided mode on — click to turn off' : 'Turn on step-by-step guided mode'}
          >
            <Footprints size={14} />
            <span className="guided-label">Guided</span>
            {guidedMode && <span className="guided-mode-dot" />}
          </button>
          <Link
            href="/tls"
            className="chat-tls-btn"
            title="TLS-450PLUS Direct Connect — pull alarm history and console setup via RS-232"
          >
            🔌 TLS
          </Link>
          <Link
            href="/updates"
            className="chat-tls-btn"
            title="Platform updates & release notes"
          >
            What&apos;s New
          </Link>
          <button
            type="button"
            className="chat-help-btn"
            title="User guide & FAQ"
            onClick={() => setShowFaq(true)}
          >
            ?
          </button>
          <button type="button" onClick={clearChat} className="new-chat-btn" title="Start a new conversation">
            New chat
          </button>
          <button
            type="button"
            className="logout-btn"
            title="Sign out"
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/login';
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="chat-body">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <div className="chat-welcome-title">What do you need help with?</div>

            <div ref={modelSectionRef}>
              <div className={`chat-model-label${modelPrompt ? ' chat-model-label-warn' : ''}`}>
                {modelPrompt ? '⚠ Select your equipment first' : 'Select equipment'}
              </div>
              <div className={`chat-model-chips${modelPrompt ? ' chat-model-chips-warn' : ''}`}>
                {EQUIPMENT_MODELS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`chat-model-chip${selectedModel === m ? ' active' : ''}`}
                    onClick={() => handleModelSelect(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="chat-prompt-label" style={{ marginTop: 20 }}>
              Quick questions {!selectedModel && <span className="chat-prompt-hint">(select equipment above for best results)</span>}
            </div>
            <div className="chat-prompt-chips">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className={`chat-prompt-chip${p.partial ? ' chat-prompt-chip-partial' : ''}`}
                  onClick={() => handleChip(p)}
                >
                  {p.label}
                  {p.partial && <span className="chat-prompt-chip-tag">type code</span>}
                </button>
              ))}
            </div>

            <div className="chat-prompt-label" style={{ marginTop: 28 }}>
              Field Tools
            </div>
            <div className="chat-field-tools">
              <Link href="/tls" className="chat-field-tool-card">
                <div className="chat-field-tool-icon">🔌</div>
                <div>
                  <div className="chat-field-tool-name">TLS-450PLUS Direct Connect</div>
                  <div className="chat-field-tool-desc">
                    RS-232 serial connection — pull alarm history and console setup for environmental reporting
                  </div>
                </div>
                <span className="chat-field-tool-arrow">→</span>
              </Link>
            </div>
          </div>
        )}

        {messages.length > 0 && (
          <div className="chat-messages">
            {messages.map((msg, idx) => (
              <ChatBubble key={idx} message={msg} figures={msg.figures} username={username} />
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      <footer className="chat-footer">
        {guidedMode && (
          <div className="guided-mode-banner">
            <Footprints size={13} />
            <span>Guided mode — the assistant will walk you through one step at a time</span>
          </div>
        )}
        {selectedModel && (
          <div className="chat-active-model">
            <span>Model: <strong>{selectedModel}</strong></span>
            <button type="button" onClick={() => setSelectedModel('')} className="chat-active-model-clear">✕</button>
          </div>
        )}
        {showNextStep && (
          <button
            type="button"
            className="next-step-btn"
            onClick={() => sendMessage("Ready, continue to the next step.")}
          >
            Next step →
          </button>
        )}
        {pendingImage && (
          <div className="chat-image-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pendingImage.preview} alt="Attached" />
            <button type="button" className="chat-image-preview-remove" onClick={() => { setPendingImage(null); if (imageInputRef.current) imageInputRef.current.value = ''; }}>✕</button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="chat-input-container">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleImageSelect}
          />
          <button
            type="button"
            className={`chat-camera-btn${pendingImage ? ' has-image' : ''}`}
            onClick={() => imageInputRef.current?.click()}
            title="Attach a photo"
          >
            <Camera size={18} />
          </button>
          <input
            ref={inputRef}
            type="text"
            placeholder={pendingImage ? 'Describe the issue or tap Send to analyze…' : guidedMode ? 'Describe what you see or type a question…' : selectedModel ? `Ask about ${selectedModel}…` : 'Ask a question or pick one above…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button type="submit" disabled={loading || (!input.trim() && !pendingImage)}>
            {loading ? '…' : 'Send'}
          </button>
        </form>
        <p className="chat-disclaimer">
          AI responses are for reference only. Always verify procedures against official manufacturer documentation before performing any work. Not a substitute for professional judgment or certified technician guidance.
        </p>
      </footer>
    </div>
  );
}
