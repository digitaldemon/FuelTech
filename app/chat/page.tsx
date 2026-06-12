"use client";

import ChatBubble from '../components/ChatBubble';
import React, { useState, useEffect, useRef } from 'react';
import { Gauge } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: string[];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Pass the thread ID so the assistant retains conversation context.
        body: JSON.stringify({ message: question, threadId }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Request failed');
      }

      // Persist the thread ID for the remainder of this conversation.
      if (data.threadId) setThreadId(data.threadId);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply || 'No response',
          citations: data.citations,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error fetching response';
      setMessages((prev) => [...prev, { role: 'assistant', content: message }]);
    } finally {
      setLoading(false);
    }
  };

  const handleNewConversation = () => {
    setMessages([]);
    setThreadId(null);
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
        {loading && (
          <div className="chat-bubble-container">
            <div className="chat-bubble assistant thinking">Thinking…</div>
          </div>
        )}
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
