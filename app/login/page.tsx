"use client";

import { useState } from 'react';

// Simple in‑memory user credentials. In a real application this should be
// replaced by a proper authentication mechanism.
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
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
    <div className="login-wrapper">
      <div className="login-card">
        <h1>Sign in</h1>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit">Login</button>
        </form>
      </div>
    </div>
  );
}