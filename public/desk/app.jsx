/* global React, ReactDOM */
const { useState, useRef, useEffect, useMemo, useCallback } = React;

// Ticking clock — re-renders every `ms` ms so countdowns stay live.
function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id); }, [ms]);
  return now;
}

function fmtCountdown(startUtc, now) {
  const diff = new Date(startUtc).getTime() - now;
  if (diff <= 0) return null;
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h >= 24) return null; // too far out — don't show
  if (h > 0) return h + "h " + m + "m";
  if (m > 0) return m + "m " + String(s).padStart(2, "0") + "s";
  return s + "s";
}

// Bump on every meaningful ship so a stale cache is obvious at a glance.
const BUILD = "2026-08-14.nrfi-edge12-backtest-v5";

// Everything outbound goes through the local server: it holds the API key
// and sidesteps the venues' browser CORS rules.
const px = (u) => "/api/desk/proxy?url=" + encodeURIComponent(u);

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');

.cd {
  --slate-900:#171C26; --slate-800:#212836; --slate-700:#2A3244;
  --slate-600:#3A445A; --line:#3D4760;
  --bone:#EFEAE0; --dim:#96A0B5;
  --amber:#F5B840; --rose:#E4707E; --cyan:#6FB3D2; --moss:#7FB98B; --violet:#9B8CD8;
  background:
    radial-gradient(900px 420px at 85% -10%, rgba(242,179,61,.07), transparent 60%),
    radial-gradient(700px 380px at -10% 0%, rgba(111,179,210,.05), transparent 55%),
    repeating-linear-gradient(to bottom, rgba(255,255,255,.012) 0 1px, transparent 1px 5px),
    linear-gradient(178deg, var(--slate-800) 0%, var(--slate-900) 100%);
  color: var(--bone);
  font-family: 'Inter Tight', system-ui, sans-serif;
  font-size: 15px;
  line-height: 1.5;
  min-height: 100vh;
  padding: max(24px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) calc(64px + env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left));
  -webkit-font-smoothing: antialiased;
}
.cd * { box-sizing: border-box; }
.cd-wrap { max-width: 880px; margin: 0 auto; }

/* plain-language helpers */
.help { font-size:12.5px; line-height:1.55; color:var(--dim); margin:6px 0 0; }
.lede { font-size:15px; line-height:1.6; color:#D2CDC1; margin:0 0 18px; }
.sect { font-size:16px; font-weight:600; letter-spacing:-.01em; margin:0 0 4px; }

/* collapsible detail */
details.fold { border-top:1px solid var(--line); margin-top:18px; padding-top:14px; }
details.fold > summary { cursor:pointer; list-style:none; font-size:13.5px; font-weight:600;
  color:var(--dim); display:flex; align-items:center; gap:8px; }
details.fold > summary::-webkit-details-marker { display:none; }
details.fold > summary::before { content:'+'; font-family:'JetBrains Mono',monospace;
  font-size:14px; color:var(--amber); width:12px; }
details.fold[open] > summary::before { content:'–'; }
details.fold > summary:hover { color:var(--bone); }

/* the plain-English answer */
.answer { font-size:17px; line-height:1.6; margin:16px 0 0; }
.answer strong { font-weight:600; }
.figures { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr));
  gap:10px; margin-top:20px; padding-top:18px; border-top:1px solid var(--line); }
.fig { background:rgba(0,0,0,.16); border:1px solid rgba(65,75,99,.5); border-radius:11px; padding:13px 15px; }
.fig .big { font-family:'JetBrains Mono',monospace; font-size:22px; font-weight:700;
  letter-spacing:-.01em; display:block; }
.fig .cap { font-size:13px; font-weight:500; display:block; margin-top:3px; }
.fig .sub { font-size:11.5px; color:var(--dim); display:block; margin-top:2px; line-height:1.4; }

/* onboarding */
.start { display:grid; grid-template-columns:26px 1fr; gap:12px 14px; margin-top:16px; }
.start .n { font-family:'JetBrains Mono',monospace; font-size:12px; color:var(--amber); padding-top:2px; }
.start .t { font-size:14px; line-height:1.5; }
.start .t b { font-weight:600; }
.example { display:block; width:100%; text-align:left; margin-top:8px; background:var(--slate-800);
  border:1px solid var(--slate-600); border-radius:10px; color:var(--cyan); cursor:pointer;
  font-family:'JetBrains Mono',monospace; font-size:11.5px; padding:10px 13px;
  transition:border-color .15s, transform .12s; }
.example:hover { border-color:var(--cyan); transform:translateX(3px); }

.mono { font-family:'JetBrains Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
.eyebrow { font-family:'JetBrains Mono', monospace; font-size:10.5px; letter-spacing:.16em;
  text-transform:uppercase; color:var(--dim); }
.label { font-size:12.5px; font-weight:600; letter-spacing:0; text-transform:none;
  color:var(--dim); font-family:'Inter Tight',sans-serif; }

.cd-head { display:flex; align-items:baseline; justify-content:space-between; gap:16px;
  padding-bottom:12px; flex-wrap:wrap; }
.cd-title { font-family:'Bricolage Grotesque', sans-serif; font-weight:800; font-size:26px;
  letter-spacing:-.02em; margin:0; }
.cd-title span { background:linear-gradient(120deg, #FFC95A, #EFA02F); -webkit-background-clip:text; background-clip:text; color:transparent; }

.tabs { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:20px; padding:5px;
  background:rgba(0,0,0,.18); border:1px solid var(--line); border-radius:13px; }
.tabs button { background:none; border:none; color:var(--dim); border-radius:9px;
  font-family:'Inter Tight',sans-serif; font-size:13px; font-weight:600; letter-spacing:0;
  padding:7px 12px; cursor:pointer; white-space:nowrap; transition:background .15s, color .15s; }
.tabs button.on { color:#1B202B; background:linear-gradient(180deg, #FFC95A, #F2A83D);
  box-shadow:0 2px 10px rgba(242,179,61,.28); }
.tabs button:hover:not(.on) { color:var(--bone); background:rgba(255,255,255,.05); }

.bar { display:flex; gap:10px; flex-wrap:wrap; }
.bar input, .srch {
  flex:1 1 300px; min-width:0; background:rgba(0,0,0,.22); border:1px solid var(--slate-600);
  color:var(--bone); font-family:'JetBrains Mono', monospace; font-size:13px;
  padding:13px 15px; border-radius:10px; outline:none; transition:border-color .15s, box-shadow .15s;
}
.bar input::placeholder, .srch::placeholder { color:#6E778C; }
.bar input:focus, .srch:focus { border-color:var(--amber); box-shadow:0 0 0 2px rgba(242,179,61,.16); }
@media (max-width:560px) { .bar input, .srch { font-size:16px; } }

.btn { background:linear-gradient(180deg, #FFC95A, #F2A83D); color:#1B202B; border:none; border-radius:10px; cursor:pointer;
  font-family:'JetBrains Mono', monospace; font-weight:700; font-size:12px; letter-spacing:.12em;
  padding:13px 22px; text-transform:uppercase; transition:filter .15s, transform .12s, box-shadow .15s;
  box-shadow:0 2px 12px rgba(242,179,61,.22), 0 1px 0 rgba(255,255,255,.3) inset; }
.btn:hover:not(:disabled) { filter:brightness(1.07); transform:translateY(-1px);
  box-shadow:0 4px 16px rgba(242,179,61,.3), 0 1px 0 rgba(255,255,255,.3) inset; }
.btn:active:not(:disabled) { transform:translateY(0); }
.btn:disabled { opacity:.4; cursor:not-allowed; }
.btn-ghost { background:transparent; color:var(--dim); border:1px solid var(--slate-600); box-shadow:none; }
.btn-ghost:hover:not(:disabled) { color:var(--bone); border-color:var(--dim); filter:none; transform:none; box-shadow:none; }
.btn-sm { padding:8px 13px; font-size:10.5px; }
.cd :focus-visible { outline:2px solid var(--amber); outline-offset:2px; }

.chips { display:flex; gap:6px; flex-wrap:wrap; margin-top:12px; align-items:center; }
.chip { font-family:'JetBrains Mono', monospace; font-size:10.5px; letter-spacing:.1em; text-transform:uppercase;
  padding:6px 12px; border-radius:999px; border:1px solid var(--slate-600); color:var(--dim);
  background:transparent; cursor:pointer; transition:color .15s, border-color .15s, background .15s; }
.chip.on { border-color:var(--amber); color:var(--amber); background:rgba(242,179,61,.1); }
.chip.static { cursor:default; }
.chip:hover:not(.static):not(.on) { color:var(--bone); border-color:var(--dim); }

.panel { background:linear-gradient(180deg, rgba(255,255,255,.025), rgba(255,255,255,0) 60%), var(--slate-700);
  border:1px solid var(--slate-600); border-radius:14px; padding:22px; margin-top:18px;
  box-shadow:0 1px 0 rgba(255,255,255,.04) inset, 0 10px 30px rgba(0,0,0,.28); }
.q { font-size:19px; font-weight:600; line-height:1.32; margin:8px 0 0; letter-spacing:-.01em; }
.meta { display:flex; gap:18px; flex-wrap:wrap; margin-top:14px; }
.meta div { font-size:11px; }
.meta .k, .vstat .k { color:var(--dim); font-family:'JetBrains Mono',monospace; font-size:9.5px;
  letter-spacing:.16em; text-transform:uppercase; display:block; margin-bottom:3px; }
.meta .v { font-family:'JetBrains Mono',monospace; font-size:13px; }

/* signature: price comparison — one aligned bar per estimate, all on the
   same 0-100% scale so longer bar = likelier, and gaps jump out */
.cmp-box { margin:22px 0 6px; }
.cmp-row { display:grid; grid-template-columns:112px 1fr 118px; gap:12px; align-items:center; margin-top:9px; }
.cmp-row .cl { font-size:10px; color:var(--dim); font-family:'JetBrains Mono',monospace;
  letter-spacing:.08em; text-transform:uppercase; text-align:right; line-height:1.3; }
.cmp-row.strong .cl { color:var(--bone); }
.cmp-track { position:relative; height:22px; background:rgba(0,0,0,.24);
  border:1px solid var(--slate-600); border-radius:6px; overflow:hidden; }
.cmp-fill { position:absolute; top:0; bottom:0; left:0;
  transition:width .7s cubic-bezier(.22,1,.36,1); }
.cmp-tick { position:absolute; top:0; bottom:0; width:1px; background:rgba(255,255,255,.09); }
.cmp-row .cv { font-family:'JetBrains Mono',monospace; font-size:12.5px; white-space:nowrap; }
.cmp-row .cv .sub2 { display:block; font-size:9.5px; color:var(--dim); letter-spacing:.05em; }
.cmp-scan { position:relative; height:22px; border:1px solid var(--slate-600); border-radius:6px;
  overflow:hidden; background:rgba(0,0,0,.24); margin-top:9px; }
.cmp-verdict { margin:16px 0 0; font-size:14.5px; line-height:1.55; }
.sweep { position:absolute; top:0; bottom:0; width:26%;
  background:linear-gradient(90deg, transparent, rgba(111,179,210,.20), transparent);
  animation:sweep 1.5s linear infinite; }
@keyframes sweep { from{left:-26%} to{left:100%} }

.verdict { display:flex; align-items:flex-end; gap:22px; flex-wrap:wrap;
  border-top:1px solid var(--line); margin-top:24px; padding-top:20px; }
.verdict h2 { font-family:'Bricolage Grotesque',sans-serif; font-weight:800; font-size:40px;
  letter-spacing:-.03em; line-height:.95; margin:0; }
.vstat { display:flex; gap:22px; flex-wrap:wrap; }
.vstat .v { font-family:'JetBrains Mono',monospace; font-size:17px; font-weight:500; }
.thesis { margin:18px 0 0; font-size:14.5px; line-height:1.6; color:#DAD5C9; }

.pillar { display:grid; grid-template-columns:30px 1fr auto; gap:14px; align-items:start;
  padding:15px 0; border-bottom:1px solid rgba(65,75,99,.55); }
.pillar:last-child { border-bottom:none; }
.pillar.arrive { animation:arrive .4s cubic-bezier(.22,1,.36,1) both; }
@keyframes arrive { from{opacity:0; transform:translateY(5px)} to{opacity:1; transform:none} }
.pnum { font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--dim); padding-top:2px; }
.pname { font-size:13.5px; font-weight:600; letter-spacing:-.005em; }
.pdesc { font-size:12px; color:var(--dim); margin-top:1px; }
.pfind { font-size:13.5px; line-height:1.55; margin-top:7px; color:#DAD5C9; }
.pwait { font-size:12px; color:var(--dim); font-family:'JetBrains Mono',monospace; margin-top:6px; }
.sig { font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:.1em; padding:4px 10px;
  border-radius:999px; white-space:nowrap; border:1px solid; }
.sig.adv { font-size:11.5px; padding:7px 13px; background:rgba(255,255,255,.045);
  box-shadow:0 2px 10px rgba(0,0,0,.22); font-weight:600; }

/* pick cards — the landing board. Hierarchy: winner name and the tier
   badge dominate; everything else is quiet metadata. */
.pick { display:block;
  border:1px solid rgba(255,255,255,0.07); border-left:3px solid var(--slate-600); border-radius:14px;
  padding:16px 18px; margin-top:10px; background:rgba(15,19,30,0.65);
  transition:border-color .2s, box-shadow .2s; }
.pick:hover { border-color:rgba(255,255,255,0.14); box-shadow:0 6px 28px rgba(0,0,0,.35); }
.pick.t-strongest { border-left-color:var(--moss);
  box-shadow:0 0 0 1px rgba(127,185,139,.1), 0 4px 20px rgba(0,0,0,.3); }
.pick.t-strong { border-left-color:var(--moss); }
.pick.t-lean { border-left-color:var(--amber); }
.tierbox { text-align:center; flex:0 0 auto; min-width:76px; padding:8px 10px; border-radius:11px;
  border:1px solid; font-family:'JetBrains Mono',monospace; background:rgba(0,0,0,.18); }
.tierbox .pct { font-size:20px; font-weight:700; display:block; line-height:1.02;
  font-variant-numeric:tabular-nums; }
.tierbox .lbl { font-size:8.5px; letter-spacing:.13em; display:block; margin-top:3px; opacity:.9; }
.rank { font-family:'Bricolage Grotesque',sans-serif; font-weight:800; font-size:21px;
  color:var(--dim); opacity:.65; width:24px; flex:0 0 auto; text-align:center; }
.pick-actions { display:flex; gap:8px; align-items:center; flex:0 0 auto; }
.livedot { display:inline-block; width:7px; height:7px; border-radius:50%; background:var(--rose);
  margin-right:6px; animation:pulse 1.6s ease-in-out infinite; vertical-align:1px; }
@keyframes pulse { 0%,100%{opacity:1; box-shadow:0 0 0 0 rgba(228,112,126,.45)}
  50%{opacity:.55; box-shadow:0 0 0 6px rgba(228,112,126,0)} }
@media (max-width:560px) {
  .pick { flex-wrap:wrap; }
  .pick .who-big { font-size:15px; }
  .pick-actions { width:100%; justify-content:flex-end; margin-top:2px; }
}
.dots::after { content:''; animation:dots 1.2s steps(4,end) infinite; }
@keyframes dots { 0%{content:''} 25%{content:'.'} 50%{content:'..'} 75%{content:'...'} }
.contra { background:rgba(228,112,126,.05); margin:0 -20px; padding:15px 20px; border-radius:3px; }
.off { opacity:.42; }

.live { margin-top:16px; padding:16px 18px; border:1px solid var(--slate-600); border-radius:13px;
  background:linear-gradient(180deg, rgba(111,179,210,.06), rgba(0,0,0,0) 55%), var(--slate-800);
  box-shadow:0 4px 14px rgba(0,0,0,.18); }
.live-top { display:flex; align-items:center; gap:9px; flex-wrap:wrap; margin-bottom:11px; }
.pulse { width:7px; height:7px; border-radius:50%; background:var(--rose); flex:0 0 auto;
  animation:pulse 1.6s ease-in-out infinite; }
@keyframes pulse { 0%,100%{opacity:1; transform:scale(1)} 50%{opacity:.35; transform:scale(.75)} }
.score-row { display:flex; align-items:baseline; justify-content:space-between; gap:14px; padding:6px 0; }
.score-row .who { font-size:14.5px; font-weight:600; }
.score-row .pts { font-family:'JetBrains Mono',monospace; font-size:24px; font-weight:700;
  letter-spacing:-.02em; }
.score-row.lead .pts { color:var(--amber); }
.score-row.lead .who { color:var(--bone); }
.score-row:not(.lead) .who, .score-row:not(.lead) .pts { color:var(--dim); }
.live-foot { margin-top:12px; padding-top:11px; border-top:1px solid var(--line);
  display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.srcchip { font-family:'JetBrains Mono',monospace; font-size:9.5px; letter-spacing:.08em;
  border:1px solid var(--slate-600); color:var(--dim); padding:3px 9px; border-radius:999px; text-decoration:none; }
.srcchip.ok { border-color:rgba(127,185,139,.5); color:var(--moss); }
.srcchip.bad { border-color:var(--rose); color:var(--rose); }
.wp { margin-top:11px; }
.wp-bar { height:7px; background:rgba(0,0,0,.3); border:1px solid var(--slate-600);
  border-radius:999px; position:relative; overflow:hidden; }
.wp-fill { position:absolute; top:0; bottom:0; left:0; border-radius:999px;
  background:linear-gradient(90deg, #8578C9, var(--violet));
  transition:width .5s cubic-bezier(.22,1,.36,1); }
.play { margin-top:10px; font-size:12.5px; line-height:1.5; color:#C9C4B8;
  border-left:2px solid var(--slate-600); padding-left:10px; }

/* broadcast-style scoreboard */
.sb { margin-top:16px; border:1px solid var(--slate-600); border-radius:14px; overflow:hidden;
  background:linear-gradient(180deg, rgba(111,179,210,.07), rgba(0,0,0,0) 60%), var(--slate-800);
  box-shadow:0 6px 18px rgba(0,0,0,.22); }
.sb-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:12px 16px;
  border-bottom:1px solid rgba(65,75,99,.5); }
.sb-badge { display:inline-flex; align-items:center; gap:7px; font-family:'JetBrains Mono',monospace;
  font-size:9.5px; font-weight:700; letter-spacing:.16em; padding:4px 11px; border-radius:999px;
  border:1px solid var(--slate-600); color:var(--dim); }
.sb-badge.live { border-color:rgba(228,112,126,.6); color:var(--rose); background:rgba(228,112,126,.09); }
.sb-detail { font-family:'JetBrains Mono',monospace; font-size:10.5px; color:var(--dim); letter-spacing:.05em; }
.sb-row { display:grid; grid-template-columns:46px minmax(0,1fr) auto auto; gap:12px; align-items:center;
  padding:13px 16px; animation:sbflash .9s ease-out; }
.sb-row + .sb-row { border-top:1px solid rgba(65,75,99,.35); }
@keyframes sbflash { 0% { background:rgba(242,179,61,.16); } 100% { background:transparent; } }
.sb-abbr { font-family:'JetBrains Mono',monospace; font-weight:700; font-size:12px; width:46px; height:32px;
  display:flex; align-items:center; justify-content:center; border-radius:9px;
  background:rgba(0,0,0,.26); border:1px solid rgba(65,75,99,.5); color:var(--dim); }
.sb-row.lead .sb-abbr { color:#1B202B; background:linear-gradient(180deg,#FFC95A,#F2A83D); border-color:transparent; }
.sb-name { font-size:14.5px; font-weight:600; color:var(--dim); min-width:0; overflow:hidden;
  text-overflow:ellipsis; white-space:nowrap; }
.sb-home { font-style:normal; font-family:'JetBrains Mono',monospace; font-size:8.5px; letter-spacing:.12em;
  color:var(--dim); margin-left:8px; text-transform:uppercase; border:1px solid rgba(65,75,99,.6);
  padding:2px 7px; border-radius:999px; }
.sb-sets { display:flex; gap:4px; }
.sb-sets b { font-family:'JetBrains Mono',monospace; font-weight:500; font-size:12px; min-width:23px; height:23px;
  display:flex; align-items:center; justify-content:center; border-radius:6px;
  background:rgba(0,0,0,.26); color:var(--dim); padding:0 4px; }
.sb-sets b:last-child { color:var(--bone); background:rgba(255,255,255,.08); }
.sb-score { font-family:'JetBrains Mono',monospace; font-size:29px; font-weight:700; letter-spacing:-.02em;
  color:var(--dim); min-width:46px; text-align:right; font-variant-numeric:tabular-nums; }
.sb-row.lead .sb-name { color:var(--bone); }
.sb-row.lead .sb-score { color:var(--amber); text-shadow:0 0 22px rgba(242,179,61,.35); }
.sb-call { display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; padding:11px 16px;
  border-top:1px solid rgba(65,75,99,.35); font-size:13.5px; color:var(--dim); }
.sb-call b { font-family:'JetBrains Mono',monospace; font-size:15px; }
.sb-call .who { font-weight:700; color:var(--bone); }
.sb-sit { padding:2px 16px 10px; font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--cyan); }
.sb-play { margin:2px 16px 12px; font-size:12.5px; line-height:1.5; color:#C9C4B8;
  border-left:2px solid var(--amber); padding:2px 0 2px 10px; }
.sb-wp { padding:2px 16px 12px; }
.sb-foot { display:flex; gap:7px; flex-wrap:wrap; align-items:center; padding:11px 16px 14px;
  border-top:1px solid rgba(65,75,99,.35); }
@media (max-width:560px) {
  .sb-row { grid-template-columns:38px minmax(0,1fr) auto auto; gap:8px; padding:11px 12px; }
  .sb-abbr { width:38px; height:28px; font-size:10.5px; }
  .sb-score { font-size:24px; }
  .sb-name { font-size:13px; }
}

.lst { margin:0; padding-left:17px; }
.lst li { font-size:13px; line-height:1.6; margin-bottom:6px; color:#DAD5C9; }
.src { display:flex; gap:6px; flex-wrap:wrap; margin-top:12px; }
.src a { font-family:'JetBrains Mono',monospace; font-size:10px; color:var(--dim);
  border:1px solid var(--slate-600); padding:3px 7px; border-radius:2px; text-decoration:none; }
.src a:hover { color:var(--cyan); border-color:var(--cyan); }

.err { border-color:var(--rose); color:#F3C0C6; font-size:13px; line-height:1.55; white-space:pre-wrap; font-family:ui-monospace,monospace; }
.foot { margin-top:26px; font-size:11.5px; line-height:1.6; color:var(--dim); }
.sel { width:100%; text-align:left; background:var(--slate-800); border:1px solid var(--slate-600);
  color:var(--bone); padding:12px 14px; border-radius:11px; cursor:pointer; margin-bottom:8px;
  display:flex; justify-content:space-between; gap:12px; align-items:center; font-size:13px;
  transition:border-color .15s, transform .12s, background .15s; }
.sel:hover { border-color:var(--amber); transform:translateX(3px); background:var(--slate-700); }
.sel .px { font-family:'JetBrains Mono',monospace; color:var(--amber); font-size:14px; }
.sel .sub { display:block; font-family:'JetBrains Mono',monospace; font-size:10px;
  color:var(--dim); letter-spacing:.1em; margin-top:3px; }

table.tbl { width:100%; border-collapse:collapse; margin-top:14px; }
table.tbl th { text-align:left; font-family:'JetBrains Mono',monospace; font-size:9.5px;
  letter-spacing:.14em; text-transform:uppercase; color:var(--dim); font-weight:400;
  padding:0 10px 8px 0; border-bottom:1px solid var(--line); }
table.tbl td { padding:10px 10px 10px 0; border-bottom:1px solid rgba(65,75,99,.4);
  font-size:12.5px; vertical-align:top; }
table.tbl td.m { font-family:'JetBrains Mono',monospace; font-variant-numeric:tabular-nums; }
table.tbl tbody tr { transition:background .12s; }
table.tbl tbody tr:hover td { background:rgba(255,255,255,.025); }

.scorecard { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:16px; }
.scorecard .n { font-family:'Bricolage Grotesque',sans-serif; font-weight:800; font-size:30px;
  letter-spacing:-.02em; line-height:1; }

.fw { border:1px solid var(--slate-600); border-radius:13px; padding:15px; margin-bottom:10px;
  background:linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,0) 55%), var(--slate-800);
  box-shadow:0 4px 14px rgba(0,0,0,.18); }
.fw textarea, .fw input[type=text] { width:100%; background:rgba(0,0,0,.22); color:var(--bone);
  border:1px solid var(--slate-600); border-radius:8px; padding:8px 11px; font-size:12.5px;
  font-family:'Inter Tight',sans-serif; resize:vertical; margin-top:7px; }
.fw-top { display:flex; gap:10px; align-items:center; justify-content:space-between; }
.rel { font-family:'JetBrains Mono',monospace; font-size:10px; padding:3px 9px; border-radius:999px;
  border:1px solid var(--slate-600); color:var(--dim); }
.sw { width:34px; height:19px; border-radius:10px; border:1px solid var(--slate-600);
  background:var(--slate-900); position:relative; cursor:pointer; flex:0 0 auto; }
.sw i { position:absolute; top:2px; left:2px; width:13px; height:13px; border-radius:50%;
  background:var(--dim); transition:left .16s, background .16s; }
.sw.on { border-color:var(--amber); background:rgba(242,179,61,.15); }
.sw.on i { left:17px; background:var(--amber); }

@media (prefers-reduced-motion: reduce) { .cd *, .cd *::after { animation:none !important; transition:none !important; } }
@media (max-width:560px) {
  .cd { padding: max(18px, env(safe-area-inset-top)) 14px calc(48px + env(safe-area-inset-bottom)) 14px; }
  .verdict h2 { font-size:32px; }
  .pillar { grid-template-columns:26px 1fr; }
  .pillar .sig { grid-column:2; justify-self:start; margin-top:8px; }
  table.tbl th:nth-child(n+4), table.tbl td:nth-child(n+4) { display:none; }
}
`;

/* ================= framework library =================
   Each pillar is a template you can edit. Wording here flows
   straight into the prompts, so editing a method changes the analysis. */
const DEFAULTS = {
  politics: {
    label: "Politics",
    items: [
      ["Polls Analysis", "Compare current polling averages against the market's implied probability. Note sample sizes, pollster ratings and trend direction.", "538, RealClearPolitics, Silver Bulletin"],
      ["Economic Impact", "Assess how GDP, unemployment and inflation are moving, and how that historically shifts incumbent vote share.", "BLS, BEA, FRED"],
      ["Approval Ratings", "Track favourability and job approval for the named figures, including direction over the last 30 days.", "Gallup, 538 approval tracker"],
      ["Cross-Platform Markets", "Compare the equivalent contract on the other venue and note any divergence in implied probability.", "Polymarket, Kalshi"],
      ["Breaking News", "Find events in the last 72 hours that plausibly move this outcome, and judge whether the market has already absorbed them.", "Reuters, AP, major outlets"],
      ["Regional Patterns", "Break the outcome down by state or district where relevant, focusing on the marginal seats that decide it.", "State polling, past margins"],
      ["Social Sentiment", "Read political discussion volume and direction, treating it as a crowd signal rather than evidence.", "Reddit, X"],
      ["Data Uncertainty", "State the confidence interval around the central estimate and how wide it should be given the time to resolution.", "Poll margins of error"],
      ["Contrarian Risk", "Argue the opposite case. What would make the market price correct after all?", "—"],
    ],
    groups: [[1, 3], [2, 6], [4, 8], [5, 7]],
  },
  sports: {
    label: "Sports",
    items: [
      ["Vegas Lines", "Pull the current spread, moneyline and total, and convert the moneyline to a no-vig implied probability.", "Action Network, VegasInsider"],
      ["Line Movement", "Compare opening to current line and identify whether moves ran with or against public ticket share.", "Sportsbook line history"],
      ["Injury Reports", "Check official injury designations and late scratches for both sides, weighted by player usage.", "Official team reports, Rotowire"],
      ["Reddit Sentiment", "Read the consensus and note whether the popular side is the crowded one.", "r/sportsbook"],
      ["Team Statistics", "Look at recent form, head-to-head history and relevant splits like home/away or pace.", "Official league stats"],
      ["Situational Factors", "Account for rest days, travel distance, altitude, schedule spots and motivation.", "Schedule data"],
      ["Handle Splits", "Compare ticket percentage against money percentage to separate public volume from sharp money.", "Book-published splits"],
      ["Time Decay", "Assess how much can still change before tip-off or kick-off, and whether late moves are likely.", "—"],
      ["Contrarian Check", "Argue the fade. Is the popular side popular for good reasons, or is this a trap?", "—"],
    ],
    groups: [[1, 2], [3, 5], [4, 7], [6, 8]],
  },
  weather: {
    label: "Weather",
    items: [
      ["Forecast Consensus", "Compare GFS, ECMWF and the NWS local office forecast and state where they agree.", "NWS, NOAA, ECMWF"],
      ["Ensemble Spread", "Report the GEFS ensemble range for the relevant variable and how tight the members are.", "NOAA GEFS"],
      ["Forecast Skill Decay", "Weight the forecast by known accuracy at this lead time; day-7 skill is far weaker than day-2.", "NOAA verification stats"],
      ["Historical Base Rate", "Find the climatological frequency of this outcome at this station for this calendar window.", "NOAA climate normals"],
      ["Model Divergence", "Identify where the models disagree and which one the market appears to be pricing.", "Model comparison"],
      ["Micro-Climate Bias", "Account for station-specific effects: urban heat island, coastal influence, elevation.", "Station metadata"],
      ["Storm Track", "For tropical systems, read the NHC cone and intensity guidance, including uncertainty at landfall.", "NHC"],
      ["Market Pricing", "Convert the forecast into a probability and compare it directly to the contract price.", "—"],
      ["Contrarian Check", "Check for overshoot. Forecast-driven markets often overreact to a single model run.", "—"],
    ],
    groups: [[1, 5], [2, 3], [4, 6], [7, 8]],
  },
  finance: {
    label: "Finance",
    items: [
      ["Technical Analysis", "Read price structure: trend, RSI, moving averages and the nearest support and resistance to the strike.", "TradingView, exchange data"],
      ["Fundamental Metrics", "Check the fundamentals that bear on the outcome: earnings, revenue trend, valuation.", "Company filings"],
      ["Smart Money", "Look for institutional positioning, insider transactions and unusual options flow.", "SEC filings, flow data"],
      ["Reddit Sentiment", "Gauge retail positioning and whether the trade is already crowded.", "r/wallstreetbets, r/stocks"],
      ["Macro Indicators", "Factor in Fed policy path, inflation prints and rate expectations relevant to the horizon.", "FRED, CME FedWatch"],
      ["News Catalysts", "Map scheduled catalysts between now and resolution: earnings dates, CPI prints, product events.", "Earnings calendars"],
      ["Social Velocity", "Measure whether attention is accelerating or fading, as a momentum proxy.", "X, Google Trends"],
      ["Market Signals", "Read volume, bid-ask spread and order book depth on the contract itself.", "Venue order book"],
      ["Contrarian Check", "Test whether this is an overcrowded trade where the obvious read is already priced.", "—"],
    ],
    groups: [[1, 8], [2, 3], [4, 7], [5, 6]],
  },
  general: {
    label: "General",
    items: [
      ["Base Rate", "Find how often this class of event has happened historically, and start from that number.", "Historical records"],
      ["Official Benchmarks", "Check what official bodies or domain experts currently forecast.", "Agency forecasts"],
      ["Reddit Sentiment", "Read the relevant subreddit consensus as a crowd signal.", "Reddit"],
      ["Social Velocity", "Judge whether attention on this topic is building or decaying.", "X, Google Trends"],
      ["News Recency", "Surface anything from the last 24 to 72 hours that changes the picture.", "Reuters, AP"],
      ["Source Quality", "Rate the credibility of what you found and flag anything resting on a single weak source.", "—"],
      ["Time Decay", "Consider how much time remains and how much can still change before resolution.", "—"],
      ["Market Signals", "Read the contract's own volume, price direction and liquidity.", "Venue data"],
      ["Contrarian Check", "Look for the hidden edge, especially in the resolution criteria themselves.", "—"],
    ],
    groups: [[1, 2], [3, 4], [5, 6], [7, 8]],
  },
};

function buildFrameworks() {
  const out = {};
  for (const [k, v] of Object.entries(DEFAULTS)) {
    out[k] = {
      label: v.label,
      groups: v.groups,
      items: v.items.map(([name, method, sources], i) => ({
        n: i + 1, name, method, sources, weight: 1, enabled: true,
      })),
    };
  }
  return out;
}

/* ================= helpers ================= */
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
// US sports schedules (and Kalshi game tickers) run on Eastern time. The UTC
// date rolls over at 5pm Phoenix time, which made every night game query
// tomorrow's slate — use the ET calendar date instead.
const etDate = (ms) => new Date(ms != null ? ms : Date.now())
  .toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const today = () => etDate();
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const STOP = new Set("will the a an of in on at to be by for and or is are it its this that with from as no yes than more less".split(" "));
const toks = (s) => new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
function overlap(a, b) {
  const A = toks(a), B = toks(b);
  let hit = 0;
  A.forEach((t) => { if (B.has(t)) hit++; });
  return hit / Math.max(3, Math.min(A.size, B.size));
}

function parseUrl(raw) {
  const u = raw.trim();
  if (!u) return { error: "Paste a Kalshi or Polymarket market URL to start." };
  let host = "", parts = [], qs = new URLSearchParams();
  try {
    const url = new URL(u.startsWith("http") ? u : "https://" + u);
    host = url.hostname.replace(/^www\./, "");
    parts = url.pathname.split("/").filter(Boolean);
    qs = url.searchParams;
  } catch {
    return { error: "That doesn't parse as a URL. Copy the full link from your browser bar." };
  }
  if (host.includes("polymarket")) {
    const i = parts.findIndex((p) => p === "event" || p === "market" || p === "markets");
    const slug = i >= 0 ? parts[i + 1] : parts[parts.length - 1];
    if (!slug) return { error: "No market slug found in that Polymarket link." };
    return { venue: "Polymarket", slug, url: u };
  }
  if (host.includes("kalshi")) {
    const i = parts.findIndex((p) => p === "markets" || p === "events");
    const segs = (i >= 0 ? parts.slice(i + 1) : parts).filter(Boolean);
    if (!segs.length) return { error: "No series or event ticker found in that Kalshi link." };
    return { venue: "Kalshi", segs, ticker: qs.get("ticker"), url: u };
  }
  return { error: "Only Kalshi and Polymarket links work here. Check the domain." };
}

const jparse = (v) => { try { return typeof v === "string" ? JSON.parse(v) : v || []; } catch { return []; } };

// Kalshi web URLs for a specific game are /markets/{series}/{series-slug}/
// {event-ticker}. These slugs are the slugified series titles (fetched from
// the API); without them a link only reaches the whole series, not the game.
const SERIES_SLUG = {
  KXNBAGAME: "pro-basketball-game", KXWNBAGAME: "womens-pro-basketball-game",
  KXMLBGAME: "professional-baseball-game", KXNFLGAME: "professional-football-game",
  KXNHLGAME: "nhl-game", KXCFBGAME: "college-football-game", KXNCAAFGAME: "college-football-game",
  KXCBBGAME: "college-basketball-game", KXNCAABGAME: "college-basketball-game",
  KXATPMATCH: "atp-tennis-match", KXWTAMATCH: "wta-tennis-match", KXUFCFIGHT: "ufc-fight",
  KXEPLGAME: "english-premier-league-game", KXMLSGAME: "major-league-soccer-game",
  KXUCLGAME: "uefa-champions-league-game", KXLALIGAGAME: "la-liga-game",
  KXSERIEAGAME: "serie-a-game", KXBUNDESLIGAGAME: "bundesliga-game",
  KXLIGUE1GAME: "ligue-1-game", KXLIGAMXGAME: "liga-mx-game",
  KXUELGAME: "uefa-europa-league-game", KXUECLGAME: "uefa-conference-league-game",
  KXEREDIVISIEGAME: "eredivisie-game", KXLIGAPORTUGALGAME: "liga-portugal-game",
  KXBRASILEIROGAME: "brasileiro-serie-a-game", KXEFLCHAMPIONSHIPGAME: "efl-championship-game",
  KXSUPERLIGGAME: "turkish-super-lig-game", KXBELGIANPLGAME: "belgian-pro-league-game",
  KXNWSLGAME: "nwsl-game", KXLEAGUESCUPGAME: "leagues-cup-game",
  KXSAUDIPLGAME: "saudi-pro-league-game", KXWCGAME: "world-cup-game",
  KXCFLGAME: "cfl-game", KXUFLGAME: "ufl-football-game",
  KXNCAAWBGAME: "college-basketball-womens-game",
  // Commodity + crypto series (slugified series titles from the API)
  KXBTC15M: "bitcoin-price-up-down", KXETH15M: "eth-15m-price-up-down",
  KXSOL15M: "solana-15-minutes", KXXRP15M: "xrp-15-minute", KXDOGE15M: "dogecoin-15-minute",
  KXWTI: "wti-oil-on-day", KXWTIW: "wti-oil-weekly-range", KXBRENTD: "brent-oil-daily",
  KXGOLDD: "gold-daily", KXGOLDW: "gold-weekly-price",
  KXSILVERD: "silver-daily", KXSILVERW: "silver-weekly-price",
  KXBTCD: "bitcoin-price-above-below", KXETHD: "ethereum-price-above-below",
  KXBTC: "bitcoin-range", KXETH: "ethereum-range",
  KXGOLDH: "gold-hourly", KXSILVERH: "silver-hourly",
  KXGOLD15M: "gold-15-minute", KXSILVER15M: "silver-15-minute", KXWTI15M: "wti-15-minute",
  KXINX15M: "s-p-500-15-minute", KXNDQ15M: "nasdaq-100-15-minute",
};
function kalshiEventLink(ticker) {
  const parts = String(ticker || "").split("-");
  const series = parts[0];
  // Commodity + crypto markets (incl. 15-minute windows) live under
  // /markets/kx/m/{event-ticker} — a Google-indexed live page confirmed
  // the shape; the sports-style slug path redirects to the portfolio.
  if (/^(KXWTI|KXBRENTD|KXGOLD|KXSILVER|KXBTC|KXETH|KXSOL|KXXRP|KXDOGE|KXADA|KXBNB|KXINX15M|KXNDQ15M)/.test(series) && parts.length >= 2) {
    return "https://kalshi.com/markets/kx/m/" + parts.slice(0, -1).join("-").toLowerCase();
  }
  // Combos (KXMVE*) have no public market page — Kalshi only shows them in
  // the holder's portfolio (verified: event-page URLs redirect to the
  // homepage). Link where the combo actually lives.
  if (/^KXMVE/.test(series)) return "https://kalshi.com/portfolio";
  const base = "https://kalshi.com/markets/" + series.toLowerCase();
  const slug = SERIES_SLUG[series];
  if (!slug || parts.length < 2) return base;
  return base + "/" + slug + "/" + parts.slice(0, -1).join("-").toLowerCase();
}

function pmMarket(m, ev) {
  const outs = jparse(m.outcomes), pxs = jparse(m.outcomePrices).map(Number);
  const yi = Math.max(0, outs.findIndex((o) => String(o).toLowerCase() === "yes"));
  const price = Number.isFinite(pxs[yi]) ? pxs[yi] * 100 : null;
  return {
    id: m.conditionId || String(m.id),
    token: jparse(m.clobTokenIds)[yi] || null,
    slug: (ev && ev.slug) || m.slug,
    name: m.groupItemTitle || m.question || (ev && ev.title),
    question: m.question || (ev && ev.title),
    price,
    volume: Number(m.volumeNum || m.volume || 0),
    liquidity: Number(m.liquidityNum || m.liquidity || 0),
    close: m.endDate || (ev && ev.endDate) || null,
    rules: String(m.description || (ev && ev.description) || "").slice(0, 900),
    venue: "Polymarket",
    link: "https://polymarket.com/event/" + ((ev && ev.slug) || m.slug || ""),
  };
}

async function fetchPolymarket(p) {
  const r = await fetch(px("https://gamma-api.polymarket.com/events?slug=" + encodeURIComponent(p.slug)));
  if (!r.ok) throw new Error("Polymarket API returned " + r.status);
  const data = await r.json();
  const ev = Array.isArray(data) ? data[0] : data;
  if (!ev || !ev.markets || !ev.markets.length) throw new Error("No markets on that event.");
  const markets = ev.markets
    .filter((m) => m.active !== false && m.archived !== true)
    .map((m) => pmMarket(m, ev))
    .filter((m) => m.price !== null)
    .sort((a, b) => b.price - a.price);
  if (!markets.length) throw new Error("No priced markets on that event.");
  return { venue: "Polymarket", event: ev.title, markets, source: "live API" };
}

// Kalshi now publishes prices as decimal dollars (yes_bid_dollars: 0.45) and
// sizes as fixed-point (volume_fp). Older payloads used integer cents. Read both.
function kaPrice(m) {
  const n = (x) => {
    if (x === null || x === undefined || x === "") return null;
    const v = Number(x);
    return Number.isFinite(v) ? v : null;
  };
  // Cents fields, used as-is.
  const cents = (...names) => { for (const k of names) { const v = n(m[k]); if (v !== null) return v; } return null; };
  // Dollar fields, scaled to cents.
  const dol = (...names) => { for (const k of names) { const v = n(m[k]); if (v !== null) return v * 100; } return null; };
  const or = (a, b) => (a !== null ? a : b);

  let bid = or(cents("yes_bid", "best_yes_bid"), dol("yes_bid_dollars", "previous_yes_bid_dollars"));
  let ask = or(cents("yes_ask", "best_yes_ask"), dol("yes_ask_dollars", "previous_yes_ask_dollars"));
  const noBid = or(cents("no_bid", "best_no_bid"), dol("no_bid_dollars"));
  const noAsk = or(cents("no_ask", "best_no_ask"), dol("no_ask_dollars"));
  if (bid === null && noAsk !== null) bid = 100 - noAsk;
  if (ask === null && noBid !== null) ask = 100 - noBid;
  const last = or(cents("last_price", "yes_price"), dol("last_price_dollars", "previous_price_dollars"));

  let price = null;
  if (last !== null && last > 0) price = last;
  else if (bid !== null && ask !== null) price = (bid + ask) / 2;
  else if (bid !== null) price = bid;
  else if (ask !== null) price = ask;
  else if (last !== null) price = last;
  return { price, bid, ask };
}

function kaMarket(m) {
  const { price, bid, ask } = kaPrice(m);
  const num = (x) => { const v = Number(x); return Number.isFinite(v) ? v : 0; };
  return {
    id: m.ticker,
    name: m.yes_sub_title || m.subtitle || m.title || m.ticker,
    question: m.title || m.ticker,
    price,
    quoted: price !== null && price > 0,
    bid, ask,
    status: m.status || null,
    result: m.result || null,
    // Multivariate (parlay) markets carry their exact legs — without them
    // the title ("yes Milwaukee,yes New York") names no sport or opponent.
    legs: Array.isArray(m.mve_selected_legs) && m.mve_selected_legs.length
      ? m.mve_selected_legs.map((l) => ({ ticker: l.market_ticker, side: (l.side || "yes").toUpperCase() }))
      : null,
    volume: num(m.volume) || num(m.volume_fp) || num(m.volume_24h_fp),
    liquidity: num(m.open_interest) || num(m.open_interest_fp) || num(m.liquidity_dollars),
    close: m.close_time || null,
    rules: String(m.rules_primary || "").slice(0, 900),
    venue: "Kalshi",
    link: kalshiEventLink(m.ticker),
  };
}

async function fetchKalshi(p) {
  const base = "https://api.elections.kalshi.com/trade-api/v2";
  const segs = p.segs || [];
  const tried = [];

  // Pull markets out of whichever shape the endpoint returns.
  const get = async (url) => {
    let r;
    try {
      r = await fetch(px(url));
    } catch (e) {
      tried.push(url.replace(base, "") + " -> " + e.message);
      return null;
    }
    if (!r.ok) { tried.push(url.replace(base, "") + " -> " + r.status); return null; }
    const d = await r.json();
    const ms = []
      .concat(d.markets || [])
      .concat(d.market ? [d.market] : [])
      .concat(d.event && d.event.markets ? d.event.markets : [])
      .concat((d.events || []).flatMap((e) => e.markets || []));
    tried.push(url.replace(base, "") + " -> " + r.status + " (" + ms.length + " markets)");
    if (!ms.length) return null;
    const title = (d.event && d.event.title) || (d.events && d.events[0] && d.events[0].title) || null;
    return { ms, title };
  };

  // A full market ticker contains a dash (KXWTAMATCH-25AUG08SWI); a series ticker doesn't.
  const looksTicker = (x) => /-/.test(x) && /\d/.test(x);
  const tickers = segs.filter(looksTicker).map((x) => x.toUpperCase());
  const series = segs.filter((x) => !looksTicker(x)).map((x) => x.toUpperCase());

  let raw = null;

  if (p.ticker) raw = await get(base + "/markets?tickers=" + encodeURIComponent(p.ticker.toUpperCase()));

  for (const T of tickers) {
    if (raw) break;
    raw = await get(base + "/markets?tickers=" + encodeURIComponent(T));
    if (!raw) raw = await get(base + "/events/" + encodeURIComponent(T) + "?with_nested_markets=true");
  }

  for (const S of series) {
    if (raw) break;
    for (const url of [
      base + "/events?series_ticker=" + S + "&with_nested_markets=true&limit=200",
      base + "/markets?series_ticker=" + S + "&status=open&limit=200",
      base + "/markets?event_ticker=" + S + "&limit=200",
      base + "/events/" + S + "?with_nested_markets=true",
    ]) {
      const got = await get(url);
      if (!got) continue;
      // Guard: if the API ignored an unsupported filter it hands back unrelated
      // markets. Every ticker in this series must start with the series ticker.
      const own = got.ms.filter((m) => String(m.ticker || "").toUpperCase().startsWith(S));
      if (own.length) { raw = { ms: own, title: got.title }; break; }
      tried.push("  ^ discarded: none of those tickers start with " + S);
    }
  }

  // Last resort: match the words in the URL slug against open market titles.
  if (!raw && segs.length) {
    const words = segs.join(" ").replace(/-/g, " ");
    const got = await get(base + "/markets?status=open&limit=1000");
    if (got) {
      const scored = got.ms
        .map((m) => ({ m, s: overlap(words, (m.title || "") + " " + (m.subtitle || m.yes_sub_title || "")) }))
        .filter((x) => x.s > 0.34)
        .sort((a, b) => b.s - a.s)
        .slice(0, 40);
      if (scored.length) raw = { ms: scored.map((x) => x.m), title: null, fuzzy: true };
    }
  }

  if (!raw) {
    throw new Error("no Kalshi endpoint matched this link.\nAttempts:\n" + tried.join("\n"));
  }

  // Nested market records from /events are trimmed and carry no quotes.
  // Re-fetch the full records for anything missing a bid, ask and last price.
  const thin = raw.ms.filter((m) => m.yes_bid == null && m.yes_ask == null && m.last_price == null);
  if (thin.length) {
    const byTicker = {};
    for (let i = 0; i < thin.length && i < 200; i += 40) {
      const batch = thin.slice(i, i + 40).map((m) => m.ticker).filter(Boolean);
      if (!batch.length) continue;
      const got = await get(base + "/markets?tickers=" + encodeURIComponent(batch.join(",")));
      (got ? got.ms : []).forEach((m) => { byTicker[m.ticker] = m; });
    }
    raw.ms = raw.ms.map((m) => byTicker[m.ticker] || m);
  }

  const all = raw.ms.map(kaMarket);
  const priced = all.filter((m) => m.price !== null);
  const tradeable = priced.filter((m) => !m.status || /open|active/i.test(m.status));
  let markets = tradeable.length ? tradeable : priced;

  if (!markets.length) {
    const counts = {};
    all.forEach((m) => { const k = m.status || "no status"; counts[k] = (counts[k] || 0) + 1; });
    const summary = Object.entries(counts).map(([k, v]) => v + " " + k).join(", ");
    throw new Error(
      "Found " + all.length + " contracts in this series but none are currently quoted (" + summary + ").\n\n" +
      "This usually means the series has no live matches right now. Try the Browse markets tab to see what is actually trading."
    );
  }

  // A series page holds many contests. Busiest and soonest first beats price order.
  markets = markets.length > 3
    ? markets.sort((a, b) => (b.volume - a.volume) || (new Date(a.close || 0) - new Date(b.close || 0)))
    : markets.sort((a, b) => b.price - a.price);

  return {
    venue: "Kalshi",
    event: raw.title || (markets.length > 1 ? segs.join(" / ").replace(/-/g, " ") : markets[0].question),
    markets,
    source: raw.fuzzy ? "matched by keyword" : "live API",
  };
}

/* ---- price history ----
   What a market did over the last week tells you whether the news is
   already in the price — the single most common way naive edges die. */
async function fetchHistory(m) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const weekAgo = now - 7 * 86400;
    let points = [];
    if (m.venue === "Kalshi") {
      const series = String(m.id).split("-")[0];
      const r = await fetch(px("https://api.elections.kalshi.com/trade-api/v2/series/" + series +
        "/markets/" + m.id + "/candlesticks?start_ts=" + weekAgo + "&end_ts=" + now + "&period_interval=60"));
      if (!r.ok) return null;
      const d = await r.json();
      points = (d.candlesticks || []).map((c) => {
        const pr = c.price || {};
        const v = pr.close != null ? pr.close : pr.mean != null ? pr.mean : (c.yes_bid && c.yes_bid.close);
        return v == null ? null : { t: Number(c.end_period_ts), p: Number(v) };
      }).filter((x) => x && Number.isFinite(x.p));
    } else {
      if (!m.token) return null;
      const r = await fetch(px("https://clob.polymarket.com/prices-history?market=" +
        encodeURIComponent(m.token) + "&interval=1w&fidelity=120"));
      if (!r.ok) return null;
      const d = await r.json();
      points = (d.history || []).map((h) => ({ t: Number(h.t), p: Number(h.p) * 100 }))
        .filter((x) => Number.isFinite(x.p));
    }
    if (points.length < 2) return null;
    // Some payloads quote dollars, others cents — normalise to cents. A
    // dollar feed has fractional values (0.45); a cents feed pinned at 1
    // is a real 1c longshot, not $1, so require a fraction before scaling.
    if (Math.max.apply(null, points.map((pt) => pt.p)) <= 1.001 &&
        points.some((pt) => pt.p % 1 !== 0)) points = points.map((pt) => ({ t: pt.t, p: pt.p * 100 }));
    points.sort((a, b) => a.t - b.t);
    const at = (secsAgo) => {
      const target = now - secsAgo;
      let best = points[0];
      for (const pt of points) if (Math.abs(pt.t - target) < Math.abs(best.t - target)) best = pt;
      return best.p;
    };
    const last = points[points.length - 1].p;
    return { points, last, change24h: last - at(86400), change7d: last - points[0].p };
  } catch { return null; }
}

const histSummary = (h) => !h ? "" :
  "\nPRICE HISTORY: 7d change " + (h.change7d >= 0 ? "+" : "") + h.change7d.toFixed(1) +
  "c, 24h change " + (h.change24h >= 0 ? "+" : "") + h.change24h.toFixed(1) +
  "c. A market that already moved may have priced in the news — judge what is genuinely new versus already absorbed.";

const marketSpread = (m) => (m.ask != null && m.bid != null ? m.ask - m.bid : null);
const isThin = (m) => {
  const s = marketSpread(m);
  return (s != null && s > 8) || (m.volume != null && m.volume > 0 && m.volume < 1000);
};

/* ---- open positions: quotes and stay/sell advice ---- */
// Full quote — mid/last for display, bid/ask for what a sale would really
// collect right now.
async function fetchCurrentPrice(e) {
  try {
    if (e.venue === "Kalshi") {
      const r = await fetch(px("https://api.elections.kalshi.com/trade-api/v2/markets/" + e.marketId));
      if (!r.ok) return null;
      const d = await r.json();
      if (d.market) {
        const k = kaPrice(d.market);
        return k.price != null ? { price: k.price, bid: k.bid, ask: k.ask } : null;
      }
    } else if (e.slug) {
      const r = await fetch(px("https://gamma-api.polymarket.com/events?slug=" + encodeURIComponent(e.slug)));
      if (!r.ok) return null;
      const d = await r.json();
      const ev = Array.isArray(d) ? d[0] : d;
      const m = ev && (ev.markets || []).find((x) => (x.conditionId || String(x.id)) === e.marketId);
      if (m) {
        const p = pmMarket(m, ev).price;
        const n = (x) => { const v = Number(x); return Number.isFinite(v) ? v * 100 : null; };
        return p != null ? { price: p, bid: n(m.bestBid), ask: n(m.bestAsk) } : null;
      }
    }
  } catch { /* quote later */ }
  return null;
}

// Deterministic stay/sell guidance — free to compute, honest about its
// source. During a live game the win-probability model outranks the desk's
// own (possibly hours-old) fair value.
function positionAdvice(e, cur, live, quote, cmb) {
  const side = e.taken.side;
  const curSide = side === "YES" ? cur : 100 - cur;
  const pnl = curSide - e.taken.entryPrice;
  // What selling actually collects: YES exits at the bid, NO at (100 - ask).
  // Without a visible book, assume half a cent inside the last price.
  const bid = quote && quote.bid != null ? quote.bid : null;
  const ask = quote && quote.ask != null ? quote.ask : null;
  const sellAt = side === "YES" ? (bid != null ? bid : curSide - 0.5)
    : (ask != null ? 100 - ask : curSide - 0.5);

  // A parlay with a lost leg is decided, whatever the combo still quotes.
  if (cmb && cmb.dead) {
    const salvage = (side === "YES" ? sellAt : 100 - sellAt) - takerFee(e.venue, clamp(sellAt, 0.5, 99.5));
    const doomed = side === "YES"; // YES on the combo needs every leg
    if (doomed) {
      return salvage >= 2
        ? { act: "SELL NOW", why: "A leg has LOST — the parlay can only resolve NO now. Selling salvages ~" + salvage.toFixed(0) + "c a contract; holding returns nothing." }
        : { act: "SETTLING", why: "A leg has lost, so this parlay resolves NO. No bid worth hitting — it settles at zero." };
    }
    return { act: "SETTLING", why: "A leg has lost, so the parlay resolves NO — your NO side wins at settlement. Holding to resolution collects the full 100c." };
  }

  if (live && live.sides && live.state === "post") {
    return { act: "SETTLING", why: "The game is final. This resolves shortly — nothing left to decide." };
  }

  // Choose the best CURRENT estimate of what the side is worth. Order of
  // trust: a live in-game win probability, then a genuinely recent analysis
  // (only when no game is in progress — a pre-game fair value is meaningless
  // once the game starts), then the market itself. Critically, never let a
  // stale fair value declare a position mispriced: if there's no fresh
  // independent read, the market price IS the fair estimate.
  const inGame = !!(live && live.sides && !live.none);
  const liveProb = (live && live.impliedCents != null && live.state === "in" && !live.disagree)
    ? (side === "YES" ? live.impliedCents : 100 - live.impliedCents) : null;
  const hasAnalysis = Array.isArray(e.pillars) && e.pillars.length > 0 && e.call !== "SYNCED";
  const freshAnalysis = hasAnalysis && (Date.now() - (e.ts || 0) < 3 * 3600 * 1000);
  const fairSide = side === "YES" ? e.fair : 100 - e.fair;

  let eff, src, independent;
  if (cmb) {
    // The legs' combined read prices the combo better than its own thin
    // quote ever can — and it's live whenever any leg's game is.
    eff = side === "YES" ? cmb.prob : 100 - cmb.prob;
    src = cmb.live ? "the legs' live win odds" : "the legs' own market prices";
    independent = true;
  }
  else if (liveProb != null) { eff = liveProb; src = "the live win probability"; independent = true; }
  else if (freshAnalysis && !inGame) { eff = fairSide; src = "my recent analysis"; independent = true; }
  else { eff = curSide; src = "the market price"; independent = false; }

  // Entry price is sunk — decisions are forward-looking only. Selling pays
  // the taker fee and collects the bid, not the last print; holding to
  // resolution is free. So exiting is only right when an INDEPENDENT read
  // says the sale nets more than the position is worth.
  const exitFee = takerFee(e.venue, clamp(sellAt, 0.5, 99.5));
  const proceeds = sellAt - exitFee; // per contract, if sold right now

  if (independent && proceeds - eff >= 2) {
    return { act: pnl >= 0 ? "TAKE PROFIT" : "SELL NOW",
      why: "By " + src + " your side is worth about " + eff.toFixed(0) + "c, but selling nets ~" + proceeds.toFixed(0) +
        "c after the " + exitFee.toFixed(1) + "c fee — the market is paying more than the position is worth." };
  }
  // Adding pays the ask plus the taker fee — a higher bar than holding
  // (which is free). Only an independent read clearing that all-in cost by
  // a real margin justifies putting more money in.
  const buyAt = side === "YES" ? (ask != null ? ask : curSide + 0.5) : (bid != null ? 100 - bid : curSide + 0.5);
  const addCost = buyAt + takerFee(e.venue, clamp(buyAt, 0.5, 99.5));
  if (independent && eff - addCost >= 3) {
    return { act: "BUY MORE",
      why: "By " + src + " your side is worth about " + eff.toFixed(0) + "c and adding costs ~" + addCost.toFixed(1) +
        "c all-in (ask + fee) — roughly " + (eff - addCost).toFixed(0) + "c of edge on every contract you add. " +
        "Keep additions small; the read can move fast" + (liveProb != null ? " mid-game" : "") + "." };
  }
  if (independent && eff - proceeds >= 2) return { act: "HOLD",
    why: "About " + (eff - proceeds).toFixed(0) + "c of edge left by " + src + " over what a sale nets today. " +
      (pnl >= 0 ? "Up " : "Down ") + Math.abs(pnl).toFixed(0) + "c a contract so far." };

  if (!independent) return { act: "HOLD",
    why: "No fresh independent read right now, so the market price is the best estimate — it already reflects a " +
      curSide.toFixed(0) + "% chance, which is what your side is worth. Selling only nets ~" + proceeds.toFixed(0) +
      "c after fees and the spread; holding to resolution is free and wins that " + curSide.toFixed(0) +
      "% of the time. What you paid (" + Number(e.taken.entryPrice).toFixed(0) + "c) is already spent and shouldn't drive this." };

  return { act: "HOLD",
    why: "Priced about right by " + src + ": worth ~" + eff.toFixed(0) + "c, and a sale nets ~" + proceeds.toFixed(0) +
      "c after fees. Holding to resolution costs nothing and wins " +
      eff.toFixed(0) + "% of the time. What you paid (" + Number(e.taken.entryPrice).toFixed(0) +
      "c) is already spent — it shouldn't drive this decision." };
}

const ADVICE_COLORS = { HOLD: "var(--moss)", "BUY MORE": "var(--cyan)", "TAKE PROFIT": "var(--amber)", "SELL NOW": "var(--rose)", "RE-CHECK": "var(--cyan)", SETTLING: "var(--dim)" };

// Translate a BUY YES/NO verdict into the plain side to wager on, naming the
// actual outcome (and the opponent for a game, when we can find it).
function betSide(result, market, live) {
  if (!result || result.call === "PASS") return null;
  const name = market.name || "this outcome";
  if (result.side === "YES") return { who: name, plain: "betting " + name + " happens" };
  let opp = null;
  if (live && live.sides && live.mySide) {
    const other = live.sides.find((s) => s.name && s.name !== live.mySide.name);
    if (other) opp = other.name;
  }
  return opp
    ? { who: opp, plain: "backing " + opp + ", the other side" }
    : { who: "NOT " + name, plain: "betting " + name + " does not happen" };
}

// Who's going to win? The live model first, the final score when the game
// is over, else the market's own price for the named outcome.
function likelyWinner(live, fallbackName, fallbackProb) {
  if (live && live.sides && live.state === "post") {
    const byScore = live.sides.slice().sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
    if (byScore[0] && (Number(byScore[0].score) || 0) > (Number(byScore[1] && byScore[1].score) || 0)) {
      return { name: byScore[0].name, pct: 100, final: true };
    }
  }
  if (live && live.homeWinPct != null && live.sides) {
    const home = live.sides.find((s) => s.home) || live.sides[1];
    const away = live.sides.find((s) => !s.home) || live.sides[0];
    const p = live.homeWinPct;
    if (home && away) {
      return p >= 50 ? { name: home.name, pct: p } : { name: away.name, pct: 100 - p };
    }
  }
  if (fallbackProb != null && fallbackName && fallbackProb >= 50) {
    return { name: fallbackName, pct: fallbackProb, market: true };
  }
  return null;
}

/* ---- parlay legs ----
   A combo market's own title names no sport, no opponent and no date. The
   legs' real markets do. Everything downstream (research prompts, live
   feeds, advice) must run on the LEGS, never on a guess from the title. */
async function resolveLegs(m) {
  if (!m.legs || !m.legs.length) return null;
  try {
    const r = await fetch(px("https://api.elections.kalshi.com/trade-api/v2/markets?tickers=" +
      encodeURIComponent(m.legs.map((l) => l.ticker).join(","))));
    if (!r.ok) return null;
    const d = await r.json();
    const byT = {};
    (d.markets || []).forEach((raw) => { byT[raw.ticker] = raw; });
    const out = m.legs.map((l) => {
      const raw = byT[l.ticker];
      const km = raw ? kaMarket(raw) : null;
      const lg = detectLeague({ id: l.ticker, question: km ? km.question : "", name: km ? km.name : "" });
      return {
        ticker: l.ticker, side: l.side,
        name: km ? km.name : l.ticker, question: km ? km.question : l.ticker,
        price: km ? km.price : null, result: km ? km.result : null,
        league: lg ? lg.label : null, date: tickerDate(l.ticker),
      };
    });
    return out.every((l) => l) ? out : null;
  } catch { return null; }
}

const legsText = (legs) => legs.map((l, i) =>
  "Leg " + (i + 1) + ": " + l.side + " on \"" + l.name + "\" in " + (l.league || "?") +
  " game \"" + l.question + "\"" + (l.date ? " (game date " + l.date + " ET)" : "") +
  (l.price != null ? " — this leg's own market trades at " + l.price.toFixed(0) + "c" : "") +
  (l.result ? " — SETTLED " + l.result.toUpperCase() : "")
).join("\n");

// Combined worth of a parlay right now: product over legs of the best read
// on each leg (settled result > live win prob > final score > leg price).
function legsCombined(legs, legLiveArr) {
  if (!legs || !legs.length) return null;
  let prod = 1, liveCount = 0, dead = false, priced = 0;
  const parts = [];
  legs.forEach((l, i) => {
    const ll = legLiveArr && legLiveArr[i] && !legLiveArr[i].none ? legLiveArr[i] : null;
    let p = null, src = "price";
    if (l.result === "yes" || l.result === "no") {
      const won = (l.result === "yes") === (l.side === "YES");
      p = won ? 100 : 0; src = "settled";
      if (!won) dead = true;
    } else if (ll && ll.impliedCents != null && ll.state === "in" && !ll.disagree) {
      p = l.side === "YES" ? ll.impliedCents : 100 - ll.impliedCents;
      src = "live"; liveCount++;
    } else if (ll && ll.state === "post") {
      const w = likelyWinner(ll, l.name, null);
      if (w && w.final) {
        const won = overlap(w.name, l.name) > 0.3;
        p = won ? 100 : 0; src = "final";
        if (!won) dead = true;
      }
    }
    if (p == null && l.price != null) { p = l.side === "YES" ? l.price : 100 - l.price; src = "price"; }
    if (p == null) { p = 50; src = "unknown"; }
    else priced++;
    prod *= clamp(p, 0, 100) / 100;
    parts.push({ p, src });
  });
  return { prob: 100 * prod, live: liveCount > 0, dead, priced, parts };
}

// Per-leg live state for the research prompts.
function legsLiveSummary(legs, legLiveArr) {
  if (!legs || !legs.length) return "";
  const cmb = legsCombined(legs, legLiveArr);
  let out = "\n\nTHIS CONTRACT IS A PARLAY — it resolves YES only if EVERY leg below hits. " +
    "The named teams and sports are EXACT; do not substitute other teams that share a city name.\n" + legsText(legs);
  (legLiveArr || []).forEach((ll, i) => {
    const s = liveSummary(ll);
    if (s) out += "\nLeg " + (i + 1) + " live state:" + s.replace(/^\n+/, " ");
  });
  if (cmb) out += "\nDETERMINISTIC COMBINED READ: the legs multiply to about " + cmb.prob.toFixed(1) +
    "c for the parlay" + (cmb.dead ? " — a leg has LOST, the parlay is dead and resolves NO." : ".");
  return out;
}

/* ---- event board: who wins, and every bet on this event ----
   Deterministic and free: pairs each sibling outcome with the live model /
   book consensus, nets out entry cost and fees, and names the best pick. */
function eventBoard(book, live) {
  if (!book || !book.markets || !live || live.none || !live.sides) return null;
  const ob = live.oddsBook;
  const sideFor = (name) => {
    let bi = -1, bs = 0, ss = 0;
    live.sides.forEach((sd, i) => {
      const sc = overlap(name || "", sd.name);
      if (sc > bs) { ss = bs; bs = sc; bi = i; } else if (sc > ss) ss = sc;
    });
    return bi >= 0 && bs > 0.3 && bs - ss > 0.12 ? live.sides[bi] : null;
  };
  const rows = book.markets.slice(0, 8).map((mm) => {
    let prob = null, src = null;
    const sd = sideFor(mm.name);
    if (sd && live.homeWinPct != null && live.state === "in") {
      prob = sd.home ? live.homeWinPct : 100 - live.homeWinPct; src = "live model";
    } else if (sd && ob) {
      prob = sd.home ? ob.home : ob.away; src = ob.books + " books";
    } else if (/\btie\b|\bdraw\b/i.test(mm.name || "") && ob && ob.draw != null) {
      prob = ob.draw; src = ob.books + " books";
    }
    const entry = mm.ask != null ? mm.ask : mm.price;
    const fee = entry != null ? takerFee(mm.venue, entry) : 0;
    const net = prob != null && entry != null ? prob - entry - fee : null;
    return { m: mm, prob, src, entry, net };
  });
  const withNet = rows.filter((r) => r.net != null);
  const best = withNet.length ? withNet.reduce((b, r) => (r.net > b.net ? r : b)) : null;
  let winner = likelyWinner(live, null, null);
  if (!winner && ob) {
    const home = live.sides.find((s) => s.home), away = live.sides.find((s) => !s.home);
    if (home && away) winner = ob.home >= ob.away
      ? { name: home.name, pct: ob.home, book: true }
      : { name: away.name, pct: ob.away, book: true };
  }
  return { rows, best, winner };
}

/* ---- order book + slippage ---- */
async function fetchBook(m) {
  try {
    if (m.venue === "Kalshi") {
      const r = await fetch(px("https://api.elections.kalshi.com/trade-api/v2/markets/" + m.id + "/orderbook?depth=12"));
      if (!r.ok) return null;
      const d = await r.json();
      const ob = d.orderbook || {};
      const rows = (a) => (a || []).map((r) => [Number(r[0]), Number(r[1])]).filter((r) => Number.isFinite(r[0]));
      // Levels may arrive in dollars (0.45) or cents (45). Scale if they look decimal.
      const toCents = (rs) => (rs.length && Math.max.apply(null, rs.map((r) => r[0])) <= 1.001
        ? rs.map((r) => [r[0] * 100, r[1]]) : rs);
      const yes = toCents(rows(ob.yes || ob.yes_dollars));
      const no = toCents(rows(ob.no || ob.no_dollars));
      // Buying YES fills against resting NO bids at (100 - no price).
      const asks = no.map((r) => [100 - r[0], r[1]]).sort((a, b) => a[0] - b[0]);
      const bids = yes.slice().sort((a, b) => b[0] - a[0]);
      return { asks, bids, unit: "contracts" };
    }
    if (!m.token) return null;
    const r = await fetch(px("https://clob.polymarket.com/book?token_id=" + encodeURIComponent(m.token)));
    if (!r.ok) return null;
    const d = await r.json();
    const asks = (d.asks || []).map((x) => [Number(x.price) * 100, Number(x.size)]).sort((a, b) => a[0] - b[0]);
    const bids = (d.bids || []).map((x) => [Number(x.price) * 100, Number(x.size)]).sort((a, b) => b[0] - a[0]);
    return { asks, bids, unit: "shares" };
  } catch { return null; }
}

function walkBook(levels, size) {
  let left = size, cost = 0, filled = 0;
  for (const [p, q] of levels) {
    const take = Math.min(left, q);
    cost += take * p; filled += take; left -= take;
    if (left <= 0) break;
  }
  if (filled === 0) return null;
  return { avg: cost / filled, filled, short: left > 0 ? left : 0 };
}

/* ================= live game state =================
   Several feeds, cross-checked. ESPN covers every league and carries win
   probability and sportsbook odds; the league's own API is the authority on
   score and clock. Disagreement between them is itself a signal. */
const LEAGUES = [
  [/KXNBAGAME|\bnba\b/i, "basketball/nba", "NBA"],
  [/KXWNBAGAME|\bwnba\b/i, "basketball/wnba", "WNBA"],
  [/KXMLBGAME|\bmlb\b|world series/i, "baseball/mlb", "MLB"],
  [/KXNFLGAME|\bnfl\b|super bowl/i, "football/nfl", "NFL"],
  [/KXNHLGAME|\bnhl\b|stanley cup/i, "hockey/nhl", "NHL"],
  [/KXCFBGAME|KXNCAAFGAME|college football/i, "football/college-football", "NCAAF"],
  [/KXCBBGAME|KXNCAABGAME|march madness/i, "basketball/mens-college-basketball", "NCAAM"],
  [/KXATPMATCH|\batp\b/i, "tennis/atp", "ATP"],
  [/KXWTAMATCH|\bwta\b/i, "tennis/wta", "WTA"],
  [/KXUFCFIGHT|\bufc\b|\bmma\b/i, "mma/ufc", "UFC"],
  [/KXEPLGAME|premier league/i, "soccer/eng.1", "EPL"],
  [/KXMLSGAME|\bmls\b/i, "soccer/usa.1", "MLS"],
  [/champions league/i, "soccer/uefa.champions", "UCL"],
  [/la liga/i, "soccer/esp.1", "La Liga"],
  [/KXSERIEAGAME|serie a game/i, "soccer/ita.1", "Serie A"],
  [/KXBUNDESLIGAGAME|bundesliga game/i, "soccer/ger.1", "Bundesliga"],
  [/KXLIGUE1GAME|ligue 1/i, "soccer/fra.1", "Ligue 1"],
  [/KXLIGAMXGAME|liga mx/i, "soccer/mex.1", "Liga MX"],
  [/KXUELGAME|europa league/i, "soccer/uefa.europa", "Europa League"],
  [/KXUECLGAME|conference league/i, "soccer/uefa.europa.conf", "Conference League"],
  [/KXEREDIVISIEGAME|eredivisie/i, "soccer/ned.1", "Eredivisie"],
  [/KXLIGAPORTUGALGAME|primeira liga|liga portugal/i, "soccer/por.1", "Liga Portugal"],
  [/KXBRASILEIROGAME|brasileir/i, "soccer/bra.1", "Brasileirao"],
  [/KXEFLCHAMPIONSHIPGAME|efl championship/i, "soccer/eng.2", "EFL Championship"],
  [/KXSUPERLIGGAME|super lig\b/i, "soccer/tur.1", "Super Lig"],
  [/KXBELGIANPLGAME|belgian pro/i, "soccer/bel.1", "Belgian Pro League"],
  [/KXNWSLGAME|\bnwsl\b/i, "soccer/usa.nwsl", "NWSL"],
  [/KXLEAGUESCUPGAME|leagues cup/i, "soccer/concacaf.leagues.cup", "Leagues Cup"],
  [/KXSAUDIPLGAME|saudi pro league/i, "soccer/ksa.1", "Saudi Pro League"],
  [/KXWCGAME-|world cup game/i, "soccer/fifa.world", "World Cup"],
  [/KXCFLGAME|\bcfl\b/i, "football/cfl", "CFL"],
  [/KXUFLGAME|\bufl\b/i, "football/ufl", "UFL"],
  [/KXNCAAWBGAME|women's college basketball/i, "basketball/womens-college-basketball", "NCAAW"],
  // Total-score (over/under) markets track the same games
  [/KXMLBTOTAL/i, "baseball/mlb", "MLB"],
  [/KXWNBATOTAL/i, "basketball/wnba", "WNBA"],
  [/KXNBATOTAL/i, "basketball/nba", "NBA"],
  [/KXNFLTOTAL/i, "football/nfl", "NFL"],
  [/KXNHLTOTAL/i, "hockey/nhl", "NHL"],
  [/KXCFBTOTAL/i, "football/college-football", "NCAAF"],
];

function detectLeague(m) {
  const id = String(m.id || "");
  // A multivariate combo (native parlay) spans several games — no single
  // live game can represent it, and pairing it with one shows the wrong
  // team's feed entirely.
  if (/^KXMVE|MULTIGAME|PARLAY/i.test(id)) return null;
  const hay = id + " " + (m.question || "") + " " + (m.name || "");
  const hits = [];
  for (const [re, path, label] of LEAGUES) {
    if (re.test(hay) && !hits.some((h) => h.path === path)) hits.push({ path, label });
  }
  // Text that matches two different sports is a parlay or cross-sport prop —
  // guessing one league would attach somebody else's game.
  return hits.length === 1 ? hits[0] : null;
}

// Trailing capitals in Kalshi ticker segments are competitor codes. A game
// ticker like KXMLBGAME-26AUG081505ATLNYY-NYY carries both teams in the
// event segment and the contract's own side as the final segment — that
// side code goes first so downstream matching knows whose contract this is.
function teamCodes(ticker) {
  const segs = String(ticker || "").toUpperCase().split("-");
  const out = [];
  const push = (c) => { if (c && !out.includes(c)) out.push(c); };
  for (let i = segs.length - 1; i >= 1; i--) {
    const mt = segs[i].match(/([A-Z]{2,10})$/);
    if (!mt) continue;
    const run = mt[1];
    if (run.length <= 4) push(run);
    // The event segment glues both team codes together, and they're NOT
    // always the same length (PHXLA = PHX + LA). Offer every split whose
    // halves look like team codes; exact-match scoring sorts out the junk.
    if (run.length >= 4) {
      for (let k = 2; k <= run.length - 2; k++) {
        if (k <= 4 && run.length - k <= 4) { push(run.slice(0, k)); push(run.slice(k)); }
      }
    }
  }
  return out;
}

// Known cross-feed abbreviation differences (Kalshi vs ESPN vs league
// APIs). Without these, the White Sox (CWS vs CHW) never exact-match and
// a junk prefix can drag the market onto the wrong game entirely.
const CODE_ALIAS = {
  CWS: "CHW", CHW: "CWS",   // White Sox
  AZ: "ARI", ARI: "AZ",     // Diamondbacks
  WSN: "WSH",               // Nationals
  JAX: "JAC", JAC: "JAX",   // Jaguars
  WAS: "WSH", WSH: "WAS",   // Washington (NFL/NBA/NHL)
  NO: "NOP", NOP: "NO",     // Pelicans
  GS: "GSW", GSW: "GS",     // Warriors
  NY: "NYK", SA: "SAS", SAS: "SA", PHO: "PHX",
  UTAH: "UTA", UTA: "UTAH",
  SJ: "SJS", SJS: "SJ", TBL: "TB", NJD: "NJ", LAK: "LA", MTL: "MON",
};
const codeEq = (a, c) => a === c || CODE_ALIAS[a] === c || CODE_ALIAS[c] === a;

// Exact (or aliased) abbreviation matches score full weight. Prefix
// overlaps (LA vs LAS) score partial — but only when exactly ONE of the
// game's abbreviations matches, so a short code like NY can't pair with
// either New York team of a Yankees-Mets game.
const codeHit = (codes, abbrs) => {
  let s = 0;
  for (const c of codes) {
    if (abbrs.some((a) => codeEq(a, c))) { s += 1; continue; }
    const pref = abbrs.filter((a) => a && (a.startsWith(c) || c.startsWith(a)));
    if (pref.length === 1) s += 0.6;
  }
  return s;
};

// Sports feeds load straight from the browser first: ESPN 403s datacenter
// IPs (which is where the proxy lives) but sends open CORS headers, so the
// user's own connection is the reliable path. The proxy stays as fallback.
const getJson = async (url) => {
  try {
    const r = await fetch(url);
    if (r.ok) return r.json();
  } catch { /* CORS or network — fall through to the server proxy */ }
  const r = await fetch(px(url));
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
};

/* ---- The Odds API: wide multi-book consensus (incl. sharp EU books) ----
   Served through /api/desk/odds so the key never reaches the browser. Each
   bookmaker is de-vigged independently with Shin and averaged — the same
   construction as the ESPN consensus but across a much deeper book pool,
   and it keeps quoting in-play, which ESPN's pregame lines don't. */
const ODDS_SPORT = {
  "basketball/nba": "basketball_nba",
  "basketball/wnba": "basketball_wnba",
  "baseball/mlb": "baseball_mlb",
  "football/nfl": "americanfootball_nfl",
  "hockey/nhl": "icehockey_nhl",
  "football/college-football": "americanfootball_ncaaf",
  "basketball/mens-college-basketball": "basketball_ncaab",
  "tennis/atp": "tennis_atp",
  "tennis/wta": "tennis_wta",
  "mma/ufc": "mma_mixed_martial_arts",
  "soccer/eng.1": "soccer_epl",
  "soccer/usa.1": "soccer_usa_mls",
  "soccer/uefa.champions": "soccer_uefa_champs_league",
  "soccer/esp.1": "soccer_spain_la_liga",
  "soccer/ita.1": "soccer_italy_serie_a",
  "soccer/ger.1": "soccer_germany_bundesliga",
  "soccer/fra.1": "soccer_france_ligue_one",
  "soccer/mex.1": "soccer_mexico_ligamx",
  "soccer/uefa.europa": "soccer_uefa_europa_league",
  "soccer/ned.1": "soccer_netherlands_eredivisie",
  "soccer/por.1": "soccer_portugal_primeira_liga",
  "soccer/bra.1": "soccer_brazil_campeonato",
  "soccer/eng.2": "soccer_efl_champ",
  "soccer/tur.1": "soccer_turkey_super_league",
  "soccer/bel.1": "soccer_belgium_first_div",
  "soccer/fifa.world": "soccer_fifa_world_cup",
  "football/cfl": "americanfootball_cfl",
  "football/ufl": "americanfootball_ufl",
  "basketball/womens-college-basketball": "basketball_wncaab",
};
const ODDS_FRESH_MS = 10 * 60 * 1000; // a quote older than this is not "live"
let oddsQuota = null;                 // {remaining, at} for the UI chip
let oddsOffUntil = 0;                 // back off when no key is configured
const oddsSportCache = new Map();     // sport -> {at, events}

// `live` = this sport has a game in progress right now. Live odds refresh
// every ~4 minutes; pregame lines every ~15 — they barely move, and every
// upstream request costs real API credits.
async function fetchOddsEvents(path, live) {
  const sport = ODDS_SPORT[path];
  if (!sport || Date.now() < oddsOffUntil) return null;
  const hit = oddsSportCache.get(sport);
  if (hit && Date.now() - hit.at < (live ? 4 : 15) * 60 * 1000) return hit.events;
  try {
    const r = await fetch("/api/desk/odds?sport=" + sport + (live ? "&live=1" : ""));
    if (!r.ok) { oddsSportCache.set(sport, { at: Date.now(), events: null }); return null; }
    const d = await r.json();
    if (d.configured === false) { oddsOffUntil = Date.now() + 10 * 60 * 1000; return null; }
    if (d.remaining != null) oddsQuota = { remaining: d.remaining, at: Date.now() };
    const events = Array.isArray(d.events) ? d.events : null;
    oddsSportCache.set(sport, { at: Date.now(), events });
    return events;
  } catch { return null; }
}

// Two-sided derivative market (totals: Over/Under; spreads: home/away at a
// handicap). Books quote different lines — take the median point, de-vig
// every book quoting that exact point, and average. `a` is Over (totals)
// or the home side (spreads), as a percentage.
function oddsSideMarket(ev, key) {
  if (!ev || !Array.isArray(ev.bookmakers)) return null;
  const quotes = [];
  ev.bookmakers.forEach((bk) => {
    const m = (bk.markets || []).find((x) => x.key === key);
    if (!m || !Array.isArray(m.outcomes)) return;
    const oA = m.outcomes.find((o) => (key === "totals" ? o.name === "Over" : o.name === ev.home_team));
    const oB = m.outcomes.find((o) => (key === "totals" ? o.name === "Under" : o.name === ev.away_team));
    if (!oA || !oB || oA.point == null) return;
    const ra = mlImplied(oA.price), rb = mlImplied(oB.price);
    if (ra == null || rb == null) return;
    quotes.push({ point: Number(oA.point), ra, rb });
  });
  if (!quotes.length) return null;
  const pts = quotes.map((q) => q.point).sort((x, y) => x - y);
  const point = pts[Math.floor(pts.length / 2)];
  const at = quotes.filter((q) => Math.abs(q.point - point) < 1e-9);
  const dv = at.map((q) => shinDevig([q.ra, q.rb])).filter(Boolean);
  if (!dv.length) return null;
  const a = (dv.reduce((s, x) => s + x[0], 0) / dv.length) * 100;
  return { point, a, b: 100 - a, books: dv.length };
}

// Not all books are equal: Pinnacle takes sharp action at high limits and
// its line is the market's best single predictor; exchanges (Betfair et al)
// are real order books. Weight them above recreational books when
// averaging — this measurably tightens the consensus toward truth.
const BOOK_WEIGHT = { pinnacle: 3, betfair_ex_eu: 2, betfair_ex_uk: 2, betfair_ex_au: 2,
  smarkets: 1.5, matchbook: 1.5, betonlineag: 1.25, lowvig: 1.25 };

function oddsEventConsensus(ev) {
  if (!ev || !Array.isArray(ev.bookmakers)) return null;
  const books = [];
  let updated = 0;
  ev.bookmakers.forEach((bk) => {
    const m = (bk.markets || []).find((x) => x.key === "h2h");
    if (!m || !Array.isArray(m.outcomes)) return;
    const imp = (name) => {
      const o = m.outcomes.find((x) => x.name === name);
      return o ? mlImplied(o.price) : null;
    };
    const rh = imp(ev.home_team), ra = imp(ev.away_team), rd = imp("Draw");
    if (rh == null || ra == null) return;
    const dv = shinDevig(rd != null ? [rh, rd, ra] : [rh, ra]);
    if (!dv) return;
    books.push({ home: dv[0] * 100, away: dv[dv.length - 1] * 100,
      draw: dv.length === 3 ? dv[1] * 100 : null,
      w: BOOK_WEIGHT[bk.key] || 1 });
    const t = Date.parse(m.last_update || bk.last_update || "");
    if (Number.isFinite(t) && t > updated) updated = t;
  });
  if (!books.length) return null;
  const wsum = books.reduce((s, b) => s + b.w, 0);
  const mean = (k) => books.reduce((s, b) => s + (b[k] || 0) * b.w, 0) / wsum;
  const home = mean("home"), away = mean("away");
  const withDraw = books.filter((b) => b.draw != null);
  const draw = withDraw.length
    ? withDraw.reduce((s, b) => s + b.draw * b.w, 0) / withDraw.reduce((s, b) => s + b.w, 0) : null;
  const disp = books.length > 1
    ? Math.sqrt(books.reduce((s, b) => s + Math.pow(b.home - home, 2), 0) / books.length) : 0;
  const sharp = books.some((b) => b.w >= 2);
  return { home, away, draw, books: books.length, disp, updated, sharp,
    totals: oddsSideMarket(ev, "totals"), spreads: oddsSideMarket(ev, "spreads") };
}

// Find this game among the sport's events. BOTH competitors must appear in
// the game's name — plain overlap let a game whose own event wasn't quoted
// yet borrow a sibling event that shares one team (NY at IND stealing
// LV at NY's odds). A same-slate-date event wins ties between rematches.
function matchOddsEvent(events, nameText, dateStr) {
  if (!events || !events.length || !nameText) return null;
  const nt = toks(nameText);
  const teamPresent = (team) => {
    let hit = 0;
    toks(team).forEach((t) => { if (nt.has(t)) hit++; });
    return hit >= 1;
  };
  let best = null, bestS = 0;
  events.forEach((ev) => {
    if (!teamPresent(ev.home_team || "") || !teamPresent(ev.away_team || "")) return;
    let s = overlap(nameText, (ev.home_team || "") + " " + (ev.away_team || ""));
    if (dateStr && ev.commence_time) {
      const d = Date.parse(ev.commence_time);
      if (Number.isFinite(d) && etDate(d).replace(/-/g, "") === String(dateStr)) s += 0.5;
    }
    if (s > bestS) { bestS = s; best = ev; }
  });
  return bestS >= 0.5 ? best : null;
}

async function oddsConsensusFor(path, nameText, dateStr, live) {
  const events = await fetchOddsEvents(path, live);
  const ev = matchOddsEvent(events, nameText, dateStr);
  return ev ? oddsEventConsensus(ev) : null;
}

/* ---- source 1: ESPN scoreboard + summary ---- */
// Individual sports have athletes, not teams — derive a matchable code from
// the athlete's surname so tennis and UFC tickers (…SWIRAD) still pair up.
function competitorAbbr(c) {
  const team = String((c.team && c.team.abbreviation) || "").toUpperCase();
  if (team) return team;
  const name = (c.athlete && c.athlete.displayName) || "";
  const last = name.trim().split(/\s+/).pop() || "";
  return last.slice(0, 3).toUpperCase();
}

async function espnGame(lg, m, codes) {
  const d = await getJson("https://site.api.espn.com/apis/site/v2/sports/" + lg.path + "/scoreboard");
  const events = d.events || [];
  if (!events.length) return null;
  // Tennis: matches nest inside tournament groupings — surface them as
  // pseudo-events so the scorer below can pick the right MATCH, not the
  // whole tournament.
  if (lg.path.indexOf("tennis") === 0) {
    const flat = [];
    events.forEach((ev) => {
      const comps = [].concat(...(ev.groupings || []).map((g) => g.competitions || []), ev.competitions || []);
      comps.forEach((comp) => {
        const cs = comp.competitors || [];
        if (cs.length < 2) return;
        flat.push({ id: comp.id || ev.id, date: comp.date || ev.date,
          name: cs.map((c) => (c.athlete && c.athlete.displayName) || "").join(" vs "),
          shortName: "", status: comp.status, competitions: [comp] });
      });
    });
    if (flat.length) events.splice(0, events.length, ...flat);
  }
  const target = (m.question || "") + " " + (m.name || "");
  const scored = events.map((ev) => {
    const comp = (ev.competitions && ev.competitions[0]) || {};
    const abbrs = (comp.competitors || []).map(competitorAbbr);
    return { ev, s: overlap(target, (ev.name || "") + " " + (ev.shortName || "")) + codeHit(codes, abbrs) * 0.8 };
  }).sort((a, b) => b.s - a.s)[0];
  if (!scored || scored.s < 0.4) return null;

  const ev = scored.ev;
  const comp = (ev.competitions && ev.competitions[0]) || {};
  const st = ev.status || comp.status || {};
  const type = st.type || {};
  const sides = (comp.competitors || []).map((c) => ({
    name: (c.team && (c.team.displayName || c.team.name)) || (c.athlete && c.athlete.displayName) || "—",
    abbr: competitorAbbr(c),
    score: c.score != null && c.score !== "" ? Number(c.score) : null,
    home: c.homeAway === "home",
    // Tennis and other set/period sports: the per-set line score.
    sets: (c.linescores || []).map((ls) => (ls.displayValue != null ? ls.displayValue : ls.value)).filter((v) => v != null && v !== ""),
  }));

  const base = {
    source: "ESPN", eventId: ev.id, path: lg.path,
    name: ev.name || ev.shortName || "",
    state: type.state || "pre",
    detail: type.shortDetail || type.detail || "",
    clock: st.displayClock || "",
    period: st.period || 0,
    sides,
    venue: (comp.venue && comp.venue.fullName) || "",
  };

  // Summary carries win probability, book odds and the last play.
  try {
    const sm = await getJson("https://site.api.espn.com/apis/site/v2/sports/" + lg.path + "/summary?event=" + ev.id);
    const wp = sm.winprobability;
    if (Array.isArray(wp) && wp.length) {
      const last = wp[wp.length - 1];
      if (last && last.homeWinPercentage != null) base.homeWinPct = Number(last.homeWinPercentage) * 100;
    }
    // ESPN's matchup predictor is a PREGAME projection — once the game is
    // underway it's stale, and passing it off as a live read poisons both
    // the anchor and the stay/sell advice. Only use it before tip-off.
    if (base.homeWinPct == null && base.state === "pre" && sm.predictor && sm.predictor.homeTeam) {
      const v = Number(sm.predictor.homeTeam.gameProjection);
      if (Number.isFinite(v)) base.homeWinPct = v;
    }
    const oddsArr = sm.pickcenter || sm.odds || [];
    const od = oddsArr[0];
    if (od) {
      base.odds = {
        provider: (od.provider && od.provider.name) || "book",
        details: od.details || "",
        overUnder: od.overUnder != null ? od.overUnder : null,
        homeML: od.homeTeamOdds && od.homeTeamOdds.moneyLine,
        awayML: od.awayTeamOdds && od.awayTeamOdds.moneyLine,
      };
    }
    // Shin-de-vigged consensus across every book, for the analysis anchor.
    const homeAbbr = (sides.find((s) => s.home) || {}).abbr;
    const awayAbbr = (sides.find((s) => !s.home) || {}).abbr;
    const cons = consensusDevig(oddsArr, homeAbbr, awayAbbr);
    if (cons) base.bookProb = { home: cons.home, away: cons.away, books: cons.books, disp: cons.disp };
    const sit = sm.situation || (sm.header && sm.header.competitions && sm.header.competitions[0].situation);
    if (sit) {
      if (sit.lastPlay && sit.lastPlay.text) base.lastPlay = String(sit.lastPlay.text).slice(0, 180);
      // Football: down, distance and who has the ball.
      if (sit.downDistanceText) base.downDistance = sit.downDistanceText;
      if (sit.possessionText) base.possessionText = sit.possessionText;
      // Baseball: the count and outs.
      if (sit.balls != null) base.extra = sit.balls + "-" + sit.strikes + " count, " + (sit.outs != null ? sit.outs : "?") + " out";
    }
    // Injury report — scratches and OUT designations move lines and are
    // the single most common fact a pregame consensus hasn't absorbed yet.
    if (Array.isArray(sm.injuries) && sm.injuries.length) {
      const lines = [];
      sm.injuries.forEach((t) => {
        const teamName = (t.team && (t.team.abbreviation || t.team.displayName)) || "?";
        (t.injuries || []).slice(0, 5).forEach((inj) => {
          const who = inj.athlete && inj.athlete.displayName;
          const st = inj.status || (inj.type && inj.type.description) || "";
          if (who && st) lines.push(teamName + ": " + who + " (" + st + ")");
        });
      });
      if (lines.length) base.injuries = lines.slice(0, 8).join("; ");
    }
  } catch { /* scoreboard alone is still usable */ }

  return base;
}

/* ---- source 2: the league's own feed ---- */
async function officialGame(lg, codes) {
  if (lg.label === "MLB") {
    const sch = await getJson("https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=" + today());
    const games = (sch.dates || []).flatMap((d) => d.games || []);
    const pick = games.find((g) => {
      const ab = [g.teams.home.team.abbreviation, g.teams.away.team.abbreviation]
        .map((x) => String(x || "").toUpperCase());
      return codeHit(codes, ab) > 0;
    });
    if (!pick) return null;
    const f = await getJson("https://statsapi.mlb.com/api/v1.1/game/" + pick.gamePk + "/feed/live");
    const ls = (f.liveData && f.liveData.linescore) || {};
    const st = (f.gameData && f.gameData.status) || {};
    const abstract = String(st.abstractGameState || "").toLowerCase();
    return {
      source: "MLB StatsAPI",
      state: abstract === "live" ? "in" : abstract === "final" ? "post" : "pre",
      detail: (ls.inningState ? ls.inningState + " " + (ls.currentInningOrdinal || "") : st.detailedState) || "",
      sides: [
        { name: f.gameData.teams.away.name, abbr: String(f.gameData.teams.away.abbreviation || "").toUpperCase(), score: (ls.teams && ls.teams.away && ls.teams.away.runs) ?? null, home: false },
        { name: f.gameData.teams.home.name, abbr: String(f.gameData.teams.home.abbreviation || "").toUpperCase(), score: (ls.teams && ls.teams.home && ls.teams.home.runs) ?? null, home: true },
      ],
      extra: ls.balls != null ? ls.balls + "-" + ls.strikes + " count, " + (ls.outs ?? "?") + " out" : "",
      // Starting pitchers decide baseball moneylines — name them.
      probables: (() => {
        const pp = f.gameData && f.gameData.probablePitchers;
        if (!pp || (!pp.away && !pp.home)) return null;
        return "Probable pitchers: " + (pp.away && pp.away.fullName || "TBD") + " (away) vs " +
          (pp.home && pp.home.fullName || "TBD") + " (home)";
      })(),
    };
  }

  if (lg.label === "NHL") {
    const d = await getJson("https://api-web.nhle.com/v1/score/now");
    const g = (d.games || []).find((x) =>
      codeHit(codes, [String(x.homeTeam.abbrev || "").toUpperCase(), String(x.awayTeam.abbrev || "").toUpperCase()]) > 0);
    if (!g) return null;
    const gs = String(g.gameState || "").toUpperCase();
    return {
      source: "NHL API",
      state: gs === "LIVE" || gs === "CRIT" ? "in" : gs === "OFF" || gs === "FINAL" ? "post" : "pre",
      detail: g.periodDescriptor ? "P" + (g.periodDescriptor.number || "") : "",
      clock: (g.clock && g.clock.timeRemaining) || "",
      sides: [
        { name: (g.awayTeam.name && g.awayTeam.name.default) || g.awayTeam.abbrev, abbr: String(g.awayTeam.abbrev || "").toUpperCase(), score: g.awayTeam.score ?? null, home: false },
        { name: (g.homeTeam.name && g.homeTeam.name.default) || g.homeTeam.abbrev, abbr: String(g.homeTeam.abbrev || "").toUpperCase(), score: g.homeTeam.score ?? null, home: true },
      ],
    };
  }

  if (lg.label === "NBA") {
    const d = await getJson("https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json");
    const games = (d.scoreboard && d.scoreboard.games) || [];
    const g = games.find((x) =>
      codeHit(codes, [String(x.homeTeam.teamTricode || "").toUpperCase(), String(x.awayTeam.teamTricode || "").toUpperCase()]) > 0);
    if (!g) return null;
    return {
      source: "NBA Live",
      state: g.gameStatus === 2 ? "in" : g.gameStatus === 3 ? "post" : "pre",
      detail: g.gameStatusText || "",
      clock: g.gameClock || "",
      period: g.period || 0,
      sides: [
        { name: g.awayTeam.teamCity + " " + g.awayTeam.teamName, abbr: String(g.awayTeam.teamTricode || "").toUpperCase(), score: g.awayTeam.score ?? null, home: false },
        { name: g.homeTeam.teamCity + " " + g.homeTeam.teamName, abbr: String(g.homeTeam.teamTricode || "").toUpperCase(), score: g.homeTeam.score ?? null, home: true },
      ],
    };
  }

  return null;
}

/* ---- merge ---- */
async function fetchLive(m) {
  const lg = detectLeague(m);
  if (!lg) return null;
  const codes = teamCodes(m.id).map((c) => c.toUpperCase());

  const [a, b] = await Promise.allSettled([espnGame(lg, m, codes), officialGame(lg, codes)]);
  const espn = a.status === "fulfilled" ? a.value : null;
  const off = b.status === "fulfilled" ? b.value : null;
  const errs = [a, b].filter((x) => x.status === "rejected").map((x) => String(x.reason && x.reason.message));

  if (!espn && !off) return { league: lg.label, none: true, errs };

  // The league's own feed wins on score and clock; ESPN supplies the rest.
  const primary = off || espn;
  const sides = primary.sides;
  const sources = [espn, off].filter(Boolean).map((x) => ({
    name: x.source,
    line: (x.sides || []).map((sd) => sd.abbr + " " + (sd.score ?? "-")).join(" "),
  }));

  let disagree = false;
  if (espn && off && espn.sides && off.sides) {
    const key = (arr) => arr.slice().sort((p, q) => p.abbr.localeCompare(q.abbr))
      .map((sd) => sd.abbr + ":" + (sd.score ?? "-")).join("|");
    disagree = key(espn.sides) !== key(off.sides);
  }

  // Which side is this contract on? Match the outcome name to a competitor.
  // A market named after the QUESTION ("Will the Aces beat the Liberty?")
  // mentions both teams — if the two sides score nearly the same, matching
  // would be a coin flip that silently shows the OTHER team's numbers.
  // Refusing to pick is strictly better than flipping.
  let sideIdx = -1, bestS = 0, secondS = 0;
  sides.forEach((sd, i) => {
    const sc = Math.max(overlap(m.name || "", sd.name), sd.abbr && codes.length ? (codes[0] === sd.abbr ? 1 : 0) : 0);
    if (sc > bestS) { secondS = bestS; bestS = sc; sideIdx = i; }
    else if (sc > secondS) secondS = sc;
  });
  const mySide = sideIdx >= 0 && bestS > 0.3 && bestS - secondS > 0.12 ? sides[sideIdx] : null;

  let impliedCents = null;
  if (espn && espn.homeWinPct != null && mySide) {
    impliedCents = mySide.home ? espn.homeWinPct : 100 - espn.homeWinPct;
  }

  // Wide-book consensus from The Odds API (cached; no-op without a key).
  let oddsBook = null;
  try {
    oddsBook = await oddsConsensusFor(lg.path,
      (espn && espn.name) || sides.map((sd) => sd.name).join(" "),
      tickerDate(m.id), primary.state === "in");
  } catch { /* optional signal */ }

  return {
    league: lg.label,
    name: (espn && espn.name) || (sides.map((sd) => sd.name).join(" vs ")),
    state: primary.state,
    detail: primary.detail || (espn && espn.detail) || "",
    clock: primary.clock || (espn && espn.clock) || "",
    period: primary.period || (espn && espn.period) || 0,
    sides,
    extra: primary.extra || (espn && espn.extra) || "",
    downDistance: espn && espn.downDistance,
    possession: espn && espn.possessionText,
    lastPlay: espn && espn.lastPlay,
    odds: espn && espn.odds,
    bookProb: espn && espn.bookProb,
    oddsBook,
    injuries: espn && espn.injuries,
    probables: (off && off.probables) || null,
    homeWinPct: espn && espn.homeWinPct,
    mySide, impliedCents, disagree, sources, errs,
    fetched: Date.now(),
  };
}

function liveSummary(l) {
  if (!l || l.none || !l.sides) return "";
  const line = l.sides.map((s) => s.name + " " + (s.score ?? "-")).join(" vs ");
  const phase = l.state === "in" ? "IN PROGRESS" : l.state === "post" ? "FINAL" : "NOT STARTED";
  const asOf = l.fetched ? new Date(l.fetched).toISOString().slice(11, 19) + " UTC" : "now";
  let out = "\n\nLIVE GAME STATE (" + l.league + ", " + phase + ", fetched " + asOf + ", sources: " +
    l.sources.map((s) => s.name).join(" + ") + "): " + line;
  if (l.detail) out += " — " + l.detail;
  if (l.clock && l.state === "in") out += " (" + l.clock + ")";
  const withSets = l.sides.filter((s) => s.sets && s.sets.length);
  if (withSets.length) out += ". Set/period scores: " + withSets.map((s) => s.name + " [" + s.sets.join(" ") + "]").join(", ");
  if (l.downDistance) out += ". " + l.downDistance + (l.possession ? ", ball: " + l.possession : "");
  if (l.extra) out += ". " + l.extra;
  if (l.lastPlay) out += ". Last play: " + l.lastPlay;
  if (l.homeWinPct != null) {
    const home = l.sides.find((s) => s.home);
    out += ". ESPN live win probability: " + (home ? home.name : "home") + " " + l.homeWinPct.toFixed(1) + "%";
  }
  if (l.impliedCents != null && l.mySide) {
    out += ". That puts this contract's side (" + l.mySide.name + ") at " + l.impliedCents.toFixed(1) + "c";
  }
  if (l.odds) {
    out += ". Book line: " + (l.odds.details || "") +
      (l.odds.overUnder != null ? " O/U " + l.odds.overUnder : "") +
      (l.odds.homeML != null ? " (home ML " + l.odds.homeML + ")" : "");
  }
  if (l.probables) out += ". " + l.probables;
  if (l.injuries) out += ". INJURY REPORT: " + l.injuries;
  if (l.disagree) out += ". WARNING: the feeds disagree on the score — one is stale, so treat the score as uncertain.";
  out += ". This post-dates anything web search will return; weight it above every other input.";
  return out;
}

/* ================= Claude ================= */
function extractJson(text) {
  const clean = String(text).replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = clean.indexOf("{"), b = clean.lastIndexOf("}");
  if (a === -1 || b <= a) throw new Error("no json");
  return JSON.parse(clean.slice(a, b + 1));
}

// Research runs on Sonnet (fast, cheap searching); the judgment calls —
// resolution audit, final pricing, trade verification — run on Opus, which
// is markedly better calibrated on probability estimates.
const MODELS = { research: "claude-sonnet-4-6", judge: "claude-opus-4-8" };

async function callClaude(prompt, { search = false, model = MODELS.research, maxTokens = 1600 } = {}) {
  const body = { model, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] };
  if (search) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }];
  // One automatic retry on rate limits and transient server errors, so a
  // single hiccup doesn't cost a whole framework group.
  let r;
  for (let attempt = 0; ; attempt++) {
    r = await fetch("/api/desk/claude", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).catch((e) => ({ ok: false, status: 0, _err: e }));
    if (r.ok || attempt >= 1 || ![0, 429, 500, 502, 503, 529].includes(r.status)) break;
    await new Promise((res) => setTimeout(res, 2500));
  }
  if (!r.ok) throw new Error("Analysis request failed (" + (r.status || "network") + ")");
  const d = await r.json();
  const blocks = d.content || [];
  const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const sources = [];
  blocks.forEach((b) => {
    if (b.type === "web_search_tool_result" && Array.isArray(b.content))
      b.content.forEach((c) => { if (c.url) sources.push({ url: c.url, title: c.title || c.url }); });
  });
  return { text, sources };
}

/* ---- pricing math ---- */
const logit = (p) => Math.log(p / (100 - p));
const unlogit = (x) => 100 / (1 + Math.exp(-x));

// Evidence-weighted aggregation in log-odds space. The market price enters
// as a prior worth two strong frameworks, so thin evidence barely moves the
// number and only strong, consistent evidence can pull it far. This is the
// anchor the synthesis model must price around — it keeps the LLM's weakly
// calibrated point estimates on a leash.
function anchorFair(price, collected, byN, relMult) {
  const MARKET_W = 6;
  let sum = MARKET_W * logit(clamp(price, 1, 99));
  let tot = MARKET_W;
  for (const p of Object.values(collected)) {
    if (!p || p.implied == null) continue;
    const d = byN[p.n];
    if (!d || !d.enabled) continue;
    const s = clamp(Number(p.strength) || 0, 0, 3);
    if (s < 1) continue;
    const w = s * (Number(d.weight) || 1) * (relMult[p.n] || 1);
    if (w <= 0) continue;
    sum += w * logit(clamp(Number(p.implied), 1, 99));
    tot += w;
  }
  return unlogit(sum / tot);
}

// How often each framework pointed the right way on markets you've already
// seen settle, per category. Kicks in after 5 resolved samples, capped at
// 0.5x-1.5x so one hot streak can't dominate.
function reliabilityMultipliers(ledger, category) {
  const acc = {};
  (ledger || []).forEach((e) => {
    if (e.status !== "resolved" || e.outcome === null || e.category !== category) return;
    (e.pillars || []).forEach((p) => {
      if (!p.signal || p.signal === "NEUTRAL" || (p.strength || 0) < 1) return;
      acc[p.n] = acc[p.n] || { hit: 0, n: 0 };
      acc[p.n].n++;
      if ((p.signal === "YES" ? 1 : 0) === e.outcome) acc[p.n].hit++;
    });
  });
  const mult = {};
  for (const [n, r] of Object.entries(acc)) {
    if (r.n >= 5) mult[n] = clamp(2 * (r.hit / r.n), 0.5, 1.5);
  }
  return mult;
}

// Kalshi's taker fee is about 7 x p x (1-p) cents per contract (1.75c at
// 50c, less at the extremes); Polymarket charges no per-trade fee.
const takerFee = (venue, priceCents) =>
  venue === "Kalshi" ? 7 * (priceCents / 100) * (1 - priceCents / 100) : 0;

// Minimum net edge (after real fill price and fees) before a trade is worth
// calling. Higher mid-range where estimate noise is largest; never below 3c,
// which near the extremes forces roughly 2x the market's odds — the
// favourite-longshot bias punishes fading the tails on model say-so.
const minNetEdge = (priceCents) => 3 + 0.06 * Math.min(priceCents, 100 - priceCents);

// American moneyline -> raw implied probability (still carries the book's
// vig; the two sides sum to >1 by the overround).
function mlImplied(american) {
  const a = Number(american);
  if (!Number.isFinite(a) || a === 0) return null;
  return a > 0 ? 100 / (a + 100) : -a / (-a + 100);
}

// Shin's method: strip the book's margin AND its favourite-longshot bias.
// It models the fraction z of informed ("insider") money the book defends
// against; solving for z that makes the true probabilities sum to 1 gives
// estimates that beat naive proportional de-vig, especially on longshots.
// Falls back to proportional if the numerics misbehave.
function shinDevig(raws) {
  const rs = raws.filter((x) => x != null && x > 0);
  if (rs.length < 2) return null;
  const B = rs.reduce((s, x) => s + x, 0);
  if (B <= 1.00001) return rs.map((x) => x / B); // no vig — just normalise
  const pAt = (z) => rs.map((r) => (Math.sqrt(z * z + 4 * (1 - z) * r * r / B) - z) / (2 * (1 - z)));
  const sumAt = (z) => pAt(z).reduce((s, x) => s + x, 0);
  // sum decreases monotonically in z; sum(0)=sqrt(B)>1. Bisect for sum=1.
  let lo = 0, hi = 0.9;
  if (sumAt(hi) > 1) return rs.map((x) => x / B); // vig too large — fall back
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (sumAt(mid) > 1) lo = mid; else hi = mid; }
  const probs = pAt((lo + hi) / 2);
  const t = probs.reduce((s, x) => s + x, 0);
  if (!(t > 0) || !probs.every((x) => x >= 0 && x <= 1)) return rs.map((x) => x / B);
  return probs.map((x) => x / t);
}

// Two-way de-vig kept as a thin wrapper (Shin under the hood) so older call
// sites keep working.
function noVigMoneyline(homeML, awayML) {
  const h = mlImplied(homeML), a = mlImplied(awayML);
  if (h == null || a == null) return null;
  const dv = shinDevig([h, a]);
  if (!dv) return null;
  return { home: dv[0] * 100, away: dv[1] * 100 };
}

// Consensus across every book ESPN lists: de-vig each independently with
// Shin, average the results, and report how far the books spread (a proxy
// for how settled the true price is). Returns probabilities as percentages.
function consensusDevig(oddsArray, homeAbbr, awayAbbr) {
  const books = [];
  (oddsArray || []).forEach((o) => {
    if (!o || !o.homeTeamOdds || !o.awayTeamOdds) return;
    const rh = mlImplied(o.homeTeamOdds.moneyLine), ra = mlImplied(o.awayTeamOdds.moneyLine);
    if (rh == null || ra == null) return;
    // Soccer prices a draw as a third outcome — de-vig all three so a
    // "team to win" probability isn't inflated by ignoring the draw.
    const rd = o.drawOdds ? mlImplied(o.drawOdds.moneyLine) : null;
    const dv = shinDevig(rd != null ? [rh, rd, ra] : [rh, ra]);
    if (dv) books.push({ home: dv[0] * 100, away: dv[dv.length - 1] * 100,
      draw: dv.length === 3 ? dv[1] * 100 : null });
  });
  if (!books.length) return null;
  const mean = (k) => books.reduce((s, b) => s + b[k], 0) / books.length;
  const home = mean("home"), away = mean("away");
  const withDraw = books.filter((b) => b.draw != null);
  const draw = withDraw.length ? withDraw.reduce((s, b) => s + b.draw, 0) / withDraw.length : null;
  const disp = books.length > 1
    ? Math.sqrt(books.reduce((s, b) => s + Math.pow(b.home - home, 2), 0) / books.length) : 0;
  const probByAbbr = {};
  if (homeAbbr) probByAbbr[homeAbbr] = home;
  if (awayAbbr) probByAbbr[awayAbbr] = away;
  // Soccer's third outcome — Kalshi tie contracts end in TIE or DRAW.
  if (draw != null) { probByAbbr.TIE = draw; probByAbbr.DRAW = draw; }
  return { probByAbbr, home, away, draw, books: books.length, disp };
}

// Empirical calibration from settled calls: if the desk's fair values have
// scored worse than the market's own prices, pull future estimates toward
// the market. Needs a real sample (>=20) before it does anything, and never
// pulls more than 70% of the way in — it corrects over-confidence, it
// doesn't surrender to the market.
function calibrationFactor(ledger) {
  // Synced positions carry fair === price by construction — including them
  // shrinks the model-vs-market gap and masks real overconfidence.
  const done = (ledger || []).filter((e) => e.status === "resolved" && e.outcome !== null &&
    e.call !== "SYNCED" && typeof e.fair === "number" && typeof e.price === "number");
  if (done.length < 20) return { k: 1, n: done.length, active: false };
  const brier = (p, o) => Math.pow(p / 100 - o, 2);
  const model = done.reduce((s, e) => s + brier(e.fair, e.outcome), 0) / done.length;
  const mkt = done.reduce((s, e) => s + brier(e.price, e.outcome), 0) / done.length;
  let k = 1;
  if (model > mkt && mkt > 0) k = clamp(1 - (model - mkt) / mkt, 0.3, 1);
  return { k, n: done.length, active: k < 0.995 };
}

const median = (arr) => {
  const s = arr.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const daysToClose = (m) => {
  if (!m.close) return null;
  const d = (new Date(m.close) - Date.now()) / 86400000;
  return Number.isFinite(d) ? Math.max(0, d) : null;
};

const ctx = (m) => {
  const dd = daysToClose(m);
  const when = dd == null ? "" : dd < 1 ? " (resolves within a day)" : " (" + Math.round(dd) + " days away)";
  return `CONTRACT: "${m.question}"
OUTCOME BEING PRICED: ${m.name}
CURRENT MARKET PRICE FOR YES: ${m.price.toFixed(1)}c (implied ${m.price.toFixed(1)}% chance)
RESOLUTION DATE: ${m.close || "unknown"}${when}
${m.rules ? "RESOLUTION RULES: " + m.rules : ""}${m.legsInfo
  ? "\nTHIS IS A PARLAY. It resolves YES only if EVERY leg hits. The exact legs (teams, sports, dates) are:\n" +
    legsText(m.legsInfo) +
    "\nPrice EXACTLY these legs. Do NOT substitute any other team that shares a city name."
  : ""}`;
};

function auditPrompt(m) {
  return `Today is ${today()}. Read this prediction market contract's terms the way a lawyer paid to find the catch would.

${ctx(m)}

Work out what actually settles this contract: the source of truth, the deadline and timezone, the exact threshold, and any wording ("by" vs "on", "official", "announced", "average") that could make it resolve differently from what a casual reader of the headline expects.

severity: HIGH means casual readers will likely misprice this contract because of its terms; LOW means the terms match the headline.

Return ONLY this JSON, no preamble, no markdown:
{"summary":"<max 30 words: exactly what it takes to resolve YES>","traps":["<0-3 specific gotchas, max 20 words each>"],"severity":"LOW|MEDIUM|HIGH"}`;
}

function researchPrompt(items, m, live, audit) {
  const defs = items.map((p) =>
    `${p.n}. ${p.name}\n   Method: ${p.method}${p.sources && p.sources !== "—" ? "\n   Preferred sources: " + p.sources : ""}`
  ).join("\n");
  return `Today is ${today()}. You are researching a live ${m.venue} prediction market contract.

${ctx(m)}${audit ? "\nRESOLUTION AUDIT (what actually settles this): " + audit : ""}${live || ""}

Work through ONLY these analysis frameworks, following each stated method:
${defs}

Rules:
- Search for current, dated evidence. Prefer the listed sources and other primary ones.
- State the date of every figure you rely on. For contracts resolving within days, evidence more than a week old is weak — cap its strength at 1.
- If you cannot find real data for a framework, say so plainly and set signal NEUTRAL and strength 0. Never invent numbers, polls, lines or forecasts.
- "implied" = the probability in percent (0-100) that this framework alone suggests for the contract resolving YES under its EXACT resolution rules${audit ? " (see the resolution audit)" : ""}, or null if it gives no probability read.
- signal: "YES" if the evidence argues the market underprices YES, "NO" if it overprices YES, "NEUTRAL" if it doesn't move the needle.
- strength rubric: 0 = no real data found; 1 = a single, indirect or stale source; 2 = solid but incomplete evidence; 3 = multiple independent, current, primary sources that agree. Never claim 3 unless you actually saw them.

Return ONLY this JSON, no preamble, no markdown:
{"pillars":[{"n":<number>,"finding":"<max 45 words, concrete, with figures and dates where found>","signal":"YES|NO|NEUTRAL","strength":0-3,"implied":<number or null>}]}`;
}

function contrarianPrompt(item, m, found, live, audit) {
  return `Today is ${today()}. Act as the desk's risk officer on a live ${m.venue} contract.

${ctx(m)}${audit ? "\nRESOLUTION AUDIT (what actually settles this): " + audit : ""}${live || ""}

The research team concluded:
${found}

Your job is framework ${item.n}: ${item.name}.
Method: ${item.method}

Argue against the emerging consensus. Search for what the team likely missed: stale data, resolution-criteria traps, crowded positioning, sampling bias, base-rate neglect, or a mechanism that makes the market price correct after all.

Return ONLY this JSON:
{"pillars":[{"n":${item.n},"finding":"<max 55 words, the strongest specific counter-argument>","signal":"YES|NO|NEUTRAL","strength":0-3,"implied":<number or null>}]}`;
}

function synthPrompt(m, found, extra, anchor, audit) {
  return `Today is ${today()}. You run a prediction-market trading desk and are pricing a ${m.venue} binary contract.

${ctx(m)}${audit ? "\nRESOLUTION AUDIT (what actually settles this): " + audit : ""}
${extra || ""}

Framework findings:
${found}

A mechanical aggregation — the market price as a prior, plus every framework's implied probability weighted by evidence strength and its historical hit rate — prices this contract at ${anchor.toFixed(1)}c. That number is your anchor.

Produce a calibrated fair value. Discipline:
- Prediction markets are usually close to right. Deviate from the market only where the evidence is specific, current and strong.
- Stay within 10c of the anchor. Move off the anchor only when one decisive fact outweighs the mechanical weighting (say so in the thesis), otherwise land on it.
- Price the EXACT resolution rules, not the headline. If the audit flags a trap, your fair value must account for it.
- Mind the favourite-longshot bias: cheap contracts are usually cheap for a reason and expensive ones usually win. Fading the market near the extremes demands the strongest evidence.
- If the evidence is thin or contradictory, land on the market price and say so.

Return ONLY this JSON:
{"fairValue":<0-100>,"confidence":"LOW|MEDIUM|HIGH","thesis":"<2-3 sentences>","drivers":["<3-4 findings that moved the estimate most>"],"risks":["<2-3 things that would break this call>"],"resolution":"<1 sentence on any resolution-criteria subtlety>"}`;
}

function verifyPrompt(m, side, entry, fairSide, thesis, live, audit) {
  return `Today is ${today()}. You are the final check before real money goes down on a ${m.venue} contract.

${ctx(m)}${audit ? "\nRESOLUTION AUDIT (what actually settles this): " + audit : ""}${live || ""}

The desk wants to BUY ${side} at ${entry.toFixed(1)}c, believing that side is worth ${fairSide.toFixed(1)}c. Its thesis: ${thesis}

Try to kill this trade. Search for: news from the last 48 hours the desk may have missed, any mismatch between the thesis and the exact resolution rules, and the strongest reason the current market price is right. The market has real money behind it — someone is taking the other side of this trade; work out what they know.

verdict: REFUTE if you found something that materially undermines the trade, CONFIRM only if you actively looked and found nothing, UNCERTAIN if you could not check properly.

Return ONLY this JSON:
{"verdict":"CONFIRM|REFUTE|UNCERTAIN","reason":"<max 40 words, the decisive fact or the strongest surviving risk>"}`;
}

function guessCategory(text) {
  const t = (text || "").toLowerCase();
  const hit = (ws) => ws.some((w) => t.includes(w));
  if (hit(["temperature", "rainfall", "snow", "hurricane", "storm", "weather", "degrees", "precipitation", "tornado"])) return "weather";
  if (hit(["election", "president", "senate", "congress", "governor", "nominee", "primary", "parliament", "prime minister", "impeach", "cabinet", "supreme court", "shutdown", "speaker"])) return "politics";
  if (hit(["nfl", "nba", "mlb", "nhl", "premier league", "super bowl", "world cup", "ncaa", "ufc", " vs ", "playoff", "olympic", "grand slam"])) return "sports";
  if (hit(["fed ", "cpi", "inflation", "gdp", "s&p", "nasdaq", "bitcoin", "ethereum", "earnings", "stock", "rate cut", "interest rate", "unemployment", "recession", "ipo",
    "wti", "brent", "crude", "gold", "silver", "natural gas", "commodity", "settlement price"])) return "finance";
  return "general";
}

/* ================= app ================= */
// Grade every pending prediction record from its authoritative source —
// sports from final scores, commodity ladders from settled strikes,
// 15-minute windows from market results. Runs from ANY tab so records
// never depend on which screen happens to be open.
async function gradeAllRecords() {
  let rec;
  try {
    const r = await fetch("/api/desk/picks");
    rec = (await r.json()).record || [];
  } catch { return; }
  const changed = [];
  const todayEt = etDate().replace(/-/g, "");
  const sports = rec.filter((x) => (!x.type || x.type === "sports" || String(x.id).indexOf("pk-") === 0) &&
    x.result == null && x.date && x.date <= todayEt && x.eventId && x.path).slice(0, 6);
  for (const x of sports) {
    try {
      const gs = await espnGamesForLeague(x.path, x.date);
      const g = gs.find((y) => y.eventId === String(x.eventId));
      if (g && g.state === "post" && g.sides) {
        const w = gameWinnerAbbr(g.sides);
        if (w) {
          x.result = pickWon(x.pickCode, w) ? "won" : "lost";
          x.final = g.sides.map((s) => s.abbr + " " + (s.score != null ? s.score : "-")).join(" ");
          changed.push(x);
        }
      } else if (Date.now() - (x.at || 0) > 5 * 86400000) { x.result = "void"; changed.push(x); }
    } catch { /* next cycle */ }
  }
  const f15 = rec.filter((x) => x.type === "f15" && x.result == null &&
    x.close && Date.now() - new Date(x.close) > 2 * 60000).slice(0, 6);
  for (const x of f15) {
    try {
      const r2 = await fetch(px("https://api.elections.kalshi.com/trade-api/v2/markets/" + String(x.id).slice(4)));
      if (!r2.ok) continue;
      const d2 = await r2.json();
      const res = d2.market && d2.market.result;
      if (res === "yes" || res === "no") { x.result = (res === "yes") === x.up ? "won" : "lost"; changed.push(x); }
      else if (Date.now() - (x.at || 0) > 86400000) { x.result = "void"; changed.push(x); }
    } catch { /* next cycle */ }
  }
  const com = rec.filter((x) => x.type === "commodity" && x.result == null &&
    x.close && Date.now() - new Date(x.close) > 10 * 60000).slice(0, 4);
  for (const x of com) {
    try {
      const r2 = await fetch(px("https://api.elections.kalshi.com/trade-api/v2/markets?event_ticker=" +
        encodeURIComponent(String(x.id).slice(3)) + "&limit=100"));
      if (!r2.ok) continue;
      const d2 = await r2.json();
      const ms = (d2.markets || []).filter((m) => /greater/.test(m.strike_type || "") &&
        m.floor_strike != null && (m.result === "yes" || m.result === "no"));
      if (ms.length) {
        const actual = ms.filter((m) => m.result === "yes").length;
        x.result = actual === x.win ? "won" : "lost"; x.actual = actual; changed.push(x);
      } else if (Date.now() - (x.at || 0) > 3 * 86400000) { x.result = "void"; changed.push(x); }
    } catch { /* next cycle */ }
  }
  if (changed.length) {
    try {
      await fetch("/api/desk/picks", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(changed) });
    } catch { /* resend next cycle */ }
  }
}

function App() {
  const [tab, setTab] = useState("picks");
  const [fw, setFw] = useState(buildFrameworks);
  const [ledger, setLedger] = useState([]);

  // Background grader: keep every prediction record current no matter
  // which tab is open.
  useEffect(() => {
    gradeAllRecords();
    const id = setInterval(gradeAllRecords, 120000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/desk/frameworks");
        const d = await r.json();
        if (d.frameworks && d.frameworks.general) setFw(d.frameworks);
      } catch { /* defaults stand */ }
      try {
        const r = await fetch("/api/desk/ledger");
        const d = await r.json();
        setLedger(d.entries || []);
      } catch { /* empty ledger */ }
    })();
  }, []);

  // Re-pull the ledger from the server, so positions marked on another
  // device (or added for you) show up without a full page reload.
  async function reloadLedger() {
    try {
      const r = await fetch("/api/desk/ledger");
      const d = await r.json();
      if (Array.isArray(d.entries)) setLedger(d.entries);
    } catch { /* keep what we have */ }
  }

  async function saveFw(next) {
    setFw(next);
    try { await fetch("/api/desk/frameworks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) }); } catch { /* keeps working in memory */ }
  }
  async function saveEntry(entry) {
    setLedger((L) => [entry, ...L.filter((x) => x.id !== entry.id)]);
    try { await fetch("/api/desk/ledger", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry) }); } catch { /* in memory only */ }
  }

  const [pending, setPending] = useState(null); // market handed over from Browse or My trades

  // Re-open a past call in Analyze with a freshly fetched market record.
  async function reopen(e) {
    try {
      if (e.venue === "Kalshi") {
        const r = await fetch(px("https://api.elections.kalshi.com/trade-api/v2/markets/" + e.marketId));
        const d = await r.json();
        if (d.market) { setPending(kaMarket(d.market)); setTab("analyze"); return; }
      } else if (e.slug) {
        const r = await fetch(px("https://gamma-api.polymarket.com/events?slug=" + encodeURIComponent(e.slug)));
        const d = await r.json();
        const ev = Array.isArray(d) ? d[0] : d;
        const m = ev && (ev.markets || []).find((x) => (x.conditionId || String(x.id)) === e.marketId);
        if (m) { setPending(pmMarket(m, ev)); setTab("analyze"); return; }
      }
    } catch { /* fall back to what the ledger knows */ }
    setPending({ venue: e.venue, id: e.marketId, slug: e.slug || null, name: e.name, question: e.question,
      price: e.price, close: e.close || null, link: e.link || "", rules: "" });
    setTab("analyze");
  }

  const openTrades = ledger.filter((e) => e.taken && e.status === "open").length;

  return (
    <div className="cd">
      <style>{CSS}</style>
      <div className="cd-wrap">
        <header className="cd-head">
          <div>
            <div className="eyebrow">Kalshi · Polymarket</div>
            <h1 className="cd-title">Contract <span>Desk</span></h1>
            <p className="help" style={{ maxWidth: 460 }}>
              I predict the outcomes of Kalshi and Polymarket events — games, totals, commodities, anything listed — and grade every prediction against what actually happens.
            </p>
          </div>
          <div className="eyebrow">{today()}</div>
        </header>

        <nav className="tabs">
          {[["picks", "Predictions"], ["nrfi", "First Inning"], ["analyze", "Ask an event"], ["parlay", "Combos"], ["commodities", "15-Minute"], ["positions", "My trades" + (openTrades ? " (" + openTrades + ")" : "")], ["ledger", "Accuracy"]].map(([k, l]) => (
            <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
          ))}
        </nav>

        {tab === "picks" && <Picks ledger={ledger} onPick={(m) => { setPending(m); setTab("analyze"); }} />}
        {tab === "nrfi" && <FirstInning />}
        {tab === "analyze" && <Analyze fw={fw} onSave={saveEntry} pending={pending} clearPending={() => setPending(null)} ledger={ledger} />}
        {tab === "parlay" && <Parlay onPick={(m) => { setPending(m); setTab("analyze"); }} />}
        {tab === "commodities" && <Commodities onPick={(m) => { setPending(m); setTab("analyze"); }} />}
        {tab === "positions" && <Positions ledger={ledger} save={saveEntry} reopen={reopen} reload={reloadLedger} />}
        {tab === "browse" && <Browse onPick={(m) => { setPending(m); setTab("analyze"); }} />}
        {tab === "frameworks" && <Frameworks fw={fw} save={saveFw} ledger={ledger} reset={() => saveFw(buildFrameworks())} />}
        {tab === "ledger" && <Ledger ledger={ledger} setLedger={setLedger} fw={fw} />}

        <p className="foot">
          These are estimates, not predictions with a proven record — the "How I'm doing" tab is where you find out
          whether they're any good. Checks that turn up no real data count for nothing. Prediction markets are usually
          priced about right, so a big gap usually means I'm missing a fact rather than that you've found free money.
          The decisions are yours.
        </p>
        <p className="foot" style={{ opacity: .5, marginTop: 8 }}>Build {BUILD} · a prediction engine, graded daily</p>
      </div>
    </div>
  );
}

/* ---------------- Analyze ---------------- */
function Spark({ points, w = 120, h = 26 }) {
  if (!points || points.length < 2) return null;
  const ps = points.map((pt) => pt.p);
  const min = Math.min.apply(null, ps), max = Math.max.apply(null, ps);
  const span = Math.max(1e-6, max - min);
  const d = points.map((pt, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((pt.p - min) / span) * (h - 4) - 2;
    return (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
  }).join(" ");
  const up = ps[ps.length - 1] >= ps[0];
  return (
    <svg width={w} height={h} style={{ display: "block", marginTop: 3 }} aria-hidden="true">
      <path d={d} fill="none" stroke={up ? "var(--moss)" : "var(--rose)"} strokeWidth="1.5" />
    </svg>
  );
}

function Analyze({ fw, onSave, pending, clearPending, ledger }) {
  const [url, setUrl] = useState(() => {
    try { return localStorage.getItem("cd:lastUrl") || ""; } catch { return ""; }
  });
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState(null);
  const [book, setBook] = useState(null);
  const [market, setMarket] = useState(null);
  const [cat, setCat] = useState("general");
  const [findings, setFindings] = useState({});
  const [result, setResult] = useState(null);
  const [sources, setSources] = useState([]);
  const [depth, setDepth] = useState(null);
  const [size, setSize] = useState(100);
  const [xp, setXp] = useState(null);
  const [live, setLive] = useState(null);
  const [audit, setAudit] = useState(null);
  const [hist, setHist] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);
  const [tkPrice, setTkPrice] = useState("");
  const [tkN, setTkN] = useState("100");
  const runId = useRef(0);
  // Freshest live feed, readable mid-analysis: a running pipeline reads this
  // at every stage instead of the score from when the run started.
  const liveRef = useRef(null);
  const histRef = useRef(null);
  const [legs, setLegs] = useState(null);       // parlay legs, resolved
  const [legLive, setLegLive] = useState(null); // per-leg live states
  const legsRef = useRef(null);
  const legLiveRef = useRef(null);

  useEffect(() => {
    if (!pending) return;
    setBook({ venue: pending.venue, event: pending.question, markets: [pending], source: "live API" });
    setMarket(pending);
    setCat(guessCategory(pending.question + " " + pending.name));
    setUrl(pending.link || "");
    setResult(null); setFindings({}); setSources([]); setXp(null); setDepth(null); setLive(null); setAudit(null);
    setPhase("ready");
    clearPending();
  }, [pending]);

  useEffect(() => {
    if (!market) return;
    let alive = true;
    setHist(null); histRef.current = null;
    fetchBook(market).then((b) => { if (alive) setDepth(b); });
    fetchHistory(market).then((h) => { if (alive) { setHist(h); histRef.current = h; } });
    return () => { alive = false; };
  }, [market]);

  // Live score, refreshed every 30s while the game is actually in progress.
  useEffect(() => {
    if (!market) return;
    let alive = true, timer = null;
    const tick = async () => {
      const l = await fetchLive(market);
      if (!alive) return;
      setLive(l);
      liveRef.current = l;
      if (l && l.sides && !l.none && !l.error) setCat((c) => (c === "general" ? "sports" : c));
      // Live games poll every 10 seconds; scheduled ones check every 45 so
      // the board flips to live on its own at first pitch or tip-off.
      if (l && l.state === "in") timer = setTimeout(tick, 10000);
      else if (l && l.state === "pre") timer = setTimeout(tick, 45000);
    };
    tick();
    // Coming back to the tab refreshes the board immediately.
    const onVis = () => { if (!document.hidden) { if (timer) clearTimeout(timer); tick(); } };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", onVis); };
  }, [market]);

  // Parlay legs: resolve once per market, then poll every leg's own live
  // game — the combo's title carries none of this.
  useEffect(() => {
    setLegs(null); setLegLive(null); legsRef.current = null; legLiveRef.current = null;
    if (!market || !market.legs) return;
    let alive = true, timer = null;
    const tick = async () => {
      const ls = await resolveLegs(market);
      if (!alive || !ls) return;
      setLegs(ls); legsRef.current = ls;
      const lv = await Promise.all(ls.map((l) =>
        fetchLive({ id: l.ticker, question: l.question, name: l.name }).catch(() => null)));
      if (!alive) return;
      setLegLive(lv); legLiveRef.current = lv;
      timer = setTimeout(tick, lv.some((x) => x && x.state === "in") ? 12000 : 45000);
    };
    tick();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [market]);

  const busy = ["fetching", "auditing", "researching", "contrarian", "synthesizing", "verifying"].includes(phase);
  const conf = fw[cat];

  async function loadBook(inputUrl) {
    const target = (inputUrl != null ? inputUrl : url).trim();
    setError(null); setBook(null); setMarket(null); setResult(null);
    setFindings({}); setSources([]); setXp(null); setDepth(null); setLive(null); setAudit(null);
    const p = parseUrl(target);
    if (p.error) { setError(p.error); setPhase("idle"); return; }
    setPhase("fetching");
    try {
      const b = p.venue === "Polymarket" ? await fetchPolymarket(p) : await fetchKalshi(p);
      try { localStorage.setItem("cd:lastUrl", target); } catch { /* private mode */ }
      setBook(b);
      setCat(guessCategory(b.event + " " + b.markets.map((m) => m.name).join(" ")));
      if (b.markets.length === 1) { setMarket(b.markets[0]); setPhase("ready"); }
      else setPhase("choosing");
    } catch (e) {
      setError(p.venue + " didn't return data: " + e.message + ". Check the URL is a market page and try again.");
      setPhase("idle");
    }
  }

  // Runs the other-venue price hunt and returns the result as well as
  // setting UI state, so analyze() can feed it into synthesis directly.
  async function crossPlatform(m) {
    const other = m.venue === "Kalshi" ? "Polymarket" : "Kalshi";
    setXp({ status: "searching" });
    try {
      let candidates = [];
      if (other === "Kalshi") {
        const r = await fetch(px("https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=200"));
        const d = await r.json();
        candidates = (d.markets || []).map(kaMarket).filter((x) => x.price !== null);
      } else {
        const r = await fetch(px("https://gamma-api.polymarket.com/events?closed=false&limit=120&order=volume24hr&ascending=false"));
        const d = await r.json();
        (Array.isArray(d) ? d : []).forEach((ev) =>
          (ev.markets || []).forEach((mm) => {
            const p = pmMarket(mm, ev);
            if (p.price !== null) candidates.push(p);
          })
        );
      }
      const target = m.question + " " + m.name;
      const top = candidates
        .map((c) => ({ c, s: overlap(target, c.question + " " + c.name) }))
        .filter((x) => x.s > 0.1)
        .sort((a, b) => b.s - a.s)
        .slice(0, 30);
      if (!top.length) { setXp({ status: "none" }); return null; }
      const list = top.map((x, i) => i + ". " + x.c.question + " | " + x.c.name + " | " + x.c.price.toFixed(1) + "c").join("\n");
      const r = await callClaude(`A trader holds this contract on ${m.venue}:
"${m.question}" — outcome: ${m.name}, priced ${m.price.toFixed(1)}c.

Here are open ${other} contracts. Pick the one that resolves on the SAME underlying event with the SAME direction, or none if there is no true equivalent. Being strict matters more than finding a match: different resolution dates, thresholds or sources mean it is NOT equivalent.

${list}

Return ONLY: {"index":<number or null>,"caveat":"<max 25 words on any resolution-criteria difference, or 'criteria appear identical'>"}`, { maxTokens: 400 });
      const j = extractJson(r.text);
      if (j.index === null || j.index === undefined || !top[j.index]) { setXp({ status: "none" }); return null; }
      let match = top[j.index].c;
      // Direction guard: on a two-sided event the matcher can pick the
      // OTHER team's contract, which flips every displayed number. If a
      // sibling outcome of the same matched event names OUR outcome
      // better, take the sibling instead.
      if (m.name) {
        const sibs = top.filter((x) => x.c.question === match.question && x.c.id !== match.id);
        const mine = overlap(m.name, match.name || "");
        let bestSib = null, bestSibS = mine;
        sibs.forEach((x) => {
          const s = overlap(m.name, x.c.name || "");
          if (s > bestSibS + 0.1) { bestSibS = s; bestSib = x.c; }
        });
        if (bestSib) match = bestSib;
      }
      const found = { status: "found", match, gap: match.price - m.price, caveat: j.caveat || "" };
      setXp(found);
      return found;
    } catch (e) {
      setXp({ status: "error", msg: e.message });
      return null;
    }
  }

  async function analyze(m0, c0) {
    const m = m0 || market, c = c0 || cat;
    if (!m) return;
    const id = ++runId.current;
    setError(null); setResult(null); setFindings({}); setSources([]); setAudit(null); setLastSaved(null);
    const lib = fw[c];
    const active = lib.items.filter((p) => p.enabled);
    const byN = Object.fromEntries(lib.items.map((p) => [p.n, p]));
    const collected = {};
    const allSources = [];

    const absorb = (res) => {
      if (!res) return;
      (res.sources || []).forEach((s) => allSources.push(s));
      try {
        extractJson(res.text).pillars.forEach((p) => {
          if (!p || !p.n) return;
          p.strength = clamp(Math.round(Number(p.strength) || 0), 0, 3);
          const iv = p.implied == null ? NaN : Number(p.implied);
          p.implied = Number.isFinite(iv) ? clamp(iv, 1, 99) : null;
          collected[p.n] = p;
        });
      } catch { /* other batches still stand */ }
    };

    // The other venue's price is the single best free sanity check — hunt for
    // it automatically while the research runs.
    const xpPromise = crossPlatform(m).catch(() => null);

    // Force a fresh live-feed read at the start of every run, and read the
    // freshest state again at each later stage — a game moves during the
    // minute this analysis takes.
    const livePromise = fetchLive(m).catch(() => null);

    // Standing context assembled once per stage read: live state, price
    // history, sibling outcomes, and how liquid the market really is.
    let sibLine = "";
    if (book && book.markets && book.markets.length > 1) {
      const sibs = book.markets.filter((x) => x.id !== m.id).slice(0, 6);
      if (sibs.length) sibLine = "\nOTHER OUTCOMES ON THIS EVENT: " +
        sibs.map((s) => s.name + " " + s.price.toFixed(1) + "c").join(", ") +
        ". The full set behaves like a probability distribution — check this outcome's price for consistency with its rivals.";
    }
    const spread = marketSpread(m);
    const thin = isThin(m);
    const liqLine = (spread != null || m.volume)
      ? "\nLIQUIDITY: " + (spread != null ? "bid-ask spread " + spread.toFixed(0) + "c" : "") +
        (m.volume ? (spread != null ? ", " : "") + "volume $" + Math.round(m.volume).toLocaleString() : "") +
        (thin ? ". This market is thin — prices are noisier and fills are worse; demand more edge." : ".")
      : "";
    const liveNow = () => liveSummary(liveRef.current) +
      legsLiveSummary(legsRef.current, legLiveRef.current) +
      histSummary(histRef.current) + sibLine + liqLine;

    // A parlay's title names no sports or opponents — resolve its legs
    // FIRST so every prompt prices the actual teams, not a guess.
    if (m.legs) {
      const ls = legsRef.current || await resolveLegs(m);
      if (id !== runId.current) return;
      if (ls) { legsRef.current = ls; m.legsInfo = ls; setLegs(ls); }
    }

    // Step 0: read the fine print before researching, so every later step
    // prices the contract that actually exists rather than the headline.
    let auditJ = null;
    if (m.rules || m.legsInfo) {
      setPhase("auditing");
      try {
        const ar = await callClaude(auditPrompt(m), { model: MODELS.judge, maxTokens: 600 });
        if (id !== runId.current) return;
        auditJ = extractJson(ar.text);
        setAudit(auditJ);
      } catch { /* research can proceed without it */ }
    }
    const auditLine = auditJ
      ? (auditJ.summary || "") + ((auditJ.traps || []).length ? " Watch for: " + auditJ.traps.join(" | ") : "")
      : "";

    const lFresh = await livePromise;
    if (lFresh) { setLive(lFresh); liveRef.current = lFresh; }
    if (id !== runId.current) return;

    setPhase("researching");
    const groups = lib.groups.map((g) => g.map((n) => byN[n]).filter((p) => p && p.enabled)).filter((g) => g.length);
    const batches = await Promise.allSettled(groups.map((g) => callClaude(researchPrompt(g, m, liveNow(), auditLine), { search: true })));
    if (id !== runId.current) return;
    batches.forEach((b, i) => {
      if (b.status === "fulfilled") absorb(b.value);
      else groups[i].forEach((p) => {
        collected[p.n] = { n: p.n, finding: "Research request failed — left out of the estimate.", signal: "NEUTRAL", strength: 0, implied: null };
      });
    });
    setFindings({ ...collected });
    setSources([...allSources]);

    const summarize = (ns) => ns.map((n) => {
      const p = collected[n], d = byN[n];
      if (!d) return "";
      return n + ". " + d.name + " (weight " + d.weight + ") [" + (p ? p.signal : "SKIPPED") +
        ", strength " + (p ? p.strength : 0) + "]: " + (p ? p.finding : "not run");
    }).filter(Boolean).join("\n");

    const contra = byN[9] && byN[9].enabled ? byN[9] : null;
    const firstEight = active.filter((p) => p.n !== 9).map((p) => p.n);
    if (contra) {
      setPhase("contrarian");
      try {
        const cr = await callClaude(contrarianPrompt(contra, m, summarize(firstEight), liveNow(), auditLine), { search: true });
        if (id !== runId.current) return;
        absorb(cr);
      } catch {
        collected[9] = { n: 9, finding: "Contrarian pass failed — treat confidence as optimistic.", signal: "NEUTRAL", strength: 0, implied: null };
      }
      setFindings({ ...collected });
      setSources([...allSources]);
    }

    setPhase("synthesizing");
    try {
      // Deterministic anchor: market prior + strength-weighted framework
      // reads, adjusted by each framework's track record in this category.
      // During a live game, ESPN's win-probability model joins the pool as a
      // heavyweight input — no web search can beat a live quantitative feed.
      const relMult = reliabilityMultipliers(ledger, c);
      const lNow = liveRef.current;
      const anchorInputs = { ...collected };
      const anchorByN = { ...byN };
      // Independent hard signals — a live win-probability model and a
      // de-vigged sportsbook moneyline — join the anchor as heavyweight
      // inputs. Both are quantitative and independent of the web-search
      // frameworks, so they earn full weight.
      const signals = []; // {label, prob} for display and disagreement checks
      if (lNow && lNow.impliedCents != null && lNow.state !== "pre" && !lNow.disagree) {
        anchorInputs[99] = { n: 99, strength: 3, implied: clamp(lNow.impliedCents, 1, 99) };
        anchorByN[99] = { n: 99, enabled: true, weight: 1.5 };
        signals.push({ label: "Live win prob", prob: lNow.impliedCents });
      }
      // The sportsbook line only feeds the anchor when it's current: The
      // Odds API consensus (widest pool, and its in-play quotes stay fresh
      // during a game) first, then ESPN's pregame consensus — but a frozen
      // pregame line NEVER enters mid-game, and any book line is dropped
      // once a live win-probability model exists.
      const liveWinPresent = !!(lNow && lNow.impliedCents != null && lNow.state === "in" && !lNow.disagree);
      let bookProb = null, bookN = 1, bookLive = false;
      if (!liveWinPresent && lNow && lNow.mySide) {
        const inGame = lNow.state === "in";
        const ob = lNow.oddsBook;
        const obFresh = !!(ob && ob.updated && Date.now() - ob.updated < ODDS_FRESH_MS);
        if (ob && (!inGame || obFresh)) {
          bookProb = lNow.mySide.home ? ob.home : ob.away;
          bookN = ob.books; bookLive = inGame;
        } else if (!inGame) {
          if (lNow.bookProb) {
            bookProb = lNow.mySide.home ? lNow.bookProb.home : lNow.bookProb.away;
            bookN = lNow.bookProb.books || 1;
          } else if (lNow.odds && lNow.odds.homeML != null && lNow.odds.awayML != null) {
            const nv = noVigMoneyline(lNow.odds.homeML, lNow.odds.awayML);
            if (nv) bookProb = lNow.mySide.home ? nv.home : nv.away;
          }
        }
      }
      if (bookProb != null) {
        // A consensus that includes a sharp book (Pinnacle/exchanges) has
        // earned more say in the anchor than soft-book-only lines.
        const sharpBoost = lNow && lNow.oddsBook && lNow.oddsBook.sharp ? 2 : 1.5;
        anchorInputs[98] = { n: 98, strength: 3, implied: clamp(bookProb, 1, 99) };
        anchorByN[98] = { n: 98, enabled: true, weight: sharpBoost };
        signals.push({ label: "Book line (" + bookN + (bookN === 1 ? " book" : " books") + (bookLive ? ", in-play)" : ")"), prob: bookProb });
      }
      // Parlay: the product of each leg's own best read (settled result,
      // live win prob, else the leg's market price) is deterministic and
      // beats anything a web search can produce for a combo.
      if (m.legsInfo) {
        const cmb = legsCombined(legsRef.current || m.legsInfo, legLiveRef.current);
        if (cmb && cmb.priced >= m.legsInfo.length) {
          anchorInputs[97] = { n: 97, strength: 3, implied: clamp(cmb.prob, 1, 99) };
          anchorByN[97] = { n: 97, enabled: true, weight: 2 };
          signals.push({ label: "Legs combined (" + m.legsInfo.length + " legs" + (cmb.live ? ", live" : "") + ")", prob: cmb.prob });
        }
      }
      const anchor = anchorFair(m.price, anchorInputs, anchorByN, relMult);

      // How far apart the independent signals sit — used to temper confidence.
      const signalSpread = signals.length >= 2
        ? Math.max.apply(null, signals.map((s) => s.prob)) - Math.min.apply(null, signals.map((s) => s.prob))
        : 0;

      let extra = liveNow();
      if (depth && depth.asks.length) {
        const w = walkBook(depth.asks, size);
        if (w) extra += `\nORDER BOOK: buying ${size} ${depth.unit} fills at an average of ${w.avg.toFixed(1)}c against a quoted ${m.price.toFixed(1)}c.`;
      }
      const xpNow = await xpPromise;
      if (xpNow && xpNow.status === "found") {
        extra += `\nCROSS-PLATFORM: the equivalent contract on ${xpNow.match.venue} trades at ${xpNow.match.price.toFixed(1)}c. ${xpNow.caveat || ""}`;
      }
      // If this market has been analyzed before, the synthesis (only) sees
      // the old call — the researchers stay blind to it to avoid anchoring.
      const prev = (ledger || []).find((e) => e.marketId === m.id && e.venue === m.venue);
      if (prev) {
        extra += `\nPRIOR ANALYSIS (${new Date(prev.ts).toISOString().slice(0, 10)}): the desk priced this at ${prev.fair}c when the market was ${prev.price}c (call: ${prev.call}). Weigh what has actually changed since.`;
      }

      // Self-consistency: price the contract three independent times and take
      // the median. A single LLM estimate is noisy; the median of several
      // collapses that variance and is markedly better calibrated.
      const prompt = synthPrompt(m, summarize(active.map((p) => p.n)), extra, anchor, auditLine);
      const runs = await Promise.allSettled(
        [0, 1, 2].map(() => callClaude(prompt, { model: MODELS.judge, maxTokens: 1400 }))
      );
      if (id !== runId.current) return;
      const samples = [];
      runs.forEach((r) => {
        if (r.status !== "fulfilled") return;
        try {
          const parsed = extractJson(r.value.text);
          if (Number.isFinite(Number(parsed.fairValue))) samples.push(parsed);
        } catch { /* skip an unparseable sample */ }
      });
      if (!samples.length) throw new Error("the pricing step returned no usable estimate");

      // Each sample clamped to the anchor, then take the median fair value;
      // keep the narrative from whichever sample sits closest to that median.
      const fairs = samples.map((s) => clamp(clamp(Number(s.fairValue), anchor - 10, anchor + 10), 0.5, 99.5));
      let fair = median(fairs);
      const sampleSpread = Math.max.apply(null, fairs) - Math.min.apply(null, fairs);
      let j = samples[0], bestGap = Infinity;
      samples.forEach((s, i) => {
        const g = Math.abs(fairs[i] - fair);
        if (g < bestGap) { bestGap = g; j = s; }
      });

      // Empirical calibration: once enough calls have settled, pull the
      // estimate toward the market if the desk has historically been
      // over-confident.
      const calib = calibrationFactor(ledger);
      if (calib.active) fair = clamp(m.price + calib.k * (fair - m.price), 0.5, 99.5);

      const edge = fair - m.price;
      const side = edge > 0 ? "YES" : "NO";

      // What entry would actually cost: walk the book at the chosen size when
      // we have one, else take the quoted ask (YES) or implied NO price.
      let entry = side === "YES" ? (m.ask != null ? m.ask : m.price) : 100 - (m.bid != null ? m.bid : m.price);
      if (depth) {
        if (side === "YES" && depth.asks.length) { const w = walkBook(depth.asks, size); if (w) entry = w.avg; }
        if (side === "NO" && depth.bids.length) { const w = walkBook(depth.bids, size); if (w) entry = 100 - w.avg; }
      }
      entry = clamp(entry, 0.5, 99.5);
      const fee = takerFee(m.venue, entry);
      const fairSide = side === "YES" ? fair : 100 - fair;
      const netEdge = fairSide - entry - fee;

      const strong = Object.values(collected).filter((p) => p && p.strength >= 2).length;
      const contraF = collected[9];
      const vetoed = !!(contraF && (contraF.strength || 0) >= 2 &&
        ((side === "YES" && contraF.signal === "NO") || (side === "NO" && contraF.signal === "YES")));
      // Trade bar: price-scaled minimum, +4c when our own risk officer
      // found solid evidence for the other side, +2c in thin markets.
      const bar = minNetEdge(m.price) + (vetoed ? 4 : 0) + (thin ? 2 : 0);

      let call = netEdge >= bar && strong >= 3 ? "BUY " + side : "PASS";
      let confidence = j.confidence || "LOW";
      if (auditJ && auditJ.severity === "HIGH" && confidence === "HIGH") confidence = "MEDIUM";
      // Independent signals or the pricing samples disagreeing is a real
      // uncertainty signal — don't let the model claim more than it earned.
      const step = (cf) => cf === "HIGH" ? "MEDIUM" : cf === "MEDIUM" ? "LOW" : "LOW";
      if (signalSpread > 12 || sampleSpread > 10) confidence = step(confidence);
      if (calib.active && calib.k <= 0.6 && confidence === "HIGH") confidence = "MEDIUM";

      // Final red-team pass: a trade only stands if it survives an active
      // attempt to refute it with fresh searches.
      let verify = null;
      if (call !== "PASS") {
        setPhase("verifying");
        try {
          const vr = await callClaude(verifyPrompt(m, side, entry, fairSide, j.thesis || "", liveNow(), auditLine), { search: true, maxTokens: 1200 });
          if (id !== runId.current) return;
          (vr.sources || []).forEach((s) => allSources.push(s));
          verify = extractJson(vr.text);
        } catch { verify = { verdict: "UNCERTAIN", reason: "The verification call failed, so this trade is unchecked." }; }
        if (verify.verdict === "REFUTE") call = "PASS";
        else if (verify.verdict === "UNCERTAIN") confidence = "LOW";
      }

      // Half-Kelly on the fee-adjusted real entry, capped by confidence.
      const cCost = clamp(entry + fee, 0.5, 99.5) / 100;
      const kelly = Math.max(0, (fairSide / 100 - cCost) / (1 - cCost));
      const cap = confidence === "HIGH" ? 20 : confidence === "MEDIUM" ? 12 : 5;
      const stake = call === "PASS" ? 0 : clamp((kelly / 2) * 100, 0, cap);

      const res = { fair, anchor, edge, netEdge, entry, fee, bar, call, side, stake, confidence,
        thesis: j.thesis || "", drivers: j.drivers || [], risks: j.risks || [],
        resolution: j.resolution || "", strong, verify, vetoed, thin,
        signals, signalSpread, sampleSpread, calib };
      setResult(res);
      setSources([...allSources]);
      setPhase("done");

      const saved = {
        id: uid(), ts: Date.now(), venue: m.venue, marketId: m.id, slug: m.slug || null,
        question: m.question, name: m.name, category: c, price: m.price, fair,
        edge: Math.round(edge * 10) / 10, netEdge: Math.round(netEdge * 10) / 10,
        entry: Math.round(entry * 10) / 10, anchor: Math.round(anchor * 10) / 10,
        verify: verify ? verify.verdict : null, call, confidence: res.confidence,
        close: m.close, link: m.link, status: "open", outcome: null,
        pillars: active.map((p) => {
          const f = collected[p.n] || {};
          return { n: p.n, name: p.name, signal: f.signal || "NEUTRAL", strength: f.strength || 0, implied: f.implied ?? null };
        }),
      };
      onSave(saved);
      setLastSaved(saved);
      setTkPrice(res.entry.toFixed(1));
      setTkN(String(size));
    } catch (e) {
      setError("Couldn't build the final estimate: " + e.message + ". The findings below still stand — re-run to retry.");
      setPhase("done");
    }
  }

  const pos = (v) => clamp(v, 0, 100);
  const railColor = result ? (result.edge > 0 ? "var(--amber)" : "var(--rose)") : "var(--dim)";
  const callColor = !result ? "var(--bone)" : result.call === "PASS" ? "var(--dim)" : result.side === "YES" ? "var(--amber)" : "var(--rose)";
  const fill = depth && depth.asks.length ? walkBook(depth.asks, size) : null;

  return (
    <>
      <div className="bar">
        <input value={url} onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !busy) loadBook(); }}
          placeholder="https://polymarket.com/event/…   or   https://kalshi.com/markets/…"
          aria-label="Market URL" />
        <button className="btn" onClick={() => loadBook()} disabled={busy}>
          {phase === "fetching" ? "Loading" : "Load market"}
        </button>
      </div>

      {error && <div className="panel err">{error}</div>}

      {!book && !error && phase === "idle" && (
        <div className="panel">
          <p className="sect">How this works</p>
          <p className="help">Three steps, about a minute of waiting on the third.</p>
          <div className="start">
            <span className="n">1</span>
            <span className="t">
              <b>Give me a market.</b> Paste a link from Kalshi or Polymarket in the box above, or open
              <b> Find a market</b> and pick one from the list.
            </span>
            <span className="n">2</span>
            <span className="t">
              <b>I read the fine print, then research it nine ways.</b> Polls, injuries, weather models, order
              books — whichever nine fit the topic. You can see and edit all of them under <b>What I check</b>.
            </span>
            <span className="n">3</span>
            <span className="t">
              <b>You get a price and a verdict.</b> What the contract is worth versus what it really costs to
              fill after fees — and anything I'd actually buy has to survive a final attempt to knock it down first.
            </span>
          </div>
          <p className="help" style={{ marginTop: 18 }}>Try one of these:</p>
          <button className="example" onClick={() => { setUrl("https://polymarket.com/event/will-the-us-invade-iran-before-2027"); loadBook("https://polymarket.com/event/will-the-us-invade-iran-before-2027"); }}>
            polymarket.com/event/will-the-us-invade-iran-before-2027
          </button>
          <p className="help" style={{ marginTop: 14 }}>
            Each analysis costs roughly 30–50 cents in API credit and takes a minute or two.
          </p>
        </div>
      )}

      {book && phase === "choosing" && (
        <div className="panel">
          <div className="eyebrow">{book.venue} · {book.markets.length} contracts on this event</div>
          <p className="q" style={{ marginBottom: 16 }}>{book.event}</p>
          {book.markets.slice(0, 30).map((m) => (
            <button key={m.id} className="sel" onClick={() => { setMarket(m); setPhase("ready"); }}>
              <span>
                {m.name === m.question ? m.question : m.question + " — " + m.name}
                <span className="sub">
                  {m.volume ? "vol " + Math.round(m.volume).toLocaleString() : "no volume"}
                  {m.close ? " · closes " + String(m.close).slice(0, 10) : ""}
                </span>
              </span>
              <span className="px">{m.price.toFixed(0)}c</span>
            </button>
          ))}
          <div className="eyebrow" style={{ marginTop: 10 }}>Pick the outcome you want priced</div>
        </div>
      )}

      {market && phase !== "choosing" && (
        <div className="panel">
          <div className="eyebrow">{market.venue} · {book.source} · {market.id}</div>
          <p className="q">{market.question}</p>
          {market.name !== market.question && <div className="eyebrow" style={{ marginTop: 8 }}>Outcome: {market.name}</div>}

          <div className="meta">
            <div><span className="k">Costs now</span><span className="v" style={{ color: "var(--cyan)" }}>{market.price.toFixed(1)}c</span></div>
            {market.bid != null && <div><span className="k">Bid / ask</span><span className="v">{market.bid}–{market.ask}</span></div>}
            <div><span className="k">Volume</span><span className="v">{market.volume ? "$" + Math.round(market.volume).toLocaleString() : "—"}</span></div>
            <div><span className="k">Settles</span><span className="v">{market.close ? String(market.close).slice(0, 10) : "—"}</span></div>
            {hist && (
              <div>
                <span className="k">24h move</span>
                <span className="v" style={{ color: hist.change24h > 0.5 ? "var(--moss)" : hist.change24h < -0.5 ? "var(--rose)" : "var(--dim)" }}>
                  {hist.change24h >= 0 ? "+" : ""}{hist.change24h.toFixed(1)}c
                </span>
              </div>
            )}
            {hist && <div><span className="k">Last 7 days</span><Spark points={hist.points} /></div>}
            {isThin(market) && (
              <div><span className="k">Liquidity</span><span className="v" style={{ color: "var(--amber)" }}>thin</span></div>
            )}
          </div>

          {audit && !result && (
            <p className="help" style={{ marginTop: 12 }}>
              <strong style={{ color: "var(--bone)" }}>Fine print:</strong> {audit.summary}
              {audit.traps && audit.traps.length > 0 ? <span style={{ color: "var(--amber)" }}> · {audit.traps[0]}</span> : null}
            </p>
          )}

          {!result && !busy && (() => {
            const prev = (ledger || []).find((e) => e.marketId === market.id && e.venue === market.venue);
            return prev ? (
              <p className="help" style={{ marginTop: 12 }}>
                I've priced this one before ({new Date(prev.ts).toISOString().slice(0, 10)}): said{" "}
                <span className="mono">{prev.call}</span> with fair {Number(prev.fair).toFixed(0)}c against a{" "}
                {Number(prev.price).toFixed(0)}c price. Re-running shows what's changed.
              </p>
            ) : null;
          })()}

          {live && !live.error && !live.none && live.sides && (
            <div className="sb">
              <div className="sb-head">
                <span className={"sb-badge" + (live.state === "in" ? " live" : "")}>
                  {live.state === "in" && <span className="pulse" />}
                  {live.state === "in" ? "LIVE" : live.state === "post" ? "FINAL" : "UPCOMING"}
                </span>
                <span className="sb-detail">
                  {live.league}{live.detail ? " · " + live.detail : ""}
                  {live.state === "in" && live.clock ? " · " + live.clock : ""}
                </span>
              </div>

              {live.sides.map((sd, i) => {
                const best = Math.max.apply(null, live.sides.map((x) => Number(x.score) || 0));
                const lead = (Number(sd.score) || 0) === best && best > 0;
                return (
                  // Keyed on the score so a scoring play re-mounts the row and
                  // fires the amber flash animation.
                  <div key={i + ":" + (sd.score ?? "-") + ":" + ((sd.sets || []).join(","))}
                    className={"sb-row" + (lead ? " lead" : "")}>
                    <span className="sb-abbr">{sd.abbr || sd.name.slice(0, 3).toUpperCase()}</span>
                    <span className="sb-name">
                      {sd.name}
                      {sd.home ? <i className="sb-home">home</i> : null}
                    </span>
                    {sd.sets && sd.sets.length > 0 ? (
                      <span className="sb-sets">{sd.sets.map((v, j) => <b key={j}>{v}</b>)}</span>
                    ) : <span />}
                    <span className="sb-score">{sd.score ?? "–"}</span>
                  </div>
                );
              })}

              {(() => {
                const w = likelyWinner(live, market.name, market.price);
                if (!w) return null;
                const col = w.final ? "var(--moss)" : w.pct >= 65 ? "var(--amber)" : "var(--dim)";
                return (
                  <div className="sb-call">
                    <span className="who" style={{ color: col }}>{w.name}</span>
                    {w.final ? <span>wins — final</span> : (
                      <>
                        <span>projected to win</span>
                        <b style={{ color: col }}>{w.pct.toFixed(0)}%</b>
                        {w.pct < 58 && <span>— close to a coin flip</span>}
                        {w.market ? <span className="srcchip">market price</span> : <span className="srcchip">live model</span>}
                      </>
                    )}
                  </div>
                );
              })()}

              {(live.extra || live.downDistance) && (
                <div className="sb-sit">
                  {live.downDistance || ""}
                  {live.possession ? (live.downDistance ? " · " : "") + "ball: " + live.possession : ""}
                  {live.extra ? ((live.downDistance || live.possession) ? " · " : "") + live.extra : ""}
                </div>
              )}

              {live.impliedCents != null && live.mySide && (
                <div className="sb-wp">
                  <div className="eyebrow" style={{ marginBottom: 6 }}>
                    Win probability · {live.mySide.name} {live.impliedCents.toFixed(1)}%
                    <span style={{ color: Math.abs(live.impliedCents - market.price) > 4 ? "var(--amber)" : "var(--dim)" }}>
                      {"  vs market " + market.price.toFixed(0) + "c ("}
                      {live.impliedCents - market.price > 0 ? "+" : ""}
                      {(live.impliedCents - market.price).toFixed(1)}c{")"}
                    </span>
                  </div>
                  <div className="wp-bar"><div className="wp-fill" style={{ width: clamp(live.impliedCents, 0, 100) + "%" }} /></div>
                </div>
              )}

              {live.lastPlay && <div className="sb-play">{live.lastPlay}</div>}

              <div className="sb-foot">
                {live.oddsBook && live.mySide && (
                  <span className="srcchip" style={{ color: "var(--moss)", borderColor: "rgba(127,185,139,.45)" }}>
                    {live.oddsBook.books}-book consensus: {live.mySide.name}{" "}
                    {(live.mySide.home ? live.oddsBook.home : live.oddsBook.away).toFixed(0)}%
                    {live.oddsBook.disp > 6 ? " · books split" : ""}
                  </span>
                )}
                {live.odds && (
                  <span className="srcchip" style={{ color: "var(--cyan)", borderColor: "rgba(111,179,210,.45)" }}>
                    {live.odds.provider}: {live.odds.details || "no line"}
                    {live.odds.overUnder != null ? " · O/U " + live.odds.overUnder : ""}
                  </span>
                )}
                {live.sources.map((sv) => (
                  <span key={sv.name} className={"srcchip" + (live.disagree ? " bad" : " ok")}>
                    {sv.name} · {sv.line}
                  </span>
                ))}
                <span className="srcchip">as of {new Date(live.fetched).toLocaleTimeString()}</span>
                {live.state === "in" && <span className="srcchip" style={{ color: "var(--rose)", borderColor: "rgba(228,112,126,.45)" }}>updating every 10s</span>}
              </div>

              {live.disagree && (
                <p className="thesis" style={{ color: "var(--rose)", margin: "0 16px 14px", fontSize: 13 }}>
                  The feeds disagree on the score. One is lagging — check the broadcast before acting on this.
                </p>
              )}
            </div>
          )}
          {live && live.none && (
            <div className="eyebrow" style={{ marginTop: 14 }}>
              {live.league}: no matching game on today's scoreboard
            </div>
          )}

          {legs && (
            <div className="panel" style={{ marginTop: 14, background: "rgba(0,0,0,.14)" }}>
              <p className="sect" style={{ margin: 0 }}>Parlay legs — every one must hit</p>
              {legs.map((l, i) => {
                const ll = legLive && legLive[i] && !legLive[i].none ? legLive[i] : null;
                const part = legsCombined(legs, legLive);
                const pp = part && part.parts[i];
                const scoreLine = ll && ll.sides
                  ? ll.sides.map((s) => (s.abbr || s.name.slice(0, 3)) + " " + (s.score != null ? s.score : "-")).join(" · ") +
                    (ll.state === "in" ? " · LIVE" + (ll.clock ? " " + ll.clock : "") : ll.state === "post" ? " · FINAL" : " · upcoming")
                  : "no live feed yet";
                return (
                  <div key={l.ticker} className="score-row" style={{ borderBottom: "1px solid rgba(65,75,99,.35)" }}>
                    <span className="who" style={{ fontSize: 13.5 }}>
                      {l.side} · <b>{l.name}</b>
                      <span className="sub" style={{ display: "block" }}>{(l.league || "?") + " · " + l.question + " · " + scoreLine}</span>
                    </span>
                    <span className="pts" style={{ fontSize: 14, color: pp && pp.src === "live" ? "var(--violet)" : undefined }}>
                      {pp ? pp.p.toFixed(0) + "%" : "…"}
                      <span className="sub" style={{ display: "block" }}>{pp ? pp.src : ""}</span>
                    </span>
                  </div>
                );
              })}
              {(() => {
                const cmb = legsCombined(legs, legLive);
                if (!cmb) return null;
                return (
                  <p className="help" style={{ marginTop: 10, color: cmb.dead ? "var(--rose)" : undefined }}>
                    {cmb.dead
                      ? "A leg has LOST — this parlay can no longer win."
                      : "Multiplying the legs: the parlay is worth about " + cmb.prob.toFixed(0) + "c right now" +
                        (cmb.live ? " (using live win odds)" : " (using each leg's own market price)") + "."}
                  </p>
                );
              })()}
            </div>
          )}

          <div className="cmp-box">
            {(() => {
              const rows = [{ label: "Market price", v: market.price, color: "var(--cyan)", note: "what it costs now" }];
              if (live && live.impliedCents != null) {
                rows.push({ label: "Live win prob", v: live.impliedCents, color: "var(--violet)", note: "in-game model, right now" });
              }
              // The Odds API wide consensus gets its own row whenever we have
              // it — it's the strongest external read and should be VISIBLE.
              if (live && live.oddsBook && live.mySide) {
                const ob = live.oddsBook;
                const bp = live.mySide.home ? ob.home : ob.away;
                const fresh = ob.updated && Date.now() - ob.updated < ODDS_FRESH_MS;
                rows.push({ label: "Sportsbooks", v: bp, color: "var(--moss)",
                  note: ob.books + " book" + (ob.books === 1 ? "" : "s") + ", vig removed" + (live.state === "in" ? (fresh ? ", in-play" : ", pregame") : "") });
              } else if (live && live.impliedCents == null && live.bookProb && live.mySide) {
                const bp = live.mySide.home ? live.bookProb.home : live.bookProb.away;
                const nb = live.bookProb.books || 1;
                rows.push({ label: "Sportsbooks", v: bp, color: "var(--moss)", note: nb + " book" + (nb === 1 ? "" : "s") + " via ESPN, vig removed" });
              }
              if (legs) {
                const cmb = legsCombined(legs, legLive);
                if (cmb) rows.push({ label: "Legs combined", v: cmb.prob, color: "var(--violet)",
                  note: legs.length + " legs multiplied" + (cmb.live ? ", live" : "") + (cmb.dead ? " — a leg LOST" : "") });
              }
              if (xp && xp.status === "found") {
                rows.push({ label: xp.match.venue, v: xp.match.price, color: "var(--moss)", note: "same bet, other exchange" });
              }
              if (result) {
                rows.push({ label: "My fair value", v: result.fair, color: railColor, strong: true,
                  note: (result.edge > 0 ? "+" : "") + result.edge.toFixed(1) + "c vs market" });
              }
              return rows.map((r) => (
                <div key={r.label} className={"cmp-row" + (r.strong ? " strong" : "")}>
                  <span className="cl">{r.label}</span>
                  <div className="cmp-track">
                    {[25, 50, 75].map((t) => <div key={t} className="cmp-tick" style={{ left: t + "%" }} />)}
                    <div className="cmp-fill" style={{ width: pos(r.v) + "%", background: r.color, opacity: r.strong ? 0.95 : 0.55 }} />
                  </div>
                  <span className="cv" style={{ color: r.color }}>
                    {r.v.toFixed(0)}% chance
                    <span className="sub2">{r.note}</span>
                  </span>
                </div>
              ));
            })()}
            {busy && !result && <div className="cmp-scan"><div className="sweep" /></div>}
            {result ? (
              <p className="cmp-verdict">
                {Math.abs(result.edge) < 2 ? (
                  <>The market and my estimate <b>agree within {Math.abs(result.edge).toFixed(1)}c</b> — this looks fairly priced.</>
                ) : result.edge > 0 ? (
                  <>All the checks together make <b style={{ color: "var(--amber)" }}>{market.name}</b> a <b style={{ color: "var(--amber)" }}>{result.fair.toFixed(0)}% shot</b> — the market only sees {market.price.toFixed(0)}%.
                  {result.call === "PASS" ? " But after the real fill price and fees the gap is too small to bet — see the verdict below." : " My call is below."}</>
                ) : (
                  <>All the checks together give <b style={{ color: "var(--rose)" }}>{market.name}</b> only a <b style={{ color: "var(--rose)" }}>{result.fair.toFixed(0)}% chance</b> — the market sees {market.price.toFixed(0)}%, so the OTHER side is the likelier outcome.
                  {result.call === "PASS" ? " But after costs the gap is too small to bet — see the verdict below." : " My call is below."}</>
                )}
              </p>
            ) : (
              <p className="help">
                Every bar is a chance out of 100 — longer bar, more likely. A contract pays 100c if it happens, so
                a {market.price.toFixed(0)}c price means the market sees about a {market.price.toFixed(0)}% chance.
                Each bar is an independent read on the same outcome — when they agree, trust the number; when they split, dig in.
              </p>
            )}
          </div>

          {(() => {
            if (legs) return null; // parlays get the legs panel instead
            const eb = eventBoard(book, live);
            if (!eb || (!eb.winner && !eb.rows.some((r) => r.prob != null))) return null;
            return (
              <div className="panel" style={{ marginTop: 14, background: "rgba(0,0,0,.14)" }}>
                <p className="sect" style={{ margin: 0 }}>Who wins — and the best bet on this event</p>
                {eb.winner && (
                  <p className="thesis" style={{ marginTop: 8 }}>
                    {eb.winner.final ? "Final: " : "Most likely winner: "}
                    <strong style={{ color: "var(--amber)" }}>{eb.winner.name}</strong>
                    {eb.winner.final ? "" : " (" + eb.winner.pct.toFixed(0) + "%" +
                      (eb.winner.book ? ", by the books" : eb.winner.market ? ", by the market" : ", live model") + ")"}
                  </p>
                )}
                {eb.rows.map((r) => {
                  const isBest = eb.best && r === eb.best && r.net > 0;
                  return (
                    <div key={r.m.id} className="score-row" style={{ borderBottom: "1px solid rgba(65,75,99,.35)" }}>
                      <span className="who" style={{ fontSize: 13.5 }}>
                        {r.m.name}
                        {isBest && <span className="srcchip" style={{ marginLeft: 8, color: "var(--moss)", borderColor: "rgba(127,185,139,.5)" }}>MOST LIKELY</span>}
                        <span className="sub" style={{ display: "block" }}>
                          {r.prob != null ? "true odds ~" + r.prob.toFixed(0) + "% (" + r.src + ")" : "no model read"}
                          {r.entry != null ? " · costs " + r.entry.toFixed(0) + "c" : ""}
                        </span>
                      </span>
                      <span className="pts" style={{ fontSize: 15, color: r.prob != null && r.prob >= 55 ? "var(--moss)" : "var(--dim)" }}>
                        {r.prob != null ? r.prob.toFixed(0) + "%" : "—"}
                        <span className="sub" style={{ display: "block" }}>chance it happens</span>
                      </span>
                    </div>
                  );
                })}
                <p className="help" style={{ marginTop: 10 }}>
                  {"Every outcome on this event with its predicted chance — the percentages come from the live models and the de-vigged book consensus. Run the full analysis on any of them to stress-test the read."}
                </p>
              </div>
            );
          })()}

          {(phase === "ready" || phase === "done") && (
            <>
              <div className="chips">
                <span className="chip static">Topic</span>
                {Object.keys(fw).map((k) => (
                  <button key={k} className={"chip" + (k === cat ? " on" : "")} onClick={() => setCat(k)}>{fw[k].label}</button>
                ))}
                <span className="chip static">{conf.items.filter((p) => p.enabled).length} of 9 checks on</span>
              </div>
              <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="btn" onClick={() => analyze()} disabled={busy}>
                  {result ? "Run it again" : "Analyze this market"}
                </button>
                <button className="btn btn-ghost" onClick={() => crossPlatform(market)} disabled={busy}>
                  Check the other exchange
                </button>
                {book.markets.length > 1 && <button className="btn btn-ghost" onClick={() => setPhase("choosing")}>Change outcome</button>}
              </div>
            </>
          )}

          {xp && (
            <details className="fold" open>
              <summary>The other exchange</summary>
              {xp.status === "searching" && <p className="pwait"><span className="dots">matching contracts on the other venue</span></p>}
              {xp.status === "none" && <p className="thesis" style={{ color: "var(--dim)" }}>No equivalent contract found on the other venue. Treat this as a single-venue read.</p>}
              {xp.status === "error" && <p className="thesis" style={{ color: "var(--rose)" }}>Match failed: {xp.msg}</p>}
              {xp.status === "found" && (
                <p className="thesis">
                  <strong>{xp.match.venue}</strong> prices the same event at{" "}
                  <span className="mono" style={{ color: "var(--moss)" }}>{xp.match.price.toFixed(1)}c</span>, a gap of{" "}
                  <span className="mono" style={{ color: Math.abs(xp.gap) > 3 ? "var(--amber)" : "var(--dim)" }}>
                    {xp.gap > 0 ? "+" : ""}{xp.gap.toFixed(1)}c
                  </span>. {xp.caveat}
                </p>
              )}
              <p className="help">
                The same event often trades at different prices on the two exchanges. A wide gap is either free
                money or a sign the two contracts don't settle on quite the same thing.
              </p>
            </details>
          )}

          {depth && depth.asks.length > 0 && (
            <details className="fold">
              <summary>What your order would actually cost</summary>
              <div className="meta" style={{ marginTop: 10, alignItems: "flex-end" }}>
                <div>
                  <span className="k">How many</span>
                  <input className="srch" type="number" min="1" value={size} style={{ width: 110, padding: "7px 9px", flex: "none" }}
                    onChange={(e) => setSize(Math.max(1, Number(e.target.value) || 1))} />
                </div>
                <div><span className="k">Best ask</span><span className="v">{depth.asks[0][0].toFixed(1)}c</span></div>
                <div><span className="k">Avg fill</span><span className="v" style={{ color: "var(--amber)" }}>{fill ? fill.avg.toFixed(1) + "c" : "—"}</span></div>
                <div><span className="k">Slippage</span><span className="v">{fill ? (fill.avg - depth.asks[0][0]).toFixed(2) + "c" : "—"}</span></div>
                {fill && fill.short > 0 && <div><span className="k">Can't fill</span><span className="v" style={{ color: "var(--rose)" }}>{fill.short}</span></div>}
              </div>
              <p className="help">
                The screen price is only for the first few contracts. Buy more and you pay worse prices as you eat
                through the order book — that difference is the slippage.
              </p>
            </details>
          )}

          {result && (
            <>
              {(() => {
                // Prediction-first: name the outcome the desk expects, at
                // what probability, at what certainty tier. The betting
                // recommendation is a consequence, not the headline.
                const predYes = result.fair >= 50;
                const predProb = predYes ? result.fair : 100 - result.fair;
                let predName = market.name;
                if (!predYes) {
                  const bsNo = betSide({ call: "BUY NO", side: "NO" }, market, live);
                  predName = bsNo ? bsNo.who : "NOT " + market.name;
                }
                const tier = predProb >= 80 ? { t: "STRONGEST CALL", c: "var(--moss)" }
                  : predProb >= 68 ? { t: "STRONG CALL", c: "var(--moss)" }
                  : predProb >= 55 ? { t: "LEAN", c: "var(--amber)" }
                  : { t: "TOO CLOSE TO CALL", c: "var(--dim)" };
                const bs = result.call !== "PASS" ? betSide(result, market, live) : null;
                return (
                <>
                <div className="verdict">
                  <div style={{ minWidth: 0 }}>
                    <div className="label" style={{ marginBottom: 6 }}>My prediction</div>
                    <h2 style={{ color: predProb >= 55 ? tier.c : "var(--bone)" }}>
                      {predProb >= 55 ? predName : "Too close to call"}
                    </h2>
                    <div className="eyebrow" style={{ marginTop: 6 }}>
                      {predProb >= 55
                        ? predProb.toFixed(0) + "% by all checks combined · " + tier.t + " · confidence " + result.confidence
                        : "roughly " + result.fair.toFixed(0) + "/" + (100 - result.fair).toFixed(0) + " — no side earns a call"}
                    </div>
                  </div>
                  <span className="tierbox" style={{ color: tier.c, borderColor: tier.c, alignSelf: "center" }}>
                    <span className="pct">{predProb.toFixed(0)}%</span>
                    <span className="lbl">{predProb >= 55 ? tier.t.replace(" CALL", "") : "TOSS-UP"}</span>
                  </span>
                </div>

                <p className="answer">
                  {predProb >= 55 ? (
                    <>
                      Everything the checks found says <strong>{predName}</strong> — a {predProb.toFixed(0)}% shot
                      once the market prior, the books, the live feeds and the research are weighed together.{" "}
                      The market consensus sits at {market.price.toFixed(0)}% —{" "}
                      {Math.abs(result.fair - market.price) < 4
                        ? "aligned with this prediction."
                        : "a real gap from this prediction; the verification pass " +
                          (result.verify && result.verify.verdict === "CONFIRM" ? "backed my read." : "couldn't settle who's right.")}
                    </>
                  ) : (
                    <>
                      The evidence splits almost evenly ({result.fair.toFixed(0)}% yes / {(100 - result.fair).toFixed(0)}% no)
                      — anyone claiming certainty on this one is guessing.
                      {result.verify && result.verify.verdict === "REFUTE" ? " The final check also killed the trade case." : ""}
                    </>
                  )}
                </p>
                </>
                );
              })()}
              {result.thesis && <p className="thesis">{result.thesis}</p>}
              {result.verify && (
                <p className="thesis" style={{ color: result.verify.verdict === "CONFIRM" ? "var(--moss)" : "var(--rose)" }}>
                  Final check ({result.verify.verdict.toLowerCase()}): {result.verify.reason}
                </p>
              )}

              <div className="figures">
                <div className="fig">
                  <span className="big" style={{ color: "var(--amber)" }}>
                    {(result.fair >= 50 ? result.fair : 100 - result.fair).toFixed(0)}%
                  </span>
                  <span className="cap">Chance it happens</span>
                  <span className="sub">Every check weighed by evidence strength and track record</span>
                </div>
                <div className="fig">
                  <span className="big">{result.confidence}</span>
                  <span className="cap">How sure I am</span>
                  <span className="sub">Strength and agreement of the evidence</span>
                </div>
                <div className="fig">
                  <span className="big">{result.strong}<span style={{ color: "var(--dim)" }}>/9</span></span>
                  <span className="cap">Checks with real data</span>
                  <span className="sub">The rest found nothing and were ignored</span>
                </div>
                <div className="fig">
                  <span className="big">{market.price.toFixed(0)}%</span>
                  <span className="cap">Market consensus</span>
                  <span className="sub">{Math.abs(result.fair - market.price) < 4
                    ? "The crowd reads it the same way"
                    : "The crowd sees it differently — one of us is missing something"}</span>
                </div>
              </div>

              {((result.signals && result.signals.length) || result.sampleSpread > 0 || (result.calib && result.calib.active)) && (
                <details className="fold">
                  <summary>How the probability was built</summary>
                  <div className="meta" style={{ marginTop: 10 }}>
                    <div><span className="k">Market</span><span className="v">{market.price.toFixed(0)}c</span></div>
                    {(result.signals || []).map((s, i) => (
                      <div key={i}>
                        <span className="k">{s.label}</span>
                        <span className="v" style={{ color: "var(--violet)" }}>{s.prob.toFixed(0)}%</span>
                      </div>
                    ))}
                    <div><span className="k">Weighted anchor</span><span className="v">{result.anchor.toFixed(0)}c</span></div>
                    <div><span className="k">Fair (median of 3)</span><span className="v" style={{ color: "var(--amber)" }}>{result.fair.toFixed(0)}c</span></div>
                  </div>
                  <p className="help" style={{ marginTop: 10 }}>
                    Fair value is the median of three independent pricings, anchored to the market plus every
                    signal above weighted by evidence and track record.
                    {result.sampleSpread > 0 ? " The three landed within " + result.sampleSpread.toFixed(0) + "c of each other" +
                      (result.sampleSpread > 10 ? " — wide enough that I trimmed the confidence." : ".") : ""}
                    {result.signalSpread > 12 ? " The independent signals disagree by " + result.signalSpread.toFixed(0) + "c, so confidence is tempered." : ""}
                    {result.calib && result.calib.active ? " Calibration from " + result.calib.n + " settled calls pulled the estimate " +
                      Math.round((1 - result.calib.k) * 100) + "% toward the market." : ""}
                  </p>
                </details>
              )}

              {result.call === "PASS" && (
                <p className="help" style={{ marginTop: 14 }}>
                  Passing is a real answer. Most contracts are priced about right, and no trade beats a bad one.
                </p>
              )}

              {result.call !== "PASS" && lastSaved && (
                lastSaved.taken ? (
                  <p className="help" style={{ marginTop: 16, color: "var(--moss)" }}>
                    Tracking this position — open <b>My trades</b> for live hold / buy-more / sell calls.
                  </p>
                ) : (
                  <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div>
                      <span className="k eyebrow" style={{ display: "block", marginBottom: 4 }}>Your fill (c)</span>
                      <input className="srch" type="number" step="0.1" value={tkPrice} onChange={(e) => setTkPrice(e.target.value)}
                        style={{ width: 100, padding: "8px 10px", flex: "none" }} aria-label="Fill price in cents" />
                    </div>
                    <div>
                      <span className="k eyebrow" style={{ display: "block", marginBottom: 4 }}>Contracts</span>
                      <input className="srch" type="number" min="1" value={tkN} onChange={(e) => setTkN(e.target.value)}
                        style={{ width: 100, padding: "8px 10px", flex: "none" }} aria-label="Number of contracts" />
                    </div>
                    <button className="btn btn-sm" onClick={() => {
                      if (!lastSaved || !result) return;
                      const upd = { ...lastSaved, taken: {
                        side: result.side, entryPrice: Number(tkPrice) || result.entry,
                        contracts: Math.max(1, Math.round(Number(tkN) || 1)), at: Date.now() } };
                      onSave(upd);
                      setLastSaved(upd);
                    }}>I took this trade</button>
                    <span className="help" style={{ flexBasis: "100%", marginTop: 2 }}>
                      Mark it, and <b>My trades</b> will watch the price and the game and tell you when to hold, buy more, or get out.
                    </span>
                  </div>
                )
              )}
            </>
          )}
        </div>
      )}

      {(busy || result) && market && phase !== "choosing" && (
        <div className="panel">
          <p className="sect">The nine checks</p>
          <p className="help" style={{ marginBottom: 10 }}>
            Each one searches the web for a specific kind of evidence. YES means it argues the contract is
            underpriced, NO means overpriced, and the number is how solid the evidence was out of 3.
          </p>
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            {conf.label} ·{" "}
            {phase === "auditing" ? <span className="dots">reading the fine print</span>
              : phase === "researching" ? <span className="dots">{live && live.state === "in" ? "searching, with the live score in hand" : "searching in parallel"}</span>
              : phase === "contrarian" ? <span className="dots">risk officer arguing the other side</span>
              : phase === "synthesizing" ? <span className="dots">pricing fair value</span>
              : phase === "verifying" ? <span className="dots">trying to kill the trade before you pay for it</span> : "complete"}
          </div>
          {conf.items.map((p) => {
            const f = findings[p.n];
            const col = !f ? "var(--dim)" : f.signal === "YES" ? "var(--amber)" : f.signal === "NO" ? "var(--rose)" : "var(--dim)";
            return (
              <div key={p.n} className={"pillar" + (f ? " arrive" : "") + (p.n === 9 ? " contra" : "") + (p.enabled ? "" : " off")}>
                <div className="pnum">{String(p.n).padStart(2, "0")}</div>
                <div>
                  <div className="pname">{p.name}{p.n === 9 ? " ↺" : ""}</div>
                  <div className="pdesc">{p.method}</div>
                  {!p.enabled ? <div className="pwait">turned off in Frameworks</div>
                    : f ? <div className="pfind">{f.finding}</div>
                    : <div className="pwait"><span className="dots">searching</span></div>}
                </div>
                {f && p.enabled && (
                  <div className="sig" style={{ color: col, borderColor: col }}>
                    {f.signal} · {f.strength}/3{f.implied != null ? " · " + Number(f.implied).toFixed(0) + "c" : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {result && (result.drivers.length > 0 || result.risks.length > 0) && (
        <div className="panel">
          {result.drivers.length > 0 && (
            <>
              <p className="sect">What convinced me</p>
              <ul className="lst" style={{ marginTop: 10 }}>{result.drivers.map((d, i) => <li key={i}>{d}</li>)}</ul>
            </>
          )}
          {result.risks.length > 0 && (
            <>
              <p className="sect" style={{ marginTop: 20, color: "var(--rose)" }}>What would prove me wrong</p>
              <ul className="lst" style={{ marginTop: 10 }}>{result.risks.map((d, i) => <li key={i}>{d}</li>)}</ul>
            </>
          )}
          {(result.resolution || audit) && (
            <>
              <p className="sect" style={{ marginTop: 20 }}>
                Read the fine print{audit && audit.severity === "HIGH" ? " — it bites on this one" : ""}
              </p>
              {audit && audit.summary && (
                <p className="thesis" style={{ marginTop: 8 }}><strong>Settles when:</strong> {audit.summary}</p>
              )}
              {audit && (audit.traps || []).length > 0 && (
                <ul className="lst" style={{ marginTop: 8 }}>
                  {audit.traps.map((t, i) => <li key={i} style={{ color: "var(--amber)" }}>{t}</li>)}
                </ul>
              )}
              {result.resolution && <p className="thesis" style={{ marginTop: 8 }}>{result.resolution}</p>}
            </>
          )}
          {sources.length > 0 && (
            <>
              <p className="sect" style={{ marginTop: 20 }}>Where this came from ({sources.length} sources)</p>
              <div className="src">
                {Array.from(new Map(sources.map((s) => [s.url, s])).values()).slice(0, 24).map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noreferrer">{(s.title || s.url).slice(0, 46)}</a>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

/* ---------------- My trades ---------------- */
function Positions({ ledger, save, reopen, reload }) {
  // One card per actual market position. A re-analysis plus a Kalshi sync
  // can both end up flagged "taken" for the same market — show the entry
  // that carries a real analysis (else the newest) and ignore the shadow.
  const open = useMemo(() => {
    const byMkt = {};
    ledger.filter((e) => e.taken && e.status === "open").forEach((e) => {
      const k = e.venue + ":" + e.marketId;
      const cur = byMkt[k];
      if (!cur) { byMkt[k] = e; return; }
      const analyzed = (x) => (x.pillars || []).length > 0;
      const better = analyzed(e) !== analyzed(cur) ? analyzed(e) : (e.ts || 0) > (cur.ts || 0);
      if (better) byMkt[k] = e;
    });
    return Object.values(byMkt);
  }, [ledger]);
  const settled = ledger.filter((e) => e.taken && e.status === "resolved" && e.outcome !== null);
  const trackedKeys = new Set(open.map((e) => e.venue + ":" + e.marketId));
  const candidates = ledger.filter((e) => !e.taken && e.status === "open" && e.call !== "PASS" &&
    !trackedKeys.has(e.venue + ":" + e.marketId)).slice(0, 8);
  const [q, setQ] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [kal, setKal] = useState(null);
  const [confirmId, setConfirmId] = useState(null); // position awaiting close confirm
  const [closing, setClosing] = useState(null);      // position id mid-close
  const [closeNote, setCloseNote] = useState(null);
  const [wsOn, setWsOn] = useState(false);           // realtime feed connected
  const anyLiveRef = useRef(false);
  const legsCacheRef = useRef({});                   // combo marketId -> leg tickers
  const openRef = useRef(open);
  openRef.current = open;

  // Realtime Kalshi quotes: the server relays the authenticated Kalshi
  // WebSocket as a server-sent-event stream, so prices tick the moment the
  // market trades — the polling refresh below stays as the game-feed and
  // fallback path. EventSource reconnects on its own when the stream ends.
  useEffect(() => {
    const tickers = open.filter((e) => e.venue === "Kalshi").map((e) => e.marketId);
    if (!tickers.length || typeof EventSource === "undefined") return;
    const es = new EventSource("/api/desk/kalshi/stream?tickers=" + encodeURIComponent(tickers.join(",")));
    es.onopen = () => setWsOn(true);
    es.onerror = () => setWsOn(false);
    es.onmessage = (evM) => {
      try {
        const d = JSON.parse(evM.data);
        const m = d.msg || {};
        const tk = m.market_ticker || m.ticker;
        if (!tk) return;
        const cents = (v, dv) => (v != null ? Number(v) : dv != null ? Number(dv) * 100 : null);
        const bid = cents(m.yes_bid, m.yes_bid_dollars);
        const ask = cents(m.yes_ask, m.yes_ask_dollars);
        let price = cents(m.price, m.price_dollars);
        if (price == null && bid != null && ask != null) price = (bid + ask) / 2;
        if (price == null || !Number.isFinite(price)) return;
        const ent = openRef.current.find((x) => x.venue === "Kalshi" && x.marketId === tk);
        if (!ent) return;
        setQ((prev) => ({ ...prev, [ent.id]: {
          ...(prev[ent.id] || {}), quote: { price, bid, ask }, price, at: Date.now() } }));
      } catch { /* malformed frame */ }
    };
    return () => { es.close(); setWsOn(false); };
  }, [ledger.length]);

  async function closePosition(e, curSide) {
    setClosing(e.id); setCloseNote(null); setConfirmId(null);
    try {
      const r = await fetch("/api/desk/kalshi/close", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: e.marketId }),
      });
      const d = await r.json();
      if (d.ok) {
        setCloseNote({ forId: e.id, ok: true, msg: "Sold " + d.sold + " " + d.side.toUpperCase() + " on " + e.marketId + " at market. Your account will reflect it in a moment." });
        if (reload) await reload();
        refresh();
      } else {
        setCloseNote({ forId: e.id, ok: false, msg: d.error || "Close failed." });
      }
    } catch (err) {
      setCloseNote({ forId: e.id, ok: false, msg: "Close request failed: " + err.message });
    }
    setClosing(null);
  }

  async function refresh() {
    // Pull the real Kalshi account first (if connected), then re-sync the
    // trade list, so positions opened or closed on kalshi.com just appear.
    try {
      const kr = await fetch("/api/desk/kalshi");
      const kd = await kr.json().catch(() => null);
      setKal(kd && kd.configured ? kd : null);
    } catch { /* sync is best-effort */ }
    if (reload) await reload();
    if (!open.length) return;
    setRefreshing(true);
    const out = {};
    await Promise.all(open.map(async (e) => {
      const [quote, live] = await Promise.all([
        fetchCurrentPrice(e),
        fetchLive({ id: e.marketId, question: e.question, name: e.name }).catch(() => null),
      ]);
      // A parlay position tracks each LEG's game, not a (nonexistent)
      // single game for the combo.
      let legsInfo = null, legLiveArr = null;
      if (e.venue === "Kalshi" && /^KXMVE/i.test(e.marketId)) {
        let legTks = legsCacheRef.current[e.marketId];
        if (legTks === undefined) {
          try {
            const r = await fetch(px("https://api.elections.kalshi.com/trade-api/v2/markets/" + e.marketId));
            const d = r.ok ? await r.json() : null;
            const km = d && d.market ? kaMarket(d.market) : null;
            legTks = km && km.legs ? km.legs : null;
          } catch { legTks = null; }
          legsCacheRef.current[e.marketId] = legTks;
        }
        if (legTks) {
          legsInfo = await resolveLegs({ legs: legTks });
          if (legsInfo) legLiveArr = await Promise.all(legsInfo.map((l) =>
            fetchLive({ id: l.ticker, question: l.question, name: l.name }).catch(() => null)));
        }
      }
      out[e.id] = { quote, price: quote ? quote.price : null, live, legs: legsInfo, legLive: legLiveArr, at: Date.now() };
    }));
    setQ(out);
    anyLiveRef.current = Object.values(out).some((x) => (x.live && x.live.state === "in") ||
      (x.legLive || []).some((l) => l && l.state === "in"));
    setRefreshing(false);
  }

  // Refresh on open, then every 15 seconds while any game is live and
  // every 30 otherwise. Returning to the tab refreshes immediately. The loop
  // calls through a ref so each cycle sees the CURRENT open-position list —
  // the effect only re-runs when the ledger length changes, and a sync can
  // swap positions without changing the count.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    let alive = true, timer = null;
    const loop = async () => {
      await refreshRef.current();
      if (!alive) return;
      timer = setTimeout(loop, anyLiveRef.current ? 15000 : 30000);
    };
    loop();
    const onVis = () => { if (!document.hidden) { if (timer) clearTimeout(timer); loop(); } };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", onVis); };
  }, [ledger.length]);

  const settledPnl = settled.reduce((s, e) => {
    const won = (e.taken.side === "YES" ? 1 : 0) === e.outcome;
    return s + ((won ? 100 : 0) - e.taken.entryPrice) * e.taken.contracts / 100;
  }, 0);

  return (
    <>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
          <p className="sect" style={{ margin: 0 }}>Positions I'm watching ({open.length})</p>
          <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={refreshing || !open.length}>
            {refreshing ? "Refreshing" : "Refresh now"}
          </button>
        </div>
        <p className="help" style={{ marginTop: 6 }}>
          Live prices and game feeds against what each position is worth. Kalshi prices tick in realtime over a
          live feed; scores and advice refresh every 15 seconds during games, every 30 otherwise. All free — no
          analysis credits.
        </p>
        {(kal && !kal.error) || wsOn ? (
          <div className="chips" style={{ marginTop: 8 }}>
            {kal && !kal.error && (
              <span className="chip static" style={{ color: "var(--moss)", borderColor: "rgba(127,185,139,.5)" }}>
                Kalshi account connected · {kal.synced} position{kal.synced === 1 ? "" : "s"} synced
              </span>
            )}
            {kal && kal.history && (
              <span className="chip static" style={{
                color: kal.history.pnl >= 0 ? "var(--moss)" : "var(--rose)",
                borderColor: kal.history.pnl >= 0 ? "rgba(127,185,139,.5)" : "rgba(228,112,126,.5)" }}
                title="Straight from your Kalshi portfolio settlement history — the authoritative record">
                Your wagers: {kal.history.wins}-{kal.history.losses} · net {kal.history.pnl >= 0 ? "+$" : "-$"}{Math.abs(kal.history.pnl).toFixed(2)}
              </span>
            )}
            {wsOn && (
              <span className="chip static" style={{ color: "var(--cyan)", borderColor: "rgba(111,179,210,.5)" }}>
                ● realtime prices
              </span>
            )}
          </div>
        ) : null}
        {kal && kal.error && (
          <p className="help" style={{ marginTop: 8, color: "var(--rose)" }}>
            Kalshi sync hit a snag: {String(kal.error).slice(0, 140)}
          </p>
        )}

        {open.length === 0 && (
          <p className="thesis" style={{ color: "var(--dim)", marginTop: 14 }}>
            Nothing tracked yet. When an analysis says BUY and you take it, hit <b>I took this trade</b> on the
            result — or mark one of your recent calls below.
          </p>
        )}

        {open.map((e) => {
          const qq = q[e.id] || {};
          const cur = qq.price != null ? qq.price : null;
          const live = qq.live && !qq.live.none && qq.live.sides ? qq.live : null;
          const cmb = qq.legs ? legsCombined(qq.legs, qq.legLive) : null;
          const adv = cur != null ? positionAdvice(e, cur, live, qq.quote, cmb) : null;
          const curSide = cur != null ? (e.taken.side === "YES" ? cur : 100 - cur) : null;
          const pnlC = curSide != null ? curSide - e.taken.entryPrice : null;
          const pnlD = pnlC != null ? (pnlC * e.taken.contracts) / 100 : null;
          const col = adv ? ADVICE_COLORS[adv.act] || "var(--dim)" : "var(--dim)";
          return (
            <div key={e.id} className="fw" style={{ marginTop: 12 }}>
              <div className="fw-top">
                <div style={{ minWidth: 0 }}>
                  <div className="pname">
                    {qq.legs
                      ? "Parlay: " + qq.legs.map((l) => l.name + (l.league ? " (" + l.league + ")" : "")).join(" + ")
                      : e.name === e.question ? e.question : e.question + " — " + e.name}
                  </div>
                  <div className="pdesc">
                    <span className="srcchip" style={{ marginRight: 6, fontSize: 9 }}>{wagerType(e.marketId)}</span>
                    {e.venue} · {e.taken.contracts} × {(() => {
                      const tl0 = totalLine(e.marketId);
                      return tl0 != null ? (e.taken.side === "YES" ? "OVER " + tl0 : "UNDER " + tl0) : e.taken.side;
                    })()} at {Number(e.taken.entryPrice).toFixed(1)}c ·
                    my fair value {Number(e.fair).toFixed(0)}c
                  </div>
                </div>
                {adv && <span className="sig adv" style={{ color: col, borderColor: col }}>{adv.act}</span>}
              </div>
              <div className="meta" style={{ marginTop: 10 }}>
                <div><span className="k">Market now</span><span className="v">{cur != null ? cur.toFixed(1) + "c" : "…"}</span></div>
                <div><span className="k">Your side</span><span className="v">{curSide != null ? curSide.toFixed(1) + "c" : "…"}</span></div>
                <div>
                  <span className="k">Profit / loss</span>
                  <span className="v" style={{ color: pnlC == null ? "var(--dim)" : pnlC >= 0 ? "var(--moss)" : "var(--rose)" }}>
                    {pnlC == null ? "…" : (pnlC >= 0 ? "+" : "") + pnlC.toFixed(1) + "c · " + (pnlD >= 0 ? "+$" : "-$") + Math.abs(pnlD).toFixed(2)}
                  </span>
                </div>
                {live && (
                  <div>
                    <span className="k">{live.state === "in" ? "Live now" : live.state === "post" ? "Final" : "Game"}</span>
                    <span className="v">
                      {live.sides.map((s) => (s.abbr || s.name.slice(0, 3)) + " " + (s.sets && s.sets.length ? s.sets.join(" ") : (s.score != null ? s.score : "-"))).join(" · ")}
                      {live.state === "in" && live.clock ? " · " + live.clock : ""}
                    </span>
                  </div>
                )}
                {live && live.impliedCents != null && (
                  <div>
                    <span className="k">Win prob (your side)</span>
                    <span className="v" style={{ color: "var(--violet)" }}>
                      {(e.taken.side === "YES" ? live.impliedCents : 100 - live.impliedCents).toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>
              {(() => {
                // Over/under position: live total vs your line, pace, and
                // clinch detection (a total can only rise — once it crosses
                // the line, OVER is locked in).
                const tl = totalLine(e.marketId);
                if (tl == null || !live || !live.sides) return null;
                const totNow = live.sides.reduce((s, x) => s + (Number(x.score) || 0), 0);
                const lg2 = detectLeague({ id: e.marketId, question: e.question, name: e.name });
                const pace = live.state === "in" && lg2 ? paceProjection(lg2.path, live.detail, live.sides) : null;
                const clinched = totNow > tl;
                const overSide = e.taken.side === "YES";
                return (
                  <p className="help" style={{ marginTop: 8 }}>
                    <b>Total now: {totNow}</b> vs your {overSide ? "OVER" : "UNDER"} {tl} line
                    {clinched ? (
                      <b style={{ color: overSide ? "var(--moss)" : "var(--rose)" }}>
                        {" — the line is crossed; OVER is locked in" + (overSide ? " (your side wins)" : " (your side is dead)")}
                      </b>
                    ) : pace ? (
                      <span> — on pace for ~{pace.projected.toFixed(0)}{" "}
                        ({pace.projected > tl ? "over" : "under"} the line as it stands)</span>
                    ) : live.state === "post" ? (
                      <b style={{ color: overSide ? "var(--rose)" : "var(--moss)" }}>
                        {" — final under the line" + (overSide ? " (your side lost)" : " (your side wins)")}
                      </b>
                    ) : null}
                  </p>
                );
              })()}
              {qq.legs && (
                <div style={{ marginTop: 10 }}>
                  {qq.legs.map((l, i) => {
                    const ll = qq.legLive && qq.legLive[i] && !qq.legLive[i].none ? qq.legLive[i] : null;
                    const pp = cmb && cmb.parts[i];
                    const scoreLine = ll && ll.sides
                      ? ll.sides.map((s) => (s.abbr || s.name.slice(0, 3)) + " " + (s.score != null ? s.score : "-")).join(" · ") +
                        (ll.state === "in" ? " · LIVE" + (ll.clock ? " " + ll.clock : "") : ll.state === "post" ? " · FINAL" : "")
                      : "upcoming";
                    return (
                      <div key={l.ticker} className="score-row" style={{ borderBottom: "1px solid rgba(65,75,99,.35)" }}>
                        <span className="who" style={{ fontSize: 13 }}>
                          Leg {i + 1}: {l.side} <b>{l.name}</b>
                          <span className="sub" style={{ display: "block" }}>{(l.league || "?") + " · " + scoreLine}</span>
                        </span>
                        <span className="pts" style={{ fontSize: 13.5,
                          color: pp && pp.p >= 99.5 ? "var(--moss)" : pp && pp.p <= 0.5 ? "var(--rose)" : pp && pp.src === "live" ? "var(--violet)" : undefined }}>
                          {pp ? (pp.p >= 99.5 ? "WON" : pp.p <= 0.5 ? "LOST" : pp.p.toFixed(0) + "%") : "…"}
                          <span className="sub" style={{ display: "block" }}>{pp ? pp.src : ""}</span>
                        </span>
                      </div>
                    );
                  })}
                  {cmb && (
                    <p className="help" style={{ marginTop: 6, color: cmb.dead ? "var(--rose)" : undefined }}>
                      {cmb.dead ? "A leg has lost — the parlay can't win."
                        : "Parlay worth now ≈ " + cmb.prob.toFixed(0) + "c (legs multiplied" + (cmb.live ? ", live" : "") + ")."}
                    </p>
                  )}
                </div>
              )}
              {(() => {
                if (qq.legs) return null;
                const w = likelyWinner(live, e.name, cur);
                if (!w) return null;
                const mine = overlap(w.name, e.name) > 0.3;
                const col = mine ? "var(--moss)" : "var(--rose)";
                return (
                  <p className="help" style={{ marginTop: 8 }}>
                    {w.final ? "Final: " : "Projected winner: "}
                    <strong style={{ color: col }}>{w.name}</strong>
                    {w.final ? "" : " (" + w.pct.toFixed(0) + "%)"}
                    {" — "}{mine ? "that's your side." : "that's against your position."}
                  </p>
                );
              })()}
              {adv && <p className="help" style={{ marginTop: 8 }}>{adv.why}</p>}

              {confirmId === e.id ? (
                <div className="panel" style={{ marginTop: 10, background: "rgba(228,112,126,.07)", borderColor: "rgba(228,112,126,.4)" }}>
                  <p className="thesis" style={{ margin: 0 }}>
                    Sell all <b>{e.taken.contracts}</b> {e.taken.side} contracts on Kalshi at the market price
                    {curSide != null ? " (~" + curSide.toFixed(0) + "c each, about $" + ((curSide * e.taken.contracts) / 100).toFixed(2) + " back)" : ""}?
                    This places a real order and closes the position.
                  </p>
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    <button className="btn btn-sm" style={{ background: "linear-gradient(180deg,#EC8391,#E4707E)", boxShadow: "0 2px 12px rgba(228,112,126,.3)" }}
                      onClick={() => closePosition(e, curSide)} disabled={closing === e.id}>
                      {closing === e.id ? "Closing…" : "Yes, sell now"}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirmId(null)} disabled={closing === e.id}>Keep it</button>
                  </div>
                </div>
              ) : null}

              {closeNote && closeNote.forId === e.id && (
                <p className="help" style={{ marginTop: 8, color: closeNote.ok ? "var(--moss)" : "var(--rose)" }}>{closeNote.msg}</p>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                {e.taken.source === "kalshi" && confirmId !== e.id && (
                  <button className="btn btn-sm" style={{ background: "linear-gradient(180deg,#EC8391,#E4707E)", color: "#1B202B", boxShadow: "0 2px 12px rgba(228,112,126,.28)" }}
                    onClick={() => { setConfirmId(e.id); setCloseNote(null); }} disabled={closing === e.id}>
                    Close wager
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => reopen(e)}>Full re-analysis</button>
                <button className="btn btn-ghost btn-sm" onClick={() => save({ ...e, taken: null })}>Stop tracking</button>
                {(e.link || e.venue === "Kalshi") && (
                  <a className="srcchip" href={e.venue === "Kalshi" ? kalshiEventLink(e.marketId) : e.link}
                    target="_blank" rel="noreferrer">open market ↗</a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {candidates.length > 0 && (
        <div className="panel">
          <p className="sect">Recent BUY calls you haven't marked</p>
          <p className="help" style={{ marginBottom: 10 }}>
            If you actually placed one of these, tap it and I'll start watching it (assumes 100 contracts at the
            analysis fill price — the advice is the same either way).
          </p>
          {candidates.map((e) => (
            <button key={e.id} className="sel" onClick={() => save({ ...e, taken: {
              side: e.call.replace("BUY ", ""), entryPrice: e.entry != null ? e.entry : e.price,
              contracts: 100, at: Date.now() } })}>
              <span>
                {e.name === e.question ? e.question : e.question + " — " + e.name}
                <span className="sub">{e.venue} · {e.call} · analyzed {new Date(e.ts).toISOString().slice(0, 10)}</span>
              </span>
              <span className="px">track</span>
            </button>
          ))}
        </div>
      )}

      {kal && kal.history && kal.history.recent.length > 0 ? (
        <div className="panel">
          <p className="sect">Settled wagers — from your Kalshi history</p>
          <p className="help" style={{ marginTop: 6 }}>
            Pulled directly from your Kalshi portfolio's settlement records — the same numbers the exchange paid
            out on. {kal.history.wins}-{kal.history.losses} lifetime shown, net{" "}
            <b style={{ color: kal.history.pnl >= 0 ? "var(--moss)" : "var(--rose)" }}>
              {kal.history.pnl >= 0 ? "+$" : "-$"}{Math.abs(kal.history.pnl).toFixed(2)}
            </b>.
          </p>
          {kal.history.recent.map((h) => (
            <div key={h.ticker + h.at} className="score-row" style={{ borderBottom: "1px solid rgba(65,75,99,.35)" }}>
              <span className="who" style={{ fontSize: 13 }}>
                {h.title}
                <span className="sub" style={{ display: "block" }}>
                  <span className="srcchip" style={{ marginRight: 6, fontSize: 9 }}>{wagerType(h.ticker)}</span>
                  {(() => {
                    const tl = totalLine(h.ticker);
                    return tl != null ? (h.side === "YES" ? "OVER " + tl : "UNDER " + tl) : h.side;
                  })()} · settled {h.at ? new Date(h.at).toLocaleDateString() : ""}
                </span>
              </span>
              <span className="pts" style={{ fontSize: 13.5, color: h.won ? "var(--moss)" : "var(--rose)" }}>
                {h.won ? "WON " : "LOST "}{h.pl >= 0 ? "+$" : "-$"}{Math.abs(h.pl).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      ) : settled.length > 0 && (
        <div className="panel">
          <p className="sect">Settled positions</p>
          <p className="thesis" style={{ marginTop: 8 }}>
            {settled.length} tracked position{settled.length === 1 ? "" : "s"} settled so far:{" "}
            <span className="mono" style={{ color: settledPnl >= 0 ? "var(--moss)" : "var(--rose)" }}>
              {settledPnl >= 0 ? "+$" : "-$"}{Math.abs(settledPnl).toFixed(2)}
            </span>{" "}
            at the fills you recorded.
          </p>
        </div>
      )}
    </>
  );
}

/* ---------------- Parlay scanner ----------------
   Free, quantitative edge screen for game markets: compare each contract's
   price to the de-vigged sportsbook moneyline for that game. No LLM calls,
   so it can sweep every open game on both venues for pennies of bandwidth. */
// Run an async fn over items with bounded concurrency (keeps the ESPN
// summary fan-out polite and fast).
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const worker = async () => { while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// The Kalshi game series we can price. Each maps to an ESPN sport path.
const GAME_SERIES = [
  ["KXNBAGAME", "basketball/nba", "NBA"],
  ["KXWNBAGAME", "basketball/wnba", "WNBA"],
  ["KXMLBGAME", "baseball/mlb", "MLB"],
  ["KXNFLGAME", "football/nfl", "NFL"],
  ["KXNHLGAME", "hockey/nhl", "NHL"],
  ["KXCFBGAME", "football/college-football", "NCAAF"],
  ["KXNCAAFGAME", "football/college-football", "NCAAF"],
  ["KXCBBGAME", "basketball/mens-college-basketball", "NCAAB"],
  ["KXNCAABGAME", "basketball/mens-college-basketball", "NCAAB"],
  ["KXATPMATCH", "tennis/atp", "ATP"],
  ["KXWTAMATCH", "tennis/wta", "WTA"],
  ["KXUFCFIGHT", "mma/ufc", "UFC"],
  ["KXEPLGAME", "soccer/eng.1", "EPL"],
  ["KXMLSGAME", "soccer/usa.1", "MLS"],
  ["KXUCLGAME", "soccer/uefa.champions", "UCL"],
  ["KXLALIGAGAME", "soccer/esp.1", "La Liga"],
  ["KXSERIEAGAME", "soccer/ita.1", "Serie A"],
  ["KXBUNDESLIGAGAME", "soccer/ger.1", "Bundesliga"],
  ["KXLIGUE1GAME", "soccer/fra.1", "Ligue 1"],
  ["KXLIGAMXGAME", "soccer/mex.1", "Liga MX"],
  ["KXUELGAME", "soccer/uefa.europa", "Europa League"],
  ["KXUECLGAME", "soccer/uefa.europa.conf", "Conference League"],
  ["KXEREDIVISIEGAME", "soccer/ned.1", "Eredivisie"],
  ["KXLIGAPORTUGALGAME", "soccer/por.1", "Liga Portugal"],
  ["KXBRASILEIROGAME", "soccer/bra.1", "Brasileirao"],
  ["KXEFLCHAMPIONSHIPGAME", "soccer/eng.2", "EFL Championship"],
  ["KXSUPERLIGGAME", "soccer/tur.1", "Super Lig"],
  ["KXBELGIANPLGAME", "soccer/bel.1", "Belgian Pro League"],
  ["KXNWSLGAME", "soccer/usa.nwsl", "NWSL"],
  ["KXLEAGUESCUPGAME", "soccer/concacaf.leagues.cup", "Leagues Cup"],
  ["KXSAUDIPLGAME", "soccer/ksa.1", "Saudi Pro League"],
  ["KXWCGAME", "soccer/fifa.world", "World Cup"],
  ["KXCFLGAME", "football/cfl", "CFL"],
  ["KXUFLGAME", "football/ufl", "UFL"],
  ["KXNCAAWBGAME", "basketball/womens-college-basketball", "NCAAW"],
];

// A Kalshi game ticker embeds the date: …-26AUG112210KCLAD-LAD -> 20260811
// (some series carry a time after the day, some don't).
function tickerDate(ticker) {
  const m = String(ticker || "").match(/-(\d{2})([A-Z]{3})(\d{2})/);
  if (!m) return null;
  const mo = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
    JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" }[m[2]];
  return mo ? "20" + m[1] + mo + m[3] : null;
}

// ESPN games for a sport on a specific date (YYYYMMDD). Defaults to today.
async function espnGamesForLeague(path, date) {
  let events = [];
  try {
    const d = await getJson("https://site.api.espn.com/apis/site/v2/sports/" + path +
      "/scoreboard" + (date ? "?dates=" + date : ""));
    events = d.events || [];
  } catch { return []; }
  // Tennis: matches live inside tournament events' GROUPINGS (100+ per
  // tournament) — flatten them and keep only the requested day's matches.
  if (path.indexOf("tennis") === 0) {
    const rows = [];
    events.forEach((ev) => {
      const comps = [].concat(...(ev.groupings || []).map((g) => g.competitions || []), ev.competitions || []);
      comps.forEach((comp, ci) => {
        const cs = comp.competitors || [];
        if (cs.length < 2) return;
        const t2 = Date.parse(comp.date || comp.startDate || ev.date || "");
        const cDate = Number.isFinite(t2) ? etDate(t2).replace(/-/g, "") : null;
        if (date && cDate && cDate !== String(date)) return;
        rows.push({
          eventId: String(comp.id || ev.id + "-" + ci), path,
          date: cDate || (date || null),
          abbrs: cs.map(competitorAbbr),
          homeAbbr: null, awayAbbr: null,
          state: (comp.status && comp.status.type && comp.status.type.state) || "pre",
          name: cs.map((c) => (c.athlete && c.athlete.displayName) || "").join(" vs "),
          sides: cs.map((c) => ({ abbr: competitorAbbr(c),
            score: c.score != null && c.score !== "" ? Number(c.score) : null, home: false })),
          detail: (comp.status && comp.status.type && comp.status.type.shortDetail) || "",
        });
      });
    });
    return rows;
  }
  return events.map((ev) => {
    const comp = (ev.competitions && ev.competitions[0]) || {};
    const comps = comp.competitors || [];
    const home = comps.find((c) => c.homeAway === "home");
    const away = comps.find((c) => c.homeAway === "away");
    // Football scoreboards return the WHOLE WEEK for a single-date query —
    // tag each game with its actual ET date, not the date we asked about,
    // or the same-slate matching bonus lands on the wrong games.
    const t = Date.parse(ev.date || "");
    const evDate = Number.isFinite(t) ? etDate(t).replace(/-/g, "") : (date || null);
    return {
      eventId: ev.id, path, date: evDate, abbrs: comps.map(competitorAbbr),
      homeAbbr: home ? competitorAbbr(home) : null, awayAbbr: away ? competitorAbbr(away) : null,
      state: (ev.status && ev.status.type && ev.status.type.state) || "pre",
      name: ev.name || ev.shortName || "",
      // Live scores + clock so the picks board breathes during games.
      sides: comps.map((c) => ({ abbr: competitorAbbr(c),
        score: c.score != null && c.score !== "" ? Number(c.score) : null, home: c.homeAway === "home" })),
      detail: (ev.status && ev.status.type && (ev.status.type.shortDetail || ev.status.type.detail)) || "",
    };
  });
}

// Build a probByAbbr object from a home-team win percentage.
function homeProbObj(home, game, extra) {
  const probByAbbr = {};
  if (game.homeAbbr) probByAbbr[game.homeAbbr] = clamp(home, 0.5, 99.5);
  if (game.awayAbbr) probByAbbr[game.awayAbbr] = clamp(100 - home, 0.5, 99.5);
  return { probByAbbr, home, away: 100 - home, books: 1, disp: 0, ...extra };
}

// Odds API consensus -> the scanner's probByAbbr shape.
function oddsProbObj(odds, game, src) {
  const probByAbbr = {};
  if (game.homeAbbr) probByAbbr[game.homeAbbr] = clamp(odds.home, 0.5, 99.5);
  if (game.awayAbbr) probByAbbr[game.awayAbbr] = clamp(odds.away, 0.5, 99.5);
  if (odds.draw != null) { probByAbbr.TIE = odds.draw; probByAbbr.DRAW = odds.draw; }
  return { probByAbbr, home: odds.home, away: odds.away, books: odds.books, disp: odds.disp, src,
    totals: odds.totals || null, spreads: odds.spreads || null };
}

// Best available probability for one game, honest about its source.
//  • In progress: the live win-probability model first; else a FRESH
//    in-play book consensus from The Odds API (books keep quoting live);
//    a frozen pregame line is flagged stale and never trusted as live.
//  • Upcoming: The Odds API multi-book Shin consensus when 2+ books quote,
//    else ESPN's pickcenter consensus, else ESPN's matchup projection.
async function espnDevig(game, odds) {
  try {
    const sm = await getJson("https://site.api.espn.com/apis/site/v2/sports/" + game.path + "/summary?event=" + game.eventId);
    const oddsFresh = odds && odds.updated && Date.now() - odds.updated < ODDS_FRESH_MS;

    if (game.state === "in") {
      const wp = sm.winprobability;
      const liveModel = Array.isArray(wp) && wp.length && wp[wp.length - 1].homeWinPercentage != null
        ? Number(wp[wp.length - 1].homeWinPercentage) * 100 : null;
      // Two independent live reads beat either alone: ESPN's play-by-play
      // model and the in-play book consensus, combined in log-odds space
      // (books slightly heavier — they take real money).
      if (liveModel != null && odds && oddsFresh) {
        const blended = unlogit(
          (logit(clamp(liveModel, 1, 99)) + 1.5 * logit(clamp(odds.home, 1, 99))) / 2.5);
        return homeProbObj(blended, game, { src: "live", books: odds.books, blended: true });
      }
      if (liveModel != null) return homeProbObj(liveModel, game, { src: "live" });
      if (odds && oddsFresh) return oddsProbObj(odds, game, "live-books");
      const cons = consensusDevig(sm.pickcenter || sm.odds || [], game.homeAbbr, game.awayAbbr);
      if (cons) return { ...cons, src: "pregame-line", stale: true };
      return null;
    }

    if (odds && odds.books >= 2) return oddsProbObj(odds, game, "book");
    const cons = consensusDevig(sm.pickcenter || sm.odds || [], game.homeAbbr, game.awayAbbr);
    if (cons) return { ...cons, src: "book" };
    if (odds) return oddsProbObj(odds, game, "book");
    const proj = sm.predictor && sm.predictor.homeTeam && Number(sm.predictor.homeTeam.gameProjection);
    if (Number.isFinite(proj)) return homeProbObj(proj, game, { src: "model" });
    return null;
  } catch { return null; }
}

async function scanEdges() {
  const root = "https://api.elections.kalshi.com/trade-api/v2";

  // Pull open markets for each game series directly (the general market list
  // buries games behind thousands of other contracts, and only a page of it
  // ever loaded). Dedupe leagues that share a sport path.
  const seriesByPath = {};
  GAME_SERIES.forEach(([ticker, path, label]) => {
    (seriesByPath[path] = seriesByPath[path] || { path, label, tickers: [] }).tickers.push(ticker);
  });

  const marketsByPath = {};
  await mapLimit(GAME_SERIES, 8, async ([ticker, path]) => {
    // Page through the whole series so nothing is missed on a busy slate.
    let cursor = "", pages = 0;
    while (pages < 5) {
      let r;
      try { r = await fetch(px(root + "/markets?series_ticker=" + ticker + "&status=open&limit=200" + (cursor ? "&cursor=" + cursor : ""))); }
      catch { break; }
      if (!r.ok) break;
      const d = await r.json();
      const ms = (d.markets || []).map(kaMarket).filter((m) => m.price != null);
      (marketsByPath[path] = marketsByPath[path] || []).push(...ms);
      cursor = d.cursor || ""; pages++;
      if (!cursor || !(d.markets || []).length) break;
    }
  });

  const picks = [];
  let gamesFound = 0, gamesPriced = 0;
  for (const { path, label } of Object.values(seriesByPath)) {
    const ms = marketsByPath[path] || [];
    if (!ms.length) continue;

    // Attach each market its game date; group the dates we need to look up.
    const dated = ms.map((m) => ({ m, codes: teamCodes(m.id), date: tickerDate(m.id) }))
      .filter((x) => x.codes.length);
    const dates = [...new Set(dated.map((x) => x.date).filter(Boolean))].sort().slice(0, 14);
    if (!dates.length) dates.push(null); // fall back to today's slate

    // One scoreboard per (path, date); pool all their games.
    const slates = await mapLimit(dates, 4, (date) => espnGamesForLeague(path, date));
    const gs = [].concat(...slates);
    if (!gs.length) continue;

    const matched = [];
    for (const { m, codes, date } of dated) {
      // Teams play back-to-back: the codes match every meeting, so the
      // game from the market's own slate date must win the tie.
      let best = null, bestS = 0;
      gs.forEach((g) => {
        const s = codeHit(codes, g.abbrs) + (date && g.date === date ? 0.5 : 0);
        if (s > bestS) { bestS = s; best = g; }
      });
      if (best && bestS >= 1) matched.push({ m, g: best, codes });
    }
    if (!matched.length) continue;

    const distinct = [];
    const seenG = new Set();
    matched.forEach(({ g }) => { if (!seenG.has(g.eventId)) { seenG.add(g.eventId); distinct.push(g); } });
    gamesFound += distinct.length;
    // One Odds API request per sport, and only when a slate is imminent —
    // books rarely post lines more than a day out, so asking for a slate
    // 3+ days away burns credits for nothing.
    const anyLiveGame = distinct.some((g) => g.state === "in");
    const soonCut = Number(etDate(Date.now() + 36 * 3600 * 1000).replace(/-/g, ""));
    const imminent = anyLiveGame || distinct.some((g) => g.date && Number(g.date) <= soonCut);
    const oddsEvents = imminent ? await fetchOddsEvents(path, anyLiveGame) : null;
    const devigs = await mapLimit(distinct, 6, (g) => {
      const ev = matchOddsEvent(oddsEvents, g.name, g.date);
      return espnDevig(g, ev ? oddsEventConsensus(ev) : null);
    });
    const gmap = {};
    distinct.forEach((g, i) => { gmap[g.eventId] = devigs[i]; if (devigs[i] && devigs[i].probByAbbr) gamesPriced++; });

    for (const { m, g, codes } of matched) {
      const dv = gmap[g.eventId];
      if (!dv || !dv.probByAbbr) continue;
      const myCode = codes[0];
      let modelProb = null;
      for (const [ab, p] of Object.entries(dv.probByAbbr)) {
        if (ab === myCode || ab.startsWith(myCode) || myCode.startsWith(ab)) { modelProb = p; break; }
      }
      if (modelProb == null) continue;
      const entry = m.ask != null ? m.ask : m.price;
      picks.push({
        id: m.id, market: m, modelProb, entry, edge: modelProb - entry,
        fee: takerFee(m.venue, entry),
        league: label, state: g.state, game: g.name, codes,
        src: dv.src, books: dv.books || 1, disp: dv.disp || 0,
        homeAbbr: g.homeAbbr, awayAbbr: g.awayAbbr,
        sides: g.sides || null, detail: g.detail || "",
        eventId: g.eventId || null, path: g.path || path,
        ou: dv.totals || null, spr: dv.spreads || null,
      });
    }
  }
  const seen = new Set();
  const uniq = picks.filter((p) => (seen.has(p.id) ? false : seen.add(p.id))).sort((a, b) => b.edge - a.edge);
  return { picks: uniq, gamesFound, gamesPriced };
}

// Combined economics of a parlay. Independence is assumed for the model
// probability — correlated legs (same game) are flagged separately.
function parlayMath(slip) {
  if (!slip.length) return null;
  let mkt = 1, model = 1, mult = 1;
  slip.forEach((l) => {
    const e = clamp(l.entry, 1, 99);
    // Each leg's real cost includes the venue's taker fee — the payout
    // multiplier has to clear it, or the "EV" flatters the parlay.
    const cost = clamp(e + takerFee(l.market && l.market.venue, e), 1, 99.9);
    mkt *= e / 100;
    model *= clamp(l.modelProb, 1, 99) / 100;
    mult *= 100 / cost;
  });
  const p = model, b = mult - 1; // decimal profit multiple
  // Kelly fraction on the parlay; halved for safety, floored at 0.
  const kelly = b > 0 ? Math.max(0, (p * b - (1 - p)) / b) : 0;
  return { legs: slip.length, mktProb: mkt * 100, modelProb: model * 100, mult,
    ev: model * mult - 1, stake: clamp((kelly / 2) * 100, 0, 25) };
}

// Two legs are correlated if they belong to the same game (shared team code).
function parlayConflicts(slip) {
  const bad = new Set();
  for (let i = 0; i < slip.length; i++) {
    for (let j = i + 1; j < slip.length; j++) {
      const a = slip[i].codes || [], b = slip[j].codes || [];
      if (a.some((c) => b.includes(c))) { bad.add(slip[i].id); bad.add(slip[j].id); }
    }
  }
  return bad;
}

// Turn a pick's signals into a firm decision + conviction. STRONG needs a
// real edge confirmed by multiple books (or a live model); LEAN is a smaller
// edge; otherwise the game is fairly priced and there's no bet.
function pickDecision(p) {
  // A pregame line on a game already in progress prices a state of the world
  // that no longer exists — the "edge" against the moved market is fiction.
  if (p.src === "pregame-line") {
    return { tag: "stale line — no live read, skip", color: "var(--dim)", bet: false };
  }
  // A firmly-sourced read is a live model, a fresh in-play book consensus,
  // or a two-plus-book pregame consensus; a model-only projection is softer.
  const firm = p.src === "live" || p.src === "live-books" || (p.src === "book" && p.books >= 2);
  // Judge the edge net of the taker fee actually paid on entry.
  const net = p.edge - (p.fee || 0);
  if (net >= 5 && firm) return { tag: "STRONG BET", color: "var(--moss)", bet: true };
  if (net >= 2.5) return { tag: "LEAN", color: "var(--amber)", bet: true };
  return { tag: "no edge — skip", color: "var(--dim)", bet: false };
}

// Auto-build a suggested parlay from the day's priced games: the best
// positive-edge side of each game, one leg per game, ranked and capped.
// "safe" ranks by win probability instead of edge for a lower-variance card.
function suggestParlay(picks, maxLegs, mode) {
  const byGame = {};
  picks.forEach((p) => {
    // A frozen pregame line on an in-progress game has no real edge — never
    // auto-build a parlay leg from one.
    if (p.src === "pregame-line") return;
    if (mode === "safe" ? p.modelProb < 55 : p.edge < 2) return;
    const key = p.game || p.id;
    const cur = byGame[key];
    const better = mode === "safe" ? (!cur || p.modelProb > cur.modelProb) : (!cur || p.edge > cur.edge);
    if (better) byGame[key] = p;
  });
  const legs = Object.values(byGame)
    .sort((a, b) => (mode === "safe" ? b.modelProb - a.modelProb : b.edge - a.edge))
    .slice(0, maxLegs);
  return legs.map((p) => ({ id: p.id, market: p.market, modelProb: p.modelProb, entry: p.entry, codes: p.codes, game: p.game }));
}

// Friendly label for a YYYYMMDD slate date.
function dateLabel(d) {
  const iso = d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6, 8);
  const today = etDate();
  const tmrw = etDate(Date.now() + 86400000);
  if (iso === today) return "Today";
  if (iso === tmrw) return "Tomorrow";
  try { return new Date(iso + "T12:00:00Z").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }); }
  catch { return iso; }
}

/* ---- commodities pipeline ----
   Strictly analytical winner-picking for Kalshi's commodity/crypto strike
   ladders. Checks used, all deterministic: (1) live spot + realized
   volatility -> lognormal probability per strike; (2) the ladder's own
   prices as the market's read, for agreement/disagreement; (3) recent
   momentum as context. Deep dive hands the market to the nine-check
   finance analysis for the full research treatment. */
const COMMODITIES = [
  { series: "KXWTI", sym: "CL=F", label: "WTI Crude (daily)", unit: "$", crypto: false },
  { series: "KXWTIW", sym: "CL=F", label: "WTI Crude (weekly)", unit: "$", crypto: false },
  { series: "KXBRENTD", sym: "BZ=F", label: "Brent Crude", unit: "$", crypto: false },
  { series: "KXGOLDD", sym: "GC=F", label: "Gold (daily)", unit: "$", crypto: false },
  { series: "KXGOLDW", sym: "GC=F", label: "Gold (weekly)", unit: "$", crypto: false },
  { series: "KXSILVERD", sym: "SI=F", label: "Silver (daily)", unit: "$", crypto: false },
  { series: "KXSILVERW", sym: "SI=F", label: "Silver (weekly)", unit: "$", crypto: false },
  { series: "KXBTCD", sym: "BTC-USD", label: "Bitcoin (daily)", unit: "$", crypto: true },
  { series: "KXETHD", sym: "ETH-USD", label: "Ethereum (daily)", unit: "$", crypto: true },
  { series: "KXGOLDH", sym: "GC=F", label: "Gold (hourly)", unit: "$", crypto: false },
  { series: "KXSILVERH", sym: "SI=F", label: "Silver (hourly)", unit: "$", crypto: false },
  { series: "KXBTC", sym: "BTC-USD", label: "Bitcoin (hourly)", unit: "$", crypto: true },
  { series: "KXETH", sym: "ETH-USD", label: "Ethereum (hourly)", unit: "$", crypto: true },
];

// 15-minute up/down markets: YES = the 60s settlement average at window
// close is at least the window-open reference (floor_strike).
const FAST15 = [
  { series: "KXBTC15M", sym: "BTC-USD", label: "BTC", hub: "https://kalshi.com/crypto" },
  { series: "KXETH15M", sym: "ETH-USD", label: "ETH", hub: "https://kalshi.com/crypto" },
  { series: "KXSOL15M", sym: "SOL-USD", label: "SOL", hub: "https://kalshi.com/crypto" },
  { series: "KXXRP15M", sym: "XRP-USD", label: "XRP", hub: "https://kalshi.com/crypto" },
  { series: "KXDOGE15M", sym: "DOGE-USD", label: "DOGE", hub: "https://kalshi.com/crypto" },
  { series: "KXADA15M", sym: "ADA-USD", label: "ADA", hub: "https://kalshi.com/crypto" },
  { series: "KXBNB15M", sym: "BNB-USD", label: "BNB", hub: "https://kalshi.com/crypto" },
  { series: "KXGOLD15M", sym: "GC=F", pyth: "XAUUSD", label: "Gold", hub: "https://kalshi.com/markets/kxgold15m/gold-15-minute" },
  { series: "KXSILVER15M", sym: "SI=F", pyth: "XAGUSD", label: "Silver", hub: "https://kalshi.com/markets/kxsilver15m/silver-15-minute" },
  { series: "KXWTI15M", sym: "CL=F", pyth: "USOILSPOT", label: "WTI Oil", hub: "https://kalshi.com/markets/kxwti15m/wti-15-minute" },
  { series: "KXINX15M", sym: "^GSPC", label: "S&P 500", hub: "https://kalshi.com/markets/kxinx15m/s-p-500-15-minute" },
  { series: "KXNDQ15M", sym: "^NDX", label: "Nasdaq 100", hub: "https://kalshi.com/markets/kxndq15m/nasdaq-100-15-minute" },
];

// EWMA volatility (RiskMetrics lambda .94) — reacts to the last hour's
// regime instead of averaging a stale window. Returns sigma per bar.
function ewmaSigma(closes, lambda) {
  const L = lambda == null ? 0.94 : lambda;
  let v = null;
  for (let i = 1; i < closes.length; i++) {
    const r = Math.log(closes[i] / closes[i - 1]);
    v = v == null ? r * r : L * v + (1 - L) * r * r;
  }
  return v != null ? Math.sqrt(v) : null;
}

// Exponential moving average of a series' last value.
function emaLast(vals, n) {
  if (!vals || vals.length < n) return null;
  const k = 2 / (n + 1);
  let e = vals[0];
  for (let i = 1; i < vals.length; i++) e = vals[i] * k + e * (1 - k);
  return e;
}

// Intraday chart read on 1-minute bars — the classic strategies, each
// casting one vote: price vs VWAP, EMA 9/21 cross, MACD histogram, RSI
// extremes (as mean-reversion fades), session high/low breakouts.
// score in [-5, +5]; it tilts the live model, never overrides it.
function intradayTech(closes, volumes) {
  if (!closes || closes.length < 40) return null;
  const last = closes[closes.length - 1];
  const votes = [];
  let vwap = null;
  if (volumes && volumes.length === closes.length) {
    let pv = 0, vv = 0;
    for (let i = 0; i < closes.length; i++) { pv += closes[i] * (volumes[i] || 0); vv += volumes[i] || 0; }
    if (vv > 0) vwap = pv / vv;
  }
  if (vwap != null) votes.push({ k: "VWAP", dir: last > vwap ? 1 : -1, note: last > vwap ? "above" : "below" });
  const win = closes.slice(-120);
  const e9 = emaLast(win, 9), e21 = emaLast(win, 21);
  if (e9 != null && e21 != null) votes.push({ k: "EMA 9/21", dir: e9 > e21 ? 1 : -1, note: e9 > e21 ? "bull cross" : "bear cross" });
  const e12 = emaLast(win, 12), e26 = emaLast(win, 26);
  if (e12 != null && e26 != null) {
    const macdSeries = [];
    for (let i = 30; i <= win.length; i += 3) {
      const w = win.slice(0, i);
      macdSeries.push(emaLast(w, 12) - emaLast(w, 26));
    }
    const sig = emaLast(macdSeries, 9);
    const hist = (e12 - e26) - (sig == null ? 0 : sig);
    votes.push({ k: "MACD", dir: hist > 0 ? 1 : -1, note: hist > 0 ? "momentum up" : "momentum down" });
  }
  let g = 0, l = 0;
  for (let i = closes.length - 14; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch >= 0) g += ch; else l -= ch;
  }
  const rsi = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  if (rsi >= 72) votes.push({ k: "RSI " + rsi.toFixed(0), dir: -1, note: "overbought — fade" });
  else if (rsi <= 28) votes.push({ k: "RSI " + rsi.toFixed(0), dir: 1, note: "oversold — fade" });
  const body = closes.slice(0, -5);
  const hi = Math.max.apply(null, body), lo = Math.min.apply(null, body);
  if (last >= hi) votes.push({ k: "Breakout", dir: 1, note: "new session high" });
  else if (last <= lo) votes.push({ k: "Breakdown", dir: -1, note: "new session low" });
  const score = votes.reduce((s, v) => s + v.dir, 0);
  return { votes, score, rsi, vwap,
    lean: score >= 2 ? "UP" : score <= -2 ? "DOWN" : "NEUTRAL" };
}

// Chart-score drift per minute: 3% of one minute-sigma per net vote,
// capped at ±12% of sigma. pAbove's total-effect cap bounds it further.
function techDrift(tech, sigmaM) {
  if (!tech || !(sigmaM > 0)) return 0;
  return clamp(tech.score * 0.03, -0.12, 0.12) * sigmaM;
}

// 1-minute bars for the current day: live spot, per-minute EWMA sigma,
// and the chart-strategy read.
const yahooIntraCache = new Map();
async function yahooIntraday(sym) {
  const hit = yahooIntraCache.get(sym);
  if (hit && Date.now() - hit.at < 20000) return hit.v;
  try {
    const r = await fetch(px("https://query1.finance.yahoo.com/v8/finance/chart/" +
      encodeURIComponent(sym) + "?range=1d&interval=1m"));
    if (!r.ok) return null;
    const d = await r.json();
    const res = d.chart && d.chart.result && d.chart.result[0];
    if (!res) return null;
    const q0 = (res.indicators && res.indicators.quote && res.indicators.quote[0]) || {};
    const rawC = q0.close || [], rawV = q0.volume || [];
    const closes = [], volumes = [];
    for (let i = 0; i < rawC.length; i++) {
      if (Number.isFinite(rawC[i])) { closes.push(rawC[i]); volumes.push(Number.isFinite(rawV[i]) ? rawV[i] : 0); }
    }
    if (closes.length < 30) return null;
    const spot = Number(res.meta && res.meta.regularMarketPrice) || closes[closes.length - 1];
    const mt = Number(res.meta && res.meta.regularMarketTime);
    const staleSec = Number.isFinite(mt) ? Math.max(0, Math.floor(Date.now() / 1000) - mt) : null;
    const sigmaM = ewmaSigma(closes.slice(-240));
    if (!sigmaM) return null;
    const v = { spot, sigmaM, staleSec,
      chg15m: closes.length > 15 ? (spot / closes[closes.length - 16] - 1) * 100 : null,
      tech: intradayTech(closes, volumes) };
    yahooIntraCache.set(sym, { at: Date.now(), v });
    return v;
  } catch { return null; }
}

// The 15-minute board: for each asset's live window, the model's UP/DOWN
// call — live spot vs the window-open reference over the minutes left.
// Realtime crypto spot straight from Coinbase — seconds-fresh and part of
// the CF Benchmarks index family Kalshi settles on, unlike chart bars
// that can lag a minute. 8-second cache.
// Pyth oracle 1-minute candles — the EXACT series these windows settle on
// (rules cite "Pyth GOLD/SILVER/PYTHOIL candlesticks"). Using anything
// else (futures!) reads a different price and wrecks the model.
const pythCache = new Map();
async function pythIntraday(sym) {
  const hit = pythCache.get(sym);
  if (hit && Date.now() - hit.at < 15000) return hit.v;
  try {
    const now = Math.floor(Date.now() / 1000);
    const r = await fetch(px("https://benchmarks.pyth.network/v1/shims/tradingview/history?symbol=" +
      encodeURIComponent(sym) + "&resolution=1&from=" + (now - 4 * 3600) + "&to=" + now));
    if (!r.ok) return null;
    const d = await r.json();
    if (d.s !== "ok" || !Array.isArray(d.c) || d.c.length < 30) return null;
    const closes = d.c.filter((x) => Number.isFinite(x));
    const spot = closes[closes.length - 1];
    const lastBar = Array.isArray(d.t) && d.t.length ? d.t[d.t.length - 1] : null;
    const staleSec = lastBar ? Math.max(0, Math.floor(Date.now() / 1000) - lastBar) : null;
    const sigmaM = ewmaSigma(closes.slice(-240));
    if (!sigmaM) return null;
    const v = { spot, sigmaM, staleSec,
      chg15m: closes.length > 15 ? (spot / closes[closes.length - 16] - 1) * 100 : null,
      tech: intradayTech(closes, null) };
    pythCache.set(sym, { at: Date.now(), v });
    return v;
  } catch { return null; }
}

const cbSpotCache = new Map();
async function coinbaseSpot(sym) {
  const pair = String(sym).replace("-USD", "") + "-USD";
  const hit = cbSpotCache.get(pair);
  if (hit && Date.now() - hit.at < 8000) return hit.v;
  try {
    const r = await fetch(px("https://api.coinbase.com/v2/prices/" + pair + "/spot"));
    if (!r.ok) return null;
    const d = await r.json();
    const v = Number(d.data && d.data.amount);
    if (!Number.isFinite(v)) return null;
    cbSpotCache.set(pair, { at: Date.now(), v });
    return v;
  } catch { return null; }
}

// Settlement is the AVERAGE of the final 60 seconds, not the last print —
// as the window closes, part of that average is already locked, so the
// effective random horizon shrinks by roughly half the averaging minute.
const settleHorizon = (minLeft) => Math.max(0.1, minLeft - 0.4);

// Model and market combined in log-odds, equal weight — the 15-minute
// books carry real bot money; ignoring them costs accuracy.
// The careful decision rule for a 15-minute window:
// - stale data -> NO CALL, always
// - first ~4 minutes -> TOO EARLY unless the move is already decisive
//   (a fresh window's gap is noise; calling it is guessing)
// - firm UP/DOWN needs 65%+; 58-65% is only a lean; below that, coin flip
function f15Call(pUp, minLeft, stale) {
  const up = pUp >= 50;
  const conf = up ? pUp : 100 - pUp;
  if (stale) return { call: "NO CALL", firm: false, up, conf };
  if (minLeft > 11 && conf < 70) return { call: "TOO EARLY", firm: false, up, conf };
  if (conf >= 65) return { call: up ? "UP" : "DOWN", firm: true, up, conf };
  if (conf >= 58) return { call: up ? "LEANING UP" : "LEANING DOWN", firm: false, up, conf };
  return { call: "COIN FLIP", firm: false, up, conf };
}

const f15Blend = (pModel, pMkt) =>
  unlogit((logit(clamp(pModel, 0.5, 99.5)) + logit(clamp(pMkt, 0.5, 99.5))) / 2);

async function scanFast15() {
  const root = "https://api.elections.kalshi.com/trade-api/v2";
  const out = [];
  await mapLimit(FAST15, 5, async (a) => {
    try {
      const r = await fetch(px(root + "/markets?series_ticker=" + a.series + "&status=open&limit=3"));
      if (!r.ok) return;
      const d = await r.json();
      const nowT = Date.now();
      const m = (d.markets || []).filter((x) => x.floor_strike != null &&
          new Date(x.open_time) <= nowT && new Date(x.close_time) > nowT)
        .sort((x, y) => new Date(x.close_time) - new Date(y.close_time))[0];
      if (!m) return; // between windows — never call a window that isn't running
      // Settlement-feed first: Pyth candles for metals/oil, Yahoo for the
      // rest; crypto adds the seconds-fresh Coinbase spot on top.
      const q = a.pyth ? await pythIntraday(a.pyth) : await yahooIntraday(a.sym);
      if (!q) return;
      let spot = q.spot, staleSec = q.staleSec, dataWarn = null;
      if (/-USD$/.test(a.sym)) {
        const live = await coinbaseSpot(a.sym);
        if (live != null) {
          // Cross-source sanity: two independent feeds disagreeing hard
          // means one is broken — say so instead of predicting through it.
          if (q.spot > 0 && Math.abs(live - q.spot) / q.spot > 0.005) dataWarn = "sources diverge";
          spot = live; staleSec = 0;
        }
      }
      // A confident call on a stale settlement feed is a lie — refuse it.
      const stale = staleSec != null && staleSec > 180;
      const km = kaMarket(m);
      const ref = Number(m.floor_strike);
      const minLeft = Math.max(0.2, (new Date(m.close_time) - Date.now()) / 60000);
      const pModel = pAbove(spot, ref, q.sigmaM, settleHorizon(minLeft), techDrift(q.tech, q.sigmaM));
      if (pModel == null) return;
      // Market read = the quote midpoint; the ensemble is the headline.
      const pMkt = km.bid != null && km.ask != null ? (km.bid + km.ask) / 2 : km.price;
      const pUp = stale ? 50 : pMkt != null ? f15Blend(pModel, pMkt) : pModel;
      out.push({ a, m: km, ref, spot, chg15m: q.chg15m,
        minLeft, pUp, pModel, pMkt, close: m.close_time, tech: q.tech,
        stale, staleSec, dataWarn,
        disagree: !stale && pMkt != null && Math.abs(pModel - pMkt) >= 12 });
    } catch { /* next asset */ }
  });
  return out.sort((x, y) => Math.max(y.pUp, 100 - y.pUp) - Math.max(x.pUp, 100 - x.pUp));
}

// Standard normal CDF (Abramowitz-Stegun erf approximation, |err| < 7.5e-8).
function normCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp(-x * x / 2);
  let p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  if (x > 0) p = 1 - p;
  return x > 0 ? 1 - (1 - p) : p;
}

// P(price at expiry > strike) under a lognormal walk calibrated to
// realized volatility, with an optional (heavily shrunk) trend drift per
// bar. Drift defaults to zero — the honest prior for short horizons.
function pAbove(spot, strike, sigmaD, tradingDays, muPerBar) {
  if (!(spot > 0) || !(strike > 0) || !(sigmaD > 0)) return null;
  const t = Math.max(0.02, tradingDays);
  const mu = Number.isFinite(muPerBar) ? muPerBar : 0;
  // Total trend effect capped at a quarter of one standard move for the
  // horizon — drift compounds with time and would otherwise dominate
  // weekly ladders.
  const lim = 0.25 * sigmaD * Math.sqrt(t);
  const eff = clamp(mu * t, -lim, lim);
  const z = (Math.log(spot / strike) + eff) / (sigmaD * Math.sqrt(t));
  // Fat-tail mixture: real price moves have heavier tails than lognormal.
  // 85% base regime + 15% double-vol regime keeps far strikes honest.
  const p = 0.85 * normCdf(z) + 0.15 * normCdf(z / 2);
  return clamp(p * 100, 0.5, 99.5);
}

// Multi-horizon trend read from daily closes: momentum at 5 and 20 days,
// position vs the 20-day average, RSI(14), and the volatility regime.
// score sums the directional votes (-3..+3); it contextualizes and gently
// nudges the model, it never overrides it.
function trendStats(closes) {
  if (!closes || closes.length < 21) return null;
  const last = closes[closes.length - 1];
  const mom5 = (last / closes[closes.length - 6] - 1) * 100;
  const mom20 = (last / closes[closes.length - 21] - 1) * 100;
  const sma20 = closes.slice(-20).reduce((s, x) => s + x, 0) / 20;
  const vsSma = (last / sma20 - 1) * 100;
  let g = 0, l = 0;
  for (let i = closes.length - 14; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch >= 0) g += ch; else l -= ch;
  }
  const rsi = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  const recent = closes.slice(-10), older = closes.slice(-60, -10);
  const sd = (a) => {
    const rs = []; for (let i = 1; i < a.length; i++) rs.push(Math.log(a[i] / a[i - 1]));
    const m = rs.reduce((s, x) => s + x, 0) / rs.length;
    return Math.sqrt(rs.reduce((s, x) => s + (x - m) * (x - m), 0) / Math.max(1, rs.length - 1));
  };
  const volRatio = older.length > 10 ? sd(recent) / Math.max(1e-9, sd(older)) : 1;
  const score = (mom5 > 0 ? 1 : mom5 < 0 ? -1 : 0) + (mom20 > 0 ? 1 : mom20 < 0 ? -1 : 0) +
    (vsSma > 0.2 ? 1 : vsSma < -0.2 ? -1 : 0);
  return { mom5, mom20, vsSma, rsi, volRatio, score,
    label: score >= 2 ? "UPTREND" : score <= -2 ? "DOWNTREND" : "MIXED" };
}

// Trend drift per day for the model: a quarter of the 20-day daily pace,
// capped at ±30% of one daily sigma. Trend-following predicts weakly —
// the shrink keeps the model calibrated instead of chasing.
function trendDrift(trend, sigmaD) {
  if (!trend || !(sigmaD > 0)) return 0;
  const daily = Math.log(1 + trend.mom20 / 100) / 20;
  return clamp(0.15 * daily, -0.3 * sigmaD, 0.3 * sigmaD);
}

// The ladder's own prices imply a volatility — the market's forward-looking
// estimate, which beats trailing realized vol when they differ. Fit sigma
// by least squares against mid-ladder market probabilities (tails are too
// noisy to fit). Returns null when the ladder gives nothing to fit.
function impliedSigma(strikes, marketProbs, spot, t) {
  if (!(spot > 0) || !(t > 0) || strikes.length < 2) return null;
  const pts = [];
  for (let i = 0; i < strikes.length; i++) {
    if (marketProbs[i] >= 8 && marketProbs[i] <= 92) pts.push([strikes[i], marketProbs[i] / 100]);
  }
  if (pts.length < 2) return null;
  const sse = (s) => pts.reduce((acc, kv) =>
    acc + Math.pow(normCdf(Math.log(spot / kv[0]) / (s * Math.sqrt(t))) - kv[1], 2), 0);
  let lo = Math.log(1e-6), hi = Math.log(1);
  for (let i = 0; i < 60; i++) {
    const a = lo + (hi - lo) * 0.382, b = lo + (hi - lo) * 0.618;
    if (sse(Math.exp(a)) < sse(Math.exp(b))) hi = b; else lo = a;
  }
  const s = Math.exp((lo + hi) / 2);
  return s > 1e-6 && s < 1 ? s : null;
}

// Model-and-market ensemble in log-odds: the market's ladder is real money
// and earns slightly more weight than the model alone.
function blendProb(pModel, pMarket) {
  return unlogit((logit(clamp(pModel, 0.5, 99.5)) + 1.2 * logit(clamp(pMarket, 0.5, 99.5))) / 2.2);
}

// The tradeable instruction: scan every strike for the best fee-adjusted
// edge between the ensemble probability and the real cost to enter. BUY
// YES when a strike is likelier than its ask implies; BUY NO when it's
// less likely than the bid implies. Below the bar -> no wager, say so.
function bestLadderWager(ladder, pComb) {
  let best = null;
  for (let i = 0; i < ladder.length; i++) {
    const m = ladder[i].m;
    const yesCost = m.ask != null ? m.ask : m.price;
    const noCost = m.bid != null ? 100 - m.bid : 100 - m.price;
    const eYes = pComb[i] - yesCost - takerFee("Kalshi", yesCost);
    const eNo = (100 - pComb[i]) - noCost - takerFee("Kalshi", noCost);
    const cand = eYes >= eNo
      ? { side: "YES", strike: ladder[i].K, cost: yesCost, edge: eYes, prob: pComb[i], m }
      : { side: "NO", strike: ladder[i].K, cost: noCost, edge: eNo, prob: 100 - pComb[i], m };
    if (!best || cand.edge > best.edge) best = cand;
  }
  if (best) best.bet = best.edge >= 3;
  return best;
}

// Ladder of ascending "above K" strikes -> probability the settle lands in
// each bucket (below first, between each pair, above last). Sums to 100.
function bucketProbs(strikes, probsAbove) {
  const out = [];
  for (let i = 0; i <= strikes.length; i++) {
    const hi = i === 0 ? 100 : probsAbove[i - 1];
    const lo = i === strikes.length ? 0 : probsAbove[i];
    out.push(Math.max(0, hi - lo));
  }
  return out;
}

// 3 months of daily closes from Yahoo (proxied): spot, realized daily
// sigma of log returns, and the 1-day / 5-day moves for momentum context.
const yahooCache = new Map();
async function yahooHist(sym) {
  const hit = yahooCache.get(sym);
  if (hit && Date.now() - hit.at < 120000) return hit.v;
  try {
    const r = await fetch(px("https://query1.finance.yahoo.com/v8/finance/chart/" +
      encodeURIComponent(sym) + "?range=3mo&interval=1d"));
    if (!r.ok) return null;
    const d = await r.json();
    const res = d.chart && d.chart.result && d.chart.result[0];
    if (!res) return null;
    const closes = ((res.indicators && res.indicators.quote && res.indicators.quote[0] &&
      res.indicators.quote[0].close) || []).filter((x) => Number.isFinite(x));
    if (closes.length < 20) return null;
    const spot = Number(res.meta && res.meta.regularMarketPrice) || closes[closes.length - 1];
    const rets = [];
    for (let i = 1; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
    const mean = rets.reduce((s, x) => s + x, 0) / rets.length;
    const sigmaD = Math.sqrt(rets.reduce((s, x) => s + (x - mean) * (x - mean), 0) / (rets.length - 1));
    const v = {
      spot, sigmaD,
      chg1d: (spot / closes[closes.length - 2] - 1) * 100,
      chg5d: closes.length > 6 ? (spot / closes[closes.length - 6] - 1) * 100 : null,
      trend: trendStats(closes),
    };
    yahooCache.set(sym, { at: Date.now(), v });
    return v;
  } catch { return null; }
}

async function scanCommodities() {
  const root = "https://api.elections.kalshi.com/trade-api/v2";
  const out = [];
  await mapLimit(COMMODITIES, 4, async (asset) => {
    let d;
    try {
      const r = await fetch(px(root + "/markets?series_ticker=" + asset.series + "&status=open&limit=100"));
      if (!r.ok) return;
      d = await r.json();
    } catch { return; }
    const raw = (d.markets || []).filter((m) => m.floor_strike != null || m.cap_strike != null);
    if (!raw.length) return;
    const q = await yahooHist(asset.sym);
    if (!q) return;
    // Soonest event first; one card per event.
    const byEvent = {};
    raw.forEach((m) => { (byEvent[m.event_ticker] = byEvent[m.event_ticker] || []).push(m); });
    const events = Object.values(byEvent)
      .sort((a, b) => new Date(a[0].close_time) - new Date(b[0].close_time)).slice(0, 2);
    for (const ms of events) {
      const closeT = new Date(ms[0].close_time);
      const days = Math.max(0.02, (closeT - Date.now()) / 86400000);
      const td = asset.crypto ? days : Math.max(0.02, days * 5 / 7);
      // Ascending strike ladder (greater-type strikes, the common shape)
      const ladder = ms.filter((m) => /greater/.test(m.strike_type || "") && m.floor_strike != null)
        .map((m) => ({ m: kaMarket(m), K: Number(m.floor_strike) }))
        .filter((x) => Number.isFinite(x.K) && x.m.price != null)
        .sort((a, b) => a.K - b.K);
      if (ladder.length < 2) continue;
      // Short horizons live on the intraday clock: minute-level EWMA vol
      // and the freshest spot beat a 3-month daily average. Daily trend
      // drift applies at daily+ horizons; chart strategies tilt intraday.
      let spotUse = q.spot, sigUse = q.sigmaD, tUse = td, muUse = 0, tech = null;
      if (days * 24 <= 48) {
        const qi = await yahooIntraday(asset.sym);
        if (qi) {
          spotUse = qi.spot; sigUse = qi.sigmaM; tUse = Math.max(0.5, days * 24 * 60);
          tech = qi.tech; muUse = techDrift(tech, qi.sigmaM);
        }
      } else {
        muUse = trendDrift(q.trend, q.sigmaD);
      }
      const pMarket = ladder.map((x) => clamp(x.m.price, 0.5, 99.5));
      // Volatility blend: geometric mean of trailing realized vol and the
      // forward-looking vol implied by the ladder's own prices.
      const sigImp = impliedSigma(ladder.map((x) => x.K), pMarket, spotUse, tUse);
      const sigBlend = sigImp ? Math.sqrt(sigUse * sigImp) : sigUse;
      const pModel = ladder.map((x) => pAbove(spotUse, x.K, sigBlend, tUse, muUse));
      if (pModel.some((p) => p == null)) continue;
      // Headline = ensemble of model and market per strike; both parents
      // stay visible so disagreement is informative, not hidden.
      const pComb = pModel.map((p, i) => blendProb(p, pMarket[i]));
      const bModel = bucketProbs(ladder.map((x) => x.K), pModel);
      const bMarket = bucketProbs(ladder.map((x) => x.K), pMarket);
      const bComb = bucketProbs(ladder.map((x) => x.K), pComb);
      const bucketName = (i) => i === 0 ? "Below " + asset.unit + ladder[0].K
        : i === ladder.length ? "Above " + asset.unit + ladder[ladder.length - 1].K
        : asset.unit + ladder[i - 1].K + " – " + asset.unit + ladder[i].K;
      const argmax = (arr) => { let w = 0; arr.forEach((p, i) => { if (p > arr[w]) w = i; }); return w; };
      const win = argmax(bComb), modelWin = argmax(bModel), mktWin = argmax(bMarket);
      out.push({
        asset, spot: spotUse, sigmaD: sigUse, sigImp, sigBlend, intraday: tUse !== td,
        tech,
        chg1d: q.chg1d, chg5d: q.chg5d, trend: q.trend, drift: muUse,
        title: ms[0].title || asset.label, close: ms[0].close_time, days,
        ladder, pModel, pMarket, pComb, bModel, bComb, bucketName,
        win, winProb: bComb[win], modelWin, mktWin,
        agree: modelWin === mktWin,
        strikes: ladder.map((x) => x.K), eventTicker: ms[0].event_ticker,
      });
    }
  });
  return out.sort((a, b) => new Date(a.close) - new Date(b.close));
}

/* ---- over/under pipeline ---- */
// Kalshi totals series (YES = combined score reaches the ticker's number).
const TOTAL_SERIES = [
  ["KXMLBTOTAL", "baseball/mlb", "MLB"],
  ["KXWNBATOTAL", "basketball/wnba", "WNBA"],
  ["KXNFLTOTAL", "football/nfl", "NFL"],
  ["KXNHLTOTAL", "hockey/nhl", "NHL"],
  ["KXCFBTOTAL", "football/college-football", "NCAAF"],
  ["KXNBATOTAL", "basketball/nba", "NBA"],
];

// What kind of wager a ticker is — labels the history and position cards.
function wagerType(ticker) {
  const t = String(ticker || "");
  if (/^KXMVE/.test(t)) return "PARLAY";
  if (/TOTAL/.test(t)) return "OVER/UNDER";
  if (/15M-/.test(t)) return "15-MIN";
  if (/^(KXWTI|KXBRENTD|KXGOLD|KXSILVER|KXBTC|KXETH|KXSOL|KXXRP|KXDOGE|KXADA|KXBNB|KXINX|KXNDQ)/.test(t)) return "PRICE";
  return "WINNER";
}

// KXMLBTOTAL-26AUG102145HOUSF-9 -> threshold 9 -> the market is "9 or
// more", i.e. OVER the books' 8.5 line.
function totalLine(ticker) {
  const seg = String(ticker || "").split("-").pop();
  const n = Number(seg);
  return Number.isFinite(n) ? n - 0.5 : null;
}

// Deterministic live pace read: total points so far vs how much of the
// game has elapsed. Rough by design — it's a sanity check on the line,
// not a model. Returns null when the elapsed fraction can't be parsed.
function paceProjection(path, detail, sides) {
  if (!sides || sides.length < 2) return null;
  const total = sides.reduce((s, x) => s + (Number(x.score) || 0), 0);
  const d = String(detail || "");
  let frac = null;
  if (path === "baseball/mlb") {
    const m = d.match(/(Top|Bot|Bottom|Mid|End)\w*\s+(\d+)/i);
    if (m) frac = clamp((Number(m[2]) - 1 + (/bot|end/i.test(m[1]) ? 0.5 : 0)) / 9, 0.05, 1);
  } else {
    const q = d.match(/(\d+)(?:st|nd|rd|th)/);
    const clock = d.match(/(\d+):(\d+)/);
    if (q) {
      const perLen = path === "basketball/nba" ? 12 : /hockey/.test(path) ? 20 : /basketball/.test(path) ? 10 : 15;
      const nQ = /hockey/.test(path) ? 3 : 4;
      const left = clock ? Number(clock[1]) + Number(clock[2]) / 60 : 0;
      frac = clamp(((Number(q[1]) - 1) * perLen + (perLen - left)) / (nQ * perLen), 0.05, 1);
    }
  }
  if (frac == null || frac < 0.15) return null;
  return { total, frac, projected: total / frac };
}

// Scan Kalshi's totals markets: match each to its game and the books'
// de-vigged totals consensus. The strike ladder market nearest the books'
// median line gets the full probability read; off-line gaps are flagged.
async function scanTotals() {
  const root = "https://api.elections.kalshi.com/trade-api/v2";
  const out = [];
  await mapLimit(TOTAL_SERIES, 4, async ([series, path, label]) => {
    let d;
    try {
      const r = await fetch(px(root + "/markets?series_ticker=" + series + "&status=open&limit=200"));
      if (!r.ok) return;
      d = await r.json();
    } catch { return; }
    const ms = (d.markets || []).map(kaMarket).filter((m) => m.price != null);
    if (!ms.length) return;
    const parsed = ms.map((m) => ({ m, codes: teamCodes(m.id), date: tickerDate(m.id), line: totalLine(m.id) }))
      .filter((x) => x.codes.length && x.line != null);
    const dates = [...new Set(parsed.map((x) => x.date).filter(Boolean))].sort().slice(0, 4);
    if (!dates.length) return;
    const slates = await mapLimit(dates, 3, (dt) => espnGamesForLeague(path, dt));
    const gs = [];
    const seen = new Set();
    [].concat(...slates).forEach((g) => { if (!seen.has(g.eventId)) { seen.add(g.eventId); gs.push(g); } });
    if (!gs.length) return;
    const anyLiveGame = gs.some((g) => g.state === "in");
    const soonCut = Number(etDate(Date.now() + 36 * 3600 * 1000).replace(/-/g, ""));
    const imminent = anyLiveGame || parsed.some((x) => x.date && Number(x.date) <= soonCut);
    const oddsEvents = imminent ? await fetchOddsEvents(path, anyLiveGame) : null;

    const byGame = {};
    parsed.forEach((x) => {
      let best = null, bestS = 0;
      gs.forEach((g) => {
        const s = codeHit(x.codes, g.abbrs) + (x.date && g.date === x.date ? 0.5 : 0);
        if (s > bestS) { bestS = s; best = g; }
      });
      if (!best || bestS < 1) return;
      (byGame[best.eventId] = byGame[best.eventId] || { g: best, ladder: [] }).ladder.push(x);
    });
    for (const { g, ladder } of Object.values(byGame)) {
      const ev = matchOddsEvent(oddsEvents, g.name, g.date);
      const tot = ev ? oddsSideMarket(ev, "totals") : null;
      if (!tot) continue;
      let pick = null, gap = Infinity;
      ladder.forEach((x) => {
        const dGap = Math.abs(x.line - tot.point);
        if (dGap < gap) { gap = dGap; pick = x; }
      });
      if (!pick) continue;
      const exact = gap < 0.01;
      const pace = g.state === "in" ? paceProjection(path, g.detail, g.sides) : null;
      out.push({
        id: pick.m.id, market: pick.m, league: label, game: g.name, state: g.state,
        sides: g.sides || null, detail: g.detail || "", date: pick.date,
        line: pick.line, bookLine: tot.point, exact,
        pOver: tot.a, books: tot.books, entry: pick.m.ask != null ? pick.m.ask : pick.m.price,
        pace,
      });
    }
  });
  return out.sort((a, b) => Math.abs(b.pOver - 50) - Math.abs(a.pOver - 50));
}

// Final score -> winning abbreviation ("TIE" on a draw, null if unplayed).
function gameWinnerAbbr(sides) {
  if (!sides || sides.length < 2) return null;
  const byScore = sides.slice().sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
  if (byScore[0].score == null || byScore[1].score == null) return null;
  if ((Number(byScore[0].score) || 0) === (Number(byScore[1].score) || 0)) return "TIE";
  return byScore[0].abbr || null;
}

// Did a recorded pick win, given the final winner's abbreviation?
const pickWon = (pickCode, winner) => !!pickCode &&
  (winner === "TIE" ? /TIE|DRAW/i.test(pickCode) : codeHit([pickCode], [winner]) >= 0.6);

/* ---------------- Commodities ---------------- */
// One-tap research brief per asset: a single search-enabled Claude call
// (macro drivers, supply/demand, positioning, catalysts) cached for six
// hours locally so repeat opens cost nothing.
function ResearchBrief({ asset, spot, trend }) {
  const key = "cd:combrief:" + asset.sym;
  const [brief, setBrief] = useState(() => {
    try {
      const c = JSON.parse(localStorage.getItem(key) || "null");
      if (c && Date.now() - c.at < 6 * 3600 * 1000) return c;
    } catch { /* fresh */ }
    return null;
  });
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const name = asset.label.replace(/\s*\(.*\)/, "");
      const r = await callClaude(
        "Today is " + today() + ". You are a commodities analyst. In under 130 words, brief a trader on " + name +
        " right now: spot is ~" + spot.toFixed(2) + (trend ? ", 20-day move " + trend.mom20.toFixed(1) + "%, RSI " + trend.rsi.toFixed(0) : "") +
        ". Search for the latest: (1) the one or two macro/supply drivers moving it this week, (2) any scheduled catalyst in the next few days (data releases, OPEC/Fed, expiries), (3) which direction the flows/positioning lean. End with one sentence: does the evidence lean bullish, bearish, or neutral into the next settlement, and why.",
        { search: true, maxTokens: 500 });
      const b = { at: Date.now(), text: r.text.trim() };
      try { localStorage.setItem(key, JSON.stringify(b)); } catch { /* fine */ }
      setBrief(b);
    } catch { setBrief({ at: Date.now(), text: "Research call failed — try again in a minute." }); }
    setBusy(false);
  }

  return (
    <div style={{ marginTop: 10 }}>
      {!brief && (
        <button className="btn btn-ghost btn-sm" onClick={run} disabled={busy}>
          {busy ? "Researching…" : "Research brief (news, drivers, catalysts)"}
        </button>
      )}
      {brief && (
        <details className="fold" open>
          <summary>Research brief · {new Date(brief.at).toLocaleTimeString()} <button className="chip" style={{ marginLeft: 8 }}
            onClick={(e) => { e.preventDefault(); run(); }} disabled={busy}>{busy ? "…" : "refresh"}</button></summary>
          <p className="thesis" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{brief.text}</p>
        </details>
      )}
    </div>
  );
}

function Commodities({ onPick }) {
  const [rows, setRows] = useState([]);
  const [fast, setFast] = useState([]);
  const [state, setState] = useState("idle");
  const [at, setAt] = useState(null);
  const [record, setRecord] = useState(null);
  const fastRef = useRef([]);
  const rowsRef = useRef([]);
  const recordRef = useRef(null);

  useEffect(() => {
    fetch("/api/desk/picks").then((r) => r.json())
      .then((d) => { recordRef.current = d.record || []; setRecord(recordRef.current); })
      .catch(() => { recordRef.current = []; });
  }, []);

  // Log every ladder call once per event; grade it from the settled
  // markets' results after close. The winner-bucket record builds itself
  // exactly like the sports board's.
  async function reconcileCom(scanned) {
    if (!recordRef.current) return;
    const rec = recordRef.current.slice();
    const changed = [];
    scanned.forEach((r) => {
      if (!r.eventTicker || new Date(r.close) < Date.now()) return;
      const id = "cm-" + r.eventTicker;
      if (rec.some((x) => x.id === id)) return;
      const e = { id, type: "commodity", at: Date.now(), league: r.asset.label,
        pick: r.bucketName(r.win), win: r.win, strikes: r.strikes,
        prob: Math.round(r.winProb * 10) / 10, close: r.close, result: null };
      rec.unshift(e); changed.push(e);
    });
    const due = rec.filter((x) => x.type === "commodity" && x.result == null &&
      x.close && Date.now() - new Date(x.close) > 10 * 60000).slice(0, 5);
    for (const x of due) {
      try {
        const r2 = await fetch(px("https://api.elections.kalshi.com/trade-api/v2/markets?event_ticker=" +
          encodeURIComponent(x.id.slice(3)) + "&limit=100"));
        if (!r2.ok) continue;
        const d2 = await r2.json();
        const ms = (d2.markets || []).filter((m) => /greater/.test(m.strike_type || "") &&
          m.floor_strike != null && (m.result === "yes" || m.result === "no"));
        if (!ms.length) {
          if (Date.now() - (x.at || 0) > 3 * 86400000) { x.result = "void"; changed.push(x); }
          continue;
        }
        // Settle landed above every strike that resolved YES — the actual
        // bucket index is simply the count of YES strikes.
        const actual = ms.filter((m) => m.result === "yes").length;
        x.result = actual === x.win ? "won" : "lost";
        x.actual = actual;
        changed.push(x);
      } catch { /* next cycle */ }
    }
    recordRef.current = rec;
    if (changed.length) {
      setRecord(rec.slice());
      try {
        await fetch("/api/desk/picks", { method: "POST",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify(changed) });
      } catch { /* resend next cycle */ }
    }
  }

  // Every confident 15-minute call gets logged once per window and graded
  // from the market's settled result — the record for what gets bet most.
  async function reconcileF15(fastRows) {
    if (!recordRef.current) return;
    const rec = recordRef.current;
    const changed = [];
    fastRows.forEach((f) => {
      const dec = f15Call(f.pUp, f.minLeft, f.stale);
      if (!dec.firm) return; // only firm, mid-window, fresh-data calls count
      const conf = dec.conf;
      const id = "f15-" + f.m.id;
      if (rec.some((x) => x.id === id)) return;
      const e = { id, type: "f15", at: Date.now(), league: f.a.label,
        pick: f.a.label + " " + (f.pUp >= 50 ? "UP" : "DOWN"), up: f.pUp >= 50,
        prob: Math.round(conf * 10) / 10, close: f.close, result: null };
      rec.unshift(e); changed.push(e);
    });
    const due = rec.filter((x) => x.type === "f15" && x.result == null &&
      x.close && Date.now() - new Date(x.close) > 2 * 60000).slice(0, 6);
    for (const x of due) {
      try {
        const r2 = await fetch(px("https://api.elections.kalshi.com/trade-api/v2/markets/" + x.id.slice(4)));
        if (!r2.ok) continue;
        const d2 = await r2.json();
        const res = d2.market && d2.market.result;
        if (res === "yes" || res === "no") {
          x.result = (res === "yes") === x.up ? "won" : "lost";
          changed.push(x);
        } else if (Date.now() - (x.at || 0) > 86400000) { x.result = "void"; changed.push(x); }
      } catch { /* next cycle */ }
    }
    if (changed.length) {
      setRecord(rec.slice());
      try {
        await fetch("/api/desk/picks", { method: "POST",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify(changed) });
      } catch { /* resend next cycle */ }
    }
  }

  async function run() {
    setState("loading");
    try {
      const f = await scanFast15();
      setRows([]); rowsRef.current = [];
      setFast(f); fastRef.current = f;
      setAt(Date.now()); setState("done");
      reconcileF15(f);
    } catch { setState("done"); }
  }
  // Live cadence: 15s while any 15-minute window is running, 45s when a
  // ladder settles within 2 hours, 3 minutes otherwise.
  useEffect(() => {
    let alive = true, timer = null;
    const loop = async () => {
      await run();
      if (!alive) return;
      const anyClosing = fastRef.current.some((f) => f.minLeft < 4);
      const wait = anyClosing ? 8000 : fastRef.current.length ? 15000
        : rowsRef.current.some((r) => r.days * 24 < 2) ? 45000 : 180000;
      timer = setTimeout(loop, wait);
    };
    loop();
    const onVis = () => { if (!document.hidden) { if (timer) clearTimeout(timer); loop(); } };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  const tierFor = (p) => p >= 60 ? { c: "var(--moss)", t: "STRONG" }
    : p >= 40 ? { c: "var(--amber)", t: "LEAN" } : { c: "var(--dim)", t: "BEST GUESS" };

  return (
    <>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
          <p className="sect" style={{ margin: 0 }}>Commodities — 15-minute predictions</p>
          <button className="btn btn-ghost btn-sm" onClick={run} disabled={state === "loading"}>
            {state === "loading" ? "Scanning" : "Rescan"}
          </button>
        </div>
        <p className="help" style={{ marginTop: 6 }}>
          Up or down, every live 15-minute window: crypto around the clock, gold, silver, oil and the stock indexes
          during their market hours. Each call blends realtime spot, minute-level volatility, the chart strategies,
          and the market's own quote — with every graded call building the record below.
        </p>
        {at && <div className="chips" style={{ marginTop: 8 }}>
          <span className="chip static">updated {new Date(at).toLocaleTimeString()}</span>
          <span className="chip static">refreshes every 15s · 8s in a window's final minutes</span>
        </div>}
        {state === "loading" && rows.length === 0 && <p className="pwait" style={{ marginTop: 10 }}><span className="dots">pricing every ladder</span></p>}
        {state === "done" && rows.length === 0 && fast.length === 0 && (
          <p className="thesis" style={{ color: "var(--dim)", marginTop: 10 }}>
            No 15-minute windows are live right now — crypto windows run around the clock, so this usually means a data hiccup; it will retry on its own.
          </p>
        )}
      </div>

      {fast.length > 0 && (
        <div className="panel" style={{ borderColor: "rgba(228,112,126,.4)" }}>
          <p className="sect" style={{ margin: 0, color: "var(--rose)" }}>⚡ 15-minute markets — crypto, metals, oil, indexes</p>
          {(() => {
            const g = (record || []).filter((x) => x.type === "f15" && (x.result === "won" || x.result === "lost"));
            const w = g.filter((x) => x.result === "won").length;
            return g.length > 0 && (
              <div className="chips" style={{ marginTop: 6 }}>
                <span className="chip static" style={{ color: w * 2 >= g.length ? "var(--moss)" : "var(--rose)" }}
                  title="Every confident 15-minute call, graded against the settled result">
                  15-min calls: {w}-{g.length - w} ({Math.round((w / g.length) * 100)}%)
                </span>
              </div>
            );
          })()}
          <p className="help" style={{ marginTop: 6 }}>
            My prediction for each live 15-minute window — up or down — from the live price vs the window's opening
            reference, this hour's minute-level volatility, and the chart strategies. Refreshed every 15 seconds.
            Windows settle on a 60-second average, so late flips near the line can still reverse.
          </p>
          {fast.map((f) => {
            const up = f.pUp >= 50;
            const conf = up ? f.pUp : 100 - f.pUp;
            const col = conf >= 68 ? "var(--moss)" : conf >= 55 ? "var(--amber)" : "var(--dim)";
            const diff = f.spot - f.ref;
            const diffPct = (diff / f.ref) * 100;
            return (
              <div key={f.a.series} className={"pick " + (conf >= 68 ? "t-strong" : conf >= 55 ? "t-lean" : "")}>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="who-big" style={{ display: "block" }}>
                    <span className="livedot" />
                    {(() => { const dec = f15Call(f.pUp, f.minLeft, f.stale); return (<>{f.a.label}: <span style={{ color: dec.firm ? col : "var(--dim)" }}>{dec.call}</span>{f.stale && <span className="srcchip bad" style={{ marginLeft: 8, fontSize: 9 }}>FEED STALE {Math.round(f.staleSec/60)}m</span>}{f.dataWarn && <span className="srcchip bad" style={{ marginLeft: 8, fontSize: 9 }}>{f.dataWarn.toUpperCase()}</span>}</>); })()}{f.disagree && <span className="srcchip bad" style={{ marginLeft: 8, fontSize: 9 }}>MODEL vs MARKET SPLIT</span>}
                    <span style={{ fontSize: 13, color: "var(--dim)", fontWeight: 400 }}>
                      {" "}· closes {new Date(f.close).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {Math.max(0, f.minLeft).toFixed(1)} min left
                    </span>
                  </span>
                  <span className="meta-line" style={{ display: "block" }}>
                    now {f.spot.toLocaleString(undefined, { maximumFractionDigits: 4 })} vs open {f.ref.toLocaleString(undefined, { maximumFractionDigits: 4 })}{" "}
                    (<b style={{ color: diff >= 0 ? "var(--moss)" : "var(--rose)" }}>{diff >= 0 ? "+" : ""}{diffPct.toFixed(3)}%</b>)
                    {f.pMkt != null ? " · model " + f.pModel.toFixed(0) + "% · market " + f.pMkt.toFixed(0) + "% up" : " · model " + f.pModel.toFixed(0) + "% up"}
                    {f.chg15m != null ? " · prior 15m " + (f.chg15m >= 0 ? "+" : "") + f.chg15m.toFixed(2) + "%" : ""}
                  </span>
                  {f.tech && f.tech.votes.length > 0 && (
                    <span className="meta-line" style={{ display: "block" }}>
                      charts{" "}
                      <b style={{ color: f.tech.lean === "UP" ? "var(--moss)" : f.tech.lean === "DOWN" ? "var(--rose)" : "var(--dim)" }}>
                        {f.tech.lean === "NEUTRAL" ? "neutral" : "lean " + f.tech.lean}
                      </b>
                      {": "}{f.tech.votes.map((v) => v.k + " " + v.note).join(" · ")}
                    </span>
                  )}

                </span>
                {(() => { const dec = f15Call(f.pUp, f.minLeft, f.stale); return (
                <span className="tierbox" style={{ color: dec.firm ? col : "var(--dim)", borderColor: dec.firm ? col : "var(--dim)" }}>
                  <span className="pct">{dec.conf.toFixed(0)}%</span>
                  <span className="lbl">{dec.firm ? dec.call : dec.call === "TOO EARLY" ? "EARLY" : dec.call === "NO CALL" ? "STALE" : dec.call.indexOf("LEAN") === 0 ? "LEAN" : "TOSS-UP"}</span>
                </span>
                ); })()}
                <span className="pick-actions">
                  <a className="chip" href={kalshiEventLink(f.m.id)} target="_blank" rel="noreferrer">trade ↗</a>
                </span>
              </div>
            );
          })}
          <p className="help" style={{ marginTop: 8 }}>
            Honesty note: 15-minute moves are nearly random — treat COIN FLIP as the true answer for most windows.
            The model only claims UP or DOWN when the remaining time makes the current lead hard to reverse.
          </p>
        </div>
      )}


    </>
  );
}

/* ---------------- Today's picks ----------------
   The landing board: every live, today's, and upcoming game with the side
   worth picking — books-consensus true odds, net edge after fees, the
   scanner's decision, and the full-analysis verdict when one exists. Free
   to refresh; deep dive hands the market to the Analyze pipeline. */
/* ================= First Inning — NRFI / YRFI ==================
   A calibrated first-inning run model built from MLB StatsAPI split data,
   then refined by a multi-check research pass: pitching, both teams' 1st-
   inning offense, posted lineup (top of the order — also captures late
   scratches/injuries), travel & rest, and weather/park. NRFIKINGKY's live
   picks (JuiceReel) ride along as a tailing signal. Self-graded from the
   real first-inning line score. */

const NRFI_LG_LAMBDA = 0.52;  // league avg runs per team in the 1st inning
const NRFI_LG_P0 = 0.72;      // league P(no run in a half-inning) -> ~52% NRFI
const NRFI_PIT_REG = 12;      // heavy regression — 1st-inning rate is a tiebreaker, not the thesis
const NRFI_OFF_REG = 6;       // regression games for a team's 1st-inning offense
const NRFI_LG_OBP = 0.318;    // league on-base baseline for lineup strength
// Run-scoring park factors by home-team abbreviation (1.0 = neutral,
// directional estimates compressed toward 1 for a single inning).
const NRFI_PARK = {
  COL: 1.14, BOS: 1.06, CIN: 1.06, KC: 1.04, ARI: 1.04, BAL: 1.03, PHI: 1.03,
  TEX: 1.02, TOR: 1.02, LAA: 1.02, MIN: 1.02, ATL: 1.01, HOU: 1.01, CHC: 1.01,
  NYY: 1.01, WSH: 1.01, MIL: 1.00, CWS: 1.00, LAD: 0.99, STL: 0.99, PIT: 0.99,
  TB: 0.98, CLE: 0.98, DET: 0.97, NYM: 0.97, OAK: 0.97, ATH: 0.97, SAC: 0.97,
  MIA: 0.95, SEA: 0.94, SD: 0.94, SF: 0.93,
};
const nClamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

const _pitI01 = new Map();   // pid:season -> {rate,sample,era,whip}
const _teamI01 = new Map();  // teamId:season -> {rate,sample,ops}
const _obpCache = new Map();
const _travelCache = new Map();
const _linescore = new Map(); // gamePk -> Promise<linescore>
const _rolling = new Map();   // pid:season -> rolling NRFI windows
// Shared linescore fetch — stores the Promise so concurrent callers dedup.
function getLinescore(gamePk) {
  if (!_linescore.has(gamePk))
    _linescore.set(gamePk, getJson("https://statsapi.mlb.com/api/v1/game/" + gamePk + "/linescore").catch(() => null));
  return _linescore.get(gamePk);
}

async function pitcherFirstInning(pid, season) {
  if (pid == null) return null;
  const k = pid + ":" + season;
  if (_pitI01.has(k)) return _pitI01.get(k);
  let val = null;
  try {
    const d = await getJson("https://statsapi.mlb.com/api/v1/people/" + pid +
      "/stats?stats=statSplits&group=pitching&sitCodes=i01&season=" + season);
    const st = d.stats && d.stats[0] && d.stats[0].splits && d.stats[0].splits[0] && d.stats[0].splits[0].stat;
    if (st && st.gamesPlayed) {
      const bf = Number(st.battersFaced || 0);
      const ip = st.inningsPitched != null ? parseIp(st.inningsPitched) : null;
      const k9 = ip && ip > 0 ? Number(st.strikeOuts || 0) * 9 / ip : null;
      const bb9 = ip && ip > 0 ? Number(st.baseOnBalls || 0) * 9 / ip : null;
      const hr9 = ip && ip > 0 ? Number(st.homeRuns || 0) * 9 / ip : null;
      val = { rate: Number(st.runs || 0) / st.gamesPlayed, sample: st.gamesPlayed,
        era: st.era != null ? Number(st.era) : null, whip: st.whip != null ? Number(st.whip) : null,
        k9, bb9, hr9, innings: ip,
        krate: bf ? Number(st.strikeOuts || 0) / bf : null,
        obpA: bf ? (Number(st.hits || 0) + Number(st.baseOnBalls || 0) + Number(st.hitByPitch || 0)) / bf : null,
        hits: Number(st.hits || 0), bb: Number(st.baseOnBalls || 0),
        k: Number(st.strikeOuts || 0), hr: Number(st.homeRuns || 0) };
    }
  } catch { /* leave null */ }
  _pitI01.set(k, val);
  return val;
}

// One call gets 1st-inning offense AND platoon splits (OPS vs LHP/RHP).
async function teamOffenseSplits(teamId, season) {
  if (teamId == null) return null;
  const k = teamId + ":" + season;
  if (_teamI01.has(k)) return _teamI01.get(k);
  let val = null;
  try {
    const d = await getJson("https://statsapi.mlb.com/api/v1/teams/" + teamId +
      "/stats?stats=statSplits&group=hitting&sitCodes=i01,vr,vl&season=" + season);
    const splits = (d.stats && d.stats[0] && d.stats[0].splits) || [];
    const find = (re) => { const s = splits.find((x) => re.test((x.split && x.split.description) || "")); return s && s.stat; };
    const i01 = find(/first inning/i), vr = find(/right/i), vl = find(/left/i);
    if (i01 && i01.gamesPlayed) {
      val = { rate: Number(i01.runs || 0) / i01.gamesPlayed, sample: i01.gamesPlayed,
        opsVsR: vr && vr.ops != null ? Number(vr.ops) : null,
        opsVsL: vl && vl.ops != null ? Number(vl.ops) : null };
    }
  } catch { /* leave null */ }
  _teamI01.set(k, val);
  return val;
}

// Starter handedness (people) + recent form (last-3-start ERA from gameLog).
const _pitMeta = new Map();
const parseIp = (ip) => { const m = String(ip == null ? "0" : ip).split("."); return Number(m[0] || 0) + (m[1] === "1" ? 1 / 3 : m[1] === "2" ? 2 / 3 : 0); };
async function pitcherMeta(pid, season) {
  if (pid == null) return { hand: null, form: null };
  const k = pid + ":" + season;
  if (_pitMeta.has(k)) return _pitMeta.get(k);
  let hand = null, form = null, fipForm = null, lastStartDate = null, seasonEra = null, gs = null, g = null, ip = null, allow = null;
  try {
    const [p, gl] = await Promise.all([
      getJson("https://statsapi.mlb.com/api/v1/people/" + pid + "?hydrate=stats(group=[pitching],type=[season],season=" + season + ")"),
      getJson("https://statsapi.mlb.com/api/v1/people/" + pid + "/stats?stats=gameLog&group=pitching&season=" + season),
    ]);
    const pp = p.people && p.people[0];
    hand = (pp && pp.pitchHand && pp.pitchHand.code) || null;
    const sst = pp && pp.stats && pp.stats[0] && pp.stats[0].splits && pp.stats[0].splits[0] && pp.stats[0].splits[0].stat;
    seasonEra = sst && sst.era != null ? Number(sst.era) : null;
    if (sst) { gs = sst.gamesStarted != null ? Number(sst.gamesStarted) : null; g = sst.gamesPlayed != null ? Number(sst.gamesPlayed) : null; ip = sst.inningsPitched != null ? parseIp(sst.inningsPitched) : null; allow = paRates(sst, sst.battersFaced); }
    const sp = (gl.stats && gl.stats[0] && gl.stats[0].splits) || [];
    // Use starts only for form + rest day tracking (exclude relief appearances)
    const starts = sp.filter((s) => Number(s.stat && s.stat.gamesStarted) === 1);
    const lastSt = starts[starts.length - 1];
    lastStartDate = (lastSt && (lastSt.date || (lastSt.game && lastSt.game.date))) || null;
    const recentStarts = starts.slice(-3);
    if (recentStarts.length) {
      let er = 0, lip = 0, hr = 0, bb = 0, k = 0;
      recentStarts.forEach((s) => {
        er += Number((s.stat && s.stat.earnedRuns) || 0);
        lip += parseIp(s.stat && s.stat.inningsPitched);
        hr += Number((s.stat && s.stat.homeRuns) || 0);
        bb += Number((s.stat && s.stat.baseOnBalls) || 0) + Number((s.stat && s.stat.hitByPitch) || 0);
        k += Number((s.stat && s.stat.strikeOuts) || 0);
      });
      if (lip > 0) {
        form = (er * 9) / lip;
        // FIP (Fielding Independent Pitching) removes defense noise — better forward predictor than ERA
        fipForm = Math.max(0.5, 3.13 + (13 * hr + 3 * bb - 2 * k) / lip);
      }
    }
  } catch { /* leave nulls */ }
  const val = { hand, form, fipForm, lastStartDate, seasonEra, gs, g, ip, allow, id: pid };
  _pitMeta.set(k, val);
  return val;
}

// Rolling first-inning clean % (SZN / L50 / L30 / L10) from actual game linescores.
// Fetches the pitcher's game log to get start gamePks, then pulls each linescore
// to check whether the first inning was scoreless. Shared linescore cache ensures
// games appearing for both pitchers are only fetched once per page load.
async function pitcherRollingNRFI(pid, season) {
  if (pid == null) return null;
  const k = pid + ":" + season;
  if (_rolling.has(k)) return _rolling.get(k);
  let val = null;
  try {
    const gl = await getJson("https://statsapi.mlb.com/api/v1/people/" + pid +
      "/stats?stats=gameLog&group=pitching&season=" + season);
    const splits = (gl.stats && gl.stats[0] && gl.stats[0].splits) || [];
    // Only actual starts; extract gamePk and home/away flag.
    const items = splits.filter((s) => Number(s.stat && s.stat.gamesStarted) === 1)
      .map((s) => ({ gamePk: s.game && s.game.gamePk, isHome: !!s.isHome }))
      .filter((x) => x.gamePk);
    if (items.length) {
      // Fire all linescore fetches concurrently (shared cache deduplicates).
      const results = await Promise.all(items.map(async (item) => {
        try {
          const ls = await getLinescore(item.gamePk);
          const inn1 = ls && ls.innings && ls.innings[0];
          if (!inn1) return null;
          // Home pitcher faces away batters (top of 1st); away pitcher faces home batters (bot).
          const r = item.isHome
            ? Number((inn1.away && inn1.away.runs) || 0)
            : Number((inn1.home && inn1.home.runs) || 0);
          return r === 0; // true = clean first inning
        } catch { return null; }
      }));
      const valid = results.filter((x) => x !== null);
      if (valid.length) {
        const pct = (arr) => arr.length ? Math.round(arr.filter(Boolean).length / arr.length * 100) : null;
        val = {
          szn: { pct: pct(valid),             n: valid.length },
          l50: { pct: pct(valid.slice(-50)),   n: Math.min(valid.length, 50) },
          l30: { pct: pct(valid.slice(-30)),   n: Math.min(valid.length, 30) },
          l10: { pct: pct(valid.slice(-10)),   n: Math.min(valid.length, 10) },
          lastClean: valid.length > 0 ? valid[valid.length - 1] : null,
        };
      }
    }
  } catch { /* leave null */ }
  _rolling.set(k, val);
  return val;
}

// Platoon edge: an offense's OPS vs the opposing starter's hand, relative to
// its own two-hand average. >1 favours a run (YRFI), <1 favours NRFI.
function platoonFactor(off, oppHand) {
  if (!off || !oppHand || off.opsVsR == null || off.opsVsL == null) return { f: 1, note: "platoon data n/a" };
  const ops = oppHand === "L" ? off.opsVsL : off.opsVsR;
  const base = (off.opsVsR + off.opsVsL) / 2;
  if (!base) return { f: 1, note: "platoon data n/a" };
  return { f: nClamp(ops / base, 0.85, 1.18), note: "OPS " + ops.toFixed(3) + " vs " + (oppHand === "L" ? "LHP" : "RHP") };
}
// Recent form: prefer FIP (fielding-independent, removes defense noise) over ERA.
// FIP = 3.13 + (13*HR + 3*BB - 2*K) / IP — more predictive of next-start performance.
function formFactor(era, fip) {
  const metric = fip != null ? fip : era;
  if (metric == null) return { f: 1, note: "recent form n/a" };
  const label = fip != null ? "FIP" : "ERA";
  return { f: nClamp(1 + ((metric - 4.15) / 4.15) * 0.25, 0.85, 1.2), note: "L3 " + metric.toFixed(2) + " " + label };
}
// Pitcher rest days: backtest v5 (4,015 games) showed counterintuitive results:
// short rest ≤3d: tired arm → more runs → YRFI lean (f > 1 increases pitcher lambda)
// extra rest 6-7d: 48.7% NRFI vs 50.8% normal — opposite of assumption, YRFI lean
// long layoff 8+d: rust risk → slight YRFI lean
// All three increase pitcher lambda (→ YRFI). Weight is 0.10 so effect is tiny (< 0.3pp).
function restFactor(days) {
  if (days == null || days < 1 || days > 30) return { f: 1, note: "" };
  if (days <= 3)              return { f: 1.05, note: days + "d rest (short)" };
  if (days >= 6 && days <= 7) return { f: 1.03, note: days + "d extra rest" };
  if (days >= 8)              return { f: 1.02, note: days + "d rest (long layoff)" };
  return { f: 1, note: "" };
}
// Pitcher THESIS — stable season peripherals (the real predictors), not the
// noisy first-inning run rate: strikeouts + whiff + first-pitch strikes suppress
// runs; walks + barrels (HR risk, no sequencing needed) inflate; grounders (DPs)
// suppress. `lg` = league averages for each.
function pitchSkillFactor(peri, lg) {
  if (!peri || !lg) return { f: 1, note: "peripherals n/a" };
  let f = 1;
  const dev = (v, base, w, dir) => { if (v != null && base) f *= nClamp(1 + dir * ((v - base) / base) * w, 0.88, 1.14); };
  dev(peri.k, lg.k, 0.35, -1);            // strikeouts prevent the sequencing a run requires
  dev(peri.whiff, lg.whiff, 0.12, -1);
  dev(peri.fstrike, lg.fstrike, 0.20, -1); // first-pitch strikes avoid walk traffic
  dev(peri.bb, lg.bb, 0.30, 1);           // walks are the #1 way a clean 1st gets traffic
  dev(peri.barrel, lg.barrel, 0.25, 1);   // a leadoff barrel/HR scores with no sequencing
  dev(peri.gb, lg.gb, 0.15, -1);          // grounders -> double plays end innings
  const note = peri.k != null
    ? "K " + peri.k.toFixed(0) + "% · BB " + (peri.bb != null ? peri.bb.toFixed(0) : "-") + "% · barrel " + (peri.barrel != null ? peri.barrel.toFixed(0) : "-") + "% · GB " + (peri.gb != null ? peri.gb.toFixed(0) : "-") + "%"
    : "n/a";
  return { f: nClamp(f, 0.80, 1.20), note };
}
// Opener / bullpen game: a starter who's really a reliever (few starts, low
// innings/appearance) throwing max-effort for one inning is a strong, often
// underrated NRFI arm.
function openerGameFactor(meta) {
  if (!meta || meta.gs == null || meta.g == null) return { f: 1, note: "", opener: false };
  const startShare = meta.g > 0 ? meta.gs / meta.g : 1;
  const ipPerG = meta.g > 0 && meta.ip != null ? meta.ip / meta.g : null;
  const opener = meta.gs === 0 || (ipPerG != null && ipPerG < 3.2) || startShare < 0.5;
  return opener ? { f: 0.93, note: "likely opener/bullpen game", opener: true } : { f: 1, note: "starter", opener: false };
}
// Clean opener vs slow starter: a starter whose 1st-inning ERA runs well below
// his overall ERA specializes in clean opening frames (NRFI); above it = slow starter.
function openerFactor(i01Era, seasonEra) {
  if (i01Era == null || seasonEra == null || seasonEra <= 0) return { f: 1, note: "n/a" };
  const ratio = i01Era / seasonEra;
  const tag = ratio <= 0.8 ? "clean opener" : ratio >= 1.25 ? "slow starter" : "typical";
  return { f: nClamp(1 + (ratio - 1) * 0.15, 0.9, 1.12), note: "1st-inn " + i01Era.toFixed(2) + " vs " + seasonEra.toFixed(2) + " ERA (" + tag + ")" };
}

// Pitcher season workload: deep-season fatigue nudges the first-inning risk up.
// Starters who have already thrown 130+ IP are carrying accumulated wear.
function seasonLoadFactor(ip) {
  if (ip == null) return { f: 1, note: "" };
  if (ip >= 150) return { f: 1.04, note: Math.round(ip) + " IP (heavy load)" };
  if (ip >= 130) return { f: 1.02, note: Math.round(ip) + " IP (high load)" };
  if (ip >= 120) return { f: 1.01, note: Math.round(ip) + " IP (building load)" };
  return { f: 1, note: "" };
}

// Top-of-order strength from the posted lineup (first 3 due up). One batched
// people call. Because it reads the ACTUAL lineup, late scratches/injuries are
// already reflected — the bench bat simply appears instead of the star.
// Leadoff-weighted (0.5/0.3/0.2) top-of-order OBP vs the OPPOSING STARTER'S
// HAND — the single sharpest offensive signal for a first-inning run.
// When oppPitcherId is provided, batter H2H history vs that pitcher is blended
// in (shrunk by sample size) for a sharper per-matchup estimate.
async function topOrderStrength(players, season, oppHand, oppPitcherId) {
  const ordered = (players || []).slice(0, 5).map((p) => p && p.id).filter(Boolean);
  if (ordered.length < 3) return { factor: 1, obp: null, note: "lineup not posted", batters: null };
  const sit = oppHand === "L" ? "vl" : oppHand === "R" ? "vr" : null;
  const k = ordered.join(",") + ":" + (sit || "all") + ":" + season + ":v2";
  if (_obpCache.has(k)) return _obpCache.get(k);
  let val = { factor: 1, obp: null, note: "lineup not posted", batters: null };
  try {
    const type = sit ? "type=[statSplits],sitCodes=[" + sit + "]" : "type=[season]";
    const d = await getJson("https://statsapi.mlb.com/api/v1/people?personIds=" + ordered.join(",") +
      "&hydrate=stats(group=[hitting]," + type + ",season=" + season + ")");
    const byId = {};
    (d.people || []).forEach((p) => {
      const s = p.stats && p.stats[0] && p.stats[0].splits && p.stats[0].splits[0] && p.stats[0].splits[0].stat;
      if (s) byId[p.id] = { obp: s.obp != null ? Number(s.obp) : null, rates: paRates(s, s.plateAppearances) };
    });
    const w = [0.5, 0.3, 0.2];
    let num = 0, den = 0;
    ordered.slice(0, 3).forEach((id, i) => { const o = byId[id] && byId[id].obp; if (o != null) { num += o * w[i]; den += w[i]; } });
    let batters = ordered.map((id) => (byId[id] && byId[id].rates) || null);
    // Batter vs pitcher H2H: blend actual history into per-batter rates.
    if (oppPitcherId && batters.some(Boolean)) {
      try {
        const h2hD = await getJson("https://statsapi.mlb.com/api/v1/people?personIds=" + ordered.join(",") +
          "&hydrate=stats(group=[hitting],type=[vsPlayer],opposingPlayerId=" + oppPitcherId + ",season=" + season + ")");
        const h2hById = {};
        (h2hD.people || []).forEach((p) => {
          const s = p.stats && p.stats[0] && p.stats[0].splits && p.stats[0].splits[0] && p.stats[0].splits[0].stat;
          const pa = s ? Number(s.plateAppearances || s.atBats || 0) : 0;
          if (s && pa >= 5) h2hById[p.id] = { pa, rates: paRates(s, pa) };
        });
        batters = batters.map((b, i) => {
          const h = h2hById[ordered[i]];
          if (!b || !h || !h.rates) return b;
          const wH = Math.min(0.65, h.pa / 20); // shrink to log5 when sparse
          const keys = ["out", "bb", "s1", "s2", "s3", "hr"];
          const blended = {};
          for (const k of keys) blended[k] = b[k] * (1 - wH) + h.rates[k] * wH;
          return blended;
        });
      } catch { /* H2H unavailable; keep season rates */ }
    }
    const hasB = batters.some(Boolean);
    if (den > 0) {
      const obp = num / den;
      val = { factor: nClamp(obp / NRFI_LG_OBP, 0.82, 1.24), obp, batters: hasB ? batters : null,
        note: "1-3 OBP " + obp.toFixed(3) + (sit ? " vs " + (oppHand === "L" ? "LHP" : "RHP") : "") };
    } else if (hasB) {
      val = { factor: 1, obp: null, batters, note: "lineup posted" };
    }
  } catch { /* leave neutral */ }
  _obpCache.set(k, val);
  return val;
}

// Travel & rest: fatigue nudges early offense down slightly (favours NRFI).
async function travelRest(teamId, todayStr, venueId) {
  if (teamId == null) return { factor: 1, note: "" };
  const k = teamId + ":" + todayStr;
  if (_travelCache.has(k)) return _travelCache.get(k);
  let val = { factor: 1, note: "settled" };
  try {
    const d0 = new Date(todayStr + "T12:00:00Z");
    const start = new Date(d0.getTime() - 3 * 864e5).toISOString().slice(0, 10);
    const d = await getJson("https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=" + teamId +
      "&startDate=" + start + "&endDate=" + todayStr + "&hydrate=venue");
    const games = [];
    (d.dates || []).forEach((dt) => (dt.games || []).forEach((g) => games.push({ date: dt.date, g })));
    const prev = games.filter((x) => x.date < todayStr).sort((a, b) => a.date.localeCompare(b.date)).pop();
    if (prev) {
      const restDays = Math.round((d0 - new Date(prev.date + "T12:00:00Z")) / 864e5);
      const prevVenue = prev.g.venue && prev.g.venue.id;
      const traveled = prevVenue && venueId && prevVenue !== venueId;
      if (restDays <= 1 && traveled) val = { factor: 0.93, note: "played yesterday + traveled" };
      else if (restDays <= 1) val = { factor: 0.98, note: "played yesterday" };
      else if (restDays >= 3) val = { factor: 1.03, note: restDays + " days rest" };
      else val = { factor: 1, note: restDays + "d rest" };
    }
  } catch { /* leave neutral */ }
  _travelCache.set(k, val);
  return val;
}

function weatherPark(game, homeAbbr) {
  const parkFactor = NRFI_PARK[homeAbbr] || 1;
  let wFactor = 1, note = "neutral park";
  const w = game.weather || {};
  const temp = w.temp != null ? Number(w.temp) : null;
  const cond = String(w.condition || "");
  const wind = String(w.wind || "");
  if (/Dome|Roof Closed/i.test(cond)) { wFactor = 0.97; note = "indoors"; }
  else {
    if (temp != null) {
      if (temp >= 92) wFactor *= 1.09;
      else if (temp >= 82) wFactor *= 1.05;
      else if (temp >= 56) { /* neutral band */ }
      else if (temp >= 46) wFactor *= 0.94;
      else wFactor *= 0.89;
    }
    // MLB wind string is field-relative ("Out To CF", "In From CF", "L To R").
    // Three tiers: light (5-11), moderate (12-19), strong (20+).
    const mph = Number((wind.match(/(\d+)/) || [])[1] || 0);
    if (mph >= 5) {
      if (/out to c/i.test(wind))       wFactor *= mph >= 20 ? 1.14 : mph >= 12 ? 1.09 : 1.05;
      else if (/in from c/i.test(wind)) wFactor *= mph >= 20 ? 0.87 : mph >= 12 ? 0.92 : 0.96;
      else if (/out to/i.test(wind))    wFactor *= mph >= 20 ? 1.07 : mph >= 12 ? 1.04 : 1.02;
      else if (/in from/i.test(wind))   wFactor *= mph >= 20 ? 0.94 : mph >= 12 ? 0.97 : 0.99;
      // crosswind at strong speeds: slight batter disadvantage (irregular movement)
      else if (mph >= 20 && /l to r|r to l/i.test(wind)) wFactor *= 0.98;
    }
    note = (temp != null ? temp + "°" : "") + (wind ? " · " + wind : "");
  }
  return { factor: parkFactor * wFactor, park: parkFactor, note: note || "neutral" };
}

function nrfiRegress(rate, sample, reg) {
  if (rate == null) return NRFI_LG_LAMBDA;
  return (rate * sample + NRFI_LG_LAMBDA * reg) / (sample + reg);
}
// log5-style matchup of an offense rate vs a pitcher rate around league mean
function halfNoRun(offLambda, pitLambda, env) {
  let lam = (offLambda * pitLambda) / NRFI_LG_LAMBDA;
  lam *= (env || 1);
  lam = nClamp(lam, 0.05, 1.9);
  return Math.pow(NRFI_LG_P0, lam / NRFI_LG_LAMBDA);
}

/* ---- Base-out simulation: model the actual batters through a base/out
   Markov chain vs the starter's outcome profile -> true P(no run). ---- */
// League-average per-PA outcome distribution (walk includes HBP).
const NRFI_LG_PA = { out: 0.685, bb: 0.085, s1: 0.140, s2: 0.045, s3: 0.004, hr: 0.033 };
// Per-PA/BF outcome rates from a raw stat line.
function paRates(st, denom) {
  const d = Number(denom || 0);
  if (!st || d <= 0) return null;
  const n = (x) => Number(x || 0);
  const bb = (n(st.baseOnBalls) + n(st.hitByPitch)) / d;
  const hr = n(st.homeRuns) / d;
  const s3 = n(st.triples) / d;
  const s2 = n(st.doubles) / d;
  const s1 = Math.max(0, n(st.hits) - n(st.doubles) - n(st.triples) - n(st.homeRuns)) / d;
  const out = Math.max(0, 1 - bb - hr - s3 - s2 - s1);
  return { out, bb, s1, s2, s3, hr };
}
// Log5 matchup of a batter vs a pitcher's allowed rates, normalized to sum 1.
function matchupPA(b, p, lg) {
  const keys = ["out", "bb", "s1", "s2", "s3", "hr"];
  const raw = {}; let sum = 0;
  for (const k of keys) { const v = lg[k] > 0 ? (b[k] * p[k]) / lg[k] : 0; raw[k] = v; sum += v; }
  if (sum <= 0) return Object.assign({}, lg);
  const o = {}; for (const k of keys) o[k] = raw[k] / sum;
  return o;
}
// Advance base/out state for one outcome. base = 3-bit (1=1B,2=2B,4=3B).
function advanceBaseOut(base, outs, o) {
  const r1 = base & 1, r2 = base & 2 ? 1 : 0, r3 = base & 4 ? 1 : 0, on1 = base & 1 ? 1 : 0;
  if (o === "out") return [base, outs + 1, 0];
  if (o === "bb") {
    if (on1 && r2 && r3) return [7, outs, 1];              // loaded -> forced run in
    if (on1 && r2) return [7, outs, 0];                    // 1st&2nd -> loaded
    if (on1) return [1 | 2 | (r3 ? 4 : 0), outs, 0];       // 1st occupied -> 1st&2nd(+3rd)
    return [1 | (r2 ? 2 : 0) | (r3 ? 4 : 0), outs, 0];     // batter to 1st
  }
  if (o === "s1") return [1 | (on1 ? 2 : 0), outs, r2 + r3];        // 2nd,3rd score; 1st->2nd
  if (o === "s2") return [2 | (on1 ? 4 : 0), outs, r2 + r3];        // 2nd,3rd score; 1st->3rd
  if (o === "s3") return [4, outs, on1 + r2 + r3];                  // all score; batter->3rd
  if (o === "hr") return [0, outs, on1 + r2 + r3 + 1];             // everyone + batter
  return [base, outs, 0];
}
// Probability the half-inning is scoreless, batting `batters` in order.
function simHalfNoRun(batters, pAllow, lg, maxBatters) {
  const N = maxBatters || 12;
  const keys = ["out", "bb", "s1", "s2", "s3", "hr"];
  let D = new Array(24).fill(0); D[0] = 1;   // bases empty, 0 outs
  let noRun = 0;
  for (let i = 0; i < N; i++) {
    const b = batters[i] || lg;
    const dist = matchupPA(b, pAllow, lg);
    const nd = new Array(24).fill(0);
    for (let s = 0; s < 24; s++) {
      const m = D[s]; if (m <= 0) continue;
      const base = Math.floor(s / 3), outs = s % 3;
      for (const o of keys) {
        const po = dist[o]; if (po <= 0) continue;
        const adv = advanceBaseOut(base, outs, o);
        if (adv[2] > 0) continue;                 // a run scored -> not scoreless
        if (adv[1] >= 3) noRun += m * po;         // 3 outs, still 0 runs
        else nd[adv[0] * 3 + adv[1]] += m * po;
      }
    }
    D = nd;
    if (D.reduce((a, x) => a + x, 0) < 1e-6) break;
  }
  return nClamp(noRun + D.reduce((a, x) => a + x, 0), 0.02, 0.98);
}

// Full research pass for one game -> probability + informative checks.
function nrfiEvaluate(ctx) {
  const awayOffBase = nrfiRegress(ctx.awayOff && ctx.awayOff.rate, (ctx.awayOff && ctx.awayOff.sample) || 0, NRFI_OFF_REG);
  const homeOffBase = nrfiRegress(ctx.homeOff && ctx.homeOff.rate, (ctx.homeOff && ctx.homeOff.sample) || 0, NRFI_OFF_REG);
  const awayPitBase = nrfiRegress(ctx.awayPit && ctx.awayPit.rate, (ctx.awayPit && ctx.awayPit.sample) || 0, NRFI_PIT_REG);
  const homePitBase = nrfiRegress(ctx.homePit && ctx.homePit.rate, (ctx.homePit && ctx.homePit.sample) || 0, NRFI_PIT_REG);

  // Platoon: each offense vs the opposing starter's hand. Recent form + skill peripherals per starter.
  const awayPlat = platoonFactor(ctx.awayOff, ctx.homeMeta && ctx.homeMeta.hand);
  const homePlat = platoonFactor(ctx.homeOff, ctx.awayMeta && ctx.awayMeta.hand);
  // Form: prefer FIP (removes defense noise) over ERA for last-3-start form.
  const awayForm = formFactor(ctx.awayMeta && ctx.awayMeta.form, ctx.awayMeta && ctx.awayMeta.fipForm);
  const homeForm = formFactor(ctx.homeMeta && ctx.homeMeta.form, ctx.homeMeta && ctx.homeMeta.fipForm);
  // Rest days: compute from game date vs pitcher's last start date.
  const gameDate = ctx.startUtc ? ctx.startUtc.slice(0, 10) : null;
  const awayRestDays = gameDate && ctx.awayMeta && ctx.awayMeta.lastStartDate
    ? Math.round((new Date(gameDate) - new Date(ctx.awayMeta.lastStartDate)) / 86400000) : null;
  const homeRestDays = gameDate && ctx.homeMeta && ctx.homeMeta.lastStartDate
    ? Math.round((new Date(gameDate) - new Date(ctx.homeMeta.lastStartDate)) / 86400000) : null;
  const awayRest = restFactor(awayRestDays);
  const homeRest = restFactor(homeRestDays);
  // Day game: games before ~4pm local (approximated as UTC < 20:00) run slightly higher scoring.
  const utcHour = ctx.startUtc ? new Date(ctx.startUtc).getUTCHours() : null;
  const isDayGame = utcHour != null && utcHour < 20;
  // Day game: backtest confirmed -4.3pp NRFI rate vs night (2,041 day / 1,974 night across 4,015 games).
  // A logit shift of -0.15 ≈ -3.5pp at p=0.50 — conservative vs the raw 4.3pp to avoid over-fitting.
  const dayGameShift = isDayGame ? 0.15 : 0;
  const awaySkill = pitchSkillFactor(ctx.awayPeri, ctx.lg);
  const homeSkill = pitchSkillFactor(ctx.homePeri, ctx.lg);
  const awayOpen = openerFactor(ctx.awayPit && ctx.awayPit.era, ctx.awayMeta && ctx.awayMeta.seasonEra);
  const homeOpen = openerFactor(ctx.homePit && ctx.homePit.era, ctx.homeMeta && ctx.homeMeta.seasonEra);
  const awayOpenG = openerGameFactor(ctx.awayMeta);
  const homeOpenG = openerGameFactor(ctx.homeMeta);
  const awayLoad = seasonLoadFactor(ctx.awayMeta && ctx.awayMeta.ip);
  const homeLoad = seasonLoadFactor(ctx.homeMeta && ctx.homeMeta.ip);

  // Blend each side's adjustments by DEVIATION-from-neutral (not raw product)
  // so correlated signals don't compound, then cap the net swing. Platoon weight
  // is lower now that lineups are measured directly vs the starter's hand.
  const offMult = (lineup, plat, travel) =>
    nClamp(1 + (lineup.factor - 1) * 1.0 + (plat.f - 1) * 0.4 + (travel.factor - 1) * 0.6, 0.80, 1.30);
  // Weights tuned from 4,015-game backtest (logistic regression on normalized features):
  // - skill (K%, BB%, barrel, GB): dominant after pitBase — keep at 1.0
  // - form (FIP/ERA L3): LR coeff -0.018 = counterproductive once pitBase controlled → cut to 0.10
  // - opener (1st-inn ERA vs season ERA): still useful signal → keep at 0.5
  // - openG (bullpen game pattern): strong → keep at 1.0
  // - load (season IP): small but logical → keep at 0.7
  // - rest: LR coeff -0.066, extra-rest games showed LOWER NRFI rate → cut to 0.10 (effectively off)
  const pitMult = (skill, form, opener, openG, load, rest) =>
    nClamp(1 + (skill.f - 1) * 1.0 + (form.f - 1) * 0.10 + (opener.f - 1) * 0.5 + (openG.f - 1) * 1.0 + (load.f - 1) * 0.7 + (rest.f - 1) * 0.10, 0.78, 1.25);
  const awayOff = awayOffBase * offMult(ctx.awayLineup, awayPlat, ctx.awayTravel);
  const homeOff = homeOffBase * offMult(ctx.homeLineup, homePlat, ctx.homeTravel);
  const awayPit = awayPitBase * pitMult(awaySkill, awayForm, awayOpen, awayOpenG, awayLoad, awayRest);
  const homePit = homePitBase * pitMult(homeSkill, homeForm, homeOpen, homeOpenG, homeLoad, homeRest);
  const umpFactor = ctx.umpFactor || 1;
  const env = nClamp(1 + (ctx.wx.factor - 1) + (umpFactor - 1), 0.85, 1.20);
  // λ-model (fallback when we don't have posted batters + pitcher allow-rates).
  let p0top = halfNoRun(awayOff, homePit, env); // away bats vs home starter
  let p0bot = halfNoRun(homeOff, awayPit, env); // home bats vs away starter
  let method = "model";
  const awayB = ctx.awayLineup && ctx.awayLineup.batters;
  const homeB = ctx.homeLineup && ctx.homeLineup.batters;
  const homeAllow = ctx.homeMeta && ctx.homeMeta.allow;
  const awayAllow = ctx.awayMeta && ctx.awayMeta.allow;
  if (awayB && homeAllow && homeB && awayAllow) {
    // Base-out simulation captures matchup + lineup + platoon + pitcher skill
    // from the raw rates. Apply only what the season rates DON'T contain:
    // recent form, opener/bullpen, travel, and park/weather/umpire.
    // Form weight 0.10 (down from 0.6) matches lambda path — backtest LR showed form counterproductive.
    const homeCtx = nClamp(1 + (homeForm.f - 1) * 0.10 + (homeOpen.f - 1) * 0.5 + (homeOpenG.f - 1) * 1.0 + (homeLoad.f - 1) * 0.7, 0.82, 1.2);
    const awayCtx = nClamp(1 + (awayForm.f - 1) * 0.10 + (awayOpen.f - 1) * 0.5 + (awayOpenG.f - 1) * 1.0 + (awayLoad.f - 1) * 0.7, 0.82, 1.2);
    const s0top = simHalfNoRun(awayB, homeAllow, NRFI_LG_PA);
    const s0bot = simHalfNoRun(homeB, awayAllow, NRFI_LG_PA);
    const pRunTop = nClamp((1 - s0top) * homeCtx * ctx.awayTravel.factor * env, 0.02, 0.97);
    const pRunBot = nClamp((1 - s0bot) * awayCtx * ctx.homeTravel.factor * env, 0.02, 0.97);
    p0top = 1 - pRunTop; p0bot = 1 - pRunBot; method = "sim";
  }
  // Apply day game logit shift (day games historically run ~2pp higher scoring).
  const logit = (p) => Math.log(p / (1 - p));
  const unlogit = (x) => 1 / (1 + Math.exp(-x));
  const rawNRFI = p0top * p0bot;
  const pNRFI = dayGameShift > 0
    ? nClamp(unlogit(logit(nClamp(rawNRFI, 0.02, 0.98)) - dayGameShift), 0.02, 0.98)
    : rawNRFI;

  // Data-confidence: a decisive number on missing inputs isn't a real edge.
  let conf = 1;
  const thin = (p) => !p || (p.sample || 0) < 6;
  if (thin(ctx.awayPit)) conf -= 0.2;
  if (thin(ctx.homePit)) conf -= 0.2;
  if (!ctx.awayOff) conf -= 0.1;
  if (!ctx.homeOff) conf -= 0.1;
  if (ctx.awayLineup.obp == null) conf -= 0.12;
  if (ctx.homeLineup.obp == null) conf -= 0.12;
  if (ctx.awayPeri == null) conf -= 0.05;
  if (ctx.homePeri == null) conf -= 0.05;
  if (!ctx.awayRolling) conf -= 0.04;
  if (!ctx.homeRolling) conf -= 0.04;
  conf = nClamp(conf, 0, 1);

  const lean = (v, hi, lo) => (v >= hi ? "yrfi" : v <= lo ? "nrfi" : "neutral");
  const facLean = (f) => (f >= 1.05 ? "yrfi" : f <= 0.96 ? "nrfi" : "neutral");
  const hand = (m) => (m && m.hand ? " (" + m.hand + "HP)" : "");
  const checks = [
    { label: "Starting pitching (1st inning)",
      detail: ctx.homePP + hand(ctx.homeMeta) + " " + awayPit0(ctx.homePit) + " · " + ctx.awayPP + hand(ctx.awayMeta) + " " + awayPit0(ctx.awayPit),
      lean: lean((awayPitBase + homePitBase) / 2, 0.6, 0.42) },
    { label: "Pitcher skill (K/BB/barrel/GB)",
      detail: ctx.homePP + ": " + homeSkill.note + " · " + ctx.awayPP + ": " + awaySkill.note,
      lean: facLean((awaySkill.f + homeSkill.f) / 2) },
    { label: "Opener / bullpen game",
      detail: ctx.homePP + ": " + homeOpenG.note + " · " + ctx.awayPP + ": " + awayOpenG.note,
      lean: (awayOpenG.opener || homeOpenG.opener) ? "nrfi" : "neutral" },
    { label: "Starter recent form",
      detail: ctx.homePP + ": " + homeForm.note + " · " + ctx.awayPP + ": " + awayForm.note,
      lean: facLean((awayForm.f + homeForm.f) / 2) },
    { label: "Clean opener vs slow starter",
      detail: ctx.homePP + ": " + homeOpen.note + " · " + ctx.awayPP + ": " + awayOpen.note,
      lean: facLean((awayOpen.f + homeOpen.f) / 2) },
    { label: "1st-inning offense",
      detail: ctx.awayName + " " + rate2(ctx.awayOff) + " R · " + ctx.homeName + " " + rate2(ctx.homeOff) + " R",
      lean: lean((awayOffBase + homeOffBase) / 2, 0.6, 0.44) },
    { label: "Platoon / handedness",
      detail: ctx.awayName + ": " + awayPlat.note + " · " + ctx.homeName + ": " + homePlat.note,
      lean: facLean((awayPlat.f + homePlat.f) / 2) },
    { label: "Lineups (leadoff-weighted)",
      detail: ctx.awayName + ": " + ctx.awayLineup.note + " · " + ctx.homeName + ": " + ctx.homeLineup.note,
      lean: facLean((ctx.awayLineup.factor + ctx.homeLineup.factor) / 2) },
    { label: "Travel & rest",
      detail: ctx.awayName + ": " + ctx.awayTravel.note + " · " + ctx.homeName + ": " + ctx.homeTravel.note,
      lean: (ctx.awayTravel.factor * ctx.homeTravel.factor) < 0.97 ? "nrfi" : "neutral" },
    { label: "Pitcher season load",
      detail: ctx.homePP + ": " + (homeLoad.note || "normal") + " · " + ctx.awayPP + ": " + (awayLoad.note || "normal"),
      lean: (awayLoad.f >= 1.03 || homeLoad.f >= 1.03) ? "yrfi" : "neutral" },
    (awayRest.note || homeRest.note) ? { label: "Pitcher rest days",
      detail: [ctx.awayPP + ": " + (awayRest.note || "normal rest"), ctx.homePP + ": " + (homeRest.note || "normal rest")].join(" · "),
      lean: (awayRest.f >= 1.05 || homeRest.f >= 1.05) ? "yrfi" : "neutral" } : null,
    isDayGame ? { label: "Day game", detail: "Daytime first pitch — historically ~2pp higher scoring vs night games", lean: "yrfi" } : null,
    { label: "Weather & park", detail: ctx.wx.note, lean: facLean(ctx.wx.factor) },
    { label: "Umpire",
      detail: ctx.umpName ? (ctx.umpName + (ctx.umpNote ? " — " + ctx.umpNote : (umpFactor === 1 ? " (tendency n/a)" : ""))) : "not posted",
      lean: umpFactor <= 0.97 ? "nrfi" : umpFactor >= 1.03 ? "yrfi" : "neutral" },
    (() => {
      const aLast = ctx.awayRolling && ctx.awayRolling.lastClean;
      const hLast = ctx.homeRolling && ctx.homeRolling.lastClean;
      if (aLast == null && hLast == null) return null;
      const notes = [
        aLast != null ? ctx.awayPP + ": last start " + (aLast ? "clean ✓" : "allowed run ✗") : null,
        hLast != null ? ctx.homePP + ": last start " + (hLast ? "clean ✓" : "allowed run ✗") : null,
      ].filter(Boolean);
      const bothClean = aLast === true && hLast === true;
      const bothDirty = aLast === false && hLast === false;
      return { label: "Last start momentum", detail: notes.join(" · "),
        lean: bothClean ? "nrfi" : bothDirty ? "yrfi" : "neutral" };
    })(),
    (() => {
      const aL10 = ctx.awayRolling && ctx.awayRolling.l10 && ctx.awayRolling.l10.n >= 5 ? ctx.awayRolling.l10.pct : null;
      const hL10 = ctx.homeRolling && ctx.homeRolling.l10 && ctx.homeRolling.l10.n >= 5 ? ctx.homeRolling.l10.pct : null;
      const aSzn = ctx.awayRolling && ctx.awayRolling.szn ? ctx.awayRolling.szn.pct : null;
      const hSzn = ctx.homeRolling && ctx.homeRolling.szn ? ctx.homeRolling.szn.pct : null;
      if (aL10 == null && hL10 == null) return null;
      const notes = [];
      const diffs = [];
      if (aL10 != null) {
        const diff = aSzn != null ? aL10 - aSzn : null;
        const arrow = diff == null ? "" : diff >= 10 ? " ↑hot" : diff <= -10 ? " ↓cold" : "";
        notes.push(ctx.awayPP + ": L10 " + aL10 + "%" + arrow + (aSzn != null ? " (SZN " + aSzn + "%)" : ""));
        if (diff != null) diffs.push(diff);
      }
      if (hL10 != null) {
        const diff = hSzn != null ? hL10 - hSzn : null;
        const arrow = diff == null ? "" : diff >= 10 ? " ↑hot" : diff <= -10 ? " ↓cold" : "";
        notes.push(ctx.homePP + ": L10 " + hL10 + "%" + arrow + (hSzn != null ? " (SZN " + hSzn + "%)" : ""));
        if (diff != null) diffs.push(diff);
      }
      const anyDown = diffs.some(d => d <= -15);
      const allUp = diffs.length > 0 && diffs.every(d => d >= 10);
      return { label: "Pitcher L10 clean rate", detail: notes.join(" · "),
        lean: anyDown ? "yrfi" : allUp ? "nrfi" : "neutral" };
    })(),
    (() => {
      const aBT = pitcherBT(ctx.awayPP);
      const hBT = pitcherBT(ctx.homePP);
      if (!aBT && !hBT) return null;
      const notes = [];
      if (aBT) notes.push(ctx.awayPP + ": " + aBT.clean + "% clean (" + aBT.n + "gs, " + aBT.tier + ")");
      if (hBT) notes.push(ctx.homePP + ": " + hBT.clean + "% clean (" + hBT.n + "gs, " + hBT.tier + ")");
      const vals = [aBT, hBT].filter(Boolean);
      const avgClean = vals.reduce((s, b) => s + b.clean, 0) / vals.length;
      return { label: "Backtest profile", detail: notes.join(" · "),
        lean: avgClean >= 68 ? "nrfi" : avgClean <= 33 ? "yrfi" : "neutral" };
    })(),
  ].filter(Boolean);
  const call = pNRFI >= 0.5 ? "nrfi" : "yrfi";
  const nonNeutral = checks.filter((c) => c.lean !== "neutral");
  const agree = nonNeutral.filter((c) => c.lean === call).length;
  const pitProfiles = {
    away: { name: ctx.awayPP, pid: ctx.awayPPId, hand: ctx.awayMeta && ctx.awayMeta.hand, ...pitcherI01Profile(ctx.awayPit, ctx.awayMeta && ctx.awayMeta.seasonEra, ctx.awayRolling, ctx.awayPeri) },
    home: { name: ctx.homePP, pid: ctx.homePPId, hand: ctx.homeMeta && ctx.homeMeta.hand, ...pitcherI01Profile(ctx.homePit, ctx.homeMeta && ctx.homeMeta.seasonEra, ctx.homeRolling, ctx.homePeri) },
  };
  return { pNRFI, checks, aligned: { agree, total: nonNeutral.length }, confidence: conf, method, pitProfiles };
}
const rate2 = (o) => (o && o.rate != null ? o.rate.toFixed(2) : "—");
const awayPit0 = (o) => (o && o.rate != null ? o.rate.toFixed(2) + " R/1st" : "TBD");

// League-average first-inning rates (derived from model constants + MLB averages).
const I01_LG = { rate: 0.52, whip: 1.28, k9: 8.4, bb9: 3.1, hr9: 1.10 };

// Composite first-inning pitcher grade: A+/A/B+/B/C/D/F with supporting stats.
// peri = Statcast data { fstrike, whiff, barrel, gb, k, bb } — improves grade accuracy.
function pitcherI01Profile(pit, seasonEra, rolling, peri) {
  if (!pit || !pit.sample) return { grade: "—", score: 50, cleanPct: null, summary: "no first-inning data", fstrike: null, whiff: null };
  const cl = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  let score = 50;
  if (pit.rate  != null) score += cl((I01_LG.rate - pit.rate)   / I01_LG.rate,  -1,  1) * 25;
  if (pit.whip  != null) score += cl((I01_LG.whip - pit.whip)   / I01_LG.whip,  -1,  1) * 15;
  if (pit.k9    != null) score += cl((pit.k9   - I01_LG.k9)     / I01_LG.k9,    -1,  1) * 10;
  if (pit.bb9   != null) score += cl((I01_LG.bb9 - pit.bb9)     / I01_LG.bb9,   -1,  1) * 10;
  if (pit.hr9   != null) score += cl((I01_LG.hr9 - pit.hr9)     / I01_LG.hr9,  -0.5, 0.5) * 5;
  // Statcast: FPS% (get-ahead rate) and whiff% (swing-and-miss) add 15 pts total headroom.
  if (peri && peri.fstrike != null) score += cl((peri.fstrike - 60) / 60, -1, 1) * 8;
  if (peri && peri.whiff   != null) score += cl((peri.whiff - 24.5) / 24.5, -1, 1) * 7;
  score = cl(Math.round(score), 0, 100);
  const grade = score >= 84 ? "A+" : score >= 74 ? "A" : score >= 63 ? "B+" : score >= 52 ? "B" : score >= 42 ? "C" : score >= 30 ? "D" : "F";
  const gradeColor = score >= 74 ? "var(--moss)" : score >= 52 ? "var(--amber)" : "var(--rose)";
  const cleanPct = Math.round(Math.exp(-pit.rate) * 100);
  let vsNote = "";
  if (seasonEra != null && pit.era != null) {
    const diff = pit.era - seasonEra;
    if      (diff <= -1.2) vsNote = " · dominant in 1st vs season";
    else if (diff <= -0.4) vsNote = " · cleaner in 1st than overall";
    else if (diff >=  1.2) vsNote = " · slow starter vs season";
    else if (diff >=  0.4) vsNote = " · slightly worse in 1st";
  }
  const parts = [
    pit.sample + " starts",
    pit.rate   != null ? pit.rate.toFixed(2)  + " R/1st"  : null,
    pit.whip   != null ? "WHIP "  + pit.whip.toFixed(2)   : null,
    pit.k9     != null ? "K/9 "   + pit.k9.toFixed(1)     : null,
    pit.bb9    != null ? "BB/9 "  + pit.bb9.toFixed(1)    : null,
    pit.hr9    != null ? "HR/9 "  + pit.hr9.toFixed(2)    : null,
    "~" + cleanPct + "% clean",
    peri && peri.fstrike != null ? "FPS " + peri.fstrike.toFixed(0) + "%" : null,
    peri && peri.whiff   != null ? "Whiff " + peri.whiff.toFixed(0) + "%" : null,
  ].filter(Boolean);
  return { grade, gradeColor, score, cleanPct, summary: parts.join("  ·  "), vsNote, rolling: rolling || null,
    k9: pit.k9 ?? null, bb9: pit.bb9 ?? null, whip: pit.whip ?? null, rate: pit.rate ?? null, sample: pit.sample,
    fstrike: peri ? (peri.fstrike ?? null) : null, whiff: peri ? (peri.whiff ?? null) : null };
}

// Kelly criterion fraction for an NRFI or YRFI bet.
// Returns full Kelly as a decimal (e.g. 0.08 = 8% of bankroll). Cap at 0.25.
function kellyNRFI(pModel, yesPrice, call) {
  if (!yesPrice || yesPrice <= 0 || yesPrice >= 100) return null;
  const noPrice = 100 - yesPrice;
  const p = call === "NRFI" ? pModel : 1 - pModel;
  const b = call === "NRFI" ? yesPrice / noPrice : noPrice / yesPrice;
  const f = (p * b - (1 - p)) / b;
  return f > 0 ? Math.min(f, 0.25) : null;
}

function nrfiTier(pMax) {
  return pMax >= 70 ? { t: "STRONGEST", cls: "t-strongest", c: "var(--moss)" }
    : pMax >= 63 ? { t: "STRONG", cls: "t-strong", c: "var(--moss)" }
    : pMax >= 57 ? { t: "LEAN", cls: "t-lean", c: "var(--amber)" }
    : { t: "TOSS-UP", cls: "", c: "var(--dim)" };
}

// Backtest v5: 4,015 games (2025 full season + 2026 Apr 1 – Aug 13).
// AUC-ROC: 0.6188. Brier skill score: +4.6% over naive baseline.
// 2025 bias: +0.0pp (perfect). 2026 bias: +2.1pp (model slightly conservative).
// Combined: model under-predicts by ~1pp → keep c=0.050 logit shift.
// Win rates: pMax≥63 = 67.4% (479 bets); pMax≥70 = 75.9% (79 bets).
// Key tuning from LR: form weight 0.4→0.10, rest weight 0.8→0.10, day-game shift 0.025→0.15.
// Live calibration takes over after 25 graded picks.
const NRFI_CALIB_SEED = { c: 0.050, n: 4015, active: true, source: "backtest-v5" };

// Pitcher backtest rankings — 4,015 MLB games (2025 full + 2026 Apr 1 – Aug 13).
// clean = % of 1st innings kept scoreless. n = starts evaluated.
// tier: "elite" ≥70%, "sharp" 65-69%, "leaky" 30-35%, "danger" <30%.
const PITCHER_BT = (() => {
  const t = {};
  const add = (name, clean, n, tier) => { t[name.toLowerCase()] = { clean, n, tier }; };
  // ── ELITE (≥70% clean 1st innings) ──
  add("Keider Montero",      83, 12, "elite");
  add("Logan Henderson",     73, 15, "elite"); // v5: revised down from 82%(11)
  add("Chris Sale",          76, 41, "elite");
  add("Paul Skenes",         77, 30, "elite");
  add("Gerrit Cole",         75, 16, "elite"); // v5: revised from 79%(14)
  add("Casey Mize",          75, 16, "elite");
  add("Shohei Ohtani",       70, 30, "elite"); // v5: revised down from 75%(12)
  add("Nathan Eovaldi",      75, 20, "elite");
  add("Ranger Suárez",       75, 24, "elite");
  add("Ranger Suarez",       75, 24, "elite");
  add("Gavin Williams",      73, 22, "elite");
  add("Kyle Leahy",          75, 24, "elite"); // v5: revised up from 73%(22)
  add("Jake Bennett",        71, 14, "elite"); // v5: NEW
  add("Tarik Skubal",        72, 32, "elite"); // v5: revised from 70%(30)
  add("Noah Cameron",        71, 21, "elite");
  add("Shane Drohan",        71, 14, "elite");
  add("Logan Webb",          71, 17, "elite");
  add("Griffin Jax",         71, 17, "elite");
  add("Landen Roupp",        70, 20, "elite");
  add("Hunter Brown",        70, 10, "elite");
  add("Carmen Mlodzinski",   70, 10, "elite");
  // ── SHARP (65-69%) ──
  add("Trevor Rogers",       69, 39, "sharp"); // v5: revised down from 72%(18) — demoted from ELITE
  add("Jared Jones",         69, 13, "sharp"); // v5: NEW
  add("Gage Jump",           69, 16, "sharp"); // v5: NEW
  add("Christian Scott",     69, 16, "sharp"); // v5: NEW
  add("Bowden Francis",      69, 13, "sharp");
  add("Edward Cabrera",      69, 13, "sharp");
  add("Michael Wacha",       68, 28, "sharp");
  add("Tyler Glasnow",       67, 15, "sharp");
  add("Ryan Bergert",        67, 15, "sharp");
  add("Janson Junk",         69, 32, "sharp"); // v5: revised from 67%(15)
  add("Quinn Priester",      65, 23, "sharp");
  add("Tanner Bibee",        65, 31, "sharp");
  add("Tyler Mahle",         64, 14, "sharp");
  add("Jesús Luzardo",       63, 19, "sharp");
  add("Jesus Luzardo",       63, 19, "sharp");
  // ── LEAKY (30-35%) ──
  add("Zac Gallen",          31, 48, "leaky"); // worst in BOTH seasons
  add("J.T. Ginn",           31, 16, "leaky");
  add("Joey Cantillo",       31, 13, "leaky");
  add("Mitchell Parker",     33, 27, "leaky");
  add("Tyler Anderson",      32, 25, "leaky");
  add("Clayton Kershaw",     30, 20, "leaky");
  add("Justin Wrobleski",    25, 20, "leaky"); // v5: revised from 26%(19)
  add("Adrian Houser",       27, 15, "leaky");
  add("Tomoyuki Sugano",     29, 48, "leaky"); // v5: major revision up from 20%(20) — promoted from DANGER
  // ── DANGER (<30%) ──
  add("Carson Whisenhunt",    9, 11, "danger"); // v5: NEW
  add("Stephen Kolek",       10, 10, "danger");
  add("Hunter Dobbins",      18, 11, "danger");
  add("Bradley Blalock",     18, 11, "danger");
  add("Reynaldo López",      20, 10, "danger");
  add("Reynaldo Lopez",      20, 10, "danger");
  add("Kumar Rocker",        20, 20, "danger");
  add("Joe Boyle",           23, 13, "danger"); // v5: NEW
  add("Carson Palmquist",    25, 12, "danger"); // v5: NEW
  add("Luinder Avila",       27, 11, "danger"); // v5: NEW
  add("Luis Gil",            28, 18, "danger"); // v5: NEW
  add("Cam Schlittler",      21, 14, "danger");
  add("David Peterson",      21, 14, "danger");
  add("Eric Lauer",          21, 14, "danger");
  add("Zebby Matthews",      23, 13, "danger");
  add("Jonathan Cannon",     27, 15, "danger");
  return t;
})();
function pitcherBT(name) {
  if (!name) return null;
  return PITCHER_BT[name.toLowerCase()] || null;
}

// Empirical calibration: once enough calls are graded, shift the model's
// probabilities (in logit space) so its average prediction matches the actual
// NRFI hit rate — i.e. make "70%" really mean 70%. Uses the RAW model pNRFI
// logged per pick vs whether the 1st was scoreless. Inactive under 25 games,
// and shrunk by sample size so it can't overcorrect early.
function nrfiCalibration(record) {
  const g = (record || []).filter((e) => e.pNRFI != null && e.firstInningRuns != null);
  if (g.length < 25) return { c: 0, n: g.length, active: false };
  const cp = (x) => nClamp(x, 0.05, 0.95);
  const meanPred = g.reduce((s, e) => s + e.pNRFI, 0) / g.length;
  const actual = g.filter((e) => e.firstInningRuns === 0).length / g.length;
  const shrink = Math.min(1, g.length / 100);
  const c = nClamp((logit(cp(actual)) - logit(cp(meanPred))) * shrink, -0.6, 0.6);
  return { c, n: g.length, active: true };
}
function applyCalibration(pNRFI, calib) {
  if (!calib || !calib.active) return pNRFI;
  return nClamp(unlogit(logit(nClamp(pNRFI, 0.02, 0.98)) + calib.c), 0.02, 0.98);
}

// Market-as-prior: the de-vig market (efficient) is the anchor; the model only
// nudges it. "Our number" = market + BLEND*(model − market). The wager still
// triggers on the model's raw divergence from the market (the value gate), but
// the displayed probability is honestly market-anchored.
// Backtest v5 (4,015 games): model under-predicts at high confidence — 2026 pMax≥70
// was 75.9% actual (79 bets). More model weight at top end so market pull
// doesn't drag sharp predictions back toward noise.
const NRFI_BLEND = 0.35;
function nrfiBlend(pModel, marketNRFI) {
  if (marketNRFI == null) return pModel;      // no market -> pure model
  const pMkt = marketNRFI / 100;
  const blend = pModel >= 0.68 ? 0.65 : pModel >= 0.62 ? 0.58 : pModel >= 0.57 ? 0.45 : NRFI_BLEND;
  return nClamp(pMkt + blend * (pModel - pMkt), 0.02, 0.98);
}

// Plain-English "what to do" for a game: turns model confidence + check
// consensus into an obvious BET / LEAN / PASS call in one line.
function nrfiVerdict(r) {
  const p = r.pMax;                       // model confidence on the called side
  const side = r.call;                    // "NRFI" | "YRFI"
  const outcome = side === "NRFI" ? "No run scores in the 1st" : "A run scores in the 1st";
  const ORDER = ["PASS", "LEAN", "BET", "STRONG"];
  const down = (s, n) => ORDER[Math.max(0, ORDER.indexOf(s) - n)];

  // 1) Raw strength from the probability alone.
  let strength = p >= 70 ? "STRONG" : p >= 63 ? "BET" : p >= 57 ? "LEAN" : "PASS";
  const notes = [];

  // 2) Consensus gate: a decisive number with split signals is fragile.
  const total = r.aligned ? r.aligned.total : 0;
  const agree = r.aligned ? r.aligned.agree : 0;
  const frac = total ? agree / total : 1;
  if (total >= 3 && frac < 0.5 && strength !== "PASS") { strength = down(strength, 1); notes.push("signals split"); }

  // 3) Confidence gate: don't fire a strong wager on missing data.
  const conf = r.confidence != null ? r.confidence : 1;
  if (conf < 0.35) { strength = "PASS"; notes.push("thin data"); }
  else if (conf < 0.55 && (strength === "STRONG" || strength === "BET")) { strength = "LEAN"; notes.push("limited data"); }
  // STRONG demands both high confidence AND strong agreement.
  if (strength === "STRONG" && !(conf >= 0.7 && frac >= 0.6)) { strength = "BET"; notes.push("not full confidence"); }

  // 4) Value gate: a great matchup at an efficient/short price is NOT a wager.
  // The probability stays model-only; the market only decides if there's value.
  if (r.market) {
    const edge = r.market.edge;           // model% - market% on our side
    const mktProb = r.market.marketSide;  // market's implied % on our side
    if (edge < 2) { strength = "PASS"; notes.push("market efficient — no value"); }
    else if (mktProb >= 62 && edge < 5) { strength = "PASS"; notes.push("juice too short"); }
    else if ((strength === "STRONG" || strength === "BET") && edge < 3) { strength = down(strength, 1); notes.push("thin value"); }
    else if (edge >= 3) notes.push("value +" + edge.toFixed(0) + "% vs market");
  }

  const isBet = strength === "STRONG" || strength === "BET";
  const label = strength === "STRONG" ? "★ BET " + side
    : strength === "BET" ? "BET " + side
    : strength === "LEAN" ? "Lean " + side
    : "Pass — too close";
  const color = isBet ? "var(--moss)" : strength === "LEAN" ? "var(--amber)" : "var(--dim)";
  const word = strength === "STRONG" ? "strong" : strength === "BET" ? "solid" : strength === "LEAN" ? "slight" : "no";
  const confLbl = conf >= 0.8 ? "high" : conf >= 0.55 ? "medium" : "low";
  const al = total ? " " + agree + "/" + total + " checks agree." : "";
  const tail = " Confidence: " + confLbl + "." + (notes.length ? " (" + notes.join("; ") + ")" : "");
  const blurb = (strength === "PASS"
    ? outcome + " only " + p.toFixed(0) + "% — basically a coin flip." + al
    : outcome + " — " + p.toFixed(0) + "% (" + word + " lean)." + al) + tail;
  return { strength, side, isBet, label, color, blurb, confLbl };
}

// Match one of NRFIKINGKY's picks to a scheduled game by team-name overlap.
function nrfiTokens(name) {
  return String(name || "").toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter((w) => w.length >= 3);
}
function nrfiTeamMatch(a, b) {
  const A = nrfiTokens(a), B = nrfiTokens(b);
  return A.some((w) => B.includes(w));
}
function matchKingPick(row, kingOpen) {
  for (const kp of kingOpen || []) {
    if ((kp.teams || []).length !== 2) continue;
    const hitAway = kp.teams.some((t) => nrfiTeamMatch(t, row.away));
    const hitHome = kp.teams.some((t) => nrfiTeamMatch(t, row.home));
    if (hitAway && hitHome) return kp;
  }
  return null;
}

// Scan today's MLB slate and run the research pass on every game.
async function scanNrfi(onProgress) {
  const season = new Date().getUTCFullYear();
  const date = today();
  const [sch, whiffRes, umpRes] = await Promise.all([
    getJson("https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=" + date +
      "&hydrate=probablePitcher,linescore,team,lineups,weather,venue,officials"),
    fetch("/api/desk/savant").then((r) => r.json()).catch(() => null),
    fetch("/api/desk/umpires").then((r) => r.json()).catch(() => null),
  ]);
  const periById = (whiffRes && whiffRes.byId) || {};
  const lg = (whiffRes && whiffRes.lg) || { k: 22, bb: 8, barrel: 7.5, gb: 44, whiff: 24.5, fstrike: 60 };
  const umpTable = (umpRes && umpRes.umpires) || {};
  const games = (sch.dates && sch.dates[0] && sch.dates[0].games) || [];
  let done = 0;
  const rows = await mapLimit(games, 4, async (g) => {
    const away = g.teams && g.teams.away, home = g.teams && g.teams.home;
    const awayPP = away && away.probablePitcher, homePP = home && home.probablePitcher;
    const lu = g.lineups || {};
    const [awayPit, homePit, awayMeta, homeMeta, awayRolling, homeRolling, awayOff, homeOff, awayTravel, homeTravel] =
      await Promise.all([
        pitcherFirstInning(awayPP && awayPP.id, season),
        pitcherFirstInning(homePP && homePP.id, season),
        pitcherMeta(awayPP && awayPP.id, season),
        pitcherMeta(homePP && homePP.id, season),
        pitcherRollingNRFI(awayPP && awayPP.id, season),
        pitcherRollingNRFI(homePP && homePP.id, season),
        teamOffenseSplits(away && away.team && away.team.id, season),
        teamOffenseSplits(home && home.team && home.team.id, season),
        travelRest(away && away.team && away.team.id, date, g.venue && g.venue.id),
        travelRest(home && home.team && home.team.id, date, g.venue && g.venue.id),
      ]);
    // Lineups vs the opposing starter's hand (needs the hands resolved first).
    const [awayLineup, homeLineup] = await Promise.all([
      topOrderStrength(lu.awayPlayers, season, homeMeta && homeMeta.hand, homeMeta && homeMeta.id),
      topOrderStrength(lu.homePlayers, season, awayMeta && awayMeta.hand, awayMeta && awayMeta.id),
    ]);
    const wx = weatherPark(g, home && home.team && home.team.abbreviation);
    const hpUmp = (g.officials || []).find((o) => o.officialType === "Home Plate");
    const umpName = hpUmp && hpUmp.official && hpUmp.official.fullName;
    const umpEntry = umpName ? umpTable[umpName] : null;
    const ctx = {
      awayName: away && away.team && away.team.name, homeName: home && home.team && home.team.name,
      awayPP: (awayPP && awayPP.fullName) || "TBD", homePP: (homePP && homePP.fullName) || "TBD",
      awayPPId: awayPP && awayPP.id, homePPId: homePP && homePP.id,
      awayOff, homeOff, awayPit, homePit, awayMeta, homeMeta,
      awayLineup, homeLineup, awayTravel, homeTravel, wx,
      awayRolling, homeRolling,
      awayPeri: awayPP ? periById[awayPP.id] : null,
      homePeri: homePP ? periById[homePP.id] : null,
      lg,
      umpName: umpName || null, umpFactor: umpEntry ? umpEntry.runFactor : 1, umpNote: umpEntry ? umpEntry.note : "",
      startUtc: g.gameDate || null,
    };
    const ev = nrfiEvaluate(ctx);
    const ls = g.linescore || {};
    const inn1 = (ls.innings || [])[0];
    const state = g.status && g.status.abstractGameState;
    done++; if (onProgress) onProgress(done, games.length);
    return {
      gamePk: g.gamePk, date, startUtc: g.gameDate,
      away: ctx.awayName, home: ctx.homeName,
      awayAbbr: away && away.team && away.team.abbreviation, homeAbbr: home && home.team && home.team.abbreviation,
      awayPP: ctx.awayPP, homePP: ctx.homePP,
      pNRFI: ev.pNRFI, pYRFI: 1 - ev.pNRFI, checks: ev.checks, aligned: ev.aligned, confidence: ev.confidence, method: ev.method, pitProfiles: ev.pitProfiles, parkEnv: ctx.wx,
      awayYrfiPct: awayOff && awayOff.rate != null ? Math.round((1 - Math.exp(-awayOff.rate)) * 100) : null,
      homeYrfiPct: homeOff && homeOff.rate != null ? Math.round((1 - Math.exp(-homeOff.rate)) * 100) : null,
      awayOffSample: awayOff ? awayOff.sample : null,
      homeOffSample: homeOff ? homeOff.sample : null,
      hasPitchers: !!(awayPP && awayPP.id && homePP && homePP.id),
      dataOk: !!(awayOff && homeOff && awayPit && homePit),
      lineupPosted: (ctx.awayLineup.obp != null && ctx.homeLineup.obp != null),
      state, currentInning: ls.currentInning || 0,
      inning1runs: inn1 ? (Number((inn1.away && inn1.away.runs) || 0) + Number((inn1.home && inn1.home.runs) || 0)) : null,
      final: state === "Final",
    };
  });
  return rows;
}

// Kalshi's own first-inning market (series KXMLBRFI). YES = a run scores, so
// market NRFI% = 100 - yes price. Lets the model be checked against the market.
async function fetchKalshiRFI() {
  const root = "https://api.elections.kalshi.com/trade-api/v2";
  try {
    const r = await fetch(px(root + "/markets?series_ticker=KXMLBRFI&status=open&limit=200"));
    if (!r.ok) return [];
    const d = await r.json();
    return (d.markets || [])
      .map((raw) => {
        const m = kaMarket(raw);
        if (!m || m.price == null || m.price <= 0) return null;
        // KXMLBRFI has no SERIES_SLUG entry, so kalshiEventLink returns the series
        // homepage for every game. Instead build a direct per-game link from the
        // event_ticker the API returns — Kalshi's /events/ URL always resolves correctly.
        const eventTicker = raw.event_ticker || raw.ticker || m.id;
        const link = "https://kalshi.com/events/" + eventTicker.toLowerCase();
        return { ticker: m.id, link, date: tickerDate(m.id), codes: teamCodes(m.id), yesPrice: m.price, marketNRFI: 100 - m.price };
      })
      .filter(Boolean);
  } catch { return []; }
}
// Match a Kalshi RFI market to a scheduled game by ET date + both team codes.
function matchRFI(row, list) {
  const rd = String(row.date || "").replace(/-/g, "");
  for (const k of list || []) {
    if (k.date && rd && k.date !== rd) continue;
    if (codeHit(k.codes, [row.awayAbbr, row.homeAbbr]) >= 1.2) return k;
  }
  return null;
}

function FirstInning() {
  const [rows, setRows] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [rec, setRec] = useState(null);
  const [phase, setPhase] = useState("idle");
  const [prog, setProg] = useState(null);
  const [err, setErr] = useState(null);
  const [open, setOpen] = useState({});
  const [rfi, setRfi] = useState([]);
  const recRef = useRef(null);
  const priceSnap = useRef({});
  const refreshedFor = useRef(new Set());
  const [bankroll, setBankroll] = useState(null);
  const [riskLevel, setRiskLevel] = useState("moderate");
  const [profitGoal, setProfitGoal] = useState(null);
  const [growthSpeed, setGrowthSpeed] = useState("steady");
  const [amountOut, setAmountOut] = useState(null);
  const saveBankrollTimer = useRef(null);
  const [syncingBalance, setSyncingBalance] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const [openPositions, setOpenPositions] = useState(null);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const now = useNow(1000);

  async function loadRecord() {
    try { const d = await fetch("/api/desk/nrfi").then((r) => r.json()); recRef.current = d.record || []; setRec(recRef.current); }
    catch { recRef.current = []; setRec([]); }
  }
  async function loadTails() {
    try { const d = await fetch("/api/desk/nrfiking").then((r) => r.json()); setSellers((d && d.sellers) || []); }
    catch { setSellers([]); }
  }
  async function loadBankrollSettings() {
    try {
      const d = await fetch("/api/desk/nrfi/bankroll").then((r) => r.json());
      if (d && d.settings) {
        if (d.settings.startingBankroll != null) setBankroll(d.settings.startingBankroll);
        if (d.settings.riskLevel) setRiskLevel(d.settings.riskLevel);
        if (d.settings.growthSpeed) setGrowthSpeed(d.settings.growthSpeed);
      }
    } catch { /* ignore */ }
  }
  async function loadOpenPositions() {
    setLoadingPositions(true);
    try {
      const d = await fetch("/api/desk/nrfi/kalshi-positions").then((r) => r.json());
      if (d.positions) setOpenPositions(d);
      else setOpenPositions({ error: d.error || "Failed to load", positions: [] });
    } catch { setOpenPositions({ error: "Network error", positions: [] }); }
    setLoadingPositions(false);
  }
  function saveBankrollSettings(patch) {
    if (saveBankrollTimer.current) clearTimeout(saveBankrollTimer.current);
    saveBankrollTimer.current = setTimeout(() => {
      fetch("/api/desk/nrfi/bankroll", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).catch(() => {});
    }, 800);
  }
  async function reconcile(rs, rfiList) {
    if (!recRef.current) return;
    const recl = recRef.current.slice(); const changed = [];
    const lc = nrfiCalibration(recl); const calibNow = lc.active ? lc : NRFI_CALIB_SEED;
    const r1 = (x) => Math.round(x * 10) / 10;
    for (const r of rs) {
      const pcal = applyCalibration(r.pNRFI, calibNow);
      const mk = matchRFI(r, rfiList || []);
      const pFinal = nrfiBlend(pcal, mk ? mk.marketNRFI : null);
      const call = pFinal >= 0.5 ? "NRFI" : "YRFI";
      const pMax = Math.max(pFinal, 1 - pFinal) * 100;
      const mktSide = mk ? (call === "NRFI" ? mk.marketNRFI : 100 - mk.marketNRFI) : null;
      const started = r.currentInning >= 1 || r.final || (r.state && r.state !== "Preview");
      const id = "nrfi-" + r.gamePk;
      let e = recl.find((x) => x.id === id);
      if (!e && r.state === "Preview" && r.hasPitchers && r.dataOk && pMax >= 57) {
        e = { id, at: Date.now(), date: r.date.replace(/-/g, ""), gamePk: r.gamePk,
          game: r.away + " @ " + r.home, call, prob: r1(pMax),
          pNRFI: Math.round(r.pNRFI * 1000) / 1000,
          mktAtPick: mktSide != null ? r1(mktSide) : null,
          mktLatest: mktSide != null ? r1(mktSide) : null, mktAtClose: null, result: null };
        recl.unshift(e); changed.push(e);
      } else if (e && e.result == null) {
        // Track the market for CLV: update the live price pregame, freeze it at first pitch.
        if (mktSide != null && !started && e.mktLatest !== r1(mktSide)) { e.mktLatest = r1(mktSide); changed.push(e); }
        if (e.mktAtClose == null && started) { e.mktAtClose = e.mktLatest != null ? e.mktLatest : (mktSide != null ? r1(mktSide) : null); if (e.mktAtClose != null) changed.push(e); }
      }
      if (e && e.result == null && r.inning1runs != null && (r.currentInning > 1 || r.final)) {
        const nrfiHit = r.inning1runs === 0;
        e.result = (e.call === "NRFI") === nrfiHit ? "won" : "lost";
        e.firstInningRuns = r.inning1runs;
        if (e.mktAtClose == null && e.mktAtPick != null) e.mktAtClose = e.mktLatest != null ? e.mktLatest : e.mktAtPick;
        changed.push(e);
      }
    }
    if (changed.length) {
      recRef.current = recl; setRec(recl.slice());
      const uniq = Array.from(new Map(changed.map((e) => [e.id, e])).values());
      try { await fetch("/api/desk/nrfi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(uniq) }); } catch { /* keeps in memory */ }
    }
  }
  async function run() {
    setPhase("scanning"); setErr(null); setProg({ done: 0, total: 0 });
    try {
      const [r, rfiList] = await Promise.all([
        scanNrfi((done, total) => setProg({ done, total })),
        fetchKalshiRFI(),
      ]);
      // Snapshot prices on first fetch only (subsequent fetches detect movement).
      if (Object.keys(priceSnap.current).length === 0) {
        const snap = {};
        for (const m of rfiList || []) snap[m.ticker] = m.yesPrice;
        priceSnap.current = snap;
      }
      setRows(r); setRfi(rfiList || []); setPhase("done");
      setLastRefreshed(new Date());
      await reconcile(r, rfiList || []);
    } catch (e) { setErr(String((e && e.message) || e)); setPhase("error"); }
  }
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  async function importKalshiBets() {
    setImporting(true); setImportMsg(null);
    try {
      const d = await fetch("/api/desk/nrfi/kalshi-import").then((r) => r.json());
      setImportMsg(d.error ? { ok: false, text: d.error } : { ok: true, text: d.message });
      if (d.imported > 0) await loadRecord();
    } catch (e) { setImportMsg({ ok: false, text: String(e.message || e) }); }
    finally { setImporting(false); }
  }

  useEffect(() => { loadTails(); loadBankrollSettings(); loadRecord().then(run); loadOpenPositions(); }, []);
  useEffect(() => { const id = setInterval(loadOpenPositions, 30 * 1000); return () => clearInterval(id); }, []);

  // T-45: auto-refresh once when any pregame game is within 45 minutes of first pitch.
  useEffect(() => {
    if (phase !== "done" || rows.length === 0) return;
    const id = setInterval(() => {
      const t = Date.now();
      const thresh = 45 * 60 * 1000;
      for (const row of rows) {
        if (!row.startUtc || row.final || row.currentInning > 0) continue;
        const diff = new Date(row.startUtc).getTime() - t;
        if (diff > 0 && diff <= thresh && !refreshedFor.current.has(row.gamePk)) {
          refreshedFor.current.add(row.gamePk);
          loadTails(); run();
          return;
        }
      }
    }, 60000);
    return () => clearInterval(id);
  }, [phase, rows]);

  // Auto-refresh all data every 10 minutes: keeps lineups, weather, market prices, and
  // pitcher stats current throughout the day without any manual intervention.
  const AUTO_REFRESH_MS = 2 * 60 * 1000;
  useEffect(() => {
    if (phase !== "done") return;
    const allFinal = rows.length > 0 && rows.every((r) => r.final);
    if (allFinal) return; // nothing to update once all games are over
    const id = setInterval(() => {
      if (phase === "scanning") return; // don't stack refreshes
      loadTails(); run();
    }, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [phase, rows]);

  const settled = (rec || []).filter((r) => r.result === "won" || r.result === "lost");
  const modelSettled = settled.filter((r) => r.source !== "kalshi-import");
  const kalshiSettled = settled.filter((r) => r.source === "kalshi-import");
  const wins = modelSettled.filter((r) => r.result === "won").length;
  const losses = modelSettled.length - wins;
  const kWins = kalshiSettled.filter((r) => r.result === "won").length;
  const kLosses = kalshiSettled.length - kWins;

  const liveCalib = nrfiCalibration(rec || []);
  const calib = liveCalib.active ? liveCalib : NRFI_CALIB_SEED; // live once ≥25 graded, else backtest prior
  const enriched = rows.map((r) => {
    const pcal = applyCalibration(r.pNRFI, calib);        // model's own NRFI prob
    const mk = matchRFI(r, rfi);
    const pFinal = nrfiBlend(pcal, mk ? mk.marketNRFI : null); // market prior + model nudge
    const call = pFinal >= 0.5 ? "NRFI" : "YRFI";
    const pMax = Math.max(pFinal, 1 - pFinal) * 100;
    let market = null;
    if (mk) {
      const modelSide = call === "NRFI" ? pcal * 100 : (1 - pcal) * 100;
      const marketSide = call === "NRFI" ? mk.marketNRFI : (100 - mk.marketNRFI);
      const snapPrice = priceSnap.current[mk.ticker];
      const mktMove = snapPrice != null ? mk.yesPrice - snapPrice : null;
      market = { ticker: mk.ticker, link: mk.link, yesPrice: mk.yesPrice, marketNRFI: mk.marketNRFI, marketSide, edge: modelSide - marketSide, mktMove };
    }
    const kelly = market ? kellyNRFI(pcal, market.yesPrice, call) : null;
    const tails = sellers.filter((s) => s.active).map((s) => ({ name: s.name, pick: matchKingPick(r, s.open || []) })).filter((t) => t.pick);
    const base = Object.assign({}, r, { call, pMax, pModel: pcal, pFinal, pCal: pcal, tails, tier: nrfiTier(pMax), market, kelly });
    base.v = nrfiVerdict(base);
    return base;
  });
  // Correlated NRFI parlay pairs: two BET NRFI games with both pitchers graded B or higher.
  const nrfiBetRows = enriched.filter((r) => r.v && r.v.isBet && r.call === "NRFI");
  const parlayPairs = [];
  for (let i = 0; i < nrfiBetRows.length - 1; i++) {
    for (let j = i + 1; j < nrfiBetRows.length; j++) {
      const a = nrfiBetRows[i], b = nrfiBetRows[j];
      const aMin = a.pitProfiles ? Math.min(a.pitProfiles.away.score, a.pitProfiles.home.score) : 0;
      const bMin = b.pitProfiles ? Math.min(b.pitProfiles.away.score, b.pitProfiles.home.score) : 0;
      if (aMin >= 52 && bMin >= 52 && (a.pMax + b.pMax) / 2 >= 60) {
        const combProb = (a.pFinal * b.pFinal * 100).toFixed(1);
        parlayPairs.push({ a, b, combProb });
      }
    }
  }
  // Closing-line value on graded picks: did the market move toward our side after we logged it?
  const clvSet = (rec || []).filter((r) => r.mktAtPick != null && r.mktAtClose != null && (r.result === "won" || r.result === "lost"));
  const avgCLV = clvSet.length ? clvSet.reduce((a, r) => a + (r.mktAtClose - r.mktAtPick), 0) / clvSet.length : null;
  const byConf = (a, b) => b.pMax - a.pMax;
  const tailed = enriched.filter((r) => r.tails && r.tails.length).sort(byConf);
  const rest = enriched.filter((r) => !(r.tails && r.tails.length));
  const betNRFI = rest.filter((r) => r.v.isBet && r.call === "NRFI").sort(byConf);
  const betYRFI = rest.filter((r) => r.v.isBet && r.call === "YRFI").sort(byConf);
  const leans = rest.filter((r) => r.v.strength === "LEAN").sort(byConf);
  const passes = rest.filter((r) => r.v.strength === "PASS").sort(byConf);

  const leanColor = (l) => (l === "nrfi" ? "var(--moss)" : l === "yrfi" ? "var(--rose)" : "var(--dim)");
  const leanLabel = (l) => (l === "nrfi" ? "NRFI lean" : l === "yrfi" ? "YRFI lean" : "neutral");

  const card = (r) => {
    const isOpen = !!open[r.gamePk];
    const graded = r.inning1runs != null && (r.currentInning > 1 || r.final);
    const openPos = r.market && openPositions && !openPositions.error
      ? (openPositions.positions || []).find((p) => p.ticker === r.market.ticker)
      : null;
    const tailTicker = (r.tails || []).map((t) => t.pick.kalshiTicker).find(Boolean);
    const tradeLink = (r.market && r.market.link) || (tailTicker ? kalshiEventLink(tailTicker) : null);
    const recE = (rec || []).find((x) => x.id === "nrfi-" + r.gamePk);
    const gameTime = r.startUtc ? new Date(r.startUtc).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }) + " PT" : null;
    const countdown = r.startUtc && !r.final && r.currentInning === 0 ? fmtCountdown(r.startUtc, now) : null;

    // ── Verdict graphic: tagline + emoji based on call, confidence, result ──
    const vg = (() => {
      if (graded) {
        const won = (r.call === "NRFI" && r.inning1runs === 0) || (r.call === "YRFI" && r.inning1runs > 0);
        if (won && r.call === "NRFI") return { e: "⚰️", tag: "OFFENSE: DECEASED · zero survivors, no witnesses", c: "var(--moss)", bg: "rgba(80,160,80,0.08)" };
        if (won && r.call === "YRFI") return { e: "💥", tag: "CARNAGE ACHIEVED · " + r.inning1runs + " run" + (r.inning1runs === 1 ? "" : "s") + " of beautiful chaos", c: "var(--moss)", bg: "rgba(80,160,80,0.08)" };
        if (!won && r.call === "NRFI") return { e: "🩸", tag: "PITCHER GOT SMOKED · model takes the L, moment of silence", c: "var(--rose)", bg: "rgba(220,60,60,0.08)" };
        return { e: "🤡", tag: "BATTER FUMBLED IT · somehow stayed scoreless, clown behavior", c: "var(--rose)", bg: "rgba(220,60,60,0.08)" };
      }
      if (r.call === "NRFI") {
        if (r.pMax >= 72 && r.v.isBet) return { e: "⚰️", tag: "BATTERS: DO NOT RESUSCITATE", c: "var(--moss)", bg: "rgba(80,160,80,0.06)" };
        if (r.v.isBet) return { e: "💀", tag: "OFFENSE IN CRITICAL CONDITION", c: "var(--moss)", bg: "rgba(80,160,80,0.06)" };
        if (r.v.strength === "LEAN") return { e: "😬", tag: "BATTERS ARE SWEATING BULLETS", c: "var(--amber)", bg: "rgba(230,160,0,0.06)" };
        return { e: "🎲", tag: "COIN FLIP ENERGY · god help us all", c: "var(--dim)", bg: "rgba(120,130,150,0.05)" };
      }
      if (r.pMax >= 72 && r.v.isBet) return { e: "🔥", tag: "PITCHER: ABOUT TO GET ABSOLUTELY COOKED", c: "var(--rose)", bg: "rgba(220,60,60,0.06)" };
      if (r.v.isBet) return { e: "💥", tag: "PITCHER SURVIVAL ODDS: BLEAK", c: "var(--rose)", bg: "rgba(220,60,60,0.06)" };
      if (r.v.strength === "LEAN") return { e: "😤", tag: "BATTERS SMELL BLOOD IN THE WATER", c: "var(--amber)", bg: "rgba(230,160,0,0.06)" };
      return { e: "🎲", tag: "COIN FLIP ENERGY · god help us all", c: "var(--dim)", bg: "rgba(120,130,150,0.05)" };
    })();

    // ── Battle HP bars: pitcher power vs offense danger ──
    const awayPitHP = r.pitProfiles ? Math.min(100, Math.max(0, r.pitProfiles.away.cleanPct != null ? r.pitProfiles.away.cleanPct : 50)) : null;
    const homePitHP = r.pitProfiles ? Math.min(100, Math.max(0, r.pitProfiles.home.cleanPct != null ? r.pitProfiles.home.cleanPct : 50)) : null;
    const avgPitHP = (awayPitHP != null && homePitHP != null) ? Math.round((awayPitHP + homePitHP) / 2) : awayPitHP ?? homePitHP;
    const awayOffHP = r.awayYrfiPct != null ? Math.min(100, r.awayYrfiPct * 2.2) : null;
    const homeOffHP = r.homeYrfiPct != null ? Math.min(100, r.homeYrfiPct * 2.2) : null;
    const avgOffHP = (awayOffHP != null && homeOffHP != null) ? Math.round((awayOffHP + homeOffHP) / 2) : awayOffHP ?? homeOffHP;
    const pitWinning = avgPitHP != null && avgOffHP != null ? avgPitHP > avgOffHP : null;

    return (
      <div className={"pick " + r.tier.cls} key={r.gamePk}>
        {/* ── Verdict badge — centered at top ── */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <div title={r.v.blurb} style={{ cursor: "help", textAlign: "center", border: "2px solid " + r.v.color, background: r.v.color + "15", borderRadius: 12, padding: "6px 20px" }}>
            <div style={{ fontWeight: 900, fontSize: 12, color: r.v.color, lineHeight: 1, letterSpacing: "0.05em", textTransform: "uppercase" }}>{r.v.label}</div>
            <div style={{ fontWeight: 800, fontSize: 26, color: r.v.color, lineHeight: 1, marginTop: 5 }}>{r.pMax.toFixed(0)}%</div>
            <div style={{ fontSize: 9, letterSpacing: "0.10em", color: r.v.color, marginTop: 3, opacity: 0.6 }}>{r.tier.t}</div>
          </div>
        </div>
        {/* ── Header ── */}
        <div style={{ marginBottom: 12 }}>
          {gameTime && (
            <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 5 }}>
              {gameTime}
              {countdown && <span title="Time until first pitch" style={{ cursor: "help", marginLeft: 5, color: !countdown.includes("h") && parseInt(countdown) < 30 ? "var(--amber)" : "var(--dim)", fontWeight: !countdown.includes("h") && parseInt(countdown) < 30 ? 700 : 400 }}>· {countdown}</span>}
            </div>
          )}
          <div title={r.away + " (away) @ " + r.home + " (home)"} style={{ fontWeight: 800, fontSize: 20, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 3 }}>
            {r.awayAbbr || r.away} <span style={{ color: "var(--dim)", fontWeight: 300 }}>@</span> {r.homeAbbr || r.home}
          </div>
          <div style={{ fontSize: 11, color: "var(--dim)" }}>{r.away} @ {r.home}</div>
        </div>

        {/* ── Verdict graphic + battle bar ── */}
        <div style={{ marginBottom: 12, padding: "10px 13px", background: vg.bg, borderRadius: 9, border: "1px solid " + vg.c + "30" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: avgPitHP != null || avgOffHP != null ? 10 : 0 }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>{vg.e}</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: vg.c, letterSpacing: "0.04em", textTransform: "uppercase" }}>{vg.tag}</span>
          </div>
          {(avgPitHP != null || avgOffHP != null) && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Pitcher bar */}
                <div
                  title={"PITCHING DOMINANCE — how likely both starters are to keep the 1st inning scoreless, based on their clean-inning rates. " + (avgPitHP != null ? avgPitHP + "% = " + (avgPitHP >= 65 ? "elite shutdown stuff" : avgPitHP >= 50 ? "solid control" : "vulnerable early") + ". Green = pitcher-friendly, amber = 50/50, red = starters are leaking." : "")}
                  style={{ flex: 1, cursor: "help" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.06em" }}>🛡️ PITCHING</span>
                    {avgPitHP != null && <span style={{ fontSize: 10, fontWeight: 800, color: avgPitHP >= 60 ? "var(--moss)" : avgPitHP >= 45 ? "var(--amber)" : "var(--rose)" }}>{avgPitHP}%</span>}
                  </div>
                  <div style={{ height: 7, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: (avgPitHP || 0) + "%", background: avgPitHP >= 60 ? "linear-gradient(90deg,#2d6a3f,var(--moss))" : avgPitHP >= 45 ? "linear-gradient(90deg,#8a6500,var(--amber))" : "linear-gradient(90deg,#7a1a1a,var(--rose))", borderRadius: 4, transition: "width 1s cubic-bezier(.2,1,.3,1)" }} />
                  </div>
                  <div style={{ fontSize: 8, color: "var(--dim)", marginTop: 2 }}>
                    {avgPitHP >= 65 ? "elite — starters shutting it down" : avgPitHP >= 50 ? "solid — starters in control" : "shaky — vulnerable to early runs"}
                  </div>
                </div>
                {/* Center icon with label */}
                <div style={{ textAlign: "center", flexShrink: 0 }}>
                  <div style={{ fontSize: 18, lineHeight: 1 }}>{pitWinning === true ? "⚔️" : pitWinning === false ? "💥" : "⚾"}</div>
                  <div style={{ fontSize: 7, fontWeight: 800, color: pitWinning === true ? "var(--moss)" : pitWinning === false ? "var(--rose)" : "var(--dim)", letterSpacing: "0.04em", marginTop: 2, whiteSpace: "nowrap" }}>
                    {pitWinning === true ? "ARM WINS" : pitWinning === false ? "BAT WINS" : "TOSS UP"}
                  </div>
                </div>
                {/* Offense bar (fills right-to-left to oppose) */}
                <div
                  title={"OFFENSIVE THREAT — how aggressive both lineups are in the 1st inning based on their season YRFI scoring rates. " + (avgOffHP != null ? avgOffHP + "% = " + (avgOffHP >= 60 ? "dangerous bats, run likely" : avgOffHP >= 40 ? "average scoring threat" : "cold bats, tough to score early") + ". Red = offense-friendly, amber = 50/50, green = offense is quiet." : "")}
                  style={{ flex: 1, cursor: "help" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
                    {avgOffHP != null && <span style={{ fontSize: 10, fontWeight: 800, color: avgOffHP >= 60 ? "var(--rose)" : avgOffHP >= 40 ? "var(--amber)" : "var(--moss)" }}>{avgOffHP}%</span>}
                    <span style={{ fontSize: 9, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.06em", marginLeft: "auto" }}>OFFENSE ⚡</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden", transform: "scaleX(-1)" }}>
                    <div style={{ height: "100%", width: (avgOffHP || 0) + "%", background: avgOffHP >= 60 ? "linear-gradient(90deg,#7a1a1a,var(--rose))" : avgOffHP >= 40 ? "linear-gradient(90deg,#8a6500,var(--amber))" : "linear-gradient(90deg,#2d6a3f,var(--moss))", borderRadius: 4, transition: "width 1s cubic-bezier(.2,1,.3,1)" }} />
                  </div>
                  <div style={{ fontSize: 8, color: "var(--dim)", marginTop: 2, textAlign: "right" }}>
                    {avgOffHP >= 60 ? "hot bats — scoring threat is real" : avgOffHP >= 40 ? "average — could go either way" : "cold lineup — quiet early innings"}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Pitcher panels ── */}
        {r.pitProfiles && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            {[
              { side: "AWAY", name: r.awayPP, p: r.pitProfiles.away },
              { side: "HOME", name: r.homePP, p: r.pitProfiles.home },
            ].map(({ side, name, p }, i) => {
              const rl = p.rolling;
              const headline = rl && rl.l30 && rl.l30.pct != null ? rl.l30.pct : p.cleanPct;
              const headlineN = rl && rl.l30 && rl.l30.n ? rl.l30.n : p.sample;
              const headlineC = headline >= 65 ? "var(--moss)" : headline >= 50 ? "var(--amber)" : "var(--rose)";
              const kbb = p.k9 != null && p.bb9 != null ? (p.k9 - p.bb9).toFixed(1) : null;
              const pClr = (v) => v >= 65 ? "var(--moss)" : v >= 50 ? "var(--fg)" : v >= 38 ? "var(--amber)" : "var(--rose)";
              const windows = rl ? [{ label: "SZN", ...rl.szn }, { label: "L50", ...rl.l50 }, { label: "L30", ...rl.l30 }, { label: "L10", ...rl.l10 }] : [];
              const bt = pitcherBT(name);
              // Derive tier: prefer backtest table; fall back to live model clean %
              const btClean = bt ? bt.clean : headline;
              const btN     = bt ? bt.n     : headlineN;
              const btSrc   = bt ? "backtest" : "model";
              const btTier  = bt ? bt.tier :
                headline == null ? null :
                headline >= 70 ? "elite" :
                headline >= 65 ? "sharp" :
                headline <= 30 ? "danger" :
                headline <= 35 ? "leaky" : "avg";
              const TIER_STYLES = {
                elite:  { icon: "🔥", label: "ELITE 1ST INN", color: "var(--moss)",  bg: "rgba(80,200,120,0.1)",  border: "rgba(80,200,120,0.4)"  },
                sharp:  { icon: "✅", label: "SHARP",          color: "#8ecf8e",      bg: "rgba(80,180,80,0.08)",  border: "rgba(80,180,80,0.3)"   },
                leaky:  { icon: "⚠️", label: "LEAKY 1ST",      color: "var(--amber)", bg: "rgba(230,160,0,0.1)",   border: "rgba(230,160,0,0.4)"   },
                danger: { icon: "🩸", label: "BLEEDS EARLY",   color: "var(--rose)",  bg: "rgba(220,60,60,0.1)",   border: "rgba(220,60,60,0.4)"   },
                avg:    { icon: "📊", label: "AVERAGE",        color: "var(--dim)",   bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.12)" },
              };
              const btBadge = btTier ? TIER_STYLES[btTier] : null;
              const headshotUrl = p.pid
                ? "https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/" + p.pid + "/headshot/67/current"
                : "https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/generic/headshot/67/current";
              return (
                <div key={i} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 13px", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {/* Header: headshot + name/grade */}
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                    <img
                      src={headshotUrl}
                      alt={name}
                      style={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover", flexShrink: 0, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                      onError={(e) => { e.target.src = "https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/0/headshot/67/current"; }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.1em", marginBottom: 2 }}>{side} STARTER</div>
                          <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={name}>{name}</div>
                        </div>
                        {p.grade !== "—" && (
                          <span title={"1st-inning pitcher grade: " + p.grade + " — " + (p.summary || "") + (p.vsNote || "") + " · A+/A = elite, B = solid, C = average, D/F = struggles early."} style={{ cursor: "help", fontWeight: 800, fontSize: 12, color: p.gradeColor, background: p.gradeColor + "18", border: "1.5px solid " + p.gradeColor, borderRadius: 6, padding: "2px 7px", marginLeft: 8, flexShrink: 0 }}>{p.grade}</span>
                        )}
                      </div>
                      {btBadge && btClean != null && (
                        <div title={(btSrc === "backtest" ? "Backtest result — 4,015 MLB games (2025 full + 2026 to-date): " : "Live model estimate: ") + name + " kept the 1st inning scoreless " + btClean + "% of the time across " + btN + " starts."} style={{ cursor: "help", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 5, padding: "2px 7px", background: btBadge.bg, border: "1px solid " + btBadge.border, borderRadius: 5, fontSize: 10, fontWeight: 700, color: btBadge.color }}>
                          {btBadge.icon} {btBadge.label} · {btClean}%
                        </div>
                      )}
                    </div>
                  </div>
                  {headline != null && (
                    <div title={"Last 30 starts: kept the 1st inning scoreless " + headline + "% of the time (" + headlineN + " games). Green = elite, amber = average, red = struggles."} style={{ cursor: "help", marginBottom: 8 }}>
                      <div style={{ fontWeight: 800, fontSize: 34, color: headlineC, lineHeight: 1 }}>{headline}%</div>
                      <div style={{ fontSize: 10, color: "var(--dim)", marginTop: 2 }}>clean 1st inning · L30 · {headlineN} starts</div>
                    </div>
                  )}
                  {windows.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 3, marginBottom: 9 }}>
                      {windows.map((w) => (
                        <div key={w.label} title={{ SZN: "Full season clean 1st inning rate", L50: "Last 50 starts clean %", L30: "Last 30 starts clean %", L10: "Last 10 starts clean % — most recent form" }[w.label] + " — " + (w.pct != null ? w.pct + "% in " + w.n + " games" : "no data")} style={{ cursor: "help", textAlign: "center", background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "4px 0" }}>
                          <div style={{ fontSize: 9, color: "var(--dim)", marginBottom: 1 }}>{w.label}</div>
                          <div style={{ fontWeight: 700, fontSize: 12, color: w.pct != null ? pClr(w.pct) : "var(--dim)" }}>{w.pct != null ? w.pct + "%" : "—"}</div>
                          <div style={{ fontSize: 9, color: "var(--dim)", opacity: 0.7 }}>{w.n != null ? w.n + "g" : ""}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {kbb != null && <span title={"K/9 minus BB/9 = " + kbb + ". Strikeouts minus walks per 9 innings — how dominant the pitcher is. " + p.k9.toFixed(1) + " K/9, " + p.bb9.toFixed(1) + " BB/9. League avg ~5.3. Higher = more dominant."} style={{ cursor: "help", fontSize: 11, color: "var(--dim)", background: "rgba(255,255,255,0.05)", borderRadius: 4, padding: "1px 6px" }}>K-BB {kbb}</span>}
                    {p.whip != null && <span title={"WHIP = " + p.whip.toFixed(2) + ". Walks + Hits per inning in the 1st. League avg ~1.28. Lower = harder to score against. Elite is under 1.00."} style={{ cursor: "help", fontSize: 11, color: p.whip <= 1.10 ? "var(--moss)" : p.whip >= 1.50 ? "var(--rose)" : "var(--dim)", background: "rgba(255,255,255,0.05)", borderRadius: 4, padding: "1px 6px" }}>WHIP {p.whip.toFixed(2)}</span>}
                    {p.fstrike != null && <span title={"First-pitch strike rate = " + p.fstrike.toFixed(1) + "%. How often the pitcher throws a strike on the very first pitch of an at-bat. Gets ahead in counts early = harder to score. League avg ~60%. Green = above average."} style={{ cursor: "help", fontSize: 11, color: p.fstrike >= 64 ? "var(--moss)" : p.fstrike <= 56 ? "var(--rose)" : "var(--dim)", background: "rgba(255,255,255,0.05)", borderRadius: 4, padding: "1px 6px" }}>FPS {p.fstrike.toFixed(0)}%</span>}
                    {p.whiff != null && <span title={"Whiff rate = " + p.whiff.toFixed(1) + "%. Percentage of swings that completely miss the ball. Higher = harder to make contact = fewer hits = fewer runs. League avg ~24.5%. Green = above average."} style={{ cursor: "help", fontSize: 11, color: p.whiff >= 28 ? "var(--moss)" : p.whiff <= 20 ? "var(--rose)" : "var(--dim)", background: "rgba(255,255,255,0.05)", borderRadius: 4, padding: "1px 6px" }}>Whiff {p.whiff.toFixed(0)}%</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Stats strip ── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 0, alignItems: "stretch", fontSize: 12, marginBottom: 8, background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <span title={"Our model's probability of " + r.call + " happening in the 1st inning — built from pitcher splits, lineups, park, weather, and Kalshi market price."} style={{ cursor: "help", padding: "8px 12px", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ color: "var(--dim)", fontSize: 10, display: "block", marginBottom: 1 }}>MODEL</span>
            <span style={{ fontWeight: 800, color: r.v.color }}>{r.pMax.toFixed(0)}% {r.call}</span>
          </span>
          {r.market && (
            <>
              <span title={"Kalshi prediction market: traders collectively say there's a " + r.market.marketNRFI.toFixed(0) + "% chance no run scores in the 1st inning. This is our starting point — we bet only when our model disagrees by a meaningful margin."} style={{ cursor: "help", padding: "8px 12px", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ color: "var(--dim)", fontSize: 10, display: "block", marginBottom: 1 }}>MARKET</span>
                <span style={{ fontWeight: 700, color: "var(--bone)" }}>{r.market.marketNRFI.toFixed(0)}% NRFI</span>
              </span>
              <span title={"Edge = how much our model probability exceeds the market on our call side. " + (r.market.edge > 0 ? "Positive edge means we think the true probability is higher than what the market is paying." : "Negative edge means the market already prices this better than our model.") + " We only bet when edge is meaningfully positive."} style={{ cursor: "help", padding: "8px 12px", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ color: "var(--dim)", fontSize: 10, display: "block", marginBottom: 1 }}>EDGE</span>
                <span style={{ fontWeight: 700, color: r.market.edge >= 3 ? "var(--moss)" : r.market.edge <= -3 ? "var(--rose)" : "var(--dim)" }}>{r.market.edge > 0 ? "+" : ""}{r.market.edge.toFixed(0)}%</span>
              </span>
              <span title={"Kalshi YES price = " + r.market.yesPrice.toFixed(0) + "¢. Buying YES means you think a run WILL score in the 1st. Buying NO (at " + (100 - r.market.yesPrice).toFixed(0) + "¢) means you think no run scores = NRFI."} style={{ cursor: "help", padding: "8px 12px", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ color: "var(--dim)", fontSize: 10, display: "block", marginBottom: 1 }}>KALSHI YES</span>
                <span style={{ fontWeight: 700, color: "var(--bone)" }}>{r.market.yesPrice.toFixed(0)}¢</span>
              </span>
              {r.kelly != null && (() => {
                const riskMult = riskLevel === "conservative" ? 0.25 : riskLevel === "aggressive" ? 1.0 : 0.5;
                const betPct = (r.kelly * riskMult * 100).toFixed(1);
                const betAmt = bankroll ? Math.round(bankroll * r.kelly * riskMult * 100) / 100 : null;
                return (
                  <span title={"Suggested bet size based on your edge and risk level. At " + riskLevel + " risk: bet " + betPct + "% of your bankroll" + (betAmt ? " = $" + betAmt : "") + ". This is mathematically sized to your edge — larger edge = larger bet. Never bet more than you can afford to lose."} style={{ cursor: "help", padding: "8px 12px" }}>
                    <span style={{ color: "var(--dim)", fontSize: 10, display: "block", marginBottom: 1 }}>BET SIZE</span>
                    <span style={{ fontWeight: 800, color: "var(--moss)" }}>{betAmt ? "$" + betAmt : betPct + "%"}</span>
                  </span>
                );
              })()}
            </>
          )}
          {r.method === "sim" && <span title="Probabilities calculated via base-out Markov simulation — models each batter's actual PA rates vs this pitcher's allow rates across all possible 1st-inning scenarios." style={{ cursor: "help", padding: "8px 8px", display: "flex", alignItems: "center" }}><span style={{ fontSize: 9, color: "var(--dim)", border: "1px solid rgba(120,130,150,.3)", borderRadius: 3, padding: "1px 4px" }}>SIM</span></span>}
        </div>

        {/* ── 1st-inn offense + badges row ── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 10 }}>
          {(r.awayYrfiPct != null || r.homeYrfiPct != null) && (
            <div title="How often each team scores a run in the 1st inning this season. Red = high-scoring offense (bad for NRFI), green = low-scoring (good for NRFI)." style={{ cursor: "help", display: "inline-flex", gap: 8, alignItems: "center", padding: "3px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, fontSize: 11 }}>
              <span style={{ color: "var(--dim)", fontSize: 10, fontWeight: 700 }}>1ST-INN</span>
              {r.awayYrfiPct != null && <span style={{ color: r.awayYrfiPct >= 38 ? "var(--rose)" : r.awayYrfiPct <= 25 ? "var(--moss)" : "var(--dim)", fontWeight: 600 }}>{r.awayAbbr || r.away} {r.awayYrfiPct}%</span>}
              {r.awayYrfiPct != null && r.homeYrfiPct != null && <span style={{ color: "var(--dim)" }}>·</span>}
              {r.homeYrfiPct != null && <span style={{ color: r.homeYrfiPct >= 38 ? "var(--rose)" : r.homeYrfiPct <= 25 ? "var(--moss)" : "var(--dim)", fontWeight: 600 }}>{r.homeAbbr || r.home} {r.homeYrfiPct}%</span>}
            </div>
          )}
          {!r.lineupPosted && (
            <span title="Official starting lineups haven't been posted yet. The model is using projected batting orders, which are less accurate than the real lineup. Check back closer to game time." style={{ cursor: "help", display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", background: "rgba(230,160,0,0.1)", border: "1px solid rgba(230,160,0,0.4)", borderRadius: 20, fontSize: 11, fontWeight: 700, color: "var(--amber)" }}>⚠ LINEUPS PENDING</span>
          )}
          {r.parkEnv && (() => {
            const f = r.parkEnv.factor;
            const label = f >= 1.06 ? "HITTER FRIENDLY" : f >= 1.02 ? "SLIGHT HITTER LEAN" : f <= 0.95 ? "PITCHER FRIENDLY" : f <= 0.98 ? "SLIGHT PITCHER LEAN" : null;
            if (!label) return null;
            const isHitter = label.includes("HITTER");
            const color = isHitter ? "var(--rose)" : "var(--moss)";
            const tip = "Park + weather combined factor: " + f.toFixed(2) + ". " + (isHitter ? "This stadium and today's weather tend to inflate scoring — harder to get a clean first inning." : "This stadium and today's weather tend to suppress scoring — easier to get a clean first inning.") + " Park factor: " + r.parkEnv.park.toFixed(2) + (r.parkEnv.note && r.parkEnv.note !== "neutral" ? " · Weather: " + r.parkEnv.note : "");
            return <span title={tip} style={{ cursor: "help", display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", background: isHitter ? "rgba(220,60,60,0.1)" : "rgba(80,160,80,0.1)", border: "1px solid " + color + "66", borderRadius: 20, fontSize: 11, fontWeight: 700, color }}>{label}</span>;
          })()}
          {r.market && r.market.mktMove != null && Math.abs(r.market.mktMove) >= 5 && (
            <span title={"Market moved " + (r.market.mktMove > 0 ? "+" : "") + r.market.mktMove.toFixed(0) + " cents since the page first loaded. " + (r.market.mktMove > 0 ? "Rising YES price = more people betting a run WILL score. Could be sharp money coming in on YRFI." : "Falling YES price = more people betting no run scores. Market moving in our favor.")} style={{ cursor: "help", display: "inline-flex", alignItems: "center", padding: "3px 10px", background: r.market.mktMove > 0 ? "rgba(220,60,60,0.1)" : "rgba(80,160,80,0.1)", border: "1px solid " + (r.market.mktMove > 0 ? "var(--rose)" : "var(--moss)") + "66", borderRadius: 20, fontSize: 11, fontWeight: 700, color: r.market.mktMove > 0 ? "var(--rose)" : "var(--moss)" }}>
              {r.market.mktMove > 0 ? "↑" : "↓"} MKT {r.market.mktMove > 0 ? "+" : ""}{r.market.mktMove.toFixed(0)}¢
            </span>
          )}
          {(r.tails || []).map((t, i) => (
            <span key={i} title={t.name + " has a " + t.pick.side + " pick on this game" + (t.pick.side === r.call ? " — agrees with our model." : " — disagrees with our model, use caution.")} style={{ cursor: "help", display: "inline-flex", alignItems: "center", padding: "3px 10px", border: "1px solid " + (t.pick.side === r.call ? "rgba(127,185,139,0.5)" : "rgba(230,160,0,0.5)"), borderRadius: 20, fontSize: 11, fontWeight: 600, color: t.pick.side === r.call ? "var(--moss)" : "var(--amber)" }}>
              {t.name}: {t.pick.side} {t.pick.side === r.call ? "✓" : "⚠"}
            </span>
          ))}
          {graded && (() => {
            const won = (r.call === "NRFI" && r.inning1runs === 0) || (r.call === "YRFI" && r.inning1runs > 0);
            const clv = recE && recE.mktAtPick != null && recE.mktAtClose != null ? recE.mktAtClose - recE.mktAtPick : null;
            return (
              <div style={{ width: "100%", marginTop: 6, padding: "12px 14px", borderRadius: 10, background: won ? "rgba(80,160,80,0.10)" : "rgba(220,60,60,0.10)", border: "1px solid " + (won ? "rgba(80,160,80,0.4)" : "rgba(220,60,60,0.4)") }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 28, lineHeight: 1 }}>{won ? vg.e : (r.call === "NRFI" ? "🩸" : "🤡")}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: 15, color: won ? "var(--moss)" : "var(--rose)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                      {won ? (r.call === "NRFI" ? "OFFENSE FLATLINED" : "BEAUTIFUL DISASTER") : (r.call === "NRFI" ? "PITCHER GOT MURKED" : "STAYED SCORELESS (SOMEHOW)")}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>
                      {r.inning1runs === 0 ? "Zero runs. Zero mercy. Zero survivors." : r.inning1runs + " run" + (r.inning1runs === 1 ? " crossed the plate." : "s crossed the plate.")}
                      {" · " + (won ? "We called it." : "We didn't.")}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: won ? "var(--moss)" : "var(--rose)" }}>{r.inning1runs === 0 ? "✓ NRFI" : "✗ YRFI"}</div>
                    {clv != null && (
                      <div title="Closing line value — how the market moved between our pick and first pitch. Positive = we had real edge." style={{ cursor: "help", fontSize: 11, color: clv >= 0 ? "var(--moss)" : "var(--rose)", fontWeight: 700, marginTop: 2 }}>
                        CLV {clv > 0 ? "+" : ""}{clv.toFixed(1)}%
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* ── Actions ── */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {openPos && (
            <div style={{ width: "100%", marginBottom: 6, padding: "7px 12px", background: "rgba(80,160,80,0.10)", border: "1px solid rgba(80,160,80,0.35)", borderRadius: 8, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: "var(--moss)", letterSpacing: "0.04em" }}>💰 IN POSITION</span>
              <span style={{ fontSize: 12, color: "var(--dim)" }}>Risked <b style={{ color: "var(--fg)" }}>${openPos.totalCost != null ? openPos.totalCost.toFixed(2) : "—"}</b></span>
              <span style={{ fontSize: 12, color: "var(--dim)" }}>To win <b style={{ color: "var(--moss)" }}>+${openPos.estimatedPayout != null ? openPos.estimatedPayout.toFixed(2) : openPos.totalCost != null ? (openPos.contracts - openPos.totalCost).toFixed(2) : "—"}</b></span>
              <span style={{ fontSize: 10, color: "var(--dim)", marginLeft: "auto" }}>{openPos.contracts} contracts · {openPos.call}</span>
            </div>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => Object.assign({}, o, { [r.gamePk]: !o[r.gamePk] }))}>
            {isOpen ? "Hide research" : "Show research"}
          </button>
          {tradeLink && (
            <a className="btn btn-sm" href={tradeLink} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
              Trade on Kalshi ↗
            </a>
          )}
        </div>

        {/* ── Expanded research ── */}
        {isOpen && (
          <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.1em", marginBottom: 8 }}>RESEARCH SIGNALS</div>
            {r.checks.map((ck, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 12 }}>
                <div style={{ width: 3, borderRadius: 2, background: leanColor(ck.lean), flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600 }}>{ck.label}</span>
                  <span style={{ color: leanColor(ck.lean), fontSize: 10, marginLeft: 6, fontWeight: 700 }}>· {leanLabel(ck.lean)}</span>
                  <div style={{ color: "var(--dim)", marginTop: 2, fontSize: 11 }}>{ck.detail}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const sect = (title, arr, color) => arr.length > 0 && (
    <div className="panel" style={{ marginTop: 12 }}>
      <p className="sect" style={{ margin: 0, color }}>{title} ({arr.length})</p>
      <div style={{ marginTop: 8, display: "grid", gap: 8 }}>{arr.map(card)}</div>
    </div>
  );

  return (
    <div>
      <p className="help">
        Calibrated first-inning (NRFI/YRFI) model from MLB StatsAPI + Statcast. Every game runs a full research
        pass — starting pitching (1st-inning splits), pitcher skill (1st-inn K%, Statcast whiff, control), recent
        form, both teams' 1st-inning offense, platoon/handedness, leadoff-weighted lineups (also catches
        scratches), travel &amp; rest, weather/park, and the home-plate umpire. The de-vig Kalshi market is the PRIOR —
        "our number" is market-anchored with the model as the tiebreaker; we bet only when the model clears the market
        by a real margin, and track closing-line value (CLV), the honest edge test. Graded against the real 1st-inning score.
      </p>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", margin: "8px 0 4px" }}>
        <span style={{ fontSize: 13 }}>Model record: <b style={{ color: wins >= losses ? "var(--moss)" : "var(--rose)" }}>{wins}-{losses}</b></span>
        {kalshiSettled.length > 0 && (
          <span style={{ fontSize: 13 }}>Kalshi bets: <b style={{ color: kWins >= kLosses ? "var(--moss)" : "var(--rose)" }}>{kWins}-{kLosses}</b></span>
        )}
        {sellers.map((s) => (
          <span key={s.id} style={{ fontSize: 13, color: s.active ? "var(--dim)" : "var(--amber)" }}>
            {s.active ? (s.record ? s.name + " tail: " + s.record.wins + "-" + s.record.losses : s.name + ": active") : s.name + ": subscription not active"}
          </span>
        ))}
        <span style={{ fontSize: 13, color: "var(--dim)" }}>{liveCalib.active ? "Calibrated: " + liveCalib.n + " live graded games" : "Calibrated: backtest (" + NRFI_CALIB_SEED.n + " games) · +" + liveCalib.n + " live"}</span>
        {avgCLV != null && <span style={{ fontSize: 13, color: avgCLV >= 0 ? "var(--moss)" : "var(--rose)" }}>Avg CLV: {avgCLV > 0 ? "+" : ""}{avgCLV.toFixed(1)}% ({clvSet.length})</span>}
        <button className="btn btn-ghost btn-sm" onClick={() => { loadTails(); run(); }} disabled={phase === "scanning"}>{phase === "scanning" ? "Researching…" : "↻ Refresh"}</button>
        {lastRefreshed && phase === "done" && (() => {
          const secsAgo = Math.floor((now - lastRefreshed.getTime()) / 1000);
          const nextIn = Math.max(0, AUTO_REFRESH_MS / 1000 - secsAgo);
          const fmt = (s) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
          return (
            <span style={{ fontSize: 11, color: "var(--dim)", fontVariantNumeric: "tabular-nums" }} title="Model auto-refreshes every 10 minutes — keeps lineups, weather, market prices, and pitcher stats current">
              Updated {secsAgo < 60 ? secsAgo + "s ago" : Math.floor(secsAgo / 60) + "m ago"} · next in {fmt(nextIn)}
            </span>
          );
        })()}
        <button className="btn btn-ghost btn-sm" onClick={importKalshiBets} disabled={importing} title="Pull your closed NRFI/YRFI bets from Kalshi and add them to the history">{importing ? "Importing…" : "Import Kalshi bets"}</button>
        {importMsg && <span style={{ fontSize: 12, color: importMsg.ok ? "var(--moss)" : "var(--rose)" }}>{importMsg.text}</span>}
      </div>
      {/* Bankroll builder */}
      {(() => {
        const riskMult = riskLevel === "conservative" ? 0.25 : riskLevel === "aggressive" ? 1.0 : 0.5;

        // ── P&L from settled Kalshi imports — shown as context only, not added to bankroll ──
        // The bankroll the user enters IS their current balance. P&L is informational.
        const gradedHistory = (rec || []).filter((r) => (r.result === "won" || r.result === "lost") && r.contracts > 0 && r.mktAtPick != null && r.mktAtPick > 0);
        const historyPL = gradedHistory.reduce((s, r) => {
          // mktAtPick = price paid per contract in cents (0-100). Each contract pays $1 on win.
          const pricePerContract = Math.min(99, Math.max(1, r.mktAtPick)) / 100;
          const cost = r.contracts * pricePerContract;
          return s + (r.result === "won" ? r.contracts * (1 - pricePerContract) : -cost);
        }, 0);

        // Sort by edge descending — best plays first; exclude games already held in Kalshi
        const openTickerSet = new Set((openPositions && !openPositions.error ? openPositions.positions : []).map((p) => p.ticker));
        const allBetRows = enriched
          .filter((r) => r.v && r.v.isBet && r.kelly != null && r.call === "NRFI")
          .slice().sort((a, b) => (b.market ? b.market.edge : 0) - (a.market ? a.market.edge : 0));
        const alreadyHeld = allBetRows.filter((r) => r.market && openTickerSet.has(r.market.ticker));
        const betRows = allBetRows.filter((r) => !r.market || !openTickerSet.has(r.market.ticker));
        const remaining = (bankroll && amountOut != null) ? Math.max(0, bankroll - amountOut) : bankroll;
        const rawTotalBetPct = betRows.reduce((s, r) => s + r.kelly * riskMult, 0);
        // Cap total allocation at 100% of available balance
        const allocationScale = rawTotalBetPct > 1 ? 1 / rawTotalBetPct : 1;
        const totalBetPct = rawTotalBetPct * allocationScale;
        const totalBetAmt = remaining ? remaining * totalBetPct : null;
        const avgEdgePct = betRows.length > 0 ? betRows.reduce((s, r) => s + (r.market ? r.market.edge : 0), 0) / betRows.length : 0;

        // ── AI assistant insights ──
        const nrfiGraded = (rec || []).filter((r) => r.result === "won" || r.result === "lost");
        const last10 = nrfiGraded.slice(0, 10);
        const wins10 = last10.filter((r) => r.result === "won").length;
        const roi10 = last10.length > 0 ? last10.reduce((s, r) => {
          if (r.mktAtPick == null) return s;
          return s + (r.result === "won" ? (100 - r.mktAtPick) / 100 : -r.mktAtPick / 100);
        }, 0) / last10.length * 100 : null;
        let streak = 0;
        const streakDir = nrfiGraded.length > 0 ? nrfiGraded[0].result : null;
        for (const rg of nrfiGraded) { if (rg.result === streakDir) streak++; else break; }
        const aiInsights = [];
        if (last10.length >= 3) {
          const wr = (wins10 / last10.length * 100).toFixed(0);
          aiInsights.push({ type: wins10 / last10.length >= 0.55 ? "good" : wins10 / last10.length <= 0.4 ? "warn" : "neutral",
            text: wr + "% win rate on last " + last10.length + " bets" + (roi10 != null ? " · avg " + (roi10 > 0 ? "+" : "") + roi10.toFixed(1) + "% ROI per bet" : "") + "." });
        }
        if (streak >= 3 && streakDir === "won") {
          aiInsights.push({ type: "good", text: streak + "-bet win streak. Model is running hot — current risk level is appropriate." });
        } else if (streak >= 3 && streakDir === "lost") {
          aiInsights.push({ type: "warn", text: streak + " consecutive losses. Recommend dropping to conservative risk until the streak breaks." });
        }
        if (betRows.length > 0 && avgEdgePct >= 6) {
          aiInsights.push({ type: "good", text: "Strong edge today (avg +" + avgEdgePct.toFixed(1) + "%). Good slate to press at current sizing." });
        } else if (betRows.length > 0 && avgEdgePct < 2) {
          aiInsights.push({ type: "warn", text: "Thin edge today (avg +" + avgEdgePct.toFixed(1) + "%). Consider sizing down or skipping marginal games." });
        }
        if (gradedHistory.length > 0 && Math.abs(historyPL) >= 1) {
          aiInsights.push({ type: historyPL >= 0 ? "good" : "warn",
            text: "Kalshi history shows " + (historyPL >= 0 ? "+" : "") + "$" + historyPL.toFixed(2) + " P&L across " + gradedHistory.length + " settled bet" + (gradedHistory.length === 1 ? "" : "s") + "." });
        }
        if (remaining != null && remaining <= 0 && bankroll) {
          aiInsights.push({ type: "warn", text: "No remaining balance. Wait for open positions to settle before placing more bets." });
        }
        // Goal planner logic
        // Estimate avg daily profit % = sum of edge-sized expected value across all bets
        const dailyEvPct = betRows.reduce((s, r) => {
          if (!r.kelly || !r.market) return s;
          const betPct = r.kelly * riskMult;
          const winProb = r.call === "NRFI" ? r.pFinal : 1 - r.pFinal;
          const odds = r.call === "NRFI" ? r.market.yesPrice / (100 - r.market.yesPrice) : (100 - r.market.yesPrice) / r.market.yesPrice;
          return s + betPct * (winProb * odds - (1 - winProb));
        }, 0);
        // Speed multiplier: conservative = half theoretical speed, fast = 1.5x (more bets, higher risk accepted)
        const speedMult = growthSpeed === "slow" ? 0.4 : growthSpeed === "fast" ? 1.4 : 1.0;
        const effectiveDailyEv = dailyEvPct * speedMult;
        // Days to goal estimate
        let daysToGoal = null;
        let recBankroll = null;
        if (profitGoal && bankroll && effectiveDailyEv > 0) {
          const dailyProfit = (remaining || bankroll) * effectiveDailyEv;
          daysToGoal = Math.ceil(profitGoal / dailyProfit);
          recBankroll = null;
        } else if (profitGoal && !bankroll && effectiveDailyEv > 0) {
          // Suggest a bankroll to hit goal in a reasonable timeframe
          const targetDays = growthSpeed === "slow" ? 90 : growthSpeed === "fast" ? 20 : 45;
          recBankroll = Math.ceil(profitGoal / (effectiveDailyEv * targetDays));
        }
        // Recommended # of bets based on speed
        const recBetCount = growthSpeed === "slow" ? "1-2" : growthSpeed === "fast" ? "all rated games" : "2-4";
        return (
          <div style={{ margin: "6px 0 2px", padding: "14px 16px", background: "rgba(80,160,80,0.05)", borderRadius: 10, border: "1px solid rgba(80,160,80,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--moss)" }}>Bankroll Builder</span>
              <span style={{ fontSize: 11, color: "var(--dim)" }}>— bet sizing, risk management, and growth planning</span>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {gradedHistory.length > 0 && (
                  <span title={"Tracked P&L from " + gradedHistory.length + " settled Kalshi bet" + (gradedHistory.length === 1 ? "" : "s") + " in your history. This is informational — your bankroll is whatever you enter below."} style={{ cursor: "help", fontSize: 12, color: historyPL >= 0 ? "var(--moss)" : "var(--rose)", fontWeight: 700 }}>
                    History P&L: {historyPL >= 0 ? "+" : ""}${historyPL.toFixed(2)}
                  </span>
                )}
                <button
                  onClick={async () => {
                    setSyncingBalance(true); setSyncMsg(null);
                    try {
                      const d = await fetch("/api/desk/nrfi/kalshi-balance").then((r) => r.json());
                      if (d.balance != null) {
                        const v = Math.round(d.balance * 100) / 100;
                        setBankroll(v);
                        saveBankrollSettings({ startingBankroll: v, riskLevel, growthSpeed });
                        setSyncMsg({ ok: true, text: "Synced: $" + v.toFixed(2) });
                      } else {
                        setSyncMsg({ ok: false, text: d.error || "Could not fetch balance" });
                      }
                    } catch { setSyncMsg({ ok: false, text: "Network error" }); }
                    setSyncingBalance(false);
                    setTimeout(() => setSyncMsg(null), 4000);
                  }}
                  disabled={syncingBalance}
                  style={{ fontSize: 11, padding: "4px 10px", background: "rgba(80,160,80,0.12)", border: "1px solid rgba(80,160,80,0.35)", borderRadius: 6, color: "var(--moss)", cursor: syncingBalance ? "not-allowed" : "pointer", fontWeight: 700, opacity: syncingBalance ? 0.6 : 1 }}
                >
                  {syncingBalance ? "Syncing…" : "↻ Sync Kalshi Balance"}
                </button>
                {syncMsg && <span style={{ fontSize: 11, color: syncMsg.ok ? "var(--moss)" : "var(--rose)" }}>{syncMsg.text}</span>}
              </div>
            </div>
            {/* Row 1: inputs */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.08em" }}>BANKROLL</span>
                <div style={{ display: "flex", alignItems: "center", background: "var(--bg)", border: "1px solid rgba(120,130,150,.4)", borderRadius: 6, overflow: "hidden" }}>
                  <span style={{ padding: "0 8px", color: "var(--dim)", fontWeight: 700, borderRight: "1px solid rgba(120,130,150,.3)", lineHeight: "34px" }}>$</span>
                  <input type="number" min="0" placeholder="500" value={bankroll || ""} onChange={(e) => { const v = Number(e.target.value) || null; setBankroll(v); saveBankrollSettings({ startingBankroll: v, riskLevel, growthSpeed }); }}
                    style={{ width: 80, fontSize: 14, padding: "6px 8px", background: "transparent", border: "none", color: "var(--fg)", fontWeight: 700, outline: "none" }} />
                </div>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.08em" }}>RISK LEVEL</span>
                <select value={riskLevel} onChange={(e) => { setRiskLevel(e.target.value); saveBankrollSettings({ startingBankroll: bankroll, riskLevel: e.target.value, growthSpeed }); }}
                  style={{ fontSize: 12, padding: "6px 10px", background: "var(--bg)", border: "1px solid rgba(120,130,150,.4)", borderRadius: 6, color: "var(--fg)", height: 34 }}>
                  <option value="conservative">Conservative — smaller bets</option>
                  <option value="moderate">Moderate — balanced (recommended)</option>
                  <option value="aggressive">Aggressive — maximum sizing</option>
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.08em" }}>PROFIT GOAL</span>
                <div style={{ display: "flex", alignItems: "center", background: "var(--bg)", border: "1px solid rgba(120,130,150,.4)", borderRadius: 6, overflow: "hidden" }}>
                  <span style={{ padding: "0 8px", color: "var(--dim)", fontWeight: 700, borderRight: "1px solid rgba(120,130,150,.3)", lineHeight: "34px" }}>$</span>
                  <input type="number" min="0" placeholder="1000" value={profitGoal || ""} onChange={(e) => setProfitGoal(Number(e.target.value) || null)}
                    style={{ width: 80, fontSize: 14, padding: "6px 8px", background: "transparent", border: "none", color: "var(--fg)", fontWeight: 700, outline: "none" }} />
                </div>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.08em" }}>GROWTH SPEED</span>
                <select value={growthSpeed} onChange={(e) => { setGrowthSpeed(e.target.value); saveBankrollSettings({ startingBankroll: bankroll, riskLevel, growthSpeed: e.target.value }); }}
                  style={{ fontSize: 12, padding: "6px 10px", background: "var(--bg)", border: "1px solid rgba(120,130,150,.4)", borderRadius: 6, color: "var(--fg)", height: 34 }}>
                  <option value="slow">Slow &amp; safe — fewer bets, lower exposure</option>
                  <option value="steady">Steady — balanced approach</option>
                  <option value="fast">Fast — more bets, higher variance</option>
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.08em" }}>ALREADY OUT</span>
                <div style={{ display: "flex", alignItems: "center", background: "var(--bg)", border: "1px solid rgba(120,130,150,.4)", borderRadius: 6, overflow: "hidden" }}>
                  <span style={{ padding: "0 8px", color: "var(--dim)", fontWeight: 700, borderRight: "1px solid rgba(120,130,150,.3)", lineHeight: "34px" }}>$</span>
                  <input type="number" min="0" placeholder="0" value={amountOut || ""} onChange={(e) => setAmountOut(Number(e.target.value) || null)}
                    style={{ width: 80, fontSize: 14, padding: "6px 8px", background: "transparent", border: "none", color: "var(--fg)", fontWeight: 700, outline: "none" }} />
                </div>
              </label>
              {bankroll && amountOut != null && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.08em" }}>AVAILABLE</span>
                  <div style={{ fontSize: 20, fontWeight: 800, color: remaining <= 0 ? "var(--rose)" : remaining < bankroll * 0.15 ? "var(--amber)" : "var(--moss)", lineHeight: "34px" }}>
                    ${remaining.toFixed(0)}
                  </div>
                </div>
              )}
            </div>
            {/* Row 2: live stats */}
            {betRows.length > 0 && (
              <div style={{ display: "flex", gap: 0, flexWrap: "wrap", background: "rgba(255,255,255,0.04)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden", marginBottom: 10 }}>
                {[
                  { label: "BETS TODAY", value: betRows.length, color: "var(--moss)", tip: "Number of bet-rated games on today's slate" },
                  { label: "TOTAL AT RISK", value: totalBetAmt != null ? "$" + totalBetAmt.toFixed(0) : (totalBetPct * 100).toFixed(1) + "%", color: totalBetPct > 0.25 ? "var(--amber)" : "var(--fg)", tip: "Total of all suggested bets from your available $" + (remaining || 0).toFixed(0) + " (" + (totalBetPct * 100).toFixed(1) + "% of available balance)" },
                  { label: "AVG BET", value: totalBetAmt != null ? "$" + (totalBetAmt / betRows.length).toFixed(0) : ((totalBetPct / betRows.length) * 100).toFixed(1) + "%", color: "var(--fg)", tip: "Average suggested bet per game from available balance. Larger edge = larger bet." },
                  { label: "AVG EDGE", value: "+" + avgEdgePct.toFixed(1) + "%", color: avgEdgePct >= 5 ? "var(--moss)" : avgEdgePct >= 2 ? "var(--fg)" : "var(--dim)", tip: "Average model edge over the market across all bet-rated games today" },
                ].map((stat, i) => (
                  <div key={i} title={stat.tip} style={{ flex: "1 1 80px", padding: "10px 14px", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none", cursor: "help" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.1em", marginBottom: 3 }}>{stat.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                  </div>
                ))}
                {remaining && effectiveDailyEv > 0 && (
                  <div title={"Estimated daily profit based on your available $" + remaining.toFixed(0) + " at " + riskLevel + " risk. This is a mathematical expectation based on current edge — actual results will vary."} style={{ flex: "1 1 80px", padding: "10px 14px", cursor: "help" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.1em", marginBottom: 3 }}>EST. DAILY PROFIT</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "var(--moss)" }}>+${(remaining * effectiveDailyEv).toFixed(0)}</div>
                  </div>
                )}
              </div>
            )}
            {/* Row 2b: per-bet breakdown */}
            {betRows.length === 0 && alreadyHeld.length > 0 && (
              <div style={{ marginBottom: 10, padding: "10px 14px", background: "rgba(80,160,80,0.06)", borderRadius: 8, border: "1px solid rgba(80,160,80,0.2)", fontSize: 12, color: "var(--moss)", fontWeight: 600 }}>
                ✓ All {alreadyHeld.length} model picks are already in your open positions — nothing left to place today.
              </div>
            )}
            {betRows.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.08em" }}>TODAY'S NRFI BETS</span>
                  {alreadyHeld.length > 0 && <span style={{ fontSize: 10, color: "var(--moss)" }}>✓ {alreadyHeld.length} already placed — see open positions below</span>}
                  {allocationScale < 1 && <span style={{ fontSize: 10, color: "var(--amber)" }}>⚠ bets scaled to fit your available balance</span>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {betRows.map((r, i) => {
                    const scaledKelly = r.kelly * riskMult * allocationScale;
                    const betAmt = remaining ? Math.floor(remaining * scaledKelly * 100) / 100 : null;
                    const edge = r.market ? r.market.edge : null;
                    const awayA = r.awayAbbr || r.away;
                    const homeA = r.homeAbbr || r.home;
                    // Kalshi: NRFI = buy NO contracts. NO price = 100 - yesPrice cents.
                    const noPrice = r.market ? (100 - r.market.yesPrice) : null;
                    const contracts = (betAmt && noPrice && noPrice > 0) ? Math.floor(betAmt / (noPrice / 100)) : null;
                    const actualCost = (contracts && noPrice) ? (contracts * noPrice / 100) : betAmt;
                    const noPriceFmt = noPrice != null ? noPrice.toFixed(0) + "¢" : null;
                    return (
                      <div key={i} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.07)" }}>
                        {/* Top line: matchup + bet amount */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                          <span style={{ fontWeight: 800, fontSize: 14 }}>{awayA} @ {homeA}</span>
                          <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 800, background: "rgba(80,160,80,0.15)", color: "var(--moss)", border: "1px solid rgba(80,160,80,0.4)" }}>NRFI</span>
                          {edge != null && (
                            <span title="Model edge over the market on this game" style={{ cursor: "help", fontSize: 11, color: edge >= 5 ? "var(--moss)" : edge >= 2 ? "var(--fg)" : "var(--dim)", fontWeight: 700 }}>
                              +{edge.toFixed(1)}% edge
                            </span>
                          )}
                          <span title={"Model probability of no run in the 1st: " + (r.pFinal * 100).toFixed(1) + "%"} style={{ cursor: "help", fontSize: 11, color: "var(--dim)" }}>
                            {(r.pFinal * 100).toFixed(0)}% confidence
                          </span>
                          <span style={{ marginLeft: "auto", fontWeight: 900, fontSize: 18, color: "var(--moss)" }}>
                            {betAmt != null ? "$" + actualCost.toFixed(2) : (scaledKelly * 100).toFixed(1) + "%"}
                          </span>
                        </div>
                        {/* Bottom line: Kalshi order details */}
                        {r.market && (
                          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 11 }}>
                            <span style={{ color: "var(--dim)", fontFamily: "monospace", fontSize: 10 }}>{r.market.ticker}</span>
                            <span title="Buy NO contracts on Kalshi — NO wins if no run scores in the 1st inning (NRFI)" style={{ cursor: "help", fontWeight: 700, color: "var(--fg)", background: "rgba(255,255,255,0.07)", padding: "2px 7px", borderRadius: 4 }}>
                              Buy NO
                            </span>
                            {noPriceFmt && <span title={"Each NO contract costs " + noPriceFmt + ". Pays $1.00 if no run scores."} style={{ cursor: "help", color: "var(--dim)" }}>@ {noPriceFmt} each</span>}
                            {contracts != null && contracts > 0 && (
                              <span title={"Number of contracts to buy. " + contracts + " contracts × " + noPriceFmt + " = $" + actualCost.toFixed(2) + " total cost."} style={{ cursor: "help", fontWeight: 700, color: "var(--fg)" }}>
                                {contracts} contracts
                              </span>
                            )}
                            {contracts != null && contracts > 0 && (
                              <span title={"If NRFI hits: " + contracts + " contracts pay out $" + contracts.toFixed(0) + ". Profit: $" + (contracts - actualCost).toFixed(2) + "."} style={{ cursor: "help", color: "var(--moss)" }}>
                                → wins ${contracts.toFixed(0)} if NRFI
                              </span>
                            )}
                            <a href={r.market.link} target="_blank" rel="noreferrer" style={{ marginLeft: "auto", color: "var(--moss)", textDecoration: "none", fontWeight: 700 }}>
                              Open on Kalshi ↗
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Row 2c: current open Kalshi positions */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.08em" }}>OPEN KALSHI POSITIONS</span>
                <button
                  onClick={loadOpenPositions}
                  disabled={loadingPositions}
                  style={{ fontSize: 10, padding: "2px 8px", background: "rgba(120,130,150,0.12)", border: "1px solid rgba(120,130,150,0.3)", borderRadius: 4, color: "var(--dim)", cursor: loadingPositions ? "not-allowed" : "pointer", opacity: loadingPositions ? 0.6 : 1 }}
                >
                  {loadingPositions ? "Loading…" : openPositions ? "↻ Refresh" : "Load from Kalshi"}
                </button>
                {openPositions && !openPositions.error && openPositions.positions.length > 0 && (() => {
                  const totalToWin = openPositions.positions.reduce((s, p) => s + (p.estimatedPayout || 0), 0);
                  return (
                    <span style={{ fontSize: 11, color: "var(--dim)" }}>
                      {openPositions.positions.length} open · <span style={{ color: "var(--fg)" }}>${openPositions.totalExposure.toFixed(2)}</span> at risk · to win <span style={{ color: "var(--moss)", fontWeight: 700 }}>+${totalToWin.toFixed(2)}</span> · combined <span style={{ color: "var(--moss)", fontWeight: 700 }}>${(openPositions.totalExposure + totalToWin).toFixed(2)}</span>
                    </span>
                  );
                })()}
              </div>
              {openPositions && openPositions.error && (
                <div style={{ fontSize: 11, color: "var(--rose)", padding: "6px 10px", background: "rgba(220,60,60,0.08)", borderRadius: 6 }}>{openPositions.error}</div>
              )}
              {openPositions && !openPositions.error && openPositions.positions.length === 0 && (
                <div style={{ fontSize: 11, color: "var(--dim)", padding: "6px 10px" }}>No open NRFI positions found.</div>
              )}
              {openPositions && !openPositions.error && openPositions.positions.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {openPositions.positions.map((p, i) => {
                    const rlPnlColor = p.realizedPnl == null ? "var(--dim)" : p.realizedPnl >= 0 ? "var(--moss)" : "var(--rose)";
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 13px", background: "rgba(255,255,255,0.04)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.07)", flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 120 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{p.game}</div>
                          <div style={{ fontSize: 10, color: "var(--dim)", fontFamily: "monospace", marginTop: 1 }}>{p.ticker}</div>
                        </div>
                        <span
                          title={p.call === "NRFI" ? "You hold NO contracts — wins $1 per contract if the 1st inning ends scoreless." : "You hold YES contracts — wins $1 per contract if a run scores in the 1st inning."}
                          style={{ cursor: "help", padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 800, background: p.call === "NRFI" ? "rgba(80,160,80,0.15)" : "rgba(220,60,60,0.15)", color: p.call === "NRFI" ? "var(--moss)" : "var(--rose)", border: "1px solid " + (p.call === "NRFI" ? "rgba(80,160,80,0.4)" : "rgba(220,60,60,0.4)") }}
                        >
                          {p.call}
                        </span>
                        {p.contracts > 0 && (
                          <div title={"Number of contracts held. Each contract pays out $1 if your call is correct."} style={{ cursor: "help", textAlign: "center" }}>
                            <div style={{ fontSize: 10, color: "var(--dim)", marginBottom: 1 }}>CONTRACTS</div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{p.contracts}</div>
                          </div>
                        )}
                        {p.totalCost != null && (
                          <div title={"Total amount at risk on this position. If your call is wrong, you lose this amount."} style={{ cursor: "help", textAlign: "center" }}>
                            <div style={{ fontSize: 10, color: "var(--dim)", marginBottom: 1 }}>AT RISK</div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>${p.totalCost.toFixed(2)}</div>
                          </div>
                        )}
                        {p.estimatedPayout != null && p.estimatedPayout > 0 && (
                          <div title={"Estimated profit if your call hits — what you'd collect above your stake."} style={{ cursor: "help", textAlign: "center" }}>
                            <div style={{ fontSize: 10, color: "var(--dim)", marginBottom: 1 }}>WIN PROFIT</div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--moss)" }}>+${p.estimatedPayout.toFixed(2)}</div>
                          </div>
                        )}
                        {p.realizedPnl != null && (
                          <div title={"Realized P&L from closed portions of this position."} style={{ cursor: "help", textAlign: "center" }}>
                            <div style={{ fontSize: 10, color: "var(--dim)", marginBottom: 1 }}>REALIZED P&L</div>
                            <div style={{ fontWeight: 800, fontSize: 14, color: rlPnlColor }}>{p.realizedPnl >= 0 ? "+" : ""}${p.realizedPnl.toFixed(2)}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {/* Row 3: goal planner output */}
            {profitGoal > 0 && (
              <div style={{ padding: "10px 14px", background: "rgba(120,130,150,0.07)", borderRadius: 8, border: "1px solid rgba(120,130,150,0.15)", fontSize: 12 }}>
                <div style={{ fontWeight: 700, color: "var(--fg)", marginBottom: 6, fontSize: 13 }}>Goal Planner — ${profitGoal.toLocaleString()} target</div>
                {betRows.length === 0 || effectiveDailyEv <= 0 ? (
                  <div style={{ color: "var(--dim)" }}>Run a scan first to see edge-based projections for your goal.</div>
                ) : recBankroll ? (
                  <div style={{ color: "var(--dim)" }}>
                    <span style={{ color: "var(--moss)", fontWeight: 700 }}>Suggested starting bankroll: ${recBankroll.toLocaleString()}</span>
                    {" "}— at {riskLevel} risk and {growthSpeed} speed, you'd reach ${profitGoal.toLocaleString()} in roughly{" "}
                    <b style={{ color: "var(--fg)" }}>{growthSpeed === "slow" ? "90" : growthSpeed === "fast" ? "20" : "45"} days</b>.
                    {" "}Recommended bets per day: <b style={{ color: "var(--fg)" }}>{recBetCount}</b>.
                  </div>
                ) : daysToGoal ? (
                  <div>
                    <div style={{ color: "var(--dim)", marginBottom: 4 }}>
                      At <b style={{ color: "var(--fg)" }}>{riskLevel}</b> risk and <b style={{ color: "var(--fg)" }}>{growthSpeed}</b> speed with a ${bankroll.toLocaleString()} bankroll:
                    </div>
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.08em" }}>ESTIMATED DAYS</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: daysToGoal > 90 ? "var(--amber)" : "var(--moss)" }}>{daysToGoal > 365 ? "365+" : daysToGoal}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.08em" }}>DAILY PROFIT TARGET</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--fg)" }}>${(bankroll * effectiveDailyEv).toFixed(0)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.08em" }}>BETS PER DAY</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--fg)" }}>{recBetCount}</div>
                      </div>
                    </div>
                    {daysToGoal > 90 && (
                      <div style={{ marginTop: 6, color: "var(--amber)", fontSize: 11 }}>
                        ⚠ This will take over {Math.round(daysToGoal / 30)} months at current pace.
                        {riskLevel !== "aggressive" ? " Try increasing risk level or speed to reach your goal faster." : " Consider setting a lower goal or larger starting bankroll."}
                      </div>
                    )}
                    {daysToGoal <= 14 && (
                      <div style={{ marginTop: 6, color: "var(--amber)", fontSize: 11 }}>
                        ⚠ Projecting under 2 weeks — this requires sustained high edge. Real results will vary. Never bet more than you can afford to lose.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
            {/* AI assistant insights */}
            {aiInsights.length > 0 && (
              <div style={{ marginTop: 10, padding: "10px 14px", background: "rgba(120,130,150,0.06)", borderRadius: 8, border: "1px solid rgba(120,130,150,0.12)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.08em", marginBottom: 8 }}>ASSISTANT RECOMMENDATIONS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {aiInsights.map((ins, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12 }}>
                      <span style={{ color: ins.type === "good" ? "var(--moss)" : ins.type === "warn" ? "var(--amber)" : "var(--dim)", fontSize: 14, lineHeight: 1, flexShrink: 0 }}>
                        {ins.type === "good" ? "✓" : ins.type === "warn" ? "⚠" : "·"}
                      </span>
                      <span style={{ color: ins.type === "warn" ? "var(--amber)" : "var(--fg)", lineHeight: 1.4 }}>{ins.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Row 4: advice */}
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--dim)", lineHeight: 1.5 }}>
              {riskLevel === "conservative" ? "Conservative: smaller bets keep variance low. Ideal for new bettors or uncertain slates." : riskLevel === "aggressive" ? "Aggressive: maximum sizing for your edge. Highest long-run growth but also highest day-to-day swings." : "Moderate: a solid middle ground — lets your edge compound without ruinous variance."}
              {totalBetPct > 0.25 && <span style={{ color: "var(--amber)", marginLeft: 6 }}>⚠ Over 25% of bankroll at risk today — consider lowering risk level.</span>}
            </div>
          </div>
        );
      })()}
      {phase === "scanning" && <p className="help">Researching {prog && prog.total ? prog.done + "/" + prog.total : ""} games — pulling splits, lineups, travel &amp; weather…</p>}
      {err && <p className="help" style={{ color: "var(--rose)" }}>Couldn't build the board: {err}</p>}
      {phase === "done" && sellers.length > 0 && sellers.every((s) => !s.active) && <p className="help" style={{ color: "var(--amber)" }}>No active seller subscriptions — showing the model board only.</p>}
      {phase === "done" && rows.length === 0 && <p className="help">No MLB games on today's slate.</p>}
      {rows.length > 0 && (
        <div style={{ marginTop: 6, marginBottom: 2, padding: "8px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 6, fontSize: 12, color: "var(--dim)", lineHeight: 1.7 }}>
          <div><b style={{ color: "var(--fg)" }}>Confidence:</b>{" "}
            <b style={{ color: "var(--moss)" }}>★ BET</b> ≥70% · <b style={{ color: "var(--moss)" }}>BET</b> ≥63% · <b style={{ color: "var(--amber)" }}>LEAN</b> ≥57% · <b style={{ color: "var(--dim)" }}>PASS</b> = too close.
            {" "}<b style={{ color: "var(--fg)" }}>NRFI</b> = no run in the 1st inning. <b style={{ color: "var(--fg)" }}>YRFI</b> = a run scores.
          </div>
          <div><b style={{ color: "var(--fg)" }}>Pitcher badge</b> (e.g. <span style={{ fontWeight: 700, fontSize: 11, color: "var(--moss)", border: "1px solid var(--moss)", borderRadius: 3, padding: "0 3px" }}>A+</span>): 1st-inning grade — A+/A = elite suppressor, B = solid, C = average, D/F = hitter-friendly. Hover for detail.</div>
          <div><b style={{ color: "var(--fg)" }}>Park badge:</b>{" "}
            <span style={{ color: "var(--moss)", fontWeight: 700 }}>PITCHER FRIENDLY</span> = park+weather suppress runs ·{" "}
            <span style={{ color: "var(--rose)", fontWeight: 700 }}>HITTER FRIENDLY</span> = park+weather inflate runs. Hover for detail.
          </div>
          <div><span style={{ color: "var(--amber)", fontWeight: 700 }}>⚠ LINEUPS PENDING</span> = official lineup not yet posted; model uses projected order (less reliable).</div>
          <div><b style={{ color: "var(--fg)" }}>Bet Size</b> (shown per card) = suggested wager as % of bankroll, sized to your edge. Larger edge = larger recommended bet. Enter your bankroll in Bankroll Builder above to see dollar amounts.</div>
          <div><b style={{ color: "var(--fg)" }}>1st-inn offense</b> = each team's season YRFI rate (Poisson estimate from avg runs scored in the 1st). Red = high-scoring, green = low-scoring team.</div>
          <div><b style={{ color: "var(--fg)" }}>↑/↓ MKT</b> = market moved ≥5 pts since first page load. Indicates smart money flow between your sessions.</div>
        </div>
      )}
      {parlayPairs.length > 0 && (
        <div className="panel" style={{ marginTop: 12, border: "1px solid rgba(80,160,80,0.3)", background: "rgba(80,160,80,0.04)" }}>
          <p className="sect" style={{ margin: 0, color: "var(--moss)" }}>Correlated NRFI parlays ({parlayPairs.length} pair{parlayPairs.length !== 1 ? "s" : ""})</p>
          <p style={{ fontSize: 11, color: "var(--dim)", margin: "4px 0 8px" }}>These pairs are strong NRFI signals with solid pitcher grades on both sides — correlated independence assumed.</p>
          {parlayPairs.map((pair, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: i > 0 ? "1px solid rgba(120,130,150,.12)" : "none", fontSize: 12 }}>
              <span style={{ color: "var(--moss)", fontWeight: 700 }}>★</span>
              <span>{pair.a.away} @ {pair.a.home} ({pair.a.pMax.toFixed(0)}% NRFI)</span>
              <span style={{ color: "var(--dim)" }}>+</span>
              <span>{pair.b.away} @ {pair.b.home} ({pair.b.pMax.toFixed(0)}% NRFI)</span>
              <span style={{ color: "var(--dim)" }}>= ~{pair.combProb}% parlay hit</span>
            </div>
          ))}
        </div>
      )}
      {sect("Sharps tailing (your subs)", tailed, "var(--amber)")}
      {sect("Bets — ranked by confidence", [...betNRFI, ...betYRFI].sort(byConf), "var(--moss)")}
      {sect("Leans", leans, "var(--amber)")}
      {sect("Pass", passes, "var(--dim)")}
    </div>
  );
}

function Picks({ ledger, onPick }) {
  // Warm start: the last scan renders instantly while a fresh one runs.
  // Validate every cached entry — a stale cache written by an older build
  // must never be able to crash the first render.
  const [picks, setPicks] = useState(() => {
    try {
      const c = JSON.parse(localStorage.getItem("cd:lastPicks") || "null");
      if (c && Date.now() - c.at < 30 * 60 * 1000 && Array.isArray(c.picks)) {
        return c.picks.filter((p) => p && p.market && p.id &&
          Number.isFinite(p.modelProb) && Number.isFinite(p.entry) && Number.isFinite(p.edge));
      }
    } catch { /* cold start */ }
    return [];
  });
  const [state, setState] = useState("idle");
  const [err, setErr] = useState(null);
  const [scanInfo, setScanInfo] = useState(null);
  const [record, setRecord] = useState(null); // graded winner-pick history
  const [totals, setTotals] = useState([]);   // over/under reads
  const recordRef = useRef(null);
  const anyLive = useRef(false);

  // Load the picks record once; reconcile against the current scan when
  // both sides are ready.
  const picksRef = useRef(picks);
  picksRef.current = picks;
  useEffect(() => {
    fetch("/api/desk/picks").then((r) => r.json())
      .then((d) => {
        recordRef.current = d.record || []; setRecord(recordRef.current);
        // Grade immediately on load — the scoreboard back-fill works even
        // before (or without) a scan completing.
        reconcileRecord(picksRef.current || []);
      })
      .catch(() => { recordRef.current = []; setRecord([]); });
  }, []);

  // Log every pregame call the board makes, and grade calls whose games
  // have finished — the winner-picks track record builds itself.
  async function reconcileRecord(allPicks) {
    if (!recordRef.current) return;
    const rec = recordRef.current.slice();
    const changed = [];
    const todayEt = etDate().replace(/-/g, "");
    const byGame = {};
    allPicks.forEach((p) => {
      const k = p.game || p.id;
      if (!byGame[k] || p.modelProb > byGame[k].modelProb) byGame[k] = p;
    });
    Object.values(byGame).forEach((p) => {
      if (p.state !== "pre" || p.modelProb < 55 || p.src !== "book" || (p.books || 0) < 2 || !p.eventId) return;
      const id = "pk-" + p.eventId;
      if (rec.some((r) => r.id === id)) return;
      const e = { id, at: Date.now(), date: tickerDate(p.market.id), league: p.league, path: p.path,
        game: p.game, eventId: p.eventId, pick: p.market.name, pickCode: (p.codes || [])[0] || null,
        prob: Math.round(p.modelProb * 10) / 10, books: p.books, result: null };
      rec.unshift(e); changed.push(e);
    });
    const byEvent = {};
    allPicks.forEach((p) => { if (p.eventId) byEvent[p.eventId] = p; });
    rec.forEach((r) => {
      if (r.result != null) return;
      const p = byEvent[r.eventId];
      if (!p || p.state !== "post" || !p.sides) return;
      const w = gameWinnerAbbr(p.sides);
      if (!w) return;
      r.result = pickWon(r.pickCode, w) ? "won" : "lost";
      r.final = p.sides.map((s) => s.abbr + " " + (s.score != null ? s.score : "-")).join(" ");
      changed.push(r);
    });
    // Settled games fall off the scan (their Kalshi markets close), and a
    // game finishing TONIGHT still carries today's date — grade every
    // pending entry that isn't currently visible as a pre/live game
    // straight from the scoreboard, a batch per cycle.
    const stale = rec.filter((r) => {
      if (r.result != null || !r.date || r.date > todayEt) return false;
      const inScan = byEvent[r.eventId];
      return !inScan || inScan.state === "post"; // pre/in games aren't done — skip the fetch
    }).slice(0, 10);
    for (const r of stale) {
      try {
        const gs = await espnGamesForLeague(r.path, r.date);
        const g = gs.find((x) => x.eventId === r.eventId);
        if (g && g.state === "post" && g.sides) {
          const w = gameWinnerAbbr(g.sides);
          if (w) {
            r.result = pickWon(r.pickCode, w) ? "won" : "lost";
            r.final = g.sides.map((s) => s.abbr + " " + (s.score != null ? s.score : "-")).join(" ");
            changed.push(r);
          }
        } else if (Date.now() - (r.at || 0) > 5 * 86400000) {
          r.result = "void"; changed.push(r); // postponed or untraceable
        }
      } catch { /* grade next cycle */ }
    }
    recordRef.current = rec;
    if (changed.length) {
      setRecord(rec.slice());
      try {
        await fetch("/api/desk/picks", { method: "POST",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify(changed) });
      } catch { /* re-sent next cycle */ }
    }
  }

  async function run() {
    setState("loading"); setErr(null);
    try {
      const [{ picks: p, gamesFound, gamesPriced }, tot] = await Promise.all([
        scanEdges(),
        scanTotals().catch(() => []),
      ]);
      setPicks(p); setTotals(tot);
      setScanInfo({ gamesFound, gamesPriced, at: Date.now() }); setState("done");
      try { localStorage.setItem("cd:lastPicks", JSON.stringify({ at: Date.now(), picks: p })); } catch { /* private mode */ }
      reconcileRecord(p);
      anyLive.current = p.some((x) => x.state === "in") || tot.some((x) => x.state === "in");
      if (!p.length) {
        setErr(gamesFound === 0
          ? "No open game markets right now — the next slate isn't listed on Kalshi yet."
          : "Found " + gamesFound + " games, but books haven't posted lines yet. Picks fill in about a day before game time.");
      }
    } catch (e) { setErr("Scan failed: " + e.message); setState("idle"); }
  }
  // Auto-refresh: every 45 seconds while games are live (win probs, scores
  // and clocks move play by play), every 5 minutes otherwise. The odds feed
  // is cached server-side, so the fast cadence doesn't burn credits.
  useEffect(() => {
    let alive = true, timer = null;
    const loop = async () => {
      await run();
      if (!alive) return;
      timer = setTimeout(loop, anyLive.current ? 45000 : 300000);
    };
    loop();
    const onVis = () => { if (!document.hidden) { if (timer) clearTimeout(timer); loop(); } };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  // WINNER-centric: for each game keep the side the books/models say WINS
  // (highest true probability) — price and value are secondary notes.
  const groups = useMemo(() => {
    const byGame = {};
    picks.forEach((p) => {
      if (p.src === "pregame-line") return; // stale mid-game line — no honest winner read
      const k = p.game || p.id;
      if (!byGame[k] || p.modelProb > byGame[k].modelProb) byGame[k] = p;
    });
    const rows = Object.values(byGame);
    const todayEt = etDate().replace(/-/g, "");
    const g = { live: [], today: [], soon: [] };
    rows.forEach((p) => {
      const d = tickerDate(p.market.id);
      if (p.state === "in") g.live.push(p);
      else if (d === todayEt) g.today.push(p);
      else g.soon.push(p);
    });
    g.live.sort((a, b) => b.modelProb - a.modelProb);
    g.today.sort((a, b) => b.modelProb - a.modelProb);
    g.soon.sort((a, b) => ((tickerDate(a.market.id) || "").localeCompare(tickerDate(b.market.id) || "")) || b.modelProb - a.modelProb);
    // Top picks: the most certain winners on today's card (live included).
    g.top = [...g.live, ...g.today].filter((p) => p.modelProb >= 65)
      .sort((a, b) => b.modelProb - a.modelProb).slice(0, 6);
    return g;
  }, [picks]);

  const analysisFor = (p) => (ledger || []).find((x) =>
    x.venue === "Kalshi" && x.marketId === p.id && x.call && x.call !== "SYNCED") || null;

  // Books disagreeing with each other is real uncertainty — a split line
  // caps the tier at LEAN no matter how high the average sits.
  const tier = (p) => {
    if (p.disp > 6 && p.modelProb >= 55) return { t: "LEAN · BOOKS SPLIT", cls: "t-lean", c: "var(--amber)" };
    return p.modelProb >= 80 ? { t: "STRONGEST", cls: "t-strongest", c: "var(--moss)" }
      : p.modelProb >= 68 ? { t: "STRONG", cls: "t-strong", c: "var(--moss)" }
      : p.modelProb >= 55 ? { t: "LEAN", cls: "t-lean", c: "var(--amber)" }
      : { t: "TOSS-UP", cls: "", c: "var(--dim)" };
  };

  const row = (p, rank) => {
    const tr = tier(p);
    const an = analysisFor(p);
    const dec = pickDecision(p);
    const n = p.edge - (p.fee || 0);
    return (
      <div key={p.id} className={"pick " + tr.cls}>
        {rank != null && <span className="rank">{rank}</span>}
        <span style={{ minWidth: 0, flex: 1 }}>
          <span className="who-big" style={{ display: "block" }}>
            {p.state === "in" ? <span className="livedot" /> : null}
            {p.market.name === p.market.question ? p.market.question : p.market.name}
          </span>
          <span className="meta-line" style={{ display: "block" }}>
            {p.league} · {p.state === "in" && p.sides && p.sides.some((s) => s.score != null)
              ? <b style={{ color: "var(--bone)" }}>{p.sides.map((s) => s.abbr + " " + (s.score != null ? s.score : "-")).join(" · ") + (p.detail ? " · " + p.detail : "")}</b>
              : p.game}
            {" · "}{p.src === "live" ? "live model"
              : p.src === "live-books" ? "in-play books"
              : p.src === "model" ? "model projection"
              : p.books + " book" + (p.books === 1 ? "" : "s") + " consensus"}
            {" · market consensus " + p.entry.toFixed(0) + "%"}
            {an && <span style={{ color: an.call.indexOf("BUY") === 0 ? "var(--amber)" : "var(--dim)" }}>
              {" · analysis: " + an.call + (an.confidence ? " (" + an.confidence.toLowerCase() + ")" : "")}</span>}
          </span>
          {(p.ou || p.spr) && (
            <span className="meta-line" style={{ display: "block" }}>
              {p.ou && <>
                O/U {p.ou.point}:{" "}
                <b style={{ color: p.ou.a >= 55 || p.ou.b >= 55 ? "var(--amber)" : "var(--dim)" }}>
                  {p.ou.a >= 55 ? "OVER (" + p.ou.a.toFixed(0) + "%)"
                    : p.ou.b >= 55 ? "UNDER (" + p.ou.b.toFixed(0) + "%)"
                    : "coin flip"}
                </b>
                {" · " + p.ou.books + " books"}
              </>}
              {p.spr && <>
                {p.ou ? " · " : ""}spread {(p.homeAbbr || "home")} {p.spr.point > 0 ? "+" : ""}{p.spr.point}:{" "}
                <b style={{ color: p.spr.a >= 55 || p.spr.b >= 55 ? "var(--amber)" : "var(--dim)" }}>
                  {p.spr.a >= 55 ? (p.homeAbbr || "home") + " covers (" + p.spr.a.toFixed(0) + "%)"
                    : p.spr.b >= 55 ? (p.awayAbbr || "away") + " covers (" + p.spr.b.toFixed(0) + "%)"
                    : "coin flip"}
                </b>
              </>}
            </span>
          )}
        </span>
        <span className="tierbox" style={{ color: tr.c, borderColor: tr.c }}>
          <span className="pct">{p.modelProb.toFixed(0)}%</span>
          <span className="lbl">{tr.t}</span>
        </span>
        <span className="pick-actions">
          <button className="chip" onClick={() => onPick(p.market)} title="Run every check on this pick">deep dive</button>
          <a className="chip" href={p.market.link} target="_blank" rel="noreferrer">open ↗</a>
        </span>
      </div>
    );
  };

  const section = (title, arr, color, ranked) => arr.length > 0 && (
    <div className="panel">
      <p className="sect" style={{ margin: 0, color }}>{title} ({arr.length})</p>
      <div style={{ marginTop: 6 }}>{arr.map((p, i) => row(p, ranked ? i + 1 : null))}</div>
    </div>
  );

  const strongest = groups.top.filter((p) => p.modelProb >= 80).length;

  return (
    <>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
          <p className="sect" style={{ margin: 0 }}>Today's predictions — who wins</p>
          <button className="btn btn-ghost btn-sm" onClick={run} disabled={state === "loading"}>
            {state === "loading" ? "Scanning" : "Rescan"}
          </button>
        </div>
        <p className="help" style={{ marginTop: 6 }}>
          The projected winner of every event on the board — by the de-vigged consensus of every sportsbook, the
          live win-probability models, and your full analyses where you've run them.{" "}
          <b>{groups.top.length
            ? groups.top.length + " top pick" + (groups.top.length === 1 ? "" : "s") + " today" + (strongest ? ", " + strongest + " at 80%+ certainty." : ".")
            : "No high-certainty winners on today's card yet."}</b>{" "}
          Deep dive runs all nine checks on any pick.
        </p>
        {(() => {
          const scored = (record || []).filter((r) => r.result === "won" || r.result === "lost");
          const pending = (record || []).filter((r) => r.result == null).length;
          const wins = scored.filter((r) => r.result === "won").length;
          const strong = scored.filter((r) => (r.prob || 0) >= 80);
          const strongWins = strong.filter((r) => r.result === "won").length;
          return (scanInfo || scored.length > 0 || pending > 0) && (
            <div className="chips" style={{ marginTop: 8 }}>
              {scored.length > 0 && (
                <span className="chip static" style={{ color: wins * 2 >= scored.length ? "var(--moss)" : "var(--rose)",
                  borderColor: "rgba(127,185,139,.45)" }}
                  title="Every pregame winner call this board makes is logged and graded when the game ends">
                  Board's calls: {wins}-{scored.length - wins} ({Math.round((wins / scored.length) * 100)}%)
                </span>
              )}
              {pending > 0 && (
                <span className="chip static" title="Logged pregame calls waiting for their games to finish — they grade automatically">
                  {pending} pick{pending === 1 ? "" : "s"} awaiting results
                </span>
              )}
              {strong.length > 0 && (
                <span className="chip static" title="Calls made at 80%+ certainty">
                  80%+ tier: {strongWins}-{strong.length - strongWins}
                </span>
              )}
              {scanInfo && <span className="chip static">{scanInfo.gamesPriced} of {scanInfo.gamesFound} games priced</span>}
              {scanInfo && scanInfo.at && <span className="chip static">updated {new Date(scanInfo.at).toLocaleTimeString()}</span>}
              {anyLive.current && <span className="chip static" style={{ color: "var(--rose)", borderColor: "rgba(228,112,126,.5)" }}>● live — refreshing every 45s</span>}
              {oddsQuota && <span className="chip static">odds feed · {oddsQuota.remaining} credits</span>}
            </div>
          );
        })()}
        {state === "loading" && picks.length === 0 && <p className="pwait" style={{ marginTop: 10 }}><span className="dots">reading the books on every game</span></p>}
        {err && <p className="help" style={{ marginTop: 10, color: "var(--rose)" }}>{err}</p>}
      </div>
      {section("Top picks today", groups.top, "var(--amber)", true)}
      {section("● Live now", groups.live, "var(--rose)")}
      {section("Today — every game", groups.today, undefined)}
      {totals.length > 0 && (
        <div className="panel">
          <p className="sect" style={{ margin: 0 }}>Over / Unders ({totals.length})</p>
          <p className="help" style={{ marginTop: 6 }}>
            Kalshi's total-score markets read against the books' de-vigged totals consensus — the call is OVER or
            UNDER at the line, with live scoring pace as a sanity check during games.
          </p>
          <div style={{ marginTop: 6 }}>
            {totals.map((t) => {
              const over = t.pOver >= 50;
              const conf = Math.max(t.pOver, 100 - t.pOver);
              const cls = conf >= 68 ? "t-strong" : conf >= 55 ? "t-lean" : "";
              const col = conf >= 68 ? "var(--moss)" : conf >= 55 ? "var(--amber)" : "var(--dim)";
              const overCost = t.entry, underCost = t.entry != null ? 100 - t.entry : null;
              return (
                <div key={t.id} className={"pick " + cls}>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="who-big" style={{ display: "block" }}>
                      {t.state === "in" ? <span className="livedot" /> : null}
                      <span style={{ color: col }}>{conf >= 55 ? (over ? "OVER " : "UNDER ") : "Total "}</span>
                      {t.line}{conf < 55 ? " — coin flip" : ""}
                    </span>
                    <span className="meta-line" style={{ display: "block" }}>
                      {t.league} · {t.state === "in" && t.sides && t.sides.some((s) => s.score != null)
                        ? <b style={{ color: "var(--bone)" }}>{t.sides.map((s) => s.abbr + " " + (s.score != null ? s.score : "-")).join(" · ") + (t.detail ? " · " + t.detail : "")}</b>
                        : t.game}
                      {" · " + t.books + " book" + (t.books === 1 ? "" : "s")}
                      {!t.exact ? " · books' line is " + t.bookLine + " (nearest Kalshi strike shown)" : ""}
                      {" · market: over " + (overCost != null ? overCost.toFixed(0) + "%" : "—") +
                        ", under " + (underCost != null ? underCost.toFixed(0) + "%" : "—")}
                    </span>
                    {t.pace && (
                      <span className="meta-line" style={{ display: "block" }}>
                        pace: <b style={{ color: t.pace.projected > t.line ? "var(--amber)" : "var(--cyan)" }}>
                          {t.pace.total} so far, on pace for ~{t.pace.projected.toFixed(0)}
                        </b> vs the {t.line} line
                      </span>
                    )}
                  </span>
                  <span className="tierbox" style={{ color: col, borderColor: col }}>
                    <span className="pct">{conf.toFixed(0)}%</span>
                    <span className="lbl">{conf >= 55 ? (over ? "OVER" : "UNDER") : "TOSS-UP"}</span>
                  </span>
                  <span className="pick-actions">
                    <button className="chip" onClick={() => onPick(t.market)}>deep dive</button>
                    <a className="chip" href={t.market.link} target="_blank" rel="noreferrer">open ↗</a>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {section("Coming up", groups.soon, "var(--dim)")}
      {record && record.some((r) => r.result === "won" || r.result === "lost") && (
        <div className="panel">
          <details className="fold" open>
            <summary>The board's call record — every pregame pick it made, graded (this is the app's record, not your bets — those live in My trades)</summary>
            {record.filter((r) => r.result === "won" || r.result === "lost").slice(0, 12).map((r) => (
              <div key={r.id} className="score-row" style={{ borderBottom: "1px solid rgba(65,75,99,.35)" }}>
                <span className="who" style={{ fontSize: 13 }}>
                  {r.pick}
                  <span className="sub" style={{ display: "block" }}>
                    {r.league} · {r.game} · called at {r.prob}%{r.final ? " · final " + r.final : ""}
                  </span>
                </span>
                <span className="pts" style={{ fontSize: 13.5, color: r.result === "won" ? "var(--moss)" : "var(--rose)" }}>
                  {r.result.toUpperCase()}
                </span>
              </div>
            ))}
            <p className="help" style={{ marginTop: 8 }}>
              Every pregame call the board makes gets logged and graded automatically. The tiers should win at
              roughly their stated rates — an 80% call that wins 60% of the time means the reads are off.
            </p>
          </details>
        </div>
      )}
    </>
  );
}

function Parlay({ onPick }) {
  const [picks, setPicks] = useState([]);
  const [state, setState] = useState("idle");
  const [err, setErr] = useState(null);
  const [slip, setSlip] = useState([]);
  const [view, setView] = useState("locks"); // locks | value | live
  const [minEdge, setMinEdge] = useState(3);
  const [sugLegs, setSugLegs] = useState(3);
  const [sugMode, setSugMode] = useState("safe"); // safe (most likely) | value
  const [kp, setKp] = useState(null);        // Kalshi combined-parlay preview
  const [kpBusy, setKpBusy] = useState(false);
  const [kpCount, setKpCount] = useState(10);
  const [kpConfirm, setKpConfirm] = useState(false);
  const [kpResult, setKpResult] = useState(null);

  const [scanInfo, setScanInfo] = useState(null);
  async function run() {
    setState("loading"); setErr(null);
    try {
      const { picks: p, gamesFound, gamesPriced } = await scanEdges();
      setPicks(p);
      setScanInfo({ gamesFound, gamesPriced });
      setState("done");
      if (!p.length) {
        setErr(gamesFound === 0
          ? "No open game markets to scan right now — the next slate isn't listed on Kalshi yet. Check back closer to game day."
          : "Found " + gamesFound + " upcoming game" + (gamesFound === 1 ? "" : "s") + ", but sportsbooks haven't posted lines for " +
            (gamesPriced === 0 ? "them" : "most") + " yet. Betting lines appear roughly a day before game time — rescan then and picks will fill in.");
      }
    } catch (e) {
      setErr("Scan failed: " + e.message);
      setState("idle");
    }
  }
  useEffect(() => { run(); }, []);
  // If a scan turns up live games, jump to that view — it's what you came for.
  const jumped = useRef(false);
  useEffect(() => {
    if (!jumped.current && picks.some((p) => p.state === "in")) { jumped.current = true; setView("live"); }
  }, [picks]);

  const inSlip = (id) => slip.some((l) => l.id === id);
  const toggle = (p) => setSlip((s) => inSlip(p.id) ? s.filter((l) => l.id !== p.id)
    : s.length >= 8 ? s : [...s, { id: p.id, market: p.market, modelProb: p.modelProb, entry: p.entry, codes: p.codes, game: p.game }]);

  // Reset any Kalshi preview whenever the legs change.
  useEffect(() => { setKp(null); setKpConfirm(false); setKpResult(null); }, [slip]);

  const allKalshi = slip.length >= 2 && slip.every((l) => l.market.venue === "Kalshi");

  async function previewKalshi() {
    setKpBusy(true); setKpResult(null); setKpConfirm(false);
    try {
      const r = await fetch("/api/desk/kalshi/parlay", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: slip.map((l) => l.market.id), place: false }),
      });
      const d = await r.json();
      setKp(d.error ? { error: d.error } : d);
    } catch (e) { setKp({ error: e.message }); }
    setKpBusy(false);
  }

  async function placeKalshi() {
    setKpBusy(true); setKpResult(null);
    try {
      const r = await fetch("/api/desk/kalshi/parlay", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: slip.map((l) => l.market.id), count: kpCount, place: true }),
      });
      const d = await r.json();
      setKpResult(d.ok
        ? { ok: true, msg: "Parlay placed on Kalshi — bought " + d.count + " contracts. Check My trades / your Kalshi account." }
        : { ok: false, msg: d.error || "Order failed." });
      setKpConfirm(false);
    } catch (e) { setKpResult({ ok: false, msg: e.message }); }
    setKpBusy(false);
  }

  const liveCount = useMemo(() => new Set(picks.filter((p) => p.state === "in").map((p) => p.game)).size, [picks]);

  const shown = useMemo(() => {
    // One row per game — the single side worth betting — so it's never
    // ambiguous which way to wager. Value/live rank by edge; favorites by
    // win probability.
    const dedupe = (arr, better) => {
      const byGame = {};
      arr.forEach((p) => { const k = p.game || p.id; if (!byGame[k] || better(p, byGame[k])) byGame[k] = p; });
      return Object.values(byGame);
    };
    if (view === "live") {
      return dedupe(picks.filter((p) => p.state === "in"), (p, c) => p.edge > c.edge)
        .sort((a, b) => b.edge - a.edge).slice(0, 40);
    }
    if (view === "value") {
      return dedupe(picks, (p, c) => p.edge > c.edge).filter((p) => p.edge >= minEdge)
        .sort((a, b) => b.edge - a.edge).slice(0, 25);
    }
    // Every game, every sport — the predicted winner of each, ranked by
    // certainty. A 70% floor was silently hiding whole sports (soccer and
    // tennis favorites rarely clear 70).
    return dedupe(picks, (p, c) => p.modelProb > c.modelProb)
      .sort((a, b) => b.modelProb - a.modelProb).slice(0, 60);
  }, [picks, view, minEdge]);

  const pm = parlayMath(slip);
  const conflicts = parlayConflicts(slip);

  // Best parlay per day: group priced games by their slate date, build a
  // suggestion for each, soonest first.
  const byDay = useMemo(() => {
    const groups = {};
    picks.forEach((p) => { const d = tickerDate(p.market.id); if (d) (groups[d] = groups[d] || []).push(p); });
    return Object.entries(groups)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, ps]) => ({ date, legs: suggestParlay(ps, sugLegs, sugMode) }))
      .filter((x) => x.legs.length >= 2);
  }, [picks, sugLegs, sugMode]);

  return (
    <>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
          <p className="sect" style={{ margin: 0 }}>Build a parlay</p>
          <button className="btn btn-ghost btn-sm" onClick={run} disabled={state === "loading"}>
            {state === "loading" ? "Scanning" : "Rescan"}
          </button>
        </div>
        <p className="help" style={{ marginTop: 6 }}>
          Every open game is checked against the sportsbook's de-vigged line — a fair, free read on who's really
          favored. Tap picks to stack them; the slip works out the combined odds and whether the parlay is a good bet.
          This scan costs nothing.
        </p>
        <div className="chips" style={{ marginTop: 12 }}>
          {liveCount > 0 && (
            <button className={"chip" + (view === "live" ? " on" : "")} onClick={() => setView("live")}
              style={{ borderColor: "rgba(228,112,126,.6)", color: view === "live" ? undefined : "var(--rose)" }}>
              ● Live now ({liveCount})
            </button>
          )}
          <button className={"chip" + (view === "locks" ? " on" : "")} onClick={() => setView("locks")}>Most likely winners</button>
          
          {view === "value" && (
            <span className="chip static">
              min edge{" "}
              <input type="number" min="0" max="20" value={minEdge} onChange={(e) => setMinEdge(Math.max(0, Number(e.target.value) || 0))}
                style={{ width: 44, marginLeft: 6, background: "rgba(0,0,0,.22)", border: "1px solid var(--slate-600)", borderRadius: 6, color: "var(--bone)", padding: "2px 6px", fontFamily: "'JetBrains Mono',monospace" }} />c
            </span>
          )}
          {scanInfo && scanInfo.gamesPriced ? <span className="chip static">{scanInfo.gamesPriced} games priced</span> : null}
          {oddsQuota && <span className="chip static" title="The Odds API request credits left this month">odds feed · {oddsQuota.remaining} credits</span>}
        </div>
      </div>

      {err && <div className="panel err">{err}</div>}

      {state === "done" && byDay.length > 0 && (
        <div className="panel" style={{ paddingBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
            <p className="sect" style={{ margin: 0 }}>Best parlay each day</p>
            <div className="chips" style={{ marginTop: 0 }}>
              <button className={"chip" + (sugMode === "safe" ? " on" : "")} onClick={() => setSugMode("safe")}>most likely</button>
              <button className={"chip" + (sugMode === "value" ? " on" : "")} onClick={() => setSugMode("value")}>value</button>
              {[2, 3, 4].map((n) => (
                <button key={n} className={"chip" + (sugLegs === n ? " on" : "")} onClick={() => setSugLegs(n)}>{n} legs</button>
              ))}
            </div>
          </div>
          <p className="help" style={{ marginTop: 6 }}>
            One auto-built parlay per slate that has lines — the {sugMode === "safe" ? "highest-probability" : "biggest-edge"} side
            of several games, one leg per game. Tap a day to load it into the slip and tweak it.
          </p>
        </div>
      )}

      {state === "done" && byDay.map(({ date, legs }) => {
        const dm = parlayMath(legs);
        return (
          <div key={date} className="panel" style={{ borderColor: "rgba(127,185,139,.45)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
              <p className="sect" style={{ margin: 0 }}>{dateLabel(date)}</p>
              <span className="eyebrow" style={{ color: dm.ev > 0 ? "var(--moss)" : "var(--dim)" }}>
                {dm.modelProb.toFixed(dm.modelProb < 10 ? 1 : 0)}% chance all {legs.length} hit · pays {dm.mult.toFixed(1)}×
              </span>
            </div>
            {legs.map((l) => (
              <div key={l.id} className="score-row" style={{ borderBottom: "1px solid rgba(65,75,99,.35)" }}>
                <span className="who" style={{ fontSize: 13.5 }}>
                  <a href={l.market.link} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
                    <span style={{ color: "var(--moss)" }}>Bet </span>{l.market.name === l.market.question ? l.market.question : l.market.name} ↗
                  </a>
                </span>
                <span className="pts" style={{ fontSize: 14 }}><b style={{ color: l.modelProb >= 68 ? "var(--moss)" : l.modelProb >= 55 ? "var(--amber)" : "var(--dim)" }}>{l.modelProb.toFixed(0)}% to win</b><span style={{ color: "var(--dim)", fontSize: 11 }}> @ {l.entry.toFixed(0)}c</span></span>
              </div>
            ))}
            <div className="figures" style={{ marginTop: 14 }}>
              <div className="fig">
                <span className="big" style={{ color: dm.modelProb >= 50 ? "var(--moss)" : dm.modelProb >= 25 ? "var(--amber)" : "var(--rose)" }}>{dm.modelProb.toFixed(dm.modelProb < 10 ? 1 : 0)}%</span>
                <span className="cap">Chance all {dm.legs} hit</span>
                <span className="sub">By the books' true odds, per leg</span>
              </div>
              <div className="fig">
                <span className="big">{dm.mult.toFixed(1)}×</span>
                <span className="cap">Pays if it hits</span>
                <span className="sub">$100 → ${(dm.mult * 100).toFixed(0)}</span>
              </div>

            </div>
            <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={() => setSlip(legs)}>
              Load {dateLabel(date).toLowerCase()}'s parlay into slip
            </button>
          </div>
        );
      })}

      {slip.length > 0 && pm && (
        <div className="panel" style={{ borderColor: "rgba(242,179,61,.4)" }}>
          <p className="sect">Your parlay · {pm.legs} leg{pm.legs === 1 ? "" : "s"}</p>
          {slip.map((l) => (
            <div key={l.id} className="score-row" style={{ borderBottom: "1px solid rgba(65,75,99,.35)" }}>
              <span className="who" style={{ fontSize: 13.5 }}>
                <a href={l.market.link} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
                  <span style={{ color: "var(--moss)" }}>Bet </span>{l.market.name === l.market.question ? l.market.question : l.market.name} ↗
                </a>
                {conflicts.has(l.id) && <span className="srcchip bad" style={{ marginLeft: 8 }}>same game</span>}
              </span>
              <span className="pts" style={{ fontSize: 15 }}>
                <b style={{ color: l.modelProb >= 68 ? "var(--moss)" : l.modelProb >= 55 ? "var(--amber)" : "var(--dim)" }}>{l.modelProb.toFixed(0)}%</b>
                <span style={{ color: "var(--dim)", fontSize: 11 }}> @ {l.entry.toFixed(0)}c</span>
                <button className="chip" style={{ marginLeft: 8 }} onClick={() => setSlip((s) => s.filter((x) => x.id !== l.id))}>remove</button>
              </span>
            </div>
          ))}
          <div className="figures" style={{ marginTop: 16 }}>
            <div className="fig">
              <span className="big" style={{ color: pm.modelProb >= 50 ? "var(--moss)" : pm.modelProb >= 25 ? "var(--amber)" : "var(--rose)" }}>{pm.modelProb.toFixed(pm.modelProb < 10 ? 1 : 0)}%</span>
              <span className="cap">Chance every leg hits</span>
              <span className="sub">The books' true odds multiplied across your legs</span>
            </div>
            <div className="fig">
              <span className="big">{pm.mult.toFixed(1)}×</span>
              <span className="cap">Pays if it hits</span>
              <span className="sub">$100 returns ${(pm.mult * 100).toFixed(0)} if every leg wins</span>
            </div>

          </div>
          <p className="help" style={{ marginTop: 12, color: pm.ev > 0 ? "var(--moss)" : "var(--dim)" }}>
            {conflicts.size > 0
              ? "Two legs are from the same game — those aren't independent, so the real win chance is off. Swap one out for a clean parlay."
              : pm.ev > 0
                ? "Positive expected value: the lines say this combo pays more than the risk. Parlays still lose most of the time — the multiplier is the point, not the hit rate."
                : "Negative expected value on these lines — the payout doesn't cover the combined risk. Fewer legs or bigger edges fix that."}
          </p>

          {/* Place as a real Kalshi parlay (native combo market) */}
          {allKalshi && conflicts.size === 0 && (
            <div className="panel" style={{ marginTop: 14, background: "rgba(0,0,0,.14)" }}>
              <p className="label" style={{ marginBottom: 6 }}>Place this on Kalshi as one parlay</p>
              {!kp && (
                <button className="btn btn-sm" onClick={previewKalshi} disabled={kpBusy}>
                  {kpBusy ? "Building…" : "Get Kalshi's parlay price"}
                </button>
              )}
              {kp && kp.error && <p className="help" style={{ color: "var(--rose)" }}>Kalshi couldn't build this parlay: {kp.error}</p>}
              {kp && !kp.error && (
                <>
                  <div className="meta" style={{ marginTop: 4 }}>
                    <div><span className="k">Kalshi parlay price</span><span className="v" style={{ color: "var(--cyan)" }}>{kp.ask != null ? kp.ask.toFixed(0) + "c" : "—"}</span></div>
                    {kp.ticker && (
                      <div>
                        <span className="k">After you buy</span>
                        <span className="v">
                          <a className="srcchip" href="https://kalshi.com/portfolio" target="_blank" rel="noreferrer">
                            it shows in your Kalshi portfolio ↗
                          </a>
                        </span>
                      </div>
                    )}
                    <div><span className="k">Model win chance</span><span className="v">{pm.modelProb.toFixed(pm.modelProb < 10 ? 1 : 0)}%</span></div>
                    <div>
                      <span className="k">Edge vs Kalshi (after fee)</span>
                      {(() => {
                        const net = kp.ask != null ? pm.modelProb - kp.ask - takerFee("Kalshi", kp.ask) : null;
                        return (
                          <span className="v" style={{ color: net != null && net > 2 ? "var(--moss)" : "var(--dim)" }}>
                            {net != null ? (net > 0 ? "+" : "") + net.toFixed(0) + "c" : "—"}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                    <div>
                      <span className="k eyebrow" style={{ display: "block", marginBottom: 4 }}>Contracts</span>
                      <input className="srch" type="number" min="1" value={kpCount}
                        onChange={(e) => setKpCount(Math.max(1, Math.round(Number(e.target.value) || 1)))}
                        style={{ width: 100, padding: "8px 10px", flex: "none" }} />
                    </div>
                    <div><span className="k">Approx cost</span><span className="v">{kp.ask != null ? "$" + ((kp.ask * kpCount) / 100).toFixed(2) : "—"}</span></div>
                    <div><span className="k">Pays if it hits</span><span className="v" style={{ color: "var(--moss)" }}>${(kpCount).toFixed(2)}</span></div>
                  </div>

                  {!kpConfirm ? (
                    <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={() => setKpConfirm(true)} disabled={kp.ask == null || kp.ask >= 99}>
                      Place parlay on Kalshi
                    </button>
                  ) : (
                    <div className="panel" style={{ marginTop: 12, background: "rgba(228,112,126,.07)", borderColor: "rgba(228,112,126,.4)" }}>
                      <p className="thesis" style={{ margin: 0 }}>
                        Buy <b>{kpCount}</b> contracts of this <b>{pm.legs}-leg parlay</b> at market
                        (~{kp.ask != null ? kp.ask.toFixed(0) : "?"}c, about ${kp.ask != null ? ((kp.ask * kpCount) / 100).toFixed(2) : "?"}).
                        This places a real order on your Kalshi account. It pays ${kpCount.toFixed(2)} only if <b>all {pm.legs} legs</b> win.
                      </p>
                      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                        <button className="btn btn-sm" style={{ background: "linear-gradient(180deg,#EC8391,#E4707E)" }}
                          onClick={placeKalshi} disabled={kpBusy}>{kpBusy ? "Placing…" : "Yes, place it"}</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setKpConfirm(false)} disabled={kpBusy}>Cancel</button>
                      </div>
                    </div>
                  )}
                </>
              )}
              {kpResult && <p className="help" style={{ marginTop: 8, color: kpResult.ok ? "var(--moss)" : "var(--rose)" }}>{kpResult.msg}</p>}
              <p className="help" style={{ marginTop: 8 }}>
                This builds Kalshi's native combo market for your exact legs — one all-or-nothing ticket, not separate bets.
              </p>
            </div>
          )}

          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => setSlip([])}>Clear slip</button>
        </div>
      )}

      <div className="panel">
        {state === "loading" && <p className="pwait"><span className="dots">pricing every game against the book</span></p>}
        {state === "done" && shown.length === 0 && !err && (
          <p className="thesis" style={{ color: "var(--dim)" }}>
            {view === "live" ? "No games are in progress right now."
              : view === "value" ? "No games clear a " + minEdge + "c edge right now. Lower the threshold or check the favorites view."
              : "No strong favorites priced right now."}
          </p>
        )}
        {shown.map((p) => (
          <div key={p.id} className="sel" style={{ cursor: "default", borderColor: inSlip(p.id) ? "var(--amber)" : undefined }}>
            <span style={{ minWidth: 0 }}>
              <a href={p.market.link} target="_blank" rel="noreferrer"
                style={{ color: "var(--bone)", textDecoration: "none", fontWeight: 600 }}
                onMouseOver={(e) => { e.currentTarget.style.color = "var(--cyan)"; }}
                onMouseOut={(e) => { e.currentTarget.style.color = "var(--bone)"; }}>
                <span style={{ color: p.modelProb >= 68 ? "var(--moss)" : p.modelProb >= 55 ? "var(--amber)" : "var(--dim)" }}>Winner: </span>
                {p.market.name === p.market.question ? p.market.question : p.market.name} ↗
              </a>
              <span className="sub">
                {p.state === "in" ? <b style={{ color: "var(--rose)" }}>● LIVE</b> : null}
                {p.state === "in" ? " " : ""}{p.league} · {p.state === "in" ? "in progress" : p.state === "post" ? "final" : "upcoming"} ·
                {p.src === "live" ? " live win prob"
                  : p.src === "live-books" ? " in-play books"
                  : p.src === "pregame-line" ? " pregame line (no live model)"
                  : p.src === "model" ? " model projection"
                  : " " + (p.books > 1 ? p.books + " books" : "1 book")} · costs {p.entry.toFixed(0)}c
                
                {p.disp > 6 ? " · books split" : ""}
              </span>
            </span>
            <span style={{ display: "flex", gap: 10, alignItems: "center", flex: "0 0 auto" }}>
              <span className="sig" style={{
                color: p.modelProb >= 68 ? "var(--moss)" : p.modelProb >= 55 ? "var(--amber)" : "var(--dim)",
                borderColor: p.modelProb >= 68 ? "var(--moss)" : p.modelProb >= 55 ? "var(--amber)" : "var(--dim)" }}
                title={"True odds " + p.modelProb.toFixed(1) + "% by " + (p.books || 1) + " book(s); contract costs " + p.entry.toFixed(0) + "c"}>
                {p.modelProb.toFixed(0)}% TO WIN
              </span>
              <button className={"chip" + (inSlip(p.id) ? " on" : "")} onClick={() => toggle(p)}>
                {inSlip(p.id) ? "added" : "add"}
              </button>
              <button className="chip" onClick={() => onPick(p.market)} title="Full nine-way analysis and a firm wager decision">deep dive</button>
              <a className="chip" href={p.market.link} target="_blank" rel="noreferrer">open ↗</a>
            </span>
          </div>
        ))}
        {state === "done" && shown.length > 0 && (
          <p className="help" style={{ marginTop: 12 }}>
            The percentage is each side's chance of winning by the de-vigged book consensus and live models —
            stack the outcomes you believe in and the slip shows the chance they all happen.
            Tap <b>deep dive</b> for the full nine-way read on any pick.
          </p>
        )}
      </div>
    </>
  );
}

/* ---------------- Browse ---------------- */
function Browse({ onPick }) {
  const [rows, setRows] = useState([]);
  const [state, setState] = useState("idle");
  const [err, setErr] = useState(null);
  const [counts, setCounts] = useState({ Kalshi: 0, Polymarket: 0 });
  const [qy, setQy] = useState("");
  const [venue, setVenue] = useState("all");
  const [catF, setCatF] = useState("all");

  async function load() {
    setState("loading"); setErr(null);
    const out = [];
    const problems = [];

    // Kalshi returns 200 at a time behind a cursor. One page is an arbitrary
    // slice of the exchange, so walk several pages to get a real picture.
    const kalshi = async () => {
      const root = "https://api.elections.kalshi.com/trade-api/v2";
      let raw = 0, sample = null, kept = 0;

      const take = (ms) => {
        ms.forEach((m) => {
          if (!sample && m && m.ticker) sample = m;
          const km = kaMarket(m);
          if (km.price !== null) { out.push(km); kept++; }
        });
      };

      // Paged market list.
      let cursor = "", pages = 0;
      while (pages < 6) {
        const r = await fetch(px(root + "/markets?status=open&limit=200" + (cursor ? "&cursor=" + cursor : "")));
        if (!r.ok) { problems.push("Kalshi /markets returned " + r.status); break; }
        const d = await r.json();
        const ms = d.markets || [];
        raw += ms.length;
        take(ms);
        cursor = d.cursor || "";
        pages++;
        if (!cursor || !ms.length) break;
      }

      // Active events carry the contracts people are actually trading, which the
      // raw market list buries under thousands of dormant combo contracts.
      try {
        const r = await fetch(px(root + "/events?status=open&with_nested_markets=true&limit=200"));
        if (r.ok) {
          const d = await r.json();
          const ms = (d.events || []).flatMap((e) => e.markets || []);
          raw += ms.length;
          take(ms);
        }
      } catch { /* the market list above is the primary source */ }

      if (raw && !kept) {
        problems.push(
          "Kalshi sent " + raw + " markets, none with a price field I recognise. Fields on the first record: " +
          (sample ? Object.keys(sample).join(", ") : "none")
        );
      }
      if (!raw) problems.push("Kalshi sent 0 markets.");
    };

    const poly = async () => {
      const r = await fetch(px("https://gamma-api.polymarket.com/events?closed=false&limit=100&order=volume24hr&ascending=false"));
      if (!r.ok) { problems.push("Polymarket returned " + r.status); return; }
      const d = await r.json();
      (Array.isArray(d) ? d : []).forEach((ev) => {
        const ms = (ev.markets || []).map((m) => pmMarket(m, ev)).filter((m) => m.price !== null);
        if (ms.length) out.push(ms.sort((a, b) => b.volume - a.volume)[0]);
      });
    };

    const res = await Promise.allSettled([kalshi(), poly()]);
    res.forEach((x) => { if (x.status === "rejected") problems.push(String(x.reason && x.reason.message || x.reason)); });

    const seen = new Set();
    const uniq = out.filter((m) => { const k = m.venue + m.id; if (seen.has(k)) return false; seen.add(k); return true; });
    out.length = 0; uniq.forEach((m) => out.push(m));

    const c = { Kalshi: 0, Polymarket: 0 };
    out.forEach((m) => { c[m.venue] = (c[m.venue] || 0) + 1; });
    setCounts(c);

    if (!out.length) {
      setErr("Neither venue returned markets. " + (problems.join(" · ") || "No error reported — check /api/desk/diag."));
      setState("idle");
      return;
    }
    if (problems.length) setErr(problems.join(" · "));
    setRows(out.sort((a, b) => (b.quoted === a.quoted ? 0 : b.quoted ? 1 : -1) || (b.volume - a.volume)));
    setState("done");
  }

  useEffect(() => { load(); }, []);

  const shown = useMemo(() => rows.filter((m) => {
    if (venue !== "all" && m.venue !== venue) return false;
    if (catF !== "all" && guessCategory(m.question + " " + m.name + " " + m.id) !== catF) return false;
    if (!qy.trim()) return true;
    // Ticker matters: a WTA contract is titled by player, not by "tennis".
    const t = (m.question + " " + m.name + " " + m.id).toLowerCase();
    return qy.toLowerCase().split(/\s+/).every((w) => t.includes(w));
  }).slice(0, 120), [rows, qy, venue, catF]);

  return (
    <>
      <div className="bar">
        <input className="srch" value={qy} onChange={(e) => setQy(e.target.value)}
          placeholder="Filter by keyword or ticker — wta, fed, lakers, kxhigh…" aria-label="Filter markets" />
        <button className="btn btn-ghost" onClick={load} disabled={state === "loading"}>
          {state === "loading" ? "Loading" : "Refresh"}
        </button>
      </div>
      <p className="help" style={{ marginTop: 12 }}>
        Everything trading right now on both exchanges, busiest first. Tap one to analyze it.
      </p>
      <div className="chips">
        {["all", "Polymarket", "Kalshi"].map((v) => (
          <button key={v} className={"chip" + (venue === v ? " on" : "")} onClick={() => setVenue(v)}>{v}</button>
        ))}
        {["sports", "politics", "finance", "weather"].map((k) => (
          <button key={k} className={"chip" + (catF === k ? " on" : "")}
            onClick={() => setCatF(catF === k ? "all" : k)}>{k}</button>
        ))}
        <span className="chip static">Kalshi {counts.Kalshi} · Polymarket {counts.Polymarket} · {shown.length} shown</span>
      </div>

      {err && <div className="panel err">{err}</div>}

      <div className="panel">
        {state === "loading" && <p className="pwait"><span className="dots">loading markets from both exchanges</span></p>}
        {state === "done" && shown.length === 0 && (
          <p className="thesis" style={{ color: "var(--dim)" }}>
            {rows.length
              ? "No contract matches \"" + qy + "\". Kalshi titles name the player or number, not the sport — try a ticker fragment like wta or kxhigh, or clear the filter."
              : "Nothing loaded. Hit Refresh."}
          </p>
        )}
        {shown.map((m) => (
          <button key={m.venue + m.id} className="sel" onClick={() => onPick(m)}>
            <span>
              {m.name === m.question ? m.question : m.question + " — " + m.name}
              <span className="sub">{m.venue} · {m.id} · vol {Math.round(m.volume).toLocaleString()}{m.close ? " · " + String(m.close).slice(0, 10) : ""}</span>
            </span>
            <span className="px">{m.quoted === false ? "—" : m.price.toFixed(0) + "c"}</span>
          </button>
        ))}
      </div>
    </>
  );
}

/* ---------------- Frameworks ---------------- */
function Frameworks({ fw, save, ledger, reset }) {
  const [cat, setCat] = useState("politics");
  const lib = fw[cat];

  const reliability = useMemo(() => {
    const acc = {};
    ledger.filter((e) => e.status === "resolved" && e.outcome !== null).forEach((e) => {
      if (e.category !== cat) return;
      (e.pillars || []).forEach((p) => {
        if (!p.signal || p.signal === "NEUTRAL" || (p.strength || 0) < 1) return;
        acc[p.n] = acc[p.n] || { hit: 0, n: 0 };
        acc[p.n].n++;
        const said = p.signal === "YES" ? 1 : 0;
        if (said === e.outcome) acc[p.n].hit++;
      });
    });
    return acc;
  }, [ledger, cat]);

  function edit(n, key, value) {
    const next = { ...fw, [cat]: { ...lib, items: lib.items.map((p) => (p.n === n ? { ...p, [key]: value } : p)) } };
    save(next);
  }

  return (
    <>
      <div className="chips" style={{ marginTop: 0 }}>
        {Object.keys(fw).map((k) => (
          <button key={k} className={"chip" + (k === cat ? " on" : "")} onClick={() => setCat(k)}>{fw[k].label}</button>
        ))}
      </div>

      <div className="panel">
        <p className="sect">The nine checks for {lib.label.toLowerCase()}</p>
        <p className="help" style={{ marginBottom: 18 }}>
          Each box is an instruction I follow when researching. Reword one and my analysis changes — these go to the
          model exactly as written. Switch one off and it stops running, which also makes each analysis cheaper. The
          percentage is how often that check pointed the right way on markets you have already seen settle.
        </p>

        {lib.items.map((p) => {
          const r = reliability[p.n];
          return (
            <div key={p.n} className="fw">
              <div className="fw-top">
                <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                  <span className="pnum">{String(p.n).padStart(2, "0")}</span>
                  <input type="text" value={p.name} onChange={(e) => edit(p.n, "name", e.target.value)}
                    style={{ marginTop: 0, fontWeight: 600, fontSize: 13.5 }} aria-label="Framework name" />
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flex: "0 0 auto" }}>
                  <span className="rel" style={{ color: r ? (r.hit / r.n >= 0.6 ? "var(--moss)" : r.hit / r.n < 0.4 ? "var(--rose)" : "var(--dim)") : "var(--dim)" }}>
                    {r ? Math.round((r.hit / r.n) * 100) + "% · n" + r.n : "no data"}
                  </span>
                  <button className={"sw" + (p.enabled ? " on" : "")} onClick={() => edit(p.n, "enabled", !p.enabled)}
                    aria-label={p.enabled ? "Turn off" : "Turn on"}><i /></button>
                </div>
              </div>
              <textarea rows={2} value={p.method} onChange={(e) => edit(p.n, "method", e.target.value)} aria-label="Method" />
              <div style={{ display: "flex", gap: 10, marginTop: 7, flexWrap: "wrap" }}>
                <input type="text" value={p.sources} onChange={(e) => edit(p.n, "sources", e.target.value)}
                  placeholder="Preferred sources" style={{ flex: "1 1 200px", marginTop: 0, fontSize: 11.5 }} aria-label="Preferred sources" />
                <label className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  Weight
                  <input type="number" min="0" max="3" step="0.5" value={p.weight}
                    onChange={(e) => edit(p.n, "weight", Number(e.target.value))}
                    style={{ width: 60, marginTop: 0 }} aria-label="Weight" />
                </label>
              </div>
            </div>
          );
        })}

        <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={reset}>
          Put everything back the way it was
        </button>
      </div>
    </>
  );
}

/* ---------------- Ledger ---------------- */
function Ledger({ ledger, setLedger, fw }) {
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState(null);

  // Check for settled markets automatically when the tab opens, at most
  // once an hour — reliability scores stay fresh without anyone remembering.
  useEffect(() => {
    let last = 0;
    try { last = Number(localStorage.getItem("cd:lastResCheck") || 0); } catch { /* fine */ }
    if (ledger.some((e) => e.status === "open") && Date.now() - last > 3600000) {
      try { localStorage.setItem("cd:lastResCheck", String(Date.now())); } catch { /* fine */ }
      checkResolutions();
    }
  }, []);

  async function checkResolutions() {
    setChecking(true); setNote(null);
    const open = ledger.filter((e) => e.status === "open");
    const updates = [];
    for (const e of open) {
      try {
        let outcome = null;
        if (e.venue === "Kalshi") {
          const r = await fetch(px("https://api.elections.kalshi.com/trade-api/v2/markets/" + e.marketId));
          const d = await r.json();
          const m = d.market;
          if (m && m.result === "yes") outcome = 1;
          else if (m && m.result === "no") outcome = 0;
        } else if (e.slug) {
          const r = await fetch(px("https://gamma-api.polymarket.com/events?slug=" + encodeURIComponent(e.slug)));
          const d = await r.json();
          const ev = Array.isArray(d) ? d[0] : d;
          const m = ev && (ev.markets || []).find((x) => (x.conditionId || String(x.id)) === e.marketId);
          if (m && m.closed) {
            const pxs = jparse(m.outcomePrices).map(Number);
            const outs = jparse(m.outcomes);
            const yi = Math.max(0, outs.findIndex((o) => String(o).toLowerCase() === "yes"));
            if (pxs[yi] >= 0.99) outcome = 1;
            else if (pxs[yi] <= 0.01) outcome = 0;
          }
        }
        if (outcome !== null) updates.push({ ...e, status: "resolved", outcome, resolvedAt: Date.now() });
      } catch { /* leave it open, try again later */ }
    }
    if (updates.length) {
      setLedger((L) => L.map((e) => updates.find((u) => u.id === e.id) || e));
      try { await fetch("/api/desk/ledger", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) }); } catch { /* in memory */ }
    }
    setNote(updates.length ? updates.length + " market" + (updates.length === 1 ? "" : "s") + " resolved and scored."
      : open.length ? "Nothing has settled yet. " + open.length + " still open." : "No open calls to check.");
    setChecking(false);
  }

  const done = ledger.filter((e) => e.status === "resolved" && e.outcome !== null);
  const stats = useMemo(() => {
    if (!done.length) return null;
    const brier = (p, o) => Math.pow(p / 100 - o, 2);
    // Brier comparison only over genuine analyses — synced positions have
    // fair === price by construction and would flatten the gap.
    const scored = done.filter((e) => e.call !== "SYNCED");
    const model = scored.length ? scored.reduce((s, e) => s + brier(e.fair, e.outcome), 0) / scored.length : null;
    const mkt = scored.length ? scored.reduce((s, e) => s + brier(e.price, e.outcome), 0) / scored.length : null;
    // A "call" bets the side it named: BUY YES/NO from analyses, the actual
    // held side for positions synced from Kalshi.
    const acted = done.filter((e) => e.call === "BUY YES" || e.call === "BUY NO" ||
      (e.call === "SYNCED" && e.taken && e.taken.side));
    const calledSide = (e) => e.call === "BUY YES" ? 1 : e.call === "BUY NO" ? 0
      : e.taken && e.taken.side === "YES" ? 1 : 0;
    const wins = acted.filter((e) => calledSide(e) === e.outcome).length;
    return { n: done.length, model, mkt, acted: acted.length, wins,
      hit: acted.length ? wins / acted.length : null };
  }, [done]);

  async function clearAll() {
    setLedger([]);
    try { await fetch("/api/desk/ledger", { method: "DELETE" }); } catch { /* in memory */ }
    setNote("Ledger cleared.");
  }

  return (
    <>
      <div className="panel">
        <p className="sect">Am I any good at this?</p>
        <p className="help" style={{ marginBottom: 4 }}>
          Every analysis gets logged. When a market settles, I score what I said against what happened —
          and against what the market’s own price would have scored.
        </p>
        {!stats ? (
          <p className="thesis" style={{ color: "var(--dim)", marginTop: 10 }}>
            Nothing has settled yet. Run some analyses, come back after those markets resolve, and hit
            "Check for results" — this fills in then. Until it does, treat every call you see as unproven.
          </p>
        ) : (
          <div className="scorecard" style={{ marginTop: 16 }}>
            <div>
              <span className="k eyebrow">Settled</span>
              <div className="n">{stats.n}</div>
            </div>
            <div>
              <span className="k eyebrow">My score</span>
              <div className="n" style={{ color: stats.model != null && stats.model < stats.mkt ? "var(--moss)" : "var(--rose)" }}>
                {stats.model == null ? "—" : stats.model.toFixed(3)}
              </div>
            </div>
            <div>
              <span className="k eyebrow">Market score</span>
              <div className="n" style={{ color: "var(--dim)" }}>{stats.mkt == null ? "—" : stats.mkt.toFixed(3)}</div>
            </div>
            <div>
              <span className="k eyebrow">Calls I got right</span>
              <div className="n">{stats.hit === null ? "—" : Math.round(stats.hit * 100) + "%"}</div>
              <span className="eyebrow">{stats.wins}/{stats.acted} acted</span>
            </div>
          </div>
        )}
        {stats && (
          <p className="thesis" style={{ marginTop: 16, color: "var(--dim)" }}>
            These scores measure how close a probability landed to what actually happened — lower is better, and the
            comparison is the whole point. {stats.model == null
              ? "Only synced positions have settled so far — no desk analyses to score yet."
              : stats.model < stats.mkt
              ? "Right now I score better than the market's own prices. Don't read much into it yet; a few dozen calls prove nothing."
              : "Right now the market's prices score better than mine. Until that flips, treat every gap I show you as noise."}
          </p>
        )}
        <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-sm" onClick={checkResolutions} disabled={checking}>
            {checking ? "Checking" : "Check for results"}
          </button>
          {ledger.length > 0 && <button className="btn btn-ghost btn-sm" onClick={clearAll}>Clear ledger</button>}
        </div>
        {note && <p className="thesis" style={{ marginTop: 12 }}>{note}</p>}
      </div>

      <div className="panel">
        <p className="sect">Every call I have made ({ledger.length})</p>
        {ledger.length === 0 ? (
          <p className="thesis" style={{ color: "var(--dim)", marginTop: 10 }}>
            Nothing yet. Analyze a market and it lands here so you can hold me to it later.
          </p>
        ) : (
          <table className="tbl">
            <thead>
              <tr><th>Market</th><th>I said</th><th>Price → my price</th><th>Topic</th><th>Happened?</th></tr>
            </thead>
            <tbody>
              {ledger.slice(0, 80).map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.name === e.question ? e.question : e.question + " — " + e.name}
                    <span className="sub eyebrow" style={{ display: "block", marginTop: 3 }}>
                      {e.venue} · {new Date(e.ts).toISOString().slice(0, 10)}
                    </span>
                  </td>
                  <td className="m" style={{ color: e.call === "PASS" ? "var(--dim)" : e.call === "BUY YES" ? "var(--amber)" : "var(--rose)" }}>
                    {e.call}
                  </td>
                  <td className="m">{e.price.toFixed(0)}→{e.fair.toFixed(0)}c</td>
                  <td className="m" style={{ color: "var(--dim)" }}>{(fw[e.category] || {}).label || e.category}</td>
                  <td className="m">
                    {e.status === "open" ? <span style={{ color: "var(--dim)" }}>open</span>
                      : <span style={{ color: e.outcome === 1 ? "var(--moss)" : "var(--rose)" }}>{e.outcome === 1 ? "YES" : "NO"}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
window.__deskMounted = true; // boot watchdog in index.html stands down
