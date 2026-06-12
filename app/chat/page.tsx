"use client";

import ChatBubble from '../components/ChatBubble';
import React, { useState, useEffect, useRef } from 'react';
import { Gauge } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: string[];
  streaming?: boolean;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    // Snapshot history before mutating state
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

      if (!res.ok || !res.body) {
        throw new Error('Request failed');
      }

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
              if (last?.role === 'assistant') {
                next[next.length - 1] = { ...last, citations: payload.urls };
              }
              return next;
            });
          } else if (payload.type === 'text') {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === 'assistant') {
                next[next.length - 1] = {
                  ...last,
                  content: last.content + payload.text,
                };
              }
              return next;
            });
          } else if (payload.type === 'done') {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === 'assistant') {
                next[next.length - 1] = { ...last, streaming: false };
              }
              return next;
            });
          } else if (payload.type === 'error') {
            throw new Error(payload.message);
          }
        }
      }
    } catch (err) {
      const errorText =
        err instanceof Error ? err.message : 'Error fetching response';
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant') {
          next[next.length - 1] = {
            role: 'assistant',
            content: errorText,
            streaming: false,
          };
        } else {
          next.push({ role: 'assistant', content: errorText });
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNewConversation = () => {
    setMessages([]);
  };

  return (
    <div className="chat-wrapper">
      <header className="chat-header">
        <Gauge size={40} />
        <div>
          <h1>FuelTech AI Pro</h1>
          <p>Your fueling systems assistant</p>
        </div>
        <button
          onClick={handleNewConversation}
          className="new-chat-btn"
          title="Start a new conversation"
        >
          New chat
        </button>
      </header>
      <main className="chat-body">
        {messages.map((msg, idx) => (
          <ChatBubble key={idx} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </main>
      <footer className="chat-footer">
        <form onSubmit={handleSubmit} className="chat-input-container">
          <input
            type="text"
            placeholder="Type your question…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            {loading ? '…' : 'Send'}
          </button>
        </form>
      </footer>
    </div>
  );
}
