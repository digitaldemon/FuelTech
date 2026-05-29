'use client';

import ChatBubble from '../components/ChatBubble';
import React, { useState, useEffect } from 'react';

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


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question) return;
    // Add user message
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
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Error fetching response' }]);
    }
  };

  return (
<div className="min-h-screen flex flex-col bg-gray-50">
  <header className="bg-white shadow p-4 flex items-center">
 <img src="/logo.png" alt="FuelTech" className="h-8 w-8 mr-2" />-2" />
    <h1 className="text-lg font-semibold">FuelTech AI Pro</h1>
    <span className="ml-auto text-sm text-gray-500">Your fueling systems assistant</span>
  </header>
  <main className="flex-1 overflow-y-auto p-4 space-y-2">
    {messages.map((msg, idx) => (
        <ChatBubble key={idx} message={msg} />
   ))}<
  </main>
  <footer className="p-4 bg-white shadow">
    <form onSubmit={handleSubmit} className="flex">
      <input
        className="flex-1 border border-gray-300 rounded-l px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Type your question…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded-r hover:bg-blue-700"
      >
        Send
      </button>
    </form>
  </footer>
</div> 
  );
}
