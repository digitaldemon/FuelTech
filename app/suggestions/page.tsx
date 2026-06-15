'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Status = 'open' | 'planned' | 'in_progress' | 'done';
type Category = 'feature' | 'improvement' | 'bug' | 'other';

interface Suggestion {
  id: string;
  username: string;
  title: string;
  body: string;
  category: Category;
  status: Status;
  created_at: string;
}

const CATEGORY_LABELS: Record<Category, string> = {
  feature:     'Feature Request',
  improvement: 'Improvement',
  bug:         'Bug Report',
  other:       'Other',
};

const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  open:        { label: 'Open',        color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  planned:     { label: 'Planned',     color: '#22d3ee', bg: 'rgba(34,211,238,0.1)'  },
  in_progress: { label: 'In Progress', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  done:        { label: 'Done',        color: '#4ade80', bg: 'rgba(74,222,128,0.1)'  },
};

const CATEGORY_META: Record<Category, { color: string; bg: string }> = {
  feature:     { color: '#22d3ee', bg: 'rgba(34,211,238,0.08)'  },
  improvement: { color: '#a78bfa', bg: 'rgba(167,139,250,0.08)' },
  bug:         { color: '#f87171', bg: 'rgba(248,113,113,0.08)' },
  other:       { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' },
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)   return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function SuggestionsPage() {
  const [username, setUsername]   = useState<string | null>(null);
  const [authed, setAuthed]       = useState<boolean | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<Category | 'all'>('all');

  // Form state
  const [title, setTitle]         = useState('');
  const [body, setBody]           = useState('');
  const [category, setCategory]   = useState<Category>('feature');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      const me = await fetch('/api/auth/me').then(r => r.json()).catch(() => ({}));
      if (!me.username) { setAuthed(false); setLoading(false); return; }
      setUsername(me.username);
      setAuthed(true);
      const data = await fetch('/api/suggestions').then(r => r.json()).catch(() => ({}));
      setSuggestions(data.suggestions ?? []);
      setLoading(false);
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (!title.trim() || !body.trim()) { setSubmitError('Please fill in both fields.'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), category }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error ?? 'Something went wrong.'); return; }
      setSuggestions(prev => [data.suggestion, ...prev]);
      setTitle(''); setBody(''); setCategory('feature');
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 4000);
    } catch {
      setSubmitError('Network error — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const visible = filter === 'all' ? suggestions : suggestions.filter(s => s.category === filter);

  if (authed === false) {
    return (
      <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>Sign in to view suggestions</div>
          <div style={{ fontSize: 14, color: '#64748b', marginBottom: 28 }}>You need an active FuelTech AI Pro account to submit or view feature suggestions.</div>
          <Link href="/login" style={{ background: '#22d3ee', color: '#020617', fontWeight: 700, fontSize: 14, padding: '11px 28px', borderRadius: 10, textDecoration: 'none' }}>Sign In →</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#e2e8f0', fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <Link href="/chat" style={{ color: '#64748b', textDecoration: 'none', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, transition: 'color .15s' }}>
          ← Back to app
        </Link>
        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)' }} />
        <img src="/icon-192.png" alt="" style={{ width: 30, height: 30, borderRadius: 8 }} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.2 }}>Feature Suggestions</div>
          <div style={{ fontSize: 11, color: '#475569' }}>Request features &middot; Report issues &middot; Shape the roadmap</div>
        </div>
        {username && (
          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#334155' }}>
            Signed in as <span style={{ color: '#22d3ee', fontWeight: 600 }}>{username}</span>
          </div>
        )}
      </header>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px', display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* Submit form */}
        <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>💡</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>Submit a suggestion</div>
              <div style={{ fontSize: 12, color: '#475569' }}>Got an idea or found a bug? Let us know — we read every submission.</div>
            </div>
          </div>
          <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Category */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(Object.entries(CATEGORY_LABELS) as [Category, string][]).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(key)}
                  style={{
                    padding: '5px 13px', fontSize: 12, fontWeight: 600, borderRadius: 7, cursor: 'pointer',
                    border: category === key ? `1px solid ${CATEGORY_META[key].color}` : '1px solid rgba(255,255,255,0.08)',
                    background: category === key ? CATEGORY_META[key].bg : 'transparent',
                    color: category === key ? CATEGORY_META[key].color : '#475569',
                    transition: 'all .15s',
                  }}
                >{label}</button>
              ))}
            </div>

            {/* Title */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Title</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={200}
                placeholder="Short summary of your idea or issue"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#e2e8f0', outline: 'none', fontFamily: 'Inter, sans-serif' }}
              />
            </div>

            {/* Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Description <span style={{ color: '#334155', textTransform: 'none', fontWeight: 400 }}>(be as specific as you like)</span>
              </label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                maxLength={2000}
                rows={4}
                placeholder="Describe what you'd like to see, or how to reproduce an issue..."
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#e2e8f0', outline: 'none', resize: 'vertical', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}
              />
              <div style={{ fontSize: 11, color: '#1e3a5f', textAlign: 'right' }}>{body.length}/2000</div>
            </div>

            {submitError && (
              <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171' }}>
                {submitError}
              </div>
            )}

            {submitted && (
              <div style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 8 }}>
                ✓ Suggestion submitted — thanks! We&apos;ll review it shortly.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={submitting}
                style={{ background: submitting ? 'rgba(34,211,238,0.4)' : '#22d3ee', color: '#020617', fontWeight: 700, fontSize: 14, padding: '10px 24px', borderRadius: 9, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', transition: 'background .15s' }}
              >
                {submitting ? 'Submitting…' : 'Submit Suggestion →'}
              </button>
            </div>
          </form>
        </div>

        {/* Suggestions list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>
              All suggestions
              {!loading && <span style={{ fontSize: 12, color: '#334155', fontWeight: 400, marginLeft: 8 }}>({suggestions.length})</span>}
            </div>
            {/* Filter pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['all', 'feature', 'improvement', 'bug', 'other'] as const).map(key => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  style={{
                    padding: '4px 11px', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
                    border: filter === key ? '1px solid rgba(34,211,238,0.4)' : '1px solid rgba(255,255,255,0.07)',
                    background: filter === key ? 'rgba(34,211,238,0.09)' : 'transparent',
                    color: filter === key ? '#22d3ee' : '#475569',
                    transition: 'all .15s',
                  }}
                >
                  {key === 'all' ? 'All' : CATEGORY_LABELS[key as Category]}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div style={{ textAlign: 'center', padding: 48, color: '#334155', fontSize: 13 }}>Loading…</div>
          )}

          {!loading && visible.length === 0 && (
            <div style={{ textAlign: 'center', padding: 56, color: '#334155' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📬</div>
              <div style={{ fontSize: 14 }}>{filter === 'all' ? 'No suggestions yet — be the first!' : 'No suggestions in this category yet.'}</div>
            </div>
          )}

          {!loading && visible.map(s => {
            const cat  = CATEGORY_META[s.category];
            const stat = STATUS_META[s.status];
            return (
              <div key={s.id} style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 10, transition: 'border-color .15s' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                  {/* Category badge */}
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 5, background: cat.bg, color: cat.color, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {CATEGORY_LABELS[s.category]}
                  </span>
                  {/* Status badge */}
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 5, background: stat.bg, color: stat.color, flexShrink: 0 }}>
                    {stat.label}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: '#334155', flexShrink: 0 }}>
                    {timeAgo(s.created_at)} &middot; <span style={{ color: '#475569' }}>{s.username}</span>
                  </span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.4 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{s.body}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
