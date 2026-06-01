"use client";

import ChatBubble from '../components/ChatBubble';
import React, { useState, useEffect, useRef } from 'react';
// Use a gauge icon to represent FuelTech in the chat header instead of a static logo image.
import { Gauge } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * ChatPage renders the full‑screen chat experience. It includes a header with
 * branding, a scrollable body that displays messages and a fixed footer with
 * an input form. Messages scroll automatically to the bottom as new content
 * arrives. The API interaction mirrors the original implementation: user
 * messages are appended immediately and the assistant reply is fetched from
 * `/api/chat`. Errors are gracefully handled by showing an error message.
 */
export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isAuth = typeof window !== 'undefined' && localStorage.getItem('authenticated');
    if (!isAuth) {
      window.location.href = '/login';
    }
  }, []);

  // Auto‑scroll to the bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const question = input.trim();
    if (!question) return;
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setInput('');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question }),
      });
      const data = await res.json();
      const reply = data.reply || 'No response';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Error fetching response' },
      ]);
    }
  };

  return (
    <div className="chat-wrapper">
      <header className="chat-header">
        <Gauge size={40} />
        <div>
          <h1>FuelTech AI Pro</h1>
          <p>Your fueling systems assistant</p>
        </div>
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
          />
          <button type="submit">Send</button>
        </form>
      </footer>
    </div>
  );
}