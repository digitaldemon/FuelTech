"use client";

import { useState } from 'react';

const ALLOWED_USERS: { [key: string]: string } = {
  tech1: 'password123',
  tech2: 'password456',
  bill: 'hercules',
  tauny: 'wsk',
  jesse: 'wsk',
};

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: any) => {
    e.preventDefault();
    if (ALLOWED_USERS[username] && ALLOWED_USERS[username] === password) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('authenticated', 'true');
        window.location.href = '/chat';
      }
    } else {
      setError('Invalid username or password.');
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Login</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ padding: '0.5rem', width: '100%' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: '0.5rem', width: '100%' }}
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" style={{ padding: '0.5rem 1rem' }}>
          Login
        </button>
      </form>
    </div>
  );
}
