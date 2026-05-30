'use client';

import ChatBubble from '../components/ChatBubble';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import logoImg from '../../public/logo.png';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    const isAuth = localStorage.getItem('authenticated');
    if (!isAuth) {
      window.location.href = '/login';
    }
  }, []);

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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto flex flex-col min-h-screen">
        <header className="bg-gradient-to-r from-blue-600 to-teal-500 text-white p-6 flex items-center rounded-b-md">
          <Image src={logoImg} alt="FuelTech Logo" width={64} height={64} className="h-16 w-16 mr-4" />
          <div>
            <h1 className="text-3xl font-bold">FuelTech AI Pro</h1>
            <p className="text-sm">Your fueling systems assistant</p>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, idx) => (
            <ChatBubble key={idx} message={msg} />
          ))}
        </main>
        <footer className="bg-white shadow-md p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              className="flex-1 border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Type your question…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Send
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
}
