"use client";

import ChatBubble from '../components/ChatBubble';
import React, { useState, useEffect, useRef } from 'react';

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
}

const EQUIPMENT_MODELS = [
  'Encore 700', 'Encore 500', 'Eclipse', 'CRIND', 'FlexPay IV',
  'TLS-450PLUS', 'TLS-450', 'TLS-350', 'TLS-300', 'Red Jacket', 'FE Petro',
];

// partial: true = pre-fills input so user can type (e.g. error code)
// partial: false = submits immediately when model is selected
const SUGGESTED_PROMPTS: { label: string; build: (model: string) => string; partial?: boolean }[] = [
  {
    label: 'Error code lookup',
    build: (m) => m ? `What does error code  mean on the ${m}?` : '',
    partial: true, // user must type the code number between "code " and " mean"
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [modelPrompt, setModelPrompt] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const modelSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (question: string) => {
    if (!question.trim() || loading) return;
    const history = messages.map(({ role, content }) => ({ role, content }));

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: question },
      { role: 'assistant', content: '', streaming: true },
    ]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, history }),
      });

      if (!res.ok || !res.body) throw new Error('Request failed');

      const reader = res.body.getReader();
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
          const payload = JSON.parse(line.slice(6));

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
    sendMessage(input.trim());
  };

  const handleChip = (prompt: { label: string; build: (m: string) => string; partial?: boolean }) => {
    if (!selectedModel) {
      // All chips require a model — flash the selector
      setModelPrompt(true);
      modelSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setTimeout(() => setModelPrompt(false), 2500);
      return;
    }
    const text = prompt.build(selectedModel);
    if (prompt.partial) {
      // Pre-fill the template and position cursor where the code goes
      setInput(text);
      setTimeout(() => {
        if (inputRef.current) {
          // Place cursor after "error code " so the tech types the code right there
          const pos = text.indexOf('  mean') + 1; // one space after "code"
          inputRef.current.focus();
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

  return (
    <div className="chat-wrapper">
      <header className="chat-header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="FuelTech AI Pro" className="chat-header-logo" />
        <div>
          <h1>FuelTech AI Pro</h1>
          <p>Your fueling systems assistant</p>
        </div>
        <button type="button" onClick={() => { setMessages([]); setInput(''); setSelectedModel(''); }} className="new-chat-btn" title="Start a new conversation">
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
      </header>

      <main className="chat-body">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <div className="chat-welcome-title">What do you need help with?</div>

            {/* Equipment model selector */}
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

            {/* Suggested prompt chips */}
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
          </div>
        )}

        {/* Show model badge in input area if one is selected and chat has started */}
        {messages.length > 0 && (
          <div className="chat-messages">
            {messages.map((msg, idx) => (
              <ChatBubble key={idx} message={msg} figures={msg.figures} />
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      <footer className="chat-footer">
        {selectedModel && (
          <div className="chat-active-model">
            <span>Model: <strong>{selectedModel}</strong></span>
            <button type="button" onClick={() => setSelectedModel('')} className="chat-active-model-clear">✕</button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="chat-input-container">
          <input
            ref={inputRef}
            type="text"
            placeholder={selectedModel ? `Ask about ${selectedModel}…` : 'Ask a question or pick one above…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button type="submit" disabled={loading || !input.trim()}>
            {loading ? '…' : 'Send'}
          </button>
        </form>
      </footer>
    </div>
  );
}
