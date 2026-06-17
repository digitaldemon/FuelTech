'use client';

import { useState, useEffect, useRef, useCallback, CSSProperties } from 'react';

// ── Timeline ──────────────────────────────────────────────────────────────────
const TOTAL = 118;

const SCENES = [
  { id: 'intro',   title: 'Introduction',       start: 0,   end: 10  },
  { id: 'chat',    title: 'AI Diagnosis',        start: 10,  end: 33  },
  { id: 'diagram', title: 'Diagrams On Demand',  start: 33,  end: 48  },
  { id: 'field',   title: 'On the Job Site',     start: 48,  end: 63  },
  { id: 'connect', title: 'ATG Direct Connect',  start: 63,  end: 90  },
  { id: 'desktop', title: 'Console Connect',       start: 90,  end: 112 },
  { id: 'cta',     title: 'Get Access',          start: 112, end: 118 },
] as const;

type SceneId = typeof SCENES[number]['id'];

const CAPTIONS: Record<SceneId, [number, string][]> = {
  intro:   [[0, 'FuelTech AI Pro — the AI field assistant built for fueling technicians.'], [0.55, 'Trained on official documentation across every major equipment brand.']],
  chat:    [[0, 'Ask about any alarm or error code — in plain English.'], [0.45, 'The AI reasons through the problem like an experienced tech.'], [0.75, 'Every answer cites the exact manual and page number.']],
  diagram: [[0, 'Need a wiring diagram or installation schematic? Just ask.'], [0.5, 'The right figure from the right manual — displayed instantly.']],
  field:   [[0, 'Works on any device — phone, tablet, or desktop. No install required.'], [0.5, 'Same AI assistant whether you\'re on the job site or back at the office.']],
  connect: [[0, 'Connect directly to a TLS-350 or TLS-450 from your browser — no software required.'], [0.38, 'Atlas spots a probe comm protocol mismatch from the day before — the kind of thing that takes hours to find manually.'], [0.76, 'One command corrects the probe type setting. PROBE OUT clears instantly.']],
  desktop: [[0, 'FuelTech AI Console Connect — direct RS-232 serial access to any TLS console.'], [0.32, 'Alarm History — a full year of events, color-coded and ready to export.'], [0.42, 'Console Setup — pulls the complete ATG configuration in seconds.'], [0.72, 'Live Tank Inventory — volume, temperature, and ullage for every tank.']],
  cta:     [[0, 'Get started for $14.99/month — or save 45% with an annual plan.'], [0.5, 'No setup. No downloads. Works on any device, right now.']],
};

// ── Cursor path ───────────────────────────────────────────────────────────────
const CURSOR: [number, number, number, boolean?][] = [
  // Scene 1: Intro
  [0, 50, 50], [4, 50, 72], [8.5, 50, 80, true],
  // Scene 2: Chat — click "Current alarms" chip, then Send
  [11, 28, 57], [12, 28, 57, true], [13.5, 87, 89], [15, 87, 89, true], [20, 40, 60], [28, 36, 72],
  // Scene 3: Diagram
  [34, 50, 89], [34.8, 50, 89, true], [37, 85, 89, true], [43, 50, 65], [47, 52, 72],
  // Scene 4: Field tech
  [49, 72, 50], [51, 72, 84], [52, 72, 84, true], [56.5, 76, 87, true], [60, 65, 55], [62, 68, 65],
  // Scene 5: ATG Direct Connect — Connect button, Current Alarms, Atlas diagnoses + fixes
  [64, 82, 8],    [65.2, 82, 8, true],     // click Connect
  [66.5, 20, 14], [67.8, 20, 14, true],   // click Current Alarms quick cmd
  [70, 35, 55],   [73, 40, 60],            // reading alarm output
  [75, 65, 88],   [76.5, 65, 88, true],   // click Diagnose button
  [79, 42, 55],   [81, 38, 60],            // reading Atlas analysis
  [83, 35, 55],   [85.5, 40, 65],          // reading Tank Setup pull
  [87, 38, 60],   [89, 42, 68],            // reading fix result + verify
  // Scene 6: Console Connect — Alarm History, Console Setup, Inventory, Save PDF
  [91.2, 86, 14],  [92.4, 86, 14, true],  // click Alarm History
  [94, 22, 58],    [97, 28, 70],           // reading alarm rows
  [98.2, 60, 14],  [99.4, 60, 14, true],  // click Console Setup
  [101, 30, 42],   [104, 36, 55],          // reading setup data
  [105.5, 75, 14], [106.7, 75, 14, true], // click Inventory
  [108, 32, 58],   [110, 38, 68],          // reading inventory
  [111.5, 88, 93, true],                   // click Save PDF
  // Scene 7: CTA
  [113, 28, 54], [115, 72, 54], [117, 72, 77, true], [117.8, 72, 77],
];

function eio(t: number) { return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; }

function cursorAt(t: number): [number, number] {
  if (t <= CURSOR[0][0]) return [CURSOR[0][1], CURSOR[0][2]];
  const last = CURSOR[CURSOR.length - 1];
  if (t >= last[0]) return [last[1], last[2]];
  let i = 0;
  while (i < CURSOR.length - 1 && CURSOR[i + 1][0] <= t) i++;
  const [a1, x1, y1] = CURSOR[i];
  const [a2, x2, y2] = CURSOR[i + 1];
  const p = eio((t - a1) / (a2 - a1));
  return [x1 + (x2 - x1) * p, y1 + (y2 - y1) * p];
}

function fmt(s: number) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// ── Sound engine ──────────────────────────────────────────────────────────────
function makeSounds(muted: boolean) {
  if (typeof window === 'undefined') return null;
  const ctx = new AudioContext();

  const play = (fn: (ctx: AudioContext) => void) => {
    if (muted || ctx.state === 'suspended') return;
    try { fn(ctx); } catch { /* ignore */ }
  };

  return {
    resume: () => ctx.resume(),
    click: () => play(ctx => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.setValueAtTime(900, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.07);
      g.gain.setValueAtTime(0.14, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
      osc.start(); osc.stop(ctx.currentTime + 0.09);
    }),
    tick: () => play(ctx => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.type = 'square'; osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = 1100;
      g.gain.setValueAtTime(0.025, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
      osc.start(); osc.stop(ctx.currentTime + 0.03);
    }),
    connect: () => play(ctx => {
      [440, 660].forEach((freq, i) => {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0, ctx.currentTime + i * 0.11);
        g.gain.linearRampToValueAtTime(0.1, ctx.currentTime + i * 0.11 + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.11 + 0.28);
        osc.start(ctx.currentTime + i * 0.11);
        osc.stop(ctx.currentTime + i * 0.11 + 0.3);
      });
    }),
    chime: () => play(ctx => {
      [523, 659, 784].forEach((freq, i) => {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0, ctx.currentTime + i * 0.13);
        g.gain.linearRampToValueAtTime(0.1, ctx.currentTime + i * 0.13 + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.13 + 0.38);
        osc.start(ctx.currentTime + i * 0.13);
        osc.stop(ctx.currentTime + i * 0.13 + 0.4);
      });
    }),
  };
}

// ── Background music engine ───────────────────────────────────────────────────
// Plays public/music/demo-track.mp3 via the HTML5 Audio API.
// Drop the Pixabay "Inspiring Cinematic Electronica" MP3 at:
//   FuelTech/public/music/demo-track.mp3
function makeMusic(muted: boolean) {
  if (typeof window === 'undefined') return null;
  const audio = new Audio('/music/demo-track.mp3');
  audio.loop = true;
  audio.volume = 0;
  audio.play().catch(() => {});

  const TARGET_VOL = 0.52;
  let fadeTimer: ReturnType<typeof setInterval> | null = null;

  const fadeTo = (target: number) => {
    if (fadeTimer) clearInterval(fadeTimer);
    const step = target > audio.volume ? 0.015 : -0.015;
    fadeTimer = setInterval(() => {
      const next = audio.volume + step;
      if ((step > 0 && next >= target) || (step < 0 && next <= target)) {
        audio.volume = Math.max(0, Math.min(1, target));
        if (fadeTimer) clearInterval(fadeTimer);
        fadeTimer = null;
      } else {
        audio.volume = Math.max(0, Math.min(1, next));
      }
    }, 30);
  };

  if (!muted) fadeTo(TARGET_VOL);

  return {
    setMuted: (m: boolean) => { fadeTo(m ? 0 : TARGET_VOL); },
    stop: () => {
      fadeTo(0);
      setTimeout(() => { audio.pause(); audio.currentTime = 0; }, 1600);
    },
    resume: () => { audio.play().catch(() => {}); },
  };
}

// ── Scene: Intro ──────────────────────────────────────────────────────────────
function SceneIntro({ p }: { p: number }) {
  const fade = (t: number): CSSProperties => ({
    opacity: p > t ? 1 : 0,
    transform: `translateY(${p > t ? 0 : 10}px)`,
    transition: 'opacity 0.7s ease, transform 0.7s ease',
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 18, textAlign: 'center', padding: '0 40px', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%, rgba(34,211,238,0.10), transparent 65%)', pointerEvents: 'none' }} />
      <img src="/icon-192.png" alt="" style={{ width: 88, height: 88, borderRadius: 22, ...fade(0.08), boxShadow: '0 0 48px rgba(34,211,238,0.35)', zIndex: 1 }} />
      <div style={{ fontSize: 'clamp(32px,5.5vw,60px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, zIndex: 1, ...fade(0.22) }}>
        FuelTech <span style={{ color: '#22d3ee' }}>AI Pro</span>
      </div>
      <div style={{ fontSize: 'clamp(13px,1.8vw,18px)', color: '#64748b', zIndex: 1, ...fade(0.38) }}>
        AI for fueling technicians
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4, zIndex: 1, ...fade(0.52) }}>
        {['Veeder-Root', 'Gilbarco', 'Red Jacket', 'Franklin', 'Wayne'].map(b => (
          <span key={b} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 6, padding: '4px 11px', fontSize: 'clamp(10px,1.4vw,13px)', color: '#94a3b8' }}>{b}</span>
        ))}
      </div>
      <div style={{ marginTop: 8, background: '#22d3ee', color: '#020617', borderRadius: 11, padding: 'clamp(10px,1.5vw,13px) clamp(20px,3vw,30px)', fontWeight: 700, fontSize: 'clamp(13px,1.6vw,16px)', zIndex: 1, ...fade(0.7) }}>
        Get Access — from $14.99/mo →
      </div>
      <div style={{ position: 'absolute', bottom: 16, fontSize: 11, color: '#1e2d40', zIndex: 1 }}>fueltechaipro.com</div>
    </div>
  );
}


// ── Scene: Chat ───────────────────────────────────────────────────────────────
const AI_PARTS = [
  { text: 'Two simultaneous alarms on the TLS-450PLUS — here\'s how to prioritize:', at: 0.30 },
  { text: 'HIGH WATER on TK1 is urgent. Water contamination is a regulatory issue — isolate TK1 from dispensing and pull a water-finding paste measurement at the probe riser immediately.', at: 0.42 },
  { text: 'HIGH PRODUCT on TK2 is most likely a stuck float. Tap the probe riser firmly and wait 2–3 minutes. If it doesn\'t clear, check Setup → Tank Setup → High Product Limit vs. current level.', at: 0.60 },
  { text: '📄 TLS-450PLUS Operator\'s Manual §4 — Alarm Response, p. 31', at: 0.78, cite: true },
];

function SceneChat({ p }: { p: number }) {
  const showWelcome = p < 0.22;
  const inputFilled = p >= 0.12 && p < 0.22;
  const showMessages = p >= 0.22;
  const showTyping = p >= 0.22 && p < 0.30;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0f172a', overflow: 'hidden' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 7, padding: 'clamp(5px,0.85vw,10px) clamp(10px,1.6vw,16px)', background: '#07101f', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <img src="/icon-192.png" alt="" style={{ width: 'clamp(22px,2.8vw,34px)', height: 'clamp(22px,2.8vw,34px)', borderRadius: 8, display: 'block', boxShadow: '0 0 0 1.5px rgba(34,211,238,0.35), 0 0 10px rgba(34,211,238,0.1)', flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'clamp(10px,1.3vw,14px)', fontWeight: 700, color: '#e2e8f0', lineHeight: 1.2 }}>FuelTech AI Pro</div>
          <div style={{ fontSize: 'clamp(7px,0.85vw,10px)', color: '#475569', lineHeight: 1.2 }}>Your fueling systems assistant</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          {['Guided', '🔌 TLS', 'New chat'].map(btn => (
            <div key={btn} style={{ padding: 'clamp(2px,0.4vw,5px) clamp(5px,0.8vw,9px)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.04)', fontSize: 'clamp(7px,0.82vw,10px)', color: '#64748b', whiteSpace: 'nowrap' }}>{btn}</div>
          ))}
        </div>
      </header>
      <div style={{ flex: 1, overflow: 'hidden', padding: 'clamp(10px,1.5vw,18px) clamp(12px,1.8vw,20px)', display: 'flex', flexDirection: 'column', gap: 10, justifyContent: showWelcome ? 'flex-start' : 'flex-end' }}>
        {showWelcome && (
          <>
            <div style={{ fontSize: 'clamp(12px,1.7vw,18px)', fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>What do you need help with?</div>
            <div style={{ fontSize: 'clamp(7px,0.9vw,10px)', color: '#94a3b8', marginBottom: 5, fontWeight: 600 }}>Select equipment</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
              {['TLS-350', 'TLS-450PLUS', 'TLS-300', 'TLS-4B', 'Encore 700', 'Encore S', 'CRIND', 'FlexPay IV'].map(m => (
                <div key={m} style={{ padding: 'clamp(2px,0.4vw,5px) clamp(7px,1vw,13px)', borderRadius: 999, border: `1px solid ${m === 'TLS-450PLUS' ? '#22d3ee' : 'rgba(255,255,255,0.15)'}`, background: m === 'TLS-450PLUS' ? '#22d3ee' : 'rgba(255,255,255,0.04)', color: m === 'TLS-450PLUS' ? '#020617' : '#94a3b8', fontSize: 'clamp(7px,0.9vw,12px)', fontWeight: m === 'TLS-450PLUS' ? 700 : 400 }}>{m}</div>
              ))}
            </div>
            <div style={{ fontSize: 'clamp(7px,0.9vw,10px)', color: '#94a3b8', marginBottom: 5, fontWeight: 600 }}>Quick questions</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {['Current alarms', 'Error code lookup', 'Wiring diagram', 'Probe setup', 'Startup procedure', 'Tank programming'].map(q => (
                <div key={q} style={{ padding: 'clamp(3px,0.5vw,7px) clamp(7px,1vw,14px)', borderRadius: 9, border: '1px solid rgba(59,130,246,0.35)', background: q === 'Current alarms' && p > 0.10 ? 'rgba(59,130,246,0.22)' : 'rgba(59,130,246,0.08)', color: '#3b82f6', fontSize: 'clamp(7px,0.85vw,12px)', fontWeight: 500, transition: 'background 0.2s', boxShadow: q === 'Current alarms' && p > 0.10 ? '0 0 8px rgba(59,130,246,0.2)' : 'none' }}>{q}</div>
              ))}
            </div>
          </>
        )}
        {showMessages && (
          <>
            <div style={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 6, animation: 'demoFadeUp 0.35s ease' }}>
              <div style={{ width: 'clamp(18px,2.3vw,28px)', height: 'clamp(18px,2.3vw,28px)', borderRadius: '50%', background: '#1e293b', border: '1.5px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 'clamp(7px,0.8vw,9px)', color: '#94a3b8', fontWeight: 700 }}>T</div>
              <div style={{ maxWidth: '80%', background: '#1d4ed8', color: '#fff', padding: 'clamp(6px,0.9vw,10px) clamp(8px,1.2vw,14px)', borderRadius: '16px 16px 4px 16px', fontSize: 'clamp(9px,1.1vw,13px)', lineHeight: 1.55 }}>
                ATG showing 2 active alarms &mdash; [0001] HIGH PRODUCT TK2 and [0002] HIGH WATER TK1. What&apos;s going on and what do I check first?
              </div>
            </div>
            {showTyping && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                <div style={{ width: 'clamp(18px,2.3vw,28px)', borderRadius: 6, overflow: 'hidden', boxShadow: '0 0 0 1.5px rgba(34,211,238,0.35)', flexShrink: 0 }}>
                  <img src="/icon-192.png" style={{ width: '100%', display: 'block' }} alt="" />
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px 16px 16px 4px', padding: 'clamp(5px,0.8vw,9px) clamp(8px,1.2vw,13px)', display: 'flex', gap: 4 }}>
                  {[0, 0.15, 0.3].map(d => <span key={d} style={{ width: 5, height: 5, background: '#475569', borderRadius: '50%', animation: `demoDot 0.8s ${d}s ease infinite` }} />)}
                </div>
              </div>
            )}
            {p >= 0.30 && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, animation: 'demoFadeUp 0.35s ease' }}>
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, alignSelf: 'flex-end' }}>
                  <div style={{ fontSize: 'clamp(6px,0.72vw,9px)', color: '#475569', fontWeight: 600 }}>Atlas</div>
                  <div style={{ width: 'clamp(18px,2.3vw,28px)', borderRadius: 6, overflow: 'hidden', boxShadow: '0 0 0 1.5px rgba(34,211,238,0.35)' }}>
                    <img src="/icon-192.png" style={{ width: '100%', display: 'block' }} alt="" />
                  </div>
                </div>
                <div style={{ maxWidth: '80%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', padding: 'clamp(6px,0.9vw,10px) clamp(8px,1.2vw,14px)', borderRadius: '16px 16px 16px 4px', fontSize: 'clamp(8px,1.05vw,13px)', color: '#e2e8f0', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {AI_PARTS.filter(pt => p > pt.at).map((pt, i) => (
                    <div key={i} style={{ animation: 'demoFadeUp 0.3s ease', color: (pt as { cite?: boolean }).cite ? '#64748b' : '#e2e8f0', fontStyle: (pt as { cite?: boolean }).cite ? 'italic' : 'normal', fontSize: (pt as { cite?: boolean }).cite ? '0.88em' : 'inherit' }}>{pt.text}</div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <footer style={{ background: '#07101f', padding: 'clamp(5px,0.8vw,9px) clamp(10px,1.6vw,15px) clamp(7px,1vw,12px)', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        {p >= 0.22 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5, fontSize: 'clamp(7px,0.85vw,11px)', color: '#94a3b8' }}>
            Model: <strong style={{ color: '#22d3ee', marginLeft: 3 }}>TLS-450PLUS</strong>
            <span style={{ color: '#334155', marginLeft: 2 }}>&#x2715;</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ width: 'clamp(24px,3vw,36px)', height: 'clamp(24px,3vw,36px)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 'clamp(9px,1.2vw,16px)', flexShrink: 0 }}>&#x1F4F7;</div>
          <div style={{ flex: 1, padding: 'clamp(6px,0.9vw,10px) clamp(9px,1.3vw,14px)', border: `1px solid ${inputFilled ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 11, background: 'rgba(255,255,255,0.05)', fontSize: 'clamp(8px,1vw,13px)', color: inputFilled ? '#e2e8f0' : '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'border-color 0.2s' }}>
            {inputFilled
              ? <>ATG showing 2 active alarms &mdash; [0001] HIGH PRODUCT TK2 and [0002] HIGH WATER TK1&hellip;<span style={{ animation: 'demoBlink 1s step-start infinite', color: '#22d3ee' }}>|</span></>
              : p >= 0.22 ? 'Ask a follow-up…' : 'Ask about TLS-450PLUS alarms…'}
          </div>
          <div style={{ padding: 'clamp(6px,0.9vw,10px) clamp(10px,1.4vw,18px)', background: inputFilled || p >= 0.22 ? '#22d3ee' : 'rgba(34,211,238,0.3)', color: '#020617', borderRadius: 9, fontWeight: 700, fontSize: 'clamp(8px,1vw,13px)', flexShrink: 0, transition: 'background 0.2s' }}>Send</div>
        </div>
        <div style={{ marginTop: 4, fontSize: 'clamp(6px,0.72vw,9px)', color: '#1e2d40', lineHeight: 1.3 }}>AI responses are for reference only. Always verify against manufacturer documentation.</div>
      </footer>
    </div>
  );
}

// ── Scene: Diagram ────────────────────────────────────────────────────────────
function SceneDiagram({ p }: { p: number }) {
  const showUser2 = p > 0.12;
  const showTyping2 = p > 0.22 && p < 0.35;
  const showFig = p > 0.52;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0f172a', overflow: 'hidden' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 7, padding: 'clamp(5px,0.85vw,10px) clamp(10px,1.6vw,16px)', background: '#07101f', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <img src="/icon-192.png" alt="" style={{ width: 'clamp(22px,2.8vw,34px)', height: 'clamp(22px,2.8vw,34px)', borderRadius: 8, display: 'block', boxShadow: '0 0 0 1.5px rgba(34,211,238,0.35), 0 0 10px rgba(34,211,238,0.1)', flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'clamp(10px,1.3vw,14px)', fontWeight: 700, color: '#e2e8f0', lineHeight: 1.2 }}>FuelTech AI Pro</div>
          <div style={{ fontSize: 'clamp(7px,0.85vw,10px)', color: '#475569', lineHeight: 1.2 }}>Your fueling systems assistant</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          {['Guided', '🔌 TLS', 'New chat'].map(btn => (
            <div key={btn} style={{ padding: 'clamp(2px,0.4vw,5px) clamp(5px,0.8vw,9px)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.04)', fontSize: 'clamp(7px,0.82vw,10px)', color: '#64748b', whiteSpace: 'nowrap' }}>{btn}</div>
          ))}
        </div>
      </header>
      <div style={{ flex: 1, overflow: 'hidden', padding: 'clamp(10px,1.5vw,18px) clamp(12px,1.8vw,20px)', display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'flex-end' }}>
        <div style={{ opacity: 0.35, borderLeft: '2px solid rgba(255,255,255,0.06)', paddingLeft: 9, fontSize: 'clamp(8px,0.9vw,11px)', color: '#334155', lineHeight: 1.5 }}>
          TK1 isolated from dispensing. HIGH PRODUCT TK2 cleared &mdash; stuck float confirmed. HIGH WATER TK1 still active.
        </div>
        {showUser2 && (
          <div style={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 6, animation: 'demoFadeUp 0.35s ease' }}>
            <div style={{ width: 'clamp(18px,2.3vw,28px)', height: 'clamp(18px,2.3vw,28px)', borderRadius: '50%', background: '#1e293b', border: '1.5px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 'clamp(7px,0.8vw,9px)', color: '#94a3b8', fontWeight: 700 }}>T</div>
            <div style={{ maxWidth: '80%', background: '#1d4ed8', color: '#fff', padding: 'clamp(6px,0.9vw,10px) clamp(8px,1.2vw,14px)', borderRadius: '16px 16px 4px 16px', fontSize: 'clamp(9px,1.1vw,13px)', lineHeight: 1.55 }}>
              Can you show me the Mag Plus probe wiring diagram?
            </div>
          </div>
        )}
        {showTyping2 && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            <div style={{ width: 'clamp(18px,2.3vw,28px)', borderRadius: 6, overflow: 'hidden', boxShadow: '0 0 0 1.5px rgba(34,211,238,0.35)', flexShrink: 0 }}>
              <img src="/icon-192.png" style={{ width: '100%', display: 'block' }} alt="" />
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px 16px 16px 4px', padding: 'clamp(5px,0.8vw,9px) clamp(8px,1.2vw,13px)', display: 'flex', gap: 4 }}>
              {[0, 0.15, 0.3].map(d => <span key={d} style={{ width: 5, height: 5, background: '#475569', borderRadius: '50%', animation: `demoDot 0.8s ${d}s ease infinite` }} />)}
            </div>
          </div>
        )}
        {p > 0.33 && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, animation: 'demoFadeUp 0.35s ease', flex: 1, minHeight: 0 }}>
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ fontSize: 'clamp(6px,0.72vw,9px)', color: '#475569', fontWeight: 600 }}>Atlas</div>
              <div style={{ width: 'clamp(18px,2.3vw,28px)', borderRadius: 6, overflow: 'hidden', boxShadow: '0 0 0 1.5px rgba(34,211,238,0.35)' }}>
                <img src="/icon-192.png" style={{ width: '100%', display: 'block' }} alt="" />
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0, minHeight: 0, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', padding: 'clamp(6px,0.9vw,10px) clamp(8px,1.2vw,14px)', borderRadius: '16px 16px 16px 4px', fontSize: 'clamp(8px,1.05vw,13px)', color: '#e2e8f0', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
              <div>Mag Plus probe wiring — ITPM module (console) to probe head junction box:</div>
              {showFig && (
                <div style={{ background: 'rgba(34,211,238,0.03)', border: '1px solid rgba(34,211,238,0.14)', borderRadius: 8, padding: 8, animation: 'demoFadeUp 0.5s ease', flex: 1 }}>
                  <svg width="100%" viewBox="0 0 340 162" fill="none">
                    {/* Cable shield outline — draw first so wires render on top */}
                    <rect x="90" y="44" width="160" height="68" rx="5" stroke="rgba(71,85,105,0.22)" strokeWidth="1" fill="rgba(15,23,42,0.15)" strokeDasharray="5,3"/>
                    {/* Boxes — semi-transparent so internal wire segments show */}
                    <rect x="4" y="14" width="88" height="112" rx="5" stroke="rgba(34,211,238,0.5)" strokeWidth="1.5" fill="rgba(34,211,238,0.04)"/>
                    <rect x="248" y="14" width="88" height="112" rx="5" stroke="rgba(167,139,250,0.5)" strokeWidth="1.5" fill="rgba(167,139,250,0.04)"/>
                    {/* WHITE wire — SIG+ */}
                    <line x1="65" y1="56" x2="264" y2="56" stroke="#e2e8f0" strokeWidth="2.2"/>
                    {/* BLACK wire — SIG– (dark fill with visible border) */}
                    <line x1="65" y1="78" x2="264" y2="78" stroke="#475569" strokeWidth="3.2"/>
                    <line x1="65" y1="78" x2="264" y2="78" stroke="#0d1117" strokeWidth="1.8"/>
                    {/* DRAIN — dashed, terminates at console end only */}
                    <line x1="65" y1="100" x2="182" y2="100" stroke="#374151" strokeWidth="1" strokeDasharray="3,2"/>
                    <circle cx="182" cy="100" r="2.5" fill="#0f172a" stroke="#374151" strokeWidth="0.8"/>
                    {/* ── LEFT BOX labels ── */}
                    <text x="48" y="26" fill="#22d3ee" fontSize="7" textAnchor="middle" fontFamily="monospace" fontWeight="700">TLS-450PLUS</text>
                    <text x="48" y="35" fill="#94a3b8" fontSize="5.5" textAnchor="middle" fontFamily="monospace">ITPM  CH 1</text>
                    {/* SIG+ terminal */}
                    <text x="10" y="59" fill="#94a3b8" fontSize="5.5" fontFamily="monospace">SIG+</text>
                    <rect x="45" y="50" width="20" height="13" rx="2" stroke="rgba(34,211,238,0.65)" strokeWidth="1.2" fill="rgba(34,211,238,0.12)"/>
                    <text x="55" y="60" fill="#22d3ee" fontSize="8" textAnchor="middle" fontFamily="monospace" fontWeight="700">+</text>
                    {/* SIG– terminal */}
                    <text x="10" y="81" fill="#94a3b8" fontSize="5.5" fontFamily="monospace">SIG–</text>
                    <rect x="45" y="72" width="20" height="13" rx="2" stroke="rgba(248,113,113,0.65)" strokeWidth="1.2" fill="rgba(248,113,113,0.1)"/>
                    <text x="55" y="82" fill="#f87171" fontSize="8" textAnchor="middle" fontFamily="monospace" fontWeight="700">–</text>
                    {/* SHLD terminal */}
                    <text x="10" y="103" fill="#64748b" fontSize="5.5" fontFamily="monospace">SHLD</text>
                    <rect x="45" y="94" width="20" height="13" rx="2" stroke="rgba(100,116,139,0.45)" strokeWidth="1.2" fill="rgba(100,116,139,0.07)"/>
                    <text x="55" y="104" fill="#64748b" fontSize="6" textAnchor="middle" fontFamily="monospace">SH</text>
                    <text x="48" y="120" fill="#475569" fontSize="5.5" textAnchor="middle" fontFamily="monospace">CONSOLE</text>
                    {/* ── CABLE ZONE labels ── */}
                    <text x="170" y="52" fill="#94a3b8" fontSize="5.5" textAnchor="middle" fontFamily="monospace">WHITE  (+)</text>
                    <text x="170" y="74" fill="#64748b" fontSize="5.5" textAnchor="middle" fontFamily="monospace">BLACK  (–)</text>
                    <text x="128" y="109" fill="#2a3a4a" fontSize="5" textAnchor="middle" fontFamily="monospace">DRAIN — CONSOLE END ONLY</text>
                    <text x="170" y="121" fill="#334155" fontSize="5.5" textAnchor="middle" fontFamily="monospace">2-CONDUCTOR SHIELDED · MAX 1000 FT</text>
                    {/* ── RIGHT BOX labels ── */}
                    <text x="292" y="26" fill="#a78bfa" fontSize="7" textAnchor="middle" fontFamily="monospace" fontWeight="700">MAG PLUS</text>
                    <text x="292" y="35" fill="#94a3b8" fontSize="5.5" textAnchor="middle" fontFamily="monospace">PROBE HEAD</text>
                    {/* Probe SIG+ terminal */}
                    <rect x="264" y="50" width="20" height="13" rx="2" stroke="rgba(34,211,238,0.65)" strokeWidth="1.2" fill="rgba(34,211,238,0.12)"/>
                    <text x="274" y="60" fill="#22d3ee" fontSize="8" textAnchor="middle" fontFamily="monospace" fontWeight="700">+</text>
                    <text x="288" y="59" fill="#94a3b8" fontSize="5.5" fontFamily="monospace">SIG+</text>
                    {/* Probe SIG– terminal */}
                    <rect x="264" y="72" width="20" height="13" rx="2" stroke="rgba(248,113,113,0.65)" strokeWidth="1.2" fill="rgba(248,113,113,0.1)"/>
                    <text x="274" y="82" fill="#f87171" fontSize="8" textAnchor="middle" fontFamily="monospace" fontWeight="700">–</text>
                    <text x="288" y="81" fill="#94a3b8" fontSize="5.5" fontFamily="monospace">SIG–</text>
                    {/* Probe drain note */}
                    <text x="292" y="100" fill="#2a3a4a" fontSize="5" textAnchor="middle" fontFamily="monospace">DRAIN: FLOAT</text>
                    <text x="292" y="108" fill="#2a3a4a" fontSize="5" textAnchor="middle" fontFamily="monospace">DO NOT CONNECT</text>
                    <text x="292" y="120" fill="#475569" fontSize="5.5" textAnchor="middle" fontFamily="monospace">PROBE</text>
                    {/* ── WARNING BANNER ── */}
                    <rect x="4" y="132" width="332" height="16" rx="3" stroke="rgba(251,146,60,0.4)" strokeWidth="1" fill="rgba(251,146,60,0.07)"/>
                    <text x="170" y="143" fill="#fb923c" fontSize="6" textAnchor="middle" fontFamily="monospace" fontWeight="700">REVERSED POLARITY = PROBE COMM FAULT — VERIFY + / – AT BOTH ENDS BEFORE POWER-UP</text>
                    {/* Caption */}
                    <text x="170" y="158" fill="#1e2d40" fontSize="5.5" textAnchor="middle" fontFamily="monospace">Fig. 3-12 · Mag Plus Probe Wiring · TLS-450PLUS Field Installation Manual 577013-880</text>
                  </svg>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <footer style={{ background: '#07101f', padding: 'clamp(5px,0.8vw,9px) clamp(10px,1.6vw,15px) clamp(7px,1vw,12px)', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5, fontSize: 'clamp(7px,0.85vw,11px)', color: '#94a3b8' }}>
          Model: <strong style={{ color: '#22d3ee', marginLeft: 3 }}>TLS-450PLUS</strong>
          <span style={{ color: '#334155', marginLeft: 2 }}>&#x2715;</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ width: 'clamp(24px,3vw,36px)', height: 'clamp(24px,3vw,36px)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 'clamp(9px,1.2vw,16px)', flexShrink: 0 }}>&#x1F4F7;</div>
          <div style={{ flex: 1, padding: 'clamp(6px,0.9vw,10px) clamp(9px,1.3vw,14px)', border: p > 0.07 && p < 0.14 ? '1px solid rgba(34,211,238,0.4)' : '1px solid rgba(255,255,255,0.1)', borderRadius: 11, background: 'rgba(255,255,255,0.05)', fontSize: 'clamp(8px,1vw,13px)', color: p > 0.07 && p < 0.14 ? '#e2e8f0' : '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'border-color 0.2s' }}>
            {p > 0.07 && p < 0.14 ? <>Can you show me the Mag Plus probe wiring diagram?<span style={{ animation: 'demoBlink 1s step-start infinite', color: '#22d3ee' }}>|</span></> : 'Ask a follow-up…'}
          </div>
          <div style={{ padding: 'clamp(6px,0.9vw,10px) clamp(10px,1.4vw,18px)', background: p > 0.12 ? '#22d3ee' : 'rgba(34,211,238,0.3)', color: '#020617', borderRadius: 9, fontWeight: 700, fontSize: 'clamp(8px,1vw,13px)', flexShrink: 0, transition: 'background 0.2s' }}>Send</div>
        </div>
      </footer>
    </div>
  );
}

// ── Scene: Field tech (mobile + desktop side-by-side) ────────────────────────
const FIELD_PHONE_CHAT = [
  { role: 'user', text: 'Error 101 on Gilbarco Encore 700. Display went blank on startup.', showAt: 0.22 },
  { role: 'ai',   text: 'Error 101 = Display Board Comm Fault.\n\nReseat J9 ribbon cable on the back of the display board — works loose during maintenance. Cycle power.\n\n📄 Encore 700 Service Manual, Ch. 4', showAt: 0.42 },
];
const FIELD_DESKTOP_CHAT = [
  { role: 'user', text: 'How do I change probe comm type to ISPI on TLS-450PLUS Tank 3?', showAt: 0.62 },
  { role: 'ai',   text: 'Setup → Tank Setup → Tank 3 → Probe Comm Type.\nChange VR-STD → ISPI (required for Mag Plus SmartProbe).\n\nSave and allow 60s to re-initialize.\n\n📄 TLS-450PLUS Programming Manual §5.2, p. 41', showAt: 0.80 },
];

function SceneField({ p }: { p: number }) {
  const phoneTyping   = p > 0.30 && p < 0.42;
  const phoneInput    = p > 0.12 && p < 0.22 ? 'Error 101 on Gilbarco Encore 700...'.slice(0, Math.floor((p - 0.12) / 0.10 * 35)) : null;
  const desktopTyping = p > 0.70 && p < 0.80;
  const desktopInput  = p > 0.54 && p < 0.62 ? 'How do I change probe comm type to ISPI?'.slice(0, Math.floor((p - 0.54) / 0.08 * 40)) : null;

  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>
      {/* ── Left: Mobile ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #06111f 0%, #030a14 100%)', borderRight: '1px solid rgba(255,255,255,0.06)', gap: 8, padding: '14px 16px' }}>
        <div style={{ textAlign: 'center', opacity: p > 0.03 ? 1 : 0, transition: 'opacity 0.5s', marginBottom: 2 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#22d3ee', letterSpacing: '0.1em', textTransform: 'uppercase' }}>📱 Mobile</div>
          <div style={{ fontSize: 8.5, color: '#334155', marginTop: 2 }}>Any phone · No install</div>
        </div>
        <div style={{ width: 'clamp(115px,16vw,152px)', background: '#050c1a', border: '2.5px solid rgba(255,255,255,0.16)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 16px 50px rgba(0,0,0,0.65), 0 0 0 1px rgba(34,211,238,0.10)', display: 'flex', flexDirection: 'column', opacity: p > 0.04 ? 1 : 0, transform: `translateY(${p > 0.04 ? 0 : 10}px)`, transition: 'opacity 0.5s, transform 0.5s' }}>
          <div style={{ background: '#03070f', padding: '5px 10px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 8, color: '#475569', fontWeight: 700 }}>9:41</span>
            <div style={{ width: 14, height: 4, background: '#0f172a', borderRadius: 3 }} />
            <span style={{ fontSize: 7, color: '#334155' }}>⬛⬛⬛</span>
          </div>
          <div style={{ background: '#08101e', padding: '5px 9px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <img src="/icon-192.png" style={{ width: 12, height: 12, borderRadius: 3 }} alt="" />
            <span style={{ fontSize: 9, fontWeight: 700, color: '#22d3ee' }}>FuelTech AI Pro</span>
          </div>
          <div style={{ flex: 1, padding: '6px 6px 5px', display: 'flex', flexDirection: 'column', gap: 5, minHeight: 148, background: '#050c1a' }}>
            {FIELD_PHONE_CHAT.filter(m => p > m.showAt).map((m, i) => (
              <div key={i} style={{ animation: 'demoFadeUp 0.35s ease' }}>
                <div style={{ fontSize: 6, color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{m.role === 'user' ? '👷 Tech' : '🤖 AI'}</div>
                <div style={{ background: m.role === 'user' ? 'rgba(34,211,238,0.1)' : 'rgba(15,23,42,0.8)', border: m.role === 'user' ? '1px solid rgba(34,211,238,0.2)' : '1px solid rgba(255,255,255,0.07)', borderRadius: m.role === 'user' ? '6px 6px 6px 1.5px' : '6px 6px 1.5px 6px', padding: '3.5px 5px', fontSize: 7, lineHeight: 1.5, color: m.role === 'user' ? '#e2e8f0' : '#94a3b8', whiteSpace: 'pre-wrap' }}>{m.text}</div>
              </div>
            ))}
            {phoneTyping && (
              <div style={{ display: 'flex', gap: 3, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px 6px 1.5px 6px', padding: '4px 6px', width: 'fit-content' }}>
                {[0, 0.15, 0.3].map(d => <span key={d} style={{ width: 3, height: 3, background: '#334155', borderRadius: '50%', animation: `demoDot 0.8s ${d}s ease infinite` }} />)}
              </div>
            )}
          </div>
          <div style={{ padding: '4px 5px', borderTop: '1px solid rgba(255,255,255,0.05)', background: '#03070f', display: 'flex', gap: 3 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 5, padding: '2.5px 5px', fontSize: 6.5, color: phoneInput ? '#e2e8f0' : '#1e3a5f' }}>
              {phoneInput ? <>{phoneInput}<span style={{ animation: 'demoBlink 1s step-start infinite', color: '#22d3ee' }}>|</span></> : 'Ask anything…'}
            </div>
            <div style={{ background: p > 0.20 ? '#22d3ee' : 'rgba(34,211,238,0.25)', borderRadius: 4, padding: '2.5px 5px', fontSize: 7.5, color: '#020617', fontWeight: 700, transition: 'background 0.2s' }}>↑</div>
          </div>
        </div>
      </div>

      {/* ── Right: Desktop Browser ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(5,10,20,0.5)', gap: 8, padding: '14px 14px' }}>
        <div style={{ textAlign: 'center', opacity: p > 0.03 ? 1 : 0, transition: 'opacity 0.5s', marginBottom: 2 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#22d3ee', letterSpacing: '0.1em', textTransform: 'uppercase' }}>🖥️ Desktop</div>
          <div style={{ fontSize: 8.5, color: '#334155', marginTop: 2 }}>Any browser · Full featured</div>
        </div>
        <div style={{ width: '100%', maxWidth: 300, background: '#050c1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 9, overflow: 'hidden', boxShadow: '0 10px 36px rgba(0,0,0,0.5)', opacity: p > 0.04 ? 1 : 0, transform: `translateY(${p > 0.04 ? 0 : 10}px)`, transition: 'opacity 0.5s 0.08s, transform 0.5s 0.08s' }}>
          <div style={{ background: '#070d1a', padding: '6px 9px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', gap: 3.5 }}>
              {['#ef4444', '#f59e0b', '#22c55e'].map((c, i) => <div key={i} style={{ width: 6.5, height: 6.5, borderRadius: '50%', background: c, opacity: 0.65 }} />)}
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 4, padding: '2px 7px', fontSize: 7.5, color: '#334155', textAlign: 'center' }}>fueltechaipro.com/chat</div>
          </div>
          <div style={{ display: 'flex', height: 172 }}>
            <div style={{ width: 66, background: '#030710', borderRight: '1px solid rgba(255,255,255,0.05)', padding: '7px 5px', display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2.5, padding: '3px 4px', borderRadius: 4, background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)', marginBottom: 2 }}>
                <img src="/icon-192.png" style={{ width: 8, height: 8, borderRadius: 2 }} alt="" />
                <span style={{ fontSize: 6, color: '#22d3ee', fontWeight: 700 }}>FuelTech</span>
              </div>
              {['New Chat', 'Alarm Lookup', 'Wiring', 'ATG Direct', 'History'].map((item, i) => (
                <div key={item} style={{ padding: '2.5px 4px', fontSize: 6, color: i === 0 ? '#22d3ee' : '#334155', background: i === 0 ? 'rgba(34,211,238,0.06)' : 'transparent', borderRadius: 3, overflow: 'hidden', whiteSpace: 'nowrap' }}>{item}</div>
              ))}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ flex: 1, padding: '6px 7px', display: 'flex', flexDirection: 'column', gap: 5, overflow: 'hidden' }}>
                {FIELD_DESKTOP_CHAT.filter(m => p > m.showAt).map((m, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: m.role === 'user' ? 'row-reverse' : 'row', animation: 'demoFadeUp 0.35s ease' }}>
                    <div style={{ background: m.role === 'user' ? '#1d4ed8' : 'rgba(255,255,255,0.04)', border: m.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.07)', borderRadius: m.role === 'user' ? '7px 7px 2px 7px' : '7px 7px 7px 2px', padding: '3.5px 5.5px', fontSize: 6.5, lineHeight: 1.5, color: m.role === 'user' ? '#fff' : '#94a3b8', maxWidth: '88%', whiteSpace: 'pre-wrap' }}>{m.text}</div>
                  </div>
                ))}
                {desktopTyping && (
                  <div style={{ display: 'flex', gap: 3, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '7px 7px 7px 2px', padding: '4px 6px', width: 'fit-content' }}>
                    {[0, 0.15, 0.3].map(d => <span key={d} style={{ width: 3, height: 3, background: '#334155', borderRadius: '50%', animation: `demoDot 0.8s ${d}s ease infinite` }} />)}
                  </div>
                )}
              </div>
              <div style={{ padding: '4px 6px', borderTop: '1px solid rgba(255,255,255,0.05)', background: '#03070f', display: 'flex', gap: 4 }}>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 4, padding: '2.5px 6px', fontSize: 7, color: desktopInput ? '#e2e8f0' : '#1e3a5f' }}>
                  {desktopInput ? <>{desktopInput}<span style={{ animation: 'demoBlink 1s step-start infinite', color: '#22d3ee' }}>|</span></> : 'Ask anything…'}
                </div>
                <div style={{ background: p > 0.60 ? '#22d3ee' : 'rgba(34,211,238,0.25)', borderRadius: 4, padding: '2.5px 6px', fontSize: 7.5, color: '#020617', fontWeight: 700, transition: 'background 0.2s' }}>↑</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Scene: ATG Direct Connect ─────────────────────────────────────────────────
const QUICK_CMDS = [
  { label: 'Current Alarms', cmd: 'I20200' },
  { label: 'Tank Setup',     cmd: 'I80200' },
  { label: 'Alarm History',  cmd: 'I20600' },
  { label: 'Console Setup',  cmd: 'I10100' },
];

const CONNECT_LINES = [
  // Connection
  { cls: 'dim',  text: 'Requesting Web Serial port…', at: 0.04 },
  { cls: 'ok',   text: '✓  TLS-350 / TLS-450 · COM3 · 9600,8,N,1', at: 0.10 },
  { cls: 'dim',  text: '   Firmware: 36.00  ·  06/15/2026  09:12:44', at: 0.14 },
  { cls: '',     text: '', at: 0.18 },
  // Poll current alarms
  { cls: 'dim',  text: '> I20200  [Current Alarm Status]', at: 0.22 },
  { cls: '',     text: '', at: 0.25 },
  { cls: 'hdr',  text: '== CURRENT ALARM STATUS ==========================', at: 0.28 },
  { cls: 'hdr',  text: '   ACTIVE ALARMS: 2', at: 0.32 },
  { cls: '',     text: '', at: 0.35 },
  { cls: 'warn', text: '   TK3  0003  PROBE OUT         [ACTIVE]  07:44', at: 0.38 },
  { cls: 'warn', text: '   TK1  0004  HIGH WATER        [ACTIVE]  08:14', at: 0.42 },
  { cls: '',     text: '', at: 0.46 },
  // Atlas analyzes inline
  { cls: 'ai',   text: '   [Atlas]  TK3 PROBE OUT — probe replaced 06/14. Checking setup.', at: 0.47 },
  { cls: 'ai',   text: '   [Atlas]  TK1 HIGH WATER — pulling water level reading.', at: 0.50 },
  { cls: '',     text: '', at: 0.53 },
  // Pull Tank 3 setup
  { cls: 'dim',  text: '> I80200 03  [Tank 3 Setup]', at: 0.54 },
  { cls: '',     text: '', at: 0.56 },
  { cls: 'hdr',  text: '== TANK 3 SETUP ===================================', at: 0.57 },
  { cls: '',     text: '   PRODUCT:        DIESEL', at: 0.59 },
  { cls: '',     text: '   CAPACITY:       8000 GAL', at: 0.61 },
  { cls: 'warn', text: '   PROBE TYPE:     VR-STD   <-- old protocol', at: 0.63 },
  { cls: 'warn', text: '   PROBE MODEL:    Mag Plus SmartProbe (installed 06/14)', at: 0.65 },
  { cls: '',     text: '', at: 0.67 },
  // Atlas diagnosis
  { cls: 'ai',   text: '   [Atlas]  SmartProbe requires ISPI comm — TLS still set to VR-STD.', at: 0.68 },
  { cls: 'ai',   text: '   [Atlas]  Protocol mismatch = no probe data = PROBE OUT alarm.', at: 0.71 },
  { cls: 'ai',   text: '   [Atlas]  Updating probe communication type…', at: 0.73 },
  { cls: '',     text: '', at: 0.75 },
  // Send fix command
  { cls: 'dim',  text: '> S80200 03 PROBETYPE ISPI', at: 0.76 },
  { cls: 'ok',   text: '✓  TK3 Probe Comm Type: VR-STD → ISPI', at: 0.79 },
  { cls: '',     text: '', at: 0.81 },
  // Re-poll to verify
  { cls: 'ai',   text: '   [Atlas]  Verifying — re-polling alarm status…', at: 0.82 },
  { cls: 'dim',  text: '> I20200  [Verify alarm status]', at: 0.84 },
  { cls: '',     text: '', at: 0.86 },
  { cls: 'hdr',  text: '== CURRENT ALARM STATUS ==========================', at: 0.87 },
  { cls: 'ok',   text: '   TK3  PROBE OUT    [CLEARED] ✓  09:14', at: 0.89 },
  { cls: 'warn', text: '   TK1  HIGH WATER   [ACTIVE]   08:14', at: 0.91 },
  { cls: '',     text: '', at: 0.93 },
  // Atlas final
  { cls: 'ai',   text: '   [Atlas]  TK3 cleared. Protocol fix restored probe comms.', at: 0.94 },
  { cls: 'ai',   text: '   [Atlas]  TK1 HIGH WATER: measure riser depth — do not dismiss.', at: 0.97 },
];


function SceneConnect({ p }: { p: number }) {
  const connected = p > 0.10;
  const activeCmd = !connected ? -1 : p < 0.42 ? 0 : p < 0.70 ? 1 : p > 0.83 ? 0 : -1;
  const visible = CONNECT_LINES.filter(l => p > l.at);
  const btnState = p > 0.80 ? 'cleared' : p > 0.73 ? 'fixing' : p > 0.46 ? 'analyzing' : 'idle';
  const btnBg = btnState === 'cleared' ? '#22c55e' : btnState === 'fixing' ? '#f59e0b' : btnState === 'analyzing' ? '#22d3ee' : 'rgba(255,255,255,0.05)';
  const btnFg = btnState === 'idle' ? '#334155' : '#020617';
  const btnLabel = btnState === 'cleared' ? '✓ TK3 Probe Restored' : btnState === 'fixing' ? '⚡ Updating Probe Type…' : btnState === 'analyzing' ? '\u{1F916} Analyzing…' : '\u{1F916} Diagnose with Atlas →';
  // Shows user typing their own TLS commands — demonstrates full bidirectional access
  const typedCmd =
    p > 0.14 && p < 0.22 ? 'I20200'.slice(0, Math.ceil(Math.min((p - 0.14) / 0.07, 1) * 6)) :
    p > 0.50 && p < 0.54 ? 'I80200 03'.slice(0, Math.ceil(Math.min((p - 0.50) / 0.04, 1) * 9)) :
    p > 0.73 && p < 0.76 ? 'S80200 03 PROBETYPE ISPI'.slice(0, Math.ceil(Math.min((p - 0.73) / 0.03, 1) * 23)) :
    '';
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 'clamp(6px,1vw,10px) clamp(12px,2vw,16px)', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <img src="/icon-192.png" style={{ width: 22, height: 22, borderRadius: 6 }} alt="" />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>FuelTech AI Pro</span>
        <span style={{ fontSize: 11, color: '#475569', marginLeft: 2 }}>/ ATG Direct Connect</span>
        <div style={{ marginLeft: 'auto' }}>
          {!connected
            ? <div style={{ background: '#22d3ee', color: '#020617', borderRadius: 7, padding: '5px 14px', fontSize: 12, fontWeight: 700 }}>Connect to TLS</div>
            : <div style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.25)', borderRadius: 7, padding: '5px 12px', fontSize: 11, fontWeight: 700 }}>&#x25CF; Connected &middot; COM3</div>}
        </div>
      </div>
      {/* Quick Commands */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 'clamp(5px,0.8vw,7px) clamp(12px,2vw,16px)', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, background: 'rgba(15,23,42,0.5)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, color: '#1e3a5f', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: 2, flexShrink: 0 }}>Quick Commands</span>
        {QUICK_CMDS.map((cmd, i) => {
          const active = connected && activeCmd === i;
          return (
            <div key={cmd.label} style={{ padding: 'clamp(2px,0.5vw,4px) clamp(6px,1vw,10px)', borderRadius: 5, fontSize: 'clamp(8px,1vw,10.5px)', fontWeight: 600, background: active ? 'rgba(34,211,238,0.15)' : connected ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)', border: active ? '1px solid rgba(34,211,238,0.45)' : '1px solid rgba(255,255,255,0.07)', color: active ? '#22d3ee' : connected ? '#94a3b8' : '#2a3a4a', transition: 'all 0.25s', boxShadow: active ? '0 0 14px rgba(34,211,238,0.18)' : 'none' }}>
              {cmd.label}<span style={{ fontSize: 8, marginLeft: 4, opacity: 0.4, fontFamily: 'monospace' }}>{cmd.cmd}</span>
            </div>
          );
        })}
      </div>
      <div style={{ flex: 1, overflow: 'hidden', padding: 'clamp(6px,1vw,10px) clamp(12px,2vw,16px)', fontFamily: "'Courier New', monospace", display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        {visible.map((line, i) => (
          <div key={i} style={{ fontSize: 'clamp(8px,1vw,11px)', lineHeight: 1.65, color: line.cls === 'ok' ? '#22d3ee' : line.cls === 'hdr' ? '#7dd3fc' : line.cls === 'warn' ? '#fb923c' : line.cls === 'dim' ? '#2a4a6b' : line.cls === 'ai' ? '#c084fc' : '#94a3b8', fontWeight: line.cls === 'hdr' ? 700 : line.cls === 'ai' ? 600 : 400, fontStyle: line.cls === 'ai' ? 'italic' : 'normal', animation: 'demoFadeIn 0.15s ease', whiteSpace: 'pre' }}>
            {line.text || ' '}
          </div>
        ))}
      </div>
      {/* Command input bar — full bidirectional TLS access */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, background: 'rgba(3,7,15,0.7)', padding: 'clamp(5px,0.8vw,8px) clamp(12px,2vw,16px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 'clamp(9px,1.1vw,12px)', color: '#22d3ee', flexShrink: 0, fontWeight: 700 }}>{connected ? '>' : '─'}</span>
          <div style={{ flex: 1, fontFamily: "'Courier New', monospace", fontSize: 'clamp(9px,1.1vw,12px)', color: typedCmd ? '#e2e8f0' : '#1e3a5f', background: 'rgba(255,255,255,0.03)', border: `1px solid ${typedCmd ? 'rgba(34,211,238,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 5, padding: 'clamp(3px,0.5vw,5px) clamp(7px,1.1vw,10px)', minHeight: 22, display: 'flex', alignItems: 'center', transition: 'border-color 0.2s' }}>
            {typedCmd || <span style={{ color: '#1e3a5f', fontStyle: 'italic', fontSize: 'clamp(8px,1vw,11px)' }}>Type any TLS command…</span>}
            {connected && <span style={{ animation: 'demoBlink 0.9s step-start infinite', color: '#22d3ee', marginLeft: 1 }}>█</span>}
          </div>
          <div style={{ background: typedCmd ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.03)', border: typedCmd ? '1px solid rgba(34,211,238,0.45)' : '1px solid rgba(255,255,255,0.06)', borderRadius: 5, padding: 'clamp(3px,0.5vw,5px) clamp(8px,1.2vw,12px)', fontSize: 'clamp(8px,1vw,10px)', color: typedCmd ? '#22d3ee' : '#1e3a5f', fontWeight: 700, transition: 'all 0.2s', flexShrink: 0 }}>SEND</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'clamp(8px,0.9vw,10px)', color: '#1e3a5f', fontFamily: 'monospace' }}>{connected ? 'Web Serial · COM3 · 9600,8,N,1' : 'Disconnected'}</span>
          <div style={{ background: btnBg, color: btnFg, border: btnState === 'idle' ? '1px solid rgba(255,255,255,0.08)' : 'none', borderRadius: 7, padding: 'clamp(3px,0.6vw,5px) clamp(9px,1.4vw,13px)', fontSize: 'clamp(9px,1.1vw,11px)', fontWeight: 700, transition: 'all 0.5s ease', display: 'flex', alignItems: 'center', gap: 5, boxShadow: btnState !== 'idle' ? `0 0 18px ${btnBg}44` : 'none' }}>
            {btnLabel}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Scene: TLSConnect Desktop ─────────────────────────────────────────────────
const DESKTOP_DONE_AT = 0.94;
// Phase thresholds (scene p values, scene is 90-112 = 22s)
const D_ALARM_P  = 0.068; // click Alarm History at abs t=91.5
const D_SETUP_P  = 0.373; // click Console Setup at abs t=98.2
const D_INV_P    = 0.704; // click Inventory at abs t=105.5
const DESKTOP_LINES = [
  // Connection
  { cls: 'dim',  text: 'Enumerating serial ports…', at: 0.03 },
  { cls: 'dim',  text: 'Found: COM3  CH340  (USB-Serial)', at: 0.05 },
  { cls: 'ok',   text: '✓  Connected  TLS-450PLUS  9600,8,N,1', at: 0.07 },
  // Phase 1: Alarm History
  { cls: '',     text: '', at: 0.10 },
  { cls: 'dim',  text: '> I20600  [06/15/2025 - 06/15/2026]', at: 0.12 },
  { cls: '',     text: '', at: 0.14 },
  { cls: 'hdr',  text: '== ALARM HISTORY  SUNOCO #7419 ==========', at: 0.16 },
  { cls: 'hdr',  text: '  DATE        TIME  TANK  DESCRIPTION      STS', at: 0.18 },
  { cls: '',     text: '  ----------------------------------------', at: 0.20 },
  { cls: 'warn', text: '  06/10/2026  08:14  TK3  HIGH WATER        ^ SET', at: 0.22 },
  { cls: 'ok',   text: '  06/10/2026  09:32  TK3  HIGH WATER        v CLR', at: 0.24 },
  { cls: 'warn', text: '  04/15/2026  06:22  TK2  STP RELAY FAULT   ^ SET', at: 0.26 },
  { cls: 'ok',   text: '  04/16/2026  07:15  TK2  STP RELAY FAULT   v CLR', at: 0.28 },
  { cls: 'warn', text: '  01/17/2026  03:11  TK3  HIGH WATER        ^ SET', at: 0.30 },
  { cls: 'ok',   text: '  01/17/2026  04:28  TK3  HIGH WATER        v CLR', at: 0.32 },
  { cls: '',     text: '', at: 0.34 },
  { cls: 'ok',   text: '✓  47 events  (06/15/2025 - 06/15/2026)', at: 0.36 },
  // Phase 2: Console Setup
  { cls: '',     text: '', at: 0.40 },
  { cls: 'dim',  text: '> I10100  [Console Setup Report]', at: 0.42 },
  { cls: '',     text: '', at: 0.44 },
  { cls: 'hdr',  text: '== CONSOLE SETUP  TLS-450PLUS ============', at: 0.46 },
  { cls: 'dim',  text: '  SYSTEM  TLS-450PLUS  SN:45023891', at: 0.48 },
  { cls: 'dim',  text: '  FIRMWARE  36.00  DATE:06/15/2026', at: 0.50 },
  { cls: '',     text: '', at: 0.52 },
  { cls: '',     text: '  TANK 1  UNLEADED 87   8000 GAL  PROD:001', at: 0.54 },
  { cls: '',     text: '  TANK 2  PREMIUM 93    6000 GAL  PROD:002', at: 0.56 },
  { cls: '',     text: '  TANK 3  DIESEL        10000 GAL PROD:003', at: 0.58 },
  { cls: '',     text: '', at: 0.60 },
  { cls: 'dim',  text: '  PROBE   Mag Plus (all tanks)', at: 0.62 },
  { cls: 'dim',  text: '  LEAK    Annual  LAST:03/12/2026  PASS', at: 0.64 },
  { cls: 'dim',  text: '  HI-ALM  TK1:7200  TK2:5400  TK3:9000 gal', at: 0.66 },
  { cls: '',     text: '', at: 0.68 },
  { cls: 'ok',   text: '✓  Setup complete', at: 0.70 },
  // Phase 3: Inventory
  { cls: '',     text: '', at: 0.73 },
  { cls: 'dim',  text: '> I20100  [Tank Inventory]', at: 0.75 },
  { cls: '',     text: '', at: 0.77 },
  { cls: 'hdr',  text: '== TANK INVENTORY  LIVE POLL ==============', at: 0.79 },
  { cls: 'hdr',  text: '  TANK  PRODUCT      VOL    ULLAGE  TEMP', at: 0.80 },
  { cls: '',     text: '  ----------------------------------------', at: 0.81 },
  { cls: 'ok',   text: '  TK1   UNLD 87    6,241 gal  1,759  67.4F', at: 0.83 },
  { cls: 'ok',   text: '  TK2   PREM 93    4,088 gal  1,912  68.1F', at: 0.86 },
  { cls: 'ok',   text: '  TK3   DIESEL     8,319 gal  1,681  66.9F', at: 0.89 },
  { cls: '',     text: '', at: 0.91 },
  { cls: 'ok',   text: '✓  Inventory  06/15/2026  09:14:32', at: DESKTOP_DONE_AT },
];

const DESKTOP_BTNS = ['Console Setup', 'System Status', 'Inventory', 'Alarm History'];

function SceneDesktop({ p }: { p: number }) {
  const activeBtn = p > D_INV_P ? 2 : p > D_SETUP_P ? 0 : p > D_ALARM_P ? 3 : -1;
  const visible = DESKTOP_LINES.filter(l => p > l.at);
  const done = p > DESKTOP_DONE_AT;
  const saving = p > 0.96;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0f1e', borderRadius: 10, overflow: 'hidden', boxShadow: '0 0 0 1px rgba(255,255,255,0.08)' }}>
      {/* Titlebar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: 'clamp(6px,1vw,9px) clamp(10px,1.6vw,14px)', background: '#06090f', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, gap: 7 }}>
        <img src="/icon-192.png" style={{ width: 16, height: 16, borderRadius: 3 }} alt="" />
        <span style={{ fontSize: 'clamp(11px,1.3vw,13px)', fontWeight: 700, color: '#22d3ee', letterSpacing: '0.03em' }}>Console Connect</span>
        <span style={{ fontSize: 10, color: '#1e3a5f', marginLeft: 2 }}>v1.0</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
          {['─', '□', '✕'].map((c, i) => (
            <div key={i} style={{ width: 22, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 3, background: i === 2 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)', color: '#334155', fontSize: i === 2 ? 9 : 12 }}>{c}</div>
          ))}
        </div>
      </div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 'clamp(5px,0.8vw,8px) clamp(10px,1.6vw,14px)', background: '#050c19', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 10, color: '#334155' }}>Port:</div>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: 'clamp(2px,0.5vw,4px) clamp(7px,1.1vw,10px)', fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>COM3 &mdash; CH340</div>
        <div style={{ background: p < 0.08 ? '#22d3ee' : 'rgba(34,211,238,0.12)', color: p < 0.08 ? '#020617' : '#22d3ee', border: '1px solid rgba(34,211,238,0.28)', borderRadius: 4, padding: 'clamp(2px,0.5vw,4px) clamp(7px,1.1vw,10px)', fontSize: 10, fontWeight: 700, transition: 'all 0.3s' }}>
          {p < 0.08 ? 'Connect' : '● Connected'}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
          {DESKTOP_BTNS.map((btn, i) => {
            const active = activeBtn === i;
            return (
              <div key={btn} style={{ fontSize: 'clamp(8px,1vw,10px)', padding: 'clamp(2px,0.4vw,4px) clamp(6px,0.9vw,9px)', border: active ? '1px solid rgba(34,211,238,0.45)' : '1px solid rgba(255,255,255,0.07)', borderRadius: 4, color: active ? '#22d3ee' : '#475569', background: active ? 'rgba(34,211,238,0.1)' : 'transparent', fontWeight: active ? 700 : 400, transition: 'all 0.25s', boxShadow: active ? '0 0 10px rgba(34,211,238,0.15)' : 'none' }}>{btn}</div>
            );
          })}
        </div>
      </div>
      {/* Console */}
      <div style={{ flex: 1, overflow: 'hidden', padding: 'clamp(6px,1vw,10px) clamp(10px,1.6vw,14px)', fontFamily: "'Courier New', monospace", display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        {visible.map((line, i) => (
          <div key={i} style={{ fontSize: 'clamp(8px,1vw,11px)', lineHeight: 1.65, color: line.cls === 'ok' ? '#22d3ee' : line.cls === 'hdr' ? '#7dd3fc' : line.cls === 'warn' ? '#fb923c' : line.cls === 'dim' ? '#1e3a5f' : '#94a3b8', fontWeight: line.cls === 'hdr' ? 700 : 400, animation: 'demoFadeIn 0.15s ease', whiteSpace: 'pre' }}>
            {line.text || ' '}
          </div>
        ))}
      </div>
      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'clamp(5px,0.8vw,8px) clamp(10px,1.6vw,14px)', background: '#06090f', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: '#1e3a5f', fontFamily: 'monospace' }}>{done ? 'TLS-450PLUS · 9600,8,N,1' : 'Reading…'}</span>
        <div style={{ background: done ? '#22d3ee' : 'rgba(255,255,255,0.06)', color: done ? '#020617' : '#334155', borderRadius: 5, padding: 'clamp(4px,0.7vw,6px) clamp(10px,1.5vw,13px)', fontSize: 10, fontWeight: 700, transition: 'all 0.4s ease', display: 'flex', alignItems: 'center', gap: 4, boxShadow: saving ? '0 0 0 3px rgba(34,211,238,0.3)' : 'none' }}>
          {saving ? '✓ Saved: SUNOCO-7419-Alarms.pdf' : '📄 Save as PDF'}
        </div>
      </div>
    </div>
  );
}

// ── Scene: CTA ────────────────────────────────────────────────────────────────
function SceneCta({ p }: { p: number }) {
  const fade = (t: number): CSSProperties => ({ opacity: p > t ? 1 : 0, transform: `translateY(${p > t ? 0 : 8}px)`, transition: 'opacity 0.6s ease, transform 0.6s ease' });
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '0 clamp(20px,4vw,60px)', textAlign: 'center', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%, rgba(34,211,238,0.09), transparent 65%)', pointerEvents: 'none' }} />
      <div style={{ ...fade(0.05), zIndex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#22d3ee', marginBottom: 10 }}>Pricing</div>
        <div style={{ fontSize: 'clamp(24px,4vw,42px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1 }}>Ready to get started?</div>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', zIndex: 1 }}>
        <div style={{ ...fade(0.2), background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, padding: 'clamp(14px,2.2vw,22px) clamp(18px,2.8vw,26px)', minWidth: 160, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Monthly</div>
          <div style={{ fontSize: 'clamp(26px,3.8vw,36px)', fontWeight: 800, color: '#e2e8f0' }}>$14<span style={{ fontSize: '50%', color: '#64748b' }}>.99/mo</span></div>
          <div style={{ marginTop: 11, background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '7px 12px', fontSize: 11, color: '#94a3b8' }}>Cancel anytime</div>
        </div>
        <div style={{ ...fade(0.35), background: 'rgba(34,211,238,0.06)', border: `1px solid rgba(34,211,238,${p > 0.35 ? '0.4' : '0.1'})`, borderRadius: 14, padding: 'clamp(14px,2.2vw,22px) clamp(18px,2.8vw,26px)', minWidth: 160, textAlign: 'center', position: 'relative', boxShadow: p > 0.35 ? '0 0 28px rgba(34,211,238,0.1)' : 'none', transition: 'box-shadow 0.6s, border-color 0.6s' }}>
          <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: '#22d3ee', color: '#020617', borderRadius: 999, padding: '3px 11px', fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap' }}>Best Value</div>
          <div style={{ fontSize: 11, color: '#22d3ee', marginBottom: 7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Annual</div>
          <div style={{ fontSize: 'clamp(26px,3.8vw,36px)', fontWeight: 800, color: '#e2e8f0' }}>$99<span style={{ fontSize: '50%', color: '#64748b' }}>/yr</span></div>
          <div style={{ fontSize: 12, color: '#22d3ee', marginTop: 3, fontWeight: 600 }}>Save 45% &mdash; $8.25/mo</div>
          <div style={{ marginTop: 11, background: '#22d3ee', borderRadius: 8, padding: '7px 12px', fontSize: 12, color: '#020617', fontWeight: 700 }}>Get Access &rarr;</div>
        </div>
      </div>
      <div style={{ ...fade(0.6), zIndex: 1, fontSize: 12, color: '#334155' }}>
        Works on any device &middot; No install required &middot; Source-cited answers
      </div>
    </div>
  );
}

function renderScene(id: SceneId, p: number) {
  if (id === 'intro')   return <SceneIntro p={p} />;
  if (id === 'chat')    return <SceneChat p={p} />;
  if (id === 'diagram') return <SceneDiagram p={p} />;
  if (id === 'field')   return <SceneField p={p} />;
  if (id === 'connect') return <SceneConnect p={p} />;
  if (id === 'desktop') return <SceneDesktop p={p} />;
  if (id === 'cta')     return <SceneCta p={p} />;
  return null;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DemoPage() {
  const [elapsed, setElapsed]   = useState(0);
  const [playing, setPlaying]   = useState(false);
  const [started, setStarted]   = useState(false);
  const [muted, setMuted]       = useState(false);
  const [clicks, setClicks]     = useState<{ id: number; x: number; y: number }[]>([]);
  const [hoveredChapter, setHoveredChapter] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const elapsedRef   = useRef(0);
  const playingRef   = useRef(false);
  const clickIdRef   = useRef(0);
  const firedRef     = useRef(new Set<number>());
  const prevLineCount = useRef(0);
  const soundRef     = useRef<ReturnType<typeof makeSounds> | null>(null);
  const musicRef     = useRef<ReturnType<typeof makeMusic> | null>(null);
  const mutedRef     = useRef(false);
  const screenRef    = useRef<HTMLDivElement>(null);
  const progressRef  = useRef<HTMLDivElement>(null);

  const scene = SCENES.find(s => elapsed >= s.start && elapsed < s.end) ?? SCENES[SCENES.length - 1];
  const sceneProgress = Math.min(1, Math.max(0, (elapsed - scene.start) / (scene.end - scene.start)));
  const sceneIndex = SCENES.indexOf(scene);
  const captions = CAPTIONS[scene.id];
  const captionText = [...captions].reverse().find(([t]) => sceneProgress >= t)?.[1] ?? '';
  const [cx, cy] = cursorAt(Math.min(elapsed, TOTAL - 0.01));
  const cursorX = mousePos?.x ?? cx;
  const cursorY = mousePos?.y ?? cy;
  const ended = elapsed >= TOTAL;

  // Sound + music init on first play
  const ensureSound = useCallback(() => {
    try {
      if (!soundRef.current) soundRef.current = makeSounds(mutedRef.current);
      soundRef.current?.resume();
      if (!musicRef.current) musicRef.current = makeMusic(mutedRef.current);
      musicRef.current?.resume();
    } catch { /* audio unavailable */ }
  }, []);

  useEffect(() => {
    mutedRef.current = muted;
    soundRef.current;
    musicRef.current?.setMuted(muted);
  }, [muted]);

  // Count visible console lines across both terminal scenes
  const connectLines = CONNECT_LINES.filter(l => sceneProgress > l.at && (scene.id === 'connect')).length;
  const desktopLines = DESKTOP_LINES.filter(l => sceneProgress > l.at && (scene.id === 'desktop')).length;
  const lineCount = connectLines + desktopLines;

  useEffect(() => {
    if (lineCount > prevLineCount.current) {
      soundRef.current?.tick();
    }
    prevLineCount.current = lineCount;
  }, [lineCount]);

  const seekTo = useCallback((t: number) => {
    const c = Math.max(0, Math.min(TOTAL, t));
    elapsedRef.current = c;
    setElapsed(c);
    CURSOR.forEach((wp, i) => { if (wp[0] > c) firedRef.current.delete(i); });
  }, []);

  const togglePlay = useCallback(() => {
    ensureSound();
    if (!started) setStarted(true);
    if (elapsedRef.current >= TOTAL) {
      musicRef.current?.stop(); musicRef.current = null;
      elapsedRef.current = 0; setElapsed(0); firedRef.current.clear();
    }
    const nowPlaying = !playingRef.current;
    playingRef.current = nowPlaying;
    setPlaying(nowPlaying);
    // Silence music when paused, restore when playing (respects mute toggle)
    musicRef.current?.setMuted(!nowPlaying || mutedRef.current);
  }, [started, ensureSound]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!playingRef.current) return;
      const next = Math.min(elapsedRef.current + 0.016, TOTAL);
      elapsedRef.current = next;
      setElapsed(next);
      if (next >= TOTAL) { playingRef.current = false; setPlaying(false); soundRef.current?.chime(); musicRef.current?.stop(); return; }

      CURSOR.forEach((wp, i) => {
        if (wp[3] && wp[0] <= next && !firedRef.current.has(i)) {
          firedRef.current.add(i);
          soundRef.current?.click();
          const cid = ++clickIdRef.current;
          setClicks(prev => [...prev, { id: cid, x: wp[1], y: wp[2] }]);
          setTimeout(() => setClicks(prev => prev.filter(c => c.id !== cid)), 700);
        }
      });
    }, 16);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); togglePlay(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [togglePlay]);

  return (
    <>
      <style>{`
        @keyframes demoFadeUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes demoFadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes demoDot     { 0%,80%,100%{transform:translateY(0);opacity:.35} 40%{transform:translateY(-4px);opacity:1} }
        @keyframes demoBlink   { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes clickRipple { 0%{transform:scale(0);opacity:.65} 100%{transform:scale(3);opacity:0} }
        .demo-cursor { pointer-events:none;position:absolute;width:13px;height:13px;background:rgba(255,255,255,0.9);border-radius:50%;transform:translate(-50%,-50%);z-index:40;box-shadow:0 1px 6px rgba(0,0,0,0.5),0 0 0 2px rgba(255,255,255,0.15);transition:left 0.65s cubic-bezier(0.25,0.1,0.25,1),top 0.65s cubic-bezier(0.25,0.1,0.25,1); }
        .demo-click  { pointer-events:none;position:absolute;width:26px;height:26px;border:2px solid rgba(255,255,255,0.55);border-radius:50%;transform:translate(-50%,-50%);z-index:39;animation:clickRipple 0.65s ease-out forwards; }
        .prog-bar    { position:relative;width:100%;height:4px;background:rgba(255,255,255,0.12);border-radius:999px;cursor:pointer;transition:height .15s; }
        .prog-bar:hover { height:6px; }
        .prog-fill   { height:100%;background:#22d3ee;border-radius:999px;position:relative;pointer-events:none; }
        .prog-thumb  { position:absolute;right:-6px;top:50%;transform:translateY(-50%);width:12px;height:12px;background:#22d3ee;border-radius:50%;box-shadow:0 0 0 2px rgba(34,211,238,0.3);opacity:0;transition:opacity .15s; }
        .prog-bar:hover .prog-thumb { opacity:1; }
        .chap-marker { position:absolute;top:50%;transform:translateY(-50%);width:2px;height:8px;background:rgba(255,255,255,0.18);border-radius:2px;pointer-events:none; }
        .ctrl-btn    { background:none;border:none;color:#cbd5e1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:6px;border-radius:6px;transition:color .15s,background .15s; }
        .ctrl-btn:hover { color:#fff;background:rgba(255,255,255,0.08); }
        .chap-pill   { border:1px solid rgba(255,255,255,0.06);background:none;cursor:pointer;border-radius:8px;padding:5px 12px;font-size:13px;display:flex;align-items:center;gap:6px;transition:background .15s,border .15s,color .15s; }
        .chap-pill:hover { background:rgba(255,255,255,0.06); }
        .chap-pill.active { background:rgba(34,211,238,0.1);border-color:rgba(34,211,238,0.3);color:#22d3ee; }
      `}</style>

      <div style={{ background: '#08101e', minHeight: '100vh', display: 'flex', flexDirection: 'column', color: '#e2e8f0', fontFamily: 'Inter,system-ui,sans-serif' }}>

        {/* Nav */}
        <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/icon-192.png" alt="" style={{ width: 34, height: 34, borderRadius: 9 }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.2 }}>FuelTech AI Pro</div>
              <div style={{ fontSize: 11, color: '#475569' }}>AI for fueling technicians</div>
            </div>
          </a>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <a href="/" style={{ color: '#64748b', textDecoration: 'none', padding: '7px 13px', fontSize: 13 }}>Home</a>
            <a href="/#pricing" style={{ color: '#64748b', textDecoration: 'none', padding: '7px 13px', fontSize: 13 }}>Pricing</a>
            <a href="/login" style={{ color: '#64748b', textDecoration: 'none', padding: '7px 13px', fontSize: 13 }}>Login</a>
            <a href="/#pricing" style={{ background: '#22d3ee', color: '#020617', fontWeight: 700, fontSize: 13, padding: '8px 17px', borderRadius: 9, textDecoration: 'none' }}>Get Access</a>
          </div>
        </nav>

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 18px 40px', gap: 0 }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.22)', color: '#22d3ee', borderRadius: 999, padding: '5px 14px', fontSize: 12, fontWeight: 700, marginBottom: 13, letterSpacing: '0.05em' }}>
              <span style={{ width: 6, height: 6, background: '#22d3ee', borderRadius: '50%', animation: 'demoDot 1.6s ease-in-out infinite' }} />
              PRODUCT DEMO &mdash; 1:52
            </div>
            <h1 style={{ fontSize: 'clamp(22px,3.8vw,38px)', fontWeight: 800, letterSpacing: '-0.04em', margin: '0 0 7px', lineHeight: 1 }}>See it in action</h1>
            <p style={{ fontSize: 'clamp(12px,1.6vw,15px)', color: '#64748b', margin: 0 }}>
              FuelTech AI Pro web app &bull; Console Connect &bull; Full walkthrough
            </p>
          </div>

          {/* Player */}
          <div style={{ width: '100%', maxWidth: 960 }}>

            {/* Screen */}
            <div ref={screenRef} onClick={togglePlay}
              onMouseMove={e => { const r = screenRef.current?.getBoundingClientRect(); if (!r) return; setMousePos({ x: (e.clientX - r.left) / r.width * 100, y: (e.clientY - r.top) / r.height * 100 }); }}
              onMouseLeave={() => setMousePos(null)}
              style={{ width: '100%', paddingTop: '56.25%', position: 'relative', background: '#050c1a', borderRadius: '14px 14px 0 0', overflow: 'hidden', cursor: 'none', border: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none', boxShadow: '0 28px 80px rgba(0,0,0,0.6)' }}>
              <div style={{ position: 'absolute', inset: 0 }}>{renderScene(scene.id, sceneProgress)}</div>

              {started && !ended && <div className="demo-cursor" style={{ left: `${cursorX}%`, top: `${cursorY}%`, transition: mousePos ? 'none' : 'left 0.55s cubic-bezier(0.25,0.1,0.25,1), top 0.55s cubic-bezier(0.25,0.1,0.25,1)' }} />}
              {!started && mousePos && <div className="demo-cursor" style={{ left: `${cursorX}%`, top: `${cursorY}%`, transition: 'none' }} />}
              {clicks.map(c => <div key={c.id} className="demo-click" style={{ left: `${c.x}%`, top: `${c.y}%` }} />)}

              {/* Scene label */}
              <div style={{ position: 'absolute', top: 12, left: 12, pointerEvents: 'none', zIndex: 10 }}>
                <div style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 7, padding: '4px 10px', fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ color: '#22d3ee', fontWeight: 700 }}>{String(sceneIndex + 1).padStart(2, '0')}/{SCENES.length}</span>
                  {scene.title}
                </div>
              </div>


              {/* Play overlay */}
              {(!started || (!playing && !ended)) && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, background: started ? 'rgba(0,0,0,0.38)' : 'transparent' }}>
                  <div style={{ width: 'clamp(54px,8vw,76px)', height: 'clamp(54px,8vw,76px)', background: 'rgba(34,211,238,0.14)', border: '2px solid rgba(34,211,238,0.5)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', boxShadow: '0 0 40px rgba(34,211,238,0.2)' }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="#22d3ee"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                </div>
              )}

              {/* End overlay */}
              {ended && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, background: 'rgba(5,12,26,0.85)', zIndex: 20, backdropFilter: 'blur(4px)' }}>
                  <div style={{ fontSize: 'clamp(18px,3.2vw,30px)', fontWeight: 800, letterSpacing: '-0.04em' }}>Ready to get started?</div>
                  <div style={{ display: 'flex', gap: 11, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <a href="/#pricing" style={{ background: '#22d3ee', color: '#020617', fontWeight: 700, fontSize: 15, padding: '12px 26px', borderRadius: 10, textDecoration: 'none' }}>Get Access &rarr;</a>
                    <button onClick={(e) => { e.stopPropagation(); seekTo(0); firedRef.current.clear(); setStarted(false); setPlaying(false); playingRef.current = false; }} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#94a3b8', fontWeight: 600, fontSize: 14, padding: '12px 22px', borderRadius: 10, cursor: 'pointer' }}>&#x21BA; Watch Again</button>
                  </div>
                </div>
              )}
            </div>

            {/* Caption bar — outside the screen so it never overlaps demo content */}
            <div style={{ background: '#060d1c', borderLeft: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)', padding: '9px 18px', minHeight: 40, display: 'flex', alignItems: 'center' }}>
              <p style={{ margin: 0, fontSize: 'clamp(11px,1.45vw,14px)', color: started && captionText ? '#cbd5e1' : 'transparent', lineHeight: 1.5, transition: 'color 0.35s ease', fontStyle: 'italic' }}>
                {captionText || ' '}
              </p>
            </div>

            {/* Controls */}
            <div style={{ background: '#0c1524', border: '1px solid rgba(255,255,255,0.08)', borderTop: '1px solid rgba(255,255,255,0.04)', borderRadius: '0 0 14px 14px', padding: '10px 15px 13px', display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div ref={progressRef} className="prog-bar" onClick={e => { if (!progressRef.current) return; const r = progressRef.current.getBoundingClientRect(); seekTo(((e.clientX - r.left) / r.width) * TOTAL); }} onMouseMove={e => { if (!progressRef.current) return; const r = progressRef.current.getBoundingClientRect(); const t = ((e.clientX - r.left) / r.width) * TOTAL; setHoveredChapter(SCENES.findIndex(s => t >= s.start && t < s.end)); }} onMouseLeave={() => setHoveredChapter(null)}>
                <div className="prog-fill" style={{ width: `${(elapsed / TOTAL) * 100}%` }}><div className="prog-thumb" /></div>
                {SCENES.slice(1).map(s => <div key={s.id} className="chap-marker" style={{ left: `${(s.start / TOTAL) * 100}%` }} />)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <button className="ctrl-btn" title="Prev chapter" onClick={() => seekTo(SCENES[Math.max(0, sceneIndex - 1)].start)}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
                </button>
                <button className="ctrl-btn" onClick={togglePlay} title="Play/Pause (Space)" style={{ color: '#22d3ee' }}>
                  {playing
                    ? <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                    : <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>}
                </button>
                <button className="ctrl-btn" title="Next chapter" onClick={() => seekTo(SCENES[Math.min(SCENES.length - 1, sceneIndex + 1)].start)}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm2.5-6 5.5 4V8l-5.5 4zm7.5-7v14h2V5h-2z"/></svg>
                </button>
                <span style={{ fontSize: 13, color: '#64748b', marginLeft: 4, fontFamily: 'monospace', letterSpacing: '0.04em' }}>{fmt(elapsed)} / {fmt(TOTAL)}</span>
                <span style={{ fontSize: 11, color: '#334155', marginLeft: 5 }}>{hoveredChapter !== null ? SCENES[hoveredChapter]?.title : scene.title}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                  {/* Mute toggle */}
                  <button className="ctrl-btn" title={muted ? 'Unmute' : 'Mute'} onClick={() => { setMuted(m => { const next = !m; mutedRef.current = next; if (soundRef.current) soundRef.current = makeSounds(next); return next; }); }}>
                    {muted
                      ? <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                      : <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>}
                  </button>
                  <button className="ctrl-btn" title="Fullscreen" onClick={() => { const el = screenRef.current?.parentElement; if (!el) return; if (!document.fullscreenElement) el.requestFullscreen?.(); else document.exitFullscreen?.(); }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Chapter pills */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 14, justifyContent: 'center' }}>
              {SCENES.map((s, i) => (
                <button key={s.id} className={`chap-pill${scene.id === s.id ? ' active' : ''}`} onClick={() => seekTo(s.start)} style={{ color: scene.id === s.id ? '#22d3ee' : '#475569' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: scene.id === s.id ? '#22d3ee' : '#334155' }}>{String(i + 1).padStart(2, '0')}</span>
                  {s.title}
                </button>
              ))}
            </div>
          </div>

          {/* CTA strip */}
          <div style={{ marginTop: 46, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 38, width: '100%', maxWidth: 960 }}>
            <p style={{ fontSize: 14, color: '#475569', marginBottom: 16 }}>Liked what you saw? Get full access right now.</p>
            <div style={{ display: 'flex', gap: 11, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="/#pricing" style={{ background: '#22d3ee', color: '#020617', fontWeight: 700, fontSize: 15, padding: '12px 30px', borderRadius: 11, textDecoration: 'none' }}>Get Access &mdash; from $14.99/mo</a>
              <a href="/" style={{ background: 'transparent', border: '1px solid rgba(34,211,238,0.3)', color: '#22d3ee', fontWeight: 600, fontSize: 14, padding: '12px 22px', borderRadius: 11, textDecoration: 'none' }}>Learn More</a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
