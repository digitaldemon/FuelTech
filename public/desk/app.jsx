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
const BUILD = "2026-08-15.nrfi-platt-cal";

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
  --bg:rgba(0,0,0,.26); --fg:#EFEAE0;
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
.cd { overflow-x: hidden; }
.cd select { max-width: 100%; box-sizing: border-box; }

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
  .cd { padding: max(18px, env(safe-area-inset-top)) 12px calc(56px + env(safe-area-inset-bottom)) 12px; }
  .cd-wrap { width: 100%; }
  .cd-title { font-size:21px; }
  .cd-head { gap:8px; padding-bottom:10px; }
  .tabs { gap:3px; padding:4px; }
  .tabs button { font-size:12px; padding:6px 9px; }
  .panel { padding:15px; }
  .verdict h2 { font-size:32px; }
  .vstat { gap:14px; }
  .pillar { grid-template-columns:26px 1fr; }
  .pillar .sig { grid-column:2; justify-self:start; margin-top:8px; }
  .cmp-row { grid-template-columns:90px 1fr 90px; gap:8px; }
  .cmp-row .cl { font-size:9px; }
  .cmp-row .cv { font-size:11px; }
  .figures { grid-template-columns:repeat(auto-fit,minmax(110px,1fr)); gap:8px; }
  .fig .big { font-size:18px; }
  .bar { gap:8px; }
  .q { font-size:16px; }
  .cd select { width:100%; }
  table.tbl th:nth-child(n+4), table.tbl td:nth-child(n+4) { display:none; }
  table.tbl td, table.tbl th { padding:8px 8px 8px 0; font-size:11.5px; }
  .pick { padding:13px 14px; }
  .tierbox { min-width:64px; padding:6px 8px; }
  .tierbox .pct { font-size:17px; }
  .pit-grid { grid-template-columns:1fr !important; }
  .pit-windows { grid-template-columns:repeat(2,1fr) !important; }
  .nrfi-stats { grid-template-columns:repeat(2,1fr) !important; }
}
@media (max-width:380px) {
  .cd-title { font-size:18px; }
  .tabs button { font-size:11px; padding:5px 7px; }
  .cmp-row { grid-template-columns:1fr; gap:4px; }
  .cmp-row .cl { text-align:left; }
  .cmp-row .cv { text-align:left; }
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
  // `e &&` first: the ledger is rehydrated from storage, and a single null entry
  // in it turned this whole function into a TypeError rather than a calibration.
  const done = (ledger || []).filter((e) => e && e.status === "resolved" && e.outcome !== null &&
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
  const [tab, setTab] = useState("nrfi");
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
            <h1 className="cd-title">DigitalDemon's <span>Desk</span></h1>
            <p className="help" style={{ maxWidth: 460 }}>
              I predict the outcomes of Kalshi and Polymarket events — games, totals, commodities, anything listed — and grade every prediction against what actually happens.
            </p>
          </div>
          <div className="eyebrow">{today()}</div>
        </header>

        <nav className="tabs">
          {[["picks", "Predictions"], ["nrfi", "NRFI"], ["analyze", "Ask an event"], ["parlay", "Combos"], ["commodities", "15-Minute"], ["positions", "My trades" + (openTrades ? " (" + openTrades + ")" : "")], ["ledger", "Accuracy"]].map(([k, l]) => (
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

/* How much of the final probability the base-out sim gets once lineups post.
   Was effectively 1.00 (the sim replaced the lambda path outright); measured at
   0.20. See the table in nrfiEvaluate for the 395-game paired backtest, and
   scripts/desk-nrfi-backtest.js to re-run it. Do not raise this without
   re-running that backtest — the old value was never measured at all. */
const NRFI_SIM_W = 0.20;

const NRFI_LG_LAMBDA = 0.52;  // league avg runs per team in the 1st inning
const NRFI_LG_P0 = 0.72;      // league P(no run in a half-inning) -> ~52% NRFI
/* Regression weight on a starter's own 1st-inning run rate, applied at
   nrfiRegress (app.jsx:6688-6689) where it sets his baseline lambda. This prices
   the wager; it is not a display knob.

   Was 12, described as "heavy regression". It was neither measured nor heavy. At
   12 a starter with 20 starts keeps 20/32 = 63% of his own observed rate, and
   the held-out error says that is roughly five times too much trust.

   Measured by scripts/nrfi-pitreg-fit.js over 8,548 starts by 268 starters
   (2025+2026), walk-forward: order an arm's starts by date and predict each one
   from only the starts before it, which is the live setting exactly. Best weight
   75 over 7,207 predicted starts, bootstrap 95% CI over ARMS (the unit of
   independence — two starts by one pitcher are not) [50, 150]. A random
   within-arm half-split, which cannot see drift, agrees at 65 [40, 150].
   12 is outside both intervals. Corroborated by a third statistic reached a
   third way: the same scan's clean-first-inning SHARE has a beta-binomial
   concentration of ~88 starts (scripts/nrfi-pitcherbt-rebuild.js).

   DO NOT "FIX" THIS WITH nrfi-ladder-sweep.js. That backtest prefers a weight
   near 12 and it is wrong, for a reason that is reproducible on demand. scanNrfi
   reads season-to-date pitcher splits that were never rewound to the scored
   date, so the rate feeding nrfiRegress on a past game already contains that
   game's result — an arm shelled in the 1st that afternoon looks worse in the
   line the model reads. Trusting that rate harder mines the leak. Run the fit
   with the leak deliberately left in and the optimum collapses from 75 to 1,
   with error rising monotonically in the weight: the backtest is not measuring
   prediction, it is measuring how much of the answer you let through. Held-out
   error on raw outcomes carries no such contamination, which is why it decides.

   The visible cost is real and expected: heavier regression compresses the
   board, so at the fixed 63/55/52 ladder the played count falls ~742 -> ~592 and
   nominal backtest units fall with it. Those units were partly the leak.

   Re-run the fit before moving this. The curve is flat between about 50 and 150,
   so anything in that range is defensible and precision beyond that is fake. */
const NRFI_PIT_REG = 75;
/* Regression weight on a team's own 1st-inning runs per game (app.jsx:6721-6722).
   Was 6, which at ~110 games played kept 95% of the team's observed rate.

   Measured by scripts/nrfi-offreg-fit.js over 4,279 games / 8,558 team-games
   (2025+2026). Three methods, none of which finds a signal to keep:

     - Walk-forward, each game predicted from only the games before it within
       the season: held-out error falls monotonically out to the end of a grid
       that runs to 3000. Bootstrap CI over team-seasons [400, 3000]. The
       optimum does not turn, so it is a floor, not an estimate.
     - Variance decomposition: observed spread across 60 team-seasons is 0.0834
       runs/game against a sampling noise floor of 0.0875. The observed spread
       is NARROWER than noise alone predicts — there is no true spread left to
       measure.
     - Odd/even split-half: r = 0.053, 95% CI [-0.206, 0.313]. Spearman-Brown
       reliability of a full season 0.101, which implies k = 1267 at n=143.

   That last figure is derived without reference to the MSE curve and lands
   inside its CI, so the two corroborate rather than restate each other. 1200 is
   that estimate rounded; anything from ~400 up is equivalent in effect, and the
   rounding is deliberate because precision here would be invented. For contrast
   the same arithmetic on STARTERS found a real if small effect (Spearman-Brown
   0.262), which is why NRFI_PIT_REG is 75 and not this.

   THIS DOES NOT REMOVE TEAM OFFENSE FROM THE MODEL. The baseline is multiplied
   by offMult (app.jsx:6868-6869), so lineup OBP, venue split, team K%, travel
   and rolling form all still separate the teams. What is being dropped is the
   raw season first-inning rate, which measures roughly four plate appearances a
   game against a different pitcher each time and turns out to be noise.

   A leaky backtest will fight this: the same fit with the scored game left in
   its own history puts the optimum at 0, exactly as in the pitcher case. */
const NRFI_OFF_REG = 1200;
/* Lineup-strength baseline. This is NOT league OBP, and the difference is the
 * whole point. The numerator it divides is a 0.5/0.3/0.2-weighted OBP of the
 * posted 1-2-3 hitters — a population selected precisely because it gets on
 * base. It was 0.318, the all-hitters league OBP, which made the ratio "top of
 * a lineup vs everybody" rather than "this lineup vs an average one", and that
 * is above 1.0 almost by construction.
 *
 * Measured by scripts/nrfi-lineup-center.js over 1,116 posted lineups (45 days,
 * 2026, gameType=R), recomputing the model's exact statistic — same weights,
 * same vs-LHP/vs-RHP split selection, same reweighting when a split is missing:
 *
 *     mean 0.3467   sd 0.0255   p10 0.321   p90 0.380
 *
 * The split and season-fallback subsets agree to four decimals, so the constant
 * is not an artefact of which stat line the check happens to find.
 *
 *     under 0.318:  91.8% of lineups score above 1.0, mean factor 1.0884
 *     under 0.347:  47.9% score above 1.0,            mean factor 0.9999
 *
 * A check that calls 92% of lineups above-average is not measuring lineups, it
 * is applying a constant. Re-centred it sits on 1.0000 and the sign carries
 * information again. The 0.82/1.24 clamp now binds on 1.16% of lineups, so it
 * is a guard against a broken stat line rather than a routine truncation.
 *
 * Re-measure this if the weights in topOrder change; it is the mean of that
 * specific statistic, not a league rate that can be looked up. */
const NRFI_LG_TOP3_OBP = 0.3467;
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
const _rosterCache = new Map(); // teamId:season:sit:ppId -> batter PA rate array
const _teamOffRolling = new Map(); // teamId:date -> rolling first-inning scored-in-1st windows
// Shared linescore fetch — stores the Promise so concurrent callers dedup.
function getLinescore(gamePk) {
  if (!_linescore.has(gamePk))
    _linescore.set(gamePk, getJson("https://statsapi.mlb.com/api/v1/game/" + gamePk + "/linescore").catch(() => null));
  return _linescore.get(gamePk);
}

/* ---- live first-inning call ----------------------------------------------
 * MLB's broadcast audio (Gameday Audio / MLB.TV) is authenticated, DRM'd and
 * licensed per-subscriber; there is no embeddable stream and re-serving one is
 * not something this app will do. The flagship radio simulcasts black out live
 * play-by-play on the web for the same reason.
 *
 * What IS available is the pitch-by-pitch play feed the desk already reads for
 * line scores. Spoken through the browser's own speech synthesiser it gives the
 * thing a broadcast was wanted for — hands off the screen while the inning that
 * decides the ticket plays out — and it is strictly better targeted, because it
 * covers every game on the board at once and goes quiet the moment the first
 * inning closes. No licence, no cost, no second tab.
 */
// allPlays carries the whole game; only the 1st inning can settle an NRFI, and a
// completed play is the only one whose description is final.
function firstInningPlays(feed) {
  const all = (feed && feed.liveData && feed.liveData.plays && feed.liveData.plays.allPlays) || [];
  return all.filter((p) => p.about && p.about.inning === 1 && p.about.isComplete);
}
// result.description is written for a box score ("flies out to center fielder
// Daulton Varsho"), which reads long out loud. Keep the clause that says what
// happened and drop the fielder's credit.
function playCallout(p) {
  const d = String((p.result && p.result.description) || "").replace(/\s+/g, " ").trim().replace(/\.$/, "");
  if (!d) return null;
  if (d.length <= 150) return d;
  // A hard slice lands mid-word and the synthesiser reads the fragment aloud
  // ("Dillon Dingler to 1s"). Trailing runner advancements are the part that
  // overruns, and dropping a whole clause is what a broadcaster would do anyway.
  const cut = d.slice(0, 150);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(", "));
  return stop > 60 ? cut.slice(0, stop) : cut.slice(0, cut.lastIndexOf(" "));
}
/* ---- pitch level ----------------------------------------------------------
 * firstInningPlays deliberately keeps only COMPLETE plays, because a play's
 * result.description is not final until it is. That is right for the play
 * callout and useless for pitches: between a leadoff single and the next out
 * there can be forty seconds of dead air and six pitches, and the at-bat they
 * belong to is by definition still in progress. So the pitches are read off a
 * SECOND pass that walks every 1st-inning play including the live one, and are
 * de-duplicated by playId rather than by count, since the same at-bat is
 * re-delivered on every poll with one more event on the end.
 */
const COUNT_WORD = ["oh", "one", "two", "three", "four"];
// "In play, out(s)" as a pitch call is worse than saying nothing — the play's
// own description follows a beat later and says what actually happened. The
// pitches worth calling are the ones that only move the count.
const PITCH_SKIP = { X: 1, D: 1, E: 1 };
/* Fouls, and why they are the one pitch that needs its own wording.
 *
 * Every other call changes the count, so its line differs from the line before
 * it by construction. A foul with two strikes changes NOTHING — same velocity
 * bucket, same call, same count — so two of them in a row came out as the same
 * sentence twice, three seconds apart. Measured on six real 1st innings
 * (scripts/nrfi-callout-dupe.js): two back-to-back identical lines, both of them
 * "94, foul. three and two.", i.e. about one every three games.
 *
 * That is the "voice repeating itself" report, and it is not a de-duplication
 * failure — the two pitches are genuinely distinct events that both deserve to
 * be called. The dedupe was right and the WORDS were wrong.
 *
 * So a foul that leaves the count alone gets rotated phrasing, indexed by how
 * many fouls the at-bat has already had. Indexed, not random: the same feed must
 * produce the same call every poll, or the replay harness cannot pin it. The
 * phrases are what a broadcaster actually says on a long at-bat, and the last
 * one repeats for a marathon — by the eighth foul the listener is being told the
 * batter is fighting, which is the true content, and "still alive" twice in a
 * row is fine because seven other lines separate them.
 *
 * The count is dropped on these too. A two-strike foul cannot move the count, so
 * restating it says nothing; the count comes back the moment the pitch is one
 * that could change it. */
const FOUL_WORD = ["foul", "fouled away", "fouls it off", "foul again",
  "fights another one off", "still alive"];
function pitchCallout(ev, foulSeq) {
  if (!ev || !ev.isPitch) return null;
  const call = (ev.details && ev.details.call) || {};
  if (PITCH_SKIP[call.code]) return null;
  // "Swinging Strike (Blocked)" — the qualifier is a scorer's distinction, not
  // something a broadcaster says, and it is the kind of aside that makes a
  // synthesised line sound like a form being read out.
  const what = String(call.description || ev.details.description || "")
    .replace(/\s*\([^)]*\)/g, "").trim();
  if (!what) return null;
  // Velocity is the one number that makes a pitch call sound like a broadcast
  // rather than a scoreboard. Gate it: the feed carries 0 for pitches it never
  // tracked, and a pickoff throw is not a pitch speed.
  const mph = ev.pitchData && ev.pitchData.startSpeed;
  const velo = typeof mph === "number" && mph >= 60 && mph <= 110 ? Math.round(mph) + ", " : "";
  const c = ev.count || {};
  // The count here is the count AFTER the pitch, so ball four and strike three
  // read as "four and oh" / "oh and three" — nonsense to say out loud, and the
  // play callout is about to announce the walk or the punchout anyway. A hit
  // batsman is the same case and does not announce itself in the count: the feed
  // charges it as a ball, so it comes out as a live count on a finished at-bat.
  // A foul with two strikes already on the batter: the count after equals the
  // count before, so this pitch moved nothing. Foul tips and foul bunts are
  // excluded on purpose — a foul tip caught is strike three and a foul bunt with
  // two strikes is an out, so both END the at-bat and are worth their own words.
  const heldCount = /^foul$/i.test(what) && c.strikes >= 2 && c.balls < 4;
  const done = c.balls >= 4 || c.strikes >= 3 || call.code === "H";
  const count = done || heldCount || typeof c.balls !== "number" || typeof c.strikes !== "number" ? ""
    : " " + COUNT_WORD[c.balls] + " and " + COUNT_WORD[c.strikes] + ".";
  const said = heldCount
    ? FOUL_WORD[Math.min(foulSeq | 0, FOUL_WORD.length - 1)]
    : what.toLowerCase().replace(/\.$/, "");
  return velo + said + "." + count;
}
function firstInningPitches(feed) {
  const all = (feed && feed.liveData && feed.liveData.plays && feed.liveData.plays.allPlays) || [];
  const out = [];
  for (const p of all) {
    if (!p.about || p.about.inning !== 1) continue;
    // "Luis García Jr." already ends the sentence; appending another full stop
    // gives "Jr.." and the synthesiser reads the extra one as a longer pause.
    const batter = String((p.matchup && p.matchup.batter && p.matchup.batter.fullName) || "")
      .replace(/\.$/, "");
    let first = true;
    const evs = p.playEvents || [];
    // Fouls are counted per at-bat and the count is derived from the events
    // themselves, so it is identical on every poll of the same at-bat. Deriving
    // it from anything the poll carries between ticks would make the wording
    // depend on when the callout attached.
    let fouls = 0;
    for (let i = 0; i < evs.length; i++) {
      const ev = evs[i];
      const text = pitchCallout(ev, fouls);
      // Counted after the call is built, so the first two-strike foul of an
      // at-bat is FOUL_WORD[0] ("foul") — the plain word, as before.
      if (/^foul$/i.test(String(((ev.details || {}).call || {}).description || "").replace(/\s*\([^)]*\)/g, "").trim()) &&
        ((ev.count || {}).strikes >= 2)) fouls++;
      if (!text) continue;
      const t = Date.parse(ev.endTime || "");
      out.push({
        // playId is a GUID the feed keeps stable across polls; the index pair is
        // only a fallback for the occasional event delivered without one.
        id: ev.playId || p.atBatIndex + ":" + i,
        // Naming the batter once per at-bat is what keeps a string of counts
        // from turning into an unattributable stream of numbers.
        text: first && batter ? batter + ". " + text : text,
        ts: isFinite(t) ? t : NaN,
      });
      first = false;
    }
  }
  return out;
}
// Runs are the only thing that settles the bet, so they get named as such rather
// than left for the listener to infer from a description.
function playRuns(p, prev) {
  const s = p.result || {}, q = (prev && prev.result) || {};
  const now = (s.awayScore || 0) + (s.homeScore || 0);
  const was = prev ? (q.awayScore || 0) + (q.homeScore || 0) : 0;
  return Math.max(0, now - was);
}
// The full feed is ~750KB per game; statsapi's `fields` projection keeps only
// the leaves the callout reads. Across a 15-game board polled every 2.5s that is
// the difference between ~48MB/min and something affordable — which is what
// makes polling this fast defensible at all.
//
// Pitch-level events are the expensive half of this list: playEvents alone is
// ~92KB of a finished game, because `fields` filters by leaf name and cannot be
// asked for one inning. What saves it is that the callout only ever polls games
// in the 1st — it attaches at first pitch and detaches at past1 — and the
// 1st-inning slice is ~11KB, about 4MB/min for a full board. The harness pins
// that number rather than the 9-inning one, since the 9-inning one is never
// fetched. Nothing here is decorative: dropping playId costs the pitch
// de-duplication, dropping count costs the count, dropping pitchData costs the
// velocity that makes it sound like a broadcast rather than a scoreboard.
const CALLOUT_FIELDS = "gameData,status,abstractGameState,liveData,linescore,currentInning," +
  "inningState,plays,allPlays,about,inning,isComplete,endTime,result,description,awayScore,homeScore," +
  // pitch level: the events inside each at-bat, the call on each one, the count
  // it produced, its velocity, and who is hitting.
  "playEvents,isPitch,playId,atBatIndex,details,call,code,count,balls,strikes," +
  "pitchData,startSpeed,matchup,batter,fullName";
async function fetchFirstInning(gamePk) {
  const url = "https://statsapi.mlb.com/api/v1.1/game/" + gamePk + "/feed/live?fields=" +
    CALLOUT_FIELDS + "&_=" + Date.now();
  let f = null;
  try {
    // no-store, not just a cache-buster: statsapi sends cache headers and the
    // browser will happily serve a stale body to a URL it has seen. An earlier
    // cut bucketed the buster to 10s, which silently capped freshness at 10s.
    const r = await fetch(url, { cache: "no-store" });
    if (r.ok) f = await r.json();
  } catch { /* fall through to the proxy */ }
  if (!f) { try { f = await getJson(px(url)); } catch { return null; } }
  const ls = (f.liveData && f.liveData.linescore) || {};
  return {
    plays: firstInningPlays(f),
    pitches: firstInningPitches(f),
    inning: ls.currentInning || 0,
    half: String(ls.inningState || ""),
    // The inning is over once play has moved past it — not when outs hit 3,
    // which is briefly true mid-changeover in the feed.
    past1: (ls.currentInning || 0) > 1 || String(f.gameData && f.gameData.status &&
      f.gameData.status.abstractGameState || "").toLowerCase() === "final",
  };
}
// A play's endTime is when it actually finished, so the callout can tell a play
// that just happened from one it is only now seeing — the difference between
// live and a recap.
function playAgeMs(p) {
  const t = p && p.about && p.about.endTime ? Date.parse(p.about.endTime) : NaN;
  return isFinite(t) ? Date.now() - t : Infinity;
}
/* Which games the callout follows, and on whose side. Lifted out of the polling
 * effect because the game picker has to render exactly the set the effect is
 * about to poll — two copies of this predicate would drift, and the drift would
 * show up as a game listed in the picker that never speaks. */
function calloutHeld(openPositions) {
  // Keying this off r.market.ticker looked obvious and was wrong: a Kalshi market
  // leaves status=open the moment its game starts, so fetchKalshiRFI stops
  // returning it and r.market goes null — precisely when the callout matters. The
  // position's OWN ticker never goes away, and it carries the ET date and both
  // team codes, so it can be matched by the same matchRFI the board already uses.
  return (openPositions && !openPositions.error ? openPositions.positions || [] : [])
    .filter((p) => p.ticker && p.contracts > 0)
    .map((p) => ({ call: p.call, date: tickerDate(p.ticker), codes: teamCodes(p.ticker) }));
}
// The side actually held, so a game can be followed for the money on it and
// called against that side rather than against the model's read.
function calloutHeldSide(r, held) { const h = matchRFI(r, held); return h ? h.call : null; }
// The verdict alone was the wrong gate: the desk PASSes whenever the market has a
// game priced right, which says nothing about whether there is money on it.
function calloutEligible(r, held) {
  return !!(r.gamePk && !r.final && ((r.v && r.v.strength !== "PASS") || calloutHeldSide(r, held)) &&
    (r.currentInning === 1 || (r.currentInning === 0 && r.startUtc &&
      new Date(r.startUtc).getTime() - Date.now() < 5 * 60 * 1000)));
}
// Utterances queue, and a queue is latency. If the synthesiser is still working
// through earlier lines when new ones land, the callout is narrating the past —
// so a backlog gets dropped rather than drained. urgent lines (runs, the result)
// jump the queue outright.
// Left to itself the browser picks its DEFAULT voice, which on Windows Chrome
// is "Microsoft David" — the old SAPI5 formant synth. It is instant and it
// sounds like a 1998 answering machine. The neural voices (Edge's *Natural*
// family, Google's network voices) are a different class of thing to listen to
// for twenty minutes, so they are preferred where they exist.
//
// Ordered best-first; each entry is matched as a substring of the voice name.
// Anything not on the list still beats nothing — the last resort is the
// browser default, i.e. exactly the old behaviour.
//
// A man, specifically. "Natural" as a bare substring matched Edge's whole neural
// family, and the first hit in that family is usually Ava or Emma — so the rank
// has to name the male neural voices individually rather than trust the order
// the engine happens to enumerate them in.
const VOICE_RANK = [
  // Chosen by ear, on this machine, against the alternatives played back to back.
  // Mark is a local SAPI5 voice and on paper it loses to Google UK English Male,
  // which is a network voice and smoother. It was still preferred, and the reason
  // is probably that the Google man is British and this is American baseball —
  // the accent costs more than the synthesis quality buys. Do not "upgrade" this
  // on spec sheet grounds; it was an A/B, not a guess.
  "Microsoft Mark",
  // Edge's neural men, for a machine without Mark. Named individually because a
  // bare "Natural" substring matches Edge's whole neural family and the first hit
  // in it is usually Ava or Emma.
  "Andrew", "Brian", "Guy", "Christopher", "Eric",
  // Apple's American men, for the phone. Every name above this line exists on
  // Windows and on NOTHING else — so on an iPhone the whole rank used to miss and
  // the pick fell through to the default, which on iOS 16+ is Samantha. The call
  // was a man on the desk and a woman in the user's pocket, describing the same
  // inning. These four are the en-US male voices WebKit exposes: Aaron is the one
  // present on a stock iPhone, Alex and Fred are macOS, Tom is the older iOS
  // Vocalizer man. Ordered by how they read, not by how they rate on paper.
  "Aaron", "Alex", "Tom", "Fred",
  // Then the best remaining man, then the browser default this list exists to
  // avoid — David, the 1998 answering machine.
  //
  // ANDROID IS NOT SOLVED BY THIS LIST AND CANNOT BE. Chrome on Android
  // enumerates whatever the system TTS engine offers, and the Google engine names
  // its voices for locale only — "English United States", "Google US English" —
  // with no gender in the string and no attribute carrying it. There is nothing
  // to match on. Android therefore lands in the fallback below, which is why that
  // fallback now has to be better than "first thing in the list".
  "Google UK English Male", "Microsoft David",
];
/* Names that are unambiguously women, used ONLY to break ties in the fallback.
 *
 * This is deliberately a small denylist of specific voices rather than any
 * attempt to infer gender, because inference is wrong often enough to be worse
 * than nothing. It never overrides VOICE_RANK — a named voice above always wins.
 * It exists for the one case the rank cannot reach: a platform whose voice names
 * carry no gender at all, where the alternative is `pool[0]` and pool[0] is
 * frequently the very voice this is meant to avoid. */
const VOICE_AVOID = /\b(Samantha|Ava|Emma|Zira|Susan|Karen|Moira|Tessa|Fiona|Victoria|Allison|Nicky|Serena|Aria|Jenny|Michelle|Female)\b/i;
let _voice = null, _voiceTried = false;
function pickVoice(s) {
  // getVoices() is empty until the engine enumerates, and fires voiceschanged
  // when it is ready — so a null result must NOT be cached as "no voice".
  const all = s.getVoices ? s.getVoices() : [];
  if (!all.length) return null;
  const en = all.filter((v) => /^en/i.test(v.lang || ""));
  const pool = en.length ? en : all;
  /* localService is the one quality signal the API actually exposes, and on a
   * phone it is the difference between a broadcast and a sat-nav.
   *
   * A local voice is synthesised on the device: small, instant, and on Android
   * the stock local engine is the most robotic thing in this whole list. A
   * network voice is the vendor's neural model, which is what "sounds human"
   * means here. Nothing in the NAME distinguishes them — Android ships local and
   * network voices under the same locale label — so the flag is the only way to
   * tell, and until now it was ignored entirely.
   *
   * Used as a TIE-BREAK WITHIN a rank entry, never across entries. That
   * distinction is the whole safety of this change: Microsoft Mark is a LOCAL
   * formant voice that won an A/B against the smoother network man on the desk,
   * and a preference that outranked the list would quietly overturn that
   * measured result on spec-sheet reasoning — exactly what the note above it
   * forbids. Rank still decides who; this only decides which copy of them. */
  const better = (a, b) => (a.localService === b.localService ? a
    : a.localService === false ? a : b);
  for (const want of VOICE_RANK) {
    const hits = pool.filter((v) => String(v.name || "").includes(want));
    if (hits.length) return hits.reduce(better);
  }
  /* Fallback, for a platform no name in the rank reaches — in practice Android.
   *
   * The old line was `pool.find(v => v.default) || pool[0]`, and both halves of
   * it pick a woman on the platforms that get here: iOS defaults to Samantha,
   * and an alphabetical pool[0] is a coin flip. Narrowing beats ordering, so
   * this filters twice and only then falls back, each step skipped if it would
   * empty the pool:
   *
   *   en-US over en-anything, because the desk plays an American voice and an
   *   accent swap is the single most audible way for the two to stop matching.
   *   Then drop the named women. Neither filter can PICK a man — nothing in the
   *   string says so — but together they cut the odds of landing on one of the
   *   handful of voices we can positively identify as not matching the desk.
   *
   * Then the neural pass, which is the one that makes the phone sound human:
   * Android's stock LOCAL voice is the robotic one and its network voice is the
   * neural model, and since both carry the same locale-only name the
   * localService flag is the only thing that separates them. This sits AFTER
   * en-US and after the denylist because an accent swap and a gender swap are
   * both more audible than a quality drop, and before `default` because the
   * Android default is usually the local voice — which is the entire problem.
   *
   * Then, and only then, the browser default. Same last resort as before. */
  const narrow = (list, f) => { const k = list.filter(f); return k.length ? k : list; };
  let cand = narrow(pool, (v) => /^en[-_]us$/i.test(String(v.lang || "").replace("_", "-")));
  cand = narrow(cand, (v) => !VOICE_AVOID.test(String(v.name || "")));
  cand = narrow(cand, (v) => v.localService === false);
  return cand.find((v) => v.default) || cand[0] || pool[0] || null;
}
/* Delivery speed, and it has to depend on the voice.
 *
 * The original 1.02 was set because 1.1 clipped the ends of words — but that was
 * measured on the NEURAL voices, which read more slowly and more naturally than
 * the formant ones, and it was then applied to every voice. Microsoft Mark, the
 * top of VOICE_RANK and what actually plays on the machine this is used from, is
 * a local SAPI5 formant voice that takes 1.1 cleanly. It was paying for a defect
 * it does not have.
 *
 * So: 1.1 for the formant voices, and the neural family stays at 1.02, which is
 * the only rate actually verified not to clip on them. Do not split the
 * difference on spec-sheet reasoning — 1.02 and 1.1 are both measured, anything
 * between them is a guess.
 *
 * Naming is how Edge marks its neural voices ("... Online (Natural) - English"),
 * and Google's are network voices in the same boat. Anything unrecognised is
 * treated as neural, because that is the side where being wrong is audible.
 *
 * THE MOBILE VOICES ARE DELIBERATELY NOT LISTED HERE. Aaron, Alex, Tom and Fred
 * fall through to 1.02 by the unrecognised-is-neural rule above, which means the
 * phone reads about 8% slower than Mark does on the desk. That is a real gap in
 * "the voices match" and it is left in on purpose: Fred in particular is a
 * formant synth that almost certainly takes 1.1, but nobody has played it back
 * to check, and the whole point of the two constants is that both were measured.
 * Add a voice here after listening to it clip or not clip, not before. */
const SAY_RATE_FORMANT = 1.1, SAY_RATE_NEURAL = 1.02;
function voiceRate(v) {
  const n = String((v && v.name) || "");
  if (/Microsoft (Mark|David|Zira)/i.test(n)) return SAY_RATE_FORMANT;
  return SAY_RATE_NEURAL;
}
/* Dropping the backlog is right; dropping the batch was the bug.
 *
 * This used to be `if (urgent || s.pending) s.cancel()` before every line. A
 * poll that delivered three new pitches called speak() three times in a tight
 * synchronous loop: the first queued, the second saw pending=true and cancelled
 * — which wipes the utterance MID-SENTENCE as well as the queued one — and the
 * third did it again. Only the last pitch of each batch was ever heard, and it
 * arrived clipped on top of a killed sentence. A quiet inning with the
 * occasional stutter is exactly what that produces.
 *
 * So: a real queue with a depth cap, draining on `end`. When the backlog grows
 * past SAY_MAX the OLDEST lines are dropped, which keeps the call at the live
 * edge — the actual goal — instead of destroying whatever is being said now.
 * urgent still cuts everything, because a run scoring is the ticket resolving.
 *
 * `_sayOn` is a latch rather than a read of s.speaking: Chrome reports speaking
 * for a beat after `end`, and a drain that trusted it would stall the queue. */
const SAY_MAX = 3;
/* A line is worth saying because of when the PITCH was thrown, not because of
 * when it reached the queue, and those come apart badly when the tab is hidden.
 * Chrome intensively throttles — and eventually freezes — timers in a hidden
 * tab, and speechSynthesis does not earn the audio-playback exemption a <video>
 * would. The poll then stops for up to a minute and the next tick delivers the
 * whole backlog in one go. Every one of those lines is freshly enqueued, so a
 * depth cap keeps the newest three and speaks them as if they were live: the
 * call runs a minute behind the park, most pitches never get said at all, and
 * what does come out sounds like the inning being read back.
 *
 * So staleness is carried on the event timestamp. A pitch thrown 40 seconds ago
 * is dropped at drain time no matter how it got here, which re-anchors the call
 * to the live edge by itself on every wake-up. SAY_MAX still bounds the queue;
 * this bounds its AGE, which is the thing that was actually wrong.
 *
 * 6s, not 12s. A pitch comes about every 15-20s, and each spoken line runs 2-3s,
 * so a line that has been waiting 12s is two pitches behind and is describing
 * something the user can already see resolved on the board. Dropping it is not a
 * loss — the queue behind it is fresher, and skipping straight to that is the
 * whole mechanism by which the call re-anchors to live. The old value was set to
 * bound the hidden-tab freeze case, where anything under a minute was an
 * improvement; it was never tuned for how late a call can be and still be a call. */
const SAY_STALE_MS = 6000;
const _sayQ = [];
/* Why the callout is producing no sound, when the reason is the browser and not
 * us. Null means nothing is known to be wrong.
 *
 * This exists because the honest failure was invisible. `u.onerror = done` treats
 * every error as a finished line, so a browser refusing synthesis outright drains
 * the entire queue in milliseconds — each utterance errors, `done` starts the
 * next, which errors — and leaves the button reading "on" over total silence.
 * The desk had no way to say the one thing the listener needed to hear.
 *
 * Declared ABOVE the _sayOn latch deliberately. desk-callout-queue-test.js
 * builds its harness by slicing this file from that latch's declaration to the
 * next line-start brace in order to pull in _sayDrain, so any function defined
 * between those two points ends the slice early and silently drops _sayDrain
 * from the suite. Nothing below this block may be a function until _sayDrain.
 * (Note for the same reason: do not quote that declaration verbatim in a
 * comment above it, or the slice starts here instead.) */
let _sayBlocked = null;
let _sayBlockedCb = null;
function sayBlocked() { return _sayBlocked; }
function onSayBlocked(cb) { _sayBlockedCb = cb; }
function _setBlocked(why) {
  if (_sayBlocked === why) return;
  _sayBlocked = why;
  if (_sayBlockedCb) _sayBlockedCb(why);
}
/* _sayGen identifies the utterance the queue currently believes is speaking.
 *
 * `done` is wired to three things — onend, onerror and the watchdog — and until
 * this existed it had no way to tell WHICH utterance had fired it. That is not
 * hypothetical, because s.cancel() delivers the cancelled utterance's end event
 * asynchronously, i.e. after the replacement has already started. The settle
 * path walks straight into it: a run scores, speak(..., urgent) clears the
 * queue, cancels, and starts the settle line; the cancelled line's end event
 * then lands, `done` sees a latch that is set (it belongs to the settle now)
 * and dutifully clears it, kills the settle's watchdog, and drains the next
 * item on top of a line that is still being spoken. The one utterance that must
 * survive intact is the one this corrupts.
 *
 * A generation counter closes it: every utterance captures the value it was
 * created with, and any event arriving for a generation that is no longer
 * current is a ghost and is ignored. Bumping the counter is therefore how you
 * revoke an utterance's events — which is exactly what cancel and stop need. */
let _sayOn = false, _sayGuard = null, _sayGen = 0;
// The last line accepted into the queue, for the back-to-back guard in speak().
// Tracked here rather than read off _sayQ because the queue is usually EMPTY at
// the moment the duplicate arrives — the first copy is already being spoken.
let _sayLast = null;
function _sayDrain(s) {
  if (_sayOn) return;
  let item;
  // Skip anything that went stale while it waited, and keep skipping: after a
  // freeze the whole queue can be stale, and stopping at the first live line is
  // the point.
  for (;;) {
    item = _sayQ.shift();
    if (item == null) return;
    if (!(item.at > 0) || Date.now() - item.at <= SAY_STALE_MS) break;
  }
  const text = item.text;
  if (text == null) return;
  _sayOn = true;
  const u = new window.SpeechSynthesisUtterance(text);
  if (_voice) { u.voice = _voice; u.lang = _voice.lang || "en-US"; }
  u.rate = voiceRate(_voice); u.pitch = 1; u.volume = 1;
  const gen = ++_sayGen;
  const done = () => {
    // A late event from a cancelled or superseded utterance must not touch the
    // latch, the watchdog or the queue — all three now belong to whatever is
    // speaking instead.
    if (gen !== _sayGen || !_sayOn) return;
    _sayOn = false;
    if (_sayGuard) { clearTimeout(_sayGuard); _sayGuard = null; }
    _sayDrain(s);
  };
  // A line that genuinely reached the speakers clears any standing complaint:
  // whatever was blocking audio is demonstrably no longer blocking it.
  u.onend = () => { _setBlocked(null); done(); };
  // An utterance that errors (or that Chrome silently drops, which it does after
  // a cancel) never fires end, and without this the latch stays set and the
  // callout goes silent for the rest of the inning — the same failure the
  // s.paused nudge below was added to work around. Budget generously: ~90ms per
  // character plus a second, so a normal line never trips it.
  u.onerror = (e) => {
    const why = e && e.error ? String(e.error) : "";
    /* "not-allowed" is the autoplay policy, not a hiccup. The browser has
     * refused synthesis for want of a user gesture, so EVERY queued line will
     * fail identically — draining is the worst possible response, because it
     * empties the queue in milliseconds and the failure leaves no trace at all.
     *
     * Hold instead: drop the latch so a later line can try, bin the backlog
     * (by the time a listener taps, those pitches are long past — the same
     * judgement SAY_STALE_MS already makes), and record the reason so the UI
     * can ask for the gesture that fixes it. Every other error really is a
     * one-off and must keep draining, or one bad utterance mutes the inning. */
    if (why === "not-allowed") {
      _sayOn = false;
      if (_sayGuard) { clearTimeout(_sayGuard); _sayGuard = null; }
      _sayQ.length = 0;
      _sayLast = null;
      _setBlocked(why);
      return;
    }
    done();
  };
  /* The old budget was 1000 + 90ms/char, which is roughly 50% clear of what the
   * voice actually takes. That margin existed because firing early is dangerous:
   * `done` drains the next line, so a watchdog that goes off mid-sentence talks
   * over it — the same garble the generation counter fixes on the cancel path.
   * But paying for that safety in a flat budget means a dropped utterance costs
   * ~6s of dead air on a normal line, and dead air is what makes the call feel
   * behind the park.
   *
   * Asking the engine removes the tradeoff. If it is still speaking, the budget
   * was merely tight for this voice and the answer is to wait again, not to
   * interrupt; the budget can then sit close to real delivery (~70ms/char). If
   * it is NOT speaking, the utterance was genuinely dropped and recovery is
   * immediate instead of seconds late. Re-arms are capped so that Chrome parking
   * synthesis with speaking stuck true still recovers rather than hanging the
   * queue for the rest of the inning. */
  let waits = 0;
  const guard = () => {
    if (gen !== _sayGen || !_sayOn) return;
    if (s.speaking && waits < 6) { waits++; _sayGuard = setTimeout(guard, 1000); return; }
    done();
  };
  _sayGuard = setTimeout(guard, 700 + text.length * 70);
  s.speak(u);
  // Chrome can leave synthesis parked in a paused state after a cancel; a queued
  // utterance then never starts. Nudging it is free when it is already running.
  if (s.paused) s.resume();
}
/* `at` is the event's own timestamp — when the pitch was thrown or the play
 * ended — not when this was called. Omit it for lines that are true whenever
 * they are said (the intro, a settle): those are never stale. */
function speak(text, urgent, at) {
  const s = typeof window !== "undefined" && window.speechSynthesis;
  if (!s || !text) return;
  if (!_voice) {
    _voice = pickVoice(s);
    // Ask once for a re-resolve when the engine finishes enumerating.
    if (!_voice && !_voiceTried && s.addEventListener) {
      _voiceTried = true;
      s.addEventListener("voiceschanged", () => { _voice = pickVoice(s); }, { once: true });
    }
  }
  if (urgent) {
    _sayQ.length = 0;
    if (_sayGuard) { clearTimeout(_sayGuard); _sayGuard = null; }
    _sayOn = false;
    // Revoke the outgoing utterance's events BEFORE cancelling, so the end event
    // cancel is about to fire arrives as a ghost and cannot reach into the
    // settle line that is about to start.
    _sayGen++;
    s.cancel();
  }
  /* Backstop: never say the same thing twice in a row.
   *
   * The measured cause of the repeat report was the two-strike foul, and that is
   * fixed where it belongs — in the words, not here. This exists because that was
   * ONE cause found by looking, and the failure it produces (a line that lands
   * three seconds after an identical line) is both the most audible thing the
   * call can do wrong and the cheapest to rule out globally.
   *
   * Safe to make unconditional for running commentary, because a legitimate
   * back-to-back identical line barely exists: every count-changing pitch differs
   * from the one before it in the count it reads out, fouls now rotate their
   * wording, and two consecutive plays with a byte-identical description would
   * need the same batter doing the same thing twice. So this can essentially only
   * fire on a defect.
   *
   * `urgent` is exempt and must stay exempt. A settle is the ticket resolving,
   * and two games settling the same way seconds apart produce identical text
   * legitimately — that is the one line worth hearing twice. */
  if (!urgent && text === _sayLast) return;
  _sayLast = text;
  _sayQ.push({ text, at: typeof at === "number" && isFinite(at) ? at : 0 });
  // Trim from the FRONT: the stale lines are the ones not worth saying.
  while (_sayQ.length > SAY_MAX) _sayQ.shift();
  _sayDrain(s);
}
// Stopping the callout has to clear the queue too, or the lines already buffered
// keep arriving after the switch is off.
function speakStop() {
  const s = typeof window !== "undefined" && window.speechSynthesis;
  _sayQ.length = 0;
  if (_sayGuard) { clearTimeout(_sayGuard); _sayGuard = null; }
  _sayOn = false;
  // Same revocation as the urgent path. Toggling the callout off and straight
  // back on is the case that needs it: without the bump, the end event from the
  // utterance cancelled here can land after the first line of the new session
  // has started and drain the queue out from under it.
  _sayGen++;
  // A stop ends the session, so the next line is not a repeat of anything —
  // switching games and switching back must be able to re-announce the intro.
  _sayLast = null;
  if (s) s.cancel();
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
        // numOrNull, not Number. MLB returns "-.--" for a pitcher with no
        // recorded innings and "INF" for one who has allowed runs without
        // retiring anybody, and Number() turns both into NaN — which is not
        // null, so every `x != null` guard downstream waves it through. That is
        // how a NaN reached openerFactor and came out the other side as a NaN
        // multiplier on the lambda. numOrNull maps both sentinels to null, which
        // is what they mean: no reading, not a reading of nothing.
        era: numOrNull(st.era), whip: numOrNull(st.whip),
        k9, bb9, hr9, innings: ip,
        krate: bf ? Number(st.strikeOuts || 0) / bf : null,
        obpA: bf ? (Number(st.hits || 0) + Number(st.baseOnBalls || 0) + Number(st.hitByPitch || 0)) / bf : null,
        /* K-BB as a share of batters faced, which is the form his card prints and
         * a different statistic from the K/9 - BB/9 already on the badge row.
         * Per-9 rates are per OUT, so a pitcher who allows baserunners inflates
         * his own denominator and both rates drift together; per-batter does not
         * have that problem and is the one that travels between pitchers. Kept on
         * the i01 split like everything else here, so it is first-inning K-BB%,
         * not season — which is the number that should drive a first-inning bet.
         * Plain BB, not BB+HBP: that is the conventional definition. */
        kbbPct: bf ? 100 * (Number(st.strikeOuts || 0) - Number(st.baseOnBalls || 0)) / bf : null,
        bf,
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
      const pa = Number(i01.plateAppearances || 0);
      val = { rate: Number(i01.runs || 0) / i01.gamesPlayed, sample: i01.gamesPlayed,
        opsVsR: vr && vr.ops != null ? Number(vr.ops) : null,
        opsVsL: vl && vl.ops != null ? Number(vl.ops) : null,
        kRate: pa > 0 ? Number(i01.strikeOuts || 0) / pa : null,
        kSample: pa };
    }
  } catch { /* leave null */ }
  _teamI01.set(k, val);
  return val;
}

// Starter handedness (people) + recent form (last-3-start ERA from gameLog).
const _pitMeta = new Map();
// MLB hands back era/inningsPitched as STRINGS, and uses "-.--" (no innings) and
// "INF" (runs allowed, no outs) as sentinels. Number() turns both into NaN, and
// NaN survives nClamp — Math.max(lo, NaN) is NaN — so it rides the whole factor
// chain into pNRFI, where `pFinal >= 0.5` is false and the game silently renders
// as "YRFI · Pass — too close" instead of surfacing as missing data. Parse every
// numeric that comes off the feed through here.
const numOrNull = (v) => { if (v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const parseIp = (ip) => {
  const m = String(ip == null ? "0" : ip).split(".");
  const whole = numOrNull(m[0] || 0);
  if (whole == null) return 0;   // "-.--" means the pitcher has no innings, not "unknown"
  return whole + (m[1] === "1" ? 1 / 3 : m[1] === "2" ? 2 / 3 : 0);
};
async function pitcherMeta(pid, season) {
  if (pid == null) return { hand: null, form: null };
  const k = pid + ":" + season;
  if (_pitMeta.has(k)) return _pitMeta.get(k);
  let hand = null, form = null, fipForm = null, lastStartDate = null, seasonEra = null, gs = null, g = null, ip = null, allow = null, recentK9 = null, seasonK9 = null, recentIp = null;
  try {
    const [p, gl] = await Promise.all([
      getJson("https://statsapi.mlb.com/api/v1/people/" + pid + "?hydrate=stats(group=[pitching],type=[season],season=" + season + ")"),
      getJson("https://statsapi.mlb.com/api/v1/people/" + pid + "/stats?stats=gameLog&group=pitching&season=" + season),
    ]);
    const pp = p.people && p.people[0];
    hand = (pp && pp.pitchHand && pp.pitchHand.code) || null;
    const sst = pp && pp.stats && pp.stats[0] && pp.stats[0].splits && pp.stats[0].splits[0] && pp.stats[0].splits[0].stat;
    seasonEra = sst ? numOrNull(sst.era) : null;
    if (sst) { gs = numOrNull(sst.gamesStarted); g = numOrNull(sst.gamesPlayed); ip = sst.inningsPitched != null ? parseIp(sst.inningsPitched) : null; allow = paRates(sst, sst.battersFaced, NRFI_PA_REG_PIT); }
    const sp = (gl.stats && gl.stats[0] && gl.stats[0].splits) || [];
    // Use starts only for form + rest day tracking (exclude relief appearances)
    const starts = sp.filter((s) => Number(s.stat && s.stat.gamesStarted) === 1);
    const lastSt = starts[starts.length - 1];
    lastStartDate = (lastSt && (lastSt.date || (lastSt.game && lastSt.game.date))) || null;
    const recentStarts = starts.slice(-3);
    if (sst) {
      const sIp = sst.inningsPitched != null ? parseIp(sst.inningsPitched) : 0;
      if (sIp > 0) seasonK9 = Number(sst.strikeOuts || 0) * 9 / sIp;
    }
    if (recentStarts.length) {
      let er = 0, lip = 0, hr = 0, bb = 0, k = 0;
      const n0 = (v) => numOrNull(v) || 0;   // a malformed stat is 0, never NaN
      recentStarts.forEach((s) => {
        er += n0(s.stat && s.stat.earnedRuns);
        lip += parseIp(s.stat && s.stat.inningsPitched);
        hr += n0(s.stat && s.stat.homeRuns);
        bb += n0(s.stat && s.stat.baseOnBalls) + n0(s.stat && s.stat.hitByPitch);
        k += n0(s.stat && s.stat.strikeOuts);
      });
      if (lip > 0) {
        form = (er * 9) / lip;
        // FIP (Fielding Independent Pitching) removes defense noise — better forward predictor than ERA
        fipForm = Math.max(0.5, 3.13 + (13 * hr + 3 * bb - 2 * k) / lip);
        recentK9 = k * 9 / lip;
        recentIp = lip;   // the K9 trend check needs the sample size to judge the swing
      }
    }
  } catch { /* leave nulls */ }
  const val = { hand, form, fipForm, lastStartDate, seasonEra, gs, g, ip, allow, id: pid, recentK9, seasonK9, recentIp };
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
      .map((s) => ({ gamePk: s.game && s.game.gamePk, isHome: !!s.isHome, date: s.date || null }))
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
          return { clean: r === 0, runs: r, home: item.isHome, date: item.date };
        } catch { return null; }
      }));
      const valid = results.filter((x) => x !== null);
      if (valid.length) {
        const cleans = valid.map((v) => v.clean);
        const pct = (arr) => arr.length ? Math.round(arr.filter(Boolean).length / arr.length * 100) : null;
        const rps = (arr) => arr.length ? Math.round(arr.reduce((s, v) => s + v.runs, 0) / arr.length * 100) / 100 : null;
        const split = (subset) => subset.length >= 5 ? { pct: pct(subset.map(v => v.clean)), n: subset.length, runsPerStart: rps(subset) } : null;
        /* DAY windows, for the board strip only — deliberately NOT the same thing
         * as the START windows below. NRFIKINGKY's card reads "L30 · 5g": five
         * starts inside thirty days, a calendar window. `l30` here is the last
         * thirty STARTS. pitcherTrendFactor and pitcherVenueFactor read l30/l10/l5,
         * so repurposing them would silently move the model; these are additive
         * and display-only.
         *
         * n rides along on every window and is shown on the card, because n IS the
         * story. At the measured k=87.6 (scripts/nrfi-pitcherbt-rebuild.js) a
         * 2-start window is ~2% reliable, so a "100%" cell there is sampling dust
         * — true first-inning skill only spans about 64-77%. The strip mutes thin
         * cells instead of colouring them, so the eye cannot read noise as form. */
        const dayWin = (days) => {
          const cut = Date.now() - days * 864e5;
          const sub = valid.filter((v) => v.date && Date.parse(v.date + "T12:00:00Z") >= cut);
          return { pct: sub.length ? pct(sub.map((v) => v.clean)) : null, n: sub.length,
            runsPerStart: sub.length ? rps(sub) : null };
        };
        val = {
          windows: [{ key: "SZN", pct: pct(cleans), n: valid.length, runsPerStart: rps(valid) }]
            .concat([50, 30, 20, 14, 10, 7].map((d) => Object.assign({ key: "L" + d }, dayWin(d)))),
          szn: { pct: pct(cleans),             n: valid.length,                runsPerStart: rps(valid) },
          l30: { pct: pct(cleans.slice(-30)),   n: Math.min(valid.length, 30), runsPerStart: rps(valid.slice(-30)) },
          l10: { pct: pct(cleans.slice(-10)),   n: Math.min(valid.length, 10), runsPerStart: rps(valid.slice(-10)) },
          l5:  { pct: pct(cleans.slice(-5)),    n: Math.min(valid.length, 5),  runsPerStart: rps(valid.slice(-5)) },
          home: split(valid.filter(v => v.home)),    // season home starts (≥5 to activate)
          road: split(valid.filter(v => !v.home)),   // season road starts (≥5 to activate)
          streak: cleans.slice(-5),              // last 5 results oldest→newest for visual display
          lastClean: cleans.length > 0 ? cleans[cleans.length - 1] : null,
        };
      }
    }
  } catch { /* leave null */ }
  _rolling.set(k, val);
  return val;
}

/* Platoon edge: REMOVED. It took an offense's OPS vs the opposing starter's
 * hand over its own two-hand average, at weight 0.20 in offMult.
 *
 * It was redundant by construction. topOrderStrength already reads the POSTED
 * lineup's top-of-order OBP *against that same starter's hand* — the platoon
 * matchup measured on the actual batters due up, rather than on a team-season
 * aggregate that includes the eight men who are not leading off. Both were
 * pricing one fact, and the weight had already been cut from 0.6 to 0.2 in
 * acknowledgement of that without the last step being taken.
 *
 * Measured worth on a live board (scripts/nrfi-factor-contrib.js): 0.010pp
 * mean, 0.10pp max, zero verdict changes. The value gate needs 1.5pp to see
 * anything, so this was three orders of magnitude below the threshold at which
 * it could alter a decision. Its centring was separately checked and found
 * sound (nrfi-platoon-audit.js, +0.06% of lambda) — it was not broken, it was
 * simply already counted elsewhere.
 *
 * Note it only ever applied on the lambda path anyway: the base-out sim reads
 * real batters against real allow-rates, so handedness is inside it.
 */
/* Recent form (L3 FIP/ERA): REMOVED. It mapped a starter's last-three-start FIP
 * against a 4.15 baseline, at weight 0.10.
 *
 * FIP is 3.13 + (13*HR + 3*BB - 2*K)/IP, and pitchSkillFactor already prices
 * barrel, BB and K SEPARATELY with individually tuned weights (0.25 / 0.30 /
 * 0.35) instead of FIP's fixed 13/3/-2 coefficients. So this did not add
 * fielding-independent information; it restated three variables the model
 * measures more finely, over a three-start window noisy enough that the 4,015-
 * game backtest returned a logistic coefficient of -0.018 — the wrong sign,
 * i.e. counterproductive once pitBase is controlled for. That is why the weight
 * had already been walked down from 0.6 to 0.10.
 *
 * Measured worth: 0.178pp mean, 0.52pp max, zero verdict changes on a live
 * board. Still under the 1.5pp gate at its maximum.
 *
 * This was the only consumer of fipForm. Season-level pitcher quality is
 * unaffected and lives in pitchSkillFactor + pitBase.
 */
/* Pitcher rest days: REMOVED. There was a restFactor here returning 1.05 on <=3
 * days, 1.03 on 6-7 and 1.02 on 8+, with a comment reading "Weight is 0.10 so
 * effect is tiny (< 0.3pp)". The weight was not 0.10 — pitMult took the value as
 * `_rest` and never read it, so the real weight was zero. The factor was
 * computed, described on the card, and cast a YRFI consensus ballot, while
 * contributing nothing to the probability that ballot was voting on.
 *
 * Before deleting the ballot the claim was measured, at the half-inning level a
 * rest claim is actually about — rest belongs to one pitcher, so the question is
 * whether HIS half goes clean (scripts/nrfi-rest-measure.js, 3,349 regular-season
 * starts, baseline 70.6% clean):
 *
 *   <=3 (short)      13   69.2%  [42.4, 87.3]
 *   4 (normal)       12   83.3%  [55.2, 95.3]
 *   5 (normal)     1031   69.7%  [66.9, 72.5]
 *   6-7 (extra)    1869   70.9%  [68.8, 73.0]
 *   >=8 (layoff)    358   71.8%  [66.9, 76.2]
 *   penalised      2240   71.1%  [69.2, 72.9]
 *   not penalised  1043   69.9%  [67.0, 72.6]
 *
 * Every interval covers the baseline. The three buckets the model penalised come
 * back marginally CLEANER than the two it left alone, so the sign was wrong as
 * well as the size. And the headline case, short rest, has n=13 — with a modern
 * five-man rotation it essentially never happens, so the branch the comment led
 * with was the one that almost never fired.
 *
 * Nothing here is worth a term, and a factor at weight zero cannot be worth a
 * vote. Travel-and-rest, which is a different measurement (days since the team's
 * last game plus miles flown), is unaffected and still votes.
 */
// Pitcher rolling trend: L10 and L5 clean % vs season clean %.
// L5 confirms or extends the L10 signal; when both point the same way use the
// average (higher confidence), when they diverge dampen toward the less extreme.
// Weight 0.30 in pitMult — meaningful but capped; short windows are still noisy.
function pitcherTrendFactor(rolling) {
  if (!rolling) return { f: 1, note: "" };
  // Same window-inside-its-own-baseline defect the offense trend carried: szn is
  // every start including the last ten, so L10 sat on both sides of the
  // subtraction. Starters carry ~15-30 starts, so the attenuation here is milder
  // than the offense side's fixed 0.6 but varies by workload — a 20-start arm
  // reads half its true move, a 30-start arm two thirds.
  const l10w = rolling.l10 && (rolling.l10.n || 0) >= 5 ? rolling.l10 : null;
  const l5w  = rolling.l5  && (rolling.l5.n  || 0) >= 3 ? rolling.l5  : null;
  const szn  = rolling.szn && rolling.szn.pct != null ? rolling.szn : null;
  if (szn == null || (l10w == null && l5w == null)) return { f: 1, note: "" };
  const b10 = l10w ? (trendBaseline(szn, l10w, "pct") || szn) : null;
  const b5  = l5w  ? (trendBaseline(szn, l5w,  "pct") || szn) : null;
  const l10pct = l10w ? l10w.pct : null, l5pct = l5w ? l5w.pct : null;
  const d10 = l10w && b10 ? l10w.pct - b10.pct : null;
  const d5  = l5w  && b5  ? l5w.pct  - b5.pct  : null;
  // Same direction → use average (confirmed); opposite direction → use less extreme reading.
  const delta = (d10 != null && d5 != null)
    ? (Math.sign(d5) === Math.sign(d10) ? (d10 + d5) / 2 : (Math.abs(d10) <= Math.abs(d5) ? d10 : d5))
    : (d10 ?? d5);
  // runsPerStart supplement: continuous signal that differentiates mild vs severe non-clean starts.
  // Scaled to pp: 100% run rate reduction vs season average → +10pp boost.
  const l10rps = rolling.l10 && rolling.l10.runsPerStart != null ? rolling.l10.runsPerStart : null;
  const sznRps = (l10w && szn.runsPerStart != null && l10rps != null && (szn.n - l10w.n) >= 5)
    ? (szn.runsPerStart * szn.n - l10rps * l10w.n) / (szn.n - l10w.n)
    : (szn.runsPerStart != null ? szn.runsPerStart : null);
  // The `> 0` guard was survivable while the denominator was a whole season; a
  // de-overlapped prior can sit at 0.04 R/start, and dividing by that turned a
  // routine cold streak into -124pp (Schlittler, Webb, Ginn on 2026-08-15) which
  // pinned the factor at its clamp. Require a denominator big enough to divide by
  // and cap the supplement at the +-10pp the comment above describes.
  const RPS_FLOOR = 0.15;
  const rpsBoost = (l10rps != null && sznRps != null && sznRps >= RPS_FLOOR)
    ? nClamp((sznRps - l10rps) / sznRps * 10, -10, 10) : 0;
  const combined = (delta ?? 0) + rpsBoost;
  const l5tag = l5pct != null ? " · L5 " + l5pct + "%" : "";
  const rpsTag = l10rps != null ? " · " + l10rps.toFixed(2) + "R/st" : "";
  // Baseline is now the starts OUTSIDE the recent window, so the note says which
  // games it is comparing against instead of the old "vs SZN", which named a
  // figure that contained the window under test.
  const vs = " vs prior " + ((b10 || b5 || szn).n) + "gs";
  // Gates restated for the de-overlapped delta. Unlike the offense side the
  // attenuation was not a constant — szn is every start, so the overlap ran
  // (n-10)/n and moved with workload, measured 0.16..1.29 across the slate with a
  // 0.669 mean. These were searched rather than divided: 36/18/10 reproduces the
  // old bucket on 23 of 28 live arms and holds the fire rate at 14/28.
  const HOT2 = 36, HOT1 = 18, WARM = 10;
  if      (combined >=  HOT2) return { f: 0.84, d: combined, note: "L10+" + Math.round(combined) + "pp" + vs + " (blazing hot)" + l5tag + rpsTag };
  else if (combined >=  HOT1) return { f: 0.90, d: combined, note: "L10+" + Math.round(combined) + "pp" + vs + " (hot)" + l5tag + rpsTag };
  else if (combined >=  WARM) return { f: 0.95, d: combined, note: "L10+" + Math.round(combined) + "pp" + vs + " (warm)" + rpsTag };
  else if (combined <= -HOT2) return { f: 1.16, d: combined, note: "L10" + Math.round(combined) + "pp" + vs + " (icy cold)" + l5tag + rpsTag };
  else if (combined <= -HOT1) return { f: 1.09, d: combined, note: "L10" + Math.round(combined) + "pp" + vs + " (cold)" + l5tag + rpsTag };
  else if (combined <= -WARM) return { f: 1.04, d: combined, note: "L10" + Math.round(combined) + "pp" + vs + " (cooling)" + rpsTag };
  return { f: 1, d: combined, note: "" };
}
// Team first-inning offense rolling trend: L10 scored-in-1st rate vs season rate.
// Positive delta = team scoring more often in 1st than usual = more offense = YRFI lean.
// Weight 0.5 in offMult — direct measurement of the same stat the model is predicting.
// A recent window has to be measured against games it is NOT part of. rolling.szn
// is capped at the last 25 games (see teamOffenseRolling), so L10 is 40% of it:
// szn = 0.4*L10 + 0.6*prior, which makes (L10 - szn) collapse to exactly
// 0.6*(L10 - prior). Every delta this function saw was three fifths of its real
// size, measured on all 30 clubs 2026-08-15 — a club reading "-12pp vs SZN" was
// actually 20pp below the games before the streak. Subtracting the recent window
// back out recovers the baseline the comparison was always meant to use.
//
// Returns null when the leftover window is too short to be a baseline; the caller
// falls back to the whole-window rate rather than inventing a number.
//
// key selects the field to de-overlap ("rate" for team offense, "pct" for pitcher
// clean%), since both sides of the model carry the same window shape under
// different names.
function trendBaseline(whole, recent, key) {
  const k = key || "rate";
  if (!whole || !recent || whole[k] == null || recent[k] == null) return null;
  const n = whole.n || 0, m = recent.n || 0;
  if (n - m < 5) return null;
  const out = { n: n - m };
  out[k] = (whole[k] * n - recent[k] * m) / (n - m);
  return out;
}
// What the card needs to state a team's recent first-inning offense honestly:
// the window, the baseline that EXCLUDES it, and the streak length. Shared with
// the model so the two cannot drift apart.
function offL10Payload(rolling) {
  if (!rolling || !rolling.l10 || (rolling.l10.n || 0) < 5) return null;
  const szn = rolling.szn || null;
  const prior = szn ? trendBaseline(szn, rolling.l10) : null;
  return {
    rate: rolling.l10.rate, n: rolling.l10.n,
    sznRate: szn ? szn.rate : null, sznN: szn ? szn.n : null,
    priorRate: prior ? prior.rate : null, priorN: prior ? prior.n : null,
    avgRuns: rolling.l10.avgRuns,
    l5Rate: rolling.l5 && (rolling.l5.n || 0) >= 3 ? rolling.l5.rate : null,
  };
}
function teamOffenseTrendFactor(rolling) {
  if (!rolling) return { f: 1, note: "" };
  const l10 = rolling.l10 && (rolling.l10.n || 0) >= 5 ? rolling.l10 : null;
  const l5  = rolling.l5  && (rolling.l5.n  || 0) >= 3 ? rolling.l5  : null;
  const szn = rolling.szn && rolling.szn.rate != null ? rolling.szn : null;
  if ((l10 == null && l5 == null) || szn == null || szn.rate <= 0) return { f: 1, note: "" };
  // Each window gets its own baseline: L5's prior is games 6..N, L10's is 11..N.
  const b10 = l10 ? (trendBaseline(szn, l10) || szn) : null;
  const b5  = l5  ? (trendBaseline(szn, l5)  || szn) : null;
  const d10 = l10 && b10 ? l10.rate - b10.rate : null;
  const d5  = l5  && b5  ? l5.rate  - b5.rate  : null;
  // Same direction → average (confirmed); opposite → use less extreme (noise dampener).
  const delta = (d10 != null && d5 != null)
    ? (Math.sign(d5) === Math.sign(d10) ? (d10 + d5) / 2 : (Math.abs(d10) <= Math.abs(d5) ? d10 : d5))
    : (d10 ?? d5);
  // Secondary: avg runs/game quantitative delta (positive = more runs in L10 = hot offense)
  const l10rg = l10 && l10.avgRuns != null ? l10.avgRuns : null;
  const baseRg = (b10 && szn.avgRuns != null && l10 && l10.avgRuns != null && (szn.n - l10.n) >= 5)
    ? (szn.avgRuns * szn.n - l10.avgRuns * l10.n) / (szn.n - l10.n)
    : (szn.avgRuns != null ? szn.avgRuns : null);
  // Same near-zero denominator hazard as the pitcher side: a de-overlapped prior
  // can be a fraction of a run, and dividing by it swamps the delta it is only
  // meant to supplement. Floor the denominator and cap the boost at its weight.
  const RG_FLOOR = 0.15;
  const rgBoost = (l10rg != null && baseRg != null && baseRg >= RG_FLOOR)
    ? nClamp((l10rg - baseRg) / baseRg * 0.12, -0.12, 0.12) : 0;
  const combined = delta + rgBoost;
  // Gates are stated on the same de-overlapped scale the delta now carries, so
  // they hold sensitivity where it was rather than firing 1.67x more often. They
  // also line up with the noise floor: L10 against a ~15-game prior has a
  // difference-of-proportions SE near 20pp, so HOT/COLD is ~1.65 SE and
  // WARM/COOLING ~1 SE. Anything tighter is reading coin flips as a streak.
  const HOT = 0.33, WARM = 0.20;
  // Print the delta that actually decided the call, and name the window it came
  // from. The old note always printed d10 even when d5 drove the verdict, which is
  // how a club landed on the card as "off L10 hot (+4pp vs SZN)" — hot on four
  // points, because the real mover was L5 at +44. A label that contradicts its own
  // number reads as a broken model, so the blended case says so rather than
  // claiming a number that is not the L10 figure.
  const drove = d10 == null ? "L5" : d5 == null ? "L10"
    : Math.sign(d5) === Math.sign(d10) ? "L5+L10"
    : (Math.abs(d10) <= Math.abs(d5) ? "L10" : "L5");
  const pp = Math.round((delta ?? 0) * 100);
  const tag = " (" + (pp >= 0 ? "+" : "") + pp + "pp " + drove + " vs prior " +
    ((b10 || b5 || szn).n) + "g)";
  if      (combined >=  HOT)  return { f: 1.08, d: combined, note: "off hot" + tag };
  else if (combined >=  WARM) return { f: 1.04, d: combined, note: "off warm" + tag };
  else if (combined <= -HOT)  return { f: 0.93, d: combined, note: "off cold" + tag };
  else if (combined <= -WARM) return { f: 0.97, d: combined, note: "off cooling" + tag };
  return { f: 1, d: combined, note: "" };
}
// Team offense venue split: captures team-specific home/road first-inning scoring gaps
// beyond the flat homeOffAdvantage average. Requires ≥6 home AND ≥6 road games in rolling window.
// Weight 0.3 in offMult (partial overlap with homeOffAdvantage; only activates on clear outliers).
function offenseVenueFactor(rolling, isHome) {
  if (!rolling || !rolling.home || !rolling.road) return { f: 1, note: "" };
  const h = rolling.home, r = rolling.road;
  if ((h.n || 0) < 6 || (r.n || 0) < 6 || h.rate == null || r.rate == null) return { f: 1, note: "" };
  // delta: positive = team scores more at home than on road
  const delta = h.rate - r.rate;
  // effectiveDelta: positive = team is in a favorable venue today (YRFI lean)
  const effectiveDelta = isHome ? delta : -delta;
  const pp = Math.round(Math.abs(delta) * 100);
  const tag = isHome ? "home" : "road";
  if      (effectiveDelta >=  0.25) return { f: 1.06, note: tag + " offense +" + pp + "pp venue" };
  else if (effectiveDelta >=  0.15) return { f: 1.03, note: tag + " offense +" + pp + "pp venue" };
  else if (effectiveDelta <= -0.25) return { f: 0.95, note: tag + " offense -" + pp + "pp venue" };
  else if (effectiveDelta <= -0.15) return { f: 0.98, note: tag + " offense -" + pp + "pp venue" };
  return { f: 1, note: "" };
}
// Team first-inning K rate: high-K teams put fewer balls in play → fewer runs → NRFI lean.
// Uses season I01 PA-based K rate vs league average (~0.21). Weight 0.35 in offMult.
function offKrateFactor(off) {
  if (!off || off.kRate == null || (off.kSample || 0) < 80) return { f: 1, note: "" };
  // Measured across all 30 clubs on 2026-08-15: mean first-inning K% is 24.6,
  // median 24.6, range 19.9-29.8. At the old 0.21 baseline 22 of 30 teams graded
  // "above average K" and NOT ONE could ever reach the low-K buckets, so the
  // check could only ever vote NRFI — and offMult carried that bias into the
  // probability at weight 0.35. This is the league average, not a tuning knob.
  const LG_K = 0.246;
  const r = off.kRate / LG_K;
  const pct = Math.round(off.kRate * 100);
  if      (r >= 1.22) return { f: 0.93, note: "K%" + pct + "% (high K team)" };
  else if (r >= 1.10) return { f: 0.97, note: "K%" + pct + "% (above avg K)" };
  else if (r <= 0.78) return { f: 1.07, note: "K%" + pct + "% (low K — contact heavy)" };
  else if (r <= 0.90) return { f: 1.03, note: "K%" + pct + "% (below avg K)" };
  return { f: 1, note: "" };
}
/* ---- home field ----
 * Measured over 1,821 completed games, 2026-03-28..08-15 (scripts/nrfi-env-measure.js):
 *   away bats top 1st and scores  26.7%  [24.8, 28.8]
 *   home bats bot 1st and scores  32.1%  [30.0, 34.3]
 * The intervals do not overlap, so the split is real, and it is much larger than
 * the model was applying: lambda ratio home/away = 1.245 against a shipped 1.105.
 *
 * This used to be TWO constants — homePitAdvantage (0.97/1.03) and
 * homeOffAdvantage (1.02/0.98) — each guessed, each weighted 1.0, and both
 * landing on the same half's lambda. In halfNoRun the offense and pitcher rates
 * multiply into one number, so the two were never separately identifiable: a
 * half-inning run rate is a single observable and the model was fitting two
 * knobs to it. They are now one measured knob applied at the offense entry.
 *
 * Centred geometrically (sqrt up, 1/sqrt down) so it only REDISTRIBUTES lambda
 * between the halves and does not shift the level. That matters because the
 * team rates it multiplies are built from home and road games alike and already
 * carry the league average; a pair that did not centre at 1 would add a net
 * NRFI bias on top of the split it is meant to describe.
 */
const HFA_LAMBDA_RATIO = 1.245;
const HFA_UP = Math.sqrt(HFA_LAMBDA_RATIO), HFA_DOWN = 1 / Math.sqrt(HFA_LAMBDA_RATIO);
function homeOffAdvantage(isHome) {
  return isHome ? { f: HFA_UP } : { f: HFA_DOWN };
}
// Pitcher-specific venue split: some pitchers deviate significantly from the average
// home advantage. Uses season home or road 1st-inning clean% vs overall to quantify.
// Weight 0.5 in pitMult (smaller sample than SZN); only activates with ≥8 venue starts.
function pitcherVenueFactor(rolling, isPitchingHome) {
  if (!rolling) return { f: 1, note: "" };
  const venue = isPitchingHome ? rolling.home : rolling.road;
  if (!venue || (venue.n || 0) < 8 || rolling.szn == null || rolling.szn.pct == null) return { f: 1, note: "" };
  const delta = venue.pct - rolling.szn.pct; // + = cleaner in this venue than average
  const tag = isPitchingHome ? "home" : "road";
  if      (delta >=  20) return { f: 0.89, note: tag + " split +" + delta + "pp (excellent " + tag + " pitcher)" };
  else if (delta >=  10) return { f: 0.94, note: tag + " split +" + delta + "pp" };
  else if (delta <= -20) return { f: 1.11, note: tag + " split " + delta + "pp (struggles " + tag + ")" };
  else if (delta <= -10) return { f: 1.06, note: tag + " split " + delta + "pp" };
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
// "Slow starter": is this arm worse in the 1st than in the rest of his outing?
//
// Measured r = +0.658 against pitBase on the 2026-08-15 slate — by far the
// strongest overlap of any adjustment, and pitBase is the regressed 1st-inning
// run rate. Two separate causes, fixed here; note that neither flips the sign of
// the signal, which is a betting decision and needs a backtest, not a cleanup.
//
// 1. seasonEra INCLUDES the first innings being tested. A starter averaging ~5.5
//    IP has ~18% of his season innings in the 1st, so the old ratio divided a
//    number by a baseline partly made of itself: it both damped the comparison
//    and tied it to its own numerator. Innings 2+ is the baseline the comment
//    always claimed. Exact, since ER = ERA*IP/9 on both sides.
//
// 2. i01Era over ~20 innings is extremely noisy — two bad first innings move it a
//    full run — and that noise is precisely the component pitBase already carries,
//    which is what produced the correlation. Regressing it toward the same
//    baseline before taking the ratio removes noise the model has already priced
//    without touching the underlying signal.
const OPENER_REG_IP = 12;
function openerFactor(i01Era, seasonEra, seasonIp, i01Ip) {
  // isFinite, not `!= null`. NaN is not null, and every comparison against it is
  // false — so `seasonEra <= 0` does not reject NaN either, and a NaN walked all
  // the way through to `f: NaN` and a note reading "1st-inn NaN vs NaN ERA".
  // Callers hand this ERAs parsed from MLB strings, which include "-.--" and
  // "INF"; those are now nulled at the parse site above, and this is the second
  // line of defence, because a factor that returns NaN poisons the whole product
  // silently rather than failing where it can be seen.
  if (!Number.isFinite(i01Era) || !Number.isFinite(seasonEra) || seasonEra <= 0) return { f: 1, note: "n/a" };
  let baseEra = seasonEra, basis = "SZN";
  if (seasonIp != null && i01Ip != null && (seasonIp - i01Ip) >= 20) {
    const rest = (seasonEra * seasonIp - i01Era * i01Ip) / (seasonIp - i01Ip);
    // A starter whose earned runs are almost all in the 1st leaves a near-zero
    // rest-ERA; dividing by it would manufacture a huge ratio out of a small
    // denominator. Fall back to the season line rather than trust that.
    if (rest > 0.5) { baseEra = rest; basis = "inn 2+"; }
  }
  const ip = i01Ip || 0;
  const regEra = ip > 0 ? (i01Era * ip + baseEra * OPENER_REG_IP) / (ip + OPENER_REG_IP) : i01Era;
  const ratio = regEra / baseEra;
  const tag = ratio <= 0.8 ? "clean opener" : ratio >= 1.25 ? "slow starter" : "typical";
  return { f: nClamp(1 + (ratio - 1) * 0.15, 0.9, 1.12),
    note: "1st-inn " + i01Era.toFixed(2) + " vs " + baseEra.toFixed(2) + " ERA " + basis + " (" + tag + ")" };
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
          if (s && pa >= 5) h2hById[p.id] = { pa, rates: paRates(s, pa, NRFI_PA_REG_H2H) };
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
      val = { factor: nClamp(obp / NRFI_LG_TOP3_OBP, 0.82, 1.24), obp, batters: hasB ? batters : null,
        note: "1-3 OBP " + obp.toFixed(3) + (sit ? " vs " + (oppHand === "L" ? "LHP" : "RHP") : "") };
    } else if (hasB) {
      val = { factor: 1, obp: null, batters, note: "lineup posted" };
    }
  } catch { /* leave neutral */ }
  _obpCache.set(k, val);
  return val;
}

// Fetch the team's top-OBP batters from the active roster — used for the sim
// projection toggle when the real lineup hasn't been posted yet.
// Sorted by OBP desc, top 9 kept, H2H vs the opposing pitcher blended in.
async function teamBestLineup(teamId, season, oppHand, oppPitcherId) {
  if (teamId == null) return null;
  const sit = oppHand === "L" ? "vl" : oppHand === "R" ? "vr" : null;
  const k = teamId + ":" + season + ":" + (sit || "all") + ":" + (oppPitcherId || "");
  if (_rosterCache.has(k)) return _rosterCache.get(k);
  let val = null;
  try {
    const roster = await getJson("https://statsapi.mlb.com/api/v1/teams/" + teamId +
      "/roster?rosterType=active&season=" + season);
    const posPlayers = (roster.roster || []).filter((p) => p.position && p.position.type !== "Pitcher");
    const ids = posPlayers.map((p) => p.person && p.person.id).filter(Boolean);
    if (!ids.length) { _rosterCache.set(k, null); return null; }
    const type = sit ? "type=[statSplits],sitCodes=[" + sit + "]" : "type=[season]";
    const d = await getJson("https://statsapi.mlb.com/api/v1/people?personIds=" + ids.join(",") +
      "&hydrate=stats(group=[hitting]," + type + ",season=" + season + ")");
    const players = [];
    (d.people || []).forEach((p) => {
      const s = p.stats && p.stats[0] && p.stats[0].splits && p.stats[0].splits[0] && p.stats[0].splits[0].stat;
      if (!s) return;
      const pa = Number(s.plateAppearances || 0);
      if (pa < 50) return;
      const obp = s.obp != null ? Number(s.obp) : null;
      const rates = paRates(s, pa);
      if (obp != null && rates) players.push({ id: p.id, obp, rates });
    });
    if (!players.length) { _rosterCache.set(k, null); return null; }
    players.sort((a, b) => b.obp - a.obp);
    const top9 = players.slice(0, 9);
    let batters = top9.map((p) => p.rates);
    if (oppPitcherId && batters.some(Boolean)) {
      try {
        const topIds = top9.map((p) => p.id);
        const h2hD = await getJson("https://statsapi.mlb.com/api/v1/people?personIds=" + topIds.join(",") +
          "&hydrate=stats(group=[hitting],type=[vsPlayer],opposingPlayerId=" + oppPitcherId + ",season=" + season + ")");
        const h2hById = {};
        (h2hD.people || []).forEach((p) => {
          const s = p.stats && p.stats[0] && p.stats[0].splits && p.stats[0].splits[0] && p.stats[0].splits[0].stat;
          const pa = s ? Number(s.plateAppearances || s.atBats || 0) : 0;
          if (s && pa >= 5) h2hById[p.id] = { pa, rates: paRates(s, pa, NRFI_PA_REG_H2H) };
        });
        batters = batters.map((b, i) => {
          const h = h2hById[top9[i].id];
          if (!b || !h || !h.rates) return b;
          const wH = Math.min(0.65, h.pa / 20);
          const keys = ["out", "bb", "s1", "s2", "s3", "hr"];
          const blended = {};
          for (const key of keys) blended[key] = b[key] * (1 - wH) + h.rates[key] * wH;
          return blended;
        });
      } catch { /* keep season rates */ }
    }
    val = batters;
  } catch { /* leave null */ }
  _rosterCache.set(k, val);
  return val;
}

// Travel & rest: fatigue nudges early offense down slightly (favours NRFI).
//
// REFIT 2026-08-16 against 27942 half-innings / 1052 slates, residualised on the
// walk-forward arm model, bootstrapped by DATE (scripts/nrfi-travel-fit.js).
// Two of the four arms were guesses pointing the wrong way and are now 1.00:
//
//   state                        gap      t     MDE     was    now
//   played yesterday + traveled  +1.42pp  1.84  1.55pp  0.93   0.93
//   played yesterday             -1.11pp -1.64  1.35pp  0.98 -> 1.00
//   2d rest                      -0.21pp -0.27  1.59pp  1.00   1.00
//   3+ days rest                 +5.17pp  2.47  4.18pp  1.03 -> 1.00
//
// gap = this state's clean-rate residual minus every other state's, so POSITIVE
// is the NRFI direction. Note what that does to the two removed arms: a team
// that played yesterday at the same park is, if anything, the run-FRIENDLIER
// state, and 0.98 was nudging it toward NRFI. A wrong-signed constant is worse
// than a neutral one.
//
// 3+ days rest is the sharper embarrassment. It is the only arm that clears its
// MDE, and it clears it pointing the opposite way from the 1.03 that shipped:
// rested teams score LESS in the first, not more. The fit wants 0.697 and it is
// NOT taken — n=440 is the smallest bucket, it is the largest of four t-values
// tested, and a 30% swing off 440 observations is how the thin-arm profile and
// the environment tilt both got shipped and then evaporated. Neutral is the
// honest resting place for an arm we only know is backwards.
//
// 0.93 is KEPT despite sitting just under its own MDE (1.42 < 1.55). It is not a
// guess that survived; it is the one constant that was already right. Converted
// through offMult's 0.6 weight it moves offence by 4.2%, and the measured gap
// asks for 5.0% — the point estimate the model already had. A t of 1.84 is not
// evidence for it and not a reason to drop it either. Do not read the whole
// term as validated: at six seasons travel is still UNMEASURED, and the crude
// 2-group decomposition in nrfi-park-rest.js that calls it "something is there"
// assumes independent half-innings. Clustering by slate is what moved it under
// the line, and more seasons is the only thing that settles it.
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
      else if (restDays <= 1) val = { factor: 1, note: "played yesterday" };
      else if (restDays >= 3) val = { factor: 1, note: restDays + " days rest" };
      else val = { factor: 1, note: restDays + "d rest" };
    }
  } catch { /* leave neutral */ }
  _travelCache.set(k, val);
  return val;
}

// Team first-inning offense rolling: L5/L10/L20 scored-in-1st rate.
// Shares the linescore cache with pitcherRollingNRFI — fetches from the last
// 35 days so L20 is always populated mid-season. Rate = P(team scored ≥1 run in 1st).
async function teamOffenseRolling(teamId, todayStr, season) {
  if (teamId == null) return null;
  const k = teamId + ":" + todayStr;
  if (_teamOffRolling.has(k)) return _teamOffRolling.get(k);
  let val = null;
  try {
    const d0 = new Date(todayStr + "T12:00:00Z");
    const startDate = new Date(d0.getTime() - 35 * 86400000).toISOString().slice(0, 10);
    const sch = await getJson(
      "https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=" + teamId +
      "&startDate=" + startDate + "&endDate=" + todayStr
    );
    const items = [];
    (sch.dates || []).forEach((d) => {
      if (d.date >= todayStr) return;
      (d.games || []).forEach((g) => {
        const isHome = g.teams && g.teams.home && g.teams.home.team && g.teams.home.team.id === teamId;
        if (g.gamePk) items.push({ gamePk: g.gamePk, isHome });
      });
    });
    if (items.length) {
      const results = await Promise.all(items.slice(-25).map(async (item) => {
        try {
          const ls = await getLinescore(item.gamePk);
          const inn1 = ls && ls.innings && ls.innings[0];
          if (!inn1) return null;
          const r = item.isHome
            ? Number((inn1.home && inn1.home.runs) || 0)
            : Number((inn1.away && inn1.away.runs) || 0);
          return { scored: r > 0, runs: r, isHome: item.isHome };
        } catch { return null; }
      }));
      const valid = results.filter((x) => x !== null);
      if (valid.length >= 5) {
        const rate = (arr) => arr.length >= 3 ? arr.filter(v => v.scored).length / arr.length : null;
        const avg = (arr) => arr.length >= 3 ? Math.round(arr.reduce((s, v) => s + v.runs, 0) / arr.length * 100) / 100 : null;
        const venSplit = (arr) => arr.length >= 6 ? { rate: rate(arr), n: arr.length, avgRuns: avg(arr) } : null;
        val = {
          szn:  { rate: rate(valid),           n: valid.length,                avgRuns: avg(valid) },
          l20:  { rate: rate(valid.slice(-20)), n: Math.min(valid.length, 20), avgRuns: avg(valid.slice(-20)) },
          l10:  { rate: rate(valid.slice(-10)), n: Math.min(valid.length, 10), avgRuns: avg(valid.slice(-10)) },
          l5:   { rate: rate(valid.slice(-5)),  n: Math.min(valid.length, 5),  avgRuns: avg(valid.slice(-5)) },
          home: venSplit(valid.filter(v => v.isHome)),
          road: venSplit(valid.filter(v => !v.isHome)),
        };
      }
    }
  } catch { /* leave null */ }
  _teamOffRolling.set(k, val);
  return val;
}

/* ---- park + weather ----
 * env was the last place in the model where effects still COMPOUNDED: park x
 * temp x wind, raw, no weight, no clamp — and env multiplies lambda in both
 * halves, so P(NRFI) took the whole product twice. A 93-degree day with the wind
 * out to centre reached x1.19 on temp and wind alone before a park factor that
 * goes to ~1.12 at Coors. Everywhere else in the model, adjustments are blended
 * by deviation-from-neutral and weighted; this now matches.
 *
 * Bands refit against 1,821 games (scripts/nrfi-env-measure.js), all measured on
 * the FIRST INNING rather than the full game, which is where the old numbers
 * came from. Measured lambda multipliers, relative to the 56-81F neutral band:
 *
 *   indoors        x1.09 vs outdoors — the shipped value was 0.97, i.e. the
 *                  wrong SIGN. Not significant either way (interval spans the
 *                  baseline), and dome parks already carry it in NRFI_PARK, so
 *                  the special case was double-counting. Now neutral.
 *   temp >= 82     x1.24 measured (n=392) vs x1.05-1.09 shipped — heat matters
 *                  more than the model allowed, not less.
 *   temp <= 55     x0.91 / x0.89 measured — the shipped cold bands were close.
 *   wind           see below — refit 2026-08-15 against a much larger sample.
 *
 * REFIT, scripts/nrfi-temp-measure.js: 6,706 regular-season games across
 * 2024-2026 (5,530 outdoor), each game compared against other games AT THE SAME
 * PARK IN THE SAME MONTH with itself held out. The earlier fit above controlled
 * for neither, and pulled without gameType=R, so spring training — played in
 * Arizona and Florida, warm, with pitchers on strict counts — sat inside the hot
 * bucket it was being used to justify.
 *
 * TEMPERATURE survives all of it, which the start-hour lead did not:
 *   82-91F         x1.158, z=+3.51, venue+month held out (n=1,111)
 *   continuous     +0.122pp of YRFI per degree F, t=1.96 over 5,338 games,
 *                  which is x1.113 across the 56->86F span the bands describe.
 *   The model applies x1.120 across that span. The shipped magnitude was
 *   already right, so it is unchanged. Only the dead >=92 branch is gone: it
 *   held the same 1.20 as the band below it and could never return a different
 *   answer, and >=92 measures x1.144 (n=152) against 82-91's x1.158 — if
 *   anything slightly lower, certainly not separable.
 *   Cold bands read x0.929 (n=273) and x0.886 (n=83), neither clearing noise on
 *   its own, but the continuous trend that does clear noise passes through them
 *   at about the shipped magnitude. Kept, unchanged.
 *
 * WIND had the right idea on the wrong axis. The model's LARGEST wind
 * coefficients were on centre field and its smallest on the corners; the data
 * says centre field does nothing and the corners carry the entire effect:
 *   out to CF 5+      x0.973  z=-0.50  n=642   <- model applied 1.02-1.05
 *   in from CF 5+     x1.000  z=-0.00  n=263   <- model applied 0.95-0.98
 *   out to LF/RF 5+   x1.108  z=+2.39  n=1084  <- model applied 1.01-1.03
 *   in from LF/RF 5+  x0.824  z=-3.56  n=719   <- model applied 0.97-0.99
 *   crosswind 20+                      n=20    <- unreadable
 *   calm              x0.949  z=-1.11  n=894
 * in-from-corner replicates in every season (x0.828 / x0.771 / x0.788) and is
 * not temperature in disguise: those games average 72.2F against 73.7F for all
 * outdoor games, worth 0.18pp of a 6.5pp gap at the measured slope.
 *
 * But the SPEED tiers do not survive, and that is why the magnitudes below are
 * shrunk rather than fitted. The whole corner effect sits in 5-11 mph
 * (in-from x0.804 z=-3.69) and disappears above it (12-19 x1.018 z=+0.13).
 * A wind effect that switches off as the wind gets stronger is not a wind
 * effect, so speed tiering is dropped entirely — it was assumed, never fit, and
 * tiering an effect whose shape is backwards is three chances to overfit one
 * set of games. Direction is fit because it is robust; speed is not, because it
 * is not. The surviving values are roughly HALF the measured deviation, a
 * deliberate shrink given that out-to-corner does not survive a correction for
 * the ~30 comparisons this measurement ran and the tier anomaly is unexplained.
 */
/* Temperature is a gradient, and it used to ship as a cliff.
 *
 * The band was: below 82F nothing, at 82F and above x1.20 (x1.120 after the
 * 0.60 weight). That is a 12%-of-lambda jump across one degree, applied to BOTH
 * half-innings, so an 81F game and an 83F game came out ~5pp apart on P(NRFI)
 * for no reason a thermometer would recognise. On a mid-August board that is not
 * an edge case: five of fifteen games sat between 82F and 84F, right on the step.
 *
 * The band also does not replicate. Venue+month held out, by season:
 *
 *     2024  >=82   x1.466  z=+2.55      2025  x1.218  z=+1.44
 *     2026  >=82   x1.006  z=+0.03
 *
 * A term worth +47% in one season and +0.6% in another is a term fit to 2024.
 *
 * What DOES replicate is the continuous trend, which is one test on the full
 * sample rather than five band tests, and is the shape the physics predicts —
 * air density is monotone in temperature, it has no threshold at 82F:
 *
 *     n=5339   slope 0.1224pp of YRFI per degree F   t=1.97
 *     across the 56F->86F span that is x1.113 of lambda
 *
 * So: 0.113 / 30F = 0.00377 of lambda per degree, centred on the mean outdoor
 * game temperature (73.7F over 5,531 outdoor games) so the term is unbiased
 * across the season rather than only at one end of it.
 *
 * The clamp is +-~24F from the reference. Beyond that the linear fit is
 * extrapolating past where the sample is dense, and a 38F April game should not
 * inherit a coefficient estimated in July.
 *
 * Net effect: a 84F game carries x1.039 instead of x1.120. That is a large
 * reduction, and it is the measurement's number, not a hedge — the old value
 * was a 30-degree effect being handed to every game one degree over a line. */
const NRFI_TEMP_REF = 73.7;      // mean outdoor game temperature, 2024-2026
const NRFI_TEMP_SLOPE = 0.00377; // of lambda per degree F

const ENV_W_PARK = 1.00;  // park factors are the best-established of the three
// Temperature and wind now carry their own measured magnitudes directly, so
// their weights are 1.00: the shrink lives in the coefficient, where it is
// visible, rather than in a second weight that hides it. These three are kept as
// named terms at 1.00 rather than deleted because they are the ablation handles
// scripts/nrfi-factor-contrib.js patches to switch each part of env off.
const ENV_W_TEMP = 1.00;
const ENV_W_WIND = 1.00;
function weatherPark(game, homeAbbr) {
  const parkFactor = NRFI_PARK[homeAbbr] || 1;
  let tFactor = 1, wFactor = 1, note = "neutral park";
  const w = game.weather || {};
  const temp = w.temp != null && w.temp !== "" ? Number(w.temp) : null;
  const cond = String(w.condition || "");
  const wind = String(w.wind || "");
  if (/Dome|Roof Closed/i.test(cond)) {
    // Under a roof there is no wind and the temperature is set, so both drop out;
    // the park factor already describes the building.
    note = "indoors (roof)";
  } else {
    if (temp != null && isFinite(temp)) {
      // Continuous, not banded. See NRFI_TEMP_SLOPE for why the step went away.
      tFactor = nClamp(1 + NRFI_TEMP_SLOPE * (temp - NRFI_TEMP_REF), 0.91, 1.09);
    }
    // MLB wind string is field-relative ("Out To CF", "In From CF", "L To R").
    // Direction only: the speed tiers this used to carry ran backwards, so they
    // are gone rather than re-fitted. Centre field is neutral because it
    // measured neutral twice, in both directions, on 905 games.
    const mph = Number((wind.match(/(\d+)/) || [])[1] || 0);
    if (mph >= 5 && !/out to c|in from c/i.test(wind)) {
      if (/out to/i.test(wind))       wFactor = 1.05;   // measured x1.108
      else if (/in from/i.test(wind)) wFactor = 0.91;   // measured x0.824
    }
    // Say whether the wind was USED, not just what it was. A 15 mph reading out
    // to centre now moves nothing, and printing it next to an unchanged number
    // reads as a bug rather than as a finding. The card should be able to
    // explain its own arithmetic.
    let wNote = "";
    if (wind && mph >= 5) {
      if (/out to c|in from c/i.test(wind)) wNote = " (centre — no 1st-inn effect)";
      else if (wFactor > 1) wNote = " (out to a corner — helps offense)";
      else if (wFactor < 1) wNote = " (in from a corner — suppresses)";
    } else if (wind && mph > 0) wNote = " (under 5 mph — not applied)";
    note = (temp != null && isFinite(temp) ? temp + "°" : "") + (wind ? " · " + wind + wNote : "");
  }
  // The 0.88/1.16 bounds this used to carry were set when wind could move the
  // total by at most 0.0125, so they only ever caught a compounding blowup. With
  // wind now measured at -0.09 they had started binding on ordinary games: SF at
  // 70F with the wind in from a corner computes 0.840 and was being truncated to
  // 0.88 — and a pitcher's park with the wind blowing in is not an outlier, it is
  // the single most recognisable NRFI setup in baseball. A clamp that fires there
  // is discarding the effect this term was just refit to capture.
  //
  // Widened to admit the legitimate combinations and guard only the real tail.
  // All three components are independently measured, already shrunk, and blended
  // by deviation rather than multiplied, so the old blowup this defended against
  // cannot occur. Worst case with every component simultaneously at its own
  // extreme is 0.750 (SF park 0.93, temp clamped 0.91, wind in 0.91) and 1.280
  // (COL park 1.14, temp clamped 1.09, wind out 1.05); both still clamp, so the
  // bound is doing real work at the tail and nothing in the body of the
  // distribution. env multiplies lambda in BOTH halves, so these stay tight.
  const factor = nClamp(1 + (parkFactor - 1) * ENV_W_PARK + (tFactor - 1) * ENV_W_TEMP +
    (wFactor - 1) * ENV_W_WIND, 0.82, 1.20);
  return { factor, park: parkFactor, temp: tFactor, wind: wFactor, note: note || "neutral" };
}

function nrfiRegress(rate, sample, reg) {
  if (rate == null) return NRFI_LG_LAMBDA;
  const d = (sample || 0) + (reg || 0);
  if (!(d > 0)) return NRFI_LG_LAMBDA;   // 0/0 would return NaN, which survives nClamp
  return (rate * sample + NRFI_LG_LAMBDA * reg) / d;
}
// Turn a first-inning run RATE into P(the team scores at all), for display.
//
// The card used to print 1 - exp(-lambda), which is the Poisson answer and is
// wrong here by about ten points. Runs in an inning are heavily overdispersed —
// a team that scores in the 1st very often scores two or three, because rallies
// cluster — so the same lambda comes from FEWER scoring innings than Poisson
// assumes, and 1 - exp(-lambda) overstates every team. Measured on the Yankees:
// lambda 0.510 printed as 40%, actual season frequency 29.7% over 145 games.
//
// halfNoRun has always used the empirically anchored form instead, so the model
// was right and only the display was wrong. This is that same transform: at the
// league lambda it returns exactly the league scoring rate by construction.
function yrfiPctFromLambda(lambda) {
  if (lambda == null || !isFinite(lambda)) return null;
  return Math.round((1 - Math.pow(NRFI_LG_P0, lambda / NRFI_LG_LAMBDA)) * 100);
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
// The tabulated rates sum to 0.992, not 1 — the ~0.8pp gap is reached-on-error
// and other non-tabulated outcomes. matchupPA renormalises its own output, so
// this never escaped as a bad probability, but paRates regresses toward these
// numbers raw, which made the regression target something other than the league
// average it claims to be. Normalise once here so both callers see a real
// distribution; proportions are unchanged.
const NRFI_LG_PA = (() => {
  const raw = { out: 0.685, bb: 0.085, s1: 0.140, s2: 0.045, s3: 0.004, hr: 0.033 };
  const sum = Object.values(raw).reduce((a, b) => a + b, 0);
  const o = {}; for (const k of Object.keys(raw)) o[k] = raw[k] / sum;
  return o;
})();
// Regression toward the league PA profile, in pseudo-plate-appearances.
// The sim path (simHalfNoRun) consumes these rates raw, so a starter with one
// outing would otherwise arrive with out≈1.0 and score a near-certain NRFI —
// bypassing NRFI_PIT_REG, which only guards the lambda fallback path.
const NRFI_PA_REG_PIT = 200;  // ~9-10 starts before a pitcher outweighs the prior
const NRFI_PA_REG_H2H = 50;   // batter-vs-pitcher histories are tiny by nature
// Per-PA/BF outcome rates from a raw stat line.
// reg = pseudo-PA of league-average prior; omit (or 0) for raw rates.
function paRates(st, denom, reg) {
  const d = Number(denom || 0);
  if (!st || d <= 0) return null;
  const n = (x) => Number(x || 0);
  const bb = (n(st.baseOnBalls) + n(st.hitByPitch)) / d;
  const hr = n(st.homeRuns) / d;
  const s3 = n(st.triples) / d;
  const s2 = n(st.doubles) / d;
  const s1 = Math.max(0, n(st.hits) - n(st.doubles) - n(st.triples) - n(st.homeRuns)) / d;
  const out = Math.max(0, 1 - bb - hr - s3 - s2 - s1);
  const raw = { out, bb, s1, s2, s3, hr };
  // If the events outnumber the denominator (a stat line paired with the wrong
  // count), `out` floors at 0 while the hit rates keep their full value and the
  // row stops being a distribution. matchupPA would renormalise it into a silent
  // reweighting rather than an error, so square it up here.
  const rawSum = Object.values(raw).reduce((a, b) => a + b, 0);
  if (rawSum > 1) for (const key of Object.keys(raw)) raw[key] /= rawSum;
  const k = Number(reg || 0);
  if (k <= 0) return raw;
  const o = {};
  for (const key of ["out", "bb", "s1", "s2", "s3", "hr"]) {
    o[key] = (raw[key] * d + NRFI_LG_PA[key] * k) / (d + k);
  }
  return o;
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

  // Platoon and L3 form both removed — see the notes where their factors were.
  // Handedness now enters once, through the posted lineup's OBP vs the starter's
  // hand; pitcher quality enters once, through skill peripherals and pitBase.
  /* ---- day / night ----
   * This used to read `new Date(startUtc).getUTCHours() < 20`, described as
   * "before ~4pm local (approximated as UTC < 20:00)". The approximation only
   * holds for Eastern first pitches earlier than 8pm: anything later crosses
   * midnight UTC and re-enters the window from the BOTTOM, so a 7:10pm Central
   * or 6:40pm Pacific night game came back as hour 0 or 1 and was graded a day
   * game. Measured over 286 games it was wrong on 29.7% of them, and 73 night
   * games were taking the day-game penalty.
   *
   * MLB publishes its own designation on the schedule, so take that instead of
   * deriving one. It agrees with venue local time on 95.0% of 1,936 games and
   * carries the doubleheader and special-start cases that no hour rule does.
   * When the field is missing the answer is "unknown", not a guess — the rule
   * that produced the guess is exactly what this replaces.
   */
  const isDayGame = ctx.dayNight === "day";
  /* The penalty this used to feed is gone, and the label is why it existed.
   *
   * The shipped -0.15 cited a 2026 backtest of 886 day / 877 night showing
   * 4.5pp less NRFI. That is a 50/50 split, but day games are ~a third of a
   * schedule — the backtest had counted with the same broken rule, so its "day"
   * bucket was half genuine day games and half late West-Coast and Central
   * starts. Re-measured on 1,936 finals (scripts/nrfi-daynight-measure.js):
   *
   *   shipped labels:      day 47.5% / night 52.2%   gap -4.74pp
   *   MLB dayNight:        day 51.1% / night 48.9%   gap +2.27pp, logit +0.091
   *
   * The -4.7pp the model believed was self-generated: it reappears only under
   * the labelling that produced it. On clean labels the gap is small, POSITIVE
   * (day games are marginally more NRFI, not less) and its intervals overlap
   * throughout — [47.6, 54.7] against [46.0, 51.7]. There is no effect here to
   * price, and the old sign was pointing the wrong way.
   *
   * Confirmed since on 6,706 games across 2024-2026 rather than one season
   * (scripts/nrfi-starthour-measure.js §5): day 51.4% / night 50.7%, gap
   * +0.67pp, and +0.09pp z=0.09 once each park's own rate is subtracted out.
   * Season by season the gap runs +1.01pp, -1.09pp, +2.46pp — it does not even
   * hold its sign. The +2.27pp above was itself a single-season figure; it is
   * kept because it is what the withdrawal was decided on, but the three-season
   * number is the one to trust and it is nearer zero still.
   *
   * Start hour was left open here as "a candidate for a fitted term" — 7pm+
   * local ran 45.6% NRFI against ~51% for everything earlier. That is now
   * closed, and it is NOT a term (scripts/nrfi-starthour-measure.js, 6,706
   * games across 2024-2026, 41 venues, park held fixed by subtracting each
   * park's own rate from its games):
   *
   *   before 1pm  +4.13pp z=1.54     1pm-4pm  -0.51pp z=-0.44
   *   4pm-7pm     +0.11pp z=0.12     7pm+     -0.45pp z=-0.38
   *
   * Nothing clears noise. And the venue confound, which was the stated reason
   * for holding it back, was not what killed it: the raw three-season gap for
   * 7pm+ is only -0.88pp, so the -5pp never existed outside 2026 to be
   * confounded. Season by season the 7pm+ residual runs +0.83pp, +1.44pp,
   * -5.08pp — the whole signal was one season, and the two before it point the
   * other way. Same lesson the -0.15 penalty taught: one season is not a fit.
   */
  const dayGameShift = 0;
  const awayTrend = pitcherTrendFactor(ctx.awayRolling);
  const homeTrend = pitcherTrendFactor(ctx.homeRolling);
  const awayOffTrend = teamOffenseTrendFactor(ctx.awayOffRolling);
  const homeOffTrend = teamOffenseTrendFactor(ctx.homeOffRolling);
  const awaySkill = pitchSkillFactor(ctx.awayPeri, ctx.lg);
  const homeSkill = pitchSkillFactor(ctx.homePeri, ctx.lg);
  const awayOpen = openerFactor(ctx.awayPit && ctx.awayPit.era, ctx.awayMeta && ctx.awayMeta.seasonEra,
    ctx.awayMeta && ctx.awayMeta.ip, ctx.awayPit && ctx.awayPit.innings);
  const homeOpen = openerFactor(ctx.homePit && ctx.homePit.era, ctx.homeMeta && ctx.homeMeta.seasonEra,
    ctx.homeMeta && ctx.homeMeta.ip, ctx.homePit && ctx.homePit.innings);
  const awayOpenG = openerGameFactor(ctx.awayMeta);
  const homeOpenG = openerGameFactor(ctx.homeMeta);
  const awayLoad = seasonLoadFactor(ctx.awayMeta && ctx.awayMeta.ip);
  const homeLoad = seasonLoadFactor(ctx.homeMeta && ctx.homeMeta.ip);

  // Blend each side's adjustments by DEVIATION-from-neutral (not raw product)
  // so correlated signals don't compound, then cap the net swing.
  // platoon: GONE, not down-weighted. Two lines here described it as "reduced to
  //   0.20" long after offMult stopped taking it as an argument — and
  //   nrfi-weight-audit.js still carried that 0.20 in its weight table, printing
  //   a "!! missing" warning above a share column whose denominator looked whole.
  //   Lineup OBP is measured vs the starter's hand, which is the same fact; see
  //   the note where platoonFactor was.
  // homeAdv: the measured first-inning home/away split, weight 1.0 (structural).
  //   Carries the WHOLE home-field effect — the pitcher-side twin was removed as
  //   unidentifiable; see homeOffAdvantage.
  // offVenue: team-specific home/road 1st-inn scoring gap, weight 0.3 (partial overlap with homeAdv).
  // kRate: team 1st-inn K% vs league avg — high K = contact scarce = NRFI lean. Weight 0.35.
  // offTrend, offVenue and kRate are the offence-side members of the same group
  // of five that no backtest could see until 2026-08-16 (kRate for its own
  // reason: teamOffApi never read plateAppearances/strikeOuts off a response it
  // had already fetched). Their weights are hand-chosen and the first paired A/B
  // that could measure them cannot separate the group from off. Full numbers in
  // the correction above pitMult; do not cite these three as fitted either.
  const offMult = (lineup, travel, offTrend, homeAdv, venue, kRate) =>
    nClamp(1 + (lineup.factor - 1) * 1.0 + (travel.factor - 1) * 0.6 + (offTrend.f - 1) * 0.5 + (homeAdv.f - 1) * 1.0 + (venue.f - 1) * 0.3 + (kRate.f - 1) * 0.35, 0.80, 1.30);
  // Offense home field: the measured split, applied at the offense entry only.
  const awayOffAdv = homeOffAdvantage(false);
  const homeOffAdv = homeOffAdvantage(true);
  // Team-specific offense venue split: captures team's home/road 1st-inn scoring gap in rolling window.
  const awayOffVenue = offenseVenueFactor(ctx.awayOffRolling, false); // away team playing on road
  const homeOffVenue = offenseVenueFactor(ctx.homeOffRolling, true);  // home team playing at home
  // Pitcher-specific venue split: captures individual home/road performance gaps beyond the average.
  const awayVenue = pitcherVenueFactor(ctx.awayRolling, false); // away pitcher pitching on road
  const homeVenue = pitcherVenueFactor(ctx.homeRolling, true);  // home pitcher pitching at home
  // Weights tuned from 4,015-game backtest (logistic regression on normalized
  // features) — TRUE OF THE FIRST FOUR BULLETS ONLY. It is not true of trend or
  // venue, and it was written as if it covered them.
  //
  // Until 2026-08-16 buildCtx never set ctx.awayRolling/homeRolling, and every
  // factor reading them opens with `if (!rolling) return { f: 1 }`. So trend and
  // venue returned dead neutral on every game that backtest ever scored. Their
  // weights could not have been fitted there; no regression can put a coefficient
  // on a constant column. They were chosen by hand and the header above absorbed
  // them. See scripts/nrfi-ctx-parity.js, which now fails if it recurs.
  //
  // MEASURED, once the harness could compute them at all (30 days, 409 games,
  // scripts/nrfi-backtest-ab.js, paired by gamePk, resampled by date):
  //
  //     turning trend+venue+offTrend+offVenue+kRate OFF vs ON
  //       Brier  +0.00007 (t +0.19)   AUC  -0.0024 (t -0.54)
  //       12 side flips, ON right on 5/12
  //
  // Indistinguishable from off. Read that as UNMEASURED, not as disproved: the
  // smallest gap this test could resolve was 0.00075 Brier / 0.0088 AUC, and the
  // terms do move 99.8% of games by 0.60 pts on average. They are kept because a
  // t of -0.54 is not a reason to remove anything either. Do not quote these
  // weights as backtested until something separates them from zero.
  //
  // - skill (K%, BB%, barrel, GB): dominant after pitBase — keep at 1.0
  // - form (FIP/ERA L3): LR coeff -0.018 = counterproductive once pitBase
  //   controlled. Carried at 0.10 for a while, then REMOVED — pitMult below has
  //   taken no form argument for some time, so read this line as history.
  // - opener (1st-inn ERA vs season ERA): still useful signal → 0.5
  // - openG (bullpen game pattern): strong → 1.0
  // - load (season IP): small but logical → 0.7
  // - rest: gone entirely. It had sat here as a `_rest` parameter at weight 0
  //   while still being computed and voted on; see the note where restFactor was.
  // - trend (L10 vs SZN clean %): hot/cold streak captured here, weight 0.30.
  //   HAND-CHOSEN, not fitted — see the correction at the top of this block.
  // - homeAdv: REMOVED. It multiplied the same half's lambda as the offense-side
  //   home factor, so the two were one fact fitted twice; the measured split now
  //   lives entirely in homeOffAdvantage.
  // - venue: pitcher-specific home/road split beyond average, weight 0.5 (smaller
  //   sample). HAND-CHOSEN, not fitted — see the correction at the top of this block.
  const pitMult = (skill, opener, openG, load, trend, venue) =>
    nClamp(1 + (skill.f - 1) * 1.0 + (opener.f - 1) * 0.5 + (openG.f - 1) * 1.0 + (load.f - 1) * 0.7 + (trend.f - 1) * 0.30 + (venue.f - 1) * 0.5, 0.78, 1.25);
  const awayOffKRate = offKrateFactor(ctx.awayOff);
  const homeOffKRate = offKrateFactor(ctx.homeOff);
  /* The offense adjustments the base-out sim does NOT already contain.
   *
   * The sim reads real batters against real allow-rates, so lineup strength and
   * platoon are genuinely inside it and must not be applied twice — that part of
   * the original reasoning was right. But it left out three that season rates
   * cannot contain, and the sim path is the one that runs once lineups post,
   * which is to say almost all of them: measured 13 of 15 on the 2026-08-15
   * board. So the model's headline number changed character a few hours before
   * first pitch, and the checks list — which is built from the factors on either
   * path — kept printing "off cold (-33pp)" and casting its ballot while nothing
   * behind the probability carried it. Three such games on that same slate, all
   * between 48% and 51%, which is exactly where a 0.5-weight offense term
   * decides the call.
   *
   *   offTrend  0.5   last ten games of 1st-inning scoring; a recent deviation
   *                   from the season is by construction not in the season.
   *   offVenue  0.3   team-specific home/road gap; batter rates are venue-blended.
   *   kRate     0.35  1st-inning K% vs league.
   *
   * Weights match offMult so the two paths agree. kRate does partly overlap the
   * sim's own out-rate, but it overlaps the lambda path's 1st-inning run rate the
   * same way — a pre-existing double-count in both, not one introduced here.
   * Clamp is wide enough not to bind: the three terms cap at about +-0.083.
   */
  const offSimCtx = (trend, venue, kRate) =>
    nClamp(1 + (trend.f - 1) * 0.5 + (venue.f - 1) * 0.3 + (kRate.f - 1) * 0.35, 0.88, 1.12);
  const awayOffSim = offSimCtx(awayOffTrend, awayOffVenue, awayOffKRate);
  const homeOffSim = offSimCtx(homeOffTrend, homeOffVenue, homeOffKRate);
  const awayOff = awayOffBase * offMult(ctx.awayLineup, ctx.awayTravel, awayOffTrend, awayOffAdv, awayOffVenue, awayOffKRate);
  const homeOff = homeOffBase * offMult(ctx.homeLineup, ctx.homeTravel, homeOffTrend, homeOffAdv, homeOffVenue, homeOffKRate);
  const awayPit = awayPitBase * pitMult(awaySkill, awayOpen, awayOpenG, awayLoad, awayTrend, awayVenue);
  const homePit = homePitBase * pitMult(homeSkill, homeOpen, homeOpenG, homeLoad, homeTrend, homeVenue);
  /* No umpire term. MLB's ABS challenge system means the calls a "tight zone"
   * or "wide zone" reputation was built on now get overturned on request, so
   * per-umpire run tendency is no longer a stable property of the man behind
   * the plate — it is a property of how many challenges the teams have left.
   * A factor fitted on pre-challenge seasons describes a game that is not
   * being played any more.
   *
   * Removed rather than zeroed. Leaving `ctx.umpFactor || 1` wired into env
   * would mean anything that still wrote that field silently started moving
   * probabilities again; the point of taking it out is that it cannot come
   * back by accident. */
  const env = nClamp(1 + (ctx.wx.factor - 1), 0.85, 1.20);
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
    // recent form, opener/bullpen, travel, and park/weather.
    // Form weight 0.10 (down from 0.6) matches lambda path — backtest LR showed form counterproductive.
    const homeCtx = nClamp(1 + (homeOpen.f - 1) * 0.5 + (homeOpenG.f - 1) * 1.0 + (homeLoad.f - 1) * 0.7 + (homeTrend.f - 1) * 0.30 + (homeVenue.f - 1) * 0.5, 0.82, 1.2);
    const awayCtx = nClamp(1 + (awayOpen.f - 1) * 0.5 + (awayOpenG.f - 1) * 1.0 + (awayLoad.f - 1) * 0.7 + (awayTrend.f - 1) * 0.30 + (awayVenue.f - 1) * 0.5, 0.82, 1.2);
    const s0top = simHalfNoRun(awayB, homeAllow, NRFI_LG_PA);
    const s0bot = simHalfNoRun(homeB, awayAllow, NRFI_LG_PA);
    const pRunTop = nClamp((1 - s0top) * homeCtx * ctx.awayTravel.factor * awayOffAdv.f * awayOffSim * env, 0.02, 0.97);
    const pRunBot = nClamp((1 - s0bot) * awayCtx * ctx.homeTravel.factor * homeOffAdv.f * homeOffSim * env, 0.02, 0.97);
    /* The sim used to overwrite the lambda path outright the moment lineups
       posted. That was never measured. When it finally was, it lost.

       Paired over 395 games — same games, same inputs, only the path differs
       (scripts/desk-nrfi-backtest.js, 45-day window):

           w:       0.0     0.2     0.5     1.0 (old)
           Brier    .2321   .2321   .2332   .2377
           AUC      .6570   .6593   .6551   .6221
           BET55+    389     369     343     300

       Pure sim was worst on every column at once: worse Brier, worse
       discrimination, AND a third fewer playable games. It compresses toward
       50 (sd 8.1pp vs lambda's 10.5pp), so the 52/55/57/63 ladder has less to
       bite on. That compression is what "the model got less accurate and
       stopped giving me picks" actually was.

       Blend in logit space, not probability space: averaging probabilities
       drags every mix toward 0.5, which would make the midpoint look good for
       a reason unrelated to either path being right.

       w = 0.20 rather than 0 because the minimum is shallow — 0.0 through 0.3
       sit within 0.0002 Brier of each other — and AUC peaks at 0.2. The sim
       carries real matchup information, just far less than one full vote. */
    const pSim = (1 - pRunTop) * (1 - pRunBot);
    const pLam = p0top * p0bot;
    const lgt = (p) => Math.log(p / (1 - p));
    // Folded into one half so the `p0top * p0bot` product below reproduces the
    // blend exactly rather than re-multiplying two already-combined halves.
    p0top = 1 / (1 + Math.exp(-(NRFI_SIM_W * lgt(nClamp(pSim, 0.02, 0.98)) +
      (1 - NRFI_SIM_W) * lgt(nClamp(pLam, 0.02, 0.98)))));
    p0bot = 1;
    method = "blend";
  }
  // dayGameShift is 0 — see the block above for the measurement that withdrew
  // it. Kept as a named term rather than deleted so the next person to reach for
  // a day/night adjustment finds the 1,936-game result instead of the intuition.
  const logit = (p) => Math.log(p / (1 - p));
  const unlogit = (x) => 1 / (1 + Math.exp(-x));
  const applyShift = (p) => (dayGameShift === 0 ? p
    : nClamp(unlogit(logit(nClamp(p, 0.02, 0.98)) - dayGameShift), 0.02, 0.98));
  const pNRFI = applyShift(p0top * p0bot);

  // Projected sim: when lineups aren't posted, run the Markov sim with the team's
  // top-OBP active roster batters vs this pitcher's season allow rates.
  // Falls back to synthetic team-rate batters if the roster fetch failed.
  let pNRFI_simProj = null;
  if (method !== "sim" && homeAllow && awayAllow) {
    const synthLine = (teamOff) => {
      const lgRate = 0.50;
      const rate = teamOff && teamOff.rate != null ? teamOff.rate : lgRate;
      const rawScale = Math.min(1.5, Math.max(0.6, rate / lgRate));
      const outNew = Math.max(0.55, 1 - (1 - NRFI_LG_PA.out) * rawScale);
      const ns = (1 - outNew) / (1 - NRFI_LG_PA.out);
      return new Array(5).fill({ out: outNew, bb: NRFI_LG_PA.bb * ns, s1: NRFI_LG_PA.s1 * ns, s2: NRFI_LG_PA.s2 * ns, s3: NRFI_LG_PA.s3 * ns, hr: NRFI_LG_PA.hr * ns });
    };
    const awaySimBatters = ctx.awayBestLineup || synthLine(ctx.awayOff);
    const homeSimBatters = ctx.homeBestLineup || synthLine(ctx.homeOff);
    const sTop = simHalfNoRun(awaySimBatters, homeAllow, NRFI_LG_PA);
    const sBot = simHalfNoRun(homeSimBatters, awayAllow, NRFI_LG_PA);
    const hPC = nClamp(1 + (homeOpen.f-1)*0.5 + (homeOpenG.f-1)*1.0 + (homeLoad.f-1)*0.7 + (homeTrend.f-1)*0.30 + (homeVenue.f-1)*0.5, 0.82, 1.2);
    const aPC = nClamp(1 + (awayOpen.f-1)*0.5 + (awayOpenG.f-1)*1.0 + (awayLoad.f-1)*0.7 + (awayTrend.f-1)*0.30 + (awayVenue.f-1)*0.5, 0.82, 1.2);
    // Was the odd one out: it multiplied offVenue in raw and at full strength
    // while the real sim applied none of the three, so the projected number and
    // the number that replaced it were built to different recipes. Both now go
    // through offSimCtx.
    const pRT = nClamp((1-sTop) * hPC * ctx.awayTravel.factor * awayOffAdv.f * awayOffSim * env, 0.02, 0.97);
    const pRB = nClamp((1-sBot) * aPC * ctx.homeTravel.factor * homeOffAdv.f * homeOffSim * env, 0.02, 0.97);
    pNRFI_simProj = applyShift((1-pRT) * (1-pRB));
  }

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
  const thinNote = (p) => (p && p.sample && p.sample < 8) ? " [" + p.sample + "gs]" : "";
  const checks = [
    // Informational, and deliberately not a vote — the same defect, in the same
    // shape, as the "1st-inning offense" headline check below.
    //
    // This voted on (awayPitBase + homePitBase)/2 against 0.60/0.42. Those
    // numbers are right for a RAW first-inning run rate, which runs 0.00 to 2.00
    // across starters with a median near 0.44. But pitBase is nrfiRegress'd
    // against NRFI_LG_LAMBDA at NRFI_PIT_REG = 75, and a starter with the
    // typical ~23 first innings therefore carries only 23/(23+75) ≈ 24% of his
    // own rate. Averaging the two starters compresses it further.
    //
    // Measured over 338 games (scripts/nrfi-check-votes.js and the pitProfiles
    // rate/sample it exposes): the average spans 0.433 to 0.627, median 0.513,
    // p5 0.458, p95 0.563. The NRFI line at 0.42 is BELOW THE MINIMUM — not
    // rare, unreachable, 0 of 338. The YRFI line at 0.60 cleared 4 times, 1.2%.
    // So the headline row of every card advertised a two-sided read on the
    // starters and could only ever cast one of the two votes, on one game in
    // eighty. It was measured at 5 votes in 415 games before anyone looked.
    //
    // NOT rescaled to the observed spread, though that is the tempting fix. New
    // lines at roughly +/-1 SD would vote on about a third of the slate, and
    // nothing here shows that vote would be any GOOD: the only discrimination
    // test available runs on feeds that are not rewound, so it would be tuned
    // against a leaked measurement. Neutralising costs almost nothing by
    // comparison — the check speaks on 1% of games and one vote among the ten
    // in the pitching family rarely moves it — so this removes a known-broken
    // input rather than adding an unvalidated one. Rescale when a point-in-time
    // discrimination test exists to justify a specific line.
    { label: "Starting pitching (1st inning)",
      detail: ctx.homePP + hand(ctx.homeMeta) + thinNote(ctx.homePit) + " " + awayPit0(ctx.homePit) + " · " + ctx.awayPP + hand(ctx.awayMeta) + thinNote(ctx.awayPit) + " " + awayPit0(ctx.awayPit),
      lean: "neutral" },
    { label: "Pitcher skill (K/BB/barrel/GB)",
      detail: ctx.homePP + ": " + homeSkill.note + " · " + ctx.awayPP + ": " + awaySkill.note,
      lean: facLean((awaySkill.f + homeSkill.f) / 2) },
    { label: "Opener / bullpen game",
      detail: ctx.homePP + ": " + homeOpenG.note + " · " + ctx.awayPP + ": " + awayOpenG.note,
      lean: (awayOpenG.opener || homeOpenG.opener) ? "nrfi" : "neutral" },
    (() => {
      // A K/9 read off three starts is noisy: the standard error is
      // sqrt(9*K9/IP), so at a typical 17 IP window one SE is ~2.2 K/9. The
      // thresholds below sit near 1 SE (report) and ~1.4 SE (vote) — anything
      // tighter is reading sampling noise as a change in stuff. Short windows
      // are rejected outright rather than scaled, since a 6 IP window carries
      // a ~3.7 K/9 SE and can't distinguish anything worth voting on.
      const MIN_RECENT_IP = 12, K9_REPORT = 2.0, K9_VOTE = 3.0;
      const mk = (m, name) => {
        if (!m || m.recentK9 == null || m.seasonK9 == null || m.seasonK9 < 3) return null;
        if ((m.recentIp || 0) < MIN_RECENT_IP) return null;
        const delta = m.recentK9 - m.seasonK9;
        const pct = Math.round(Math.abs(delta) / m.seasonK9 * 100);
        if (Math.abs(delta) < K9_REPORT) return null;
        return { name, delta, pct, note: name + " K/9 L3 " + m.recentK9.toFixed(1) + (delta > 0 ? " ↑" : " ↓") + pct + "% vs SZN " + m.seasonK9.toFixed(1) + " (" + m.recentIp.toFixed(1) + " IP)" };
      };
      const aw = mk(ctx.awayMeta, ctx.awayPP), hm = mk(ctx.homeMeta, ctx.homePP);
      if (!aw && !hm) return null;
      const notes = [aw?.note, hm?.note].filter(Boolean);
      const deltas = [aw?.delta, hm?.delta].filter((d) => d != null);
      const avgDelta = deltas.reduce((s, d) => s + d, 0) / deltas.length;
      return { label: "Pitcher K9 trend (L3 vs SZN)", detail: notes.join(" · "),
        lean: avgDelta >= K9_VOTE ? "nrfi" : avgDelta <= -K9_VOTE ? "yrfi" : "neutral" };
    })(),
    { label: "Clean opener vs slow starter",
      detail: ctx.homePP + ": " + homeOpen.note + " · " + ctx.awayPP + ": " + awayOpen.note,
      lean: facLean((awayOpen.f + homeOpen.f) / 2) },
    // Informational, and deliberately not a vote — same treatment as "Pitcher
    // season load" and "Day game", for a stronger reason than either.
    //
    // This voted on (awayOffBase + homeOffBase)/2 against 0.60/0.44. Once
    // NRFI_OFF_REG was measured at 1200 those baselines span only about 0.502 to
    // 0.539 across the whole league, so neither threshold can ever be reached
    // and the row would have gone on displaying a vote it could no longer cast.
    // Leaving it as `lean(...)` would have been a silently dead check rather
    // than an honest neutral one.
    //
    // The deeper reason is why NRFI_OFF_REG moved at all: a team's own season
    // first-inning rate has no measured signal (odd/even split-half r = 0.053,
    // CI [-0.206, 0.313]; observed team spread narrower than the noise floor).
    // A check voting on it was voting on noise. The rates are still shown
    // because they are what a reader wants to see, and team offense still moves
    // the number through offMult — lineup OBP, venue, K% and form.
    { label: "1st-inning offense",
      detail: ctx.awayName + " " + rate2(ctx.awayOff) + " R · " + ctx.homeName + " " + rate2(ctx.homeOff) + " R" +
        " — season rate, shown for context; no measured signal (see NRFI_OFF_REG)",
      lean: "neutral" },
    (() => {
      const aR = ctx.awayOffRolling, hR = ctx.homeOffRolling;
      const aL10 = aR && aR.l10 && aR.l10.n >= 5 ? aR.l10.rate : null;
      const hL10 = hR && hR.l10 && hR.l10.n >= 5 ? hR.l10.rate : null;
      if (aL10 == null && hL10 == null) return null;
      const fmt = (r) => r != null ? Math.round(r * 100) + "%" : "—";
      const notes = [];
      if (aL10 != null) {
        const szn = aR.szn && aR.szn.rate != null ? aR.szn.rate : null;
        const d = szn != null ? aL10 - szn : null;
        const arrow = d == null ? "" : d >= 0.12 ? " ↑hot" : d <= -0.12 ? " ↓cold" : "";
        const rgTag = aR.l10 && aR.l10.avgRuns != null ? "  " + aR.l10.avgRuns.toFixed(2) + "R/g" : "";
        const aL5 = aR.l5 && aR.l5.n >= 3 ? aR.l5.rate : null;
        const l5tag = aL5 != null ? "  L5 " + Math.round(aL5 * 100) + "%" : "";
        notes.push(ctx.awayName + " L10 " + fmt(aL10) + arrow + (szn != null ? " (SZN " + fmt(szn) + ")" : "") + rgTag + l5tag);
      }
      if (hL10 != null) {
        const szn = hR.szn && hR.szn.rate != null ? hR.szn.rate : null;
        const d = szn != null ? hL10 - szn : null;
        const arrow = d == null ? "" : d >= 0.12 ? " ↑hot" : d <= -0.12 ? " ↓cold" : "";
        const rgTag = hR.l10 && hR.l10.avgRuns != null ? "  " + hR.l10.avgRuns.toFixed(2) + "R/g" : "";
        const hL5 = hR.l5 && hR.l5.n >= 3 ? hR.l5.rate : null;
        const l5tag = hL5 != null ? "  L5 " + Math.round(hL5 * 100) + "%" : "";
        notes.push(ctx.homeName + " L10 " + fmt(hL10) + arrow + (szn != null ? " (SZN " + fmt(szn) + ")" : "") + rgTag + l5tag);
      }
      // This demanded that BOTH offences sit 12pp or more off their own season
      // rate in the same direction. Measured 2026-08-15: 3 of 30 clubs were that
      // cold and 5 that hot, so the conjunction covers ~3.8% of games — 0.6 of a
      // 15-game slate, and it voted on none of them.
      //
      // The bar was also weaker than it looked. L10 first-inning scoring is ten
      // Bernoulli trials, so its standard error is about 14pp and a 12pp gate is
      // under one SE. Requiring two independent sub-SE excursions to coincide is
      // rare without being meaningful, and it discarded the ordinary case where
      // one offence is clearly cold and the other is unremarkable.
      //
      // Average the two trend factors instead, as the venue-split and K% checks
      // do. teamOffenseTrendFactor already damps the noise (L5/L10 direction
      // confirmation plus a runs-per-game term) and is the same number offMult
      // weighs at 0.5, so the vote now agrees with the probability instead of
      // deriving its own raw diff. Symmetric 0.03 band — opposed offences still
      // cancel to neutral, because a hot bat against a cold one is not a signal.
      const fAvg = ((awayOffTrend.f - 1) + (homeOffTrend.f - 1)) / 2 + 1;
      return { label: "Offense trend (1st inn L10)",
        detail: notes.join(" · "),
        lean: fAvg <= 0.97 ? "nrfi" : fAvg >= 1.03 ? "yrfi" : "neutral" };
    })(),
    (() => {
      if (!awayOffVenue.note && !homeOffVenue.note) return null;
      const notes = [];
      if (awayOffVenue.note) notes.push(ctx.awayName + ": " + awayOffVenue.note);
      if (homeOffVenue.note) notes.push(ctx.homeName + ": " + homeOffVenue.note);
      const fAvg = ((awayOffVenue.f - 1) + (homeOffVenue.f - 1)) / 2 + 1;
      return { label: "Offense venue split", detail: notes.join(" · "),
        lean: fAvg >= 1.04 ? "yrfi" : fAvg <= 0.97 ? "nrfi" : "neutral" };
    })(),
    (() => {
      const aK = awayOffKRate, hK = homeOffKRate;
      if (aK.f === 1 && hK.f === 1) return null;
      const notes = [];
      if (aK.note) notes.push(ctx.awayName + " " + aK.note);
      if (hK.note) notes.push(ctx.homeName + " " + hK.note);
      const fAvg = ((aK.f - 1) + (hK.f - 1)) / 2 + 1;
      return { label: "Team K% (1st inn)", detail: notes.join(" · "),
        lean: fAvg <= 0.97 ? "nrfi" : fAvg >= 1.04 ? "yrfi" : "neutral" };
    })(),
    { label: "Lineups (leadoff-weighted)",
      detail: ctx.awayName + ": " + ctx.awayLineup.note + " · " + ctx.homeName + ": " + ctx.homeLineup.note,
      lean: facLean((ctx.awayLineup.factor + ctx.homeLineup.factor) / 2) },
    // Travel & rest votes NRFI 89 times out of 89 over 415 games. THE REFIT AT
    // travelRest DID NOT CHANGE THAT — re-measured after it, still 89 of 89,
    // the identical game set. It could not have changed: the vote fires when the
    // product clears 0.955, which has always meant "at least one side traveled
    // overnight", and dropping the 0.98 and 1.03 arms to neutral moves no game
    // across that line. What the refit changed is the size of the nudge those
    // two states apply through offMult, which is a different question from what
    // this row says out loud. Do not read the constants work as a fix here.
    //
    // It will never vote YRFI, and that is no longer a defect to chase.
    // There is no anti-travel: a team either changed parks or it did not, and
    // the absence is the baseline, not the opposite pole. The earlier notes
    // called the upper arm "decorative" and left it in; leaving an unreachable
    // branch in place is what let two readers believe the term was symmetric.
    // It is directional, it says so, and the yrfi branch is gone rather than
    // pretending otherwise. Removing it changes no output — with a maximum
    // product of 1.00 it could not fire.
    //
    // Keep this prose ABOVE the object. nrfi-check-votes.js reads the `lean:`
    // within 800 characters of the `label:` and throws otherwise; that tight
    // window is what stops it reading a neighbouring check's vote, so the
    // explanation goes here rather than between the two properties.
    { label: "Travel & rest",
      detail: ctx.awayName + ": " + ctx.awayTravel.note + " · " + ctx.homeName + ": " + ctx.homeTravel.note,
      lean: (ctx.awayTravel.factor * ctx.homeTravel.factor) <= 0.955 ? "nrfi" : "neutral" },
    // Informational, and deliberately not a vote — same reason as Day game below.
    //
    // seasonLoadFactor bottoms out at 1.00 and climbs to 1.04, so it cannot
    // express a rested arm, only a worn one. A check built on it is structurally
    // incapable of voting NRFI: it either says YRFI or abstains, which in a
    // consensus tally is a thumb on the scale rather than a reading. This one
    // was one-sided twice over — it also fired on `awayLoad.f >= 1.03 ||
    // homeLoad.f >= 1.03`, so a single heavy arm carried the row, where every
    // other paired check averages the two sides.
    //
    // Measured by cumulative starts, the proxy for season IP the schedule feed
    // supports at ~5.3 IP a start (scripts/nrfi-rest-measure.js, 3,349 starts,
    // 70.6% clean baseline): >=23 starts — the ~120 IP line where the factor
    // first fires — runs 72.0% [58.3, 82.5] against 70.6% for everything below
    // it. Marginally cleaner, not dirtier. But n=50: coverage is essentially
    // complete (3,736 of 3,738 starter slots, 334 distinct pitchers) and the
    // thin tail is simply mid-August, where nobody has made 28 starts yet. So
    // the direction is unconfirmed rather than refuted, and the honest state is
    // under-powered — worth re-measuring on a full season before the 0.7-weight
    // term stays or goes. Until then it nudges the number and does not vote.
    { label: "Pitcher season load",
      detail: ctx.homePP + ": " + (homeLoad.note || "normal") + " · " + ctx.awayPP + ": " + (awayLoad.note || "normal"),
      lean: "neutral" },
    // Informational, and deliberately not a vote. The YRFI ballot this used to
    // cast rested on the same contaminated split as the withdrawn logit shift;
    // on MLB's own labels day games are 51.1% NRFI against night's 48.9%, which
    // is the opposite direction and inside the noise either way.
    isDayGame ? { label: "Day game",
      detail: "Daytime first pitch — 51.4% NRFI vs 50.7% at night over 6,706 games (2024-26), " +
        "and +0.1pp once each park's own rate is held out. Inside the noise. No adjustment applied.",
      lean: "neutral" } : null,
    { label: "Weather & park", detail: ctx.wx.note, lean: facLean(ctx.wx.factor) },
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
      const aL5  = ctx.awayRolling && ctx.awayRolling.l5  && ctx.awayRolling.l5.n  >= 3 ? ctx.awayRolling.l5.pct  : null;
      const hL5  = ctx.homeRolling && ctx.homeRolling.l5  && ctx.homeRolling.l5.n  >= 3 ? ctx.homeRolling.l5.pct  : null;
      const aSzn = ctx.awayRolling && ctx.awayRolling.szn ? ctx.awayRolling.szn.pct : null;
      const hSzn = ctx.homeRolling && ctx.homeRolling.szn ? ctx.homeRolling.szn.pct : null;
      if (aL10 == null && hL10 == null) return null;
      const notes = [];
      const diffs = [];
      if (aL10 != null) {
        const diff = aSzn != null ? aL10 - aSzn : null;
        const arrow = diff == null ? "" : diff >= 10 ? " ↑hot" : diff <= -10 ? " ↓cold" : "";
        const l5tag = aL5 != null ? "  L5 " + aL5 + "%" : "";
        notes.push(ctx.awayPP + ": L10 " + aL10 + "%" + arrow + (aSzn != null ? " (SZN " + aSzn + "%)" : "") + l5tag);
        if (diff != null) diffs.push(diff);
      }
      if (hL10 != null) {
        const diff = hSzn != null ? hL10 - hSzn : null;
        const arrow = diff == null ? "" : diff >= 10 ? " ↑hot" : diff <= -10 ? " ↓cold" : "";
        const l5tag = hL5 != null ? "  L5 " + hL5 + "%" : "";
        notes.push(ctx.homePP + ": L10 " + hL10 + "%" + arrow + (hSzn != null ? " (SZN " + hSzn + "%)" : "") + l5tag);
        if (diff != null) diffs.push(diff);
      }
      const anyDown = diffs.some(d => d <= -15);
      const allUp = diffs.length > 0 && diffs.every(d => d >= 10);
      const trendNotes = [awayTrend.note, homeTrend.note].filter(Boolean);
      const detail = notes.join(" · ") + (trendNotes.length ? "  ·  model: " + trendNotes.join(", ") : "");
      return { label: "Pitcher trend (L10 vs SZN)", detail,
        lean: anyDown ? "yrfi" : allUp ? "nrfi" : "neutral" };
    })(),
    (() => {
      if (!awayVenue.note && !homeVenue.note) return null;
      const notes = [];
      if (awayVenue.note) notes.push(ctx.awayPP + ": " + awayVenue.note);
      if (homeVenue.note) notes.push(ctx.homePP + ": " + homeVenue.note);
      const fAvg = ((awayVenue.f - 1) + (homeVenue.f - 1)) / 2 + 1;
      return { label: "Pitcher venue split", detail: notes.join(" · "),
        lean: facLean(fAvg) };
    })(),
    (() => {
      const aBT = pitcherBT(ctx.awayPP);
      const hBT = pitcherBT(ctx.homePP);
      if (!aBT && !hBT) return null;
      const notes = [];
      // "proj", not "clean": PITCHER_BT carries a regressed posterior now, so
      // printing it as a plain clean rate would misreport what it is.
      if (aBT) notes.push(ctx.awayPP + ": " + aBT.clean.toFixed(0) + "% proj (" + aBT.n + "gs, " + aBT.tier + ")");
      if (hBT) notes.push(ctx.homePP + ": " + hBT.clean.toFixed(0) + "% proj (" + hBT.n + "gs, " + hBT.tier + ")");
      // A starter with no row is an ordinary starter, not a missing one — the
      // table deliberately omits the middle half of the league. Averaging only
      // the arm that IS listed would let one elite starter carry the pair and
      // vote NRFI on a matchup whose other half is unremarkable.
      const avgClean = ((aBT ? aBT.clean : PBT_LG) + (hBT ? hBT.clean : PBT_LG)) / 2;
      // These cutoffs are the table's own quartiles (see PITCHER_BT's header),
      // not round numbers. The previous 68/33 pair was written for the old raw
      // rates and did not survive contact with the real distribution: 66% of
      // starters clear 68%, while under 2% are ever under 33%, so this check
      // voted NRFI on two thirds of the board and could essentially never vote
      // YRFI at all. A check that only votes one way is not a check.
      return { label: "Backtest profile", detail: notes.join(" · "),
        lean: avgClean >= PBT_NRFI ? "nrfi" : avgClean <= PBT_YRFI ? "yrfi" : "neutral" };
    })(),
  ].filter(Boolean);
  const call = pNRFI >= 0.5 ? "nrfi" : "yrfi";
  const nonNeutral = checks.filter((c) => c.lean !== "neutral");
  // Consensus is counted per family, not per row. Twelve of these checks read
  // the same starter from different angles (season form, L3 K9, L10 trend, last
  // start, venue split, rest...), so one underlying fact — "this guy has been
  // scuffling" — used to cast five separate ballots and drag frac under 0.5,
  // tripping the "signals split" downgrade on games where nothing was actually
  // in conflict. Each family now casts one vote: its own internal majority, or
  // no vote at all when it is evenly split.
  const famVotes = new Map();
  for (const c of nonNeutral) {
    const f = checkFamily(c.label);
    if (!famVotes.has(f)) famVotes.set(f, { nrfi: 0, yrfi: 0 });
    famVotes.get(f)[c.lean]++;
  }
  let agree = 0, famTotal = 0;
  for (const v of famVotes.values()) {
    if (v.nrfi === v.yrfi) continue;          // family internally split — abstains
    famTotal++;
    if ((v.nrfi > v.yrfi ? "nrfi" : "yrfi") === call) agree++;
  }
  const pitProfiles = {
    // apps/seasonIp are the whole-season workload, relief included, so the thin
    // gate can tell a reliever apart from a genuine unknown (see nrfiThinArm).
    away: { name: ctx.awayPP, pid: ctx.awayPPId, hand: ctx.awayMeta && ctx.awayMeta.hand,
      apps: (ctx.awayMeta && ctx.awayMeta.g) || 0, seasonIp: (ctx.awayMeta && ctx.awayMeta.ip) || 0,
      ...pitcherI01Profile(ctx.awayPit, ctx.awayMeta && ctx.awayMeta.seasonEra, ctx.awayRolling, ctx.awayPeri) },
    home: { name: ctx.homePP, pid: ctx.homePPId, hand: ctx.homeMeta && ctx.homeMeta.hand,
      apps: (ctx.homeMeta && ctx.homeMeta.g) || 0, seasonIp: (ctx.homeMeta && ctx.homeMeta.ip) || 0,
      ...pitcherI01Profile(ctx.homePit, ctx.homeMeta && ctx.homeMeta.seasonEra, ctx.homeRolling, ctx.homePeri) },
  };
  /* Every factor that moved the probability, as the SHIPPED number.
   *
   * Exists because "what separates his picks from ours" cannot be answered from
   * pNRFI alone. nrfi-tout-profile.js got as far as it could on the four things
   * the cache recorded (p, consensus, confidence, thin arms), found his top-half
   * picks look identical to their band peers on all four while beating them by
   * 17.3 pts, and ended by prescribing exactly this: a re-score that records the
   * INPUTS, so the question becomes "does any factor separate them" instead of
   * "does any summary of the factors".
   *
   * Reported from inside the evaluator rather than recomputed by the harness,
   * and that is the whole point. A harness CAN call pitchSkillFactor and
   * openerFactor itself — they come out of the same slice bundle — but it would
   * have to re-supply the arguments, and openerFactor alone takes four of them
   * off two different context objects. That wiring is a second copy, it drifts
   * silently, and a factor audit reading a stale copy would attribute the
   * model's behaviour to numbers the model never used. These are the values the
   * lambda and the sim were actually built from.
   *
   * `.f` for the factor objects and `.factor` for the three that predate that
   * convention (lineup, travel, wx) — read off the same expressions that feed
   * offMult/pitMult/env directly above, so a shape change breaks both together
   * rather than leaving this quietly undefined.
   */
  const factors = {
    awayOffBase, homeOffBase, awayPitBase, homePitBase,
    awaySkill: awaySkill.f, homeSkill: homeSkill.f,
    awayOpen: awayOpen.f, homeOpen: homeOpen.f,
    awayOpenG: awayOpenG.f, homeOpenG: homeOpenG.f,
    awayLoad: awayLoad.f, homeLoad: homeLoad.f,
    awayTrend: awayTrend.f, homeTrend: homeTrend.f,
    awayVenue: awayVenue.f, homeVenue: homeVenue.f,
    awayOffTrend: awayOffTrend.f, homeOffTrend: homeOffTrend.f,
    awayOffVenue: awayOffVenue.f, homeOffVenue: homeOffVenue.f,
    awayOffKRate: awayOffKRate.f, homeOffKRate: homeOffKRate.f,
    awayOffAdv: awayOffAdv.f, homeOffAdv: homeOffAdv.f,
    awayLineup: ctx.awayLineup.factor, homeLineup: ctx.homeLineup.factor,
    awayTravel: ctx.awayTravel.factor, homeTravel: ctx.homeTravel.factor,
    env,
    // The composed multipliers, so an audit can ask whether the gap is in one
    // term or in how they add up. These are the exact expressions applied to
    // the bases above, not a restatement of them.
    awayOffMult: offMult(ctx.awayLineup, ctx.awayTravel, awayOffTrend, awayOffAdv, awayOffVenue, awayOffKRate),
    homeOffMult: offMult(ctx.homeLineup, ctx.homeTravel, homeOffTrend, homeOffAdv, homeOffVenue, homeOffKRate),
    awayPitMult: pitMult(awaySkill, awayOpen, awayOpenG, awayLoad, awayTrend, awayVenue),
    homePitMult: pitMult(homeSkill, homeOpen, homeOpenG, homeLoad, homeTrend, homeVenue),
  };
  // A non-finite probability must never leave this function. Downstream,
  // `pFinal >= 0.5` is false for NaN, so the game would render as a confident-
  // looking "YRFI · Pass — too close" rather than as the missing data it is.
  // Report it instead: modelError is what the board and the record filter on.
  const modelError = !Number.isFinite(pNRFI) ? "model produced a non-finite probability" : null;
  return { pNRFI: modelError ? null : pNRFI, pNRFI_simProj, checks,
    aligned: { agree, total: famTotal, rows: nonNeutral.length },
    confidence: conf, method, pitProfiles, factors, modelError };
}
const rate2 = (o) => (o && o.rate != null ? o.rate.toFixed(2) : "—");
const awayPit0 = (o) => (o && o.rate != null ? o.rate.toFixed(2) + " R/1st" : "TBD");

// Which underlying fact a check is reading. Checks in the same family are
// different views of one thing, so they share a single consensus vote — see the
// famVotes block in the evaluator. Anything unmatched votes on its own.
const CHECK_FAMILIES = [
  [/^(Starting pitching|Pitcher skill|Opener \/ bullpen|Pitcher K9 trend|Clean opener|Pitcher season load|Last start momentum|Pitcher trend|Pitcher venue split|Backtest profile)/, "pitching"],
  [/^(1st-inning offense|Offense trend|Offense venue split|Team K%|Lineups)/, "offense"],
  [/^(Day game|Weather & park|Travel & rest)/, "environment"],
];
function checkFamily(label) {
  const s = String(label || "");
  for (const [re, fam] of CHECK_FAMILIES) if (re.test(s)) return fam;
  // An unmatched label would stand alone as its own family and cast a full vote
  // — the same weight as all 12 pitching checks. Park it in environment so a new
  // check can never quietly buy a quarter of the consensus by being unlisted.
  return "environment";
}

// League-average first-inning rates (derived from model constants + MLB averages).
const I01_LG = { rate: 0.52, whip: 1.28, k9: 8.4, bb9: 3.1, hr9: 1.10 };

// The leak: which inputs are actually dragging an arm's first-inning grade down.
// Takes the signed point contributions pitcherI01Profile built its score from and
// returns the worst offenders, worst first. Because these are the same numbers
// that produced the grade, the reason shown on the card cannot disagree with the
// badge it explains.
//
// The 1.5-point floor keeps out inputs that are merely a shade below average —
// a leak has to have actually cost the pitcher something.
//
// rate (R/1st) is held back as a last resort even though it is the single
// heaviest term at 25 points, because it is not a reason: the LEAKY/BLEEDS badge
// is computed from clean%, which is exp(-rate). Leading with it answers "why does
// he bleed early?" with "because he gives up first-inning runs." A randomised
// sweep found it winning nearly every ranking, drowning out the walks and the
// missing whiffs that are the actual mechanism. So mechanisms rank first, and
// rate is appended only when nothing else clears the floor — which is itself
// informative: it means the damage does not show up in his peripherals.
const NRFI_LEAK_MIN = 1.5;
function nrfiLeaks(terms) {
  const out = (terms || []).filter((t) => t.v <= -NRFI_LEAK_MIN)
    .map((t) => ({ key: t.key, why: t.why, detail: t.detail, cost: Math.round(t.v * 10) / 10 }))
    .sort((a, b) => a.cost - b.cost);
  const mech = out.filter((t) => t.key !== "rate");
  return mech.length ? mech : out;
}

// Composite first-inning pitcher grade: A+/A/B+/B/C/D/F with supporting stats.
// peri = Statcast data { fstrike, whiff, barrel, gb, k, bb } — improves grade accuracy.
function pitcherI01Profile(pit, seasonEra, rolling, peri) {
  if (!pit || !pit.sample) return { grade: "—", score: 50, cleanPct: null, summary: "no first-inning data", fstrike: null, whiff: null };
  const cl = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  // Every input to the grade is pushed here as a signed point contribution, and
  // the score is their sum off a 50 base. Building it as a list rather than a
  // running total is what lets nrfiLeak name the driver behind a LEAKY/BLEEDS
  // badge using the model's own arithmetic — a separate "why" heuristic would
  // eventually contradict the number it is supposed to explain.
  const terms = [];
  const term = (key, why, detail, v) => terms.push({ key, why, detail, v });
  if (pit.rate  != null) term("rate", "gives up runs in the 1st", pit.rate.toFixed(2) + " R/1st vs " + I01_LG.rate.toFixed(2) + " lg",
    cl((I01_LG.rate - pit.rate)   / I01_LG.rate,  -1,  1) * 25);
  if (pit.whip  != null) term("whip", "puts the leadoff traffic on", "WHIP " + pit.whip.toFixed(2) + " vs " + I01_LG.whip.toFixed(2) + " lg",
    cl((I01_LG.whip - pit.whip)   / I01_LG.whip,  -1,  1) * 15);
  if (pit.k9    != null) term("k9", "can't miss bats early", "K/9 " + pit.k9.toFixed(1) + " vs " + I01_LG.k9.toFixed(1) + " lg",
    cl((pit.k9   - I01_LG.k9)     / I01_LG.k9,    -1,  1) * 10);
  if (pit.bb9   != null) term("bb9", "hands out free passes", "BB/9 " + pit.bb9.toFixed(1) + " vs " + I01_LG.bb9.toFixed(1) + " lg",
    cl((I01_LG.bb9 - pit.bb9)     / I01_LG.bb9,   -1,  1) * 10);
  if (pit.hr9   != null) term("hr9", "leaves one over the plate", "HR/9 " + pit.hr9.toFixed(2) + " vs " + I01_LG.hr9.toFixed(2) + " lg",
    cl((I01_LG.hr9 - pit.hr9)     / I01_LG.hr9,  -0.5, 0.5) * 5);
  // Statcast: FPS% (get-ahead rate) and whiff% (swing-and-miss) add 15 pts total headroom.
  if (peri && peri.fstrike != null) term("fstrike", "falls behind hitters", "first-pitch strike " + peri.fstrike.toFixed(0) + "% vs 60% lg",
    cl((peri.fstrike - 60) / 60, -1, 1) * 8);
  if (peri && peri.whiff   != null) term("whiff", "gets hit — no swing-and-miss", "whiff " + peri.whiff.toFixed(0) + "% vs 24.5% lg",
    cl((peri.whiff - 24.5) / 24.5, -1, 1) * 7);
  // L30 rolling clean % (binary 0/1) adds 10 pts: recent hot/cold form vs season.
  // League avg clean ~67% (exp(-0.52) ≈ 0.59 → ~67% with regression toward 0.52).
  if (rolling && rolling.l30 && rolling.l30.pct != null && (rolling.l30.n || 0) >= 10) {
    term("form", "cold right now", "L30 clean " + Math.round(rolling.l30.pct) + "% over " + rolling.l30.n + " starts vs 60% par",
      cl((rolling.l30.pct - 60) / 40, -1, 1) * 10);
  }
  // L30 runs/start adds 5 pts: continuous signal (0.0 R/start vs 0.9 R/start, both
  // non-clean, are meaningfully different). Uses same rate scale as season rate.
  if (rolling && rolling.l30 && rolling.l30.runsPerStart != null && (rolling.l30.n || 0) >= 10) {
    term("damage", "the damage is recent", rolling.l30.runsPerStart.toFixed(2) + " R/1st over L30 vs " + I01_LG.rate.toFixed(2) + " lg",
      cl((I01_LG.rate - rolling.l30.runsPerStart) / I01_LG.rate, -1, 1) * 5);
  }
  let score = terms.reduce((s, t) => s + t.v, 50);
  score = cl(Math.round(score), 0, 100);
  // pit.sample never entered the score above, so a single clean start scored a
  // perfect 0.00 R/1st and 0.00 WHIP straight to A+. Cap the top of the scale
  // until the sample clears the same bar evalNRFI's `thin` check uses.
  const thinSample = (pit.sample || 0) < 6;
  if (thinSample) score = Math.min(score, 62);
  const grade = score >= 84 ? "A+" : score >= 74 ? "A" : score >= 63 ? "B+" : score >= 52 ? "B" : score >= 42 ? "C" : score >= 30 ? "D" : "F";
  const gradeColor = score >= 74 ? "var(--moss)" : score >= 52 ? "var(--amber)" : "var(--rose)";
  // Regress the rate before exponentiating — exp(-0) = 100% clean off one start.
  const cleanPct = Math.round(Math.exp(-nrfiRegress(pit.rate, pit.sample || 0, NRFI_PIT_REG)) * 100);
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
    leaks: nrfiLeaks(terms), k9: pit.k9 ?? null, bb9: pit.bb9 ?? null, whip: pit.whip ?? null,
    kbbPct: pit.kbbPct ?? null, bf: pit.bf ?? null,
    hr9: pit.hr9 ?? null, rate: pit.rate ?? null, sample: pit.sample,
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

// Verdict ladder cut-points, on the blended pMax. One definition — the tier
// badge, the verdict and the record accounting all read these, because they
// drifted apart last time they were written out as literals in four places.
//
// These are the values 39db1fd deliberately loosened to. When the literals were
// first hoisted into constants the numbers were taken from the ORIGINAL ce4cc85
// ladder (70/63/57) instead of the live one (63/55/52) — a "no behaviour change"
// refactor that silently raised the BET floor by ten points and dropped real
// picks to LEAN. Do not retune these without a backtest; a threshold move is a
// betting decision, not a cleanup.
//
// BET floor raised 55 -> 57 on 2026-08-15, by walk-forward test, not by sweep.
// scripts/nrfi-ladder-sweep.js liked a three-knob "65/57/53" best on all 1282
// cached games, but that is the maximum of seven candidates scored on the sample
// that chose them, which is biased upward by construction. scripts/
// nrfi-ladder-split.js re-ran it chronologically — choose on the early slates,
// score on later ones never seen — at cuts 0.5/0.6/0.7. Two things came out:
//
//   1. STRONG and LEAN earn nothing. "65/57/53" and "57 alone" played the
//      IDENTICAL bets in every test half (136/104/79, same rate, same units).
//      The whole effect was the BET floor, so only the BET floor moves here.
//   2. Read the DISJOINT band, not the nested ladder. Rates rising with the cut
//      is partly arithmetic — drop a pool's worst games and the rest must look
//      better. The honest question is whether the games this raise DROPS were
//      losers. They were: the 55-57 band went 52.7/52.6/50.9% across the three
//      test halves against a 54.3% break-even at -119. But the 55-59 and 55-60
//      bands sit ABOVE break-even (+2.2 to +3.3pp), so cutting higher than 58
//      throws away profitable volume — which is exactly what the nested table
//      made look best, and why it could not be trusted.
//
// Expected effect: ~4.7 plays/day at 58.4% becomes ~2.7/day at 67.3%. Volume is
// roughly halved on purpose. The caveats, stated because they are load-bearing:
// one season, and the three test halves are nested inside each other, so this is
// about one measurement (z~1.1), not three independent ones.
const NRFI_STRONG_MIN = 63, NRFI_BET_MIN = 57, NRFI_LEAN_MIN = 52;
// The badge is a heat scale, not a verdict, so it carries one extra mid-band cut
// that has no counterpart on the ladder.
const NRFI_TIER_STRONG = 57;

// Is this arm an unknown quantity? The first-inning profile is built from starts
// only (see the gamesStarted filter in pitcherRollingNRFI), so a reliever reads
// as thin no matter how much he has actually pitched. An opener with a full
// season of relief work is not unknown: the model already prices him off his
// complete season line via paRates, and 25+ innings across 15+ appearances is a
// real book on how he handles a fresh inning. Penalising that identically to a
// September callup with four innings discards the workload we do have.
//
// This is not a free pass. A reliever enters against a random slot in the order
// while a first inning is always the top of it, and the displayed clean% is
// still built on the two starts — so the percentage stays untrusted. All this
// decides is whether the verdict takes a rung penalty for missing data.
const NRFI_THIN_STARTS = 5, NRFI_RELIEF_APPS = 15, NRFI_RELIEF_IP = 25;
function nrfiThinArm(p) {
  if (!p) return true;
  if ((p.sample || 0) >= NRFI_THIN_STARTS) return false;
  return !((p.apps || 0) >= NRFI_RELIEF_APPS && (p.seasonIp || 0) >= NRFI_RELIEF_IP);
}
// Start-thin but carrying enough relief work to clear the gate — worth saying out
// loud on the card, because the card also shows a clean% built on a tiny sample.
function nrfiReliefBacked(p) {
  return !!p && (p.sample || 0) < NRFI_THIN_STARTS && !nrfiThinArm(p);
}

function nrfiTier(pMax) {
  return pMax >= NRFI_STRONG_MIN ? { t: "STRONGEST", cls: "t-strongest", c: "var(--moss)" }
    : pMax >= NRFI_TIER_STRONG ? { t: "STRONG", cls: "t-strong", c: "var(--moss)" }
    : pMax >= NRFI_LEAN_MIN ? { t: "LEAN", cls: "t-lean", c: "var(--amber)" }
    : { t: "TOSS-UP", cls: "", c: "var(--dim)" };
}

// Backtest v5: 4,015 games (2025 full season + 2026 Apr 1 – Aug 13).
// AUC-ROC: 0.6188. Brier skill score: +4.6% over naive baseline.
// 2025 bias: +0.0pp (perfect). 2026 bias: +2.1pp (model slightly conservative).
// Combined: model under-predicts by ~1pp → keep c=0.050 logit shift.
// Win rates: pMax≥63 = 67.4% (479 bets); pMax≥70 = 75.9% (79 bets).
// Live calibration takes over after 25 graded picks.
//
// WITHDRAWN 2026-08-15: a Platt seed (slope 1.243, c −0.7396, n 1763) briefly
// replaced this. It was fit on the SIMPLIFIED λ-model in the backtest route —
// which documents its own data leakage — and then applied to the much richer
// live evaluator, so it shrank a model it had never measured. Combined with the
// 0.5 directional floor it silenced every game under 64.5% raw: pcal pinned to
// exactly 50.0, edgeRaw went negative, and the value gate's `edge < 1.5 → PASS`
// blanked the board — LEANs included, since that gate outranks the ladder.
// A refit must run the real nrfiEvaluate over history before it ships again.
// REFIT 2026-08-15: c 0.050 -> -0.073, n 4015 -> 558.
//
// The old seed's real problem was not its value, it was that nothing could
// check it. scripts/desk-nrfi-backtest.js had been throwing ReferenceError on
// every single game — nine factor helpers were added to nrfiEvaluate without
// matching slices, and mapLimit's bare `catch {}` turned each throw into a null
// row, so the harness printed "No samples." and read as an empty schedule. The
// note above demanded "a refit must run the real nrfiEvaluate over history
// before it ships again", and no refit could, because the instrument was dead.
//
// It runs now (34 slices, and it refuses to report when >20% of games fail).
// Over 558 games the blended evaluator predicts 53.6% against an actual 51.8%,
// i.e. it leans NRFI by ~1.8pp, so the shift is negative. The old +0.050 pushed
// in the SAME direction as the bias and made it worse.
//
// n=558 is what was actually measured, not the inherited 4015. It matters: n is
// the weight this prior carries against live calibration (lcW = n_live /
// (n_live + n_seed)), so the honest smaller number lets graded picks take over
// in a season rather than never.
//
// REFIT AGAIN 2026-08-16: c -0.073 -> -0.048, same 558 games. Both caveats the
// -0.073 note left open are now closed, and each one moved the number:
//
//   1. LEAKAGE. -0.073 was fit on predictions built from season-to-date pitcher
//      splits and team offence — inputs containing the very games being scored.
//      Both are now rewound to the scored date. Over the same 558 games that
//      leak was 47% of the model's apparent skill (Brier .2383 -> .2436 against
//      a .2495 base rate), so what this seed corrects are different predictions
//      than before, with a different bias.
//   2. THE SHORTCUT. -0.073 was lg(0.518) - lg(0.536), a difference of logits
//      of MEANS. c is applied per game, in logit space, so that equals the right
//      answer only if logit were linear. It is not, and the shortcut always
//      overshoots toward 50%. desk-nrfi-backtest.js now Newton-solves for the c
//      that lands the calibrated mean on the observed rate — the same solver
//      nrfiCalibration uses for liveC. Until now the two halves of one
//      calibration were derived differently, so the seed a game inherited on day
//      one disagreed with what the live fit would give it on day two with no
//      model change in between. That discontinuity is gone.
//
// AND A SLOPE CHECK, the question this seed could not previously answer. An
// intercept-only calibration moves every prediction the same distance in logit
// space, so it fixes the LEVEL and nothing else; if the model were also
// over-confident — 65% on games that go 58% — no value of c would repair it,
// and games would cross these absolute ladder thresholds on spread they had not
// earned. Fitting the full two-parameter Platt map over the same 558 games
// gives a = 1.423 +/- 0.419, i.e. +1.01 SE from 1, buying 0.0004 of Brier. The
// slope is inside noise of 1 and if anything leans UNDER-confident. So the
// shift is the right tool, and a second parameter would be fitting this sample
// rather than a defect. The harness prints this on every run.
//
//   3. THE STARTER'S SEASON LINE. -0.048 was fit while pitMeta still pulled
//      seasonEra/ip/allow whole-season, so the starter's first inning was
//      point-in-time and his overall line was not. Those are now summed out of
//      the game log up to the scored date, and the pitcher allow-rates are
//      regressed with NRFI_PA_REG_PIT as the app does (the backtest had been
//      passing no regression at all, scoring a sharper model than ships). Over
//      the same 558 games that cost another 0.8pp of pick-side accuracy and
//      1.0 of AUC — Brier .2436 -> .2449 — and moved the fitted shift from
//      -0.048 to -0.063, which is this value.
//
// STILL CAVEATED: one 45-day window, and top-of-order OBP, batter-vs-pitcher
// h2h, Statcast and teamOff's platoon OPS are all still whole-season pulls.
// Re-run before trusting this into a new season.
const NRFI_CALIB_SEED = { c: -0.063, n: 558, active: true, source: "backtest-v8-pitmeta" };

// Pitcher backtest rankings — GENERATED, do not hand-edit.
//   node scripts/nrfi-pitcherbt-rebuild.js && node scripts/nrfi-pitcherbt-emit.js
// Source: 4274 games across 2025 + 2026, arms with >=10 starts.
// Built 2026-08-15. League clean-1st rate 70.5%.
//
// clean = POSTERIOR clean-1st %, i.e. the arm's record regressed to league mean
// by n/(n+k) with k=88 starts. It is NOT his raw rate. Raw rates here span
// 33%-100%, but a beta-binomial fit puts the true spread in
// first-inning skill at only 4.8pp, so nearly all of that raw range is the
// binomial noise of a ~10-30 start sample. Ranking on it would be ranking on luck.
//
// tier is therefore RELATIVE, not absolute: elite = top decile of the posterior
// (>=74.1%), sharp = top quartile (>=72.7%), leaky = bottom quartile (<=69.4%),
// danger = bottom decile (<=67.7%). The middle half is omitted: an average arm
// says nothing about a first inning, and a row that said so would still vote.
// n = starts evaluated. Tiers: elite 26, sharp 36, leaky 38, danger 25.
const PITCHER_BT = (() => {
  const t = {};
  // name|posterior clean %|starts|tier
  const ROWS = [
    "Michael Wacha|76.6|55|elite",
    "Casey Mize|76.5|46|elite",
    "Paul Skenes|76.2|57|elite",
    "Trevor Rogers|76.2|40|elite",
    "Jesús Luzardo|76.0|56|elite",
    "Cristopher Sánchez|75.5|57|elite",
    "Keider Montero|75.4|32|elite",
    "Chase Burns|75.2|31|elite",
    "Ranger Suarez|75.2|47|elite",
    "Jack Flaherty|75.0|50|elite",
    "Jake Bennett|75.0|14|elite",
    "Zack Wheeler|74.6|44|elite",
    "Michael King|74.6|40|elite",
    "Shohei Ohtani|74.6|28|elite",
    "Walbert Ureña|74.5|20|elite",
    "Logan Henderson|74.5|16|elite",
    "Hunter Brown|74.4|43|elite",
    "Grant Holmes|74.4|43|elite",
    "Carmen Mlodzinski|74.3|23|elite",
    "Drew Rasmussen|74.3|54|elite",
    "Jason Alexander|74.3|15|elite",
    "Andrew Alvarez|74.3|15|elite",
    "Chris Sale|74.2|42|elite",
    "Ryne Nelson|74.2|38|elite",
    "Tarik Skubal|74.1|49|elite",
    "Nick Martinez|74.1|49|elite",
    "JP Sears|74.0|33|sharp",
    "Jacob Lopez|74.0|33|sharp",
    "Kyle Bradish|73.9|29|sharp",
    "Javier Assad|73.8|17|sharp",
    "Robbie Ray|73.8|55|sharp",
    "Simeon Woods Richardson|73.7|32|sharp",
    "Braxton Ashcraft|73.7|32|sharp",
    "Kyle Leahy|73.7|24|sharp",
    "Shane McClanahan|73.6|20|sharp",
    "Parker Messick|73.5|31|sharp",
    "Landen Roupp|73.5|46|sharp",
    "Mick Abel|73.5|12|sharp",
    "Carlos Rodón|73.5|42|sharp",
    "Freddy Peralta|73.4|57|sharp",
    "Patrick Corbin|73.3|45|sharp",
    "Logan Webb|73.3|56|sharp",
    "Will Warren|73.3|56|sharp",
    "Corbin Burnes|73.2|11|sharp",
    "Michael Soroka|73.1|33|sharp",
    "Janson Junk|73.1|33|sharp",
    "Nathan Eovaldi|73.1|44|sharp",
    "Slade Cecconi|73.1|44|sharp",
    "José Soriano|73.1|55|sharp",
    "Kris Bubic|73.1|29|sharp",
    "Chad Patrick|73.1|29|sharp",
    "Stephen Kolek|73.1|29|sharp",
    "Jameson Taillon|73.0|40|sharp",
    "Bowden Francis|73.0|14|sharp",
    "Shane Drohan|73.0|14|sharp",
    "Luis Castillo|73.0|51|sharp",
    "Tyler Glasnow|73.0|25|sharp",
    "Bryce Miller|72.9|32|sharp",
    "Shane Smith|72.9|32|sharp",
    "Ronel Blanco|72.8|13|sharp",
    "Foster Griffin|72.8|24|sharp",
    "Noah Cameron|72.8|46|sharp",
    "Zach Eflin|69.4|15|leaky",
    "Colton Gordon|69.4|15|leaky",
    "Jack Perkins|69.4|15|leaky",
    "Luis Severino|69.4|41|leaky",
    "Eury Pérez|69.4|41|leaky",
    "Rhett Lowder|69.3|18|leaky",
    "Eric Lauer|69.3|31|leaky",
    "Kevin Gausman|69.3|57|leaky",
    "Justin Wrobleski|69.2|21|leaky",
    "Chase Dollander|69.2|24|leaky",
    "Carson Whisenhunt|69.2|11|leaky",
    "Luis Morales|69.2|11|leaky",
    "Yusei Kikuchi|69.1|40|leaky",
    "Pablo López|69.1|14|leaky",
    "Noah Schultz|69.1|14|leaky",
    "Aaron Civale|69.0|33|leaky",
    "Shota Imanaga|69.0|49|leaky",
    "Brayan Bello|68.9|36|leaky",
    "Andrew Heaney|68.9|23|leaky",
    "Framber Valdez|68.9|55|leaky",
    "Steven Matz|68.8|13|leaky",
    "Connor Prielipp|68.7|16|leaky",
    "Jackson Jobe|68.5|12|leaky",
    "Austin Gomber|68.5|12|leaky",
    "Yu Darvish|68.4|15|leaky",
    "Lance McCullers Jr.|68.3|21|leaky",
    "Connelly Early|68.3|21|leaky",
    "Mitchell Parker|68.2|30|leaky",
    "MacKenzie Gore|68.2|55|leaky",
    "Jack Kochanowicz|68.1|36|leaky",
    "Jonathan Cannon|68.1|17|leaky",
    "Kai-Wei Teng|68.1|17|leaky",
    "Bailey Falter|68.0|26|leaky",
    "Merrill Kelly|67.9|54|leaky",
    "Dean Kremer|67.8|38|leaky",
    "Jordan Hicks|67.8|10|leaky",
    "Carson Palmquist|67.8|13|leaky",
    "Eduardo Rodriguez|67.7|53|leaky",
    "Clayton Kershaw|67.7|22|danger",
    "Logan Gilbert|67.5|49|danger",
    "Bradley Blalock|67.5|12|danger",
    "Brady Singer|67.5|55|danger",
    "Germán Márquez|67.3|36|danger",
    "Sean Burke|67.3|42|danger",
    "Miles Mikolas|67.3|42|danger",
    "Tanner Gordon|67.1|20|danger",
    "Jake Irvin|67.0|47|danger",
    "Jacob deGrom|67.0|53|danger",
    "Chris Paddack|66.8|37|danger",
    "Adrian Houser|66.5|36|danger",
    "Reynaldo López|66.5|12|danger",
    "Tyler Anderson|66.2|26|danger",
    "Antonio Senzatela|66.2|23|danger",
    "Zac Gallen|66.0|52|danger",
    "Jeffrey Springs|66.0|52|danger",
    "Taijuan Walker|65.9|25|danger",
    "Kyle Freeland|65.8|54|danger",
    "Taj Bradley|65.8|51|danger",
    "Max Scherzer|65.6|27|danger",
    "Kumar Rocker|65.4|35|danger",
    "Zebby Matthews|65.4|32|danger",
    "Erick Fedde|64.9|36|danger",
    "Tomoyuki Sugano|64.4|51|danger",
  ];
  for (const row of ROWS) {
    const f = row.split("|");
    const rec = { clean: +f[1], n: +f[2], tier: f[3] };
    t[f[0].toLowerCase()] = rec;
    // Box scores and the schedule feed disagree about accents on the same
    // pitcher, so register a stripped alias rather than duplicating rows by hand
    // (the old table carried "Ranger Suárez" and "Ranger Suarez" as two entries,
    // which is a maintenance trap: they could drift apart).
    const plain = f[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (plain !== f[0].toLowerCase()) t[plain] = rec;
  }
  return t;
})();
// League mean clean-1st. A starter with no row is not an unknown — he is an
// ordinary starter, and the "Backtest profile" check averages him in as one
// rather than letting his partner's tier speak for the pair alone.
const PBT_LG = 70.5;
// Concentration of the fitted prior, in starts: an arm's estimate is his record
// weighted n/(n+k) against PBT_LG. k=88 is large because first-inning skill is
// a weak, slow-moving signal — a 20-start sample is under a fifth reliable.
const PBT_K = 87.6;
// Tier cutoffs on the regressed scale, for arms with no row in the table.
const PBT_ELITE = 74.1, PBT_SHARP = 72.7, PBT_LEAKY = 69.4, PBT_DANGER = 67.7;
// Upper and lower quartiles of the two-starter average, enumerated over every
// pair of the 247 qualified arms. Not round numbers, and not the single-arm
// quartiles: averaging two draws narrows the distribution, so single-arm cuts
// would fire on far fewer than a quarter of matchups.
const PBT_NRFI = 71.9, PBT_YRFI = 69.7;
const PBT_GAMES = 4274, PBT_SEASONS = "2025 + 2026";
// Regress any observed clean-1st rate onto the same scale the table uses, so a
// live estimate and a table row can be compared or tiered by the same cutoffs.
function pbtPosterior(pct, n) {
  if (pct == null || !(n > 0)) return null;
  return (pct * n + PBT_LG * PBT_K) / (n + PBT_K);
}
// end PITCHER_BT block — nrfi-model-lib.js slices up to this line, so the
// backtest bundle gets the constants and not just the table.
function pitcherBT(name) {
  if (!name) return null;
  const k = name.toLowerCase();
  if (PITCHER_BT[k]) return PITCHER_BT[k];
  // Strip accents on the QUERY too, not just when building the table. The
  // mismatch runs both ways: box scores spell him "Ranger Suarez" and the
  // probables feed "Ranger Suárez". The table can only alias in one direction
  // (it cannot invent accents), so an accented lookup against a plain key would
  // miss and the arm would drop out of the check without a trace.
  return PITCHER_BT[k.normalize("NFD").replace(/[̀-ͯ]/g, "")] || null;
}

// Empirical calibration: once enough calls are graded, shift the model's
// probabilities (in logit space) so its average prediction matches the actual
// NRFI hit rate — i.e. make "70%" really mean 70%. Uses the RAW model pNRFI
// logged per pick vs whether the 1st was scoreless. Inactive under 25 games,
// and shrunk by sample size so it can't overcorrect early.
function nrfiCalibration(record) {
  // Exclude kalshi-import entries: their pNRFI is the market entry price, not model output.
  // Training on market prices would teach the calibration to correct for market bias, not model bias.
  const g = (record || []).filter((e) => e.pNRFI != null && e.firstInningRuns != null && e.source !== "kalshi-import" && e.strength !== "PASS" && !e.thinPass);
  const lg = (p) => Math.log(p / (1 - p));
  const ul = (x) => 1 / (1 + Math.exp(-x));
  const cp = (x) => nClamp(x, 0.05, 0.95);
  const actual = g.length ? g.filter((e) => e.firstInningRuns === 0).length / g.length : 0.5;
  /* Solve for the shift, rather than taking a difference of logits.
   *
   * This used to be lg(actual) - lg(meanPred), and that does not do what the
   * comment above it promises. c is applied per game, in logit space, to each
   * pNRFI; but the difference of logits of the MEANS only cancels if logit were
   * linear, and it is not. The result is a calibration that misses its own
   * target: on a realistic spread of desk picks (0.45-0.75) the shifted
   * predictions land ~0.27pp from the observed hit rate, and on a wide spread
   * (0.35-0.85) they miss by ~0.91pp — always overshooting toward the middle,
   * because logit is concave above 0.5 and convex below it.
   *
   * The quantity actually wanted is the c that makes the calibrated predictions
   * average to what really happened, i.e. solves
   *
   *   mean_i sigmoid(logit(p_i) + c) = actual
   *
   * which is also the maximum-likelihood intercept for a Platt fit with the
   * slope pinned at 1 — the moment condition and the likelihood agree here, so
   * one Newton solve gets both. The derivative of the mean with respect to c is
   * mean(q(1-q)), which is what makes this converge in a handful of steps. */
  const solveShift = (preds, target) => {
    let c = 0;
    for (let i = 0; i < 60; i++) {
      let m = 0, d = 0;
      for (const p of preds) { const q = ul(lg(p) + c); m += q; d += q * (1 - q); }
      m /= preds.length; d /= preds.length;
      // Every prediction saturated: no shift can move the mean, so stop rather
      // than divide by ~0 and return an infinity into the ladder.
      if (!(d > 1e-9)) break;
      const step = (target - m) / d;
      c += step;
      if (Math.abs(step) < 1e-10) break;
    }
    return Number.isFinite(c) ? c : 0;
  };
  const liveC = g.length ? solveShift(g.map((e) => cp(e.pNRFI)), cp(actual)) : 0;
  // Blend live correction with seed using sample-count weighting — smooth transition instead of hard cutover.
  return { liveC, n: g.length, active: true };
}
function applyCalibration(pNRFI, calib) {
  if (!calib || !calib.active) return pNRFI;
  // nrfiCalibration returns {liveC, n}, NOT {c} — its output is the live
  // component that the caller blends against NRFI_CALIB_SEED weighted by n.
  // Passing it here directly reads calib.c as undefined and returns NaN, which
  // nClamp propagates rather than catching, so a NaN probability would reach the
  // ladder and price a wager. Fail closed to the uncalibrated number instead.
  if (!Number.isFinite(calib.c)) return pNRFI;
  const lg = (p) => Math.log(p / (1 - p));
  const ul = (x) => 1 / (1 + Math.exp(-x));
  // c is a bias shift on P(NRFI) itself, not on directional confidence. Both the
  // seed and nrfiCalibration's liveC are fit against pNRFI, so applying either
  // one directionally (as the withdrawn Platt seed did) measures one thing and
  // corrects another.
  //
  // The two are no longer derived the same way, and the difference is not
  // cosmetic: liveC is now a Newton solve for the c that lands the mean on the
  // observed rate (see nrfiCalibration), while NRFI_CALIB_SEED is still the old
  // lg(actual) − lg(meanPred) shortcut, which overshoots toward 50% by ~0.2-0.3pp.
  // They are blended together by sample weight below, so the seed's error decays
  // as live picks accumulate rather than persisting. Refitting it needs the 558
  // per-game predictions, not their mean — see the SECOND CAVEAT on the seed.
  return nClamp(ul(lg(nClamp(pNRFI, 0.02, 0.98)) + calib.c), 0.02, 0.98);
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
  // Tier on directional conviction, not on P(NRFI). Tested against pModel the
  // ladder only ever fired for NRFI: a 70%-confident YRFI read arrives as
  // pModel=0.30, clears no tier, and gets the 0.35 floor — half the market pull
  // of an identical NRFI read. Nothing about a YRFI opinion deserves more
  // shrinkage. For pModel ≥ 0.5 this is unchanged.
  const conv = Math.max(pModel, 1 - pModel);
  const blend = conv >= 0.68 ? 0.65 : conv >= 0.62 ? 0.58 : conv >= 0.57 ? 0.45 : NRFI_BLEND;
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
  let strength = p >= NRFI_STRONG_MIN ? "STRONG" : p >= NRFI_BET_MIN ? "BET" : p >= NRFI_LEAN_MIN ? "LEAN" : "PASS";
  const notes = [];

  // 2) Consensus gate: a decisive number with split signals is fragile.
  const total = r.aligned ? r.aligned.total : 0;
  const agree = r.aligned ? r.aligned.agree : 0;
  // No family voted at all: that is absence of evidence, not agreement. This read
  // `total ? agree/total : 1`, so a game with zero signal scored frac 1.00 and
  // sailed through the STRONG gate's `frac >= 0.6` as if every check had lined
  // up behind the call. Seen live on a real slate. Score it as no confirmation.
  const frac = total ? agree / total : 0;
  if (total === 0 && strength !== "PASS") { strength = down(strength, 1); notes.push("no check confirms this"); }
  // Only three families exist, so `total >= 3` demanded a unanimous turnout before
  // a split could ever register — it was reachable on 3 of 15 live games. Judge
  // the split on whatever did vote, once at least two families have.
  else if (total >= 2 && frac < 0.5 && strength !== "PASS") { strength = down(strength, 1); notes.push("signals split"); }

  // 3) Confidence gate: don't fire a strong wager on missing data.
  const conf = r.confidence != null ? r.confidence : 1;
  const pp = r.pitProfiles;
  const awayThin = nrfiThinArm(pp && pp.away);
  const homeThin = nrfiThinArm(pp && pp.home);
  for (const [p, nm] of [[pp && pp.away, r.awayPP], [pp && pp.home, r.homePP]]) {
    if (nrfiReliefBacked(p)) notes.push(nm + " is a reliever/opener — few starts, but " +
      Math.round(p.seasonIp) + " IP over " + p.apps + " apps; clean% is small-sample");
  }
  if (conf < 0.35) { strength = "PASS"; notes.push("thin data"); }
  else if (conf < 0.55 && (strength === "STRONG" || strength === "BET")) { strength = "LEAN"; notes.push("limited data"); }
  // One thin starter: drop one level — the model is half-blind on pitching.
  // Both thin: drop to PASS and hide from the board entirely (thinPass flag).
  let thinPass = false;
  if (awayThin && homeThin) {
    if (strength !== "PASS") { strength = down(strength, 1); notes.push("both pitchers thin data"); }
    if (strength === "PASS") thinPass = true;
  } else if (awayThin || homeThin) {
    if (strength !== "PASS") { strength = down(strength, 1); notes.push((awayThin ? r.awayPP : r.homePP) + " thin data"); }
  }
  // STRONG demands both high confidence AND strong agreement.
  if (strength === "STRONG" && !(conf >= 0.7 && frac >= 0.6)) { strength = "BET"; notes.push("not full confidence"); }

  // 4) Value gate: a great matchup at an efficient/short price is NOT a wager.
  // The probability stays model-only; the market only decides if there's value.
  if (r.market) {
    // Gate on raw divergence (see the edge/edgeRaw note where market is built);
    // quote the anchored gap. Falls back to `edge` if a caller has no edgeRaw.
    const edge = r.market.edgeRaw != null ? r.market.edgeRaw : r.market.edge;
    const shown = r.market.edge;          // anchored gap, for display only
    const mktProb = r.market.marketSide;  // market's implied % on our side
    if (edge == null) { strength = "PASS"; notes.push("game under way — no pregame edge left"); }
    else if (edge < 1.5) { strength = "PASS"; notes.push("market efficient — no value"); }
    // Short juice is a sizing problem, not a disqualification. A 4.9pp edge at a
    // 65% price was a hard PASS while the same edge at 64% stayed STRONG — a 1pp
    // market tick erasing a bet. Keep the PASS where the edge is genuinely thin,
    // otherwise step down like every other gate on this ladder.
    else if (mktProb >= 65 && edge < 5) {
      if (edge < 2.5) { strength = "PASS"; notes.push("juice too short"); }
      else { strength = down(strength, mktProb >= 75 ? 2 : 1); notes.push("short juice — sized down"); }
    }
    else if ((strength === "STRONG" || strength === "BET") && edge < 2.5) { strength = down(strength, 1); notes.push("thin value"); }
    else if (edge >= 2.5) notes.push("value +" + (shown != null ? shown : edge).toFixed(1) + "% vs market (model " + edge.toFixed(1) + "pp off)");
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
  // `notes` is returned as well as joined into `blurb`. It is the only record of
  // WHY a rung was demoted, and until now the sole way to read it was to regex
  // it back out of a prose string built for display — so an analysis asking
  // "which gate removed this pick?" either parsed the blurb or, as
  // nrfi-gate-value.js first did, read a `notes` key that was not there and
  // concluded four of the five gates were inert. Return the structure next to
  // the sentence; the sentence stays exactly as it was.
  return { strength, side, isBet, label, color, blurb, confLbl, thinPass, notes };
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
// `dateOverride` is for offline calibration only — the app never passes it. It
// exists because the live evaluator could not be pointed at a finished slate,
// which is why NRFI_CALIB_SEED is still a fit of the SIMPLIFIED lambda-model in
// the backtest route rather than of the model that actually ships. Note that the
// pitcher and team feeds this pulls are season-to-date and are NOT rewound, so a
// historical scan sees stats that postdate the game: usable for measuring the
// model's mean LEVEL (which is all the seed corrects), not its per-game accuracy.
async function scanNrfi(onProgress, dateOverride) {
  const season = new Date().getUTCFullYear();
  const date = dateOverride || today();
  // No /api/desk/umpires call: the ABS challenge system retired the umpire
  // term (see the env multiplier in nrfiEvaluate). Dropping the request also
  // takes a per-scan round trip to a hand-populated Postgres table off the
  // path, so every board build is one fetch cheaper.
  const [sch, whiffRes] = await Promise.all([
    getJson("https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=" + date +
      "&hydrate=probablePitcher,linescore,team,lineups,weather,venue,officials"),
    fetch("/api/desk/savant").then((r) => r.json()).catch(() => null),
  ]);
  const periById = (whiffRes && whiffRes.byId) || {};
  const lg = (whiffRes && whiffRes.lg) || { k: 22, bb: 8, barrel: 7.5, gb: 44, whiff: 24.5, fstrike: 60 };
  const games = (sch.dates && sch.dates[0] && sch.dates[0].games) || [];
  let done = 0;
  const rows = await mapLimit(games, 4, async (g) => {
    const away = g.teams && g.teams.away, home = g.teams && g.teams.home;
    const awayPP = away && away.probablePitcher, homePP = home && home.probablePitcher;
    const lu = g.lineups || {};
    const [awayPit, homePit, awayMeta, homeMeta, awayRolling, homeRolling, awayOff, homeOff, awayTravel, homeTravel, awayOffRolling, homeOffRolling] =
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
        teamOffenseRolling(away && away.team && away.team.id, date, season),
        teamOffenseRolling(home && home.team && home.team.id, date, season),
      ]);
    // Lineups vs the opposing starter's hand (needs the hands resolved first).
    const awayPosted = (lu.awayPlayers || []).length >= 3;
    const homePosted = (lu.homePlayers || []).length >= 3;
    const [awayLineup, homeLineup, awayBestLineup, homeBestLineup] = await Promise.all([
      topOrderStrength(lu.awayPlayers, season, homeMeta && homeMeta.hand, homeMeta && homeMeta.id),
      topOrderStrength(lu.homePlayers, season, awayMeta && awayMeta.hand, awayMeta && awayMeta.id),
      awayPosted ? Promise.resolve(null) : teamBestLineup(away && away.team && away.team.id, season, homeMeta && homeMeta.hand, homeMeta && homeMeta.id),
      homePosted ? Promise.resolve(null) : teamBestLineup(home && home.team && home.team.id, season, awayMeta && awayMeta.hand, awayMeta && awayMeta.id),
    ]);
    const wx = weatherPark(g, home && home.team && home.team.abbreviation);
    const ctx = {
      awayName: away && away.team && away.team.name, homeName: home && home.team && home.team.name,
      awayPP: (awayPP && awayPP.fullName) || "TBD", homePP: (homePP && homePP.fullName) || "TBD",
      awayPPId: awayPP && awayPP.id, homePPId: homePP && homePP.id,
      awayOff, homeOff, awayPit, homePit, awayMeta, homeMeta,
      awayLineup, homeLineup, awayBestLineup, homeBestLineup, awayTravel, homeTravel, wx,
      awayRolling, homeRolling, awayOffRolling, homeOffRolling,
      awayPeri: awayPP ? periById[awayPP.id] : null,
      homePeri: homePP ? periById[homePP.id] : null,
      lg,
      startUtc: g.gameDate || null,
      // MLB publishes its own day/night designation on the schedule. Take it
      // rather than deriving one — see dayNightOf.
      dayNight: g.dayNight || null,
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
      pNRFI: ev.pNRFI, pNRFI_simProj: ev.pNRFI_simProj, pYRFI: 1 - ev.pNRFI, checks: ev.checks, aligned: ev.aligned, confidence: ev.confidence, method: ev.method, pitProfiles: ev.pitProfiles, parkEnv: ctx.wx,
      awayYrfiPct: yrfiPctFromLambda(awayOff && awayOff.rate),
      homeYrfiPct: yrfiPctFromLambda(homeOff && homeOff.rate),
      awayOffSample: awayOff ? awayOff.sample : null,
      homeOffSample: homeOff ? homeOff.sample : null,
      // priorRate is the baseline with the L10 taken back OUT (see trendBaseline).
      // The card used to draw its arrow off l10.rate - szn.rate, but szn contains
      // the L10, so the card was showing three fifths of the move while the model
      // acted on the whole of it — the Yankees read -12pp on the card and -20pp
      // in the verdict. One number, one baseline.
      awayOffL10: offL10Payload(awayOffRolling),
      homeOffL10: offL10Payload(homeOffRolling),
      hasPitchers: !!(awayPP && awayPP.id && homePP && homePP.id),
      // Presence of the four inputs is not enough — the model still has to have
      // produced a usable number from them.
      dataOk: !!(awayOff && homeOff && awayPit && homePit) && !ev.modelError && Number.isFinite(ev.pNRFI),
      modelError: ev.modelError || null,
      lineupPosted: (ctx.awayLineup.obp != null && ctx.homeLineup.obp != null),
      state, currentInning: ls.currentInning || 0,
      inning1runs: (inn1 && inn1.away && inn1.home && inn1.away.runs != null && inn1.home.runs != null) ? (inn1.away.runs + inn1.home.runs) : null,
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

function NrfiCalendar({ rec, bankroll, riskLevel }) {
  const [viewMonth, setViewMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [calView, setCalView] = useState("calendar");
  const [expandedDay, setExpandedDay] = useState(null);
  // Risk config for estimating bet size when contracts not logged
  const _RC = { ghost:{mult:0.10,max:0.02}, conservative:{mult:0.25,max:0.06}, moderate:{mult:0.50,max:0.12}, standard:{mult:0.75,max:0.18}, aggressive:{mult:1.00,max:0.25}, turbo:{mult:1.50,max:0.35}, xtreme:{mult:2.00,max:0.50}, degen:{mult:3.00,max:0.65}, yolo:{mult:5.00,max:0.80} };
  const _rc = _RC[riskLevel] || _RC.moderate;
  // Estimate dollar P&L — exact when contracts logged, Kelly estimate when bankroll set, flat 5% fallback
  const estPL = (e) => {
    if (!e.result || e.mktAtPick == null) return null;
    const price = Math.min(0.99, Math.max(0.01, e.mktAtPick / 100));
    if (e.contracts > 0) {
      return e.result === "won" ? e.contracts * (1 - price) : -e.contracts * price;
    }
    const br = (bankroll && bankroll > 0) ? bankroll : null;
    let betDollars;
    if (br && e.prob) {
      const p = e.prob / 100;
      const b = (1 - price) / price;
      const kelly = b > 0 ? Math.max(0, (p * b - (1 - p)) / b) : 0;
      betDollars = br * Math.min(kelly * _rc.mult, _rc.max);
    } else if (br) {
      betDollars = br * 0.05;
    } else {
      return null;
    }
    const qty = Math.max(1, Math.round(betDollars / price));
    return e.result === "won" ? qty * (1 - price) : -qty * price;
  };
  // Only show entries explicitly marked as bets
  const byDate = {};
  for (const e of rec || []) {
    if (!e.date || e.skipped || !e.isBet) continue;
    const d = String(e.date).replace(/-/g, "").slice(0, 8);
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(e);
  }
  const { y, m } = viewMonth;
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const monthLabel = new Date(y, m, 1).toLocaleString("default", { month: "long", year: "numeric" });
  const mStr = String(m + 1).padStart(2, "0");
  const todayFull = new Date();
  const todayKey = String(todayFull.getFullYear()) + String(todayFull.getMonth() + 1).padStart(2, "0") + String(todayFull.getDate()).padStart(2, "0");
  const dayKey = (d) => String(y) + mStr + String(d).padStart(2, "0");
  const dayPL = (entries) => { let pl = 0; for (const e of entries) { const v = estPL(e); if (v != null) pl += v; } return pl; };
  const hasPLData = (entries) => entries.some((e) => estPL(e) != null);
  let mWins = 0, mLosses = 0, mPL = 0, mHasPL = false;
  for (let d = 1; d <= daysInMonth; d++) {
    const settled = (byDate[dayKey(d)] || []).filter((e) => e.result === "won" || e.result === "lost");
    mWins += settled.filter((e) => e.result === "won").length;
    mLosses += settled.filter((e) => e.result === "lost").length;
    if (hasPLData(settled)) { mPL += dayPL(settled); mHasPL = true; }
  }
  const todayAll = byDate[todayKey] || [];
  const todaySettled = todayAll.filter((e) => e.result === "won" || e.result === "lost");
  const todayPending = todayAll.filter((e) => !e.result && !e.skipped);
  const todayWins = todaySettled.filter((e) => e.result === "won").length;
  const todayLosses = todaySettled.length - todayWins;
  const todayPL = dayPL(todaySettled);
  const todayHasPL = hasPLData(todaySettled);
  // Build grid: prev-month overflow + current month + next-month overflow to fill rows
  const prevMonthDays = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push({ d: prevMonthDays - firstDay + 1 + i, overflow: true, key: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ d, overflow: false, key: dayKey(d) });
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) cells.push({ d, overflow: true, key: null });
  const allSettled = Object.entries(byDate)
    .flatMap(([date, entries]) => entries.filter((e) => e.result === "won" || e.result === "lost").map((e) => ({ ...e, _date: date })))
    .sort((a, b) => b._date.localeCompare(a._date));
  const btnBase = { border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, borderRadius: 6, padding: "5px 11px" };
  return (
    <div style={{ marginTop: 4 }}>
      {/* Title + nav */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.12em", marginBottom: 6 }}>RECENT SETTLED BETS</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setViewMonth(({ y, m }) => m === 0 ? { y: y-1, m: 11 } : { y, m: m-1 })} style={{ ...btnBase, background: "rgba(255,255,255,0.07)", color: "var(--fg)", width: 32, padding: 0, textAlign: "center" }}>‹</button>
            <button onClick={() => setViewMonth(({ y, m }) => m === 11 ? { y: y+1, m: 0 } : { y, m: m+1 })} style={{ ...btnBase, background: "rgba(255,255,255,0.07)", color: "var(--fg)", width: 32, padding: 0, textAlign: "center" }}>›</button>
            <span style={{ fontWeight: 800, fontSize: 22, letterSpacing: "-0.01em" }}>{monthLabel}</span>
            {(mWins + mLosses) > 0 && <span style={{ fontSize: 12, color: mPL >= 0 ? "var(--moss)" : "var(--rose)", fontWeight: 700, marginLeft: 4 }}>{mHasPL ? (mPL >= 0 ? "+" : "−") + "$" + Math.abs(mPL).toFixed(2) + "  " : ""}<span style={{ color: "var(--dim)" }}>{mWins}-{mLosses}</span></span>}
          </div>
          <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(120,130,150,0.2)" }}>
            {[["calendar","Calendar"],["table","Table"]].map(([v,l]) => (
              <button key={v} onClick={() => setCalView(v)} style={{ ...btnBase, borderRadius: 0, background: calView === v ? "#f97316" : "transparent", color: calView === v ? "#000" : "var(--dim)", padding: "6px 16px" }}>{l}</button>
            ))}
          </div>
        </div>
      </div>
      {calView === "calendar" ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 3 }}>
            {["SUN","MON","TUE","WED","THU","FRI","SAT"].map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: "rgba(150,160,180,0.7)", letterSpacing: "0.06em", padding: "3px 0" }}>{d}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
            {cells.map((cell, i) => {
              const { d, overflow, key } = cell;
              if (overflow) return (
                <div key={"ov"+i} style={{ minHeight: 90, background: "rgba(255,255,255,0.018)", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.2)" }}>{d}</div>
                </div>
              );
              const all = byDate[key] || [];
              const settled = all.filter((e) => e.result === "won" || e.result === "lost");
              const wins = settled.filter((e) => e.result === "won").length;
              const losses = settled.length - wins;
              const pl = dayPL(settled);
              const hasPL = hasPLData(settled);
              const pending = all.filter((e) => !e.result && !e.skipped).length;
              const isToday = key === todayKey;
              const hasData = settled.length > 0;
              const bg = !hasData
                ? (pending > 0 ? "rgba(230,160,0,0.07)" : "rgba(255,255,255,0.03)")
                : (wins > losses ? "rgba(22,78,47,0.75)" : losses > wins ? "rgba(76,20,30,0.7)" : "rgba(40,44,64,0.7)");
              const border = isToday ? "1.5px solid rgba(80,220,110,0.7)" : hasData ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.05)";
              const isExpanded = expandedDay === key;
              const clickable = all.length > 0;
              return (
                <div key={key} onClick={clickable ? () => setExpandedDay(isExpanded ? null : key) : undefined} style={{ minHeight: 90, background: isExpanded ? (bg === "rgba(255,255,255,0.03)" ? "rgba(255,255,255,0.07)" : bg) : bg, borderRadius: 10, border: isExpanded ? "1.5px solid rgba(249,115,22,0.7)" : border, padding: "10px 12px", display: "flex", flexDirection: "column", cursor: clickable ? "pointer" : "default" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: isToday ? "#4ade80" : hasData ? "#fff" : "rgba(255,255,255,0.55)", marginBottom: 4 }}>{d}</div>
                  {hasData && (
                    <>
                      {hasPL && (
                        <div style={{ fontSize: 14, fontWeight: 800, color: pl >= 0 ? "#4ade80" : "#f87171", lineHeight: 1.15, marginBottom: 3 }}>
                          {pl >= 0 ? "+" : "−"}${Math.abs(pl).toFixed(2)}
                        </div>
                      )}
                      <div style={{ fontSize: 13, fontWeight: 600, color: hasPL ? "rgba(255,255,255,0.65)" : wins > losses ? "#4ade80" : losses > wins ? "#f87171" : "rgba(255,255,255,0.65)", marginTop: "auto" }}>{wins}-{losses}</div>
                    </>
                  )}
                  {!hasData && pending > 0 && <div style={{ fontSize: 10, color: "var(--amber)", fontWeight: 700, marginTop: 4 }}>{pending} live</div>}
                  {clickable && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: "auto", textAlign: "right" }}>{isExpanded ? "▲" : "▼"}</div>}
                </div>
              );
            })}
          </div>
          {expandedDay && (() => {
            const dayEntries = byDate[expandedDay] || [];
            if (!dayEntries.length) return null;
            const pending = dayEntries.filter((e) => !e.result && !e.skipped);
            const settled = dayEntries.filter((e) => e.result === "won" || e.result === "lost");
            return (
              <div style={{ marginTop: 8, borderRadius: 10, border: "1px solid rgba(249,115,22,0.3)", background: "rgba(20,24,36,0.97)", overflow: "hidden" }}>
                <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#f97316", letterSpacing: "0.1em" }}>
                    {expandedDay.slice(4,6)}/{expandedDay.slice(6,8)}/{expandedDay.slice(2,4)} — {dayEntries.length} BET{dayEntries.length !== 1 ? "S" : ""}
                  </span>
                  <button onClick={() => setExpandedDay(null)} style={{ border: "none", background: "none", color: "var(--dim)", cursor: "pointer", fontSize: 16, padding: 0, lineHeight: 1 }}>✕</button>
                </div>
                {[...pending, ...settled].map((e, i) => {
                  const betPL = estPL(e);
                  const live = !e.result;
                  const won = e.result === "won";
                  const resultColor = live ? "var(--amber)" : won ? "#4ade80" : "#f87171";
                  const resultLabel = live ? (e.method === "sim" ? "LIVE (SIM)" : "LIVE") : (won ? "WON" : "LOST");
                  return (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 52px 56px 80px", padding: "10px 14px", borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.04)", fontSize: 12, alignItems: "center", background: i%2===0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0", marginBottom: 2 }}>{e.game || "—"}</div>
                        <div style={{ fontSize: 10, color: "var(--dim)" }}>{e.awayPP || "?"} vs {e.homePP || "?"}{e.method === "sim" ? " · SIM" : ""}</div>
                      </div>
                      <div style={{ fontWeight: 700, color: e.call === "NRFI" ? "#60a5fa" : "#f59e0b", fontSize: 13 }}>
                        {e.call || "—"}
                        <div style={{ fontSize: 10, color: "var(--dim)", fontWeight: 400 }}>{e.prob != null ? e.prob + "%" : "—"}</div>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--dim)" }}>
                        {e.mktAtPick != null ? e.mktAtPick + "¢" : "—"}
                        {e.strength === "STRONG" && <div style={{ fontSize: 9, color: "#f59e0b", fontWeight: 700 }}>STRONG</div>}
                      </div>
                      <div style={{ fontWeight: 700, color: resultColor, textAlign: "right", fontSize: 13 }}>
                        {resultLabel}
                        {betPL != null && <div style={{ fontSize: 11, color: betPL >= 0 ? "#4ade80" : "#f87171", fontWeight: 600 }}>{betPL >= 0 ? "+" : "−"}${Math.abs(betPL).toFixed(2)}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </>
      ) : (
        <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
          {allSettled.length === 0 ? (
            <div style={{ padding: "24px", color: "var(--dim)", fontSize: 13, textAlign: "center" }}>No settled bets yet.</div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "72px 1fr 60px 70px 90px", padding: "8px 14px", background: "rgba(255,255,255,0.04)", fontSize: 10, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.08em" }}>
                {["DATE","GAME","CALL","STAKE","RESULT"].map((h) => <div key={h}>{h}</div>)}
              </div>
              {allSettled.slice(0, 60).map((e, i) => {
                const d = e._date;
                const label = d ? d.slice(4,6)+"/"+d.slice(6,8)+"/"+d.slice(2,4) : "—";
                const price = e.mktAtPick != null ? Math.min(0.99, Math.max(0.01, e.mktAtPick/100)) : null;
                const betPL = estPL(e);
                const stake = (betPL != null && price != null) ? (e.contracts > 0 ? e.contracts*price : Math.abs(betPL)/(1-price)*price) : null;
                return (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "72px 1fr 60px 70px 90px", padding: "10px 14px", background: i%2===0 ? "rgba(255,255,255,0.02)" : "transparent", borderTop: "1px solid rgba(255,255,255,0.04)", fontSize: 13, alignItems: "center" }}>
                    <div style={{ color: "var(--dim)", fontSize: 12 }}>{label}</div>
                    <div style={{ fontWeight: 600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.game || "—"}</div>
                    <div><span style={{ padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 800, background: e.call==="NRFI" ? "rgba(80,160,80,0.15)" : "rgba(220,60,60,0.15)", color: e.call==="NRFI" ? "#4ade80" : "#f87171", border: "1px solid "+(e.call==="NRFI" ? "rgba(80,160,80,0.3)" : "rgba(220,60,60,0.3)") }}>{e.call||"—"}</span></div>
                    <div style={{ color: "var(--dim)", fontSize: 12 }}>{stake!=null ? "$"+stake.toFixed(0) : "—"}</div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: e.result==="won" ? "#4ade80" : "#f87171" }}>
                      {betPL!=null ? (e.result==="won" ? "+" : "−")+"$"+Math.abs(betPL).toFixed(2) : (e.result==="won" ? "W" : "L")}
                    </div>
                  </div>
                );
              })}
              {allSettled.length > 60 && <div style={{ padding: "9px 14px", fontSize: 12, color: "var(--dim)", textAlign: "center", background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>Showing 60 of {allSettled.length}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Dual Score board header ────────────────────────────────────────────────
 * The card layout NRFIKINGKY runs on his own board (a Replit app, screenshotted
 * 2026-08-16): two starter columns, a scrollable strip of first-inning clean%
 * windows, and one bottom bar carrying the score against the market price.
 *
 * "Dual Score" is ONE number — the dual is that it fuses the TWO starters. The
 * DUAL in this layout is that TWO different numbers do two different jobs, and
 * a third screenshot is what established it. Reading only the first two cards,
 * the badge looks like the edge (DS 64.7 vs BE 59.5 -> GREEN at +5.2; DS 59.1 vs
 * BE 57.6 -> YELLOW at +1.5). The third kills that: DS 60.0 vs BE 51.5% is an
 * edge of +8.5 and still YELLOW. So:
 *
 *   badge  = threshold on DS ITSELF   (bracketed below, from his own postings)
 *   rank   = ordered by EDGE, DS - BE (on both screenshots the card above has a
 *            larger edge and a smaller DS; MIL @ LAD carries "#3" while showing
 *            the best DS on screen)
 *
 * Cross-check that holds: card A reads "trails lead by 6pts" at DS 64.7 -> leader
 * 70.7; card C reads "trails lead by 11pts" at DS 60.0 -> leader 71.0. Same slate,
 * same leader, from two independently-read screenshots.
 *
 * WHAT DRIVES DS HERE IS OUR CALIBRATED p, NOT HIS WINDOWS, and the reason is
 * measured (scripts/nrfi-ds-vs-model.js, 1057 games, walk-forward, bootstrap
 * clustered by date):
 *
 *   scorer                      Brier      AUC
 *   ours (33 factors)           0.24649    0.5755
 *   raw window product          0.27645    0.5501
 *
 * A raw window score is WORSE THAN A CONSTANT as a probability — predicting the
 * base rate every day scores ~0.2498. DS is displayed against BE and the gap is
 * called an edge, so an overconfident DS manufactures green badges on edges that
 * do not exist. That is the one thing this layout must not do.
 *
 * Be honest about the other half of that table: on RANKING the two cannot be
 * separated (ours - raw +0.0253, 95% [-0.0176, +0.0657]). Our advantage here is
 * calibration, not discrimination. Nothing on this card should imply otherwise.
 */
/* Thresholds on the DS LEVEL, not on the edge.
 *
 * These are no longer read off screenshots. He posts his board as PLAIN TEXT in
 * the JuiceReel main chat ("SD@CLE: DS 71.1 → ELITE"), and the whole channel —
 * 2026-08-03 through 2026-08-16, scrolled to "No earlier messages" — yields 13
 * distinct labelled pairs. Sorting them is the entire calibration:
 *
 *   ELITE   68.3 68.9 69.1 69.7 69.8 70.5 71.1 72.6      min 68.3
 *   GREEN   64.1 64.7 66.4 67.7 67.8                     max 67.8
 *   YELLOW  59.1 60.0                        (screenshots) max 60.0
 *
 * A tier cut must lie strictly between the top of one band and the bottom of the
 * next, so the observations alone bracket it — no fitting, no midpoint guessing:
 *
 *   ELITE  cut in (67.8, 68.3]   width 0.5   -> 68
 *   GREEN  cut in (60.0, 64.1]   width 4.1   -> 62 (midpoint, still a guess)
 *
 * BUT THOSE ARE HIS NUMBERS ON HIS SCALE, AND THEY MUST NOT BE SHIPPED AS OURS.
 * The board's DS is our own calibrated probability (dsOf = pCal * 100), and the
 * two distributions are nowhere near each other. Over the 1283 cached games:
 *
 *   our p     min 37.9   median 54.2   p99 64.1   MAX 67.2
 *   his plays floor at 64.1, and 8 of his 13 posted boards are 68.3 or higher
 *
 * So his cutoffs applied to our number give: GREEN 4.5% of the slate against his
 * real 19% play rate, and ELITE ZERO GAMES IN 95 DAYS — a badge that can never
 * appear. That is not a conservative setting, it is a dead control, and shipping
 * one is worse than shipping none because it reads as "no elite games today".
 *
 * Calibration is why, and it is not a defect: a calibrated probability is pulled
 * toward the base rate, so ours cannot reach 68 on a coin-flip market. His DS is
 * a 0-100 rating, not a probability — he never claims otherwise ("it's dual score
 * out of 100 for both arms"). Comparing the two by value is a category error.
 *
 * What DOES transfer is SELECTIVITY. He plays 2.59 of 13.6 games a day = 19.0%
 * of the slate, so the cuts below are set where our own distribution reproduces
 * that, and the ladder is then checked for monotonicity on the cache:
 *
 *   band     our cut     share of slate     NRFI hit rate
 *   ELITE      >= 62           4.5%             69.0%
 *   GREEN    58.5-62          14.9%             56.0%
 *   YELLOW     54-58.5        32.0%             51.8%
 *   RED         < 54          48.6%             45.3%   (base rate 50.0%)
 *
 * GREEN-or-better is 19.4%, matching his 19.0% almost exactly, and the hit rate
 * falls monotonically across all four bands. Those rates are IN-SAMPLE on cached
 * p and are optimistic — they order the bands, they do not size the edge.
 *
 * His absolute 68/62 are not lost: scripts/nrfi-ds-tier-brackets.js keeps every
 * observation and re-derives them. They document HIS system. These document OURS.
 *
 * ELITE is not cosmetic either way. "Tough board today. Only playing MIL@LAD: DS
 * 68.3 → ELITE" is him dropping to ELITE-only when the slate is thin — a
 * SELECTION rule we did not previously model, and selection is exactly where
 * scripts/nrfi-tout-bottom-half.js concluded his edge lives.
 */
const DS_TIER_DEFAULTS = { elite: 62, green: 58.5, yellow: 54 };

function dsThresholds() {
  try {
    const raw = JSON.parse(localStorage.getItem("nrfi.ds.tiers") || "null");
    if (raw && Number.isFinite(raw.green) && Number.isFinite(raw.yellow)) {
      // Stored before ELITE existed: keep the user's own green/yellow rather than
      // discarding their tuning, and fill the new band from the default.
      return Number.isFinite(raw.elite) ? raw : { ...raw, elite: DS_TIER_DEFAULTS.elite };
    }
  } catch { /* fall through to defaults */ }
  return DS_TIER_DEFAULTS;
}

// Probability (0-100) -> American odds, the way his card prints N and Y.
function dsAmerican(pct) {
  if (pct == null || pct <= 0 || pct >= 100) return null;
  const p = pct / 100;
  return p >= 0.5 ? "-" + Math.round(100 * p / (1 - p)) : "+" + Math.round(100 * (1 - p) / p);
}

/* American odds -> implied probability (0-100), the inverse of dsAmerican.
 *
 * This is the VIG-INCLUDED number and it is meant to be. The break-even on the
 * card is the price you actually have to beat at the book you are actually
 * betting, not a de-vigged fair line — removing the juice here would flatter
 * every edge on the board by two or three points. -110 is 52.4%, and 52.4% is
 * what NRFI has to clear for that bet to be worth making. */
function dsImplied(american) {
  const a = Number(american);
  if (!Number.isFinite(a) || a === 0 || Math.abs(a) < 100) return null;
  return a < 0 ? 100 * (-a) / (-a + 100) : 100 * 100 / (a + 100);
}

/* Manual price override, per game, kept in localStorage.
 *
 * Kalshi is the only book we read automatically, and it is frequently not where
 * the bet actually goes — his own chat is full of shopping ("Dodgers brewers
 * game was at +102 this morning on FanDuel"). Without this the break-even, the
 * edge and the tier badge are all computed against a price nobody is taking.
 * Stored as the AMERICAN price on the NRFI side, because that is what a book
 * shows and what you would type in without converting anything. */
const PRICE_OV_KEY = "nrfi.priceOverride";
function loadPriceOv() {
  try {
    const raw = JSON.parse(localStorage.getItem(PRICE_OV_KEY) || "null");
    return raw && typeof raw === "object" ? raw : {};
  } catch { return {}; }
}

// Tiers on the DS level. Deliberately NOT on the edge — see the header comment;
// his DS 60.0 / +8.5 edge card is YELLOW while DS 64.7 / +5.2 is GREEN.
function dsTier(ds, th) {
  if (ds == null) return { label: "NO DS", color: "var(--dim)" };
  if (ds >= th.elite) return { label: "ELITE", color: "var(--cyan)" };
  if (ds >= th.green) return { label: "GREEN", color: "var(--moss)" };
  if (ds >= th.yellow) return { label: "YELLOW", color: "var(--amber)" };
  return { label: "RED", color: "var(--rose)" };
}

/* A window cell. n rides on every cell and drives how loudly it is allowed to
 * speak: at the measured k=87.6 a 2-start window is ~2% reliable, so colouring
 * a 100%-on-2g cell green would render sampling dust as form. Thin cells go
 * grey — the number is still shown, it just is not dressed up as a signal. */
function DSCell({ w }) {
  const thin = w.n < 3, semi = w.n >= 3 && w.n < 5;
  const color = w.pct == null || thin ? "var(--dim)"
    : w.pct >= 75 ? "var(--moss)" : w.pct >= 60 ? "var(--amber)" : "var(--rose)";
  return (
    <div style={{ flex: "0 0 auto", minWidth: 46, textAlign: "center", padding: "4px 6px",
      background: "rgba(255,255,255,0.03)", borderRadius: 6, opacity: semi ? 0.72 : 1 }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.06em" }}>{w.key}</div>
      <div style={{ fontSize: 12, fontWeight: 800, color }}>{w.pct == null ? "—" : w.pct + "%"}</div>
      <div style={{ fontSize: 8, color: "var(--dim)" }}>{w.n}g</div>
    </div>
  );
}

function DSArm({ label, prof }) {
  const rolling = prof && prof.rolling;
  const wins = (rolling && rolling.windows) || [];
  const l30 = wins.find((w) => w.key === "L30");
  const szn = wins.find((w) => w.key === "SZN");
  const big = l30 && l30.pct != null ? l30.pct : (szn ? szn.pct : null);
  const bigColor = big == null ? "var(--dim)"
    : big >= 75 ? "var(--moss)" : big >= 60 ? "var(--amber)" : "var(--rose)";
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden",
        textOverflow: "ellipsis" }}>{(prof && prof.name) || "TBD"}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: bigColor, lineHeight: 1.1 }}>
        {big == null ? "—" : big + "%"}
      </div>
      <div style={{ fontSize: 9, color: "var(--dim)" }}>
        NRFI L30 · {szn ? szn.n : 0}GS
      </div>
      {/* K-BB% on batters faced, first-inning split. League 1st-inn is ~11%, so
        * single digits is a contact pitcher and the mid-teens is a bat-misser.
        * Greyed under 30 batters faced for the same reason the window cells grey
        * out thin samples: a rate off 20 hitters is not a reading. */}
      {prof && prof.kbbPct != null && (
        <div title={"K-BB% = (strikeouts - walks) / batters faced, 1st inning only" +
          (prof.bf != null ? ", on " + prof.bf + " batters faced" : "") +
          ". League 1st-inn average is roughly 11%. Higher = misses bats and does not walk people = better for NRFI." +
          (prof.bf != null && prof.bf < 30 ? "\n\nTHIN: under 30 batters faced, treat as noise." : "")}
          style={{ cursor: "help", fontSize: 9, marginTop: 2,
            color: prof.bf != null && prof.bf < 30 ? "var(--dim)"
              : prof.kbbPct >= 15 ? "var(--moss)" : prof.kbbPct < 6 ? "var(--rose)" : "var(--dim)",
            opacity: prof.bf != null && prof.bf < 30 ? 0.5 : 1 }}>
          K-BB {prof.kbbPct.toFixed(1)}%
        </div>
      )}
      {/* Horizontally scrollable, like his — the strip runs past the card edge. */}
      <div style={{ display: "flex", gap: 4, marginTop: 6, overflowX: "auto", paddingBottom: 2 }}>
        {wins.length ? wins.map((w) => <DSCell key={w.key} w={w} />)
          : <div style={{ fontSize: 10, color: "var(--dim)" }}>no game log</div>}
      </div>
    </div>
  );
}

/* TEAM 1ST-INN RATES, lifted out of the badge row and onto the card proper.
 *
 * This is the same reading that used to sit in a pill below the fold, with the
 * same L10-vs-prior trend logic — it was not rewritten, it was moved, because
 * the two starters and the two offences are the four inputs to a first-inning
 * bet and three of them were above the fold while the fourth was not.
 *
 * The trend arrow is the part worth keeping and the part his card does not have:
 * a season rate actively misleads a team on a streak. The Yankees carried 41%
 * SZN into one of these cards while sitting on twelve straight scoreless firsts,
 * and that only showed on hover. When the recent window disagrees, it goes on
 * the card. */
function DSTeamRates({ r }) {
  if (r.awayYrfiPct == null && r.homeYrfiPct == null) return null;
  const sides = [["away", r.awayAbbr || r.away, r.awayYrfiPct, r.awayOffL10],
    ["home", r.homeAbbr || r.home, r.homeYrfiPct, r.homeOffL10]];
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.08em" }}>
        TEAM 1ST-INN RATES (YRFI%)
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 3, flexWrap: "wrap" }}>
        {sides.map(([side, abbr, pct, l10]) => {
          if (pct == null) return null;
          // Measure the streak against the games it is NOT part of, the same
          // baseline the model uses — szn contains the L10, so comparing to szn
          // shows a fraction of the real move.
          const base = l10 ? (l10.priorRate != null ? l10.priorRate : l10.sznRate) : null;
          const delta = l10 && base != null ? l10.rate - base : null;
          const hot = delta != null && Math.abs(delta) >= 0.20;
          const arrowClr = hot ? (delta > 0 ? "var(--rose)" : "var(--moss)") : null;
          const tip = abbr + " 1st-inn SZN: " + pct + "% of games score" +
            (l10 ? "\nL10: " + Math.round(l10.rate * 100) + "% (" + l10.n + "g)" +
              (l10.avgRuns != null ? " · " + l10.avgRuns.toFixed(2) + " R/g" : "") +
              (l10.priorRate != null
                ? "\nvs the " + l10.priorN + " games before that: " + Math.round(l10.priorRate * 100) + "%"
                : "") +
              (delta != null ? "\ndelta " + (delta > 0 ? "+" : "") + Math.round(delta * 100) + "pp" : "")
              : "") +
            "\n\nHigher = this offence scores in the 1st more often = worse for NRFI.";
          return (
            <span key={side} title={tip} style={{ cursor: "help", fontSize: 11, display: "inline-flex", gap: 5 }}>
              <span style={{ color: "var(--dim)" }}>{abbr}</span>
              <span style={{ fontWeight: 700, color: pct >= 38 ? "var(--rose)" : pct <= 25 ? "var(--moss)" : "var(--bone)" }}>
                {pct}%
              </span>
              {hot && (
                <span style={{ color: arrowClr, fontWeight: 700 }}>
                  {(delta > 0 ? "↑" : "↓") + " L10 " + Math.round(l10.rate * 100) + "%"}
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function DSHeader({ r, leadDS, thresholds, priceOv, onSavePrice }) {
  const pp = r.pitProfiles || {};
  // DS is P(NRFI) on our calibrated number, pre market-blend, so DS vs BE stays a
  // genuine model-against-market comparison rather than the market against itself.
  const ds = r.pCal != null ? r.pCal * 100 : null;
  /* A saved override REPLACES the Kalshi break-even rather than sitting beside
   * it. Showing both would be worse than showing either: the edge is a single
   * number and it has to be against the price you can actually get. When an
   * override is live the readout says so, so a stale hand-typed price can never
   * masquerade as a live market quote. */
  const ovBe = dsImplied(priceOv);
  const be = ovBe != null ? ovBe : (r.market ? r.market.marketNRFI : null);
  const edge = ds != null && be != null ? ds - be : null;
  const tier = dsTier(ds, thresholds);
  const behind = leadDS != null && ds != null ? leadDS - ds : null;
  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 8, marginBottom: 8 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <DSArm label="AWAY" prof={pp.away} />
        <DSArm label="HOME" prof={pp.home} />
      </div>
      {behind != null && behind > 0.05 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.08em" }}>WHY NOT LEAD</div>
          <div style={{ fontSize: 11, color: "var(--dim)" }}>
            dual score trails lead by {behind.toFixed(1)}pts (DS {Math.round(ds)})
          </div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: tier.color }}>
          {ds == null ? "—" : ds.toFixed(1)}
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.08em" }}>DS</span>
        <span style={{ fontSize: 9, fontWeight: 700, color: tier.color, border: "1px solid " + tier.color,
          borderRadius: 4, padding: "1px 5px", letterSpacing: "0.06em" }}>{tier.label}</span>
        <span style={{ fontSize: 10, color: "var(--dim)" }}>
          {be == null ? "no market" : (
            "N " + dsAmerican(be) + " · Y " + dsAmerican(100 - be) + " · BE " + be.toFixed(1) + "%"
          )}
          {edge != null && (edge >= 0 ? "  ·  +" : "  ·  ") + edge.toFixed(1) + " edge"}
          {ovBe != null && (
            <span title={"Break-even is coming from your typed price (" + priceOv +
              "), not from Kalshi" + (r.market ? " (Kalshi has " + r.market.marketNRFI.toFixed(1) + "%)" : "") +
              ". Clear the field and save to go back to the live market."}
              style={{ cursor: "help", color: "var(--violet)", fontWeight: 700 }}> · MANUAL</span>
          )}
        </span>
        <DSPriceOverride value={priceOv} onSave={(v) => onSavePrice(r.gamePk, v)} />
      </div>
      <DSTeamRates r={r} />
    </div>
  );
}

/* The price box itself. Local state while typing, committed on blur or Enter,
 * so a half-typed "-1" is never read as -1 and never repaints the whole slate
 * mid-keystroke. Empty commits as null, which clears the override — that is the
 * only way back to the live market and it has to be obvious. */
function DSPriceOverride({ value, onSave }) {
  const [txt, setTxt] = useState(value == null ? "" : String(value));
  const [focused, setFocused] = useState(false);
  // Follow the stored value when it changes underneath us (slate refresh, or a
  // clear from elsewhere), but never yank the field out from under the cursor.
  useEffect(() => { if (!focused) setTxt(value == null ? "" : String(value)); }, [value, focused]);
  const commit = () => {
    const t = txt.trim();
    if (!t) { onSave(null); return; }
    const n = Number(t);
    // Under 100 is not an American price on either side; reject rather than
    // store a number dsImplied will only refuse to use.
    if (!Number.isFinite(n) || Math.abs(n) < 100) { setTxt(value == null ? "" : String(value)); return; }
    onSave(Math.round(n));
  };
  return (
    <input
      value={txt}
      onChange={(e) => setTxt(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); commit(); }}
      onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") { setTxt(value == null ? "" : String(value)); e.target.blur(); } }}
      placeholder="price"
      title={"Type the American price you can actually get on NRFI (e.g. -115, +102) and press Enter.\n\n" +
        "Kalshi is the only book read automatically and it is often not where the bet goes. " +
        "A saved price replaces the break-even, the edge and the tier badge for this game.\n\n" +
        "Clear the box and press Enter to go back to the live market."}
      style={{ width: 52, fontSize: 10, padding: "1px 4px", background: "transparent", cursor: "text",
        color: value != null ? "var(--violet)" : "var(--dim)",
        border: "1px solid " + (value != null ? "var(--violet)" : "rgba(255,255,255,0.12)"),
        borderRadius: 4, fontFamily: "inherit", textAlign: "center" }}
    />
  );
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
  const [growthSpeed, setGrowthSpeed] = useState("selective");
  const [amountOut, setAmountOut] = useState(null);
  const saveBankrollTimer = useRef(null);
  const [syncingBalance, setSyncingBalance] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const [openPositions, setOpenPositions] = useState(null);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const now = useNow(1000);
  const [dismissed, setDismissed] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("cd:nrfi:dismissed") || "[]")); } catch { return new Set(); }
  });
  function dismissGame(gamePk) {
    const next = new Set(dismissed); next.add(String(gamePk));
    setDismissed(next);
    try { localStorage.setItem("cd:nrfi:dismissed", JSON.stringify([...next])); } catch {}
    const id = "nrfi-" + gamePk;
    if (recRef.current) recRef.current = recRef.current.map((x) => x.id === id ? { ...x, skipped: true } : x);
    setRec((prev) => (prev || []).map((x) => x.id === id ? { ...x, skipped: true } : x));
    fetch("/api/desk/nrfi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify([{ id, skipped: true }]) }).catch(() => {});
  }

  /* Dual Score tier cutoffs, held in state rather than read out of localStorage
   * at render time so an edit repaints every badge on the slate at once — the
   * whole point of the control is watching where the line lands on today's
   * games, and that is useless if you have to reload to see it. */
  const [dsTh, setDsTh] = useState(dsThresholds);
  function saveDsTh(next) {
    setDsTh(next);
    try { localStorage.setItem("nrfi.ds.tiers", JSON.stringify(next)); } catch { /* private mode */ }
  }

  /* Hand-typed prices, keyed by gamePk, same in-state-and-in-storage pattern as
   * the tiers above and for the same reason: the edge and the badge have to move
   * the moment you type the price you actually got. */
  const [priceOv, setPriceOv] = useState(loadPriceOv);
  function savePriceOv(gamePk, american) {
    const next = { ...priceOv };
    if (american == null) delete next[String(gamePk)];
    else next[String(gamePk)] = american;
    setPriceOv(next);
    try { localStorage.setItem(PRICE_OV_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  }

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
    const lc = nrfiCalibration(recl);
    const lcW = lc.n / (lc.n + NRFI_CALIB_SEED.n);
    const calibNow = { c: lcW * lc.liveC + (1 - lcW) * NRFI_CALIB_SEED.c, active: true };
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
      // Same definition the verdict uses — these two had their own copy of the
      // `sample >= 5` rule, so the record could refuse to store a pick the board
      // was happily showing.
      const awThin = nrfiThinArm(r.pitProfiles && r.pitProfiles.away);
      const hmThin = nrfiThinArm(r.pitProfiles && r.pitProfiles.home);
      // The board runs the value gate; the record has to run it too, or it stores
      // a verdict that was never on screen. That stored strength drives both the
      // record shown to the user and nrfiCalibration's `strength !== "PASS"`
      // filter — so without this the calibration trained on picks we never made.
      const recMarket = mk ? {
        marketSide: mktSide,
        edge: started ? null : (call === "NRFI" ? pFinal : 1 - pFinal) * 100 - mktSide,
        edgeRaw: started ? null : (call === "NRFI" ? pcal : 1 - pcal) * 100 - mktSide,
        started,
      } : null;
      if (!e && r.state === "Preview" && r.hasPitchers && r.dataOk && pMax >= NRFI_LEAN_MIN && !(awThin && hmThin)) {
        const v = nrfiVerdict({ ...r, pMax, call, market: recMarket });
        const pp = r.pitProfiles;
        e = { id, at: Date.now(), date: r.date.replace(/-/g, ""), gamePk: r.gamePk,
          game: r.away + " @ " + r.home, call, prob: r1(pMax),
          pNRFI: Math.round(r.pNRFI * 1000) / 1000,
          mktAtPick: mktSide != null ? r1(mktSide) : null,
          mktLatest: mktSide != null ? r1(mktSide) : null, mktAtClose: null, result: null,
          strength: v.strength, isBet: v.isBet, thinPass: v.thinPass,
          method: r.method || "model",
          awayPP: r.awayPP, homePP: r.homePP,
          pitProfiles: pp ? {
            // apps/seasonIp ride along so a reloaded record re-grades identically;
            // without them nrfiThinArm would see a reliever as a bare 2-start unknown.
            away: { name: pp.away.name, hand: pp.away.hand, sample: pp.away.sample, apps: pp.away.apps, seasonIp: pp.away.seasonIp, cleanPct: pp.away.cleanPct, score: pp.away.score, grade: pp.away.grade, rolling: pp.away.rolling },
            home: { name: pp.home.name, hand: pp.home.hand, sample: pp.home.sample, apps: pp.home.apps, seasonIp: pp.home.seasonIp, cleanPct: pp.home.cleanPct, score: pp.home.score, grade: pp.home.grade, rolling: pp.home.rolling },
          } : null };
        recl.unshift(e); changed.push(e);
      } else if (e && e.result == null && !e.skipped) {
        // Track the market for CLV: update the live price pregame, freeze it at first pitch.
        if (mktSide != null && !started && e.mktLatest !== r1(mktSide)) { e.mktLatest = r1(mktSide); changed.push(e); }
        if (e.mktAtClose == null && started) { e.mktAtClose = e.mktLatest != null ? e.mktLatest : (mktSide != null ? r1(mktSide) : null); if (e.mktAtClose != null) changed.push(e); }
        // Lineups posted: upgrade from λ-model to sim, re-evaluate with real batter rates.
        if (!started && r.method === "sim" && e.method !== "sim") {
          const v2 = nrfiVerdict({ ...r, pMax, call, market: recMarket });
          e.prob = r1(pMax); e.call = call; e.strength = v2.strength; e.isBet = e.isBet && v2.isBet; e.thinPass = v2.thinPass;
          e.method = "sim"; e.lineupUpdatedAt = Date.now();
          if (!changed.includes(e)) changed.push(e);
        }
      }
      if (e && e.result == null && !e.skipped && r.inning1runs != null && (r.currentInning > 1 || r.final)) {
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

  // Auto-refresh all data every 2 minutes: keeps lineups, weather, market prices, and
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
  // A pick counts in the model record only if it had an active market at pick time.
  // Entries with mktAtPick == null had no market and were unbettable (effectively PASS).
  const isModelPick = (r) => r.source !== "kalshi-import" && !r.skipped && r.strength !== "PASS" && !r.thinPass && (r.mktAtPick != null || r.isBet === true);
  const modelSettled = settled.filter(isModelPick);
  const betSettled = modelSettled.filter((r) => r.isBet === true || (r.prob != null && r.prob >= NRFI_BET_MIN));
  const strongSettled = betSettled.filter((r) => r.strength === "STRONG" || (r.prob != null && r.prob >= NRFI_STRONG_MIN));
  const pureBetSettled = betSettled.filter((r) => !(r.strength === "STRONG" || (r.prob != null && r.prob >= NRFI_STRONG_MIN)));
  const leanSettled = modelSettled.filter((r) => !r.isBet && (r.prob == null || r.prob < NRFI_BET_MIN));
  const kalshiSettled = settled.filter((r) => r.source === "kalshi-import" && !r.skipped);
  const wins = modelSettled.filter((r) => r.result === "won").length;
  const losses = modelSettled.length - wins;
  const betWins = betSettled.filter((r) => r.result === "won").length;
  const betLosses = betSettled.length - betWins;
  const strongWins2 = strongSettled.filter((r) => r.result === "won").length;
  const strongLosses2 = strongSettled.length - strongWins2;
  const pureBetWins = pureBetSettled.filter((r) => r.result === "won").length;
  const pureBetLosses = pureBetSettled.length - pureBetWins;
  const leanWins = leanSettled.filter((r) => r.result === "won").length;
  const leanLosses = leanSettled.length - leanWins;
  const kWins = kalshiSettled.filter((r) => r.result === "won").length;
  const kLosses = kalshiSettled.length - kWins;
  // Participation: BET/STRONG model signals vs Kalshi bets placed on same date+call
  const allModelBets = (rec || []).filter((r) => isModelPick(r) && (r.isBet === true || (r.prob != null && r.prob >= NRFI_BET_MIN)));
  const kalshiDateCall = new Set((rec || []).filter((r) => r.source === "kalshi-import" && !r.skipped).map((r) => r.date + ":" + r.call));
  const participatedCount = allModelBets.filter((r) => r.date && kalshiDateCall.has(r.date + ":" + r.call)).length;
  const betSignalCount = allModelBets.length;

  const liveCalib = nrfiCalibration(rec || []);
  const lcW = liveCalib.n / (liveCalib.n + NRFI_CALIB_SEED.n);
  const calib = { c: lcW * liveCalib.liveC + (1 - lcW) * NRFI_CALIB_SEED.c, active: true };
  const enriched = rows.filter((r) => !dismissed.has(String(r.gamePk))).map((r) => {
    const pcal = applyCalibration(r.pNRFI, calib);        // model's own NRFI prob
    const mk = matchRFI(r, rfi);
    const pFinal = nrfiBlend(pcal, mk ? mk.marketNRFI : null); // market prior + model nudge
    const call = pFinal >= 0.5 ? "NRFI" : "YRFI";
    const pMax = Math.max(pFinal, 1 - pFinal) * 100;
    // Once the first pitch is thrown the market prices the inning as it happens,
    // while the desk still holds its pregame number and the line score only
    // arrives after the inning closes. In that window the gap is not an edge —
    // it is the market knowing the outcome. Quoting it produced a +85% "edge"
    // at max bet size on a game whose first inning had already scored.
    const started = !!(r.currentInning >= 1 || r.final || (r.state && r.state !== "Preview"));
    let market = null;
    if (mk) {
      // Two different edges, for two different jobs.
      //
      // `edge` is quoted off pFinal — the anchored number the desk actually bets
      // and sizes on — so the displayed gap never overstates what we're backing.
      //
      // `edgeRaw` is the model's undiluted disagreement with the market, and it
      // is what the value gates test. nrfiBlend pulls pFinal toward the market by
      // (1 - blend), so edge == blend * edgeRaw — gating on `edge` charged the
      // blend twice and demanded a 4-6pp raw divergence just to clear a 2.5pp
      // bar. The gate thresholds were calibrated against raw divergence; test
      // them against raw divergence.
      const modelSide = call === "NRFI" ? pFinal * 100 : (1 - pFinal) * 100;
      const rawSide   = call === "NRFI" ? pcal * 100 : (1 - pcal) * 100;
      const marketSide = call === "NRFI" ? mk.marketNRFI : (100 - mk.marketNRFI);
      const snapPrice = priceSnap.current[mk.ticker];
      const mktMove = snapPrice != null ? mk.yesPrice - snapPrice : null;
      market = { ticker: mk.ticker, link: mk.link, yesPrice: mk.yesPrice, marketNRFI: mk.marketNRFI,
        marketSide, edge: started ? null : modelSide - marketSide,
        edgeRaw: started ? null : rawSide - marketSide, mktMove, started };
    }
    // Size on the same anchored probability the edge is quoted from, and never
    // size a game that is already under way.
    const kelly = market && !started ? kellyNRFI(pFinal, market.yesPrice, call) : null;
    const tails = sellers.filter((s) => s.active).map((s) => ({ name: s.name, pick: matchKingPick(r, s.open || []), record: s.record || null })).filter((t) => t.pick);
    const base = Object.assign({}, r, { call, pMax, pModel: pcal, pFinal, pCal: pcal, tails, tier: nrfiTier(pMax), market, kelly });
    base.v = nrfiVerdict(base);
    return base;
  });
  /* ---- live first-inning callout ----
   * Follows a game while its 1st inning is open if EITHER the desk has a
   * LEAN-or-better call on it OR there is real money on it in an open Kalshi
   * position — so it is silent all day, talks for the twenty minutes that decide
   * the ticket, and stops on its own. Each game is announced once by name when
   * its inning opens, then play by play, then settled out loud.
   *
   * The verdict alone was the wrong gate. The desk PASSes a game whenever the
   * market has it priced right, which says nothing about whether the user is in
   * it — on a live board two of three open positions were PASS, so the callout
   * sat silent through the innings that settled $1,628 of exposure. A held
   * position is the strongest possible reason to follow a game.
   *
   * Positions are kept in a ref, not state: a re-render every 2.5s across a
   * 15-game board would be a real cost for a feature that renders nothing.
   *
   * Latency is the whole point of a live callout, so every avoidable source of
   * it is removed: games are polled in PARALLEL (sequentially, 15 games at one
   * round trip each put the last game seconds behind the first), on a 2.5s
   * interval, against the 8KB field-projected feed rather than the 537KB one.
   * statsapi itself publishes a play within a second or two of it ending, so
   * this tracks the park about as closely as a data feed can. */
  /* 1200ms. The poll interval is pure additive lag — a pitch lands uniformly
   * inside the gap, so the interval costs half itself on average before the
   * callout has even seen the event, and 2.5s of that dominated everything else
   * in the path. The cost of halving it is request rate, and that is bounded in
   * a way that matters here: this effect only runs while the callout is ON, and
   * only against games actually in the 1st inning, so it is a handful of 8KB
   * field-projected requests, not the whole board. inFlight already absorbs a
   * round trip that outlasts the interval by skipping rather than stacking. */
  const CALLOUT_POLL_MS = 1200;
  // Anything older than this was over before the callout saw it. Reading it out
  // now would put the voice behind the game and keep it there for the rest of
  // the inning — the backlog never drains, it just delays everything after it.
  const CALLOUT_STALE_MS = 45000;
  const [callout, setCallout] = useState(false);
  /* The browser refusing to speak is the one callout failure a listener cannot
   * diagnose: the button says on, the games are tracked, and nothing comes out.
   * Subscribed once here so the label can say so. */
  const [voiceBlocked, setVoiceBlocked] = useState(null);
  useEffect(() => { onSayBlocked(setVoiceBlocked); return () => onSayBlocked(null); }, []);
  /* Which game is being listened to. null = all of them, the original behaviour.
   *
   * That behaviour is fine at 7:05 and unusable at 4:10, when five games open
   * the 1st within a few minutes of each other: the utterances interleave, and
   * because a backlog gets dropped rather than drained, the overlap does not
   * just confuse the call, it silently DELETES pitches from it. Picking one game
   * is the only way the voice stays a broadcast rather than a scanner.
   *
   * Focus mutes; it does not stop. Every tracked game keeps polling and keeps
   * marking what it has seen, so switching to a game mid-inning starts at the
   * live edge instead of reciting the half-inning that already happened — the
   * same catch-up rule that governs a fresh attach. And a settle is spoken from
   * any tracked game regardless of focus, named, because a run scoring is the
   * ticket resolving and it is two seconds of audio. */
  const [focus, setFocus] = useState(null);
  const focusRef = useRef(null);
  const spoken = useRef(new Map()); // gamePk -> { n: plays announced, opened, settled }
  useEffect(() => {
    if (!callout) return;
    const held = calloutHeld(openPositions);
    // Re-evaluated per tick rather than closed over, so a game entering the 1st
    // between renders is picked up on the next poll instead of the next render.
    const tracked = () => enriched.filter((r) => calloutEligible(r, held));
    let stopped = false;
    let inFlight = false;
    async function pollGame(r) {
      const st = spoken.current.get(r.gamePk) || { n: 0, opened: false, settled: false };
      if (st.settled) return;
      const live = await fetchFirstInning(r.gamePk);
      if (stopped || !live) return;
      // What is at stake here: the position if one is held, otherwise the call.
      // Announcing the model's side on a game the user faded would be worse than
      // saying nothing.
      const mine = calloutHeldSide(r, held);
      const side = mine || r.call;
      const stake = mine ? "You are on " + mine : "Desk is on " + r.call;
      // Focus mutes this game's running commentary. It does NOT stop the poll:
      // everything below still advances the seen-sets, so switching in later
      // starts at the live edge rather than dumping the inning so far.
      const loud = !focusRef.current || focusRef.current === r.gamePk;
      const named = r.away + " at " + r.home;
      // Joining a game mid-inning: catch up silently to what is already over and
      // start calling from the live edge, rather than reciting the half-inning.
      // Switching focus TO a game clears `opened`, so it re-introduces itself and
      // re-anchors to the live edge — a switch is a fresh attach.
      if (!st.opened) {
        const fresh = live.plays.findIndex((p) => playAgeMs(p) < CALLOUT_STALE_MS);
        // Math.max, because this block runs on RE-attach too. Switching focus
        // clears `opened`, and st.n is already current by then — the plays loop
        // below advances it on every tick even while muted, since only `speak`
        // is gated by `loud`, not the loop. Assigning `fresh` therefore rewound
        // the pointer to the first play under 45s old and re-announced every
        // play in that window, which is the "repeating old plays" report; the
        // replayed backlog is also what put the voice behind the park.
        //
        // The pitch path never had this bug because st.pitch is an id Set built
        // once behind `if (!st.pitch)`, so it cannot rewind. An index can, and
        // an attach must only ever move it forward.
        const edge = fresh === -1 ? live.plays.length : fresh;
        st.n = Math.max(st.n, edge);
        if (live.plays.length || live.inning === 1) {
          if (loud) speak(named + ". First inning. " + stake + ".");
          st.opened = true;
        }
      }
      // Pitches go out BEFORE the play lines, and that ordering is not cosmetic:
      // the last pitch this code speaks in an at-bat is always the one before the
      // ball is put in play (in-play calls are skipped outright), so pitches-then-
      // play is the true chronological order within a single poll.
      //
      // De-duplication is by playId, not by index, because every poll re-delivers
      // the whole live at-bat with one more event appended.
      if (!st.pitch) {
        st.pitch = new Set();
        // Same mid-inning catch-up rule the plays use: whatever was already
        // thrown is history, and reciting it would put the voice a minute behind
        // the park for the rest of the inning. A pitch with no usable timestamp
        // is treated as old for the same reason.
        for (const p of live.pitches) if (!(Date.now() - p.ts < CALLOUT_STALE_MS)) st.pitch.add(p.id);
      }
      for (const p of live.pitches) {
        if (st.pitch.has(p.id)) continue;
        st.pitch.add(p.id);
        // p.ts is when the pitch was thrown; a wake-up after a throttled gap
        // drops it at drain rather than calling it a minute late.
        if (loud) speak(p.text, false, p.ts);
      }
      // Runs are read against the play before, so a two-run double is called as
      // two — the feed only ever reports a cumulative score.
      // A settle cuts through focus. Running commentary from an unfocused game is
      // noise, but a run scoring there is the ticket resolving — two seconds of
      // audio, and the one thing that is strictly worse to miss than to hear. It
      // gets the matchup name in front of it so it cannot be mistaken for the
      // game actually being listened to.
      const tag = loud ? "" : named + ". ";
      for (let i = st.n; i < live.plays.length; i++) {
        const line = playCallout(live.plays[i]);
        const runs = playRuns(live.plays[i], live.plays[i - 1]);
        const verdict = ". " + (runs === 1 ? "A run scores" : runs + " runs score") +
          ". That is Y-R-F-I — " + (side === "YRFI"
            ? (mine ? "you are a winner" : "the desk had it")
            : (mine ? "that ticket is dead" : "the desk was wrong")) + ".";
        // A settle is never stale — it is the ticket resolving, and it stays
        // worth hearing however late it arrives. Running commentary is not.
        if (runs > 0) { speak(tag + (loud && line ? line + verdict : verdict.slice(2)), true); st.settled = true; }
        else if (loud && line) speak(line, false, Date.now() - playAgeMs(live.plays[i]));
      }
      // Math.max, for the same reason the attach above uses it: this pointer is
      // only ever allowed to move forward. A bare assignment trusts the feed to
      // be monotonic, and firstInningPlays keeps only COMPLETE plays — so a play
      // under review, which statsapi can flip back to incomplete while the crew
      // looks at it, takes the list backwards. The next poll then re-announces
      // everything after the rewind point. Reviews in the 1st are not rare; one
      // of the six innings the dupe harness replays has a challenged pitch in it.
      //
      // Losing the reverted play is the right trade. If the review changes the
      // call the play comes back with a NEW description and a higher index, so it
      // still gets announced; if it does not, the listener has already heard it.
      st.n = Math.max(st.n, live.plays.length);
      if (!st.settled && live.past1) {
        speak(tag + "First inning is clean in " + r.home + ". N-R-F-I — " +
          (side === "NRFI"
            ? (mine ? "you are a winner" : "that is a winner")
            : (mine ? "that ticket is dead" : "the desk was wrong")) + ".", true);
        st.settled = true;
      }
      spoken.current.set(r.gamePk, st);
    }
    async function tick() {
      // A slow round trip must not stack ticks on top of each other; skipping is
      // correct because the next poll is 2.5s away and reads the same state.
      if (inFlight) return;
      inFlight = true;
      try { await Promise.all(tracked().map(pollGame)); }
      finally { inFlight = false; }
    }
    tick();
    const id = setInterval(tick, CALLOUT_POLL_MS);
    return () => { stopped = true; clearInterval(id); };
    // Positions load asynchronously and usually land AFTER the board does, so
    // they have to be in the dep list — otherwise the effect closes over an
    // empty position set and never picks the held games up.
    //
    // `focus` is deliberately NOT a dep. It is read through a ref so switching
    // games does not tear down and restart the poll: a restart would drop every
    // seen-set and make the next tick re-announce the inning from the top.
  }, [callout, enriched.map((r) => r.gamePk + ":" + r.currentInning).join(","),
      (openPositions && !openPositions.error ? openPositions.positions || [] : [])
        .map((p) => p.ticker + ":" + p.call).join(",")]);

  // The games the picker offers. Must be the same predicate the poll uses, or
  // the picker lists a game that never speaks.
  const calloutGames = useMemo(() => {
    if (!callout) return [];
    const held = calloutHeld(openPositions);
    return enriched.filter((r) => calloutEligible(r, held));
  }, [callout, enriched, openPositions]);

  useEffect(() => {
    focusRef.current = focus;
    // Switching cuts the outgoing game off mid-queue on purpose — those lines
    // describe a game no longer being listened to, and letting them drain would
    // put the new game's first pitches behind them.
    // speakStop, not a bare cancel: the queue lives in module scope now, and
    // cancelling the synthesiser while leaving lines buffered means the outgoing
    // game keeps talking over the incoming one.
    speakStop();
    // A switch is a fresh attach: clear `opened` so the new game re-introduces
    // itself and re-anchors to the live edge on the next tick, instead of
    // resuming mid-inning from wherever it had got to while muted.
    const st = focus && spoken.current.get(focus);
    if (st && !st.settled) st.opened = false;
  }, [focus]);

  // A game that has settled or left the 1st stops being offered, so focus must
  // not strand the callout on it — that would mute the whole board silently.
  useEffect(() => {
    if (focus && callout && !calloutGames.some((r) => r.gamePk === focus)) setFocus(null);
  }, [focus, callout, calloutGames]);

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
  const clvSet = (rec || []).filter((r) => r.source !== "kalshi-import" && r.mktAtPick != null && r.mktAtClose != null && (r.result === "won" || r.result === "lost"));
  const avgCLV = clvSet.length ? clvSet.reduce((a, r) => a + (r.mktAtClose - r.mktAtPick), 0) / clvSet.length : null;
  const byConf = (a, b) => b.pMax - a.pMax;
  // A game you have money on is pinned to the top of the board and stays there,
  // whatever today's verdict says about it. The sections below are a shopping
  // list — they answer "what should I bet", and a model change that demotes a
  // game to PASS correctly drops it off that list. But it does NOT drop the
  // contract: the position is still open and still needs watching, and burying
  // it in the Pass section (or, on a thinPass, removing it from the board
  // outright, since validRows filters those out) reads as "your bet is gone".
  // So held games come off `enriched` rather than `validRows`, and are removed
  // from the other four sections so each game renders exactly once.
  const heldSides = calloutHeld(openPositions);
  const isHeld = (r) => !!calloutHeldSide(r, heldSides);
  const held = enriched.filter(isHeld).sort(byConf);
  // Once the first inning is over the game is no longer a decision — the four
  // sections below are a shopping list, and a settled game is not something you
  // can still bet. It stayed on the board for hours after the answer was known,
  // pushing the games you can still act on off the screen. Held positions are
  // deliberately exempt: openPositions comes from Kalshi, so a contract still
  // listed there has not paid out yet and pinning it is the point of the block
  // above. Grading and the record are unaffected — nrfiCalibration and the
  // profit tracker read `rec`, never the rendered cards.
  const decided = (r) => r.inning1runs != null && (r.currentInning > 1 || r.final);
  const validRows = enriched.filter((r) => !r.v.thinPass && !isHeld(r) && !decided(r));
  /* Dual Score board state. `leadDS` is the best DS on the slate, which is what
   * his WHY NOT LEAD line measures every other game against — his two cards agree
   * on a leader of ~71 from independent "trails by 6pts"/"trails by 11pts" lines.
   *
   * The DS RANK is ordered by edge (DS - BE), which is his ordering, not ours.
   * It is shown as a badge rather than used to re-sort: the existing board is
   * bucketed Bets/Leans/Pass and sorted by confidence inside each, and silently
   * reordering the thing the user reads every day is a bigger change than adding
   * a number to it. Both orderings are now visible; the sort can follow later. */
  const dsOf = (r) => (r.pCal != null ? r.pCal * 100 : null);
  const dsEdgeOf = (r) => { const d = dsOf(r); return d != null && r.market ? d - r.market.marketNRFI : null; };
  const leadDS = validRows.reduce((m, r) => { const d = dsOf(r); return d != null && (m == null || d > m) ? d : m; }, null);
  const dsRank = new Map(validRows.filter((r) => dsEdgeOf(r) != null)
    .sort((a, b) => dsEdgeOf(b) - dsEdgeOf(a))
    .map((r, i) => [r.gamePk, i + 1]));
  const betNRFI = validRows.filter((r) => r.v.isBet && r.call === "NRFI").sort(byConf);
  const betYRFI = validRows.filter((r) => r.v.isBet && r.call === "YRFI").sort(byConf);
  const leans = validRows.filter((r) => r.v.strength === "LEAN").sort(byConf);
  const passes = validRows.filter((r) => r.v.strength === "PASS").sort(byConf);
  // The games `decided` just took off the board, one line each. Hiding them was
  // the point, but hiding them without a trace makes the slate look like it never
  // happened — and the first thing you want once an inning settles is whether the
  // desk was right. Graded the way the card grades: off the pick as it was LOGGED
  // in `rec`, never the live recompute, so this strip and the Model record cannot
  // disagree. No record means the desk never called the game (under the logging
  // bar), which is neither a win nor a loss.
  const settledToday = enriched.filter((r) => decided(r) && !isHeld(r) && !r.v.thinPass)
    .sort((a, b) => (a.startUtc || "") < (b.startUtc || "") ? 1 : -1);

  const leanColor = (l) => (l === "nrfi" ? "var(--moss)" : l === "yrfi" ? "var(--rose)" : "var(--dim)");
  const leanLabel = (l) => (l === "nrfi" ? "NRFI lean" : l === "yrfi" ? "YRFI lean" : "neutral");

  const card = (r) => {
    const isOpen = !!open[r.gamePk];
    const graded = decided(r);
    const openPos = r.market && openPositions && !openPositions.error
      ? (openPositions.positions || []).find((p) => p.ticker === r.market.ticker)
      : null;
    const tailTicker = (r.tails || []).map((t) => t.pick.kalshiTicker).find(Boolean);
    const tradeLink = (r.market && r.market.link) || (tailTicker ? kalshiEventLink(tailTicker) : null);
    const recE = (rec || []).find((x) => x.id === "nrfi-" + r.gamePk);
    // Grade against the pick as it was logged, never the live recompute. The
    // model re-evaluates every refresh, so a call that flipped between the pick
    // and first pitch rendered a win on the card while the record counted a
    // loss — which is how "Model record" showed an L no card on the board owned.
    // No record at all means the desk never called this game (pMax under the 57
    // logging bar), so it gets neither a win nor a loss.
    const gradedCall = recE ? recE.call : null;
    const gradedWon = !graded || !recE ? null
      : recE.result ? recE.result === "won"
      : (recE.call === "NRFI") === (r.inning1runs === 0);
    const gameTime = r.startUtc ? new Date(r.startUtc).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }) + " PT" : null;
    const countdown = r.startUtc && !r.final && r.currentInning === 0 ? fmtCountdown(r.startUtc, now) : null;

    // ── Verdict graphic: tagline + emoji based on call, confidence, result ──
    const vg = (() => {
      if (graded) {
        if (gradedWon === null) return { e: "📋", tag: "NOT CALLED · no pick was logged on this game", c: "var(--dim)", bg: "rgba(120,130,150,0.05)" };
        if (recE && (recE.strength === "PASS" || recE.thinPass || (!recE.isBet && recE.mktAtPick == null))) return { e: "📋", tag: "PASSED · no bet placed · outcome: " + (r.inning1runs === 0 ? "NRFI" : r.inning1runs + " run" + (r.inning1runs === 1 ? "" : "s")), c: "var(--dim)", bg: "rgba(120,130,150,0.05)" };
        const won = gradedWon;
        if (won && gradedCall === "NRFI") return { e: "⚰️", tag: "OFFENSE: DECEASED · zero survivors, no witnesses", c: "var(--moss)", bg: "rgba(80,160,80,0.08)" };
        if (won && gradedCall === "YRFI") return { e: "💥", tag: "CARNAGE ACHIEVED · " + r.inning1runs + " run" + (r.inning1runs === 1 ? "" : "s") + " of beautiful chaos", c: "var(--moss)", bg: "rgba(80,160,80,0.08)" };
        if (!won && gradedCall === "NRFI") return { e: "🩸", tag: "PITCHER GOT SMOKED · model takes the L, moment of silence", c: "var(--rose)", bg: "rgba(220,60,60,0.08)" };
        return { e: "🤡", tag: "BATTER FUMBLED IT · somehow stayed scoreless, clown behavior", c: "var(--rose)", bg: "rgba(220,60,60,0.08)" };
      }
      if (r.call === "NRFI") {
        if (r.pMax >= 66 && r.v.isBet) return { e: "⚰️", tag: "BATTERS: DO NOT RESUSCITATE", c: "var(--moss)", bg: "rgba(80,160,80,0.06)" };
        if (r.v.isBet) return { e: "💀", tag: "OFFENSE IN CRITICAL CONDITION", c: "var(--moss)", bg: "rgba(80,160,80,0.06)" };
        if (r.v.strength === "LEAN") return { e: "😬", tag: "BATTERS ARE SWEATING BULLETS", c: "var(--amber)", bg: "rgba(230,160,0,0.06)" };
        return { e: "🎲", tag: "COIN FLIP ENERGY · god help us all", c: "var(--dim)", bg: "rgba(120,130,150,0.05)" };
      }
      if (r.pMax >= 66 && r.v.isBet) return { e: "🔥", tag: "PITCHER: ABOUT TO GET ABSOLUTELY COOKED", c: "var(--rose)", bg: "rgba(220,60,60,0.06)" };
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
            {r.aligned && r.aligned.total >= 3 && (
              <div title={r.aligned.agree + " of " + r.aligned.total + " signal groups agree with the model's call" + (r.aligned.rows ? " (from " + r.aligned.rows + " individual checks)" : "") + ". Checks reading the same underlying fact — the twelve that all grade the starter, for instance — share one vote, so a single input can't outvote everything else."} style={{ cursor: "help", fontSize: 9, color: r.v.color, marginTop: 4, opacity: 0.75, fontWeight: 700 }}>
                {r.aligned.agree}/{r.aligned.total} signal groups
              </div>
            )}
            {r.checks && r.aligned && r.aligned.agree >= 2 && (() => {
              const call = r.call.toLowerCase();
              const top = r.checks.filter((c) => c.lean === call).slice(0, 2).map((c) => c.label);
              if (!top.length) return null;
              return (
                <div title={"Top signals agreeing with " + r.call + ": " + top.join(", ")} style={{ cursor: "help", fontSize: 8, color: r.v.color, marginTop: 3, opacity: 0.55, fontWeight: 600, letterSpacing: "0.02em" }}>
                  {top.map((l, i) => <span key={i}>{i > 0 ? " · " : ""}{l}</span>)}
                </div>
              );
            })()}
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
          <div title={r.away + " (away) @ " + r.home + " (home)"} style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 20, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 3 }}>
            <span>{r.awayAbbr || r.away} <span style={{ color: "var(--dim)", fontWeight: 300 }}>@</span> {r.homeAbbr || r.home}</span>
            {dsRank.has(r.gamePk) && (
              <span title={"Rank " + dsRank.get(r.gamePk) + " of " + dsRank.size + " by edge (DS minus break-even) — his board's ordering."}
                style={{ cursor: "help", fontSize: 10, fontWeight: 700, color: "var(--sky, #6cf)", border: "1px solid var(--sky, #6cf)", borderRadius: 4, padding: "1px 5px" }}>
                #{dsRank.get(r.gamePk)}
              </span>
            )}
          </div>
          <DSHeader r={r} leadDS={leadDS} thresholds={dsTh}
            priceOv={priceOv[String(r.gamePk)]} onSavePrice={savePriceOv} />
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
          <div className="pit-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            {[
              { side: "AWAY", name: r.awayPP, p: r.pitProfiles.away },
              { side: "HOME", name: r.homePP, p: r.pitProfiles.home },
            ].map(({ side, name, p }, i) => {
              const rl = p.rolling;
              // A 1-start L30 window is not a rate. Fall back to the regressed
              // cleanPct until the rolling window has real games behind it.
              const rlOk = rl && rl.l30 && rl.l30.pct != null && (rl.l30.n || 0) >= 6;
              const headline = rlOk ? rl.l30.pct : p.cleanPct;
              const headlineN = rlOk ? rl.l30.n : p.sample;
              const headlineC = headline >= 65 ? "var(--moss)" : headline >= 50 ? "var(--amber)" : "var(--rose)";
              const kbb = p.k9 != null && p.bb9 != null ? (p.k9 - p.bb9).toFixed(1) : null;
              const pClr = (v) => v >= 65 ? "var(--moss)" : v >= 50 ? "var(--fg)" : v >= 38 ? "var(--amber)" : "var(--rose)";
              const windows = rl ? [{ label: "SZN", ...rl.szn }, { label: "L30", ...rl.l30 }, { label: "L10", ...rl.l10 }, { label: "L5", ...(rl.l5 || {}) }] : [];
              const bt = pitcherBT(name);
              // Derive tier: prefer the table; fall back to the live rate.
              // The fallback has to be regressed first. `headline` is an observed
              // rate over as few as 6 starts, while the table's cutoffs are on the
              // regressed scale — comparing one to the other would hand a tier to
              // every small sample, which is exactly the error the table itself
              // was just rebuilt to remove. Same prior, same cutoffs, so an arm
              // without a row is judged on the same terms as one with it. Few
              // short samples will clear a band, and that is the honest outcome.
              const btPost  = bt ? bt.clean : pbtPosterior(headline, headlineN || 0);
              const btClean = btPost;
              const btN     = bt ? bt.n     : headlineN;
              const btSrc   = bt ? "backtest" : "model";
              const btTier  = bt ? bt.tier :
                btPost == null || (headlineN || 0) < 6 ? null :
                btPost >= PBT_ELITE  ? "elite" :
                btPost >= PBT_SHARP  ? "sharp" :
                btPost <= PBT_DANGER ? "danger" :
                btPost <= PBT_LEAKY  ? "leaky" : "avg";
              const TIER_STYLES = {
                elite:  { icon: "🔥", label: "ELITE 1ST INN", color: "var(--moss)",  bg: "rgba(80,200,120,0.1)",  border: "rgba(80,200,120,0.4)"  },
                sharp:  { icon: "✅", label: "SHARP",          color: "#8ecf8e",      bg: "rgba(80,180,80,0.08)",  border: "rgba(80,180,80,0.3)"   },
                leaky:  { icon: "⚠️", label: "LEAKY 1ST",      color: "var(--amber)", bg: "rgba(230,160,0,0.1)",   border: "rgba(230,160,0,0.4)"   },
                danger: { icon: "🩸", label: "BLEEDS EARLY",   color: "var(--rose)",  bg: "rgba(220,60,60,0.1)",   border: "rgba(220,60,60,0.4)"   },
                avg:    { icon: "📊", label: "AVERAGE",        color: "var(--dim)",   bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.12)" },
              };
              const btBadge = btTier ? TIER_STYLES[btTier] : null;
              const topLeak = (p.leaks || [])[0];
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
                        /* The tooltip used to read "kept the 1st inning scoreless
                           X% of the time", which is no longer what X is. These are
                           projections regressed to league mean, and the tier is a
                           rank against other starters rather than an absolute rate,
                           so the badge has to say which it is — a reader who thinks
                           67% is a raw rate would read DANGER as a much stronger
                           claim than the data supports. */
                        <div title={(btSrc === "backtest"
                          ? "Projected from " + PBT_GAMES + " MLB games (" + PBT_SEASONS + "): "
                          : "Live model estimate: ") + name + " projects to keep the 1st inning scoreless " +
                          btClean.toFixed(0) + "% of the time, from " + btN + " starts regressed to the league mean of " +
                          PBT_LG + "%. The tier is his rank among MLB starters, not an absolute rate."}
                          style={{ cursor: "help", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 5, padding: "2px 7px", background: btBadge.bg, border: "1px solid " + btBadge.border, borderRadius: 5, fontSize: 10, fontWeight: 700, color: btBadge.color }}>
                          {btBadge.icon} {btBadge.label} · {btClean.toFixed(0)}% proj
                        </div>
                      )}
                      {/* The leak behind the badge. A red flag with no reason attached
                          is just a number the user has to take on faith. The letter
                          grade counts as a red flag too: the badge reads L30 clean%
                          while the grade reads peripherals, so an arm can carry a D/F
                          under an AVERAGE badge and would otherwise go unexplained. */}
                      {(btTier === "danger" || btTier === "leaky" || p.grade === "D" || p.grade === "F") && topLeak && (
                        <div title={"Biggest drag on " + name + "'s first-inning grade: " + topLeak.detail + " (costs " + Math.abs(topLeak.cost) + " grade points)."} style={{ cursor: "help", fontSize: 10, color: btBadge ? btBadge.color : "var(--amber)", marginTop: 4, opacity: 0.95, lineHeight: 1.35 }}>
                          <b>Leak:</b> {topLeak.why} — <span style={{ color: "var(--dim)" }}>{topLeak.detail}</span>
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
                    <div className="pit-windows" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 3, marginBottom: 9 }}>
                      {windows.map((w) => (
                        <div key={w.label} title={{ SZN: "Full season clean 1st inning rate", L30: "Last 30 starts clean %", L10: "Last 10 starts clean % — recent form", L5: "Last 5 starts clean % — sharpest recent signal (noisy at small n)" }[w.label] + " — " + (w.pct != null ? w.pct + "% clean in " + w.n + " starts" + (w.runsPerStart != null ? ", avg " + w.runsPerStart.toFixed(2) + " runs allowed in 1st" : "") : "no data")} style={{ cursor: "help", textAlign: "center", background: w.label === "L5" ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)", borderRadius: 6, padding: "4px 0", border: w.label === "L5" ? "1px solid rgba(255,255,255,0.1)" : "none" }}>
                          <div style={{ fontSize: 9, color: "var(--dim)", marginBottom: 1 }}>{w.label}</div>
                          <div style={{ fontWeight: 700, fontSize: 12, color: w.pct != null ? pClr(w.pct) : "var(--dim)" }}>{w.pct != null ? w.pct + "%" : "—"}</div>
                          <div style={{ fontSize: 9, color: "var(--dim)", opacity: 0.7 }}>{w.n != null ? w.n + "g" : ""}{w.runsPerStart != null ? " · " + w.runsPerStart.toFixed(2) + "R" : ""}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {rl && rl.l10 && rl.szn && rl.l10.runsPerStart != null && rl.szn.runsPerStart != null && (rl.l10.n || 0) >= 5 && (() => {
                    const delta = rl.szn.runsPerStart - rl.l10.runsPerStart; // positive = fewer runs L10 (improving)
                    const deltaAbs = Math.abs(delta);
                    const improving = delta > 0;
                    const color = deltaAbs >= 0.15 ? (improving ? "var(--moss)" : "var(--rose)") : "var(--dim)";
                    return (
                      <div title={"Season avg " + rl.szn.runsPerStart.toFixed(2) + " runs/start in 1st. L10 avg " + rl.l10.runsPerStart.toFixed(2) + ". " + (deltaAbs >= 0.10 ? (improving ? "Allowing fewer runs recently — trending better." : "Allowing more runs recently — trending worse.") : "Run rate stable.")} style={{ cursor: "help", display: "flex", alignItems: "center", gap: 6, marginBottom: 7, fontSize: 9 }}>
                        <span style={{ color: "var(--dim)" }}>R/start:</span>
                        <span style={{ color, fontWeight: 700 }}>L10 {rl.l10.runsPerStart.toFixed(2)}</span>
                        <span style={{ color: "var(--dim)" }}>vs SZN {rl.szn.runsPerStart.toFixed(2)}</span>
                        {deltaAbs >= 0.10 && <span style={{ color, fontWeight: 800 }}>{improving ? "↓" : "↑"} {deltaAbs.toFixed(2)} {improving ? "improving" : "worsening"}</span>}
                      </div>
                    );
                  })()}
                  {rl && rl.streak && rl.streak.length > 0 && (
                    <div title={"Last " + rl.streak.length + " starts in order (oldest → newest). Green = clean first inning. Red = allowed a run."} style={{ cursor: "help", display: "flex", alignItems: "center", gap: 5, marginBottom: 9 }}>
                      <span style={{ fontSize: 9, color: "var(--dim)", fontWeight: 700, letterSpacing: "0.04em", marginRight: 2 }}>LAST {rl.streak.length}</span>
                      {rl.streak.map((clean, idx) => (
                        <span key={idx} title={clean ? "Clean start" : "Allowed a run"} style={{ width: 14, height: 14, borderRadius: "50%", background: clean ? "var(--moss)" : "var(--rose)", display: "inline-block", opacity: 0.4 + (idx / rl.streak.length) * 0.6, flexShrink: 0 }} />
                      ))}
                      {(() => {
                        const consec = [...rl.streak].reverse().findIndex((c) => c === !rl.streak[rl.streak.length - 1]);
                        const run = consec === -1 ? rl.streak.length : consec;
                        if (run < 3) return null;
                        const hot = rl.streak[rl.streak.length - 1] === true;
                        return <span style={{ fontSize: 9, fontWeight: 800, color: hot ? "var(--moss)" : "var(--rose)", marginLeft: 2 }}>{run} straight {hot ? "clean" : "dirty"}</span>;
                      })()}
                    </div>
                  )}
                  {rl && (rl.home || rl.road) && (() => {
                    const h = rl.home, r = rl.road;
                    if (!h && !r) return null;
                    const fmt = (s) => s ? s.pct + "% (" + s.n + "g)" : "—";
                    const hDelta = (h && rl.szn) ? h.pct - rl.szn.pct : null;
                    const rDelta = (r && rl.szn) ? r.pct - rl.szn.pct : null;
                    return (
                      <div style={{ display: "flex", gap: 8, marginBottom: 7, fontSize: 9 }}>
                        {h && <span title={"Home starts this season: " + fmt(h) + " clean 1st innings. SZN avg: " + (rl.szn ? rl.szn.pct + "%" : "—") + "."} style={{ cursor: "help", color: hDelta != null && Math.abs(hDelta) >= 10 ? (hDelta > 0 ? "var(--moss)" : "var(--rose)") : "var(--dim)" }}>HOME {fmt(h)}{hDelta != null && Math.abs(hDelta) >= 10 ? (hDelta > 0 ? " ↑" : " ↓") : ""}</span>}
                        {h && r && <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>}
                        {r && <span title={"Road starts this season: " + fmt(r) + " clean 1st innings. SZN avg: " + (rl.szn ? rl.szn.pct + "%" : "—") + "."} style={{ cursor: "help", color: rDelta != null && Math.abs(rDelta) >= 10 ? (rDelta > 0 ? "var(--moss)" : "var(--rose)") : "var(--dim)" }}>ROAD {fmt(r)}{rDelta != null && Math.abs(rDelta) >= 10 ? (rDelta > 0 ? " ↑" : " ↓") : ""}</span>}
                      </div>
                    );
                  })()}
                  {(p.sample || 0) < 5 && (
                    <div title={"Only " + (p.sample || 0) + " first-inning start" + ((p.sample || 0) === 1 ? "" : "s") + " on record. Stats below are from a tiny sample and should not be trusted — the model's pitch-skill signal is heavily regressed toward league average."} style={{ cursor: "help", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 7, padding: "2px 8px", background: "rgba(230,160,0,0.10)", border: "1px solid rgba(230,160,0,0.35)", borderRadius: 5, fontSize: 10, fontWeight: 700, color: "var(--amber)" }}>
                      ⚠ THIN DATA · {p.sample || 0} start{(p.sample || 0) === 1 ? "" : "s"}
                    </div>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {kbb != null && <span title={"K/9 minus BB/9 = " + kbb + (p.sample < 5 ? " — SMALL SAMPLE (" + p.sample + " starts), treat as noise" : ". Strikeouts minus walks per 9 innings. League avg ~5.3. Higher = more dominant.")} style={{ cursor: "help", fontSize: 11, color: "var(--dim)", background: "rgba(255,255,255,0.05)", borderRadius: 4, padding: "1px 6px", opacity: (p.sample || 0) < 5 ? 0.45 : 1 }}>K-BB {kbb}</span>}
                    {p.whip != null && <span title={"WHIP = " + p.whip.toFixed(2) + (p.sample < 5 ? " — SMALL SAMPLE (" + p.sample + " starts), treat as noise" : ". Walks + Hits per inning in the 1st. League avg ~1.28.")} style={{ cursor: "help", fontSize: 11, color: p.whip <= 1.10 ? "var(--moss)" : p.whip >= 1.50 ? "var(--rose)" : "var(--dim)", background: "rgba(255,255,255,0.05)", borderRadius: 4, padding: "1px 6px", opacity: (p.sample || 0) < 5 ? 0.45 : 1 }}>WHIP {p.whip.toFixed(2)}</span>}
                    {p.fstrike != null && <span title={"First-pitch strike rate = " + p.fstrike.toFixed(1) + "%. Gets ahead in counts early = harder to score. League avg ~60%."} style={{ cursor: "help", fontSize: 11, color: p.fstrike >= 64 ? "var(--moss)" : p.fstrike <= 56 ? "var(--rose)" : "var(--dim)", background: "rgba(255,255,255,0.05)", borderRadius: 4, padding: "1px 6px" }}>FPS {p.fstrike.toFixed(0)}%</span>}
                    {p.whiff != null && <span title={"Whiff rate = " + p.whiff.toFixed(1) + "%. Percentage of swings that completely miss. League avg ~24.5%."} style={{ cursor: "help", fontSize: 11, color: p.whiff >= 28 ? "var(--moss)" : p.whiff <= 20 ? "var(--rose)" : "var(--dim)", background: "rgba(255,255,255,0.05)", borderRadius: 4, padding: "1px 6px" }}>Whiff {p.whiff.toFixed(0)}%</span>}
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
              <span title={r.market.edge == null
                ? "No edge is quoted once a game is under way: the market is pricing the inning live while our number is still the pregame one, so the gap measures what the market already knows, not value."
                : "Edge = how much our model probability exceeds the market on our call side. " + (r.market.edge > 0 ? "Positive edge means we think the true probability is higher than what the market is paying." : "Negative edge means the market already prices this better than our model.") + " We only bet when edge is meaningfully positive."} style={{ cursor: "help", padding: "8px 12px", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ color: "var(--dim)", fontSize: 10, display: "block", marginBottom: 1 }}>EDGE</span>
                {r.market.edge == null
                  ? <span style={{ fontWeight: 700, color: "var(--dim)" }}>—</span>
                  : <span style={{ fontWeight: 700, color: r.market.edge >= 3 ? "var(--moss)" : r.market.edge <= -3 ? "var(--rose)" : "var(--dim)" }}>{r.market.edge > 0 ? "+" : ""}{r.market.edge.toFixed(0)}%</span>}
              </span>
              <span title={"Kalshi YES price = " + r.market.yesPrice.toFixed(0) + "¢. Buying YES means you think a run WILL score in the 1st. Buying NO (at " + (100 - r.market.yesPrice).toFixed(0) + "¢) means you think no run scores = NRFI."} style={{ cursor: "help", padding: "8px 12px", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ color: "var(--dim)", fontSize: 10, display: "block", marginBottom: 1 }}>KALSHI YES</span>
                <span style={{ fontWeight: 700, color: "var(--bone)" }}>{r.market.yesPrice.toFixed(0)}¢</span>
              </span>
              {r.kelly != null && (() => {
                const _rCfg = { ghost:{mult:0.10,maxPct:0.02}, conservative:{mult:0.25,maxPct:0.06}, moderate:{mult:0.50,maxPct:0.12}, standard:{mult:0.75,maxPct:0.18}, aggressive:{mult:1.00,maxPct:0.25}, turbo:{mult:1.50,maxPct:0.35}, xtreme:{mult:2.00,maxPct:0.50}, degen:{mult:3.00,maxPct:0.65}, yolo:{mult:5.00,maxPct:0.80} };
                const _rc = _rCfg[riskLevel] || _rCfg.moderate;
                const confMult = r.confidence != null ? Math.max(0.30, r.confidence) : 1;
                const sized = Math.min(r.kelly * _rc.mult * confMult, _rc.maxPct);
                const betPct = (sized * 100).toFixed(1);
                const betAmt = bankroll ? Math.round(bankroll * sized * 100) / 100 : null;
                const confNote = confMult < 0.95 ? " (confidence adj ×" + confMult.toFixed(2) + ")" : "";
                return (
                  <span title={"Suggested bet size at " + riskLevel + " risk: " + betPct + "% of bankroll" + (betAmt ? " = $" + betAmt : "") + ". Kelly-sized to your edge, capped at " + (_rc.maxPct * 100).toFixed(0) + "% max per bet." + confNote} style={{ cursor: "help", padding: "8px 12px" }}>
                    <span style={{ color: "var(--dim)", fontSize: 10, display: "block", marginBottom: 1 }}>BET SIZE</span>
                    <span style={{ fontWeight: 800, color: "var(--moss)" }}>{betAmt ? "$" + betAmt : betPct + "%"}</span>
                  </span>
                );
              })()}
            </>
          )}
          {r.method === "sim" && <span title="Probabilities calculated via base-out Markov simulation — models each batter's actual PA rates vs this pitcher's allow rates across all possible 1st-inning scenarios." style={{ cursor: "help", padding: "8px 8px", display: "flex", alignItems: "center" }}><span style={{ fontSize: 9, color: "var(--dim)", border: "1px solid rgba(120,130,150,.3)", borderRadius: 3, padding: "1px 4px" }}>SIM</span></span>}
          {r.confidence != null && r.confidence < 0.75 && (() => {
            const pct = Math.round(r.confidence * 100);
            const col = r.confidence < 0.50 ? "var(--rose)" : "var(--amber)";
            const scalePct = Math.round(Math.max(0.30, r.confidence) * 100);
            return <span title={"Data confidence: " + pct + "% — model inputs are partially missing (thin pitcher sample, no lineups posted, or limited rolling data). Kelly bet size is scaled to " + scalePct + "% of normal."} style={{ cursor: "help", padding: "8px 8px", display: "flex", alignItems: "center" }}><span style={{ fontSize: 9, color: col, border: "1px solid " + col, borderRadius: 3, padding: "1px 4px", opacity: 0.8 }}>{"CONF " + pct + "%"}</span></span>;
          })()}
        </div>

        {/* ── 1st-inn offense + badges row ── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 10 }}>
          {/* The 1ST-INN pill that used to live here now renders as DSTeamRates,
              directly under the dual-score bar. Same reading, same L10-vs-prior trend
              logic; only the position changed. The two starters and the two offences
              are the four inputs to a first-inning bet and three of them were above
              the fold while the fourth was down here among the badges. */}
          {!r.lineupPosted && (
            <span title="Official starting lineups haven't been posted yet. The model is using projected batting orders, which are less accurate than the real lineup. Check back closer to game time." style={{ cursor: "help", display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", background: "rgba(230,160,0,0.1)", border: "1px solid rgba(230,160,0,0.4)", borderRadius: 20, fontSize: 11, fontWeight: 700, color: "var(--amber)" }}>⚠ LINEUPS PENDING</span>
          )}
          {!r.lineupPosted && r.pNRFI_simProj != null && (() => {
            const calProj = applyCalibration(r.pNRFI_simProj, calib);
            const blendProj = r.market ? nrfiBlend(calProj, r.market.marketNRFI) : calProj;
            const projPct = Math.max(blendProj, 1 - blendProj) * 100;
            const projCall = blendProj >= 0.5 ? "NRFI" : "YRFI";
            const diff = projPct - r.pMax;
            const arrow = Math.abs(diff) < 1 ? "" : diff > 0 ? " ↑" : " ↓";
            return (
              <span title={"Sim projection: if the lineup were the top active-roster batters vs this starter, model says " + projCall + " " + projPct.toFixed(0) + "%. Actual may shift once real lineups post. Δ " + (diff > 0 ? "+" : "") + diff.toFixed(0) + "pp vs λ-model."} style={{ cursor: "help", display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", background: "rgba(120,130,150,0.08)", border: "1px solid rgba(120,130,150,0.25)", borderRadius: 20, fontSize: 11, fontWeight: 700, color: "var(--dim)" }}>
                SIM PROJ {projCall} {projPct.toFixed(0)}%{arrow}
              </span>
            );
          })()}
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
          {(r.tails || []).map((t, i) => {
            const rec = t.record;
            const recStr = rec && rec.sample >= 5
              ? rec.wins + "W-" + rec.losses + "L" + (rec.sample > 0 ? " (" + Math.round(rec.wins / Math.max(rec.sample - rec.pushes, 1) * 100) + "%)" : "")
              : null;
            const agrees = t.pick.side === r.call;
            const tipDetail = (recStr ? " Season record: " + recStr + " NRFI." : "") + (agrees ? " Agrees with desk model." : " Disagrees with desk model — use caution.");
            return (
              <span key={i} title={t.name + " → " + t.pick.side + "." + tipDetail} style={{ cursor: "help", display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", border: "1px solid " + (agrees ? "rgba(127,185,139,0.5)" : "rgba(230,160,0,0.5)"), borderRadius: 20, fontSize: 11, fontWeight: 600, color: agrees ? "var(--moss)" : "var(--amber)" }}>
                <span>{t.name}: {t.pick.side} {agrees ? "✓" : "⚠"}</span>
                {recStr && <span style={{ fontSize: 9, opacity: 0.7 }}>{recStr}</span>}
              </span>
            );
          })}
          {/* A seller pick on a game the desk isn't betting used to sit in its own
              band at the top of the board, which read as a recommendation while the
              model's actual verdict was never shown. Keep the pick visible, but say
              plainly that the desk disagrees and why. */}
          {(r.tails || []).length > 0 && !r.v.isBet && (
            <div style={{ width: "100%", marginTop: 6, padding: "8px 11px", borderRadius: 8, background: "rgba(230,160,0,0.07)", border: "1px solid rgba(230,160,0,0.28)", fontSize: 11, color: "var(--dim)", lineHeight: 1.5 }}>
              <b style={{ color: "var(--amber)" }}>{(r.tails || []).map((t) => t.name).join(" & ")} {(r.tails || []).length > 1 ? "have" : "has"} this — the desk does not.</b>
              {" "}Model says <b style={{ color: "var(--fg)" }}>{r.v.strength === "LEAN" ? "LEAN " + r.call : "PASS"}</b> at {r.pMax.toFixed(0)}%
              {r.market && r.market.edgeRaw != null ? ", " + (r.market.edgeRaw >= 0 ? "+" : "") + r.market.edgeRaw.toFixed(1) + "pp vs market" : ""}.
              {" "}Their pick is not a desk bet — size it as a tail, not a signal.
            </div>
          )}
          {graded && gradedWon !== null && recE && recE.strength !== "PASS" && !recE.thinPass && (recE.mktAtPick != null || recE.isBet === true) && (() => {
            const won = gradedWon;
            const clv = recE && recE.mktAtPick != null && recE.mktAtClose != null ? recE.mktAtClose - recE.mktAtPick : null;
            return (
              <div style={{ width: "100%", marginTop: 6, padding: "12px 14px", borderRadius: 10, background: won ? "rgba(80,160,80,0.10)" : "rgba(220,60,60,0.10)", border: "1px solid " + (won ? "rgba(80,160,80,0.4)" : "rgba(220,60,60,0.4)") }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 28, lineHeight: 1 }}>{won ? vg.e : (gradedCall === "NRFI" ? "🩸" : "🤡")}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: 15, color: won ? "var(--moss)" : "var(--rose)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                      {won ? (gradedCall === "NRFI" ? "OFFENSE FLATLINED" : "BEAUTIFUL DISASTER") : (gradedCall === "NRFI" ? "PITCHER GOT MURKED" : "STAYED SCORELESS (SOMEHOW)")}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>
                      {r.inning1runs === 0 ? "Zero runs. Zero mercy. Zero survivors." : r.inning1runs + " run" + (r.inning1runs === 1 ? " crossed the plate." : "s crossed the plate.")}
                      {" · " + (won ? "We called it." : "We didn't.")}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {/* The glyph tracks whether the logged pick won, not which
                        side landed — a ✓ beside the outcome read as a win even
                        when we had called the other side. */}
                    <div style={{ fontSize: 20, fontWeight: 900, color: won ? "var(--moss)" : "var(--rose)" }}>{(won ? "✓ " : "✗ ") + (r.inning1runs === 0 ? "NRFI" : "YRFI")}</div>
                    <div style={{ fontSize: 10, color: "var(--dim)", marginTop: 1 }}>called {gradedCall}</div>
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
          <button className="btn btn-ghost btn-sm" onClick={() => dismissGame(r.gamePk)} title="Remove this game from the board and record tracking" style={{ color: "var(--dim)", fontSize: 11 }}>Skip ✕</button>
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
            {/* Where each starter leaks. Deliberately NOT a check: these are the
                grade's own components, so voting them would count the pitcher
                twice — once through the twelve pitching checks and again here.
                This is transparency on a number already in the model. */}
            {r.pitProfiles && (() => {
              const sides = [
                { name: r.awayPP, p: r.pitProfiles.away },
                { name: r.homePP, p: r.pitProfiles.home },
              ].filter((s) => s.p && (s.p.leaks || []).length);
              if (!sides.length) return null;
              return (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.1em", marginBottom: 6 }}>WHERE THE STARTERS LEAK</div>
                  {sides.map((s, si) => (
                    <div key={si} style={{ padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 12 }}>
                      <span style={{ fontWeight: 600 }}>{s.name}</span>
                      <span style={{ color: "var(--dim)", fontSize: 10, marginLeft: 6 }}>· grade {s.p.grade}</span>
                      {s.p.leaks.slice(0, 3).map((lk, li) => (
                        <div key={li} style={{ display: "flex", gap: 8, alignItems: "baseline", marginTop: 3 }}>
                          <span style={{ color: "var(--rose)", fontSize: 10, fontWeight: 800, minWidth: 34, flexShrink: 0 }}>{lk.cost}</span>
                          <span style={{ fontSize: 11 }}>
                            {lk.why} <span style={{ color: "var(--dim)" }}>— {lk.detail}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                  <div style={{ fontSize: 10, color: "var(--dim)", marginTop: 6, lineHeight: 1.4 }}>
                    Numbers are grade points lost off a 50-point average, from the same
                    weights that produced each starter's letter grade.
                  </div>
                </div>
              );
            })()}
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
        pass — starting pitching (1st-inning splits), pitcher skill (1st-inn K%, Statcast whiff, control),
        both teams' 1st-inning offense, leadoff-weighted lineups (also catches
        scratches), travel &amp; rest, and weather/park. The de-vig Kalshi market is the PRIOR —
        "our number" is market-anchored with the model as the tiebreaker; we bet only when the model clears the market
        by a real margin, and track closing-line value (CLV), the honest edge test. Graded against the real 1st-inning score.
      </p>
      {/* ── Analytics grid ── */}
      <div className="nrfi-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, margin: "10px 0 6px" }}>
        {/* All model picks */}
        {(() => {
          const tot = wins + losses; const pct = tot > 0 ? Math.round(wins / tot * 100) : null;
          const color = pct == null ? "var(--dim)" : pct >= 55 ? "var(--moss)" : pct >= 45 ? "var(--bone)" : "var(--rose)";
          return (
            <div title="All model picks where a Kalshi market was available (LEAN + BET + STRONG). Excludes no-market games and PASS entries." style={{ cursor: "help", background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.08em", marginBottom: 5 }}>ALL PICKS</div>
              <div style={{ fontSize: 17, fontWeight: 800, color }}>{tot > 0 ? wins + "W / " + losses + "L" : "—"}</div>
              {pct != null && <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>{pct}% · {tot} graded</div>}
            </div>
          );
        })()}
        {/* BET / STRONG signals */}
        {(() => {
          const tot = betWins + betLosses; const pct = tot > 0 ? Math.round(betWins / tot * 100) : null;
          const color = pct == null ? "var(--dim)" : pct >= 55 ? "var(--moss)" : pct >= 45 ? "var(--bone)" : "var(--rose)";
          const partTxt = betSignalCount > 0 ? participatedCount + " of " + betSignalCount + " taken" : null;
          const sTot = strongWins2 + strongLosses2; const sPct = sTot > 0 ? Math.round(strongWins2 / sTot * 100) : null;
          const bTot = pureBetWins + pureBetLosses; const bPct = bTot > 0 ? Math.round(pureBetWins / bTot * 100) : null;
          return (
            <div title={"BET and STRONG quality picks (model prob ≥ " + NRFI_BET_MIN + "%). STRONG = cal ≥ " + NRFI_STRONG_MIN + "%, BET = cal " + NRFI_BET_MIN + "–" + (NRFI_STRONG_MIN - 1) + "%." + (partTxt ? " Participation: " + partTxt + " (matched to your Kalshi imports by date + call direction)." : "")} style={{ cursor: "help", background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.08em", marginBottom: 5 }}>BET SIGNALS</div>
              <div style={{ fontSize: 17, fontWeight: 800, color }}>{tot > 0 ? betWins + "W / " + betLosses + "L" : "—"}</div>
              {pct != null && <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>{pct}%{partTxt ? " · " + partTxt : ""}</div>}
              {(sTot > 0 || bTot > 0) && (
                <div style={{ display: "flex", gap: 8, marginTop: 5 }}>
                  {sTot > 0 && <span style={{ fontSize: 10, color: sPct >= 58 ? "var(--moss)" : sPct >= 45 ? "var(--dim)" : "var(--rose)" }} title={"STRONG (cal ≥63%): " + strongWins2 + "W/" + strongLosses2 + "L"}>STRONG {sPct}%</span>}
                  {bTot > 0 && <span style={{ fontSize: 10, color: bPct >= 55 ? "var(--moss)" : bPct >= 45 ? "var(--dim)" : "var(--rose)" }} title={"BET (cal " + NRFI_BET_MIN + "–" + (NRFI_STRONG_MIN - 1) + "%): " + pureBetWins + "W/" + pureBetLosses + "L"}>BET {bPct}%</span>}
                </div>
              )}
              {tot === 0 && betSignalCount > 0 && <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>{betSignalCount} signal{betSignalCount !== 1 ? "s" : ""} · none settled</div>}
            </div>
          );
        })()}
        {/* LEAN picks */}
        {(() => {
          const tot = leanWins + leanLosses; const pct = tot > 0 ? Math.round(leanWins / tot * 100) : null;
          const color = pct == null ? "var(--dim)" : pct >= 55 ? "var(--moss)" : pct >= 45 ? "var(--bone)" : "var(--rose)";
          return (
            <div title="LEAN picks only (model prob 57–62%). Lower conviction — track separately to see if they add value over BET-only." style={{ cursor: "help", background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.08em", marginBottom: 5 }}>LEAN PICKS</div>
              <div style={{ fontSize: 17, fontWeight: 800, color }}>{tot > 0 ? leanWins + "W / " + leanLosses + "L" : "—"}</div>
              {pct != null && <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>{pct}% · {tot} graded</div>}
              {tot === 0 && <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>none graded yet</div>}
            </div>
          );
        })()}
        {/* Kalshi bets */}
        {(() => {
          const tot = kWins + kLosses; const pct = tot > 0 ? Math.round(kWins / tot * 100) : null;
          const color = pct == null ? "var(--dim)" : pct >= 55 ? "var(--moss)" : pct >= 45 ? "var(--bone)" : "var(--rose)";
          return (
            <div title={"Your actual Kalshi bets imported from your account. This is your real financial record — " + (avgCLV != null ? "avg CLV " + (avgCLV > 0 ? "+" : "") + avgCLV.toFixed(1) + "% across " + clvSet.length + " settled bets." : "CLV tracked as bets settle.")} style={{ cursor: "help", background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.08em", marginBottom: 5 }}>YOUR KALSHI</div>
              <div style={{ fontSize: 17, fontWeight: 800, color }}>{tot > 0 ? kWins + "W / " + kLosses + "L" : "—"}</div>
              {pct != null && <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>{pct}%{avgCLV != null ? " · CLV " + (avgCLV > 0 ? "+" : "") + avgCLV.toFixed(1) + "%" : ""}</div>}
              {tot === 0 && <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>import to track</div>}
            </div>
          );
        })()}
      </div>
      {/* ── Controls / meta row ── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 4 }}>
        {sellers.map((s) => (
          <span key={s.id} style={{ fontSize: 12, color: s.active ? "var(--dim)" : "var(--amber)" }}
            title={s.record ? "Last " + (s.record.sample || 0) + " settled straight first-inning legs (Under/Over 0.5 only, parlays excluded)"
              + ", from " + (s.record.pages || 1) + " pages of the settled feed. Not a lifetime record." : undefined}>
            {s.active ? (s.record ? s.name + ": " + s.record.wins + "-" + s.record.losses
              + (s.record.sample ? " (" + Math.round(s.record.wins / Math.max(1, s.record.wins + s.record.losses) * 100) + "%)" : "")
              : s.name + ": active") : s.name + ": paused"}
          </span>
        ))}
        <span style={{ fontSize: 12, color: "var(--dim)" }}>{"Calibrated: backtest (" + NRFI_CALIB_SEED.n + "g) · +" + liveCalib.n + " live"}</span>
        <button className="btn btn-ghost btn-sm" onClick={() => { loadTails(); run(); }} disabled={phase === "scanning"}>{phase === "scanning" ? "Researching…" : "↻ Refresh"}</button>
        {lastRefreshed && phase === "done" && (() => {
          const secsAgo = Math.floor((now - lastRefreshed.getTime()) / 1000);
          const nextIn = Math.max(0, AUTO_REFRESH_MS / 1000 - secsAgo);
          const fmt = (s) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
          return (
            <span style={{ fontSize: 11, color: "var(--dim)", fontVariantNumeric: "tabular-nums" }} title="Model auto-refreshes every 2 minutes">
              Updated {secsAgo < 60 ? secsAgo + "s ago" : Math.floor(secsAgo / 60) + "m ago"} · next in {fmt(nextIn)}
            </span>
          );
        })()}
        <button className="btn btn-ghost btn-sm" onClick={importKalshiBets} disabled={importing} title="Pull your closed NRFI/YRFI bets from Kalshi">{importing ? "Importing…" : "Import Kalshi bets"}</button>
        {typeof window !== "undefined" && window.speechSynthesis && (
          <button className="btn btn-ghost btn-sm"
            onClick={() => {
              const next = !callout;
              // Speaking on the click itself is what unlocks audio — browsers gate
              // speech synthesis behind a user gesture, and the first real callout
              // can land an hour later with no gesture anywhere near it.
              // Spelled out: "NRFI" as a word comes back from every synthesiser
              // as "nerfy". The settle lines already say it this way.
              if (next) speak("Digital Demons N-R-F-I Live. On the air.");
              else speakStop();
              setCallout(next);
            }}
            title={voiceBlocked
              ? "Your browser blocked audio for this page. Tap this button again to allow it — " +
                "speech has to start from a tap, and the desk will stay silent until it does."
              : "Digital Demons NRFI Live — the desk's own first-inning broadcast. Calls every game on the board " +
                "that has a call or a position, pitch by pitch, then the NRFI result. " +
                "Built off the MLB play feed, not a broadcast: league game audio is licensed per-subscriber and cannot be embedded here."}
            style={voiceBlocked && callout ? { color: "var(--rust, #c0632f)", borderColor: "var(--rust, #c0632f)" }
              : callout ? { color: "var(--moss)", borderColor: "var(--moss)" } : undefined}>
            {/* Silence with the button lit is indistinguishable from a quiet
                inning, so the blocked state has to say so in the label itself —
                a tooltip nobody hovers on a phone does not count as surfacing. */}
            {voiceBlocked && callout ? "🔇 Blocked by browser · tap to allow"
              : callout ? "🔊 Digital Demons NRFI Live · on" : "🔈 Digital Demons NRFI Live"}
          </button>
        )}
        {/* Game picker. Only worth showing once games actually overlap — with one
            game in the 1st there is nothing to choose between, and the row would
            just be chrome. */}
        {callout && calloutGames.length > 1 && (
          <span style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "var(--dim)" }}>Listening to</span>
            {[{ pk: null, label: "All" }].concat(calloutGames.map((r) => ({
              pk: r.gamePk, label: (r.awayAbbr || r.away) + "@" + (r.homeAbbr || r.home),
            }))).map((g) => (
              <button key={String(g.pk)} className="btn btn-ghost btn-sm"
                onClick={() => setFocus(g.pk)}
                title={g.pk === null
                  ? "Call every game at once. On an overlapping slate they talk over each other."
                  : "Call only this game. Others stay muted, but a run or a clean inning is still announced by name."}
                style={{ fontSize: 11, padding: "2px 7px", ...(focus === g.pk
                  ? { color: "var(--moss)", borderColor: "var(--moss)" } : null) }}>
                {g.label}
              </button>
            ))}
          </span>
        )}
        {importMsg && <span style={{ fontSize: 12, color: importMsg.ok ? "var(--moss)" : "var(--rose)" }}>{importMsg.text}</span>}
      </div>
      {/* ── Dual Score tiers ──
          The three cutoffs are the only hand-set numbers on the DS card, and they
          are NOT equally well known — elite is bracketed to half a point, green to
          four, red not at all. The control says which is which, because a number
          you can edit reads as a number someone measured unless it tells you
          otherwise. Live counts sit next to the inputs so moving a cutoff shows
          its consequence on today's slate rather than on a remembered one. */}
      {(() => {
        const counts = { ELITE: 0, GREEN: 0, YELLOW: 0, RED: 0, "NO DS": 0 };
        for (const r of validRows) counts[dsTier(dsOf(r), dsTh).label]++;
        const isDefault = dsTh.elite === DS_TIER_DEFAULTS.elite &&
          dsTh.green === DS_TIER_DEFAULTS.green && dsTh.yellow === DS_TIER_DEFAULTS.yellow;
        /* Clamp on commit, not on keystroke, and clamp against BOTH neighbours:
         * the bands have to stay ordered elite > green > yellow or one of them
         * collapses to nothing and every card on the slate jumps two tiers at
         * once. Each setter pins the other two and moves only its own edge. */
        const setElite = (v) => saveDsTh({ ...dsTh, elite: Math.min(99, Math.max(dsTh.green + 0.5, v)) });
        const setGreen = (v) => saveDsTh({ ...dsTh, green: Math.max(dsTh.yellow + 0.5, Math.min(dsTh.elite - 0.5, v)) });
        const setYellow = (v) => saveDsTh({ ...dsTh, yellow: Math.max(5, Math.min(dsTh.green - 0.5, v)) });
        const num = (label, val, onSet, color, title) => (
          <span style={{ display: "flex", alignItems: "center", gap: 5 }} title={title}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color }}>{label}</span>
            <input type="number" step="0.5" min="5" max="95" defaultValue={val} key={label + val}
              onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onSet(v); }}
              onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
              style={{ width: 58, fontSize: 12, padding: "2px 5px", background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)", borderRadius: 5, color: "var(--bone)",
                fontVariantNumeric: "tabular-nums" }} />
          </span>
        );
        return (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center",
            margin: "0 0 8px", padding: "7px 10px", background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--dim)" }}>DUAL SCORE TIERS</span>
            {num("ELITE ≥", dsTh.elite, setElite, "var(--cyan)",
              "Top 4.5% of the slate; 69.0% NRFI on 58 cached games. NOT his 68 — his DS is a 0-100 rating, ours is a calibrated probability that maxed at 67.2 over 1283 games, so his cutoff would fire zero times ever. This is set where OUR distribution is as selective as he is. He drops to ELITE-only on a thin board (\"Tough board today. Only playing MIL@LAD\").")}
            {num("GREEN ≥", dsTh.green, setGreen, "var(--moss)",
              "GREEN-or-better is 19.4% of the slate, matching his real 19.0% play rate (2.59 of 13.6 games a day). The band itself hits 56.0% on 191 cached games. This is a selectivity anchor, not a reading of his number — see scripts/nrfi-ds-tier-brackets.js for his own cutoffs on his own scale.")}
            {num("YELLOW ≥", dsTh.yellow, setYellow, "var(--amber)",
              "Roughly our median p (54.2). Splits the half of the slate we are lukewarm on from the half we are against: yellow band 51.8%, red band 45.3%, base rate 50.0%. The weakest of the three cuts — nothing he publishes is ever red, so his behaviour cannot anchor it.")}
            <span style={{ fontSize: 11, color: "var(--dim)", fontVariantNumeric: "tabular-nums" }}
              title="How today's board splits at the cutoffs above. Held games and settled games are not counted — they are not decisions.">
              today: <span style={{ color: "var(--cyan)" }}>{counts.ELITE} elite</span>
              {" · "}<span style={{ color: "var(--moss)" }}>{counts.GREEN} green</span>
              {" · "}<span style={{ color: "var(--amber)" }}>{counts.YELLOW} yellow</span>
              {" · "}<span style={{ color: "var(--rose)" }}>{counts.RED} red</span>
              {counts["NO DS"] > 0 ? " · " + counts["NO DS"] + " no DS" : ""}
            </span>
            {!isDefault && (
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "2px 7px" }}
                onClick={() => saveDsTh({ ...DS_TIER_DEFAULTS })}
                title={"Back to " + DS_TIER_DEFAULTS.elite + " / " + DS_TIER_DEFAULTS.green +
                  " / " + DS_TIER_DEFAULTS.yellow}>Reset</button>
            )}
            <span style={{ fontSize: 10, color: "var(--dim)" }}
              title="The badge is a threshold on the DS level. It is NOT the edge over the break-even price — his DS 60.0 against BE 51.5% is an +8.5pt edge and still YELLOW, while DS 64.7 at +5.2 is GREEN. The board's #N badge is what carries the edge ordering.">
              badge = DS level, not edge
            </span>
          </div>
        );
      })()}
      {/* Bankroll builder */}
      {(() => {
        const RISK_CFG = {
          ghost:        { mult: 0.10, maxPct: 0.02, label: "Ghost",        drawdownEst: "2–4%",    desc: "1/10 Kelly — minimal variance, use while learning." },
          conservative: { mult: 0.25, maxPct: 0.06, label: "Conservative", drawdownEst: "5–12%",   desc: "1/4 Kelly — proven, sustainable long-term." },
          moderate:     { mult: 0.50, maxPct: 0.12, label: "Moderate",     drawdownEst: "10–22%",  desc: "1/2 Kelly — industry standard, recommended." },
          standard:     { mult: 0.75, maxPct: 0.18, label: "Standard",     drawdownEst: "15–30%",  desc: "3/4 Kelly — for experienced bettors." },
          aggressive:   { mult: 1.00, maxPct: 0.25, label: "Aggressive",   drawdownEst: "20–40%",  desc: "Full Kelly — maximum theoretical growth rate." },
          turbo:        { mult: 1.50, maxPct: 0.35, label: "Turbo",        drawdownEst: "35–60%",  desc: "1.5× Kelly — over-Kelly, elite slates only." },
          xtreme:       { mult: 2.00, maxPct: 0.50, label: "Xtreme",       drawdownEst: "50–80%",  desc: "2× Kelly — high variance, strong edge required." },
          degen:        { mult: 3.00, maxPct: 0.65, label: "Degen",        drawdownEst: "70–95%",  desc: "3× Kelly — ruin risk is significant." },
          yolo:         { mult: 5.00, maxPct: 0.80, label: "YOLO",         drawdownEst: "90–99%",  desc: "5× Kelly — max over-bet, expect large swings." },
        };
        const SPEED_CFG = {
          patient:  { minProb: 63, evMult: 0.45, betsRec: "1–2",  label: "Patient",   desc: "STRONG picks only (≥63%)" },
          selective:{ minProb: 57, evMult: 0.70, betsRec: "2–4",  label: "Selective", desc: "BET + STRONG (≥57%)" },
          steady:   { minProb: 52, evMult: 1.00, betsRec: "3–6",  label: "Steady",    desc: "All rated picks (≥52%)" },
          fast:     { minProb: 57, evMult: 1.20, betsRec: "4–8",  label: "Fast",      desc: "All picks, maximize volume" },
          blitz:    { minProb: 50, evMult: 1.45, betsRec: "all",  label: "Blitz",     desc: "Every game on slate" },
        };
        const rCfg = RISK_CFG[riskLevel] || RISK_CFG.moderate;
        const sCfg = SPEED_CFG[growthSpeed] || SPEED_CFG.steady;
        const riskMult = rCfg.mult;

        // P&L from settled Kalshi imports — informational context only
        const gradedHistory = (rec || []).filter((r) => (r.result === "won" || r.result === "lost") && r.contracts > 0 && r.mktAtPick != null && r.mktAtPick > 0);
        const historyPL = gradedHistory.reduce((s, r) => {
          const pricePerContract = Math.min(99, Math.max(1, r.mktAtPick)) / 100;
          const cost = r.contracts * pricePerContract;
          return s + (r.result === "won" ? r.contracts * (1 - pricePerContract) : -cost);
        }, 0);
        const histWins = gradedHistory.filter((r) => r.result === "won").length;
        const histWinRate = gradedHistory.length >= 5 ? histWins / gradedHistory.length : null;

        // Speed-filtered bet rows
        const openTickerSet = new Set((openPositions && !openPositions.error ? openPositions.positions : []).map((p) => p.ticker));
        const speedMinProb = sCfg.minProb / 100;
        const allBetRows = enriched
          .filter((r) => r.v && r.v.isBet && r.kelly != null && r.call === "NRFI" && r.pFinal >= speedMinProb)
          .slice().sort((a, b) => (b.market ? b.market.edge : 0) - (a.market ? a.market.edge : 0));
        const alreadyHeld = allBetRows.filter((r) => r.market && openTickerSet.has(r.market.ticker));
        const betRows = allBetRows.filter((r) => !r.market || !openTickerSet.has(r.market.ticker));
        const remaining = (bankroll && amountOut != null) ? Math.max(0, bankroll - amountOut) : bankroll;

        // Per-bet cap applied before total-allocation scale
        const rawKellys = betRows.map((r) => Math.min(r.kelly * riskMult, rCfg.maxPct));
        const rawTotalBetPct = rawKellys.reduce((s, k) => s + k, 0);
        const allocationScale = rawTotalBetPct > 1 ? 1 / rawTotalBetPct : 1;
        const totalBetPct = rawTotalBetPct * allocationScale;
        const totalBetAmt = remaining ? remaining * totalBetPct : null;
        const avgEdgePct = betRows.length > 0 ? betRows.reduce((s, r) => s + (r.market ? r.market.edge : 0), 0) / betRows.length : 0;

        // Daily EV using capped kelly sizes
        const dailyEvPct = betRows.reduce((s, r, i) => {
          if (!r.kelly || !r.market) return s;
          const betPct = rawKellys[i] * allocationScale;
          const winProb = r.call === "NRFI" ? r.pFinal : 1 - r.pFinal;
          const odds = r.call === "NRFI" ? r.market.yesPrice / (100 - r.market.yesPrice) : (100 - r.market.yesPrice) / r.market.yesPrice;
          return s + betPct * (winProb * odds - (1 - winProb));
        }, 0);
        const effectiveDailyEv = dailyEvPct * sCfg.evMult;
        // Calibrate by historical win rate if enough data
        const calibration = histWinRate != null ? Math.max(0.5, Math.min(1.5, histWinRate / 0.58)) : 1.0;
        const calibratedEv = effectiveDailyEv * calibration;

        // Compound growth goal planner — 3 scenarios
        let goalScenarios = null;
        if (profitGoal && bankroll && calibratedEv > 0) {
          const base = remaining || bankroll;
          const calcDays = (evRate) => evRate > 0 ? Math.ceil(Math.log(1 + profitGoal / base) / Math.log(1 + evRate)) : null;
          goalScenarios = {
            pessimistic: calcDays(calibratedEv * 0.60),
            base:        calcDays(calibratedEv),
            optimistic:  calcDays(calibratedEv * 1.40),
          };
        }

        // AI insights
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
          aiInsights.push({ type: "warn", text: streak + " consecutive losses. Recommend dropping to Conservative until the streak breaks." });
        }
        if (betRows.length > 0 && avgEdgePct >= 6) {
          aiInsights.push({ type: "good", text: "Strong edge today (avg +" + avgEdgePct.toFixed(1) + "%). Good slate to press at current sizing." });
        } else if (betRows.length > 0 && avgEdgePct < 2) {
          aiInsights.push({ type: "warn", text: "Thin edge today (avg +" + avgEdgePct.toFixed(1) + "%). Consider sizing down or skipping marginal games." });
        }
        if (gradedHistory.length > 0 && Math.abs(historyPL) >= 1) {
          aiInsights.push({ type: historyPL >= 0 ? "good" : "warn",
            text: "Kalshi history: " + (historyPL >= 0 ? "+" : "") + "$" + historyPL.toFixed(2) + " P&L across " + gradedHistory.length + " settled bet" + (gradedHistory.length === 1 ? "" : "s") + "." });
        }
        if (remaining != null && remaining <= 0 && bankroll) {
          aiInsights.push({ type: "warn", text: "No remaining balance. Wait for open positions to settle before placing more bets." });
        }
        if (histWinRate != null && calibration < 0.85) {
          aiInsights.push({ type: "warn", text: "Historical win rate (" + (histWinRate * 100).toFixed(0) + "%) is below model baseline — projections adjusted down." });
        } else if (histWinRate != null && calibration > 1.15) {
          aiInsights.push({ type: "good", text: "Historical win rate (" + (histWinRate * 100).toFixed(0) + "%) beats baseline — projections adjusted up." });
        }

        return (
          <div style={{ margin: "6px 0 2px", padding: "14px 16px", background: "rgba(80,160,80,0.05)", borderRadius: 10, border: "1px solid rgba(80,160,80,0.2)" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--moss)" }}>Bankroll Builder</span>
              <span style={{ fontSize: 11, color: "var(--dim)" }}>— bet sizing, risk management, and growth planning</span>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {gradedHistory.length > 0 && (
                  <span title={"Tracked P&L from " + gradedHistory.length + " settled Kalshi bet" + (gradedHistory.length === 1 ? "" : "s") + ". Informational — your bankroll is whatever you enter below."} style={{ cursor: "help", fontSize: 12, color: historyPL >= 0 ? "var(--moss)" : "var(--rose)", fontWeight: 700 }}>
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
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.08em" }}>BANKROLL</span>
                <div style={{ display: "flex", alignItems: "center", background: "var(--bg)", border: "1px solid rgba(120,130,150,.4)", borderRadius: 6, overflow: "hidden" }}>
                  <span style={{ padding: "0 8px", color: "var(--dim)", fontWeight: 700, borderRight: "1px solid rgba(120,130,150,.3)", lineHeight: "34px" }}>$</span>
                  <input type="number" min="0" placeholder="3000" value={bankroll || ""} onChange={(e) => { const v = Number(e.target.value) || null; setBankroll(v); saveBankrollSettings({ startingBankroll: v, riskLevel, growthSpeed }); }}
                    style={{ width: 80, fontSize: 14, padding: "6px 8px", background: "transparent", border: "none", color: "var(--fg)", fontWeight: 700, outline: "none" }} />
                </div>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.08em" }}>RISK LEVEL</span>
                <select value={riskLevel} onChange={(e) => { setRiskLevel(e.target.value); saveBankrollSettings({ startingBankroll: bankroll, riskLevel: e.target.value, growthSpeed }); }}
                  style={{ fontSize: 12, padding: "6px 10px", background: "var(--bg)", border: "1px solid rgba(120,130,150,.4)", borderRadius: 6, color: "var(--fg)", height: 34 }}>
                  <option value="ghost">Ghost — 1/10 Kelly</option>
                  <option value="conservative">Conservative — 1/4 Kelly</option>
                  <option value="moderate">Moderate — 1/2 Kelly (rec.)</option>
                  <option value="standard">Standard — 3/4 Kelly</option>
                  <option value="aggressive">Aggressive — Full Kelly</option>
                  <option value="turbo">Turbo — 1.5× Kelly</option>
                  <option value="xtreme">Xtreme — 2× Kelly</option>
                  <option value="degen">Degen — 3× Kelly</option>
                  <option value="yolo">YOLO — 5× Kelly</option>
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.08em" }}>GROWTH SPEED</span>
                <select value={growthSpeed} onChange={(e) => { setGrowthSpeed(e.target.value); saveBankrollSettings({ startingBankroll: bankroll, riskLevel, growthSpeed: e.target.value }); }}
                  style={{ fontSize: 12, padding: "6px 10px", background: "var(--bg)", border: "1px solid rgba(120,130,150,.4)", borderRadius: 6, color: "var(--fg)", height: 34 }}>
                  <option value="patient">Patient — STRONG only (≥63%)</option>
                  <option value="selective">Selective — BET+ (≥57%)</option>
                  <option value="steady">Steady — all picks (≥52%)</option>
                  <option value="fast">Fast — maximize volume</option>
                  <option value="blitz">Blitz — every game</option>
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

            {/* Risk / speed info strip */}
            <div style={{ marginBottom: 10, padding: "8px 12px", background: "rgba(120,130,150,0.06)", borderRadius: 7, border: "1px solid rgba(120,130,150,0.12)", display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11, alignItems: "center" }}>
              <div><span style={{ color: "var(--dim)", fontWeight: 700 }}>{rCfg.label}:</span> <span style={{ color: "var(--fg)" }}>{rCfg.desc}</span><span style={{ color: "var(--amber)", marginLeft: 6 }}>· drawdown est. {rCfg.drawdownEst}</span></div>
              <div style={{ color: "var(--dim)", opacity: 0.4 }}>|</div>
              <div><span style={{ color: "var(--dim)", fontWeight: 700 }}>{sCfg.label}:</span> <span style={{ color: "var(--fg)" }}>{sCfg.desc}</span><span style={{ color: "var(--dim)", marginLeft: 6 }}>· rec. {sCfg.betsRec} bets/day</span></div>
            </div>

            {/* Live stats strip */}
            {betRows.length > 0 && (
              <div style={{ display: "flex", gap: 0, flexWrap: "wrap", background: "rgba(255,255,255,0.04)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden", marginBottom: 10 }}>
                {[
                  { label: "BETS TODAY", value: betRows.length, color: "var(--moss)", tip: "Games matching " + sCfg.label + " filter (" + sCfg.desc + ")" },
                  { label: "TOTAL AT RISK", value: totalBetAmt != null ? "$" + totalBetAmt.toFixed(0) : (totalBetPct * 100).toFixed(1) + "%", color: totalBetPct > 0.25 ? "var(--amber)" : "var(--fg)", tip: "Sum of all suggested bets from $" + (remaining || 0).toFixed(0) + " available (" + (totalBetPct * 100).toFixed(1) + "%)" },
                  { label: "AVG BET", value: totalBetAmt != null ? "$" + (totalBetAmt / betRows.length).toFixed(0) : ((totalBetPct / betRows.length) * 100).toFixed(1) + "%", color: "var(--fg)", tip: "Average bet per game. Per-bet cap: " + (rCfg.maxPct * 100).toFixed(0) + "% of bankroll." },
                  { label: "AVG EDGE", value: "+" + avgEdgePct.toFixed(1) + "%", color: avgEdgePct >= 5 ? "var(--moss)" : avgEdgePct >= 2 ? "var(--fg)" : "var(--dim)", tip: "Average model edge over market across today's picks" },
                ].map((stat, i) => (
                  <div key={i} title={stat.tip} style={{ flex: "1 1 80px", padding: "10px 14px", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none", cursor: "help" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.1em", marginBottom: 3 }}>{stat.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                  </div>
                ))}
                {remaining && calibratedEv > 0 && (
                  <div title={"Est. daily profit from $" + remaining.toFixed(0) + " at " + rCfg.label + " / " + sCfg.label + ". Based on current edge" + (histWinRate != null ? " calibrated to your " + (histWinRate * 100).toFixed(0) + "% win rate" : "") + ". Results vary."} style={{ flex: "1 1 80px", padding: "10px 14px", cursor: "help" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.1em", marginBottom: 3 }}>EST. DAILY PROFIT</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "var(--moss)" }}>+${(remaining * calibratedEv).toFixed(0)}</div>
                  </div>
                )}
              </div>
            )}

            {/* Per-bet breakdown */}
            {betRows.length === 0 && alreadyHeld.length > 0 && (
              <div style={{ marginBottom: 10, padding: "10px 14px", background: "rgba(80,160,80,0.06)", borderRadius: 8, border: "1px solid rgba(80,160,80,0.2)", fontSize: 12, color: "var(--moss)", fontWeight: 600 }}>
                ✓ All {alreadyHeld.length} model picks are already in your open positions — nothing left to place today.
              </div>
            )}
            {betRows.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.08em" }}>TODAY'S NRFI PICKS</span>
                  {alreadyHeld.length > 0 && <span style={{ fontSize: 10, color: "var(--moss)" }}>✓ {alreadyHeld.length} already placed — see open positions below</span>}
                  {allocationScale < 1 && <span style={{ fontSize: 10, color: "var(--amber)" }}>⚠ bets scaled to fit available balance</span>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {betRows.map((r, i) => {
                    const scaledKelly = rawKellys[i] * allocationScale;
                    const betAmt = remaining ? Math.floor(remaining * scaledKelly * 100) / 100 : null;
                    const edge = r.market ? r.market.edge : null;
                    const awayA = r.awayAbbr || r.away;
                    const homeA = r.homeAbbr || r.home;
                    const noPrice = r.market ? (100 - r.market.yesPrice) : null;
                    const contracts = (betAmt && noPrice && noPrice > 0) ? Math.floor(betAmt / (noPrice / 100)) : null;
                    const actualCost = (contracts && noPrice) ? (contracts * noPrice / 100) : betAmt;
                    const noPriceFmt = noPrice != null ? noPrice.toFixed(0) + "¢" : null;
                    return (
                      <div key={i} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.07)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                          <span style={{ fontWeight: 800, fontSize: 14 }}>{awayA} @ {homeA}</span>
                          <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 800, background: "rgba(80,160,80,0.15)", color: "var(--moss)", border: "1px solid rgba(80,160,80,0.4)" }}>NRFI</span>
                          {edge != null && (
                            <span title="Model edge over market" style={{ cursor: "help", fontSize: 11, color: edge >= 5 ? "var(--moss)" : edge >= 2 ? "var(--fg)" : "var(--dim)", fontWeight: 700 }}>+{edge.toFixed(1)}% edge</span>
                          )}
                          <span title={"Model confidence: " + (r.pFinal * 100).toFixed(1) + "%"} style={{ cursor: "help", fontSize: 11, color: "var(--dim)" }}>
                            {(r.pFinal * 100).toFixed(0)}% confidence
                          </span>
                          <span style={{ marginLeft: "auto", fontWeight: 900, fontSize: 18, color: "var(--moss)" }}>
                            {betAmt != null ? "$" + actualCost.toFixed(2) : (scaledKelly * 100).toFixed(1) + "%"}
                          </span>
                        </div>
                        {r.market && (
                          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 11 }}>
                            <span style={{ color: "var(--dim)", fontFamily: "monospace", fontSize: 10 }}>{r.market.ticker}</span>
                            <span title="Buy NO on Kalshi — wins if 1st inning is scoreless." style={{ cursor: "help", fontWeight: 700, color: "var(--fg)", background: "rgba(255,255,255,0.07)", padding: "2px 7px", borderRadius: 4 }}>Buy NO</span>
                            {noPriceFmt && <span title={"Each NO contract costs " + noPriceFmt + ". Pays $1.00 if NRFI."} style={{ cursor: "help", color: "var(--dim)" }}>@ {noPriceFmt} each</span>}
                            {contracts != null && contracts > 0 && (
                              <span title={contracts + " contracts × " + noPriceFmt + " = $" + actualCost.toFixed(2)} style={{ cursor: "help", fontWeight: 700, color: "var(--fg)" }}>{contracts} contracts</span>
                            )}
                            {contracts != null && contracts > 0 && (
                              <span title={"Wins $" + contracts.toFixed(0) + ". Profit: $" + (contracts - actualCost).toFixed(2)} style={{ cursor: "help", color: "var(--moss)" }}>→ wins ${contracts.toFixed(0)} if NRFI</span>
                            )}
                            <a href={r.market.link} target="_blank" rel="noreferrer" style={{ marginLeft: "auto", color: "var(--moss)", textDecoration: "none", fontWeight: 700 }}>Open on Kalshi ↗</a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Open Kalshi positions */}
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
                        <span title={p.call === "NRFI" ? "NO contracts — wins if 1st inning scoreless." : "YES contracts — wins if a run scores."} style={{ cursor: "help", padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 800, background: p.call === "NRFI" ? "rgba(80,160,80,0.15)" : "rgba(220,60,60,0.15)", color: p.call === "NRFI" ? "var(--moss)" : "var(--rose)", border: "1px solid " + (p.call === "NRFI" ? "rgba(80,160,80,0.4)" : "rgba(220,60,60,0.4)") }}>{p.call}</span>
                        {p.contracts > 0 && (
                          <div title="Contracts held." style={{ cursor: "help", textAlign: "center" }}>
                            <div style={{ fontSize: 10, color: "var(--dim)", marginBottom: 1 }}>CONTRACTS</div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{p.contracts}</div>
                          </div>
                        )}
                        {p.totalCost != null && (
                          <div title="Amount at risk." style={{ cursor: "help", textAlign: "center" }}>
                            <div style={{ fontSize: 10, color: "var(--dim)", marginBottom: 1 }}>AT RISK</div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>${p.totalCost.toFixed(2)}</div>
                          </div>
                        )}
                        {p.estimatedPayout != null && p.estimatedPayout > 0 && (
                          <div title="Profit if call hits." style={{ cursor: "help", textAlign: "center" }}>
                            <div style={{ fontSize: 10, color: "var(--dim)", marginBottom: 1 }}>WIN PROFIT</div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--moss)" }}>+${p.estimatedPayout.toFixed(2)}</div>
                          </div>
                        )}
                        {p.realizedPnl != null && (
                          <div title="Realized P&L." style={{ cursor: "help", textAlign: "center" }}>
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

            {/* Goal planner — 3 compound scenarios */}
            {profitGoal > 0 && (
              <div style={{ padding: "10px 14px", background: "rgba(120,130,150,0.07)", borderRadius: 8, border: "1px solid rgba(120,130,150,0.15)", fontSize: 12, marginBottom: 10 }}>
                <div style={{ fontWeight: 700, color: "var(--fg)", marginBottom: 8, fontSize: 13 }}>Goal Planner — ${profitGoal.toLocaleString()} target</div>
                {!goalScenarios || calibratedEv <= 0 ? (
                  <div style={{ color: "var(--dim)" }}>Run a scan first to see edge-based projections for your goal.</div>
                ) : (
                  <div>
                    <div style={{ color: "var(--dim)", marginBottom: 8, fontSize: 11 }}>
                      Compound growth from <b style={{ color: "var(--fg)" }}>${(remaining || bankroll).toLocaleString()}</b> · <b style={{ color: "var(--fg)" }}>{rCfg.label}</b> risk · <b style={{ color: "var(--fg)" }}>{sCfg.label}</b> speed
                      {histWinRate != null && <span> · calibrated to {(histWinRate * 100).toFixed(0)}% historical win rate</span>}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: goalScenarios.base > 90 || goalScenarios.base <= 14 ? 8 : 0 }}>
                      {[
                        { label: "PESSIMISTIC", days: goalScenarios.pessimistic, color: "var(--rose)",  note: "60% of expected edge" },
                        { label: "BASE CASE",   days: goalScenarios.base,        color: "var(--fg)",   note: "Current edge projection" },
                        { label: "OPTIMISTIC",  days: goalScenarios.optimistic,  color: "var(--moss)", note: "140% of expected edge" },
                      ].map((sc, i) => (
                        <div key={i} title={sc.note} style={{ cursor: "help", flex: "1 1 80px", padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "var(--dim)", letterSpacing: "0.08em", marginBottom: 4 }}>{sc.label}</div>
                          <div style={{ fontSize: sc.days > 999 ? 16 : 26, fontWeight: 800, color: sc.color, lineHeight: 1.1 }}>
                            {sc.days > 365 ? "365+" : sc.days} <span style={{ fontSize: 11, fontWeight: 400, color: "var(--dim)" }}>days</span>
                          </div>
                          <div style={{ fontSize: 10, color: "var(--dim)", marginTop: 3 }}>{sc.note}</div>
                        </div>
                      ))}
                    </div>
                    {goalScenarios.base > 90 && (
                      <div style={{ color: "var(--amber)", fontSize: 11 }}>
                        ⚠ Base case is over {Math.round(goalScenarios.base / 30)} months.{riskLevel !== "turbo" ? " Increase risk level or speed to get there faster." : " Consider a lower goal or larger starting bankroll."}
                      </div>
                    )}
                    {goalScenarios.base <= 14 && (
                      <div style={{ color: "var(--amber)", fontSize: 11 }}>⚠ Under 2 weeks — requires sustained high edge. Real results will vary significantly.</div>
                    )}
                  </div>
                )}
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
            <b style={{ color: "var(--moss)" }}>★ BET</b> ≥63% · <b style={{ color: "var(--moss)" }}>BET</b> ≥57% · <b style={{ color: "var(--amber)" }}>LEAN</b> ≥52% · <b style={{ color: "var(--dim)" }}>PASS</b> = too close.
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
      {held.length > 0 && (
        <div className="panel" style={{ marginTop: 12, border: "1px solid rgba(120,110,200,0.35)", background: "rgba(120,110,200,0.05)" }}>
          <p className="sect" style={{ margin: 0, color: "var(--violet)" }}>Your positions ({held.length})</p>
          <p style={{ fontSize: 11, color: "var(--dim)", margin: "4px 0 8px" }}>
            Games you hold contracts on, pinned here whatever the model says today. The verdict on each card is the
            live read, so a card marked PASS means the model no longer sees an edge at the current price — not that
            the position closed.
          </p>
          <div style={{ marginTop: 8, display: "grid", gap: 8 }}>{held.map(card)}</div>
        </div>
      )}
      {sect("Bets — ranked by confidence", [...betNRFI, ...betYRFI].sort(byConf), "var(--moss)")}
      {sect("Leans", leans, "var(--amber)")}
      {sect("Pass", passes, "var(--dim)")}
      {settledToday.length > 0 && (
        <div className="panel" style={{ marginTop: 12 }}>
          <p className="sect" style={{ margin: 0 }}>Settled today ({settledToday.length})</p>
          <p style={{ fontSize: 11, color: "var(--dim)", margin: "4px 0 8px" }}>
            First inning is over on these, so they come off the board above. Graded against the pick as it was
            logged — a game with no call was under the logging bar and counts neither way.
          </p>
          {settledToday.map((r, i) => {
            const recE = (rec || []).find((x) => x.id === "nrfi-" + r.gamePk);
            const won = !recE ? null
              : recE.result ? recE.result === "won"
              : (recE.call === "NRFI") === (r.inning1runs === 0);
            const runs = r.inning1runs;
            return (
              <div key={r.gamePk} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12,
                padding: "5px 0", borderTop: i > 0 ? "1px solid rgba(120,130,150,.12)" : "none" }}>
                <span style={{ width: 12, fontWeight: 700, color: won == null ? "var(--dim)" : won ? "var(--moss)" : "var(--rose)" }}>
                  {won == null ? "·" : won ? "✓" : "✗"}
                </span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.awayAbbr || r.away} @ {r.homeAbbr || r.home}
                </span>
                <span style={{ color: "var(--dim)", width: 92, textAlign: "right" }}>
                  {recE ? recE.call + " " + Math.round(recE.prob || r.pMax) + "%" : "no call"}
                </span>
                <span style={{ width: 74, textAlign: "right", fontWeight: 600,
                  color: runs === 0 ? "var(--moss)" : "var(--rose)" }}>
                  {runs === 0 ? "NRFI" : runs + " run" + (runs === 1 ? "" : "s")}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {rec && rec.length > 0 && (
        <div className="panel" style={{ marginTop: 12 }}>
          <p className="sect" style={{ margin: "0 0 6px" }}>Daily Profit Tracker</p>
          <NrfiCalendar rec={rec} bankroll={bankroll} riskLevel={riskLevel} />
        </div>
      )}
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

  // Row cap on the ledger table. The heading states the cap whenever it bites,
  // so the count above the table can't imply rows that were never rendered.
  const LEDGER_ROWS = 80;
  const done = ledger.filter((e) => e.status === "resolved" && e.outcome !== null);
  const stats = useMemo(() => {
    if (!done.length) return null;
    const brier = (p, o) => Math.pow(p / 100 - o, 2);
    // Brier comparison only over genuine analyses — synced positions have
    // fair === price by construction and would flatten the gap.
    const scored = done.filter((e) => e.call !== "SYNCED");
    const syncedDone = done.filter((e) => e.call === "SYNCED");
    const model = scored.length ? scored.reduce((s, e) => s + brier(e.fair, e.outcome), 0) / scored.length : null;
    const mkt = scored.length ? scored.reduce((s, e) => s + brier(e.price, e.outcome), 0) / scored.length : null;
    // A "call" bets the side it named. Synced Kalshi positions carry no desk
    // opinion (fair === price by construction), so counting them here made the
    // hit rate a portfolio stat rather than a measure of the model — and they
    // outnumber genuine calls roughly 3:1. Tracked separately below instead.
    const acted = scored.filter((e) => e.call === "BUY YES" || e.call === "BUY NO");
    const calledSide = (e) => e.call === "BUY YES" ? 1 : 0;
    const wins = acted.filter((e) => calledSide(e) === e.outcome).length;
    const syncedActed = syncedDone.filter((e) => e.taken && e.taken.side);
    const syncedWins = syncedActed.filter((e) => (e.taken.side === "YES" ? 1 : 0) === e.outcome).length;
    // n counts what the scores above are actually computed over.
    return { n: scored.length, synced: syncedDone.length, model, mkt,
      acted: acted.length, wins, hit: acted.length ? wins / acted.length : null,
      syncedActed: syncedActed.length, syncedWins };
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
              <span className="k eyebrow">Calls settled</span>
              <div className="n">{stats.n}</div>
              {stats.synced > 0 && <span className="eyebrow">{stats.synced} synced not scored</span>}
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
            {stats.synced > 0 && " " + stats.synced + " synced Kalshi position" + (stats.synced === 1 ? " is" : "s are") +
              " excluded (" + stats.syncedWins + "/" + stats.syncedActed + " settled) — they carry no desk opinion, so scoring them would measure your book, not the model."}
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
        <p className="sect">Every call I have made ({ledger.length}
          {ledger.length > LEDGER_ROWS ? " · showing the most recent " + LEDGER_ROWS : ""})</p>
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
              {ledger.slice(0, LEDGER_ROWS).map((e) => (
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
