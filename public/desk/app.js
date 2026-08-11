/* Generated from app.jsx by scripts/desk-build.js — edit app.jsx, not this file. */
/* global React, ReactDOM */
const {
  useState,
  useRef,
  useEffect,
  useMemo
} = React;

// Bump on every meaningful ship so a stale cache is obvious at a glance.
const BUILD = "2026-08-10.fine-tuned";

// Everything outbound goes through the local server: it holds the API key
// and sidesteps the venues' browser CORS rules.
const px = u => "/api/desk/proxy?url=" + encodeURIComponent(u);
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

.tabs { display:flex; gap:5px; margin-bottom:20px; overflow-x:auto; padding:5px;
  background:rgba(0,0,0,.18); border:1px solid var(--line); border-radius:13px; scrollbar-width:none; }
.tabs::-webkit-scrollbar { display:none; }
.tabs button { background:none; border:none; color:var(--dim); border-radius:9px;
  font-family:'Inter Tight',sans-serif; font-size:13.5px; font-weight:600; letter-spacing:0;
  padding:9px 14px; cursor:pointer; white-space:nowrap; transition:background .15s, color .15s; }
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
.pick { display:flex; gap:14px; align-items:center; justify-content:space-between;
  border:1px solid var(--slate-600); border-left:3px solid var(--slate-600); border-radius:12px;
  padding:13px 15px; margin-top:10px;
  background:linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,0) 60%), var(--slate-800);
  transition:border-color .15s, box-shadow .15s; }
.pick:hover { border-color:var(--dim); }
.pick.t-strongest { border-left-color:var(--moss);
  box-shadow:0 0 0 1px rgba(127,185,139,.16), 0 6px 20px rgba(0,0,0,.24); }
.pick.t-strong { border-left-color:var(--moss); }
.pick.t-lean { border-left-color:var(--amber); }
.pick .who-big { font-family:'Bricolage Grotesque',sans-serif; font-weight:700; font-size:16.5px;
  letter-spacing:-.012em; line-height:1.25; }
.pick .meta-line { font-size:11.5px; color:var(--dim); margin-top:3px; line-height:1.55; }
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
    items: [["Polls Analysis", "Compare current polling averages against the market's implied probability. Note sample sizes, pollster ratings and trend direction.", "538, RealClearPolitics, Silver Bulletin"], ["Economic Impact", "Assess how GDP, unemployment and inflation are moving, and how that historically shifts incumbent vote share.", "BLS, BEA, FRED"], ["Approval Ratings", "Track favourability and job approval for the named figures, including direction over the last 30 days.", "Gallup, 538 approval tracker"], ["Cross-Platform Markets", "Compare the equivalent contract on the other venue and note any divergence in implied probability.", "Polymarket, Kalshi"], ["Breaking News", "Find events in the last 72 hours that plausibly move this outcome, and judge whether the market has already absorbed them.", "Reuters, AP, major outlets"], ["Regional Patterns", "Break the outcome down by state or district where relevant, focusing on the marginal seats that decide it.", "State polling, past margins"], ["Social Sentiment", "Read political discussion volume and direction, treating it as a crowd signal rather than evidence.", "Reddit, X"], ["Data Uncertainty", "State the confidence interval around the central estimate and how wide it should be given the time to resolution.", "Poll margins of error"], ["Contrarian Risk", "Argue the opposite case. What would make the market price correct after all?", "—"]],
    groups: [[1, 3], [2, 6], [4, 8], [5, 7]]
  },
  sports: {
    label: "Sports",
    items: [["Vegas Lines", "Pull the current spread, moneyline and total, and convert the moneyline to a no-vig implied probability.", "Action Network, VegasInsider"], ["Line Movement", "Compare opening to current line and identify whether moves ran with or against public ticket share.", "Sportsbook line history"], ["Injury Reports", "Check official injury designations and late scratches for both sides, weighted by player usage.", "Official team reports, Rotowire"], ["Reddit Sentiment", "Read the consensus and note whether the popular side is the crowded one.", "r/sportsbook"], ["Team Statistics", "Look at recent form, head-to-head history and relevant splits like home/away or pace.", "Official league stats"], ["Situational Factors", "Account for rest days, travel distance, altitude, schedule spots and motivation.", "Schedule data"], ["Handle Splits", "Compare ticket percentage against money percentage to separate public volume from sharp money.", "Book-published splits"], ["Time Decay", "Assess how much can still change before tip-off or kick-off, and whether late moves are likely.", "—"], ["Contrarian Check", "Argue the fade. Is the popular side popular for good reasons, or is this a trap?", "—"]],
    groups: [[1, 2], [3, 5], [4, 7], [6, 8]]
  },
  weather: {
    label: "Weather",
    items: [["Forecast Consensus", "Compare GFS, ECMWF and the NWS local office forecast and state where they agree.", "NWS, NOAA, ECMWF"], ["Ensemble Spread", "Report the GEFS ensemble range for the relevant variable and how tight the members are.", "NOAA GEFS"], ["Forecast Skill Decay", "Weight the forecast by known accuracy at this lead time; day-7 skill is far weaker than day-2.", "NOAA verification stats"], ["Historical Base Rate", "Find the climatological frequency of this outcome at this station for this calendar window.", "NOAA climate normals"], ["Model Divergence", "Identify where the models disagree and which one the market appears to be pricing.", "Model comparison"], ["Micro-Climate Bias", "Account for station-specific effects: urban heat island, coastal influence, elevation.", "Station metadata"], ["Storm Track", "For tropical systems, read the NHC cone and intensity guidance, including uncertainty at landfall.", "NHC"], ["Market Pricing", "Convert the forecast into a probability and compare it directly to the contract price.", "—"], ["Contrarian Check", "Check for overshoot. Forecast-driven markets often overreact to a single model run.", "—"]],
    groups: [[1, 5], [2, 3], [4, 6], [7, 8]]
  },
  finance: {
    label: "Finance",
    items: [["Technical Analysis", "Read price structure: trend, RSI, moving averages and the nearest support and resistance to the strike.", "TradingView, exchange data"], ["Fundamental Metrics", "Check the fundamentals that bear on the outcome: earnings, revenue trend, valuation.", "Company filings"], ["Smart Money", "Look for institutional positioning, insider transactions and unusual options flow.", "SEC filings, flow data"], ["Reddit Sentiment", "Gauge retail positioning and whether the trade is already crowded.", "r/wallstreetbets, r/stocks"], ["Macro Indicators", "Factor in Fed policy path, inflation prints and rate expectations relevant to the horizon.", "FRED, CME FedWatch"], ["News Catalysts", "Map scheduled catalysts between now and resolution: earnings dates, CPI prints, product events.", "Earnings calendars"], ["Social Velocity", "Measure whether attention is accelerating or fading, as a momentum proxy.", "X, Google Trends"], ["Market Signals", "Read volume, bid-ask spread and order book depth on the contract itself.", "Venue order book"], ["Contrarian Check", "Test whether this is an overcrowded trade where the obvious read is already priced.", "—"]],
    groups: [[1, 8], [2, 3], [4, 7], [5, 6]]
  },
  general: {
    label: "General",
    items: [["Base Rate", "Find how often this class of event has happened historically, and start from that number.", "Historical records"], ["Official Benchmarks", "Check what official bodies or domain experts currently forecast.", "Agency forecasts"], ["Reddit Sentiment", "Read the relevant subreddit consensus as a crowd signal.", "Reddit"], ["Social Velocity", "Judge whether attention on this topic is building or decaying.", "X, Google Trends"], ["News Recency", "Surface anything from the last 24 to 72 hours that changes the picture.", "Reuters, AP"], ["Source Quality", "Rate the credibility of what you found and flag anything resting on a single weak source.", "—"], ["Time Decay", "Consider how much time remains and how much can still change before resolution.", "—"], ["Market Signals", "Read the contract's own volume, price direction and liquidity.", "Venue data"], ["Contrarian Check", "Look for the hidden edge, especially in the resolution criteria themselves.", "—"]],
    groups: [[1, 2], [3, 4], [5, 6], [7, 8]]
  }
};
function buildFrameworks() {
  const out = {};
  for (const [k, v] of Object.entries(DEFAULTS)) {
    out[k] = {
      label: v.label,
      groups: v.groups,
      items: v.items.map(([name, method, sources], i) => ({
        n: i + 1,
        name,
        method,
        sources,
        weight: 1,
        enabled: true
      }))
    };
  }
  return out;
}

/* ================= helpers ================= */
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
// US sports schedules (and Kalshi game tickers) run on Eastern time. The UTC
// date rolls over at 5pm Phoenix time, which made every night game query
// tomorrow's slate — use the ET calendar date instead.
const etDate = ms => new Date(ms != null ? ms : Date.now()).toLocaleDateString("en-CA", {
  timeZone: "America/New_York"
});
const today = () => etDate();
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const STOP = new Set("will the a an of in on at to be by for and or is are it its this that with from as no yes than more less".split(" "));
const toks = s => new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)));
function overlap(a, b) {
  const A = toks(a),
    B = toks(b);
  let hit = 0;
  A.forEach(t => {
    if (B.has(t)) hit++;
  });
  return hit / Math.max(3, Math.min(A.size, B.size));
}
function parseUrl(raw) {
  const u = raw.trim();
  if (!u) return {
    error: "Paste a Kalshi or Polymarket market URL to start."
  };
  let host = "",
    parts = [],
    qs = new URLSearchParams();
  try {
    const url = new URL(u.startsWith("http") ? u : "https://" + u);
    host = url.hostname.replace(/^www\./, "");
    parts = url.pathname.split("/").filter(Boolean);
    qs = url.searchParams;
  } catch {
    return {
      error: "That doesn't parse as a URL. Copy the full link from your browser bar."
    };
  }
  if (host.includes("polymarket")) {
    const i = parts.findIndex(p => p === "event" || p === "market" || p === "markets");
    const slug = i >= 0 ? parts[i + 1] : parts[parts.length - 1];
    if (!slug) return {
      error: "No market slug found in that Polymarket link."
    };
    return {
      venue: "Polymarket",
      slug,
      url: u
    };
  }
  if (host.includes("kalshi")) {
    const i = parts.findIndex(p => p === "markets" || p === "events");
    const segs = (i >= 0 ? parts.slice(i + 1) : parts).filter(Boolean);
    if (!segs.length) return {
      error: "No series or event ticker found in that Kalshi link."
    };
    return {
      venue: "Kalshi",
      segs,
      ticker: qs.get("ticker"),
      url: u
    };
  }
  return {
    error: "Only Kalshi and Polymarket links work here. Check the domain."
  };
}
const jparse = v => {
  try {
    return typeof v === "string" ? JSON.parse(v) : v || [];
  } catch {
    return [];
  }
};

// Kalshi web URLs for a specific game are /markets/{series}/{series-slug}/
// {event-ticker}. These slugs are the slugified series titles (fetched from
// the API); without them a link only reaches the whole series, not the game.
const SERIES_SLUG = {
  KXNBAGAME: "pro-basketball-game",
  KXWNBAGAME: "womens-pro-basketball-game",
  KXMLBGAME: "professional-baseball-game",
  KXNFLGAME: "professional-football-game",
  KXNHLGAME: "nhl-game",
  KXCFBGAME: "college-football-game",
  KXNCAAFGAME: "college-football-game",
  KXCBBGAME: "college-basketball-game",
  KXNCAABGAME: "college-basketball-game",
  KXATPMATCH: "atp-tennis-match",
  KXWTAMATCH: "wta-tennis-match",
  KXUFCFIGHT: "ufc-fight",
  KXEPLGAME: "english-premier-league-game",
  KXMLSGAME: "major-league-soccer-game",
  KXUCLGAME: "uefa-champions-league-game",
  KXLALIGAGAME: "la-liga-game",
  KXSERIEAGAME: "serie-a-game",
  KXBUNDESLIGAGAME: "bundesliga-game",
  KXLIGUE1GAME: "ligue-1-game",
  KXLIGAMXGAME: "liga-mx-game",
  KXUELGAME: "uefa-europa-league-game",
  KXUECLGAME: "uefa-conference-league-game",
  KXEREDIVISIEGAME: "eredivisie-game",
  KXLIGAPORTUGALGAME: "liga-portugal-game",
  KXBRASILEIROGAME: "brasileiro-serie-a-game",
  KXEFLCHAMPIONSHIPGAME: "efl-championship-game",
  KXSUPERLIGGAME: "turkish-super-lig-game",
  KXBELGIANPLGAME: "belgian-pro-league-game",
  KXNWSLGAME: "nwsl-game",
  KXLEAGUESCUPGAME: "leagues-cup-game",
  KXSAUDIPLGAME: "saudi-pro-league-game",
  KXWCGAME: "world-cup-game",
  KXCFLGAME: "cfl-game",
  KXUFLGAME: "ufl-football-game",
  KXNCAAWBGAME: "college-basketball-womens-game",
  // Commodity + crypto series (slugified series titles from the API)
  KXBTC15M: "bitcoin-price-up-down",
  KXETH15M: "eth-15m-price-up-down",
  KXSOL15M: "solana-15-minutes",
  KXXRP15M: "xrp-15-minute",
  KXDOGE15M: "dogecoin-15-minute",
  KXWTI: "wti-oil-on-day",
  KXWTIW: "wti-oil-weekly-range",
  KXBRENTD: "brent-oil-daily",
  KXGOLDD: "gold-daily",
  KXGOLDW: "gold-weekly-price",
  KXSILVERD: "silver-daily",
  KXSILVERW: "silver-weekly-price",
  KXBTCD: "bitcoin-price-above-below",
  KXETHD: "ethereum-price-above-below",
  KXBTC: "bitcoin-range",
  KXETH: "ethereum-range",
  KXGOLDH: "gold-hourly",
  KXSILVERH: "silver-hourly",
  KXGOLD15M: "gold-15-minute",
  KXSILVER15M: "silver-15-minute",
  KXWTI15M: "wti-15-minute",
  KXINX15M: "s-p-500-15-minute",
  KXNDQ15M: "nasdaq-100-15-minute"
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
  const outs = jparse(m.outcomes),
    pxs = jparse(m.outcomePrices).map(Number);
  const yi = Math.max(0, outs.findIndex(o => String(o).toLowerCase() === "yes"));
  const price = Number.isFinite(pxs[yi]) ? pxs[yi] * 100 : null;
  return {
    id: m.conditionId || String(m.id),
    token: jparse(m.clobTokenIds)[yi] || null,
    slug: ev && ev.slug || m.slug,
    name: m.groupItemTitle || m.question || ev && ev.title,
    question: m.question || ev && ev.title,
    price,
    volume: Number(m.volumeNum || m.volume || 0),
    liquidity: Number(m.liquidityNum || m.liquidity || 0),
    close: m.endDate || ev && ev.endDate || null,
    rules: String(m.description || ev && ev.description || "").slice(0, 900),
    venue: "Polymarket",
    link: "https://polymarket.com/event/" + (ev && ev.slug || m.slug || "")
  };
}
async function fetchPolymarket(p) {
  const r = await fetch(px("https://gamma-api.polymarket.com/events?slug=" + encodeURIComponent(p.slug)));
  if (!r.ok) throw new Error("Polymarket API returned " + r.status);
  const data = await r.json();
  const ev = Array.isArray(data) ? data[0] : data;
  if (!ev || !ev.markets || !ev.markets.length) throw new Error("No markets on that event.");
  const markets = ev.markets.filter(m => m.active !== false && m.archived !== true).map(m => pmMarket(m, ev)).filter(m => m.price !== null).sort((a, b) => b.price - a.price);
  if (!markets.length) throw new Error("No priced markets on that event.");
  return {
    venue: "Polymarket",
    event: ev.title,
    markets,
    source: "live API"
  };
}

// Kalshi now publishes prices as decimal dollars (yes_bid_dollars: 0.45) and
// sizes as fixed-point (volume_fp). Older payloads used integer cents. Read both.
function kaPrice(m) {
  const n = x => {
    if (x === null || x === undefined || x === "") return null;
    const v = Number(x);
    return Number.isFinite(v) ? v : null;
  };
  // Cents fields, used as-is.
  const cents = (...names) => {
    for (const k of names) {
      const v = n(m[k]);
      if (v !== null) return v;
    }
    return null;
  };
  // Dollar fields, scaled to cents.
  const dol = (...names) => {
    for (const k of names) {
      const v = n(m[k]);
      if (v !== null) return v * 100;
    }
    return null;
  };
  const or = (a, b) => a !== null ? a : b;
  let bid = or(cents("yes_bid", "best_yes_bid"), dol("yes_bid_dollars", "previous_yes_bid_dollars"));
  let ask = or(cents("yes_ask", "best_yes_ask"), dol("yes_ask_dollars", "previous_yes_ask_dollars"));
  const noBid = or(cents("no_bid", "best_no_bid"), dol("no_bid_dollars"));
  const noAsk = or(cents("no_ask", "best_no_ask"), dol("no_ask_dollars"));
  if (bid === null && noAsk !== null) bid = 100 - noAsk;
  if (ask === null && noBid !== null) ask = 100 - noBid;
  const last = or(cents("last_price", "yes_price"), dol("last_price_dollars", "previous_price_dollars"));
  let price = null;
  if (last !== null && last > 0) price = last;else if (bid !== null && ask !== null) price = (bid + ask) / 2;else if (bid !== null) price = bid;else if (ask !== null) price = ask;else if (last !== null) price = last;
  return {
    price,
    bid,
    ask
  };
}
function kaMarket(m) {
  const {
    price,
    bid,
    ask
  } = kaPrice(m);
  const num = x => {
    const v = Number(x);
    return Number.isFinite(v) ? v : 0;
  };
  return {
    id: m.ticker,
    name: m.yes_sub_title || m.subtitle || m.title || m.ticker,
    question: m.title || m.ticker,
    price,
    quoted: price !== null && price > 0,
    bid,
    ask,
    status: m.status || null,
    result: m.result || null,
    // Multivariate (parlay) markets carry their exact legs — without them
    // the title ("yes Milwaukee,yes New York") names no sport or opponent.
    legs: Array.isArray(m.mve_selected_legs) && m.mve_selected_legs.length ? m.mve_selected_legs.map(l => ({
      ticker: l.market_ticker,
      side: (l.side || "yes").toUpperCase()
    })) : null,
    volume: num(m.volume) || num(m.volume_fp) || num(m.volume_24h_fp),
    liquidity: num(m.open_interest) || num(m.open_interest_fp) || num(m.liquidity_dollars),
    close: m.close_time || null,
    rules: String(m.rules_primary || "").slice(0, 900),
    venue: "Kalshi",
    link: kalshiEventLink(m.ticker)
  };
}
async function fetchKalshi(p) {
  const base = "https://api.elections.kalshi.com/trade-api/v2";
  const segs = p.segs || [];
  const tried = [];

  // Pull markets out of whichever shape the endpoint returns.
  const get = async url => {
    let r;
    try {
      r = await fetch(px(url));
    } catch (e) {
      tried.push(url.replace(base, "") + " -> " + e.message);
      return null;
    }
    if (!r.ok) {
      tried.push(url.replace(base, "") + " -> " + r.status);
      return null;
    }
    const d = await r.json();
    const ms = [].concat(d.markets || []).concat(d.market ? [d.market] : []).concat(d.event && d.event.markets ? d.event.markets : []).concat((d.events || []).flatMap(e => e.markets || []));
    tried.push(url.replace(base, "") + " -> " + r.status + " (" + ms.length + " markets)");
    if (!ms.length) return null;
    const title = d.event && d.event.title || d.events && d.events[0] && d.events[0].title || null;
    return {
      ms,
      title
    };
  };

  // A full market ticker contains a dash (KXWTAMATCH-25AUG08SWI); a series ticker doesn't.
  const looksTicker = x => /-/.test(x) && /\d/.test(x);
  const tickers = segs.filter(looksTicker).map(x => x.toUpperCase());
  const series = segs.filter(x => !looksTicker(x)).map(x => x.toUpperCase());
  let raw = null;
  if (p.ticker) raw = await get(base + "/markets?tickers=" + encodeURIComponent(p.ticker.toUpperCase()));
  for (const T of tickers) {
    if (raw) break;
    raw = await get(base + "/markets?tickers=" + encodeURIComponent(T));
    if (!raw) raw = await get(base + "/events/" + encodeURIComponent(T) + "?with_nested_markets=true");
  }
  for (const S of series) {
    if (raw) break;
    for (const url of [base + "/events?series_ticker=" + S + "&with_nested_markets=true&limit=200", base + "/markets?series_ticker=" + S + "&status=open&limit=200", base + "/markets?event_ticker=" + S + "&limit=200", base + "/events/" + S + "?with_nested_markets=true"]) {
      const got = await get(url);
      if (!got) continue;
      // Guard: if the API ignored an unsupported filter it hands back unrelated
      // markets. Every ticker in this series must start with the series ticker.
      const own = got.ms.filter(m => String(m.ticker || "").toUpperCase().startsWith(S));
      if (own.length) {
        raw = {
          ms: own,
          title: got.title
        };
        break;
      }
      tried.push("  ^ discarded: none of those tickers start with " + S);
    }
  }

  // Last resort: match the words in the URL slug against open market titles.
  if (!raw && segs.length) {
    const words = segs.join(" ").replace(/-/g, " ");
    const got = await get(base + "/markets?status=open&limit=1000");
    if (got) {
      const scored = got.ms.map(m => ({
        m,
        s: overlap(words, (m.title || "") + " " + (m.subtitle || m.yes_sub_title || ""))
      })).filter(x => x.s > 0.34).sort((a, b) => b.s - a.s).slice(0, 40);
      if (scored.length) raw = {
        ms: scored.map(x => x.m),
        title: null,
        fuzzy: true
      };
    }
  }
  if (!raw) {
    throw new Error("no Kalshi endpoint matched this link.\nAttempts:\n" + tried.join("\n"));
  }

  // Nested market records from /events are trimmed and carry no quotes.
  // Re-fetch the full records for anything missing a bid, ask and last price.
  const thin = raw.ms.filter(m => m.yes_bid == null && m.yes_ask == null && m.last_price == null);
  if (thin.length) {
    const byTicker = {};
    for (let i = 0; i < thin.length && i < 200; i += 40) {
      const batch = thin.slice(i, i + 40).map(m => m.ticker).filter(Boolean);
      if (!batch.length) continue;
      const got = await get(base + "/markets?tickers=" + encodeURIComponent(batch.join(",")));
      (got ? got.ms : []).forEach(m => {
        byTicker[m.ticker] = m;
      });
    }
    raw.ms = raw.ms.map(m => byTicker[m.ticker] || m);
  }
  const all = raw.ms.map(kaMarket);
  const priced = all.filter(m => m.price !== null);
  const tradeable = priced.filter(m => !m.status || /open|active/i.test(m.status));
  let markets = tradeable.length ? tradeable : priced;
  if (!markets.length) {
    const counts = {};
    all.forEach(m => {
      const k = m.status || "no status";
      counts[k] = (counts[k] || 0) + 1;
    });
    const summary = Object.entries(counts).map(([k, v]) => v + " " + k).join(", ");
    throw new Error("Found " + all.length + " contracts in this series but none are currently quoted (" + summary + ").\n\n" + "This usually means the series has no live matches right now. Try the Browse markets tab to see what is actually trading.");
  }

  // A series page holds many contests. Busiest and soonest first beats price order.
  markets = markets.length > 3 ? markets.sort((a, b) => b.volume - a.volume || new Date(a.close || 0) - new Date(b.close || 0)) : markets.sort((a, b) => b.price - a.price);
  return {
    venue: "Kalshi",
    event: raw.title || (markets.length > 1 ? segs.join(" / ").replace(/-/g, " ") : markets[0].question),
    markets,
    source: raw.fuzzy ? "matched by keyword" : "live API"
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
      const r = await fetch(px("https://api.elections.kalshi.com/trade-api/v2/series/" + series + "/markets/" + m.id + "/candlesticks?start_ts=" + weekAgo + "&end_ts=" + now + "&period_interval=60"));
      if (!r.ok) return null;
      const d = await r.json();
      points = (d.candlesticks || []).map(c => {
        const pr = c.price || {};
        const v = pr.close != null ? pr.close : pr.mean != null ? pr.mean : c.yes_bid && c.yes_bid.close;
        return v == null ? null : {
          t: Number(c.end_period_ts),
          p: Number(v)
        };
      }).filter(x => x && Number.isFinite(x.p));
    } else {
      if (!m.token) return null;
      const r = await fetch(px("https://clob.polymarket.com/prices-history?market=" + encodeURIComponent(m.token) + "&interval=1w&fidelity=120"));
      if (!r.ok) return null;
      const d = await r.json();
      points = (d.history || []).map(h => ({
        t: Number(h.t),
        p: Number(h.p) * 100
      })).filter(x => Number.isFinite(x.p));
    }
    if (points.length < 2) return null;
    // Some payloads quote dollars, others cents — normalise to cents. A
    // dollar feed has fractional values (0.45); a cents feed pinned at 1
    // is a real 1c longshot, not $1, so require a fraction before scaling.
    if (Math.max.apply(null, points.map(pt => pt.p)) <= 1.001 && points.some(pt => pt.p % 1 !== 0)) points = points.map(pt => ({
      t: pt.t,
      p: pt.p * 100
    }));
    points.sort((a, b) => a.t - b.t);
    const at = secsAgo => {
      const target = now - secsAgo;
      let best = points[0];
      for (const pt of points) if (Math.abs(pt.t - target) < Math.abs(best.t - target)) best = pt;
      return best.p;
    };
    const last = points[points.length - 1].p;
    return {
      points,
      last,
      change24h: last - at(86400),
      change7d: last - points[0].p
    };
  } catch {
    return null;
  }
}
const histSummary = h => !h ? "" : "\nPRICE HISTORY: 7d change " + (h.change7d >= 0 ? "+" : "") + h.change7d.toFixed(1) + "c, 24h change " + (h.change24h >= 0 ? "+" : "") + h.change24h.toFixed(1) + "c. A market that already moved may have priced in the news — judge what is genuinely new versus already absorbed.";
const marketSpread = m => m.ask != null && m.bid != null ? m.ask - m.bid : null;
const isThin = m => {
  const s = marketSpread(m);
  return s != null && s > 8 || m.volume != null && m.volume > 0 && m.volume < 1000;
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
        return k.price != null ? {
          price: k.price,
          bid: k.bid,
          ask: k.ask
        } : null;
      }
    } else if (e.slug) {
      const r = await fetch(px("https://gamma-api.polymarket.com/events?slug=" + encodeURIComponent(e.slug)));
      if (!r.ok) return null;
      const d = await r.json();
      const ev = Array.isArray(d) ? d[0] : d;
      const m = ev && (ev.markets || []).find(x => (x.conditionId || String(x.id)) === e.marketId);
      if (m) {
        const p = pmMarket(m, ev).price;
        const n = x => {
          const v = Number(x);
          return Number.isFinite(v) ? v * 100 : null;
        };
        return p != null ? {
          price: p,
          bid: n(m.bestBid),
          ask: n(m.bestAsk)
        } : null;
      }
    }
  } catch {/* quote later */}
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
  const sellAt = side === "YES" ? bid != null ? bid : curSide - 0.5 : ask != null ? 100 - ask : curSide - 0.5;

  // A parlay with a lost leg is decided, whatever the combo still quotes.
  if (cmb && cmb.dead) {
    const salvage = (side === "YES" ? sellAt : 100 - sellAt) - takerFee(e.venue, clamp(sellAt, 0.5, 99.5));
    const doomed = side === "YES"; // YES on the combo needs every leg
    if (doomed) {
      return salvage >= 2 ? {
        act: "SELL NOW",
        why: "A leg has LOST — the parlay can only resolve NO now. Selling salvages ~" + salvage.toFixed(0) + "c a contract; holding returns nothing."
      } : {
        act: "SETTLING",
        why: "A leg has lost, so this parlay resolves NO. No bid worth hitting — it settles at zero."
      };
    }
    return {
      act: "SETTLING",
      why: "A leg has lost, so the parlay resolves NO — your NO side wins at settlement. Holding to resolution collects the full 100c."
    };
  }
  if (live && live.sides && live.state === "post") {
    return {
      act: "SETTLING",
      why: "The game is final. This resolves shortly — nothing left to decide."
    };
  }

  // Choose the best CURRENT estimate of what the side is worth. Order of
  // trust: a live in-game win probability, then a genuinely recent analysis
  // (only when no game is in progress — a pre-game fair value is meaningless
  // once the game starts), then the market itself. Critically, never let a
  // stale fair value declare a position mispriced: if there's no fresh
  // independent read, the market price IS the fair estimate.
  const inGame = !!(live && live.sides && !live.none);
  const liveProb = live && live.impliedCents != null && live.state === "in" && !live.disagree ? side === "YES" ? live.impliedCents : 100 - live.impliedCents : null;
  const hasAnalysis = Array.isArray(e.pillars) && e.pillars.length > 0 && e.call !== "SYNCED";
  const freshAnalysis = hasAnalysis && Date.now() - (e.ts || 0) < 3 * 3600 * 1000;
  const fairSide = side === "YES" ? e.fair : 100 - e.fair;
  let eff, src, independent;
  if (cmb) {
    // The legs' combined read prices the combo better than its own thin
    // quote ever can — and it's live whenever any leg's game is.
    eff = side === "YES" ? cmb.prob : 100 - cmb.prob;
    src = cmb.live ? "the legs' live win odds" : "the legs' own market prices";
    independent = true;
  } else if (liveProb != null) {
    eff = liveProb;
    src = "the live win probability";
    independent = true;
  } else if (freshAnalysis && !inGame) {
    eff = fairSide;
    src = "my recent analysis";
    independent = true;
  } else {
    eff = curSide;
    src = "the market price";
    independent = false;
  }

  // Entry price is sunk — decisions are forward-looking only. Selling pays
  // the taker fee and collects the bid, not the last print; holding to
  // resolution is free. So exiting is only right when an INDEPENDENT read
  // says the sale nets more than the position is worth.
  const exitFee = takerFee(e.venue, clamp(sellAt, 0.5, 99.5));
  const proceeds = sellAt - exitFee; // per contract, if sold right now

  if (independent && proceeds - eff >= 2) {
    return {
      act: pnl >= 0 ? "TAKE PROFIT" : "SELL NOW",
      why: "By " + src + " your side is worth about " + eff.toFixed(0) + "c, but selling nets ~" + proceeds.toFixed(0) + "c after the " + exitFee.toFixed(1) + "c fee — the market is paying more than the position is worth."
    };
  }
  // Adding pays the ask plus the taker fee — a higher bar than holding
  // (which is free). Only an independent read clearing that all-in cost by
  // a real margin justifies putting more money in.
  const buyAt = side === "YES" ? ask != null ? ask : curSide + 0.5 : bid != null ? 100 - bid : curSide + 0.5;
  const addCost = buyAt + takerFee(e.venue, clamp(buyAt, 0.5, 99.5));
  if (independent && eff - addCost >= 3) {
    return {
      act: "BUY MORE",
      why: "By " + src + " your side is worth about " + eff.toFixed(0) + "c and adding costs ~" + addCost.toFixed(1) + "c all-in (ask + fee) — roughly " + (eff - addCost).toFixed(0) + "c of edge on every contract you add. " + "Keep additions small; the read can move fast" + (liveProb != null ? " mid-game" : "") + "."
    };
  }
  if (independent && eff - proceeds >= 2) return {
    act: "HOLD",
    why: "About " + (eff - proceeds).toFixed(0) + "c of edge left by " + src + " over what a sale nets today. " + (pnl >= 0 ? "Up " : "Down ") + Math.abs(pnl).toFixed(0) + "c a contract so far."
  };
  if (!independent) return {
    act: "HOLD",
    why: "No fresh independent read right now, so the market price is the best estimate — it already reflects a " + curSide.toFixed(0) + "% chance, which is what your side is worth. Selling only nets ~" + proceeds.toFixed(0) + "c after fees and the spread; holding to resolution is free and wins that " + curSide.toFixed(0) + "% of the time. What you paid (" + Number(e.taken.entryPrice).toFixed(0) + "c) is already spent and shouldn't drive this."
  };
  return {
    act: "HOLD",
    why: "Priced about right by " + src + ": worth ~" + eff.toFixed(0) + "c, and a sale nets ~" + proceeds.toFixed(0) + "c after fees. Holding to resolution costs nothing and wins " + eff.toFixed(0) + "% of the time. What you paid (" + Number(e.taken.entryPrice).toFixed(0) + "c) is already spent — it shouldn't drive this decision."
  };
}
const ADVICE_COLORS = {
  HOLD: "var(--moss)",
  "BUY MORE": "var(--cyan)",
  "TAKE PROFIT": "var(--amber)",
  "SELL NOW": "var(--rose)",
  "RE-CHECK": "var(--cyan)",
  SETTLING: "var(--dim)"
};

// Translate a BUY YES/NO verdict into the plain side to wager on, naming the
// actual outcome (and the opponent for a game, when we can find it).
function betSide(result, market, live) {
  if (!result || result.call === "PASS") return null;
  const name = market.name || "this outcome";
  if (result.side === "YES") return {
    who: name,
    plain: "betting " + name + " happens"
  };
  let opp = null;
  if (live && live.sides && live.mySide) {
    const other = live.sides.find(s => s.name && s.name !== live.mySide.name);
    if (other) opp = other.name;
  }
  return opp ? {
    who: opp,
    plain: "backing " + opp + ", the other side"
  } : {
    who: "NOT " + name,
    plain: "betting " + name + " does not happen"
  };
}

// Who's going to win? The live model first, the final score when the game
// is over, else the market's own price for the named outcome.
function likelyWinner(live, fallbackName, fallbackProb) {
  if (live && live.sides && live.state === "post") {
    const byScore = live.sides.slice().sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
    if (byScore[0] && (Number(byScore[0].score) || 0) > (Number(byScore[1] && byScore[1].score) || 0)) {
      return {
        name: byScore[0].name,
        pct: 100,
        final: true
      };
    }
  }
  if (live && live.homeWinPct != null && live.sides) {
    const home = live.sides.find(s => s.home) || live.sides[1];
    const away = live.sides.find(s => !s.home) || live.sides[0];
    const p = live.homeWinPct;
    if (home && away) {
      return p >= 50 ? {
        name: home.name,
        pct: p
      } : {
        name: away.name,
        pct: 100 - p
      };
    }
  }
  if (fallbackProb != null && fallbackName && fallbackProb >= 50) {
    return {
      name: fallbackName,
      pct: fallbackProb,
      market: true
    };
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
    const r = await fetch(px("https://api.elections.kalshi.com/trade-api/v2/markets?tickers=" + encodeURIComponent(m.legs.map(l => l.ticker).join(","))));
    if (!r.ok) return null;
    const d = await r.json();
    const byT = {};
    (d.markets || []).forEach(raw => {
      byT[raw.ticker] = raw;
    });
    const out = m.legs.map(l => {
      const raw = byT[l.ticker];
      const km = raw ? kaMarket(raw) : null;
      const lg = detectLeague({
        id: l.ticker,
        question: km ? km.question : "",
        name: km ? km.name : ""
      });
      return {
        ticker: l.ticker,
        side: l.side,
        name: km ? km.name : l.ticker,
        question: km ? km.question : l.ticker,
        price: km ? km.price : null,
        result: km ? km.result : null,
        league: lg ? lg.label : null,
        date: tickerDate(l.ticker)
      };
    });
    return out.every(l => l) ? out : null;
  } catch {
    return null;
  }
}
const legsText = legs => legs.map((l, i) => "Leg " + (i + 1) + ": " + l.side + " on \"" + l.name + "\" in " + (l.league || "?") + " game \"" + l.question + "\"" + (l.date ? " (game date " + l.date + " ET)" : "") + (l.price != null ? " — this leg's own market trades at " + l.price.toFixed(0) + "c" : "") + (l.result ? " — SETTLED " + l.result.toUpperCase() : "")).join("\n");

// Combined worth of a parlay right now: product over legs of the best read
// on each leg (settled result > live win prob > final score > leg price).
function legsCombined(legs, legLiveArr) {
  if (!legs || !legs.length) return null;
  let prod = 1,
    liveCount = 0,
    dead = false,
    priced = 0;
  const parts = [];
  legs.forEach((l, i) => {
    const ll = legLiveArr && legLiveArr[i] && !legLiveArr[i].none ? legLiveArr[i] : null;
    let p = null,
      src = "price";
    if (l.result === "yes" || l.result === "no") {
      const won = l.result === "yes" === (l.side === "YES");
      p = won ? 100 : 0;
      src = "settled";
      if (!won) dead = true;
    } else if (ll && ll.impliedCents != null && ll.state === "in" && !ll.disagree) {
      p = l.side === "YES" ? ll.impliedCents : 100 - ll.impliedCents;
      src = "live";
      liveCount++;
    } else if (ll && ll.state === "post") {
      const w = likelyWinner(ll, l.name, null);
      if (w && w.final) {
        const won = overlap(w.name, l.name) > 0.3;
        p = won ? 100 : 0;
        src = "final";
        if (!won) dead = true;
      }
    }
    if (p == null && l.price != null) {
      p = l.side === "YES" ? l.price : 100 - l.price;
      src = "price";
    }
    if (p == null) {
      p = 50;
      src = "unknown";
    } else priced++;
    prod *= clamp(p, 0, 100) / 100;
    parts.push({
      p,
      src
    });
  });
  return {
    prob: 100 * prod,
    live: liveCount > 0,
    dead,
    priced,
    parts
  };
}

// Per-leg live state for the research prompts.
function legsLiveSummary(legs, legLiveArr) {
  if (!legs || !legs.length) return "";
  const cmb = legsCombined(legs, legLiveArr);
  let out = "\n\nTHIS CONTRACT IS A PARLAY — it resolves YES only if EVERY leg below hits. " + "The named teams and sports are EXACT; do not substitute other teams that share a city name.\n" + legsText(legs);
  (legLiveArr || []).forEach((ll, i) => {
    const s = liveSummary(ll);
    if (s) out += "\nLeg " + (i + 1) + " live state:" + s.replace(/^\n+/, " ");
  });
  if (cmb) out += "\nDETERMINISTIC COMBINED READ: the legs multiply to about " + cmb.prob.toFixed(1) + "c for the parlay" + (cmb.dead ? " — a leg has LOST, the parlay is dead and resolves NO." : ".");
  return out;
}

/* ---- event board: who wins, and every bet on this event ----
   Deterministic and free: pairs each sibling outcome with the live model /
   book consensus, nets out entry cost and fees, and names the best pick. */
function eventBoard(book, live) {
  if (!book || !book.markets || !live || live.none || !live.sides) return null;
  const ob = live.oddsBook;
  const sideFor = name => {
    let bi = -1,
      bs = 0,
      ss = 0;
    live.sides.forEach((sd, i) => {
      const sc = overlap(name || "", sd.name);
      if (sc > bs) {
        ss = bs;
        bs = sc;
        bi = i;
      } else if (sc > ss) ss = sc;
    });
    return bi >= 0 && bs > 0.3 && bs - ss > 0.12 ? live.sides[bi] : null;
  };
  const rows = book.markets.slice(0, 8).map(mm => {
    let prob = null,
      src = null;
    const sd = sideFor(mm.name);
    if (sd && live.homeWinPct != null && live.state === "in") {
      prob = sd.home ? live.homeWinPct : 100 - live.homeWinPct;
      src = "live model";
    } else if (sd && ob) {
      prob = sd.home ? ob.home : ob.away;
      src = ob.books + " books";
    } else if (/\btie\b|\bdraw\b/i.test(mm.name || "") && ob && ob.draw != null) {
      prob = ob.draw;
      src = ob.books + " books";
    }
    const entry = mm.ask != null ? mm.ask : mm.price;
    const fee = entry != null ? takerFee(mm.venue, entry) : 0;
    const net = prob != null && entry != null ? prob - entry - fee : null;
    return {
      m: mm,
      prob,
      src,
      entry,
      net
    };
  });
  const withNet = rows.filter(r => r.net != null);
  const best = withNet.length ? withNet.reduce((b, r) => r.net > b.net ? r : b) : null;
  let winner = likelyWinner(live, null, null);
  if (!winner && ob) {
    const home = live.sides.find(s => s.home),
      away = live.sides.find(s => !s.home);
    if (home && away) winner = ob.home >= ob.away ? {
      name: home.name,
      pct: ob.home,
      book: true
    } : {
      name: away.name,
      pct: ob.away,
      book: true
    };
  }
  return {
    rows,
    best,
    winner
  };
}

/* ---- order book + slippage ---- */
async function fetchBook(m) {
  try {
    if (m.venue === "Kalshi") {
      const r = await fetch(px("https://api.elections.kalshi.com/trade-api/v2/markets/" + m.id + "/orderbook?depth=12"));
      if (!r.ok) return null;
      const d = await r.json();
      const ob = d.orderbook || {};
      const rows = a => (a || []).map(r => [Number(r[0]), Number(r[1])]).filter(r => Number.isFinite(r[0]));
      // Levels may arrive in dollars (0.45) or cents (45). Scale if they look decimal.
      const toCents = rs => rs.length && Math.max.apply(null, rs.map(r => r[0])) <= 1.001 ? rs.map(r => [r[0] * 100, r[1]]) : rs;
      const yes = toCents(rows(ob.yes || ob.yes_dollars));
      const no = toCents(rows(ob.no || ob.no_dollars));
      // Buying YES fills against resting NO bids at (100 - no price).
      const asks = no.map(r => [100 - r[0], r[1]]).sort((a, b) => a[0] - b[0]);
      const bids = yes.slice().sort((a, b) => b[0] - a[0]);
      return {
        asks,
        bids,
        unit: "contracts"
      };
    }
    if (!m.token) return null;
    const r = await fetch(px("https://clob.polymarket.com/book?token_id=" + encodeURIComponent(m.token)));
    if (!r.ok) return null;
    const d = await r.json();
    const asks = (d.asks || []).map(x => [Number(x.price) * 100, Number(x.size)]).sort((a, b) => a[0] - b[0]);
    const bids = (d.bids || []).map(x => [Number(x.price) * 100, Number(x.size)]).sort((a, b) => b[0] - a[0]);
    return {
      asks,
      bids,
      unit: "shares"
    };
  } catch {
    return null;
  }
}
function walkBook(levels, size) {
  let left = size,
    cost = 0,
    filled = 0;
  for (const [p, q] of levels) {
    const take = Math.min(left, q);
    cost += take * p;
    filled += take;
    left -= take;
    if (left <= 0) break;
  }
  if (filled === 0) return null;
  return {
    avg: cost / filled,
    filled,
    short: left > 0 ? left : 0
  };
}

/* ================= live game state =================
   Several feeds, cross-checked. ESPN covers every league and carries win
   probability and sportsbook odds; the league's own API is the authority on
   score and clock. Disagreement between them is itself a signal. */
const LEAGUES = [[/KXNBAGAME|\bnba\b/i, "basketball/nba", "NBA"], [/KXWNBAGAME|\bwnba\b/i, "basketball/wnba", "WNBA"], [/KXMLBGAME|\bmlb\b|world series/i, "baseball/mlb", "MLB"], [/KXNFLGAME|\bnfl\b|super bowl/i, "football/nfl", "NFL"], [/KXNHLGAME|\bnhl\b|stanley cup/i, "hockey/nhl", "NHL"], [/KXCFBGAME|KXNCAAFGAME|college football/i, "football/college-football", "NCAAF"], [/KXCBBGAME|KXNCAABGAME|march madness/i, "basketball/mens-college-basketball", "NCAAM"], [/KXATPMATCH|\batp\b/i, "tennis/atp", "ATP"], [/KXWTAMATCH|\bwta\b/i, "tennis/wta", "WTA"], [/KXUFCFIGHT|\bufc\b|\bmma\b/i, "mma/ufc", "UFC"], [/KXEPLGAME|premier league/i, "soccer/eng.1", "EPL"], [/KXMLSGAME|\bmls\b/i, "soccer/usa.1", "MLS"], [/champions league/i, "soccer/uefa.champions", "UCL"], [/la liga/i, "soccer/esp.1", "La Liga"], [/KXSERIEAGAME|serie a game/i, "soccer/ita.1", "Serie A"], [/KXBUNDESLIGAGAME|bundesliga game/i, "soccer/ger.1", "Bundesliga"], [/KXLIGUE1GAME|ligue 1/i, "soccer/fra.1", "Ligue 1"], [/KXLIGAMXGAME|liga mx/i, "soccer/mex.1", "Liga MX"], [/KXUELGAME|europa league/i, "soccer/uefa.europa", "Europa League"], [/KXUECLGAME|conference league/i, "soccer/uefa.europa.conf", "Conference League"], [/KXEREDIVISIEGAME|eredivisie/i, "soccer/ned.1", "Eredivisie"], [/KXLIGAPORTUGALGAME|primeira liga|liga portugal/i, "soccer/por.1", "Liga Portugal"], [/KXBRASILEIROGAME|brasileir/i, "soccer/bra.1", "Brasileirao"], [/KXEFLCHAMPIONSHIPGAME|efl championship/i, "soccer/eng.2", "EFL Championship"], [/KXSUPERLIGGAME|super lig\b/i, "soccer/tur.1", "Super Lig"], [/KXBELGIANPLGAME|belgian pro/i, "soccer/bel.1", "Belgian Pro League"], [/KXNWSLGAME|\bnwsl\b/i, "soccer/usa.nwsl", "NWSL"], [/KXLEAGUESCUPGAME|leagues cup/i, "soccer/concacaf.leagues.cup", "Leagues Cup"], [/KXSAUDIPLGAME|saudi pro league/i, "soccer/ksa.1", "Saudi Pro League"], [/KXWCGAME-|world cup game/i, "soccer/fifa.world", "World Cup"], [/KXCFLGAME|\bcfl\b/i, "football/cfl", "CFL"], [/KXUFLGAME|\bufl\b/i, "football/ufl", "UFL"], [/KXNCAAWBGAME|women's college basketball/i, "basketball/womens-college-basketball", "NCAAW"],
// Total-score (over/under) markets track the same games
[/KXMLBTOTAL/i, "baseball/mlb", "MLB"], [/KXWNBATOTAL/i, "basketball/wnba", "WNBA"], [/KXNBATOTAL/i, "basketball/nba", "NBA"], [/KXNFLTOTAL/i, "football/nfl", "NFL"], [/KXNHLTOTAL/i, "hockey/nhl", "NHL"], [/KXCFBTOTAL/i, "football/college-football", "NCAAF"]];
function detectLeague(m) {
  const id = String(m.id || "");
  // A multivariate combo (native parlay) spans several games — no single
  // live game can represent it, and pairing it with one shows the wrong
  // team's feed entirely.
  if (/^KXMVE|MULTIGAME|PARLAY/i.test(id)) return null;
  const hay = id + " " + (m.question || "") + " " + (m.name || "");
  const hits = [];
  for (const [re, path, label] of LEAGUES) {
    if (re.test(hay) && !hits.some(h => h.path === path)) hits.push({
      path,
      label
    });
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
  const push = c => {
    if (c && !out.includes(c)) out.push(c);
  };
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
        if (k <= 4 && run.length - k <= 4) {
          push(run.slice(0, k));
          push(run.slice(k));
        }
      }
    }
  }
  return out;
}

// Known cross-feed abbreviation differences (Kalshi vs ESPN vs league
// APIs). Without these, the White Sox (CWS vs CHW) never exact-match and
// a junk prefix can drag the market onto the wrong game entirely.
const CODE_ALIAS = {
  CWS: "CHW",
  CHW: "CWS",
  // White Sox
  AZ: "ARI",
  ARI: "AZ",
  // Diamondbacks
  WSN: "WSH",
  // Nationals
  JAX: "JAC",
  JAC: "JAX",
  // Jaguars
  WAS: "WSH",
  WSH: "WAS",
  // Washington (NFL/NBA/NHL)
  NO: "NOP",
  NOP: "NO",
  // Pelicans
  GS: "GSW",
  GSW: "GS",
  // Warriors
  NY: "NYK",
  SA: "SAS",
  SAS: "SA",
  PHO: "PHX",
  UTAH: "UTA",
  UTA: "UTAH",
  SJ: "SJS",
  SJS: "SJ",
  TBL: "TB",
  NJD: "NJ",
  LAK: "LA",
  MTL: "MON"
};
const codeEq = (a, c) => a === c || CODE_ALIAS[a] === c || CODE_ALIAS[c] === a;

// Exact (or aliased) abbreviation matches score full weight. Prefix
// overlaps (LA vs LAS) score partial — but only when exactly ONE of the
// game's abbreviations matches, so a short code like NY can't pair with
// either New York team of a Yankees-Mets game.
const codeHit = (codes, abbrs) => {
  let s = 0;
  for (const c of codes) {
    if (abbrs.some(a => codeEq(a, c))) {
      s += 1;
      continue;
    }
    const pref = abbrs.filter(a => a && (a.startsWith(c) || c.startsWith(a)));
    if (pref.length === 1) s += 0.6;
  }
  return s;
};

// Sports feeds load straight from the browser first: ESPN 403s datacenter
// IPs (which is where the proxy lives) but sends open CORS headers, so the
// user's own connection is the reliable path. The proxy stays as fallback.
const getJson = async url => {
  try {
    const r = await fetch(url);
    if (r.ok) return r.json();
  } catch {/* CORS or network — fall through to the server proxy */}
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
  "basketball/womens-college-basketball": "basketball_wncaab"
};
const ODDS_FRESH_MS = 10 * 60 * 1000; // a quote older than this is not "live"
let oddsQuota = null; // {remaining, at} for the UI chip
let oddsOffUntil = 0; // back off when no key is configured
const oddsSportCache = new Map(); // sport -> {at, events}

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
    if (!r.ok) {
      oddsSportCache.set(sport, {
        at: Date.now(),
        events: null
      });
      return null;
    }
    const d = await r.json();
    if (d.configured === false) {
      oddsOffUntil = Date.now() + 10 * 60 * 1000;
      return null;
    }
    if (d.remaining != null) oddsQuota = {
      remaining: d.remaining,
      at: Date.now()
    };
    const events = Array.isArray(d.events) ? d.events : null;
    oddsSportCache.set(sport, {
      at: Date.now(),
      events
    });
    return events;
  } catch {
    return null;
  }
}

// Two-sided derivative market (totals: Over/Under; spreads: home/away at a
// handicap). Books quote different lines — take the median point, de-vig
// every book quoting that exact point, and average. `a` is Over (totals)
// or the home side (spreads), as a percentage.
function oddsSideMarket(ev, key) {
  if (!ev || !Array.isArray(ev.bookmakers)) return null;
  const quotes = [];
  ev.bookmakers.forEach(bk => {
    const m = (bk.markets || []).find(x => x.key === key);
    if (!m || !Array.isArray(m.outcomes)) return;
    const oA = m.outcomes.find(o => key === "totals" ? o.name === "Over" : o.name === ev.home_team);
    const oB = m.outcomes.find(o => key === "totals" ? o.name === "Under" : o.name === ev.away_team);
    if (!oA || !oB || oA.point == null) return;
    const ra = mlImplied(oA.price),
      rb = mlImplied(oB.price);
    if (ra == null || rb == null) return;
    quotes.push({
      point: Number(oA.point),
      ra,
      rb
    });
  });
  if (!quotes.length) return null;
  const pts = quotes.map(q => q.point).sort((x, y) => x - y);
  const point = pts[Math.floor(pts.length / 2)];
  const at = quotes.filter(q => Math.abs(q.point - point) < 1e-9);
  const dv = at.map(q => shinDevig([q.ra, q.rb])).filter(Boolean);
  if (!dv.length) return null;
  const a = dv.reduce((s, x) => s + x[0], 0) / dv.length * 100;
  return {
    point,
    a,
    b: 100 - a,
    books: dv.length
  };
}

// Not all books are equal: Pinnacle takes sharp action at high limits and
// its line is the market's best single predictor; exchanges (Betfair et al)
// are real order books. Weight them above recreational books when
// averaging — this measurably tightens the consensus toward truth.
const BOOK_WEIGHT = {
  pinnacle: 3,
  betfair_ex_eu: 2,
  betfair_ex_uk: 2,
  betfair_ex_au: 2,
  smarkets: 1.5,
  matchbook: 1.5,
  betonlineag: 1.25,
  lowvig: 1.25
};
function oddsEventConsensus(ev) {
  if (!ev || !Array.isArray(ev.bookmakers)) return null;
  const books = [];
  let updated = 0;
  ev.bookmakers.forEach(bk => {
    const m = (bk.markets || []).find(x => x.key === "h2h");
    if (!m || !Array.isArray(m.outcomes)) return;
    const imp = name => {
      const o = m.outcomes.find(x => x.name === name);
      return o ? mlImplied(o.price) : null;
    };
    const rh = imp(ev.home_team),
      ra = imp(ev.away_team),
      rd = imp("Draw");
    if (rh == null || ra == null) return;
    const dv = shinDevig(rd != null ? [rh, rd, ra] : [rh, ra]);
    if (!dv) return;
    books.push({
      home: dv[0] * 100,
      away: dv[dv.length - 1] * 100,
      draw: dv.length === 3 ? dv[1] * 100 : null,
      w: BOOK_WEIGHT[bk.key] || 1
    });
    const t = Date.parse(m.last_update || bk.last_update || "");
    if (Number.isFinite(t) && t > updated) updated = t;
  });
  if (!books.length) return null;
  const wsum = books.reduce((s, b) => s + b.w, 0);
  const mean = k => books.reduce((s, b) => s + (b[k] || 0) * b.w, 0) / wsum;
  const home = mean("home"),
    away = mean("away");
  const withDraw = books.filter(b => b.draw != null);
  const draw = withDraw.length ? withDraw.reduce((s, b) => s + b.draw * b.w, 0) / withDraw.reduce((s, b) => s + b.w, 0) : null;
  const disp = books.length > 1 ? Math.sqrt(books.reduce((s, b) => s + Math.pow(b.home - home, 2), 0) / books.length) : 0;
  const sharp = books.some(b => b.w >= 2);
  return {
    home,
    away,
    draw,
    books: books.length,
    disp,
    updated,
    sharp,
    totals: oddsSideMarket(ev, "totals"),
    spreads: oddsSideMarket(ev, "spreads")
  };
}

// Find this game among the sport's events. BOTH competitors must appear in
// the game's name — plain overlap let a game whose own event wasn't quoted
// yet borrow a sibling event that shares one team (NY at IND stealing
// LV at NY's odds). A same-slate-date event wins ties between rematches.
function matchOddsEvent(events, nameText, dateStr) {
  if (!events || !events.length || !nameText) return null;
  const nt = toks(nameText);
  const teamPresent = team => {
    let hit = 0;
    toks(team).forEach(t => {
      if (nt.has(t)) hit++;
    });
    return hit >= 1;
  };
  let best = null,
    bestS = 0;
  events.forEach(ev => {
    if (!teamPresent(ev.home_team || "") || !teamPresent(ev.away_team || "")) return;
    let s = overlap(nameText, (ev.home_team || "") + " " + (ev.away_team || ""));
    if (dateStr && ev.commence_time) {
      const d = Date.parse(ev.commence_time);
      if (Number.isFinite(d) && etDate(d).replace(/-/g, "") === String(dateStr)) s += 0.5;
    }
    if (s > bestS) {
      bestS = s;
      best = ev;
    }
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
  const team = String(c.team && c.team.abbreviation || "").toUpperCase();
  if (team) return team;
  const name = c.athlete && c.athlete.displayName || "";
  const last = name.trim().split(/\s+/).pop() || "";
  return last.slice(0, 3).toUpperCase();
}
async function espnGame(lg, m, codes) {
  const d = await getJson("https://site.api.espn.com/apis/site/v2/sports/" + lg.path + "/scoreboard");
  const events = d.events || [];
  if (!events.length) return null;
  const target = (m.question || "") + " " + (m.name || "");
  const scored = events.map(ev => {
    const comp = ev.competitions && ev.competitions[0] || {};
    const abbrs = (comp.competitors || []).map(competitorAbbr);
    return {
      ev,
      s: overlap(target, (ev.name || "") + " " + (ev.shortName || "")) + codeHit(codes, abbrs) * 0.8
    };
  }).sort((a, b) => b.s - a.s)[0];
  if (!scored || scored.s < 0.4) return null;
  const ev = scored.ev;
  const comp = ev.competitions && ev.competitions[0] || {};
  const st = ev.status || comp.status || {};
  const type = st.type || {};
  const sides = (comp.competitors || []).map(c => ({
    name: c.team && (c.team.displayName || c.team.name) || c.athlete && c.athlete.displayName || "—",
    abbr: competitorAbbr(c),
    score: c.score != null && c.score !== "" ? Number(c.score) : null,
    home: c.homeAway === "home",
    // Tennis and other set/period sports: the per-set line score.
    sets: (c.linescores || []).map(ls => ls.displayValue != null ? ls.displayValue : ls.value).filter(v => v != null && v !== "")
  }));
  const base = {
    source: "ESPN",
    eventId: ev.id,
    path: lg.path,
    name: ev.name || ev.shortName || "",
    state: type.state || "pre",
    detail: type.shortDetail || type.detail || "",
    clock: st.displayClock || "",
    period: st.period || 0,
    sides,
    venue: comp.venue && comp.venue.fullName || ""
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
        provider: od.provider && od.provider.name || "book",
        details: od.details || "",
        overUnder: od.overUnder != null ? od.overUnder : null,
        homeML: od.homeTeamOdds && od.homeTeamOdds.moneyLine,
        awayML: od.awayTeamOdds && od.awayTeamOdds.moneyLine
      };
    }
    // Shin-de-vigged consensus across every book, for the analysis anchor.
    const homeAbbr = (sides.find(s => s.home) || {}).abbr;
    const awayAbbr = (sides.find(s => !s.home) || {}).abbr;
    const cons = consensusDevig(oddsArr, homeAbbr, awayAbbr);
    if (cons) base.bookProb = {
      home: cons.home,
      away: cons.away,
      books: cons.books,
      disp: cons.disp
    };
    const sit = sm.situation || sm.header && sm.header.competitions && sm.header.competitions[0].situation;
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
      sm.injuries.forEach(t => {
        const teamName = t.team && (t.team.abbreviation || t.team.displayName) || "?";
        (t.injuries || []).slice(0, 5).forEach(inj => {
          const who = inj.athlete && inj.athlete.displayName;
          const st = inj.status || inj.type && inj.type.description || "";
          if (who && st) lines.push(teamName + ": " + who + " (" + st + ")");
        });
      });
      if (lines.length) base.injuries = lines.slice(0, 8).join("; ");
    }
  } catch {/* scoreboard alone is still usable */}
  return base;
}

/* ---- source 2: the league's own feed ---- */
async function officialGame(lg, codes) {
  if (lg.label === "MLB") {
    const sch = await getJson("https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=" + today());
    const games = (sch.dates || []).flatMap(d => d.games || []);
    const pick = games.find(g => {
      const ab = [g.teams.home.team.abbreviation, g.teams.away.team.abbreviation].map(x => String(x || "").toUpperCase());
      return codeHit(codes, ab) > 0;
    });
    if (!pick) return null;
    const f = await getJson("https://statsapi.mlb.com/api/v1.1/game/" + pick.gamePk + "/feed/live");
    const ls = f.liveData && f.liveData.linescore || {};
    const st = f.gameData && f.gameData.status || {};
    const abstract = String(st.abstractGameState || "").toLowerCase();
    return {
      source: "MLB StatsAPI",
      state: abstract === "live" ? "in" : abstract === "final" ? "post" : "pre",
      detail: (ls.inningState ? ls.inningState + " " + (ls.currentInningOrdinal || "") : st.detailedState) || "",
      sides: [{
        name: f.gameData.teams.away.name,
        abbr: String(f.gameData.teams.away.abbreviation || "").toUpperCase(),
        score: (ls.teams && ls.teams.away && ls.teams.away.runs) ?? null,
        home: false
      }, {
        name: f.gameData.teams.home.name,
        abbr: String(f.gameData.teams.home.abbreviation || "").toUpperCase(),
        score: (ls.teams && ls.teams.home && ls.teams.home.runs) ?? null,
        home: true
      }],
      extra: ls.balls != null ? ls.balls + "-" + ls.strikes + " count, " + (ls.outs ?? "?") + " out" : "",
      // Starting pitchers decide baseball moneylines — name them.
      probables: (() => {
        const pp = f.gameData && f.gameData.probablePitchers;
        if (!pp || !pp.away && !pp.home) return null;
        return "Probable pitchers: " + (pp.away && pp.away.fullName || "TBD") + " (away) vs " + (pp.home && pp.home.fullName || "TBD") + " (home)";
      })()
    };
  }
  if (lg.label === "NHL") {
    const d = await getJson("https://api-web.nhle.com/v1/score/now");
    const g = (d.games || []).find(x => codeHit(codes, [String(x.homeTeam.abbrev || "").toUpperCase(), String(x.awayTeam.abbrev || "").toUpperCase()]) > 0);
    if (!g) return null;
    const gs = String(g.gameState || "").toUpperCase();
    return {
      source: "NHL API",
      state: gs === "LIVE" || gs === "CRIT" ? "in" : gs === "OFF" || gs === "FINAL" ? "post" : "pre",
      detail: g.periodDescriptor ? "P" + (g.periodDescriptor.number || "") : "",
      clock: g.clock && g.clock.timeRemaining || "",
      sides: [{
        name: g.awayTeam.name && g.awayTeam.name.default || g.awayTeam.abbrev,
        abbr: String(g.awayTeam.abbrev || "").toUpperCase(),
        score: g.awayTeam.score ?? null,
        home: false
      }, {
        name: g.homeTeam.name && g.homeTeam.name.default || g.homeTeam.abbrev,
        abbr: String(g.homeTeam.abbrev || "").toUpperCase(),
        score: g.homeTeam.score ?? null,
        home: true
      }]
    };
  }
  if (lg.label === "NBA") {
    const d = await getJson("https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json");
    const games = d.scoreboard && d.scoreboard.games || [];
    const g = games.find(x => codeHit(codes, [String(x.homeTeam.teamTricode || "").toUpperCase(), String(x.awayTeam.teamTricode || "").toUpperCase()]) > 0);
    if (!g) return null;
    return {
      source: "NBA Live",
      state: g.gameStatus === 2 ? "in" : g.gameStatus === 3 ? "post" : "pre",
      detail: g.gameStatusText || "",
      clock: g.gameClock || "",
      period: g.period || 0,
      sides: [{
        name: g.awayTeam.teamCity + " " + g.awayTeam.teamName,
        abbr: String(g.awayTeam.teamTricode || "").toUpperCase(),
        score: g.awayTeam.score ?? null,
        home: false
      }, {
        name: g.homeTeam.teamCity + " " + g.homeTeam.teamName,
        abbr: String(g.homeTeam.teamTricode || "").toUpperCase(),
        score: g.homeTeam.score ?? null,
        home: true
      }]
    };
  }
  return null;
}

/* ---- merge ---- */
async function fetchLive(m) {
  const lg = detectLeague(m);
  if (!lg) return null;
  const codes = teamCodes(m.id).map(c => c.toUpperCase());
  const [a, b] = await Promise.allSettled([espnGame(lg, m, codes), officialGame(lg, codes)]);
  const espn = a.status === "fulfilled" ? a.value : null;
  const off = b.status === "fulfilled" ? b.value : null;
  const errs = [a, b].filter(x => x.status === "rejected").map(x => String(x.reason && x.reason.message));
  if (!espn && !off) return {
    league: lg.label,
    none: true,
    errs
  };

  // The league's own feed wins on score and clock; ESPN supplies the rest.
  const primary = off || espn;
  const sides = primary.sides;
  const sources = [espn, off].filter(Boolean).map(x => ({
    name: x.source,
    line: (x.sides || []).map(sd => sd.abbr + " " + (sd.score ?? "-")).join(" ")
  }));
  let disagree = false;
  if (espn && off && espn.sides && off.sides) {
    const key = arr => arr.slice().sort((p, q) => p.abbr.localeCompare(q.abbr)).map(sd => sd.abbr + ":" + (sd.score ?? "-")).join("|");
    disagree = key(espn.sides) !== key(off.sides);
  }

  // Which side is this contract on? Match the outcome name to a competitor.
  // A market named after the QUESTION ("Will the Aces beat the Liberty?")
  // mentions both teams — if the two sides score nearly the same, matching
  // would be a coin flip that silently shows the OTHER team's numbers.
  // Refusing to pick is strictly better than flipping.
  let sideIdx = -1,
    bestS = 0,
    secondS = 0;
  sides.forEach((sd, i) => {
    const sc = Math.max(overlap(m.name || "", sd.name), sd.abbr && codes.length ? codes[0] === sd.abbr ? 1 : 0 : 0);
    if (sc > bestS) {
      secondS = bestS;
      bestS = sc;
      sideIdx = i;
    } else if (sc > secondS) secondS = sc;
  });
  const mySide = sideIdx >= 0 && bestS > 0.3 && bestS - secondS > 0.12 ? sides[sideIdx] : null;
  let impliedCents = null;
  if (espn && espn.homeWinPct != null && mySide) {
    impliedCents = mySide.home ? espn.homeWinPct : 100 - espn.homeWinPct;
  }

  // Wide-book consensus from The Odds API (cached; no-op without a key).
  let oddsBook = null;
  try {
    oddsBook = await oddsConsensusFor(lg.path, espn && espn.name || sides.map(sd => sd.name).join(" "), tickerDate(m.id), primary.state === "in");
  } catch {/* optional signal */}
  return {
    league: lg.label,
    name: espn && espn.name || sides.map(sd => sd.name).join(" vs "),
    state: primary.state,
    detail: primary.detail || espn && espn.detail || "",
    clock: primary.clock || espn && espn.clock || "",
    period: primary.period || espn && espn.period || 0,
    sides,
    extra: primary.extra || espn && espn.extra || "",
    downDistance: espn && espn.downDistance,
    possession: espn && espn.possessionText,
    lastPlay: espn && espn.lastPlay,
    odds: espn && espn.odds,
    bookProb: espn && espn.bookProb,
    oddsBook,
    injuries: espn && espn.injuries,
    probables: off && off.probables || null,
    homeWinPct: espn && espn.homeWinPct,
    mySide,
    impliedCents,
    disagree,
    sources,
    errs,
    fetched: Date.now()
  };
}
function liveSummary(l) {
  if (!l || l.none || !l.sides) return "";
  const line = l.sides.map(s => s.name + " " + (s.score ?? "-")).join(" vs ");
  const phase = l.state === "in" ? "IN PROGRESS" : l.state === "post" ? "FINAL" : "NOT STARTED";
  const asOf = l.fetched ? new Date(l.fetched).toISOString().slice(11, 19) + " UTC" : "now";
  let out = "\n\nLIVE GAME STATE (" + l.league + ", " + phase + ", fetched " + asOf + ", sources: " + l.sources.map(s => s.name).join(" + ") + "): " + line;
  if (l.detail) out += " — " + l.detail;
  if (l.clock && l.state === "in") out += " (" + l.clock + ")";
  const withSets = l.sides.filter(s => s.sets && s.sets.length);
  if (withSets.length) out += ". Set/period scores: " + withSets.map(s => s.name + " [" + s.sets.join(" ") + "]").join(", ");
  if (l.downDistance) out += ". " + l.downDistance + (l.possession ? ", ball: " + l.possession : "");
  if (l.extra) out += ". " + l.extra;
  if (l.lastPlay) out += ". Last play: " + l.lastPlay;
  if (l.homeWinPct != null) {
    const home = l.sides.find(s => s.home);
    out += ". ESPN live win probability: " + (home ? home.name : "home") + " " + l.homeWinPct.toFixed(1) + "%";
  }
  if (l.impliedCents != null && l.mySide) {
    out += ". That puts this contract's side (" + l.mySide.name + ") at " + l.impliedCents.toFixed(1) + "c";
  }
  if (l.odds) {
    out += ". Book line: " + (l.odds.details || "") + (l.odds.overUnder != null ? " O/U " + l.odds.overUnder : "") + (l.odds.homeML != null ? " (home ML " + l.odds.homeML + ")" : "");
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
  const a = clean.indexOf("{"),
    b = clean.lastIndexOf("}");
  if (a === -1 || b <= a) throw new Error("no json");
  return JSON.parse(clean.slice(a, b + 1));
}

// Research runs on Sonnet (fast, cheap searching); the judgment calls —
// resolution audit, final pricing, trade verification — run on Opus, which
// is markedly better calibrated on probability estimates.
const MODELS = {
  research: "claude-sonnet-4-6",
  judge: "claude-opus-4-8"
};
async function callClaude(prompt, {
  search = false,
  model = MODELS.research,
  maxTokens = 1600
} = {}) {
  const body = {
    model,
    max_tokens: maxTokens,
    messages: [{
      role: "user",
      content: prompt
    }]
  };
  if (search) body.tools = [{
    type: "web_search_20250305",
    name: "web_search",
    max_uses: 5
  }];
  // One automatic retry on rate limits and transient server errors, so a
  // single hiccup doesn't cost a whole framework group.
  let r;
  for (let attempt = 0;; attempt++) {
    r = await fetch("/api/desk/claude", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }).catch(e => ({
      ok: false,
      status: 0,
      _err: e
    }));
    if (r.ok || attempt >= 1 || ![0, 429, 500, 502, 503, 529].includes(r.status)) break;
    await new Promise(res => setTimeout(res, 2500));
  }
  if (!r.ok) throw new Error("Analysis request failed (" + (r.status || "network") + ")");
  const d = await r.json();
  const blocks = d.content || [];
  const text = blocks.filter(b => b.type === "text").map(b => b.text).join("\n");
  const sources = [];
  blocks.forEach(b => {
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) b.content.forEach(c => {
      if (c.url) sources.push({
        url: c.url,
        title: c.title || c.url
      });
    });
  });
  return {
    text,
    sources
  };
}

/* ---- pricing math ---- */
const logit = p => Math.log(p / (100 - p));
const unlogit = x => 100 / (1 + Math.exp(-x));

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
  (ledger || []).forEach(e => {
    if (e.status !== "resolved" || e.outcome === null || e.category !== category) return;
    (e.pillars || []).forEach(p => {
      if (!p.signal || p.signal === "NEUTRAL" || (p.strength || 0) < 1) return;
      acc[p.n] = acc[p.n] || {
        hit: 0,
        n: 0
      };
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
const takerFee = (venue, priceCents) => venue === "Kalshi" ? 7 * (priceCents / 100) * (1 - priceCents / 100) : 0;

// Minimum net edge (after real fill price and fees) before a trade is worth
// calling. Higher mid-range where estimate noise is largest; never below 3c,
// which near the extremes forces roughly 2x the market's odds — the
// favourite-longshot bias punishes fading the tails on model say-so.
const minNetEdge = priceCents => 3 + 0.06 * Math.min(priceCents, 100 - priceCents);

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
  const rs = raws.filter(x => x != null && x > 0);
  if (rs.length < 2) return null;
  const B = rs.reduce((s, x) => s + x, 0);
  if (B <= 1.00001) return rs.map(x => x / B); // no vig — just normalise
  const pAt = z => rs.map(r => (Math.sqrt(z * z + 4 * (1 - z) * r * r / B) - z) / (2 * (1 - z)));
  const sumAt = z => pAt(z).reduce((s, x) => s + x, 0);
  // sum decreases monotonically in z; sum(0)=sqrt(B)>1. Bisect for sum=1.
  let lo = 0,
    hi = 0.9;
  if (sumAt(hi) > 1) return rs.map(x => x / B); // vig too large — fall back
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (sumAt(mid) > 1) lo = mid;else hi = mid;
  }
  const probs = pAt((lo + hi) / 2);
  const t = probs.reduce((s, x) => s + x, 0);
  if (!(t > 0) || !probs.every(x => x >= 0 && x <= 1)) return rs.map(x => x / B);
  return probs.map(x => x / t);
}

// Two-way de-vig kept as a thin wrapper (Shin under the hood) so older call
// sites keep working.
function noVigMoneyline(homeML, awayML) {
  const h = mlImplied(homeML),
    a = mlImplied(awayML);
  if (h == null || a == null) return null;
  const dv = shinDevig([h, a]);
  if (!dv) return null;
  return {
    home: dv[0] * 100,
    away: dv[1] * 100
  };
}

// Consensus across every book ESPN lists: de-vig each independently with
// Shin, average the results, and report how far the books spread (a proxy
// for how settled the true price is). Returns probabilities as percentages.
function consensusDevig(oddsArray, homeAbbr, awayAbbr) {
  const books = [];
  (oddsArray || []).forEach(o => {
    if (!o || !o.homeTeamOdds || !o.awayTeamOdds) return;
    const rh = mlImplied(o.homeTeamOdds.moneyLine),
      ra = mlImplied(o.awayTeamOdds.moneyLine);
    if (rh == null || ra == null) return;
    // Soccer prices a draw as a third outcome — de-vig all three so a
    // "team to win" probability isn't inflated by ignoring the draw.
    const rd = o.drawOdds ? mlImplied(o.drawOdds.moneyLine) : null;
    const dv = shinDevig(rd != null ? [rh, rd, ra] : [rh, ra]);
    if (dv) books.push({
      home: dv[0] * 100,
      away: dv[dv.length - 1] * 100,
      draw: dv.length === 3 ? dv[1] * 100 : null
    });
  });
  if (!books.length) return null;
  const mean = k => books.reduce((s, b) => s + b[k], 0) / books.length;
  const home = mean("home"),
    away = mean("away");
  const withDraw = books.filter(b => b.draw != null);
  const draw = withDraw.length ? withDraw.reduce((s, b) => s + b.draw, 0) / withDraw.length : null;
  const disp = books.length > 1 ? Math.sqrt(books.reduce((s, b) => s + Math.pow(b.home - home, 2), 0) / books.length) : 0;
  const probByAbbr = {};
  if (homeAbbr) probByAbbr[homeAbbr] = home;
  if (awayAbbr) probByAbbr[awayAbbr] = away;
  // Soccer's third outcome — Kalshi tie contracts end in TIE or DRAW.
  if (draw != null) {
    probByAbbr.TIE = draw;
    probByAbbr.DRAW = draw;
  }
  return {
    probByAbbr,
    home,
    away,
    draw,
    books: books.length,
    disp
  };
}

// Empirical calibration from settled calls: if the desk's fair values have
// scored worse than the market's own prices, pull future estimates toward
// the market. Needs a real sample (>=20) before it does anything, and never
// pulls more than 70% of the way in — it corrects over-confidence, it
// doesn't surrender to the market.
function calibrationFactor(ledger) {
  // Synced positions carry fair === price by construction — including them
  // shrinks the model-vs-market gap and masks real overconfidence.
  const done = (ledger || []).filter(e => e.status === "resolved" && e.outcome !== null && e.call !== "SYNCED" && typeof e.fair === "number" && typeof e.price === "number");
  if (done.length < 20) return {
    k: 1,
    n: done.length,
    active: false
  };
  const brier = (p, o) => Math.pow(p / 100 - o, 2);
  const model = done.reduce((s, e) => s + brier(e.fair, e.outcome), 0) / done.length;
  const mkt = done.reduce((s, e) => s + brier(e.price, e.outcome), 0) / done.length;
  let k = 1;
  if (model > mkt && mkt > 0) k = clamp(1 - (model - mkt) / mkt, 0.3, 1);
  return {
    k,
    n: done.length,
    active: k < 0.995
  };
}
const median = arr => {
  const s = arr.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const daysToClose = m => {
  if (!m.close) return null;
  const d = (new Date(m.close) - Date.now()) / 86400000;
  return Number.isFinite(d) ? Math.max(0, d) : null;
};
const ctx = m => {
  const dd = daysToClose(m);
  const when = dd == null ? "" : dd < 1 ? " (resolves within a day)" : " (" + Math.round(dd) + " days away)";
  return `CONTRACT: "${m.question}"
OUTCOME BEING PRICED: ${m.name}
CURRENT MARKET PRICE FOR YES: ${m.price.toFixed(1)}c (implied ${m.price.toFixed(1)}% chance)
RESOLUTION DATE: ${m.close || "unknown"}${when}
${m.rules ? "RESOLUTION RULES: " + m.rules : ""}${m.legsInfo ? "\nTHIS IS A PARLAY. It resolves YES only if EVERY leg hits. The exact legs (teams, sports, dates) are:\n" + legsText(m.legsInfo) + "\nPrice EXACTLY these legs. Do NOT substitute any other team that shares a city name." : ""}`;
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
  const defs = items.map(p => `${p.n}. ${p.name}\n   Method: ${p.method}${p.sources && p.sources !== "—" ? "\n   Preferred sources: " + p.sources : ""}`).join("\n");
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
  const hit = ws => ws.some(w => t.includes(w));
  if (hit(["temperature", "rainfall", "snow", "hurricane", "storm", "weather", "degrees", "precipitation", "tornado"])) return "weather";
  if (hit(["election", "president", "senate", "congress", "governor", "nominee", "primary", "parliament", "prime minister", "impeach", "cabinet", "supreme court", "shutdown", "speaker"])) return "politics";
  if (hit(["nfl", "nba", "mlb", "nhl", "premier league", "super bowl", "world cup", "ncaa", "ufc", " vs ", "playoff", "olympic", "grand slam"])) return "sports";
  if (hit(["fed ", "cpi", "inflation", "gdp", "s&p", "nasdaq", "bitcoin", "ethereum", "earnings", "stock", "rate cut", "interest rate", "unemployment", "recession", "ipo", "wti", "brent", "crude", "gold", "silver", "natural gas", "commodity", "settlement price"])) return "finance";
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
  } catch {
    return;
  }
  const changed = [];
  const todayEt = etDate().replace(/-/g, "");
  const sports = rec.filter(x => (!x.type || x.type === "sports" || String(x.id).indexOf("pk-") === 0) && x.result == null && x.date && x.date <= todayEt && x.eventId && x.path).slice(0, 6);
  for (const x of sports) {
    try {
      const gs = await espnGamesForLeague(x.path, x.date);
      const g = gs.find(y => y.eventId === String(x.eventId));
      if (g && g.state === "post" && g.sides) {
        const w = gameWinnerAbbr(g.sides);
        if (w) {
          x.result = pickWon(x.pickCode, w) ? "won" : "lost";
          x.final = g.sides.map(s => s.abbr + " " + (s.score != null ? s.score : "-")).join(" ");
          changed.push(x);
        }
      } else if (Date.now() - (x.at || 0) > 5 * 86400000) {
        x.result = "void";
        changed.push(x);
      }
    } catch {/* next cycle */}
  }
  const f15 = rec.filter(x => x.type === "f15" && x.result == null && x.close && Date.now() - new Date(x.close) > 2 * 60000).slice(0, 6);
  for (const x of f15) {
    try {
      const r2 = await fetch(px("https://api.elections.kalshi.com/trade-api/v2/markets/" + String(x.id).slice(4)));
      if (!r2.ok) continue;
      const d2 = await r2.json();
      const res = d2.market && d2.market.result;
      if (res === "yes" || res === "no") {
        x.result = res === "yes" === x.up ? "won" : "lost";
        changed.push(x);
      } else if (Date.now() - (x.at || 0) > 86400000) {
        x.result = "void";
        changed.push(x);
      }
    } catch {/* next cycle */}
  }
  const com = rec.filter(x => x.type === "commodity" && x.result == null && x.close && Date.now() - new Date(x.close) > 10 * 60000).slice(0, 4);
  for (const x of com) {
    try {
      const r2 = await fetch(px("https://api.elections.kalshi.com/trade-api/v2/markets?event_ticker=" + encodeURIComponent(String(x.id).slice(3)) + "&limit=100"));
      if (!r2.ok) continue;
      const d2 = await r2.json();
      const ms = (d2.markets || []).filter(m => /greater/.test(m.strike_type || "") && m.floor_strike != null && (m.result === "yes" || m.result === "no"));
      if (ms.length) {
        const actual = ms.filter(m => m.result === "yes").length;
        x.result = actual === x.win ? "won" : "lost";
        x.actual = actual;
        changed.push(x);
      } else if (Date.now() - (x.at || 0) > 3 * 86400000) {
        x.result = "void";
        changed.push(x);
      }
    } catch {/* next cycle */}
  }
  if (changed.length) {
    try {
      await fetch("/api/desk/picks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(changed)
      });
    } catch {/* resend next cycle */}
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
      } catch {/* defaults stand */}
      try {
        const r = await fetch("/api/desk/ledger");
        const d = await r.json();
        setLedger(d.entries || []);
      } catch {/* empty ledger */}
    })();
  }, []);

  // Re-pull the ledger from the server, so positions marked on another
  // device (or added for you) show up without a full page reload.
  async function reloadLedger() {
    try {
      const r = await fetch("/api/desk/ledger");
      const d = await r.json();
      if (Array.isArray(d.entries)) setLedger(d.entries);
    } catch {/* keep what we have */}
  }
  async function saveFw(next) {
    setFw(next);
    try {
      await fetch("/api/desk/frameworks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(next)
      });
    } catch {/* keeps working in memory */}
  }
  async function saveEntry(entry) {
    setLedger(L => [entry, ...L.filter(x => x.id !== entry.id)]);
    try {
      await fetch("/api/desk/ledger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(entry)
      });
    } catch {/* in memory only */}
  }
  const [pending, setPending] = useState(null); // market handed over from Browse or My trades

  // Re-open a past call in Analyze with a freshly fetched market record.
  async function reopen(e) {
    try {
      if (e.venue === "Kalshi") {
        const r = await fetch(px("https://api.elections.kalshi.com/trade-api/v2/markets/" + e.marketId));
        const d = await r.json();
        if (d.market) {
          setPending(kaMarket(d.market));
          setTab("analyze");
          return;
        }
      } else if (e.slug) {
        const r = await fetch(px("https://gamma-api.polymarket.com/events?slug=" + encodeURIComponent(e.slug)));
        const d = await r.json();
        const ev = Array.isArray(d) ? d[0] : d;
        const m = ev && (ev.markets || []).find(x => (x.conditionId || String(x.id)) === e.marketId);
        if (m) {
          setPending(pmMarket(m, ev));
          setTab("analyze");
          return;
        }
      }
    } catch {/* fall back to what the ledger knows */}
    setPending({
      venue: e.venue,
      id: e.marketId,
      slug: e.slug || null,
      name: e.name,
      question: e.question,
      price: e.price,
      close: e.close || null,
      link: e.link || "",
      rules: ""
    });
    setTab("analyze");
  }
  const openTrades = ledger.filter(e => e.taken && e.status === "open").length;
  return /*#__PURE__*/React.createElement("div", {
    className: "cd"
  }, /*#__PURE__*/React.createElement("style", null, CSS), /*#__PURE__*/React.createElement("div", {
    className: "cd-wrap"
  }, /*#__PURE__*/React.createElement("header", {
    className: "cd-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "Kalshi \xB7 Polymarket"), /*#__PURE__*/React.createElement("h1", {
    className: "cd-title"
  }, "Contract ", /*#__PURE__*/React.createElement("span", null, "Desk")), /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      maxWidth: 460
    }
  }, "I predict the outcomes of Kalshi and Polymarket events \u2014 games, totals, commodities, anything listed \u2014 and grade every prediction against what actually happens.")), /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, today())), /*#__PURE__*/React.createElement("nav", {
    className: "tabs"
  }, [["picks", "Predictions"], ["analyze", "Ask an event"], ["parlay", "Combos"], ["commodities", "15-Minute"], ["positions", "My trades" + (openTrades ? " (" + openTrades + ")" : "")], ["browse", "Find a market"], ["frameworks", "What I check"], ["ledger", "Accuracy"]].map(([k, l]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    className: tab === k ? "on" : "",
    onClick: () => setTab(k)
  }, l))), tab === "picks" && /*#__PURE__*/React.createElement(Picks, {
    ledger: ledger,
    onPick: m => {
      setPending(m);
      setTab("analyze");
    }
  }), tab === "analyze" && /*#__PURE__*/React.createElement(Analyze, {
    fw: fw,
    onSave: saveEntry,
    pending: pending,
    clearPending: () => setPending(null),
    ledger: ledger
  }), tab === "parlay" && /*#__PURE__*/React.createElement(Parlay, {
    onPick: m => {
      setPending(m);
      setTab("analyze");
    }
  }), tab === "commodities" && /*#__PURE__*/React.createElement(Commodities, {
    onPick: m => {
      setPending(m);
      setTab("analyze");
    }
  }), tab === "positions" && /*#__PURE__*/React.createElement(Positions, {
    ledger: ledger,
    save: saveEntry,
    reopen: reopen,
    reload: reloadLedger
  }), tab === "browse" && /*#__PURE__*/React.createElement(Browse, {
    onPick: m => {
      setPending(m);
      setTab("analyze");
    }
  }), tab === "frameworks" && /*#__PURE__*/React.createElement(Frameworks, {
    fw: fw,
    save: saveFw,
    ledger: ledger,
    reset: () => saveFw(buildFrameworks())
  }), tab === "ledger" && /*#__PURE__*/React.createElement(Ledger, {
    ledger: ledger,
    setLedger: setLedger,
    fw: fw
  }), /*#__PURE__*/React.createElement("p", {
    className: "foot"
  }, "These are estimates, not predictions with a proven record \u2014 the \"How I'm doing\" tab is where you find out whether they're any good. Checks that turn up no real data count for nothing. Prediction markets are usually priced about right, so a big gap usually means I'm missing a fact rather than that you've found free money. The decisions are yours."), /*#__PURE__*/React.createElement("p", {
    className: "foot",
    style: {
      opacity: .5,
      marginTop: 8
    }
  }, "Build ", BUILD, " \xB7 a prediction engine, graded daily")));
}

/* ---------------- Analyze ---------------- */
function Spark({
  points,
  w = 120,
  h = 26
}) {
  if (!points || points.length < 2) return null;
  const ps = points.map(pt => pt.p);
  const min = Math.min.apply(null, ps),
    max = Math.max.apply(null, ps);
  const span = Math.max(1e-6, max - min);
  const d = points.map((pt, i) => {
    const x = i / (points.length - 1) * w;
    const y = h - (pt.p - min) / span * (h - 4) - 2;
    return (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
  }).join(" ");
  const up = ps[ps.length - 1] >= ps[0];
  return /*#__PURE__*/React.createElement("svg", {
    width: w,
    height: h,
    style: {
      display: "block",
      marginTop: 3
    },
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: d,
    fill: "none",
    stroke: up ? "var(--moss)" : "var(--rose)",
    strokeWidth: "1.5"
  }));
}
function Analyze({
  fw,
  onSave,
  pending,
  clearPending,
  ledger
}) {
  const [url, setUrl] = useState(() => {
    try {
      return localStorage.getItem("cd:lastUrl") || "";
    } catch {
      return "";
    }
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
  const [legs, setLegs] = useState(null); // parlay legs, resolved
  const [legLive, setLegLive] = useState(null); // per-leg live states
  const legsRef = useRef(null);
  const legLiveRef = useRef(null);
  useEffect(() => {
    if (!pending) return;
    setBook({
      venue: pending.venue,
      event: pending.question,
      markets: [pending],
      source: "live API"
    });
    setMarket(pending);
    setCat(guessCategory(pending.question + " " + pending.name));
    setUrl(pending.link || "");
    setResult(null);
    setFindings({});
    setSources([]);
    setXp(null);
    setDepth(null);
    setLive(null);
    setAudit(null);
    setPhase("ready");
    clearPending();
  }, [pending]);
  useEffect(() => {
    if (!market) return;
    let alive = true;
    setHist(null);
    histRef.current = null;
    fetchBook(market).then(b => {
      if (alive) setDepth(b);
    });
    fetchHistory(market).then(h => {
      if (alive) {
        setHist(h);
        histRef.current = h;
      }
    });
    return () => {
      alive = false;
    };
  }, [market]);

  // Live score, refreshed every 30s while the game is actually in progress.
  useEffect(() => {
    if (!market) return;
    let alive = true,
      timer = null;
    const tick = async () => {
      const l = await fetchLive(market);
      if (!alive) return;
      setLive(l);
      liveRef.current = l;
      if (l && l.sides && !l.none && !l.error) setCat(c => c === "general" ? "sports" : c);
      // Live games poll every 10 seconds; scheduled ones check every 45 so
      // the board flips to live on its own at first pitch or tip-off.
      if (l && l.state === "in") timer = setTimeout(tick, 10000);else if (l && l.state === "pre") timer = setTimeout(tick, 45000);
    };
    tick();
    // Coming back to the tab refreshes the board immediately.
    const onVis = () => {
      if (!document.hidden) {
        if (timer) clearTimeout(timer);
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [market]);

  // Parlay legs: resolve once per market, then poll every leg's own live
  // game — the combo's title carries none of this.
  useEffect(() => {
    setLegs(null);
    setLegLive(null);
    legsRef.current = null;
    legLiveRef.current = null;
    if (!market || !market.legs) return;
    let alive = true,
      timer = null;
    const tick = async () => {
      const ls = await resolveLegs(market);
      if (!alive || !ls) return;
      setLegs(ls);
      legsRef.current = ls;
      const lv = await Promise.all(ls.map(l => fetchLive({
        id: l.ticker,
        question: l.question,
        name: l.name
      }).catch(() => null)));
      if (!alive) return;
      setLegLive(lv);
      legLiveRef.current = lv;
      timer = setTimeout(tick, lv.some(x => x && x.state === "in") ? 12000 : 45000);
    };
    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [market]);
  const busy = ["fetching", "auditing", "researching", "contrarian", "synthesizing", "verifying"].includes(phase);
  const conf = fw[cat];
  async function loadBook(inputUrl) {
    const target = (inputUrl != null ? inputUrl : url).trim();
    setError(null);
    setBook(null);
    setMarket(null);
    setResult(null);
    setFindings({});
    setSources([]);
    setXp(null);
    setDepth(null);
    setLive(null);
    setAudit(null);
    const p = parseUrl(target);
    if (p.error) {
      setError(p.error);
      setPhase("idle");
      return;
    }
    setPhase("fetching");
    try {
      const b = p.venue === "Polymarket" ? await fetchPolymarket(p) : await fetchKalshi(p);
      try {
        localStorage.setItem("cd:lastUrl", target);
      } catch {/* private mode */}
      setBook(b);
      setCat(guessCategory(b.event + " " + b.markets.map(m => m.name).join(" ")));
      if (b.markets.length === 1) {
        setMarket(b.markets[0]);
        setPhase("ready");
      } else setPhase("choosing");
    } catch (e) {
      setError(p.venue + " didn't return data: " + e.message + ". Check the URL is a market page and try again.");
      setPhase("idle");
    }
  }

  // Runs the other-venue price hunt and returns the result as well as
  // setting UI state, so analyze() can feed it into synthesis directly.
  async function crossPlatform(m) {
    const other = m.venue === "Kalshi" ? "Polymarket" : "Kalshi";
    setXp({
      status: "searching"
    });
    try {
      let candidates = [];
      if (other === "Kalshi") {
        const r = await fetch(px("https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=200"));
        const d = await r.json();
        candidates = (d.markets || []).map(kaMarket).filter(x => x.price !== null);
      } else {
        const r = await fetch(px("https://gamma-api.polymarket.com/events?closed=false&limit=120&order=volume24hr&ascending=false"));
        const d = await r.json();
        (Array.isArray(d) ? d : []).forEach(ev => (ev.markets || []).forEach(mm => {
          const p = pmMarket(mm, ev);
          if (p.price !== null) candidates.push(p);
        }));
      }
      const target = m.question + " " + m.name;
      const top = candidates.map(c => ({
        c,
        s: overlap(target, c.question + " " + c.name)
      })).filter(x => x.s > 0.1).sort((a, b) => b.s - a.s).slice(0, 30);
      if (!top.length) {
        setXp({
          status: "none"
        });
        return null;
      }
      const list = top.map((x, i) => i + ". " + x.c.question + " | " + x.c.name + " | " + x.c.price.toFixed(1) + "c").join("\n");
      const r = await callClaude(`A trader holds this contract on ${m.venue}:
"${m.question}" — outcome: ${m.name}, priced ${m.price.toFixed(1)}c.

Here are open ${other} contracts. Pick the one that resolves on the SAME underlying event with the SAME direction, or none if there is no true equivalent. Being strict matters more than finding a match: different resolution dates, thresholds or sources mean it is NOT equivalent.

${list}

Return ONLY: {"index":<number or null>,"caveat":"<max 25 words on any resolution-criteria difference, or 'criteria appear identical'>"}`, {
        maxTokens: 400
      });
      const j = extractJson(r.text);
      if (j.index === null || j.index === undefined || !top[j.index]) {
        setXp({
          status: "none"
        });
        return null;
      }
      let match = top[j.index].c;
      // Direction guard: on a two-sided event the matcher can pick the
      // OTHER team's contract, which flips every displayed number. If a
      // sibling outcome of the same matched event names OUR outcome
      // better, take the sibling instead.
      if (m.name) {
        const sibs = top.filter(x => x.c.question === match.question && x.c.id !== match.id);
        const mine = overlap(m.name, match.name || "");
        let bestSib = null,
          bestSibS = mine;
        sibs.forEach(x => {
          const s = overlap(m.name, x.c.name || "");
          if (s > bestSibS + 0.1) {
            bestSibS = s;
            bestSib = x.c;
          }
        });
        if (bestSib) match = bestSib;
      }
      const found = {
        status: "found",
        match,
        gap: match.price - m.price,
        caveat: j.caveat || ""
      };
      setXp(found);
      return found;
    } catch (e) {
      setXp({
        status: "error",
        msg: e.message
      });
      return null;
    }
  }
  async function analyze(m0, c0) {
    const m = m0 || market,
      c = c0 || cat;
    if (!m) return;
    const id = ++runId.current;
    setError(null);
    setResult(null);
    setFindings({});
    setSources([]);
    setAudit(null);
    setLastSaved(null);
    const lib = fw[c];
    const active = lib.items.filter(p => p.enabled);
    const byN = Object.fromEntries(lib.items.map(p => [p.n, p]));
    const collected = {};
    const allSources = [];
    const absorb = res => {
      if (!res) return;
      (res.sources || []).forEach(s => allSources.push(s));
      try {
        extractJson(res.text).pillars.forEach(p => {
          if (!p || !p.n) return;
          p.strength = clamp(Math.round(Number(p.strength) || 0), 0, 3);
          const iv = p.implied == null ? NaN : Number(p.implied);
          p.implied = Number.isFinite(iv) ? clamp(iv, 1, 99) : null;
          collected[p.n] = p;
        });
      } catch {/* other batches still stand */}
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
      const sibs = book.markets.filter(x => x.id !== m.id).slice(0, 6);
      if (sibs.length) sibLine = "\nOTHER OUTCOMES ON THIS EVENT: " + sibs.map(s => s.name + " " + s.price.toFixed(1) + "c").join(", ") + ". The full set behaves like a probability distribution — check this outcome's price for consistency with its rivals.";
    }
    const spread = marketSpread(m);
    const thin = isThin(m);
    const liqLine = spread != null || m.volume ? "\nLIQUIDITY: " + (spread != null ? "bid-ask spread " + spread.toFixed(0) + "c" : "") + (m.volume ? (spread != null ? ", " : "") + "volume $" + Math.round(m.volume).toLocaleString() : "") + (thin ? ". This market is thin — prices are noisier and fills are worse; demand more edge." : ".") : "";
    const liveNow = () => liveSummary(liveRef.current) + legsLiveSummary(legsRef.current, legLiveRef.current) + histSummary(histRef.current) + sibLine + liqLine;

    // A parlay's title names no sports or opponents — resolve its legs
    // FIRST so every prompt prices the actual teams, not a guess.
    if (m.legs) {
      const ls = legsRef.current || (await resolveLegs(m));
      if (id !== runId.current) return;
      if (ls) {
        legsRef.current = ls;
        m.legsInfo = ls;
        setLegs(ls);
      }
    }

    // Step 0: read the fine print before researching, so every later step
    // prices the contract that actually exists rather than the headline.
    let auditJ = null;
    if (m.rules || m.legsInfo) {
      setPhase("auditing");
      try {
        const ar = await callClaude(auditPrompt(m), {
          model: MODELS.judge,
          maxTokens: 600
        });
        if (id !== runId.current) return;
        auditJ = extractJson(ar.text);
        setAudit(auditJ);
      } catch {/* research can proceed without it */}
    }
    const auditLine = auditJ ? (auditJ.summary || "") + ((auditJ.traps || []).length ? " Watch for: " + auditJ.traps.join(" | ") : "") : "";
    const lFresh = await livePromise;
    if (lFresh) {
      setLive(lFresh);
      liveRef.current = lFresh;
    }
    if (id !== runId.current) return;
    setPhase("researching");
    const groups = lib.groups.map(g => g.map(n => byN[n]).filter(p => p && p.enabled)).filter(g => g.length);
    const batches = await Promise.allSettled(groups.map(g => callClaude(researchPrompt(g, m, liveNow(), auditLine), {
      search: true
    })));
    if (id !== runId.current) return;
    batches.forEach((b, i) => {
      if (b.status === "fulfilled") absorb(b.value);else groups[i].forEach(p => {
        collected[p.n] = {
          n: p.n,
          finding: "Research request failed — left out of the estimate.",
          signal: "NEUTRAL",
          strength: 0,
          implied: null
        };
      });
    });
    setFindings({
      ...collected
    });
    setSources([...allSources]);
    const summarize = ns => ns.map(n => {
      const p = collected[n],
        d = byN[n];
      if (!d) return "";
      return n + ". " + d.name + " (weight " + d.weight + ") [" + (p ? p.signal : "SKIPPED") + ", strength " + (p ? p.strength : 0) + "]: " + (p ? p.finding : "not run");
    }).filter(Boolean).join("\n");
    const contra = byN[9] && byN[9].enabled ? byN[9] : null;
    const firstEight = active.filter(p => p.n !== 9).map(p => p.n);
    if (contra) {
      setPhase("contrarian");
      try {
        const cr = await callClaude(contrarianPrompt(contra, m, summarize(firstEight), liveNow(), auditLine), {
          search: true
        });
        if (id !== runId.current) return;
        absorb(cr);
      } catch {
        collected[9] = {
          n: 9,
          finding: "Contrarian pass failed — treat confidence as optimistic.",
          signal: "NEUTRAL",
          strength: 0,
          implied: null
        };
      }
      setFindings({
        ...collected
      });
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
      const anchorInputs = {
        ...collected
      };
      const anchorByN = {
        ...byN
      };
      // Independent hard signals — a live win-probability model and a
      // de-vigged sportsbook moneyline — join the anchor as heavyweight
      // inputs. Both are quantitative and independent of the web-search
      // frameworks, so they earn full weight.
      const signals = []; // {label, prob} for display and disagreement checks
      if (lNow && lNow.impliedCents != null && lNow.state !== "pre" && !lNow.disagree) {
        anchorInputs[99] = {
          n: 99,
          strength: 3,
          implied: clamp(lNow.impliedCents, 1, 99)
        };
        anchorByN[99] = {
          n: 99,
          enabled: true,
          weight: 1.5
        };
        signals.push({
          label: "Live win prob",
          prob: lNow.impliedCents
        });
      }
      // The sportsbook line only feeds the anchor when it's current: The
      // Odds API consensus (widest pool, and its in-play quotes stay fresh
      // during a game) first, then ESPN's pregame consensus — but a frozen
      // pregame line NEVER enters mid-game, and any book line is dropped
      // once a live win-probability model exists.
      const liveWinPresent = !!(lNow && lNow.impliedCents != null && lNow.state === "in" && !lNow.disagree);
      let bookProb = null,
        bookN = 1,
        bookLive = false;
      if (!liveWinPresent && lNow && lNow.mySide) {
        const inGame = lNow.state === "in";
        const ob = lNow.oddsBook;
        const obFresh = !!(ob && ob.updated && Date.now() - ob.updated < ODDS_FRESH_MS);
        if (ob && (!inGame || obFresh)) {
          bookProb = lNow.mySide.home ? ob.home : ob.away;
          bookN = ob.books;
          bookLive = inGame;
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
        anchorInputs[98] = {
          n: 98,
          strength: 3,
          implied: clamp(bookProb, 1, 99)
        };
        anchorByN[98] = {
          n: 98,
          enabled: true,
          weight: sharpBoost
        };
        signals.push({
          label: "Book line (" + bookN + (bookN === 1 ? " book" : " books") + (bookLive ? ", in-play)" : ")"),
          prob: bookProb
        });
      }
      // Parlay: the product of each leg's own best read (settled result,
      // live win prob, else the leg's market price) is deterministic and
      // beats anything a web search can produce for a combo.
      if (m.legsInfo) {
        const cmb = legsCombined(legsRef.current || m.legsInfo, legLiveRef.current);
        if (cmb && cmb.priced >= m.legsInfo.length) {
          anchorInputs[97] = {
            n: 97,
            strength: 3,
            implied: clamp(cmb.prob, 1, 99)
          };
          anchorByN[97] = {
            n: 97,
            enabled: true,
            weight: 2
          };
          signals.push({
            label: "Legs combined (" + m.legsInfo.length + " legs" + (cmb.live ? ", live" : "") + ")",
            prob: cmb.prob
          });
        }
      }
      const anchor = anchorFair(m.price, anchorInputs, anchorByN, relMult);

      // How far apart the independent signals sit — used to temper confidence.
      const signalSpread = signals.length >= 2 ? Math.max.apply(null, signals.map(s => s.prob)) - Math.min.apply(null, signals.map(s => s.prob)) : 0;
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
      const prev = (ledger || []).find(e => e.marketId === m.id && e.venue === m.venue);
      if (prev) {
        extra += `\nPRIOR ANALYSIS (${new Date(prev.ts).toISOString().slice(0, 10)}): the desk priced this at ${prev.fair}c when the market was ${prev.price}c (call: ${prev.call}). Weigh what has actually changed since.`;
      }

      // Self-consistency: price the contract three independent times and take
      // the median. A single LLM estimate is noisy; the median of several
      // collapses that variance and is markedly better calibrated.
      const prompt = synthPrompt(m, summarize(active.map(p => p.n)), extra, anchor, auditLine);
      const runs = await Promise.allSettled([0, 1, 2].map(() => callClaude(prompt, {
        model: MODELS.judge,
        maxTokens: 1400
      })));
      if (id !== runId.current) return;
      const samples = [];
      runs.forEach(r => {
        if (r.status !== "fulfilled") return;
        try {
          const parsed = extractJson(r.value.text);
          if (Number.isFinite(Number(parsed.fairValue))) samples.push(parsed);
        } catch {/* skip an unparseable sample */}
      });
      if (!samples.length) throw new Error("the pricing step returned no usable estimate");

      // Each sample clamped to the anchor, then take the median fair value;
      // keep the narrative from whichever sample sits closest to that median.
      const fairs = samples.map(s => clamp(clamp(Number(s.fairValue), anchor - 10, anchor + 10), 0.5, 99.5));
      let fair = median(fairs);
      const sampleSpread = Math.max.apply(null, fairs) - Math.min.apply(null, fairs);
      let j = samples[0],
        bestGap = Infinity;
      samples.forEach((s, i) => {
        const g = Math.abs(fairs[i] - fair);
        if (g < bestGap) {
          bestGap = g;
          j = s;
        }
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
      let entry = side === "YES" ? m.ask != null ? m.ask : m.price : 100 - (m.bid != null ? m.bid : m.price);
      if (depth) {
        if (side === "YES" && depth.asks.length) {
          const w = walkBook(depth.asks, size);
          if (w) entry = w.avg;
        }
        if (side === "NO" && depth.bids.length) {
          const w = walkBook(depth.bids, size);
          if (w) entry = 100 - w.avg;
        }
      }
      entry = clamp(entry, 0.5, 99.5);
      const fee = takerFee(m.venue, entry);
      const fairSide = side === "YES" ? fair : 100 - fair;
      const netEdge = fairSide - entry - fee;
      const strong = Object.values(collected).filter(p => p && p.strength >= 2).length;
      const contraF = collected[9];
      const vetoed = !!(contraF && (contraF.strength || 0) >= 2 && (side === "YES" && contraF.signal === "NO" || side === "NO" && contraF.signal === "YES"));
      // Trade bar: price-scaled minimum, +4c when our own risk officer
      // found solid evidence for the other side, +2c in thin markets.
      const bar = minNetEdge(m.price) + (vetoed ? 4 : 0) + (thin ? 2 : 0);
      let call = netEdge >= bar && strong >= 3 ? "BUY " + side : "PASS";
      let confidence = j.confidence || "LOW";
      if (auditJ && auditJ.severity === "HIGH" && confidence === "HIGH") confidence = "MEDIUM";
      // Independent signals or the pricing samples disagreeing is a real
      // uncertainty signal — don't let the model claim more than it earned.
      const step = cf => cf === "HIGH" ? "MEDIUM" : cf === "MEDIUM" ? "LOW" : "LOW";
      if (signalSpread > 12 || sampleSpread > 10) confidence = step(confidence);
      if (calib.active && calib.k <= 0.6 && confidence === "HIGH") confidence = "MEDIUM";

      // Final red-team pass: a trade only stands if it survives an active
      // attempt to refute it with fresh searches.
      let verify = null;
      if (call !== "PASS") {
        setPhase("verifying");
        try {
          const vr = await callClaude(verifyPrompt(m, side, entry, fairSide, j.thesis || "", liveNow(), auditLine), {
            search: true,
            maxTokens: 1200
          });
          if (id !== runId.current) return;
          (vr.sources || []).forEach(s => allSources.push(s));
          verify = extractJson(vr.text);
        } catch {
          verify = {
            verdict: "UNCERTAIN",
            reason: "The verification call failed, so this trade is unchecked."
          };
        }
        if (verify.verdict === "REFUTE") call = "PASS";else if (verify.verdict === "UNCERTAIN") confidence = "LOW";
      }

      // Half-Kelly on the fee-adjusted real entry, capped by confidence.
      const cCost = clamp(entry + fee, 0.5, 99.5) / 100;
      const kelly = Math.max(0, (fairSide / 100 - cCost) / (1 - cCost));
      const cap = confidence === "HIGH" ? 20 : confidence === "MEDIUM" ? 12 : 5;
      const stake = call === "PASS" ? 0 : clamp(kelly / 2 * 100, 0, cap);
      const res = {
        fair,
        anchor,
        edge,
        netEdge,
        entry,
        fee,
        bar,
        call,
        side,
        stake,
        confidence,
        thesis: j.thesis || "",
        drivers: j.drivers || [],
        risks: j.risks || [],
        resolution: j.resolution || "",
        strong,
        verify,
        vetoed,
        thin,
        signals,
        signalSpread,
        sampleSpread,
        calib
      };
      setResult(res);
      setSources([...allSources]);
      setPhase("done");
      const saved = {
        id: uid(),
        ts: Date.now(),
        venue: m.venue,
        marketId: m.id,
        slug: m.slug || null,
        question: m.question,
        name: m.name,
        category: c,
        price: m.price,
        fair,
        edge: Math.round(edge * 10) / 10,
        netEdge: Math.round(netEdge * 10) / 10,
        entry: Math.round(entry * 10) / 10,
        anchor: Math.round(anchor * 10) / 10,
        verify: verify ? verify.verdict : null,
        call,
        confidence: res.confidence,
        close: m.close,
        link: m.link,
        status: "open",
        outcome: null,
        pillars: active.map(p => {
          const f = collected[p.n] || {};
          return {
            n: p.n,
            name: p.name,
            signal: f.signal || "NEUTRAL",
            strength: f.strength || 0,
            implied: f.implied ?? null
          };
        })
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
  const pos = v => clamp(v, 0, 100);
  const railColor = result ? result.edge > 0 ? "var(--amber)" : "var(--rose)" : "var(--dim)";
  const callColor = !result ? "var(--bone)" : result.call === "PASS" ? "var(--dim)" : result.side === "YES" ? "var(--amber)" : "var(--rose)";
  const fill = depth && depth.asks.length ? walkBook(depth.asks, size) : null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "bar"
  }, /*#__PURE__*/React.createElement("input", {
    value: url,
    onChange: e => setUrl(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter" && !busy) loadBook();
    },
    placeholder: "https://polymarket.com/event/\u2026   or   https://kalshi.com/markets/\u2026",
    "aria-label": "Market URL"
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn",
    onClick: () => loadBook(),
    disabled: busy
  }, phase === "fetching" ? "Loading" : "Load market")), error && /*#__PURE__*/React.createElement("div", {
    className: "panel err"
  }, error), !book && !error && phase === "idle" && /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("p", {
    className: "sect"
  }, "How this works"), /*#__PURE__*/React.createElement("p", {
    className: "help"
  }, "Three steps, about a minute of waiting on the third."), /*#__PURE__*/React.createElement("div", {
    className: "start"
  }, /*#__PURE__*/React.createElement("span", {
    className: "n"
  }, "1"), /*#__PURE__*/React.createElement("span", {
    className: "t"
  }, /*#__PURE__*/React.createElement("b", null, "Give me a market."), " Paste a link from Kalshi or Polymarket in the box above, or open", /*#__PURE__*/React.createElement("b", null, " Find a market"), " and pick one from the list."), /*#__PURE__*/React.createElement("span", {
    className: "n"
  }, "2"), /*#__PURE__*/React.createElement("span", {
    className: "t"
  }, /*#__PURE__*/React.createElement("b", null, "I read the fine print, then research it nine ways."), " Polls, injuries, weather models, order books \u2014 whichever nine fit the topic. You can see and edit all of them under ", /*#__PURE__*/React.createElement("b", null, "What I check"), "."), /*#__PURE__*/React.createElement("span", {
    className: "n"
  }, "3"), /*#__PURE__*/React.createElement("span", {
    className: "t"
  }, /*#__PURE__*/React.createElement("b", null, "You get a price and a verdict."), " What the contract is worth versus what it really costs to fill after fees \u2014 and anything I'd actually buy has to survive a final attempt to knock it down first.")), /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      marginTop: 18
    }
  }, "Try one of these:"), /*#__PURE__*/React.createElement("button", {
    className: "example",
    onClick: () => {
      setUrl("https://polymarket.com/event/will-the-us-invade-iran-before-2027");
      loadBook("https://polymarket.com/event/will-the-us-invade-iran-before-2027");
    }
  }, "polymarket.com/event/will-the-us-invade-iran-before-2027"), /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      marginTop: 14
    }
  }, "Each analysis costs roughly 30\u201350 cents in API credit and takes a minute or two.")), book && phase === "choosing" && /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, book.venue, " \xB7 ", book.markets.length, " contracts on this event"), /*#__PURE__*/React.createElement("p", {
    className: "q",
    style: {
      marginBottom: 16
    }
  }, book.event), book.markets.slice(0, 30).map(m => /*#__PURE__*/React.createElement("button", {
    key: m.id,
    className: "sel",
    onClick: () => {
      setMarket(m);
      setPhase("ready");
    }
  }, /*#__PURE__*/React.createElement("span", null, m.name === m.question ? m.question : m.question + " — " + m.name, /*#__PURE__*/React.createElement("span", {
    className: "sub"
  }, m.volume ? "vol " + Math.round(m.volume).toLocaleString() : "no volume", m.close ? " · closes " + String(m.close).slice(0, 10) : "")), /*#__PURE__*/React.createElement("span", {
    className: "px"
  }, m.price.toFixed(0), "c"))), /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      marginTop: 10
    }
  }, "Pick the outcome you want priced")), market && phase !== "choosing" && /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, market.venue, " \xB7 ", book.source, " \xB7 ", market.id), /*#__PURE__*/React.createElement("p", {
    className: "q"
  }, market.question), market.name !== market.question && /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      marginTop: 8
    }
  }, "Outcome: ", market.name), /*#__PURE__*/React.createElement("div", {
    className: "meta"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "Costs now"), /*#__PURE__*/React.createElement("span", {
    className: "v",
    style: {
      color: "var(--cyan)"
    }
  }, market.price.toFixed(1), "c")), market.bid != null && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "Bid / ask"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, market.bid, "\u2013", market.ask)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "Volume"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, market.volume ? "$" + Math.round(market.volume).toLocaleString() : "—")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "Settles"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, market.close ? String(market.close).slice(0, 10) : "—")), hist && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "24h move"), /*#__PURE__*/React.createElement("span", {
    className: "v",
    style: {
      color: hist.change24h > 0.5 ? "var(--moss)" : hist.change24h < -0.5 ? "var(--rose)" : "var(--dim)"
    }
  }, hist.change24h >= 0 ? "+" : "", hist.change24h.toFixed(1), "c")), hist && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "Last 7 days"), /*#__PURE__*/React.createElement(Spark, {
    points: hist.points
  })), isThin(market) && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "Liquidity"), /*#__PURE__*/React.createElement("span", {
    className: "v",
    style: {
      color: "var(--amber)"
    }
  }, "thin"))), audit && !result && /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: "var(--bone)"
    }
  }, "Fine print:"), " ", audit.summary, audit.traps && audit.traps.length > 0 ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--amber)"
    }
  }, " \xB7 ", audit.traps[0]) : null), !result && !busy && (() => {
    const prev = (ledger || []).find(e => e.marketId === market.id && e.venue === market.venue);
    return prev ? /*#__PURE__*/React.createElement("p", {
      className: "help",
      style: {
        marginTop: 12
      }
    }, "I've priced this one before (", new Date(prev.ts).toISOString().slice(0, 10), "): said", " ", /*#__PURE__*/React.createElement("span", {
      className: "mono"
    }, prev.call), " with fair ", Number(prev.fair).toFixed(0), "c against a", " ", Number(prev.price).toFixed(0), "c price. Re-running shows what's changed.") : null;
  })(), live && !live.error && !live.none && live.sides && /*#__PURE__*/React.createElement("div", {
    className: "sb"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sb-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sb-badge" + (live.state === "in" ? " live" : "")
  }, live.state === "in" && /*#__PURE__*/React.createElement("span", {
    className: "pulse"
  }), live.state === "in" ? "LIVE" : live.state === "post" ? "FINAL" : "UPCOMING"), /*#__PURE__*/React.createElement("span", {
    className: "sb-detail"
  }, live.league, live.detail ? " · " + live.detail : "", live.state === "in" && live.clock ? " · " + live.clock : "")), live.sides.map((sd, i) => {
    const best = Math.max.apply(null, live.sides.map(x => Number(x.score) || 0));
    const lead = (Number(sd.score) || 0) === best && best > 0;
    return (
      /*#__PURE__*/
      // Keyed on the score so a scoring play re-mounts the row and
      // fires the amber flash animation.
      React.createElement("div", {
        key: i + ":" + (sd.score ?? "-") + ":" + (sd.sets || []).join(","),
        className: "sb-row" + (lead ? " lead" : "")
      }, /*#__PURE__*/React.createElement("span", {
        className: "sb-abbr"
      }, sd.abbr || sd.name.slice(0, 3).toUpperCase()), /*#__PURE__*/React.createElement("span", {
        className: "sb-name"
      }, sd.name, sd.home ? /*#__PURE__*/React.createElement("i", {
        className: "sb-home"
      }, "home") : null), sd.sets && sd.sets.length > 0 ? /*#__PURE__*/React.createElement("span", {
        className: "sb-sets"
      }, sd.sets.map((v, j) => /*#__PURE__*/React.createElement("b", {
        key: j
      }, v))) : /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", {
        className: "sb-score"
      }, sd.score ?? "–"))
    );
  }), (() => {
    const w = likelyWinner(live, market.name, market.price);
    if (!w) return null;
    const col = w.final ? "var(--moss)" : w.pct >= 65 ? "var(--amber)" : "var(--dim)";
    return /*#__PURE__*/React.createElement("div", {
      className: "sb-call"
    }, /*#__PURE__*/React.createElement("span", {
      className: "who",
      style: {
        color: col
      }
    }, w.name), w.final ? /*#__PURE__*/React.createElement("span", null, "wins \u2014 final") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", null, "projected to win"), /*#__PURE__*/React.createElement("b", {
      style: {
        color: col
      }
    }, w.pct.toFixed(0), "%"), w.pct < 58 && /*#__PURE__*/React.createElement("span", null, "\u2014 close to a coin flip"), w.market ? /*#__PURE__*/React.createElement("span", {
      className: "srcchip"
    }, "market price") : /*#__PURE__*/React.createElement("span", {
      className: "srcchip"
    }, "live model")));
  })(), (live.extra || live.downDistance) && /*#__PURE__*/React.createElement("div", {
    className: "sb-sit"
  }, live.downDistance || "", live.possession ? (live.downDistance ? " · " : "") + "ball: " + live.possession : "", live.extra ? (live.downDistance || live.possession ? " · " : "") + live.extra : ""), live.impliedCents != null && live.mySide && /*#__PURE__*/React.createElement("div", {
    className: "sb-wp"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      marginBottom: 6
    }
  }, "Win probability \xB7 ", live.mySide.name, " ", live.impliedCents.toFixed(1), "%", /*#__PURE__*/React.createElement("span", {
    style: {
      color: Math.abs(live.impliedCents - market.price) > 4 ? "var(--amber)" : "var(--dim)"
    }
  }, "  vs market " + market.price.toFixed(0) + "c (", live.impliedCents - market.price > 0 ? "+" : "", (live.impliedCents - market.price).toFixed(1), "c", ")")), /*#__PURE__*/React.createElement("div", {
    className: "wp-bar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wp-fill",
    style: {
      width: clamp(live.impliedCents, 0, 100) + "%"
    }
  }))), live.lastPlay && /*#__PURE__*/React.createElement("div", {
    className: "sb-play"
  }, live.lastPlay), /*#__PURE__*/React.createElement("div", {
    className: "sb-foot"
  }, live.oddsBook && live.mySide && /*#__PURE__*/React.createElement("span", {
    className: "srcchip",
    style: {
      color: "var(--moss)",
      borderColor: "rgba(127,185,139,.45)"
    }
  }, live.oddsBook.books, "-book consensus: ", live.mySide.name, " ", (live.mySide.home ? live.oddsBook.home : live.oddsBook.away).toFixed(0), "%", live.oddsBook.disp > 6 ? " · books split" : ""), live.odds && /*#__PURE__*/React.createElement("span", {
    className: "srcchip",
    style: {
      color: "var(--cyan)",
      borderColor: "rgba(111,179,210,.45)"
    }
  }, live.odds.provider, ": ", live.odds.details || "no line", live.odds.overUnder != null ? " · O/U " + live.odds.overUnder : ""), live.sources.map(sv => /*#__PURE__*/React.createElement("span", {
    key: sv.name,
    className: "srcchip" + (live.disagree ? " bad" : " ok")
  }, sv.name, " \xB7 ", sv.line)), /*#__PURE__*/React.createElement("span", {
    className: "srcchip"
  }, "as of ", new Date(live.fetched).toLocaleTimeString()), live.state === "in" && /*#__PURE__*/React.createElement("span", {
    className: "srcchip",
    style: {
      color: "var(--rose)",
      borderColor: "rgba(228,112,126,.45)"
    }
  }, "updating every 10s")), live.disagree && /*#__PURE__*/React.createElement("p", {
    className: "thesis",
    style: {
      color: "var(--rose)",
      margin: "0 16px 14px",
      fontSize: 13
    }
  }, "The feeds disagree on the score. One is lagging \u2014 check the broadcast before acting on this.")), live && live.none && /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      marginTop: 14
    }
  }, live.league, ": no matching game on today's scoreboard"), legs && /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      marginTop: 14,
      background: "rgba(0,0,0,.14)"
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "sect",
    style: {
      margin: 0
    }
  }, "Parlay legs \u2014 every one must hit"), legs.map((l, i) => {
    const ll = legLive && legLive[i] && !legLive[i].none ? legLive[i] : null;
    const part = legsCombined(legs, legLive);
    const pp = part && part.parts[i];
    const scoreLine = ll && ll.sides ? ll.sides.map(s => (s.abbr || s.name.slice(0, 3)) + " " + (s.score != null ? s.score : "-")).join(" · ") + (ll.state === "in" ? " · LIVE" + (ll.clock ? " " + ll.clock : "") : ll.state === "post" ? " · FINAL" : " · upcoming") : "no live feed yet";
    return /*#__PURE__*/React.createElement("div", {
      key: l.ticker,
      className: "score-row",
      style: {
        borderBottom: "1px solid rgba(65,75,99,.35)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "who",
      style: {
        fontSize: 13.5
      }
    }, l.side, " \xB7 ", /*#__PURE__*/React.createElement("b", null, l.name), /*#__PURE__*/React.createElement("span", {
      className: "sub",
      style: {
        display: "block"
      }
    }, (l.league || "?") + " · " + l.question + " · " + scoreLine)), /*#__PURE__*/React.createElement("span", {
      className: "pts",
      style: {
        fontSize: 14,
        color: pp && pp.src === "live" ? "var(--violet)" : undefined
      }
    }, pp ? pp.p.toFixed(0) + "%" : "…", /*#__PURE__*/React.createElement("span", {
      className: "sub",
      style: {
        display: "block"
      }
    }, pp ? pp.src : "")));
  }), (() => {
    const cmb = legsCombined(legs, legLive);
    if (!cmb) return null;
    return /*#__PURE__*/React.createElement("p", {
      className: "help",
      style: {
        marginTop: 10,
        color: cmb.dead ? "var(--rose)" : undefined
      }
    }, cmb.dead ? "A leg has LOST — this parlay can no longer win." : "Multiplying the legs: the parlay is worth about " + cmb.prob.toFixed(0) + "c right now" + (cmb.live ? " (using live win odds)" : " (using each leg's own market price)") + ".");
  })()), /*#__PURE__*/React.createElement("div", {
    className: "cmp-box"
  }, (() => {
    const rows = [{
      label: "Market price",
      v: market.price,
      color: "var(--cyan)",
      note: "what it costs now"
    }];
    if (live && live.impliedCents != null) {
      rows.push({
        label: "Live win prob",
        v: live.impliedCents,
        color: "var(--violet)",
        note: "in-game model, right now"
      });
    }
    // The Odds API wide consensus gets its own row whenever we have
    // it — it's the strongest external read and should be VISIBLE.
    if (live && live.oddsBook && live.mySide) {
      const ob = live.oddsBook;
      const bp = live.mySide.home ? ob.home : ob.away;
      const fresh = ob.updated && Date.now() - ob.updated < ODDS_FRESH_MS;
      rows.push({
        label: "Sportsbooks",
        v: bp,
        color: "var(--moss)",
        note: ob.books + " book" + (ob.books === 1 ? "" : "s") + ", vig removed" + (live.state === "in" ? fresh ? ", in-play" : ", pregame" : "")
      });
    } else if (live && live.impliedCents == null && live.bookProb && live.mySide) {
      const bp = live.mySide.home ? live.bookProb.home : live.bookProb.away;
      const nb = live.bookProb.books || 1;
      rows.push({
        label: "Sportsbooks",
        v: bp,
        color: "var(--moss)",
        note: nb + " book" + (nb === 1 ? "" : "s") + " via ESPN, vig removed"
      });
    }
    if (legs) {
      const cmb = legsCombined(legs, legLive);
      if (cmb) rows.push({
        label: "Legs combined",
        v: cmb.prob,
        color: "var(--violet)",
        note: legs.length + " legs multiplied" + (cmb.live ? ", live" : "") + (cmb.dead ? " — a leg LOST" : "")
      });
    }
    if (xp && xp.status === "found") {
      rows.push({
        label: xp.match.venue,
        v: xp.match.price,
        color: "var(--moss)",
        note: "same bet, other exchange"
      });
    }
    if (result) {
      rows.push({
        label: "My fair value",
        v: result.fair,
        color: railColor,
        strong: true,
        note: (result.edge > 0 ? "+" : "") + result.edge.toFixed(1) + "c vs market"
      });
    }
    return rows.map(r => /*#__PURE__*/React.createElement("div", {
      key: r.label,
      className: "cmp-row" + (r.strong ? " strong" : "")
    }, /*#__PURE__*/React.createElement("span", {
      className: "cl"
    }, r.label), /*#__PURE__*/React.createElement("div", {
      className: "cmp-track"
    }, [25, 50, 75].map(t => /*#__PURE__*/React.createElement("div", {
      key: t,
      className: "cmp-tick",
      style: {
        left: t + "%"
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "cmp-fill",
      style: {
        width: pos(r.v) + "%",
        background: r.color,
        opacity: r.strong ? 0.95 : 0.55
      }
    })), /*#__PURE__*/React.createElement("span", {
      className: "cv",
      style: {
        color: r.color
      }
    }, r.v.toFixed(0), "% chance", /*#__PURE__*/React.createElement("span", {
      className: "sub2"
    }, r.note))));
  })(), busy && !result && /*#__PURE__*/React.createElement("div", {
    className: "cmp-scan"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sweep"
  })), result ? /*#__PURE__*/React.createElement("p", {
    className: "cmp-verdict"
  }, Math.abs(result.edge) < 2 ? /*#__PURE__*/React.createElement(React.Fragment, null, "The market and my estimate ", /*#__PURE__*/React.createElement("b", null, "agree within ", Math.abs(result.edge).toFixed(1), "c"), " \u2014 this looks fairly priced.") : result.edge > 0 ? /*#__PURE__*/React.createElement(React.Fragment, null, "All the checks together make ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--amber)"
    }
  }, market.name), " a ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--amber)"
    }
  }, result.fair.toFixed(0), "% shot"), " \u2014 the market only sees ", market.price.toFixed(0), "%.", result.call === "PASS" ? " But after the real fill price and fees the gap is too small to bet — see the verdict below." : " My call is below.") : /*#__PURE__*/React.createElement(React.Fragment, null, "All the checks together give ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--rose)"
    }
  }, market.name), " only a ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--rose)"
    }
  }, result.fair.toFixed(0), "% chance"), " \u2014 the market sees ", market.price.toFixed(0), "%, so the OTHER side is the likelier outcome.", result.call === "PASS" ? " But after costs the gap is too small to bet — see the verdict below." : " My call is below.")) : /*#__PURE__*/React.createElement("p", {
    className: "help"
  }, "Every bar is a chance out of 100 \u2014 longer bar, more likely. A contract pays 100c if it happens, so a ", market.price.toFixed(0), "c price means the market sees about a ", market.price.toFixed(0), "% chance. Each bar is an independent read on the same outcome \u2014 when they agree, trust the number; when they split, dig in.")), (() => {
    if (legs) return null; // parlays get the legs panel instead
    const eb = eventBoard(book, live);
    if (!eb || !eb.winner && !eb.rows.some(r => r.prob != null)) return null;
    return /*#__PURE__*/React.createElement("div", {
      className: "panel",
      style: {
        marginTop: 14,
        background: "rgba(0,0,0,.14)"
      }
    }, /*#__PURE__*/React.createElement("p", {
      className: "sect",
      style: {
        margin: 0
      }
    }, "Who wins \u2014 and the best bet on this event"), eb.winner && /*#__PURE__*/React.createElement("p", {
      className: "thesis",
      style: {
        marginTop: 8
      }
    }, eb.winner.final ? "Final: " : "Most likely winner: ", /*#__PURE__*/React.createElement("strong", {
      style: {
        color: "var(--amber)"
      }
    }, eb.winner.name), eb.winner.final ? "" : " (" + eb.winner.pct.toFixed(0) + "%" + (eb.winner.book ? ", by the books" : eb.winner.market ? ", by the market" : ", live model") + ")"), eb.rows.map(r => {
      const isBest = eb.best && r === eb.best && r.net > 0;
      return /*#__PURE__*/React.createElement("div", {
        key: r.m.id,
        className: "score-row",
        style: {
          borderBottom: "1px solid rgba(65,75,99,.35)"
        }
      }, /*#__PURE__*/React.createElement("span", {
        className: "who",
        style: {
          fontSize: 13.5
        }
      }, r.m.name, isBest && /*#__PURE__*/React.createElement("span", {
        className: "srcchip",
        style: {
          marginLeft: 8,
          color: "var(--moss)",
          borderColor: "rgba(127,185,139,.5)"
        }
      }, "MOST LIKELY"), /*#__PURE__*/React.createElement("span", {
        className: "sub",
        style: {
          display: "block"
        }
      }, r.prob != null ? "true odds ~" + r.prob.toFixed(0) + "% (" + r.src + ")" : "no model read", r.entry != null ? " · costs " + r.entry.toFixed(0) + "c" : "")), /*#__PURE__*/React.createElement("span", {
        className: "pts",
        style: {
          fontSize: 15,
          color: r.prob != null && r.prob >= 55 ? "var(--moss)" : "var(--dim)"
        }
      }, r.prob != null ? r.prob.toFixed(0) + "%" : "—", /*#__PURE__*/React.createElement("span", {
        className: "sub",
        style: {
          display: "block"
        }
      }, "chance it happens")));
    }), /*#__PURE__*/React.createElement("p", {
      className: "help",
      style: {
        marginTop: 10
      }
    }, "Every outcome on this event with its predicted chance — the percentages come from the live models and the de-vigged book consensus. Run the full analysis on any of them to stress-test the read."));
  })(), (phase === "ready" || phase === "done") && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "chips"
  }, /*#__PURE__*/React.createElement("span", {
    className: "chip static"
  }, "Topic"), Object.keys(fw).map(k => /*#__PURE__*/React.createElement("button", {
    key: k,
    className: "chip" + (k === cat ? " on" : ""),
    onClick: () => setCat(k)
  }, fw[k].label)), /*#__PURE__*/React.createElement("span", {
    className: "chip static"
  }, conf.items.filter(p => p.enabled).length, " of 9 checks on")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      display: "flex",
      gap: 10,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn",
    onClick: () => analyze(),
    disabled: busy
  }, result ? "Run it again" : "Analyze this market"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost",
    onClick: () => crossPlatform(market),
    disabled: busy
  }, "Check the other exchange"), book.markets.length > 1 && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost",
    onClick: () => setPhase("choosing")
  }, "Change outcome"))), xp && /*#__PURE__*/React.createElement("details", {
    className: "fold",
    open: true
  }, /*#__PURE__*/React.createElement("summary", null, "The other exchange"), xp.status === "searching" && /*#__PURE__*/React.createElement("p", {
    className: "pwait"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dots"
  }, "matching contracts on the other venue")), xp.status === "none" && /*#__PURE__*/React.createElement("p", {
    className: "thesis",
    style: {
      color: "var(--dim)"
    }
  }, "No equivalent contract found on the other venue. Treat this as a single-venue read."), xp.status === "error" && /*#__PURE__*/React.createElement("p", {
    className: "thesis",
    style: {
      color: "var(--rose)"
    }
  }, "Match failed: ", xp.msg), xp.status === "found" && /*#__PURE__*/React.createElement("p", {
    className: "thesis"
  }, /*#__PURE__*/React.createElement("strong", null, xp.match.venue), " prices the same event at", " ", /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      color: "var(--moss)"
    }
  }, xp.match.price.toFixed(1), "c"), ", a gap of", " ", /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      color: Math.abs(xp.gap) > 3 ? "var(--amber)" : "var(--dim)"
    }
  }, xp.gap > 0 ? "+" : "", xp.gap.toFixed(1), "c"), ". ", xp.caveat), /*#__PURE__*/React.createElement("p", {
    className: "help"
  }, "The same event often trades at different prices on the two exchanges. A wide gap is either free money or a sign the two contracts don't settle on quite the same thing.")), depth && depth.asks.length > 0 && /*#__PURE__*/React.createElement("details", {
    className: "fold"
  }, /*#__PURE__*/React.createElement("summary", null, "What your order would actually cost"), /*#__PURE__*/React.createElement("div", {
    className: "meta",
    style: {
      marginTop: 10,
      alignItems: "flex-end"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "How many"), /*#__PURE__*/React.createElement("input", {
    className: "srch",
    type: "number",
    min: "1",
    value: size,
    style: {
      width: 110,
      padding: "7px 9px",
      flex: "none"
    },
    onChange: e => setSize(Math.max(1, Number(e.target.value) || 1))
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "Best ask"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, depth.asks[0][0].toFixed(1), "c")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "Avg fill"), /*#__PURE__*/React.createElement("span", {
    className: "v",
    style: {
      color: "var(--amber)"
    }
  }, fill ? fill.avg.toFixed(1) + "c" : "—")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "Slippage"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, fill ? (fill.avg - depth.asks[0][0]).toFixed(2) + "c" : "—")), fill && fill.short > 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "Can't fill"), /*#__PURE__*/React.createElement("span", {
    className: "v",
    style: {
      color: "var(--rose)"
    }
  }, fill.short))), /*#__PURE__*/React.createElement("p", {
    className: "help"
  }, "The screen price is only for the first few contracts. Buy more and you pay worse prices as you eat through the order book \u2014 that difference is the slippage.")), result && /*#__PURE__*/React.createElement(React.Fragment, null, (() => {
    // Prediction-first: name the outcome the desk expects, at
    // what probability, at what certainty tier. The betting
    // recommendation is a consequence, not the headline.
    const predYes = result.fair >= 50;
    const predProb = predYes ? result.fair : 100 - result.fair;
    let predName = market.name;
    if (!predYes) {
      const bsNo = betSide({
        call: "BUY NO",
        side: "NO"
      }, market, live);
      predName = bsNo ? bsNo.who : "NOT " + market.name;
    }
    const tier = predProb >= 80 ? {
      t: "STRONGEST CALL",
      c: "var(--moss)"
    } : predProb >= 68 ? {
      t: "STRONG CALL",
      c: "var(--moss)"
    } : predProb >= 55 ? {
      t: "LEAN",
      c: "var(--amber)"
    } : {
      t: "TOO CLOSE TO CALL",
      c: "var(--dim)"
    };
    const bs = result.call !== "PASS" ? betSide(result, market, live) : null;
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "verdict"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "label",
      style: {
        marginBottom: 6
      }
    }, "My prediction"), /*#__PURE__*/React.createElement("h2", {
      style: {
        color: predProb >= 55 ? tier.c : "var(--bone)"
      }
    }, predProb >= 55 ? predName : "Too close to call"), /*#__PURE__*/React.createElement("div", {
      className: "eyebrow",
      style: {
        marginTop: 6
      }
    }, predProb >= 55 ? predProb.toFixed(0) + "% by all checks combined · " + tier.t + " · confidence " + result.confidence : "roughly " + result.fair.toFixed(0) + "/" + (100 - result.fair).toFixed(0) + " — no side earns a call")), /*#__PURE__*/React.createElement("span", {
      className: "tierbox",
      style: {
        color: tier.c,
        borderColor: tier.c,
        alignSelf: "center"
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "pct"
    }, predProb.toFixed(0), "%"), /*#__PURE__*/React.createElement("span", {
      className: "lbl"
    }, predProb >= 55 ? tier.t.replace(" CALL", "") : "TOSS-UP"))), /*#__PURE__*/React.createElement("p", {
      className: "answer"
    }, predProb >= 55 ? /*#__PURE__*/React.createElement(React.Fragment, null, "Everything the checks found says ", /*#__PURE__*/React.createElement("strong", null, predName), " \u2014 a ", predProb.toFixed(0), "% shot once the market prior, the books, the live feeds and the research are weighed together.", " ", "The market consensus sits at ", market.price.toFixed(0), "% \u2014", " ", Math.abs(result.fair - market.price) < 4 ? "aligned with this prediction." : "a real gap from this prediction; the verification pass " + (result.verify && result.verify.verdict === "CONFIRM" ? "backed my read." : "couldn't settle who's right.")) : /*#__PURE__*/React.createElement(React.Fragment, null, "The evidence splits almost evenly (", result.fair.toFixed(0), "% yes / ", (100 - result.fair).toFixed(0), "% no) \u2014 anyone claiming certainty on this one is guessing.", result.verify && result.verify.verdict === "REFUTE" ? " The final check also killed the trade case." : "")));
  })(), result.thesis && /*#__PURE__*/React.createElement("p", {
    className: "thesis"
  }, result.thesis), result.verify && /*#__PURE__*/React.createElement("p", {
    className: "thesis",
    style: {
      color: result.verify.verdict === "CONFIRM" ? "var(--moss)" : "var(--rose)"
    }
  }, "Final check (", result.verify.verdict.toLowerCase(), "): ", result.verify.reason), /*#__PURE__*/React.createElement("div", {
    className: "figures"
  }, /*#__PURE__*/React.createElement("div", {
    className: "fig"
  }, /*#__PURE__*/React.createElement("span", {
    className: "big",
    style: {
      color: "var(--amber)"
    }
  }, (result.fair >= 50 ? result.fair : 100 - result.fair).toFixed(0), "%"), /*#__PURE__*/React.createElement("span", {
    className: "cap"
  }, "Chance it happens"), /*#__PURE__*/React.createElement("span", {
    className: "sub"
  }, "Every check weighed by evidence strength and track record")), /*#__PURE__*/React.createElement("div", {
    className: "fig"
  }, /*#__PURE__*/React.createElement("span", {
    className: "big"
  }, result.confidence), /*#__PURE__*/React.createElement("span", {
    className: "cap"
  }, "How sure I am"), /*#__PURE__*/React.createElement("span", {
    className: "sub"
  }, "Strength and agreement of the evidence")), /*#__PURE__*/React.createElement("div", {
    className: "fig"
  }, /*#__PURE__*/React.createElement("span", {
    className: "big"
  }, result.strong, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--dim)"
    }
  }, "/9")), /*#__PURE__*/React.createElement("span", {
    className: "cap"
  }, "Checks with real data"), /*#__PURE__*/React.createElement("span", {
    className: "sub"
  }, "The rest found nothing and were ignored")), /*#__PURE__*/React.createElement("div", {
    className: "fig"
  }, /*#__PURE__*/React.createElement("span", {
    className: "big"
  }, market.price.toFixed(0), "%"), /*#__PURE__*/React.createElement("span", {
    className: "cap"
  }, "Market consensus"), /*#__PURE__*/React.createElement("span", {
    className: "sub"
  }, Math.abs(result.fair - market.price) < 4 ? "The crowd reads it the same way" : "The crowd sees it differently — one of us is missing something"))), (result.signals && result.signals.length || result.sampleSpread > 0 || result.calib && result.calib.active) && /*#__PURE__*/React.createElement("details", {
    className: "fold"
  }, /*#__PURE__*/React.createElement("summary", null, "How the probability was built"), /*#__PURE__*/React.createElement("div", {
    className: "meta",
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "Market"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, market.price.toFixed(0), "c")), (result.signals || []).map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, s.label), /*#__PURE__*/React.createElement("span", {
    className: "v",
    style: {
      color: "var(--violet)"
    }
  }, s.prob.toFixed(0), "%"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "Weighted anchor"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, result.anchor.toFixed(0), "c")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "Fair (median of 3)"), /*#__PURE__*/React.createElement("span", {
    className: "v",
    style: {
      color: "var(--amber)"
    }
  }, result.fair.toFixed(0), "c"))), /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      marginTop: 10
    }
  }, "Fair value is the median of three independent pricings, anchored to the market plus every signal above weighted by evidence and track record.", result.sampleSpread > 0 ? " The three landed within " + result.sampleSpread.toFixed(0) + "c of each other" + (result.sampleSpread > 10 ? " — wide enough that I trimmed the confidence." : ".") : "", result.signalSpread > 12 ? " The independent signals disagree by " + result.signalSpread.toFixed(0) + "c, so confidence is tempered." : "", result.calib && result.calib.active ? " Calibration from " + result.calib.n + " settled calls pulled the estimate " + Math.round((1 - result.calib.k) * 100) + "% toward the market." : "")), result.call === "PASS" && /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      marginTop: 14
    }
  }, "Passing is a real answer. Most contracts are priced about right, and no trade beats a bad one."), result.call !== "PASS" && lastSaved && (lastSaved.taken ? /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      marginTop: 16,
      color: "var(--moss)"
    }
  }, "Tracking this position \u2014 open ", /*#__PURE__*/React.createElement("b", null, "My trades"), " for live hold / buy-more / sell calls.") : /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      alignItems: "flex-end"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "k eyebrow",
    style: {
      display: "block",
      marginBottom: 4
    }
  }, "Your fill (c)"), /*#__PURE__*/React.createElement("input", {
    className: "srch",
    type: "number",
    step: "0.1",
    value: tkPrice,
    onChange: e => setTkPrice(e.target.value),
    style: {
      width: 100,
      padding: "8px 10px",
      flex: "none"
    },
    "aria-label": "Fill price in cents"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "k eyebrow",
    style: {
      display: "block",
      marginBottom: 4
    }
  }, "Contracts"), /*#__PURE__*/React.createElement("input", {
    className: "srch",
    type: "number",
    min: "1",
    value: tkN,
    onChange: e => setTkN(e.target.value),
    style: {
      width: 100,
      padding: "8px 10px",
      flex: "none"
    },
    "aria-label": "Number of contracts"
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-sm",
    onClick: () => {
      if (!lastSaved || !result) return;
      const upd = {
        ...lastSaved,
        taken: {
          side: result.side,
          entryPrice: Number(tkPrice) || result.entry,
          contracts: Math.max(1, Math.round(Number(tkN) || 1)),
          at: Date.now()
        }
      };
      onSave(upd);
      setLastSaved(upd);
    }
  }, "I took this trade"), /*#__PURE__*/React.createElement("span", {
    className: "help",
    style: {
      flexBasis: "100%",
      marginTop: 2
    }
  }, "Mark it, and ", /*#__PURE__*/React.createElement("b", null, "My trades"), " will watch the price and the game and tell you when to hold, buy more, or get out."))))), (busy || result) && market && phase !== "choosing" && /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("p", {
    className: "sect"
  }, "The nine checks"), /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      marginBottom: 10
    }
  }, "Each one searches the web for a specific kind of evidence. YES means it argues the contract is underpriced, NO means overpriced, and the number is how solid the evidence was out of 3."), /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      marginBottom: 4
    }
  }, conf.label, " \xB7", " ", phase === "auditing" ? /*#__PURE__*/React.createElement("span", {
    className: "dots"
  }, "reading the fine print") : phase === "researching" ? /*#__PURE__*/React.createElement("span", {
    className: "dots"
  }, live && live.state === "in" ? "searching, with the live score in hand" : "searching in parallel") : phase === "contrarian" ? /*#__PURE__*/React.createElement("span", {
    className: "dots"
  }, "risk officer arguing the other side") : phase === "synthesizing" ? /*#__PURE__*/React.createElement("span", {
    className: "dots"
  }, "pricing fair value") : phase === "verifying" ? /*#__PURE__*/React.createElement("span", {
    className: "dots"
  }, "trying to kill the trade before you pay for it") : "complete"), conf.items.map(p => {
    const f = findings[p.n];
    const col = !f ? "var(--dim)" : f.signal === "YES" ? "var(--amber)" : f.signal === "NO" ? "var(--rose)" : "var(--dim)";
    return /*#__PURE__*/React.createElement("div", {
      key: p.n,
      className: "pillar" + (f ? " arrive" : "") + (p.n === 9 ? " contra" : "") + (p.enabled ? "" : " off")
    }, /*#__PURE__*/React.createElement("div", {
      className: "pnum"
    }, String(p.n).padStart(2, "0")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "pname"
    }, p.name, p.n === 9 ? " ↺" : ""), /*#__PURE__*/React.createElement("div", {
      className: "pdesc"
    }, p.method), !p.enabled ? /*#__PURE__*/React.createElement("div", {
      className: "pwait"
    }, "turned off in Frameworks") : f ? /*#__PURE__*/React.createElement("div", {
      className: "pfind"
    }, f.finding) : /*#__PURE__*/React.createElement("div", {
      className: "pwait"
    }, /*#__PURE__*/React.createElement("span", {
      className: "dots"
    }, "searching"))), f && p.enabled && /*#__PURE__*/React.createElement("div", {
      className: "sig",
      style: {
        color: col,
        borderColor: col
      }
    }, f.signal, " \xB7 ", f.strength, "/3", f.implied != null ? " · " + Number(f.implied).toFixed(0) + "c" : ""));
  })), result && (result.drivers.length > 0 || result.risks.length > 0) && /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, result.drivers.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    className: "sect"
  }, "What convinced me"), /*#__PURE__*/React.createElement("ul", {
    className: "lst",
    style: {
      marginTop: 10
    }
  }, result.drivers.map((d, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, d)))), result.risks.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    className: "sect",
    style: {
      marginTop: 20,
      color: "var(--rose)"
    }
  }, "What would prove me wrong"), /*#__PURE__*/React.createElement("ul", {
    className: "lst",
    style: {
      marginTop: 10
    }
  }, result.risks.map((d, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, d)))), (result.resolution || audit) && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    className: "sect",
    style: {
      marginTop: 20
    }
  }, "Read the fine print", audit && audit.severity === "HIGH" ? " — it bites on this one" : ""), audit && audit.summary && /*#__PURE__*/React.createElement("p", {
    className: "thesis",
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("strong", null, "Settles when:"), " ", audit.summary), audit && (audit.traps || []).length > 0 && /*#__PURE__*/React.createElement("ul", {
    className: "lst",
    style: {
      marginTop: 8
    }
  }, audit.traps.map((t, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    style: {
      color: "var(--amber)"
    }
  }, t))), result.resolution && /*#__PURE__*/React.createElement("p", {
    className: "thesis",
    style: {
      marginTop: 8
    }
  }, result.resolution)), sources.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    className: "sect",
    style: {
      marginTop: 20
    }
  }, "Where this came from (", sources.length, " sources)"), /*#__PURE__*/React.createElement("div", {
    className: "src"
  }, Array.from(new Map(sources.map(s => [s.url, s])).values()).slice(0, 24).map((s, i) => /*#__PURE__*/React.createElement("a", {
    key: i,
    href: s.url,
    target: "_blank",
    rel: "noreferrer"
  }, (s.title || s.url).slice(0, 46)))))));
}

/* ---------------- My trades ---------------- */
function Positions({
  ledger,
  save,
  reopen,
  reload
}) {
  // One card per actual market position. A re-analysis plus a Kalshi sync
  // can both end up flagged "taken" for the same market — show the entry
  // that carries a real analysis (else the newest) and ignore the shadow.
  const open = useMemo(() => {
    const byMkt = {};
    ledger.filter(e => e.taken && e.status === "open").forEach(e => {
      const k = e.venue + ":" + e.marketId;
      const cur = byMkt[k];
      if (!cur) {
        byMkt[k] = e;
        return;
      }
      const analyzed = x => (x.pillars || []).length > 0;
      const better = analyzed(e) !== analyzed(cur) ? analyzed(e) : (e.ts || 0) > (cur.ts || 0);
      if (better) byMkt[k] = e;
    });
    return Object.values(byMkt);
  }, [ledger]);
  const settled = ledger.filter(e => e.taken && e.status === "resolved" && e.outcome !== null);
  const trackedKeys = new Set(open.map(e => e.venue + ":" + e.marketId));
  const candidates = ledger.filter(e => !e.taken && e.status === "open" && e.call !== "PASS" && !trackedKeys.has(e.venue + ":" + e.marketId)).slice(0, 8);
  const [q, setQ] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [kal, setKal] = useState(null);
  const [confirmId, setConfirmId] = useState(null); // position awaiting close confirm
  const [closing, setClosing] = useState(null); // position id mid-close
  const [closeNote, setCloseNote] = useState(null);
  const [wsOn, setWsOn] = useState(false); // realtime feed connected
  const anyLiveRef = useRef(false);
  const legsCacheRef = useRef({}); // combo marketId -> leg tickers
  const openRef = useRef(open);
  openRef.current = open;

  // Realtime Kalshi quotes: the server relays the authenticated Kalshi
  // WebSocket as a server-sent-event stream, so prices tick the moment the
  // market trades — the polling refresh below stays as the game-feed and
  // fallback path. EventSource reconnects on its own when the stream ends.
  useEffect(() => {
    const tickers = open.filter(e => e.venue === "Kalshi").map(e => e.marketId);
    if (!tickers.length || typeof EventSource === "undefined") return;
    const es = new EventSource("/api/desk/kalshi/stream?tickers=" + encodeURIComponent(tickers.join(",")));
    es.onopen = () => setWsOn(true);
    es.onerror = () => setWsOn(false);
    es.onmessage = evM => {
      try {
        const d = JSON.parse(evM.data);
        const m = d.msg || {};
        const tk = m.market_ticker || m.ticker;
        if (!tk) return;
        const cents = (v, dv) => v != null ? Number(v) : dv != null ? Number(dv) * 100 : null;
        const bid = cents(m.yes_bid, m.yes_bid_dollars);
        const ask = cents(m.yes_ask, m.yes_ask_dollars);
        let price = cents(m.price, m.price_dollars);
        if (price == null && bid != null && ask != null) price = (bid + ask) / 2;
        if (price == null || !Number.isFinite(price)) return;
        const ent = openRef.current.find(x => x.venue === "Kalshi" && x.marketId === tk);
        if (!ent) return;
        setQ(prev => ({
          ...prev,
          [ent.id]: {
            ...(prev[ent.id] || {}),
            quote: {
              price,
              bid,
              ask
            },
            price,
            at: Date.now()
          }
        }));
      } catch {/* malformed frame */}
    };
    return () => {
      es.close();
      setWsOn(false);
    };
  }, [ledger.length]);
  async function closePosition(e, curSide) {
    setClosing(e.id);
    setCloseNote(null);
    setConfirmId(null);
    try {
      const r = await fetch("/api/desk/kalshi/close", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ticker: e.marketId
        })
      });
      const d = await r.json();
      if (d.ok) {
        setCloseNote({
          forId: e.id,
          ok: true,
          msg: "Sold " + d.sold + " " + d.side.toUpperCase() + " on " + e.marketId + " at market. Your account will reflect it in a moment."
        });
        if (reload) await reload();
        refresh();
      } else {
        setCloseNote({
          forId: e.id,
          ok: false,
          msg: d.error || "Close failed."
        });
      }
    } catch (err) {
      setCloseNote({
        forId: e.id,
        ok: false,
        msg: "Close request failed: " + err.message
      });
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
    } catch {/* sync is best-effort */}
    if (reload) await reload();
    if (!open.length) return;
    setRefreshing(true);
    const out = {};
    await Promise.all(open.map(async e => {
      const [quote, live] = await Promise.all([fetchCurrentPrice(e), fetchLive({
        id: e.marketId,
        question: e.question,
        name: e.name
      }).catch(() => null)]);
      // A parlay position tracks each LEG's game, not a (nonexistent)
      // single game for the combo.
      let legsInfo = null,
        legLiveArr = null;
      if (e.venue === "Kalshi" && /^KXMVE/i.test(e.marketId)) {
        let legTks = legsCacheRef.current[e.marketId];
        if (legTks === undefined) {
          try {
            const r = await fetch(px("https://api.elections.kalshi.com/trade-api/v2/markets/" + e.marketId));
            const d = r.ok ? await r.json() : null;
            const km = d && d.market ? kaMarket(d.market) : null;
            legTks = km && km.legs ? km.legs : null;
          } catch {
            legTks = null;
          }
          legsCacheRef.current[e.marketId] = legTks;
        }
        if (legTks) {
          legsInfo = await resolveLegs({
            legs: legTks
          });
          if (legsInfo) legLiveArr = await Promise.all(legsInfo.map(l => fetchLive({
            id: l.ticker,
            question: l.question,
            name: l.name
          }).catch(() => null)));
        }
      }
      out[e.id] = {
        quote,
        price: quote ? quote.price : null,
        live,
        legs: legsInfo,
        legLive: legLiveArr,
        at: Date.now()
      };
    }));
    setQ(out);
    anyLiveRef.current = Object.values(out).some(x => x.live && x.live.state === "in" || (x.legLive || []).some(l => l && l.state === "in"));
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
    let alive = true,
      timer = null;
    const loop = async () => {
      await refreshRef.current();
      if (!alive) return;
      timer = setTimeout(loop, anyLiveRef.current ? 15000 : 30000);
    };
    loop();
    const onVis = () => {
      if (!document.hidden) {
        if (timer) clearTimeout(timer);
        loop();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ledger.length]);
  const settledPnl = settled.reduce((s, e) => {
    const won = (e.taken.side === "YES" ? 1 : 0) === e.outcome;
    return s + ((won ? 100 : 0) - e.taken.entryPrice) * e.taken.contracts / 100;
  }, 0);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
      alignItems: "baseline"
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "sect",
    style: {
      margin: 0
    }
  }, "Positions I'm watching (", open.length, ")"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost btn-sm",
    onClick: refresh,
    disabled: refreshing || !open.length
  }, refreshing ? "Refreshing" : "Refresh now")), /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      marginTop: 6
    }
  }, "Live prices and game feeds against what each position is worth. Kalshi prices tick in realtime over a live feed; scores and advice refresh every 15 seconds during games, every 30 otherwise. All free \u2014 no analysis credits."), kal && !kal.error || wsOn ? /*#__PURE__*/React.createElement("div", {
    className: "chips",
    style: {
      marginTop: 8
    }
  }, kal && !kal.error && /*#__PURE__*/React.createElement("span", {
    className: "chip static",
    style: {
      color: "var(--moss)",
      borderColor: "rgba(127,185,139,.5)"
    }
  }, "Kalshi account connected \xB7 ", kal.synced, " position", kal.synced === 1 ? "" : "s", " synced"), kal && kal.history && /*#__PURE__*/React.createElement("span", {
    className: "chip static",
    style: {
      color: kal.history.pnl >= 0 ? "var(--moss)" : "var(--rose)",
      borderColor: kal.history.pnl >= 0 ? "rgba(127,185,139,.5)" : "rgba(228,112,126,.5)"
    },
    title: "Straight from your Kalshi portfolio settlement history \u2014 the authoritative record"
  }, "Your wagers: ", kal.history.wins, "-", kal.history.losses, " \xB7 net ", kal.history.pnl >= 0 ? "+$" : "-$", Math.abs(kal.history.pnl).toFixed(2)), wsOn && /*#__PURE__*/React.createElement("span", {
    className: "chip static",
    style: {
      color: "var(--cyan)",
      borderColor: "rgba(111,179,210,.5)"
    }
  }, "\u25CF realtime prices")) : null, kal && kal.error && /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      marginTop: 8,
      color: "var(--rose)"
    }
  }, "Kalshi sync hit a snag: ", String(kal.error).slice(0, 140)), open.length === 0 && /*#__PURE__*/React.createElement("p", {
    className: "thesis",
    style: {
      color: "var(--dim)",
      marginTop: 14
    }
  }, "Nothing tracked yet. When an analysis says BUY and you take it, hit ", /*#__PURE__*/React.createElement("b", null, "I took this trade"), " on the result \u2014 or mark one of your recent calls below."), open.map(e => {
    const qq = q[e.id] || {};
    const cur = qq.price != null ? qq.price : null;
    const live = qq.live && !qq.live.none && qq.live.sides ? qq.live : null;
    const cmb = qq.legs ? legsCombined(qq.legs, qq.legLive) : null;
    const adv = cur != null ? positionAdvice(e, cur, live, qq.quote, cmb) : null;
    const curSide = cur != null ? e.taken.side === "YES" ? cur : 100 - cur : null;
    const pnlC = curSide != null ? curSide - e.taken.entryPrice : null;
    const pnlD = pnlC != null ? pnlC * e.taken.contracts / 100 : null;
    const col = adv ? ADVICE_COLORS[adv.act] || "var(--dim)" : "var(--dim)";
    return /*#__PURE__*/React.createElement("div", {
      key: e.id,
      className: "fw",
      style: {
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "fw-top"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "pname"
    }, qq.legs ? "Parlay: " + qq.legs.map(l => l.name + (l.league ? " (" + l.league + ")" : "")).join(" + ") : e.name === e.question ? e.question : e.question + " — " + e.name), /*#__PURE__*/React.createElement("div", {
      className: "pdesc"
    }, /*#__PURE__*/React.createElement("span", {
      className: "srcchip",
      style: {
        marginRight: 6,
        fontSize: 9
      }
    }, wagerType(e.marketId)), e.venue, " \xB7 ", e.taken.contracts, " \xD7 ", (() => {
      const tl0 = totalLine(e.marketId);
      return tl0 != null ? e.taken.side === "YES" ? "OVER " + tl0 : "UNDER " + tl0 : e.taken.side;
    })(), " at ", Number(e.taken.entryPrice).toFixed(1), "c \xB7 my fair value ", Number(e.fair).toFixed(0), "c")), adv && /*#__PURE__*/React.createElement("span", {
      className: "sig adv",
      style: {
        color: col,
        borderColor: col
      }
    }, adv.act)), /*#__PURE__*/React.createElement("div", {
      className: "meta",
      style: {
        marginTop: 10
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "Market now"), /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, cur != null ? cur.toFixed(1) + "c" : "…")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "Your side"), /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, curSide != null ? curSide.toFixed(1) + "c" : "…")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "Profit / loss"), /*#__PURE__*/React.createElement("span", {
      className: "v",
      style: {
        color: pnlC == null ? "var(--dim)" : pnlC >= 0 ? "var(--moss)" : "var(--rose)"
      }
    }, pnlC == null ? "…" : (pnlC >= 0 ? "+" : "") + pnlC.toFixed(1) + "c · " + (pnlD >= 0 ? "+$" : "-$") + Math.abs(pnlD).toFixed(2))), live && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, live.state === "in" ? "Live now" : live.state === "post" ? "Final" : "Game"), /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, live.sides.map(s => (s.abbr || s.name.slice(0, 3)) + " " + (s.sets && s.sets.length ? s.sets.join(" ") : s.score != null ? s.score : "-")).join(" · "), live.state === "in" && live.clock ? " · " + live.clock : "")), live && live.impliedCents != null && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "Win prob (your side)"), /*#__PURE__*/React.createElement("span", {
      className: "v",
      style: {
        color: "var(--violet)"
      }
    }, (e.taken.side === "YES" ? live.impliedCents : 100 - live.impliedCents).toFixed(0), "%"))), (() => {
      // Over/under position: live total vs your line, pace, and
      // clinch detection (a total can only rise — once it crosses
      // the line, OVER is locked in).
      const tl = totalLine(e.marketId);
      if (tl == null || !live || !live.sides) return null;
      const totNow = live.sides.reduce((s, x) => s + (Number(x.score) || 0), 0);
      const lg2 = detectLeague({
        id: e.marketId,
        question: e.question,
        name: e.name
      });
      const pace = live.state === "in" && lg2 ? paceProjection(lg2.path, live.detail, live.sides) : null;
      const clinched = totNow > tl;
      const overSide = e.taken.side === "YES";
      return /*#__PURE__*/React.createElement("p", {
        className: "help",
        style: {
          marginTop: 8
        }
      }, /*#__PURE__*/React.createElement("b", null, "Total now: ", totNow), " vs your ", overSide ? "OVER" : "UNDER", " ", tl, " line", clinched ? /*#__PURE__*/React.createElement("b", {
        style: {
          color: overSide ? "var(--moss)" : "var(--rose)"
        }
      }, " — the line is crossed; OVER is locked in" + (overSide ? " (your side wins)" : " (your side is dead)")) : pace ? /*#__PURE__*/React.createElement("span", null, " \u2014 on pace for ~", pace.projected.toFixed(0), " ", "(", pace.projected > tl ? "over" : "under", " the line as it stands)") : live.state === "post" ? /*#__PURE__*/React.createElement("b", {
        style: {
          color: overSide ? "var(--rose)" : "var(--moss)"
        }
      }, " — final under the line" + (overSide ? " (your side lost)" : " (your side wins)")) : null);
    })(), qq.legs && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10
      }
    }, qq.legs.map((l, i) => {
      const ll = qq.legLive && qq.legLive[i] && !qq.legLive[i].none ? qq.legLive[i] : null;
      const pp = cmb && cmb.parts[i];
      const scoreLine = ll && ll.sides ? ll.sides.map(s => (s.abbr || s.name.slice(0, 3)) + " " + (s.score != null ? s.score : "-")).join(" · ") + (ll.state === "in" ? " · LIVE" + (ll.clock ? " " + ll.clock : "") : ll.state === "post" ? " · FINAL" : "") : "upcoming";
      return /*#__PURE__*/React.createElement("div", {
        key: l.ticker,
        className: "score-row",
        style: {
          borderBottom: "1px solid rgba(65,75,99,.35)"
        }
      }, /*#__PURE__*/React.createElement("span", {
        className: "who",
        style: {
          fontSize: 13
        }
      }, "Leg ", i + 1, ": ", l.side, " ", /*#__PURE__*/React.createElement("b", null, l.name), /*#__PURE__*/React.createElement("span", {
        className: "sub",
        style: {
          display: "block"
        }
      }, (l.league || "?") + " · " + scoreLine)), /*#__PURE__*/React.createElement("span", {
        className: "pts",
        style: {
          fontSize: 13.5,
          color: pp && pp.p >= 99.5 ? "var(--moss)" : pp && pp.p <= 0.5 ? "var(--rose)" : pp && pp.src === "live" ? "var(--violet)" : undefined
        }
      }, pp ? pp.p >= 99.5 ? "WON" : pp.p <= 0.5 ? "LOST" : pp.p.toFixed(0) + "%" : "…", /*#__PURE__*/React.createElement("span", {
        className: "sub",
        style: {
          display: "block"
        }
      }, pp ? pp.src : "")));
    }), cmb && /*#__PURE__*/React.createElement("p", {
      className: "help",
      style: {
        marginTop: 6,
        color: cmb.dead ? "var(--rose)" : undefined
      }
    }, cmb.dead ? "A leg has lost — the parlay can't win." : "Parlay worth now ≈ " + cmb.prob.toFixed(0) + "c (legs multiplied" + (cmb.live ? ", live" : "") + ").")), (() => {
      if (qq.legs) return null;
      const w = likelyWinner(live, e.name, cur);
      if (!w) return null;
      const mine = overlap(w.name, e.name) > 0.3;
      const col = mine ? "var(--moss)" : "var(--rose)";
      return /*#__PURE__*/React.createElement("p", {
        className: "help",
        style: {
          marginTop: 8
        }
      }, w.final ? "Final: " : "Projected winner: ", /*#__PURE__*/React.createElement("strong", {
        style: {
          color: col
        }
      }, w.name), w.final ? "" : " (" + w.pct.toFixed(0) + "%)", " — ", mine ? "that's your side." : "that's against your position.");
    })(), adv && /*#__PURE__*/React.createElement("p", {
      className: "help",
      style: {
        marginTop: 8
      }
    }, adv.why), confirmId === e.id ? /*#__PURE__*/React.createElement("div", {
      className: "panel",
      style: {
        marginTop: 10,
        background: "rgba(228,112,126,.07)",
        borderColor: "rgba(228,112,126,.4)"
      }
    }, /*#__PURE__*/React.createElement("p", {
      className: "thesis",
      style: {
        margin: 0
      }
    }, "Sell all ", /*#__PURE__*/React.createElement("b", null, e.taken.contracts), " ", e.taken.side, " contracts on Kalshi at the market price", curSide != null ? " (~" + curSide.toFixed(0) + "c each, about $" + (curSide * e.taken.contracts / 100).toFixed(2) + " back)" : "", "? This places a real order and closes the position."), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        marginTop: 12,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn btn-sm",
      style: {
        background: "linear-gradient(180deg,#EC8391,#E4707E)",
        boxShadow: "0 2px 12px rgba(228,112,126,.3)"
      },
      onClick: () => closePosition(e, curSide),
      disabled: closing === e.id
    }, closing === e.id ? "Closing…" : "Yes, sell now"), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-ghost btn-sm",
      onClick: () => setConfirmId(null),
      disabled: closing === e.id
    }, "Keep it"))) : null, closeNote && closeNote.forId === e.id && /*#__PURE__*/React.createElement("p", {
      className: "help",
      style: {
        marginTop: 8,
        color: closeNote.ok ? "var(--moss)" : "var(--rose)"
      }
    }, closeNote.msg), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        marginTop: 10,
        flexWrap: "wrap",
        alignItems: "center"
      }
    }, e.taken.source === "kalshi" && confirmId !== e.id && /*#__PURE__*/React.createElement("button", {
      className: "btn btn-sm",
      style: {
        background: "linear-gradient(180deg,#EC8391,#E4707E)",
        color: "#1B202B",
        boxShadow: "0 2px 12px rgba(228,112,126,.28)"
      },
      onClick: () => {
        setConfirmId(e.id);
        setCloseNote(null);
      },
      disabled: closing === e.id
    }, "Close wager"), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-ghost btn-sm",
      onClick: () => reopen(e)
    }, "Full re-analysis"), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-ghost btn-sm",
      onClick: () => save({
        ...e,
        taken: null
      })
    }, "Stop tracking"), (e.link || e.venue === "Kalshi") && /*#__PURE__*/React.createElement("a", {
      className: "srcchip",
      href: e.venue === "Kalshi" ? kalshiEventLink(e.marketId) : e.link,
      target: "_blank",
      rel: "noreferrer"
    }, "open market \u2197")));
  })), candidates.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("p", {
    className: "sect"
  }, "Recent BUY calls you haven't marked"), /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      marginBottom: 10
    }
  }, "If you actually placed one of these, tap it and I'll start watching it (assumes 100 contracts at the analysis fill price \u2014 the advice is the same either way)."), candidates.map(e => /*#__PURE__*/React.createElement("button", {
    key: e.id,
    className: "sel",
    onClick: () => save({
      ...e,
      taken: {
        side: e.call.replace("BUY ", ""),
        entryPrice: e.entry != null ? e.entry : e.price,
        contracts: 100,
        at: Date.now()
      }
    })
  }, /*#__PURE__*/React.createElement("span", null, e.name === e.question ? e.question : e.question + " — " + e.name, /*#__PURE__*/React.createElement("span", {
    className: "sub"
  }, e.venue, " \xB7 ", e.call, " \xB7 analyzed ", new Date(e.ts).toISOString().slice(0, 10))), /*#__PURE__*/React.createElement("span", {
    className: "px"
  }, "track")))), kal && kal.history && kal.history.recent.length > 0 ? /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("p", {
    className: "sect"
  }, "Settled wagers \u2014 from your Kalshi history"), /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      marginTop: 6
    }
  }, "Pulled directly from your Kalshi portfolio's settlement records \u2014 the same numbers the exchange paid out on. ", kal.history.wins, "-", kal.history.losses, " lifetime shown, net", " ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: kal.history.pnl >= 0 ? "var(--moss)" : "var(--rose)"
    }
  }, kal.history.pnl >= 0 ? "+$" : "-$", Math.abs(kal.history.pnl).toFixed(2)), "."), kal.history.recent.map(h => /*#__PURE__*/React.createElement("div", {
    key: h.ticker + h.at,
    className: "score-row",
    style: {
      borderBottom: "1px solid rgba(65,75,99,.35)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "who",
    style: {
      fontSize: 13
    }
  }, h.title, /*#__PURE__*/React.createElement("span", {
    className: "sub",
    style: {
      display: "block"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "srcchip",
    style: {
      marginRight: 6,
      fontSize: 9
    }
  }, wagerType(h.ticker)), (() => {
    const tl = totalLine(h.ticker);
    return tl != null ? h.side === "YES" ? "OVER " + tl : "UNDER " + tl : h.side;
  })(), " \xB7 settled ", h.at ? new Date(h.at).toLocaleDateString() : "")), /*#__PURE__*/React.createElement("span", {
    className: "pts",
    style: {
      fontSize: 13.5,
      color: h.won ? "var(--moss)" : "var(--rose)"
    }
  }, h.won ? "WON " : "LOST ", h.pl >= 0 ? "+$" : "-$", Math.abs(h.pl).toFixed(2))))) : settled.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("p", {
    className: "sect"
  }, "Settled positions"), /*#__PURE__*/React.createElement("p", {
    className: "thesis",
    style: {
      marginTop: 8
    }
  }, settled.length, " tracked position", settled.length === 1 ? "" : "s", " settled so far:", " ", /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      color: settledPnl >= 0 ? "var(--moss)" : "var(--rose)"
    }
  }, settledPnl >= 0 ? "+$" : "-$", Math.abs(settledPnl).toFixed(2)), " ", "at the fills you recorded.")));
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
  const worker = async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  };
  await Promise.all(Array.from({
    length: Math.min(limit, items.length)
  }, worker));
  return out;
}

// The Kalshi game series we can price. Each maps to an ESPN sport path.
const GAME_SERIES = [["KXNBAGAME", "basketball/nba", "NBA"], ["KXWNBAGAME", "basketball/wnba", "WNBA"], ["KXMLBGAME", "baseball/mlb", "MLB"], ["KXNFLGAME", "football/nfl", "NFL"], ["KXNHLGAME", "hockey/nhl", "NHL"], ["KXCFBGAME", "football/college-football", "NCAAF"], ["KXNCAAFGAME", "football/college-football", "NCAAF"], ["KXCBBGAME", "basketball/mens-college-basketball", "NCAAB"], ["KXNCAABGAME", "basketball/mens-college-basketball", "NCAAB"], ["KXATPMATCH", "tennis/atp", "ATP"], ["KXWTAMATCH", "tennis/wta", "WTA"], ["KXUFCFIGHT", "mma/ufc", "UFC"], ["KXEPLGAME", "soccer/eng.1", "EPL"], ["KXMLSGAME", "soccer/usa.1", "MLS"], ["KXUCLGAME", "soccer/uefa.champions", "UCL"], ["KXLALIGAGAME", "soccer/esp.1", "La Liga"], ["KXSERIEAGAME", "soccer/ita.1", "Serie A"], ["KXBUNDESLIGAGAME", "soccer/ger.1", "Bundesliga"], ["KXLIGUE1GAME", "soccer/fra.1", "Ligue 1"], ["KXLIGAMXGAME", "soccer/mex.1", "Liga MX"], ["KXUELGAME", "soccer/uefa.europa", "Europa League"], ["KXUECLGAME", "soccer/uefa.europa.conf", "Conference League"], ["KXEREDIVISIEGAME", "soccer/ned.1", "Eredivisie"], ["KXLIGAPORTUGALGAME", "soccer/por.1", "Liga Portugal"], ["KXBRASILEIROGAME", "soccer/bra.1", "Brasileirao"], ["KXEFLCHAMPIONSHIPGAME", "soccer/eng.2", "EFL Championship"], ["KXSUPERLIGGAME", "soccer/tur.1", "Super Lig"], ["KXBELGIANPLGAME", "soccer/bel.1", "Belgian Pro League"], ["KXNWSLGAME", "soccer/usa.nwsl", "NWSL"], ["KXLEAGUESCUPGAME", "soccer/concacaf.leagues.cup", "Leagues Cup"], ["KXSAUDIPLGAME", "soccer/ksa.1", "Saudi Pro League"], ["KXWCGAME", "soccer/fifa.world", "World Cup"], ["KXCFLGAME", "football/cfl", "CFL"], ["KXUFLGAME", "football/ufl", "UFL"], ["KXNCAAWBGAME", "basketball/womens-college-basketball", "NCAAW"]];

// A Kalshi game ticker embeds the date: …-26AUG112210KCLAD-LAD -> 20260811
// (some series carry a time after the day, some don't).
function tickerDate(ticker) {
  const m = String(ticker || "").match(/-(\d{2})([A-Z]{3})(\d{2})/);
  if (!m) return null;
  const mo = {
    JAN: "01",
    FEB: "02",
    MAR: "03",
    APR: "04",
    MAY: "05",
    JUN: "06",
    JUL: "07",
    AUG: "08",
    SEP: "09",
    OCT: "10",
    NOV: "11",
    DEC: "12"
  }[m[2]];
  return mo ? "20" + m[1] + mo + m[3] : null;
}

// ESPN games for a sport on a specific date (YYYYMMDD). Defaults to today.
async function espnGamesForLeague(path, date) {
  let events = [];
  try {
    const d = await getJson("https://site.api.espn.com/apis/site/v2/sports/" + path + "/scoreboard" + (date ? "?dates=" + date : ""));
    events = d.events || [];
  } catch {
    return [];
  }
  return events.map(ev => {
    const comp = ev.competitions && ev.competitions[0] || {};
    const comps = comp.competitors || [];
    const home = comps.find(c => c.homeAway === "home");
    const away = comps.find(c => c.homeAway === "away");
    // Football scoreboards return the WHOLE WEEK for a single-date query —
    // tag each game with its actual ET date, not the date we asked about,
    // or the same-slate matching bonus lands on the wrong games.
    const t = Date.parse(ev.date || "");
    const evDate = Number.isFinite(t) ? etDate(t).replace(/-/g, "") : date || null;
    return {
      eventId: ev.id,
      path,
      date: evDate,
      abbrs: comps.map(competitorAbbr),
      homeAbbr: home ? competitorAbbr(home) : null,
      awayAbbr: away ? competitorAbbr(away) : null,
      state: ev.status && ev.status.type && ev.status.type.state || "pre",
      name: ev.name || ev.shortName || "",
      // Live scores + clock so the picks board breathes during games.
      sides: comps.map(c => ({
        abbr: competitorAbbr(c),
        score: c.score != null && c.score !== "" ? Number(c.score) : null,
        home: c.homeAway === "home"
      })),
      detail: ev.status && ev.status.type && (ev.status.type.shortDetail || ev.status.type.detail) || ""
    };
  });
}

// Build a probByAbbr object from a home-team win percentage.
function homeProbObj(home, game, extra) {
  const probByAbbr = {};
  if (game.homeAbbr) probByAbbr[game.homeAbbr] = clamp(home, 0.5, 99.5);
  if (game.awayAbbr) probByAbbr[game.awayAbbr] = clamp(100 - home, 0.5, 99.5);
  return {
    probByAbbr,
    home,
    away: 100 - home,
    books: 1,
    disp: 0,
    ...extra
  };
}

// Odds API consensus -> the scanner's probByAbbr shape.
function oddsProbObj(odds, game, src) {
  const probByAbbr = {};
  if (game.homeAbbr) probByAbbr[game.homeAbbr] = clamp(odds.home, 0.5, 99.5);
  if (game.awayAbbr) probByAbbr[game.awayAbbr] = clamp(odds.away, 0.5, 99.5);
  if (odds.draw != null) {
    probByAbbr.TIE = odds.draw;
    probByAbbr.DRAW = odds.draw;
  }
  return {
    probByAbbr,
    home: odds.home,
    away: odds.away,
    books: odds.books,
    disp: odds.disp,
    src,
    totals: odds.totals || null,
    spreads: odds.spreads || null
  };
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
      const liveModel = Array.isArray(wp) && wp.length && wp[wp.length - 1].homeWinPercentage != null ? Number(wp[wp.length - 1].homeWinPercentage) * 100 : null;
      // Two independent live reads beat either alone: ESPN's play-by-play
      // model and the in-play book consensus, combined in log-odds space
      // (books slightly heavier — they take real money).
      if (liveModel != null && odds && oddsFresh) {
        const blended = unlogit((logit(clamp(liveModel, 1, 99)) + 1.5 * logit(clamp(odds.home, 1, 99))) / 2.5);
        return homeProbObj(blended, game, {
          src: "live",
          books: odds.books,
          blended: true
        });
      }
      if (liveModel != null) return homeProbObj(liveModel, game, {
        src: "live"
      });
      if (odds && oddsFresh) return oddsProbObj(odds, game, "live-books");
      const cons = consensusDevig(sm.pickcenter || sm.odds || [], game.homeAbbr, game.awayAbbr);
      if (cons) return {
        ...cons,
        src: "pregame-line",
        stale: true
      };
      return null;
    }
    if (odds && odds.books >= 2) return oddsProbObj(odds, game, "book");
    const cons = consensusDevig(sm.pickcenter || sm.odds || [], game.homeAbbr, game.awayAbbr);
    if (cons) return {
      ...cons,
      src: "book"
    };
    if (odds) return oddsProbObj(odds, game, "book");
    const proj = sm.predictor && sm.predictor.homeTeam && Number(sm.predictor.homeTeam.gameProjection);
    if (Number.isFinite(proj)) return homeProbObj(proj, game, {
      src: "model"
    });
    return null;
  } catch {
    return null;
  }
}
async function scanEdges() {
  const root = "https://api.elections.kalshi.com/trade-api/v2";

  // Pull open markets for each game series directly (the general market list
  // buries games behind thousands of other contracts, and only a page of it
  // ever loaded). Dedupe leagues that share a sport path.
  const seriesByPath = {};
  GAME_SERIES.forEach(([ticker, path, label]) => {
    (seriesByPath[path] = seriesByPath[path] || {
      path,
      label,
      tickers: []
    }).tickers.push(ticker);
  });
  const marketsByPath = {};
  await mapLimit(GAME_SERIES, 8, async ([ticker, path]) => {
    // Page through the whole series so nothing is missed on a busy slate.
    let cursor = "",
      pages = 0;
    while (pages < 5) {
      let r;
      try {
        r = await fetch(px(root + "/markets?series_ticker=" + ticker + "&status=open&limit=200" + (cursor ? "&cursor=" + cursor : "")));
      } catch {
        break;
      }
      if (!r.ok) break;
      const d = await r.json();
      const ms = (d.markets || []).map(kaMarket).filter(m => m.price != null);
      (marketsByPath[path] = marketsByPath[path] || []).push(...ms);
      cursor = d.cursor || "";
      pages++;
      if (!cursor || !(d.markets || []).length) break;
    }
  });
  const picks = [];
  let gamesFound = 0,
    gamesPriced = 0;
  for (const {
    path,
    label
  } of Object.values(seriesByPath)) {
    const ms = marketsByPath[path] || [];
    if (!ms.length) continue;

    // Attach each market its game date; group the dates we need to look up.
    const dated = ms.map(m => ({
      m,
      codes: teamCodes(m.id),
      date: tickerDate(m.id)
    })).filter(x => x.codes.length);
    const dates = [...new Set(dated.map(x => x.date).filter(Boolean))].sort().slice(0, 14);
    if (!dates.length) dates.push(null); // fall back to today's slate

    // One scoreboard per (path, date); pool all their games.
    const slates = await mapLimit(dates, 4, date => espnGamesForLeague(path, date));
    const gs = [].concat(...slates);
    if (!gs.length) continue;
    const matched = [];
    for (const {
      m,
      codes,
      date
    } of dated) {
      // Teams play back-to-back: the codes match every meeting, so the
      // game from the market's own slate date must win the tie.
      let best = null,
        bestS = 0;
      gs.forEach(g => {
        const s = codeHit(codes, g.abbrs) + (date && g.date === date ? 0.5 : 0);
        if (s > bestS) {
          bestS = s;
          best = g;
        }
      });
      if (best && bestS >= 1) matched.push({
        m,
        g: best,
        codes
      });
    }
    if (!matched.length) continue;
    const distinct = [];
    const seenG = new Set();
    matched.forEach(({
      g
    }) => {
      if (!seenG.has(g.eventId)) {
        seenG.add(g.eventId);
        distinct.push(g);
      }
    });
    gamesFound += distinct.length;
    // One Odds API request per sport, and only when a slate is imminent —
    // books rarely post lines more than a day out, so asking for a slate
    // 3+ days away burns credits for nothing.
    const anyLiveGame = distinct.some(g => g.state === "in");
    const soonCut = Number(etDate(Date.now() + 36 * 3600 * 1000).replace(/-/g, ""));
    const imminent = anyLiveGame || distinct.some(g => g.date && Number(g.date) <= soonCut);
    const oddsEvents = imminent ? await fetchOddsEvents(path, anyLiveGame) : null;
    const devigs = await mapLimit(distinct, 6, g => {
      const ev = matchOddsEvent(oddsEvents, g.name, g.date);
      return espnDevig(g, ev ? oddsEventConsensus(ev) : null);
    });
    const gmap = {};
    distinct.forEach((g, i) => {
      gmap[g.eventId] = devigs[i];
      if (devigs[i] && devigs[i].probByAbbr) gamesPriced++;
    });
    for (const {
      m,
      g,
      codes
    } of matched) {
      const dv = gmap[g.eventId];
      if (!dv || !dv.probByAbbr) continue;
      const myCode = codes[0];
      let modelProb = null;
      for (const [ab, p] of Object.entries(dv.probByAbbr)) {
        if (ab === myCode || ab.startsWith(myCode) || myCode.startsWith(ab)) {
          modelProb = p;
          break;
        }
      }
      if (modelProb == null) continue;
      const entry = m.ask != null ? m.ask : m.price;
      picks.push({
        id: m.id,
        market: m,
        modelProb,
        entry,
        edge: modelProb - entry,
        fee: takerFee(m.venue, entry),
        league: label,
        state: g.state,
        game: g.name,
        codes,
        src: dv.src,
        books: dv.books || 1,
        disp: dv.disp || 0,
        homeAbbr: g.homeAbbr,
        awayAbbr: g.awayAbbr,
        sides: g.sides || null,
        detail: g.detail || "",
        eventId: g.eventId || null,
        path: g.path || path,
        ou: dv.totals || null,
        spr: dv.spreads || null
      });
    }
  }
  const seen = new Set();
  const uniq = picks.filter(p => seen.has(p.id) ? false : seen.add(p.id)).sort((a, b) => b.edge - a.edge);
  return {
    picks: uniq,
    gamesFound,
    gamesPriced
  };
}

// Combined economics of a parlay. Independence is assumed for the model
// probability — correlated legs (same game) are flagged separately.
function parlayMath(slip) {
  if (!slip.length) return null;
  let mkt = 1,
    model = 1,
    mult = 1;
  slip.forEach(l => {
    const e = clamp(l.entry, 1, 99);
    // Each leg's real cost includes the venue's taker fee — the payout
    // multiplier has to clear it, or the "EV" flatters the parlay.
    const cost = clamp(e + takerFee(l.market && l.market.venue, e), 1, 99.9);
    mkt *= e / 100;
    model *= clamp(l.modelProb, 1, 99) / 100;
    mult *= 100 / cost;
  });
  const p = model,
    b = mult - 1; // decimal profit multiple
  // Kelly fraction on the parlay; halved for safety, floored at 0.
  const kelly = b > 0 ? Math.max(0, (p * b - (1 - p)) / b) : 0;
  return {
    legs: slip.length,
    mktProb: mkt * 100,
    modelProb: model * 100,
    mult,
    ev: model * mult - 1,
    stake: clamp(kelly / 2 * 100, 0, 25)
  };
}

// Two legs are correlated if they belong to the same game (shared team code).
function parlayConflicts(slip) {
  const bad = new Set();
  for (let i = 0; i < slip.length; i++) {
    for (let j = i + 1; j < slip.length; j++) {
      const a = slip[i].codes || [],
        b = slip[j].codes || [];
      if (a.some(c => b.includes(c))) {
        bad.add(slip[i].id);
        bad.add(slip[j].id);
      }
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
    return {
      tag: "stale line — no live read, skip",
      color: "var(--dim)",
      bet: false
    };
  }
  // A firmly-sourced read is a live model, a fresh in-play book consensus,
  // or a two-plus-book pregame consensus; a model-only projection is softer.
  const firm = p.src === "live" || p.src === "live-books" || p.src === "book" && p.books >= 2;
  // Judge the edge net of the taker fee actually paid on entry.
  const net = p.edge - (p.fee || 0);
  if (net >= 5 && firm) return {
    tag: "STRONG BET",
    color: "var(--moss)",
    bet: true
  };
  if (net >= 2.5) return {
    tag: "LEAN",
    color: "var(--amber)",
    bet: true
  };
  return {
    tag: "no edge — skip",
    color: "var(--dim)",
    bet: false
  };
}

// Auto-build a suggested parlay from the day's priced games: the best
// positive-edge side of each game, one leg per game, ranked and capped.
// "safe" ranks by win probability instead of edge for a lower-variance card.
function suggestParlay(picks, maxLegs, mode) {
  const byGame = {};
  picks.forEach(p => {
    // A frozen pregame line on an in-progress game has no real edge — never
    // auto-build a parlay leg from one.
    if (p.src === "pregame-line") return;
    if (mode === "safe" ? p.modelProb < 55 : p.edge < 2) return;
    const key = p.game || p.id;
    const cur = byGame[key];
    const better = mode === "safe" ? !cur || p.modelProb > cur.modelProb : !cur || p.edge > cur.edge;
    if (better) byGame[key] = p;
  });
  const legs = Object.values(byGame).sort((a, b) => mode === "safe" ? b.modelProb - a.modelProb : b.edge - a.edge).slice(0, maxLegs);
  return legs.map(p => ({
    id: p.id,
    market: p.market,
    modelProb: p.modelProb,
    entry: p.entry,
    codes: p.codes,
    game: p.game
  }));
}

// Friendly label for a YYYYMMDD slate date.
function dateLabel(d) {
  const iso = d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6, 8);
  const today = etDate();
  const tmrw = etDate(Date.now() + 86400000);
  if (iso === today) return "Today";
  if (iso === tmrw) return "Tomorrow";
  try {
    return new Date(iso + "T12:00:00Z").toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric"
    });
  } catch {
    return iso;
  }
}

/* ---- commodities pipeline ----
   Strictly analytical winner-picking for Kalshi's commodity/crypto strike
   ladders. Checks used, all deterministic: (1) live spot + realized
   volatility -> lognormal probability per strike; (2) the ladder's own
   prices as the market's read, for agreement/disagreement; (3) recent
   momentum as context. Deep dive hands the market to the nine-check
   finance analysis for the full research treatment. */
const COMMODITIES = [{
  series: "KXWTI",
  sym: "CL=F",
  label: "WTI Crude (daily)",
  unit: "$",
  crypto: false
}, {
  series: "KXWTIW",
  sym: "CL=F",
  label: "WTI Crude (weekly)",
  unit: "$",
  crypto: false
}, {
  series: "KXBRENTD",
  sym: "BZ=F",
  label: "Brent Crude",
  unit: "$",
  crypto: false
}, {
  series: "KXGOLDD",
  sym: "GC=F",
  label: "Gold (daily)",
  unit: "$",
  crypto: false
}, {
  series: "KXGOLDW",
  sym: "GC=F",
  label: "Gold (weekly)",
  unit: "$",
  crypto: false
}, {
  series: "KXSILVERD",
  sym: "SI=F",
  label: "Silver (daily)",
  unit: "$",
  crypto: false
}, {
  series: "KXSILVERW",
  sym: "SI=F",
  label: "Silver (weekly)",
  unit: "$",
  crypto: false
}, {
  series: "KXBTCD",
  sym: "BTC-USD",
  label: "Bitcoin (daily)",
  unit: "$",
  crypto: true
}, {
  series: "KXETHD",
  sym: "ETH-USD",
  label: "Ethereum (daily)",
  unit: "$",
  crypto: true
}, {
  series: "KXGOLDH",
  sym: "GC=F",
  label: "Gold (hourly)",
  unit: "$",
  crypto: false
}, {
  series: "KXSILVERH",
  sym: "SI=F",
  label: "Silver (hourly)",
  unit: "$",
  crypto: false
}, {
  series: "KXBTC",
  sym: "BTC-USD",
  label: "Bitcoin (hourly)",
  unit: "$",
  crypto: true
}, {
  series: "KXETH",
  sym: "ETH-USD",
  label: "Ethereum (hourly)",
  unit: "$",
  crypto: true
}];

// 15-minute up/down markets: YES = the 60s settlement average at window
// close is at least the window-open reference (floor_strike).
const FAST15 = [{
  series: "KXBTC15M",
  sym: "BTC-USD",
  label: "BTC",
  hub: "https://kalshi.com/crypto"
}, {
  series: "KXETH15M",
  sym: "ETH-USD",
  label: "ETH",
  hub: "https://kalshi.com/crypto"
}, {
  series: "KXSOL15M",
  sym: "SOL-USD",
  label: "SOL",
  hub: "https://kalshi.com/crypto"
}, {
  series: "KXXRP15M",
  sym: "XRP-USD",
  label: "XRP",
  hub: "https://kalshi.com/crypto"
}, {
  series: "KXDOGE15M",
  sym: "DOGE-USD",
  label: "DOGE",
  hub: "https://kalshi.com/crypto"
}, {
  series: "KXADA15M",
  sym: "ADA-USD",
  label: "ADA",
  hub: "https://kalshi.com/crypto"
}, {
  series: "KXBNB15M",
  sym: "BNB-USD",
  label: "BNB",
  hub: "https://kalshi.com/crypto"
}, {
  series: "KXGOLD15M",
  sym: "GC=F",
  pyth: "XAUUSD",
  label: "Gold",
  hub: "https://kalshi.com/markets/kxgold15m/gold-15-minute"
}, {
  series: "KXSILVER15M",
  sym: "SI=F",
  pyth: "XAGUSD",
  label: "Silver",
  hub: "https://kalshi.com/markets/kxsilver15m/silver-15-minute"
}, {
  series: "KXWTI15M",
  sym: "CL=F",
  pyth: "USOILSPOT",
  label: "WTI Oil",
  hub: "https://kalshi.com/markets/kxwti15m/wti-15-minute"
}, {
  series: "KXINX15M",
  sym: "^GSPC",
  label: "S&P 500",
  hub: "https://kalshi.com/markets/kxinx15m/s-p-500-15-minute"
}, {
  series: "KXNDQ15M",
  sym: "^NDX",
  label: "Nasdaq 100",
  hub: "https://kalshi.com/markets/kxndq15m/nasdaq-100-15-minute"
}];

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
    let pv = 0,
      vv = 0;
    for (let i = 0; i < closes.length; i++) {
      pv += closes[i] * (volumes[i] || 0);
      vv += volumes[i] || 0;
    }
    if (vv > 0) vwap = pv / vv;
  }
  if (vwap != null) votes.push({
    k: "VWAP",
    dir: last > vwap ? 1 : -1,
    note: last > vwap ? "above" : "below"
  });
  const win = closes.slice(-120);
  const e9 = emaLast(win, 9),
    e21 = emaLast(win, 21);
  if (e9 != null && e21 != null) votes.push({
    k: "EMA 9/21",
    dir: e9 > e21 ? 1 : -1,
    note: e9 > e21 ? "bull cross" : "bear cross"
  });
  const e12 = emaLast(win, 12),
    e26 = emaLast(win, 26);
  if (e12 != null && e26 != null) {
    const macdSeries = [];
    for (let i = 30; i <= win.length; i += 3) {
      const w = win.slice(0, i);
      macdSeries.push(emaLast(w, 12) - emaLast(w, 26));
    }
    const sig = emaLast(macdSeries, 9);
    const hist = e12 - e26 - (sig == null ? 0 : sig);
    votes.push({
      k: "MACD",
      dir: hist > 0 ? 1 : -1,
      note: hist > 0 ? "momentum up" : "momentum down"
    });
  }
  let g = 0,
    l = 0;
  for (let i = closes.length - 14; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch >= 0) g += ch;else l -= ch;
  }
  const rsi = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  if (rsi >= 72) votes.push({
    k: "RSI " + rsi.toFixed(0),
    dir: -1,
    note: "overbought — fade"
  });else if (rsi <= 28) votes.push({
    k: "RSI " + rsi.toFixed(0),
    dir: 1,
    note: "oversold — fade"
  });
  const body = closes.slice(0, -5);
  const hi = Math.max.apply(null, body),
    lo = Math.min.apply(null, body);
  if (last >= hi) votes.push({
    k: "Breakout",
    dir: 1,
    note: "new session high"
  });else if (last <= lo) votes.push({
    k: "Breakdown",
    dir: -1,
    note: "new session low"
  });
  const score = votes.reduce((s, v) => s + v.dir, 0);
  return {
    votes,
    score,
    rsi,
    vwap,
    lean: score >= 2 ? "UP" : score <= -2 ? "DOWN" : "NEUTRAL"
  };
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
    const r = await fetch(px("https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(sym) + "?range=1d&interval=1m"));
    if (!r.ok) return null;
    const d = await r.json();
    const res = d.chart && d.chart.result && d.chart.result[0];
    if (!res) return null;
    const q0 = res.indicators && res.indicators.quote && res.indicators.quote[0] || {};
    const rawC = q0.close || [],
      rawV = q0.volume || [];
    const closes = [],
      volumes = [];
    for (let i = 0; i < rawC.length; i++) {
      if (Number.isFinite(rawC[i])) {
        closes.push(rawC[i]);
        volumes.push(Number.isFinite(rawV[i]) ? rawV[i] : 0);
      }
    }
    if (closes.length < 30) return null;
    const spot = Number(res.meta && res.meta.regularMarketPrice) || closes[closes.length - 1];
    const sigmaM = ewmaSigma(closes.slice(-240));
    if (!sigmaM) return null;
    const v = {
      spot,
      sigmaM,
      chg15m: closes.length > 15 ? (spot / closes[closes.length - 16] - 1) * 100 : null,
      tech: intradayTech(closes, volumes)
    };
    yahooIntraCache.set(sym, {
      at: Date.now(),
      v
    });
    return v;
  } catch {
    return null;
  }
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
    const r = await fetch(px("https://benchmarks.pyth.network/v1/shims/tradingview/history?symbol=" + encodeURIComponent(sym) + "&resolution=1&from=" + (now - 4 * 3600) + "&to=" + now));
    if (!r.ok) return null;
    const d = await r.json();
    if (d.s !== "ok" || !Array.isArray(d.c) || d.c.length < 30) return null;
    const closes = d.c.filter(x => Number.isFinite(x));
    const spot = closes[closes.length - 1];
    const sigmaM = ewmaSigma(closes.slice(-240));
    if (!sigmaM) return null;
    const v = {
      spot,
      sigmaM,
      chg15m: closes.length > 15 ? (spot / closes[closes.length - 16] - 1) * 100 : null,
      tech: intradayTech(closes, null)
    };
    pythCache.set(sym, {
      at: Date.now(),
      v
    });
    return v;
  } catch {
    return null;
  }
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
    cbSpotCache.set(pair, {
      at: Date.now(),
      v
    });
    return v;
  } catch {
    return null;
  }
}

// Settlement is the AVERAGE of the final 60 seconds, not the last print —
// as the window closes, part of that average is already locked, so the
// effective random horizon shrinks by roughly half the averaging minute.
const settleHorizon = minLeft => Math.max(0.1, minLeft - 0.4);

// Model and market combined in log-odds, equal weight — the 15-minute
// books carry real bot money; ignoring them costs accuracy.
const f15Blend = (pModel, pMkt) => unlogit((logit(clamp(pModel, 0.5, 99.5)) + logit(clamp(pMkt, 0.5, 99.5))) / 2);
async function scanFast15() {
  const root = "https://api.elections.kalshi.com/trade-api/v2";
  const out = [];
  await mapLimit(FAST15, 5, async a => {
    try {
      const r = await fetch(px(root + "/markets?series_ticker=" + a.series + "&status=open&limit=3"));
      if (!r.ok) return;
      const d = await r.json();
      const m = (d.markets || []).filter(x => x.floor_strike != null).sort((x, y) => new Date(x.close_time) - new Date(y.close_time))[0];
      if (!m) return;
      // Settlement-feed first: Pyth candles for metals/oil, Yahoo for the
      // rest; crypto adds the seconds-fresh Coinbase spot on top.
      const q = a.pyth ? await pythIntraday(a.pyth) : await yahooIntraday(a.sym);
      if (!q) return;
      let spot = q.spot;
      if (/-USD$/.test(a.sym)) {
        const live = await coinbaseSpot(a.sym);
        if (live != null) spot = live;
      }
      const km = kaMarket(m);
      const ref = Number(m.floor_strike);
      const minLeft = Math.max(0.2, (new Date(m.close_time) - Date.now()) / 60000);
      const pModel = pAbove(spot, ref, q.sigmaM, settleHorizon(minLeft), techDrift(q.tech, q.sigmaM));
      if (pModel == null) return;
      // Market read = the quote midpoint; the ensemble is the headline.
      const pMkt = km.bid != null && km.ask != null ? (km.bid + km.ask) / 2 : km.price;
      const pUp = pMkt != null ? f15Blend(pModel, pMkt) : pModel;
      out.push({
        a,
        m: km,
        ref,
        spot,
        chg15m: q.chg15m,
        minLeft,
        pUp,
        pModel,
        pMkt,
        close: m.close_time,
        tech: q.tech,
        disagree: pMkt != null && Math.abs(pModel - pMkt) >= 12
      });
    } catch {/* next asset */}
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
  let g = 0,
    l = 0;
  for (let i = closes.length - 14; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch >= 0) g += ch;else l -= ch;
  }
  const rsi = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  const recent = closes.slice(-10),
    older = closes.slice(-60, -10);
  const sd = a => {
    const rs = [];
    for (let i = 1; i < a.length; i++) rs.push(Math.log(a[i] / a[i - 1]));
    const m = rs.reduce((s, x) => s + x, 0) / rs.length;
    return Math.sqrt(rs.reduce((s, x) => s + (x - m) * (x - m), 0) / Math.max(1, rs.length - 1));
  };
  const volRatio = older.length > 10 ? sd(recent) / Math.max(1e-9, sd(older)) : 1;
  const score = (mom5 > 0 ? 1 : mom5 < 0 ? -1 : 0) + (mom20 > 0 ? 1 : mom20 < 0 ? -1 : 0) + (vsSma > 0.2 ? 1 : vsSma < -0.2 ? -1 : 0);
  return {
    mom5,
    mom20,
    vsSma,
    rsi,
    volRatio,
    score,
    label: score >= 2 ? "UPTREND" : score <= -2 ? "DOWNTREND" : "MIXED"
  };
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
  const sse = s => pts.reduce((acc, kv) => acc + Math.pow(normCdf(Math.log(spot / kv[0]) / (s * Math.sqrt(t))) - kv[1], 2), 0);
  let lo = Math.log(1e-6),
    hi = Math.log(1);
  for (let i = 0; i < 60; i++) {
    const a = lo + (hi - lo) * 0.382,
      b = lo + (hi - lo) * 0.618;
    if (sse(Math.exp(a)) < sse(Math.exp(b))) hi = b;else lo = a;
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
    const eNo = 100 - pComb[i] - noCost - takerFee("Kalshi", noCost);
    const cand = eYes >= eNo ? {
      side: "YES",
      strike: ladder[i].K,
      cost: yesCost,
      edge: eYes,
      prob: pComb[i],
      m
    } : {
      side: "NO",
      strike: ladder[i].K,
      cost: noCost,
      edge: eNo,
      prob: 100 - pComb[i],
      m
    };
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
    const r = await fetch(px("https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(sym) + "?range=3mo&interval=1d"));
    if (!r.ok) return null;
    const d = await r.json();
    const res = d.chart && d.chart.result && d.chart.result[0];
    if (!res) return null;
    const closes = (res.indicators && res.indicators.quote && res.indicators.quote[0] && res.indicators.quote[0].close || []).filter(x => Number.isFinite(x));
    if (closes.length < 20) return null;
    const spot = Number(res.meta && res.meta.regularMarketPrice) || closes[closes.length - 1];
    const rets = [];
    for (let i = 1; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
    const mean = rets.reduce((s, x) => s + x, 0) / rets.length;
    const sigmaD = Math.sqrt(rets.reduce((s, x) => s + (x - mean) * (x - mean), 0) / (rets.length - 1));
    const v = {
      spot,
      sigmaD,
      chg1d: (spot / closes[closes.length - 2] - 1) * 100,
      chg5d: closes.length > 6 ? (spot / closes[closes.length - 6] - 1) * 100 : null,
      trend: trendStats(closes)
    };
    yahooCache.set(sym, {
      at: Date.now(),
      v
    });
    return v;
  } catch {
    return null;
  }
}
async function scanCommodities() {
  const root = "https://api.elections.kalshi.com/trade-api/v2";
  const out = [];
  await mapLimit(COMMODITIES, 4, async asset => {
    let d;
    try {
      const r = await fetch(px(root + "/markets?series_ticker=" + asset.series + "&status=open&limit=100"));
      if (!r.ok) return;
      d = await r.json();
    } catch {
      return;
    }
    const raw = (d.markets || []).filter(m => m.floor_strike != null || m.cap_strike != null);
    if (!raw.length) return;
    const q = await yahooHist(asset.sym);
    if (!q) return;
    // Soonest event first; one card per event.
    const byEvent = {};
    raw.forEach(m => {
      (byEvent[m.event_ticker] = byEvent[m.event_ticker] || []).push(m);
    });
    const events = Object.values(byEvent).sort((a, b) => new Date(a[0].close_time) - new Date(b[0].close_time)).slice(0, 2);
    for (const ms of events) {
      const closeT = new Date(ms[0].close_time);
      const days = Math.max(0.02, (closeT - Date.now()) / 86400000);
      const td = asset.crypto ? days : Math.max(0.02, days * 5 / 7);
      // Ascending strike ladder (greater-type strikes, the common shape)
      const ladder = ms.filter(m => /greater/.test(m.strike_type || "") && m.floor_strike != null).map(m => ({
        m: kaMarket(m),
        K: Number(m.floor_strike)
      })).filter(x => Number.isFinite(x.K) && x.m.price != null).sort((a, b) => a.K - b.K);
      if (ladder.length < 2) continue;
      // Short horizons live on the intraday clock: minute-level EWMA vol
      // and the freshest spot beat a 3-month daily average. Daily trend
      // drift applies at daily+ horizons; chart strategies tilt intraday.
      let spotUse = q.spot,
        sigUse = q.sigmaD,
        tUse = td,
        muUse = 0,
        tech = null;
      if (days * 24 <= 48) {
        const qi = await yahooIntraday(asset.sym);
        if (qi) {
          spotUse = qi.spot;
          sigUse = qi.sigmaM;
          tUse = Math.max(0.5, days * 24 * 60);
          tech = qi.tech;
          muUse = techDrift(tech, qi.sigmaM);
        }
      } else {
        muUse = trendDrift(q.trend, q.sigmaD);
      }
      const pMarket = ladder.map(x => clamp(x.m.price, 0.5, 99.5));
      // Volatility blend: geometric mean of trailing realized vol and the
      // forward-looking vol implied by the ladder's own prices.
      const sigImp = impliedSigma(ladder.map(x => x.K), pMarket, spotUse, tUse);
      const sigBlend = sigImp ? Math.sqrt(sigUse * sigImp) : sigUse;
      const pModel = ladder.map(x => pAbove(spotUse, x.K, sigBlend, tUse, muUse));
      if (pModel.some(p => p == null)) continue;
      // Headline = ensemble of model and market per strike; both parents
      // stay visible so disagreement is informative, not hidden.
      const pComb = pModel.map((p, i) => blendProb(p, pMarket[i]));
      const bModel = bucketProbs(ladder.map(x => x.K), pModel);
      const bMarket = bucketProbs(ladder.map(x => x.K), pMarket);
      const bComb = bucketProbs(ladder.map(x => x.K), pComb);
      const bucketName = i => i === 0 ? "Below " + asset.unit + ladder[0].K : i === ladder.length ? "Above " + asset.unit + ladder[ladder.length - 1].K : asset.unit + ladder[i - 1].K + " – " + asset.unit + ladder[i].K;
      const argmax = arr => {
        let w = 0;
        arr.forEach((p, i) => {
          if (p > arr[w]) w = i;
        });
        return w;
      };
      const win = argmax(bComb),
        modelWin = argmax(bModel),
        mktWin = argmax(bMarket);
      out.push({
        asset,
        spot: spotUse,
        sigmaD: sigUse,
        sigImp,
        sigBlend,
        intraday: tUse !== td,
        tech,
        chg1d: q.chg1d,
        chg5d: q.chg5d,
        trend: q.trend,
        drift: muUse,
        title: ms[0].title || asset.label,
        close: ms[0].close_time,
        days,
        ladder,
        pModel,
        pMarket,
        pComb,
        bModel,
        bComb,
        bucketName,
        win,
        winProb: bComb[win],
        modelWin,
        mktWin,
        agree: modelWin === mktWin,
        strikes: ladder.map(x => x.K),
        eventTicker: ms[0].event_ticker
      });
    }
  });
  return out.sort((a, b) => new Date(a.close) - new Date(b.close));
}

/* ---- over/under pipeline ---- */
// Kalshi totals series (YES = combined score reaches the ticker's number).
const TOTAL_SERIES = [["KXMLBTOTAL", "baseball/mlb", "MLB"], ["KXWNBATOTAL", "basketball/wnba", "WNBA"], ["KXNFLTOTAL", "football/nfl", "NFL"], ["KXNHLTOTAL", "hockey/nhl", "NHL"], ["KXCFBTOTAL", "football/college-football", "NCAAF"], ["KXNBATOTAL", "basketball/nba", "NBA"]];

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
  return {
    total,
    frac,
    projected: total / frac
  };
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
    } catch {
      return;
    }
    const ms = (d.markets || []).map(kaMarket).filter(m => m.price != null);
    if (!ms.length) return;
    const parsed = ms.map(m => ({
      m,
      codes: teamCodes(m.id),
      date: tickerDate(m.id),
      line: totalLine(m.id)
    })).filter(x => x.codes.length && x.line != null);
    const dates = [...new Set(parsed.map(x => x.date).filter(Boolean))].sort().slice(0, 4);
    if (!dates.length) return;
    const slates = await mapLimit(dates, 3, dt => espnGamesForLeague(path, dt));
    const gs = [];
    const seen = new Set();
    [].concat(...slates).forEach(g => {
      if (!seen.has(g.eventId)) {
        seen.add(g.eventId);
        gs.push(g);
      }
    });
    if (!gs.length) return;
    const anyLiveGame = gs.some(g => g.state === "in");
    const soonCut = Number(etDate(Date.now() + 36 * 3600 * 1000).replace(/-/g, ""));
    const imminent = anyLiveGame || parsed.some(x => x.date && Number(x.date) <= soonCut);
    const oddsEvents = imminent ? await fetchOddsEvents(path, anyLiveGame) : null;
    const byGame = {};
    parsed.forEach(x => {
      let best = null,
        bestS = 0;
      gs.forEach(g => {
        const s = codeHit(x.codes, g.abbrs) + (x.date && g.date === x.date ? 0.5 : 0);
        if (s > bestS) {
          bestS = s;
          best = g;
        }
      });
      if (!best || bestS < 1) return;
      (byGame[best.eventId] = byGame[best.eventId] || {
        g: best,
        ladder: []
      }).ladder.push(x);
    });
    for (const {
      g,
      ladder
    } of Object.values(byGame)) {
      const ev = matchOddsEvent(oddsEvents, g.name, g.date);
      const tot = ev ? oddsSideMarket(ev, "totals") : null;
      if (!tot) continue;
      let pick = null,
        gap = Infinity;
      ladder.forEach(x => {
        const dGap = Math.abs(x.line - tot.point);
        if (dGap < gap) {
          gap = dGap;
          pick = x;
        }
      });
      if (!pick) continue;
      const exact = gap < 0.01;
      const pace = g.state === "in" ? paceProjection(path, g.detail, g.sides) : null;
      out.push({
        id: pick.m.id,
        market: pick.m,
        league: label,
        game: g.name,
        state: g.state,
        sides: g.sides || null,
        detail: g.detail || "",
        date: pick.date,
        line: pick.line,
        bookLine: tot.point,
        exact,
        pOver: tot.a,
        books: tot.books,
        entry: pick.m.ask != null ? pick.m.ask : pick.m.price,
        pace
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
const pickWon = (pickCode, winner) => !!pickCode && (winner === "TIE" ? /TIE|DRAW/i.test(pickCode) : codeHit([pickCode], [winner]) >= 0.6);

/* ---------------- Commodities ---------------- */
// One-tap research brief per asset: a single search-enabled Claude call
// (macro drivers, supply/demand, positioning, catalysts) cached for six
// hours locally so repeat opens cost nothing.
function ResearchBrief({
  asset,
  spot,
  trend
}) {
  const key = "cd:combrief:" + asset.sym;
  const [brief, setBrief] = useState(() => {
    try {
      const c = JSON.parse(localStorage.getItem(key) || "null");
      if (c && Date.now() - c.at < 6 * 3600 * 1000) return c;
    } catch {/* fresh */}
    return null;
  });
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const name = asset.label.replace(/\s*\(.*\)/, "");
      const r = await callClaude("Today is " + today() + ". You are a commodities analyst. In under 130 words, brief a trader on " + name + " right now: spot is ~" + spot.toFixed(2) + (trend ? ", 20-day move " + trend.mom20.toFixed(1) + "%, RSI " + trend.rsi.toFixed(0) : "") + ". Search for the latest: (1) the one or two macro/supply drivers moving it this week, (2) any scheduled catalyst in the next few days (data releases, OPEC/Fed, expiries), (3) which direction the flows/positioning lean. End with one sentence: does the evidence lean bullish, bearish, or neutral into the next settlement, and why.", {
        search: true,
        maxTokens: 500
      });
      const b = {
        at: Date.now(),
        text: r.text.trim()
      };
      try {
        localStorage.setItem(key, JSON.stringify(b));
      } catch {/* fine */}
      setBrief(b);
    } catch {
      setBrief({
        at: Date.now(),
        text: "Research call failed — try again in a minute."
      });
    }
    setBusy(false);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, !brief && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost btn-sm",
    onClick: run,
    disabled: busy
  }, busy ? "Researching…" : "Research brief (news, drivers, catalysts)"), brief && /*#__PURE__*/React.createElement("details", {
    className: "fold",
    open: true
  }, /*#__PURE__*/React.createElement("summary", null, "Research brief \xB7 ", new Date(brief.at).toLocaleTimeString(), " ", /*#__PURE__*/React.createElement("button", {
    className: "chip",
    style: {
      marginLeft: 8
    },
    onClick: e => {
      e.preventDefault();
      run();
    },
    disabled: busy
  }, busy ? "…" : "refresh")), /*#__PURE__*/React.createElement("p", {
    className: "thesis",
    style: {
      marginTop: 8,
      whiteSpace: "pre-wrap"
    }
  }, brief.text)));
}
function Commodities({
  onPick
}) {
  const [rows, setRows] = useState([]);
  const [fast, setFast] = useState([]);
  const [state, setState] = useState("idle");
  const [at, setAt] = useState(null);
  const [record, setRecord] = useState(null);
  const fastRef = useRef([]);
  const rowsRef = useRef([]);
  const recordRef = useRef(null);
  useEffect(() => {
    fetch("/api/desk/picks").then(r => r.json()).then(d => {
      recordRef.current = d.record || [];
      setRecord(recordRef.current);
    }).catch(() => {
      recordRef.current = [];
    });
  }, []);

  // Log every ladder call once per event; grade it from the settled
  // markets' results after close. The winner-bucket record builds itself
  // exactly like the sports board's.
  async function reconcileCom(scanned) {
    if (!recordRef.current) return;
    const rec = recordRef.current.slice();
    const changed = [];
    scanned.forEach(r => {
      if (!r.eventTicker || new Date(r.close) < Date.now()) return;
      const id = "cm-" + r.eventTicker;
      if (rec.some(x => x.id === id)) return;
      const e = {
        id,
        type: "commodity",
        at: Date.now(),
        league: r.asset.label,
        pick: r.bucketName(r.win),
        win: r.win,
        strikes: r.strikes,
        prob: Math.round(r.winProb * 10) / 10,
        close: r.close,
        result: null
      };
      rec.unshift(e);
      changed.push(e);
    });
    const due = rec.filter(x => x.type === "commodity" && x.result == null && x.close && Date.now() - new Date(x.close) > 10 * 60000).slice(0, 5);
    for (const x of due) {
      try {
        const r2 = await fetch(px("https://api.elections.kalshi.com/trade-api/v2/markets?event_ticker=" + encodeURIComponent(x.id.slice(3)) + "&limit=100"));
        if (!r2.ok) continue;
        const d2 = await r2.json();
        const ms = (d2.markets || []).filter(m => /greater/.test(m.strike_type || "") && m.floor_strike != null && (m.result === "yes" || m.result === "no"));
        if (!ms.length) {
          if (Date.now() - (x.at || 0) > 3 * 86400000) {
            x.result = "void";
            changed.push(x);
          }
          continue;
        }
        // Settle landed above every strike that resolved YES — the actual
        // bucket index is simply the count of YES strikes.
        const actual = ms.filter(m => m.result === "yes").length;
        x.result = actual === x.win ? "won" : "lost";
        x.actual = actual;
        changed.push(x);
      } catch {/* next cycle */}
    }
    recordRef.current = rec;
    if (changed.length) {
      setRecord(rec.slice());
      try {
        await fetch("/api/desk/picks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(changed)
        });
      } catch {/* resend next cycle */}
    }
  }

  // Every confident 15-minute call gets logged once per window and graded
  // from the market's settled result — the record for what gets bet most.
  async function reconcileF15(fastRows) {
    if (!recordRef.current) return;
    const rec = recordRef.current;
    const changed = [];
    fastRows.forEach(f => {
      const conf = Math.max(f.pUp, 100 - f.pUp);
      if (conf < 55) return;
      const id = "f15-" + f.m.id;
      if (rec.some(x => x.id === id)) return;
      const e = {
        id,
        type: "f15",
        at: Date.now(),
        league: f.a.label,
        pick: f.a.label + " " + (f.pUp >= 50 ? "UP" : "DOWN"),
        up: f.pUp >= 50,
        prob: Math.round(conf * 10) / 10,
        close: f.close,
        result: null
      };
      rec.unshift(e);
      changed.push(e);
    });
    const due = rec.filter(x => x.type === "f15" && x.result == null && x.close && Date.now() - new Date(x.close) > 2 * 60000).slice(0, 6);
    for (const x of due) {
      try {
        const r2 = await fetch(px("https://api.elections.kalshi.com/trade-api/v2/markets/" + x.id.slice(4)));
        if (!r2.ok) continue;
        const d2 = await r2.json();
        const res = d2.market && d2.market.result;
        if (res === "yes" || res === "no") {
          x.result = res === "yes" === x.up ? "won" : "lost";
          changed.push(x);
        } else if (Date.now() - (x.at || 0) > 86400000) {
          x.result = "void";
          changed.push(x);
        }
      } catch {/* next cycle */}
    }
    if (changed.length) {
      setRecord(rec.slice());
      try {
        await fetch("/api/desk/picks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(changed)
        });
      } catch {/* resend next cycle */}
    }
  }
  async function run() {
    setState("loading");
    try {
      const f = await scanFast15();
      setRows([]);
      rowsRef.current = [];
      setFast(f);
      fastRef.current = f;
      setAt(Date.now());
      setState("done");
      reconcileF15(f);
    } catch {
      setState("done");
    }
  }
  // Live cadence: 15s while any 15-minute window is running, 45s when a
  // ladder settles within 2 hours, 3 minutes otherwise.
  useEffect(() => {
    let alive = true,
      timer = null;
    const loop = async () => {
      await run();
      if (!alive) return;
      const anyClosing = fastRef.current.some(f => f.minLeft < 4);
      const wait = anyClosing ? 8000 : fastRef.current.length ? 15000 : rowsRef.current.some(r => r.days * 24 < 2) ? 45000 : 180000;
      timer = setTimeout(loop, wait);
    };
    loop();
    const onVis = () => {
      if (!document.hidden) {
        if (timer) clearTimeout(timer);
        loop();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  const tierFor = p => p >= 60 ? {
    c: "var(--moss)",
    t: "STRONG"
  } : p >= 40 ? {
    c: "var(--amber)",
    t: "LEAN"
  } : {
    c: "var(--dim)",
    t: "BEST GUESS"
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
      alignItems: "baseline"
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "sect",
    style: {
      margin: 0
    }
  }, "Commodities \u2014 15-minute predictions"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost btn-sm",
    onClick: run,
    disabled: state === "loading"
  }, state === "loading" ? "Scanning" : "Rescan")), /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      marginTop: 6
    }
  }, "Up or down, every live 15-minute window: crypto around the clock, gold, silver, oil and the stock indexes during their market hours. Each call blends realtime spot, minute-level volatility, the chart strategies, and the market's own quote \u2014 with every graded call building the record below."), at && /*#__PURE__*/React.createElement("div", {
    className: "chips",
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "chip static"
  }, "updated ", new Date(at).toLocaleTimeString()), /*#__PURE__*/React.createElement("span", {
    className: "chip static"
  }, "refreshes every 15s \xB7 8s in a window's final minutes")), state === "loading" && rows.length === 0 && /*#__PURE__*/React.createElement("p", {
    className: "pwait",
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "dots"
  }, "pricing every ladder")), state === "done" && rows.length === 0 && fast.length === 0 && /*#__PURE__*/React.createElement("p", {
    className: "thesis",
    style: {
      color: "var(--dim)",
      marginTop: 10
    }
  }, "No 15-minute windows are live right now \u2014 crypto windows run around the clock, so this usually means a data hiccup; it will retry on its own.")), fast.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      borderColor: "rgba(228,112,126,.4)"
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "sect",
    style: {
      margin: 0,
      color: "var(--rose)"
    }
  }, "\u26A1 15-minute markets \u2014 crypto, metals, oil, indexes"), (() => {
    const g = (record || []).filter(x => x.type === "f15" && (x.result === "won" || x.result === "lost"));
    const w = g.filter(x => x.result === "won").length;
    return g.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "chips",
      style: {
        marginTop: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "chip static",
      style: {
        color: w * 2 >= g.length ? "var(--moss)" : "var(--rose)"
      },
      title: "Every confident 15-minute call, graded against the settled result"
    }, "15-min calls: ", w, "-", g.length - w, " (", Math.round(w / g.length * 100), "%)"));
  })(), /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      marginTop: 6
    }
  }, "My prediction for each live 15-minute window \u2014 up or down \u2014 from the live price vs the window's opening reference, this hour's minute-level volatility, and the chart strategies. Refreshed every 15 seconds. Windows settle on a 60-second average, so late flips near the line can still reverse."), fast.map(f => {
    const up = f.pUp >= 50;
    const conf = up ? f.pUp : 100 - f.pUp;
    const col = conf >= 68 ? "var(--moss)" : conf >= 55 ? "var(--amber)" : "var(--dim)";
    const diff = f.spot - f.ref;
    const diffPct = diff / f.ref * 100;
    return /*#__PURE__*/React.createElement("div", {
      key: f.a.series,
      className: "pick " + (conf >= 68 ? "t-strong" : conf >= 55 ? "t-lean" : "")
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        minWidth: 0,
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "who-big",
      style: {
        display: "block"
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "livedot"
    }), f.a.label, ": ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: col
      }
    }, conf >= 55 ? up ? "UP" : "DOWN" : "COIN FLIP"), f.disagree && /*#__PURE__*/React.createElement("span", {
      className: "srcchip bad",
      style: {
        marginLeft: 8,
        fontSize: 9
      }
    }, "MODEL vs MARKET SPLIT"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: "var(--dim)",
        fontWeight: 400
      }
    }, " ", "\xB7 ", Math.max(0, f.minLeft).toFixed(0), " min left")), /*#__PURE__*/React.createElement("span", {
      className: "meta-line",
      style: {
        display: "block"
      }
    }, "now ", f.spot.toLocaleString(undefined, {
      maximumFractionDigits: 4
    }), " vs open ", f.ref.toLocaleString(undefined, {
      maximumFractionDigits: 4
    }), " ", "(", /*#__PURE__*/React.createElement("b", {
      style: {
        color: diff >= 0 ? "var(--moss)" : "var(--rose)"
      }
    }, diff >= 0 ? "+" : "", diffPct.toFixed(3), "%"), ")", f.pMkt != null ? " · model " + f.pModel.toFixed(0) + "% · market " + f.pMkt.toFixed(0) + "% up" : " · model " + f.pModel.toFixed(0) + "% up", f.chg15m != null ? " · prior 15m " + (f.chg15m >= 0 ? "+" : "") + f.chg15m.toFixed(2) + "%" : ""), f.tech && f.tech.votes.length > 0 && /*#__PURE__*/React.createElement("span", {
      className: "meta-line",
      style: {
        display: "block"
      }
    }, "charts", " ", /*#__PURE__*/React.createElement("b", {
      style: {
        color: f.tech.lean === "UP" ? "var(--moss)" : f.tech.lean === "DOWN" ? "var(--rose)" : "var(--dim)"
      }
    }, f.tech.lean === "NEUTRAL" ? "neutral" : "lean " + f.tech.lean), ": ", f.tech.votes.map(v => v.k + " " + v.note).join(" · "))), /*#__PURE__*/React.createElement("span", {
      className: "tierbox",
      style: {
        color: col,
        borderColor: col
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "pct"
    }, conf.toFixed(0), "%"), /*#__PURE__*/React.createElement("span", {
      className: "lbl"
    }, conf >= 55 ? up ? "UP" : "DOWN" : "TOSS-UP")), /*#__PURE__*/React.createElement("span", {
      className: "pick-actions"
    }, /*#__PURE__*/React.createElement("a", {
      className: "chip",
      href: kalshiEventLink(f.m.id),
      target: "_blank",
      rel: "noreferrer"
    }, "trade \u2197")));
  }), /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      marginTop: 8
    }
  }, "Honesty note: 15-minute moves are nearly random \u2014 treat COIN FLIP as the true answer for most windows. The model only claims UP or DOWN when the remaining time makes the current lead hard to reverse.")));
}

/* ---------------- Today's picks ----------------
   The landing board: every live, today's, and upcoming game with the side
   worth picking — books-consensus true odds, net edge after fees, the
   scanner's decision, and the full-analysis verdict when one exists. Free
   to refresh; deep dive hands the market to the Analyze pipeline. */
function Picks({
  ledger,
  onPick
}) {
  // Warm start: the last scan renders instantly while a fresh one runs.
  // Validate every cached entry — a stale cache written by an older build
  // must never be able to crash the first render.
  const [picks, setPicks] = useState(() => {
    try {
      const c = JSON.parse(localStorage.getItem("cd:lastPicks") || "null");
      if (c && Date.now() - c.at < 30 * 60 * 1000 && Array.isArray(c.picks)) {
        return c.picks.filter(p => p && p.market && p.id && Number.isFinite(p.modelProb) && Number.isFinite(p.entry) && Number.isFinite(p.edge));
      }
    } catch {/* cold start */}
    return [];
  });
  const [state, setState] = useState("idle");
  const [err, setErr] = useState(null);
  const [scanInfo, setScanInfo] = useState(null);
  const [record, setRecord] = useState(null); // graded winner-pick history
  const [totals, setTotals] = useState([]); // over/under reads
  const recordRef = useRef(null);
  const anyLive = useRef(false);

  // Load the picks record once; reconcile against the current scan when
  // both sides are ready.
  const picksRef = useRef(picks);
  picksRef.current = picks;
  useEffect(() => {
    fetch("/api/desk/picks").then(r => r.json()).then(d => {
      recordRef.current = d.record || [];
      setRecord(recordRef.current);
      // Grade immediately on load — the scoreboard back-fill works even
      // before (or without) a scan completing.
      reconcileRecord(picksRef.current || []);
    }).catch(() => {
      recordRef.current = [];
      setRecord([]);
    });
  }, []);

  // Log every pregame call the board makes, and grade calls whose games
  // have finished — the winner-picks track record builds itself.
  async function reconcileRecord(allPicks) {
    if (!recordRef.current) return;
    const rec = recordRef.current.slice();
    const changed = [];
    const todayEt = etDate().replace(/-/g, "");
    const byGame = {};
    allPicks.forEach(p => {
      const k = p.game || p.id;
      if (!byGame[k] || p.modelProb > byGame[k].modelProb) byGame[k] = p;
    });
    Object.values(byGame).forEach(p => {
      if (p.state !== "pre" || p.modelProb < 55 || p.src !== "book" || (p.books || 0) < 2 || !p.eventId) return;
      const id = "pk-" + p.eventId;
      if (rec.some(r => r.id === id)) return;
      const e = {
        id,
        at: Date.now(),
        date: tickerDate(p.market.id),
        league: p.league,
        path: p.path,
        game: p.game,
        eventId: p.eventId,
        pick: p.market.name,
        pickCode: (p.codes || [])[0] || null,
        prob: Math.round(p.modelProb * 10) / 10,
        books: p.books,
        result: null
      };
      rec.unshift(e);
      changed.push(e);
    });
    const byEvent = {};
    allPicks.forEach(p => {
      if (p.eventId) byEvent[p.eventId] = p;
    });
    rec.forEach(r => {
      if (r.result != null) return;
      const p = byEvent[r.eventId];
      if (!p || p.state !== "post" || !p.sides) return;
      const w = gameWinnerAbbr(p.sides);
      if (!w) return;
      r.result = pickWon(r.pickCode, w) ? "won" : "lost";
      r.final = p.sides.map(s => s.abbr + " " + (s.score != null ? s.score : "-")).join(" ");
      changed.push(r);
    });
    // Settled games fall off the scan (their Kalshi markets close), and a
    // game finishing TONIGHT still carries today's date — grade every
    // pending entry that isn't currently visible as a pre/live game
    // straight from the scoreboard, a batch per cycle.
    const stale = rec.filter(r => {
      if (r.result != null || !r.date || r.date > todayEt) return false;
      const inScan = byEvent[r.eventId];
      return !inScan || inScan.state === "post"; // pre/in games aren't done — skip the fetch
    }).slice(0, 10);
    for (const r of stale) {
      try {
        const gs = await espnGamesForLeague(r.path, r.date);
        const g = gs.find(x => x.eventId === r.eventId);
        if (g && g.state === "post" && g.sides) {
          const w = gameWinnerAbbr(g.sides);
          if (w) {
            r.result = pickWon(r.pickCode, w) ? "won" : "lost";
            r.final = g.sides.map(s => s.abbr + " " + (s.score != null ? s.score : "-")).join(" ");
            changed.push(r);
          }
        } else if (Date.now() - (r.at || 0) > 5 * 86400000) {
          r.result = "void";
          changed.push(r); // postponed or untraceable
        }
      } catch {/* grade next cycle */}
    }
    recordRef.current = rec;
    if (changed.length) {
      setRecord(rec.slice());
      try {
        await fetch("/api/desk/picks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(changed)
        });
      } catch {/* re-sent next cycle */}
    }
  }
  async function run() {
    setState("loading");
    setErr(null);
    try {
      const [{
        picks: p,
        gamesFound,
        gamesPriced
      }, tot] = await Promise.all([scanEdges(), scanTotals().catch(() => [])]);
      setPicks(p);
      setTotals(tot);
      setScanInfo({
        gamesFound,
        gamesPriced,
        at: Date.now()
      });
      setState("done");
      try {
        localStorage.setItem("cd:lastPicks", JSON.stringify({
          at: Date.now(),
          picks: p
        }));
      } catch {/* private mode */}
      reconcileRecord(p);
      anyLive.current = p.some(x => x.state === "in") || tot.some(x => x.state === "in");
      if (!p.length) {
        setErr(gamesFound === 0 ? "No open game markets right now — the next slate isn't listed on Kalshi yet." : "Found " + gamesFound + " games, but books haven't posted lines yet. Picks fill in about a day before game time.");
      }
    } catch (e) {
      setErr("Scan failed: " + e.message);
      setState("idle");
    }
  }
  // Auto-refresh: every 45 seconds while games are live (win probs, scores
  // and clocks move play by play), every 5 minutes otherwise. The odds feed
  // is cached server-side, so the fast cadence doesn't burn credits.
  useEffect(() => {
    let alive = true,
      timer = null;
    const loop = async () => {
      await run();
      if (!alive) return;
      timer = setTimeout(loop, anyLive.current ? 45000 : 300000);
    };
    loop();
    const onVis = () => {
      if (!document.hidden) {
        if (timer) clearTimeout(timer);
        loop();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // WINNER-centric: for each game keep the side the books/models say WINS
  // (highest true probability) — price and value are secondary notes.
  const groups = useMemo(() => {
    const byGame = {};
    picks.forEach(p => {
      if (p.src === "pregame-line") return; // stale mid-game line — no honest winner read
      const k = p.game || p.id;
      if (!byGame[k] || p.modelProb > byGame[k].modelProb) byGame[k] = p;
    });
    const rows = Object.values(byGame);
    const todayEt = etDate().replace(/-/g, "");
    const g = {
      live: [],
      today: [],
      soon: []
    };
    rows.forEach(p => {
      const d = tickerDate(p.market.id);
      if (p.state === "in") g.live.push(p);else if (d === todayEt) g.today.push(p);else g.soon.push(p);
    });
    g.live.sort((a, b) => b.modelProb - a.modelProb);
    g.today.sort((a, b) => b.modelProb - a.modelProb);
    g.soon.sort((a, b) => (tickerDate(a.market.id) || "").localeCompare(tickerDate(b.market.id) || "") || b.modelProb - a.modelProb);
    // Top picks: the most certain winners on today's card (live included).
    g.top = [...g.live, ...g.today].filter(p => p.modelProb >= 65).sort((a, b) => b.modelProb - a.modelProb).slice(0, 6);
    return g;
  }, [picks]);
  const analysisFor = p => (ledger || []).find(x => x.venue === "Kalshi" && x.marketId === p.id && x.call && x.call !== "SYNCED") || null;
  const tier = p => p.modelProb >= 80 ? {
    t: "STRONGEST",
    cls: "t-strongest",
    c: "var(--moss)"
  } : p.modelProb >= 68 ? {
    t: "STRONG",
    cls: "t-strong",
    c: "var(--moss)"
  } : p.modelProb >= 55 ? {
    t: "LEAN",
    cls: "t-lean",
    c: "var(--amber)"
  } : {
    t: "TOSS-UP",
    cls: "",
    c: "var(--dim)"
  };
  const row = (p, rank) => {
    const tr = tier(p);
    const an = analysisFor(p);
    const dec = pickDecision(p);
    const n = p.edge - (p.fee || 0);
    return /*#__PURE__*/React.createElement("div", {
      key: p.id,
      className: "pick " + tr.cls
    }, rank != null && /*#__PURE__*/React.createElement("span", {
      className: "rank"
    }, rank), /*#__PURE__*/React.createElement("span", {
      style: {
        minWidth: 0,
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "who-big",
      style: {
        display: "block"
      }
    }, p.state === "in" ? /*#__PURE__*/React.createElement("span", {
      className: "livedot"
    }) : null, p.market.name === p.market.question ? p.market.question : p.market.name), /*#__PURE__*/React.createElement("span", {
      className: "meta-line",
      style: {
        display: "block"
      }
    }, p.league, " \xB7 ", p.state === "in" && p.sides && p.sides.some(s => s.score != null) ? /*#__PURE__*/React.createElement("b", {
      style: {
        color: "var(--bone)"
      }
    }, p.sides.map(s => s.abbr + " " + (s.score != null ? s.score : "-")).join(" · ") + (p.detail ? " · " + p.detail : "")) : p.game, " · ", p.src === "live" ? "live model" : p.src === "live-books" ? "in-play books" : p.src === "model" ? "model projection" : p.books + " book" + (p.books === 1 ? "" : "s") + " consensus", " · market consensus " + p.entry.toFixed(0) + "%", an && /*#__PURE__*/React.createElement("span", {
      style: {
        color: an.call.indexOf("BUY") === 0 ? "var(--amber)" : "var(--dim)"
      }
    }, " · analysis: " + an.call + (an.confidence ? " (" + an.confidence.toLowerCase() + ")" : ""))), (p.ou || p.spr) && /*#__PURE__*/React.createElement("span", {
      className: "meta-line",
      style: {
        display: "block"
      }
    }, p.ou && /*#__PURE__*/React.createElement(React.Fragment, null, "O/U ", p.ou.point, ":", " ", /*#__PURE__*/React.createElement("b", {
      style: {
        color: p.ou.a >= 55 || p.ou.b >= 55 ? "var(--amber)" : "var(--dim)"
      }
    }, p.ou.a >= 55 ? "OVER (" + p.ou.a.toFixed(0) + "%)" : p.ou.b >= 55 ? "UNDER (" + p.ou.b.toFixed(0) + "%)" : "coin flip"), " · " + p.ou.books + " books"), p.spr && /*#__PURE__*/React.createElement(React.Fragment, null, p.ou ? " · " : "", "spread ", p.homeAbbr || "home", " ", p.spr.point > 0 ? "+" : "", p.spr.point, ":", " ", /*#__PURE__*/React.createElement("b", {
      style: {
        color: p.spr.a >= 55 || p.spr.b >= 55 ? "var(--amber)" : "var(--dim)"
      }
    }, p.spr.a >= 55 ? (p.homeAbbr || "home") + " covers (" + p.spr.a.toFixed(0) + "%)" : p.spr.b >= 55 ? (p.awayAbbr || "away") + " covers (" + p.spr.b.toFixed(0) + "%)" : "coin flip")))), /*#__PURE__*/React.createElement("span", {
      className: "tierbox",
      style: {
        color: tr.c,
        borderColor: tr.c
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "pct"
    }, p.modelProb.toFixed(0), "%"), /*#__PURE__*/React.createElement("span", {
      className: "lbl"
    }, tr.t)), /*#__PURE__*/React.createElement("span", {
      className: "pick-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "chip",
      onClick: () => onPick(p.market),
      title: "Run every check on this pick"
    }, "deep dive"), /*#__PURE__*/React.createElement("a", {
      className: "chip",
      href: p.market.link,
      target: "_blank",
      rel: "noreferrer"
    }, "open \u2197")));
  };
  const section = (title, arr, color, ranked) => arr.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("p", {
    className: "sect",
    style: {
      margin: 0,
      color
    }
  }, title, " (", arr.length, ")"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, arr.map((p, i) => row(p, ranked ? i + 1 : null))));
  const strongest = groups.top.filter(p => p.modelProb >= 80).length;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
      alignItems: "baseline"
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "sect",
    style: {
      margin: 0
    }
  }, "Today's predictions \u2014 who wins"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost btn-sm",
    onClick: run,
    disabled: state === "loading"
  }, state === "loading" ? "Scanning" : "Rescan")), /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      marginTop: 6
    }
  }, "The projected winner of every event on the board \u2014 by the de-vigged consensus of every sportsbook, the live win-probability models, and your full analyses where you've run them.", " ", /*#__PURE__*/React.createElement("b", null, groups.top.length ? groups.top.length + " top pick" + (groups.top.length === 1 ? "" : "s") + " today" + (strongest ? ", " + strongest + " at 80%+ certainty." : ".") : "No high-certainty winners on today's card yet."), " ", "Deep dive runs all nine checks on any pick."), (() => {
    const scored = (record || []).filter(r => r.result === "won" || r.result === "lost");
    const pending = (record || []).filter(r => r.result == null).length;
    const wins = scored.filter(r => r.result === "won").length;
    const strong = scored.filter(r => (r.prob || 0) >= 80);
    const strongWins = strong.filter(r => r.result === "won").length;
    return (scanInfo || scored.length > 0 || pending > 0) && /*#__PURE__*/React.createElement("div", {
      className: "chips",
      style: {
        marginTop: 8
      }
    }, scored.length > 0 && /*#__PURE__*/React.createElement("span", {
      className: "chip static",
      style: {
        color: wins * 2 >= scored.length ? "var(--moss)" : "var(--rose)",
        borderColor: "rgba(127,185,139,.45)"
      },
      title: "Every pregame winner call this board makes is logged and graded when the game ends"
    }, "Board's calls: ", wins, "-", scored.length - wins, " (", Math.round(wins / scored.length * 100), "%)"), pending > 0 && /*#__PURE__*/React.createElement("span", {
      className: "chip static",
      title: "Logged pregame calls waiting for their games to finish \u2014 they grade automatically"
    }, pending, " pick", pending === 1 ? "" : "s", " awaiting results"), strong.length > 0 && /*#__PURE__*/React.createElement("span", {
      className: "chip static",
      title: "Calls made at 80%+ certainty"
    }, "80%+ tier: ", strongWins, "-", strong.length - strongWins), scanInfo && /*#__PURE__*/React.createElement("span", {
      className: "chip static"
    }, scanInfo.gamesPriced, " of ", scanInfo.gamesFound, " games priced"), scanInfo && scanInfo.at && /*#__PURE__*/React.createElement("span", {
      className: "chip static"
    }, "updated ", new Date(scanInfo.at).toLocaleTimeString()), anyLive.current && /*#__PURE__*/React.createElement("span", {
      className: "chip static",
      style: {
        color: "var(--rose)",
        borderColor: "rgba(228,112,126,.5)"
      }
    }, "\u25CF live \u2014 refreshing every 45s"), oddsQuota && /*#__PURE__*/React.createElement("span", {
      className: "chip static"
    }, "odds feed \xB7 ", oddsQuota.remaining, " credits"));
  })(), state === "loading" && picks.length === 0 && /*#__PURE__*/React.createElement("p", {
    className: "pwait",
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "dots"
  }, "reading the books on every game")), err && /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      marginTop: 10,
      color: "var(--rose)"
    }
  }, err)), section("Top picks today", groups.top, "var(--amber)", true), section("● Live now", groups.live, "var(--rose)"), section("Today — every game", groups.today, undefined), totals.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("p", {
    className: "sect",
    style: {
      margin: 0
    }
  }, "Over / Unders (", totals.length, ")"), /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      marginTop: 6
    }
  }, "Kalshi's total-score markets read against the books' de-vigged totals consensus \u2014 the call is OVER or UNDER at the line, with live scoring pace as a sanity check during games."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, totals.map(t => {
    const over = t.pOver >= 50;
    const conf = Math.max(t.pOver, 100 - t.pOver);
    const cls = conf >= 68 ? "t-strong" : conf >= 55 ? "t-lean" : "";
    const col = conf >= 68 ? "var(--moss)" : conf >= 55 ? "var(--amber)" : "var(--dim)";
    const overCost = t.entry,
      underCost = t.entry != null ? 100 - t.entry : null;
    return /*#__PURE__*/React.createElement("div", {
      key: t.id,
      className: "pick " + cls
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        minWidth: 0,
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "who-big",
      style: {
        display: "block"
      }
    }, t.state === "in" ? /*#__PURE__*/React.createElement("span", {
      className: "livedot"
    }) : null, /*#__PURE__*/React.createElement("span", {
      style: {
        color: col
      }
    }, conf >= 55 ? over ? "OVER " : "UNDER " : "Total "), t.line, conf < 55 ? " — coin flip" : ""), /*#__PURE__*/React.createElement("span", {
      className: "meta-line",
      style: {
        display: "block"
      }
    }, t.league, " \xB7 ", t.state === "in" && t.sides && t.sides.some(s => s.score != null) ? /*#__PURE__*/React.createElement("b", {
      style: {
        color: "var(--bone)"
      }
    }, t.sides.map(s => s.abbr + " " + (s.score != null ? s.score : "-")).join(" · ") + (t.detail ? " · " + t.detail : "")) : t.game, " · " + t.books + " book" + (t.books === 1 ? "" : "s"), !t.exact ? " · books' line is " + t.bookLine + " (nearest Kalshi strike shown)" : "", " · market: over " + (overCost != null ? overCost.toFixed(0) + "%" : "—") + ", under " + (underCost != null ? underCost.toFixed(0) + "%" : "—")), t.pace && /*#__PURE__*/React.createElement("span", {
      className: "meta-line",
      style: {
        display: "block"
      }
    }, "pace: ", /*#__PURE__*/React.createElement("b", {
      style: {
        color: t.pace.projected > t.line ? "var(--amber)" : "var(--cyan)"
      }
    }, t.pace.total, " so far, on pace for ~", t.pace.projected.toFixed(0)), " vs the ", t.line, " line")), /*#__PURE__*/React.createElement("span", {
      className: "tierbox",
      style: {
        color: col,
        borderColor: col
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "pct"
    }, conf.toFixed(0), "%"), /*#__PURE__*/React.createElement("span", {
      className: "lbl"
    }, conf >= 55 ? over ? "OVER" : "UNDER" : "TOSS-UP")), /*#__PURE__*/React.createElement("span", {
      className: "pick-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "chip",
      onClick: () => onPick(t.market)
    }, "deep dive"), /*#__PURE__*/React.createElement("a", {
      className: "chip",
      href: t.market.link,
      target: "_blank",
      rel: "noreferrer"
    }, "open \u2197")));
  }))), section("Coming up", groups.soon, "var(--dim)"), record && record.some(r => r.result === "won" || r.result === "lost") && /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("details", {
    className: "fold",
    open: true
  }, /*#__PURE__*/React.createElement("summary", null, "The board's call record \u2014 every pregame pick it made, graded (this is the app's record, not your bets \u2014 those live in My trades)"), record.filter(r => r.result === "won" || r.result === "lost").slice(0, 12).map(r => /*#__PURE__*/React.createElement("div", {
    key: r.id,
    className: "score-row",
    style: {
      borderBottom: "1px solid rgba(65,75,99,.35)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "who",
    style: {
      fontSize: 13
    }
  }, r.pick, /*#__PURE__*/React.createElement("span", {
    className: "sub",
    style: {
      display: "block"
    }
  }, r.league, " \xB7 ", r.game, " \xB7 called at ", r.prob, "%", r.final ? " · final " + r.final : "")), /*#__PURE__*/React.createElement("span", {
    className: "pts",
    style: {
      fontSize: 13.5,
      color: r.result === "won" ? "var(--moss)" : "var(--rose)"
    }
  }, r.result.toUpperCase()))), /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      marginTop: 8
    }
  }, "Every pregame call the board makes gets logged and graded automatically. The tiers should win at roughly their stated rates \u2014 an 80% call that wins 60% of the time means the reads are off."))));
}
function Parlay({
  onPick
}) {
  const [picks, setPicks] = useState([]);
  const [state, setState] = useState("idle");
  const [err, setErr] = useState(null);
  const [slip, setSlip] = useState([]);
  const [view, setView] = useState("locks"); // locks | value | live
  const [minEdge, setMinEdge] = useState(3);
  const [sugLegs, setSugLegs] = useState(3);
  const [sugMode, setSugMode] = useState("safe"); // safe (most likely) | value
  const [kp, setKp] = useState(null); // Kalshi combined-parlay preview
  const [kpBusy, setKpBusy] = useState(false);
  const [kpCount, setKpCount] = useState(10);
  const [kpConfirm, setKpConfirm] = useState(false);
  const [kpResult, setKpResult] = useState(null);
  const [scanInfo, setScanInfo] = useState(null);
  async function run() {
    setState("loading");
    setErr(null);
    try {
      const {
        picks: p,
        gamesFound,
        gamesPriced
      } = await scanEdges();
      setPicks(p);
      setScanInfo({
        gamesFound,
        gamesPriced
      });
      setState("done");
      if (!p.length) {
        setErr(gamesFound === 0 ? "No open game markets to scan right now — the next slate isn't listed on Kalshi yet. Check back closer to game day." : "Found " + gamesFound + " upcoming game" + (gamesFound === 1 ? "" : "s") + ", but sportsbooks haven't posted lines for " + (gamesPriced === 0 ? "them" : "most") + " yet. Betting lines appear roughly a day before game time — rescan then and picks will fill in.");
      }
    } catch (e) {
      setErr("Scan failed: " + e.message);
      setState("idle");
    }
  }
  useEffect(() => {
    run();
  }, []);
  // If a scan turns up live games, jump to that view — it's what you came for.
  const jumped = useRef(false);
  useEffect(() => {
    if (!jumped.current && picks.some(p => p.state === "in")) {
      jumped.current = true;
      setView("live");
    }
  }, [picks]);
  const inSlip = id => slip.some(l => l.id === id);
  const toggle = p => setSlip(s => inSlip(p.id) ? s.filter(l => l.id !== p.id) : s.length >= 8 ? s : [...s, {
    id: p.id,
    market: p.market,
    modelProb: p.modelProb,
    entry: p.entry,
    codes: p.codes,
    game: p.game
  }]);

  // Reset any Kalshi preview whenever the legs change.
  useEffect(() => {
    setKp(null);
    setKpConfirm(false);
    setKpResult(null);
  }, [slip]);
  const allKalshi = slip.length >= 2 && slip.every(l => l.market.venue === "Kalshi");
  async function previewKalshi() {
    setKpBusy(true);
    setKpResult(null);
    setKpConfirm(false);
    try {
      const r = await fetch("/api/desk/kalshi/parlay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          tickers: slip.map(l => l.market.id),
          place: false
        })
      });
      const d = await r.json();
      setKp(d.error ? {
        error: d.error
      } : d);
    } catch (e) {
      setKp({
        error: e.message
      });
    }
    setKpBusy(false);
  }
  async function placeKalshi() {
    setKpBusy(true);
    setKpResult(null);
    try {
      const r = await fetch("/api/desk/kalshi/parlay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          tickers: slip.map(l => l.market.id),
          count: kpCount,
          place: true
        })
      });
      const d = await r.json();
      setKpResult(d.ok ? {
        ok: true,
        msg: "Parlay placed on Kalshi — bought " + d.count + " contracts. Check My trades / your Kalshi account."
      } : {
        ok: false,
        msg: d.error || "Order failed."
      });
      setKpConfirm(false);
    } catch (e) {
      setKpResult({
        ok: false,
        msg: e.message
      });
    }
    setKpBusy(false);
  }
  const liveCount = useMemo(() => new Set(picks.filter(p => p.state === "in").map(p => p.game)).size, [picks]);
  const shown = useMemo(() => {
    // One row per game — the single side worth betting — so it's never
    // ambiguous which way to wager. Value/live rank by edge; favorites by
    // win probability.
    const dedupe = (arr, better) => {
      const byGame = {};
      arr.forEach(p => {
        const k = p.game || p.id;
        if (!byGame[k] || better(p, byGame[k])) byGame[k] = p;
      });
      return Object.values(byGame);
    };
    if (view === "live") {
      return dedupe(picks.filter(p => p.state === "in"), (p, c) => p.edge > c.edge).sort((a, b) => b.edge - a.edge).slice(0, 40);
    }
    if (view === "value") {
      return dedupe(picks, (p, c) => p.edge > c.edge).filter(p => p.edge >= minEdge).sort((a, b) => b.edge - a.edge).slice(0, 25);
    }
    return dedupe(picks, (p, c) => p.modelProb > c.modelProb).filter(p => p.modelProb >= 70).sort((a, b) => b.modelProb - a.modelProb).slice(0, 25);
  }, [picks, view, minEdge]);
  const pm = parlayMath(slip);
  const conflicts = parlayConflicts(slip);

  // Best parlay per day: group priced games by their slate date, build a
  // suggestion for each, soonest first.
  const byDay = useMemo(() => {
    const groups = {};
    picks.forEach(p => {
      const d = tickerDate(p.market.id);
      if (d) (groups[d] = groups[d] || []).push(p);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0])).map(([date, ps]) => ({
      date,
      legs: suggestParlay(ps, sugLegs, sugMode)
    })).filter(x => x.legs.length >= 2);
  }, [picks, sugLegs, sugMode]);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
      alignItems: "baseline"
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "sect",
    style: {
      margin: 0
    }
  }, "Build a parlay"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost btn-sm",
    onClick: run,
    disabled: state === "loading"
  }, state === "loading" ? "Scanning" : "Rescan")), /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      marginTop: 6
    }
  }, "Every open game is checked against the sportsbook's de-vigged line \u2014 a fair, free read on who's really favored. Tap picks to stack them; the slip works out the combined odds and whether the parlay is a good bet. This scan costs nothing."), /*#__PURE__*/React.createElement("div", {
    className: "chips",
    style: {
      marginTop: 12
    }
  }, liveCount > 0 && /*#__PURE__*/React.createElement("button", {
    className: "chip" + (view === "live" ? " on" : ""),
    onClick: () => setView("live"),
    style: {
      borderColor: "rgba(228,112,126,.6)",
      color: view === "live" ? undefined : "var(--rose)"
    }
  }, "\u25CF Live now (", liveCount, ")"), /*#__PURE__*/React.createElement("button", {
    className: "chip" + (view === "locks" ? " on" : ""),
    onClick: () => setView("locks")
  }, "Most likely winners"), view === "value" && /*#__PURE__*/React.createElement("span", {
    className: "chip static"
  }, "min edge", " ", /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    max: "20",
    value: minEdge,
    onChange: e => setMinEdge(Math.max(0, Number(e.target.value) || 0)),
    style: {
      width: 44,
      marginLeft: 6,
      background: "rgba(0,0,0,.22)",
      border: "1px solid var(--slate-600)",
      borderRadius: 6,
      color: "var(--bone)",
      padding: "2px 6px",
      fontFamily: "'JetBrains Mono',monospace"
    }
  }), "c"), scanInfo && scanInfo.gamesPriced ? /*#__PURE__*/React.createElement("span", {
    className: "chip static"
  }, scanInfo.gamesPriced, " games priced") : null, oddsQuota && /*#__PURE__*/React.createElement("span", {
    className: "chip static",
    title: "The Odds API request credits left this month"
  }, "odds feed \xB7 ", oddsQuota.remaining, " credits"))), err && /*#__PURE__*/React.createElement("div", {
    className: "panel err"
  }, err), state === "done" && byDay.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      paddingBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
      alignItems: "baseline"
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "sect",
    style: {
      margin: 0
    }
  }, "Best parlay each day"), /*#__PURE__*/React.createElement("div", {
    className: "chips",
    style: {
      marginTop: 0
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "chip" + (sugMode === "safe" ? " on" : ""),
    onClick: () => setSugMode("safe")
  }, "most likely"), /*#__PURE__*/React.createElement("button", {
    className: "chip" + (sugMode === "value" ? " on" : ""),
    onClick: () => setSugMode("value")
  }, "value"), [2, 3, 4].map(n => /*#__PURE__*/React.createElement("button", {
    key: n,
    className: "chip" + (sugLegs === n ? " on" : ""),
    onClick: () => setSugLegs(n)
  }, n, " legs")))), /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      marginTop: 6
    }
  }, "One auto-built parlay per slate that has lines \u2014 the ", sugMode === "safe" ? "highest-probability" : "biggest-edge", " side of several games, one leg per game. Tap a day to load it into the slip and tweak it.")), state === "done" && byDay.map(({
    date,
    legs
  }) => {
    const dm = parlayMath(legs);
    return /*#__PURE__*/React.createElement("div", {
      key: date,
      className: "panel",
      style: {
        borderColor: "rgba(127,185,139,.45)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "baseline"
      }
    }, /*#__PURE__*/React.createElement("p", {
      className: "sect",
      style: {
        margin: 0
      }
    }, dateLabel(date)), /*#__PURE__*/React.createElement("span", {
      className: "eyebrow",
      style: {
        color: dm.ev > 0 ? "var(--moss)" : "var(--dim)"
      }
    }, dm.modelProb.toFixed(dm.modelProb < 10 ? 1 : 0), "% chance all ", legs.length, " hit \xB7 pays ", dm.mult.toFixed(1), "\xD7")), legs.map(l => /*#__PURE__*/React.createElement("div", {
      key: l.id,
      className: "score-row",
      style: {
        borderBottom: "1px solid rgba(65,75,99,.35)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "who",
      style: {
        fontSize: 13.5
      }
    }, /*#__PURE__*/React.createElement("a", {
      href: l.market.link,
      target: "_blank",
      rel: "noreferrer",
      style: {
        color: "inherit",
        textDecoration: "none"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--moss)"
      }
    }, "Bet "), l.market.name === l.market.question ? l.market.question : l.market.name, " \u2197")), /*#__PURE__*/React.createElement("span", {
      className: "pts",
      style: {
        fontSize: 14
      }
    }, /*#__PURE__*/React.createElement("b", {
      style: {
        color: l.modelProb >= 68 ? "var(--moss)" : l.modelProb >= 55 ? "var(--amber)" : "var(--dim)"
      }
    }, l.modelProb.toFixed(0), "% to win"), /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--dim)",
        fontSize: 11
      }
    }, " @ ", l.entry.toFixed(0), "c")))), /*#__PURE__*/React.createElement("div", {
      className: "figures",
      style: {
        marginTop: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "fig"
    }, /*#__PURE__*/React.createElement("span", {
      className: "big",
      style: {
        color: dm.modelProb >= 50 ? "var(--moss)" : dm.modelProb >= 25 ? "var(--amber)" : "var(--rose)"
      }
    }, dm.modelProb.toFixed(dm.modelProb < 10 ? 1 : 0), "%"), /*#__PURE__*/React.createElement("span", {
      className: "cap"
    }, "Chance all ", dm.legs, " hit"), /*#__PURE__*/React.createElement("span", {
      className: "sub"
    }, "By the books' true odds, per leg")), /*#__PURE__*/React.createElement("div", {
      className: "fig"
    }, /*#__PURE__*/React.createElement("span", {
      className: "big"
    }, dm.mult.toFixed(1), "\xD7"), /*#__PURE__*/React.createElement("span", {
      className: "cap"
    }, "Pays if it hits"), /*#__PURE__*/React.createElement("span", {
      className: "sub"
    }, "$100 \u2192 $", (dm.mult * 100).toFixed(0)))), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-sm",
      style: {
        marginTop: 12
      },
      onClick: () => setSlip(legs)
    }, "Load ", dateLabel(date).toLowerCase(), "'s parlay into slip"));
  }), slip.length > 0 && pm && /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      borderColor: "rgba(242,179,61,.4)"
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "sect"
  }, "Your parlay \xB7 ", pm.legs, " leg", pm.legs === 1 ? "" : "s"), slip.map(l => /*#__PURE__*/React.createElement("div", {
    key: l.id,
    className: "score-row",
    style: {
      borderBottom: "1px solid rgba(65,75,99,.35)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "who",
    style: {
      fontSize: 13.5
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: l.market.link,
    target: "_blank",
    rel: "noreferrer",
    style: {
      color: "inherit",
      textDecoration: "none"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--moss)"
    }
  }, "Bet "), l.market.name === l.market.question ? l.market.question : l.market.name, " \u2197"), conflicts.has(l.id) && /*#__PURE__*/React.createElement("span", {
    className: "srcchip bad",
    style: {
      marginLeft: 8
    }
  }, "same game")), /*#__PURE__*/React.createElement("span", {
    className: "pts",
    style: {
      fontSize: 15
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: l.modelProb >= 68 ? "var(--moss)" : l.modelProb >= 55 ? "var(--amber)" : "var(--dim)"
    }
  }, l.modelProb.toFixed(0), "%"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--dim)",
      fontSize: 11
    }
  }, " @ ", l.entry.toFixed(0), "c"), /*#__PURE__*/React.createElement("button", {
    className: "chip",
    style: {
      marginLeft: 8
    },
    onClick: () => setSlip(s => s.filter(x => x.id !== l.id))
  }, "remove")))), /*#__PURE__*/React.createElement("div", {
    className: "figures",
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "fig"
  }, /*#__PURE__*/React.createElement("span", {
    className: "big",
    style: {
      color: pm.modelProb >= 50 ? "var(--moss)" : pm.modelProb >= 25 ? "var(--amber)" : "var(--rose)"
    }
  }, pm.modelProb.toFixed(pm.modelProb < 10 ? 1 : 0), "%"), /*#__PURE__*/React.createElement("span", {
    className: "cap"
  }, "Chance every leg hits"), /*#__PURE__*/React.createElement("span", {
    className: "sub"
  }, "The books' true odds multiplied across your legs")), /*#__PURE__*/React.createElement("div", {
    className: "fig"
  }, /*#__PURE__*/React.createElement("span", {
    className: "big"
  }, pm.mult.toFixed(1), "\xD7"), /*#__PURE__*/React.createElement("span", {
    className: "cap"
  }, "Pays if it hits"), /*#__PURE__*/React.createElement("span", {
    className: "sub"
  }, "$100 returns $", (pm.mult * 100).toFixed(0), " if every leg wins"))), /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      marginTop: 12,
      color: pm.ev > 0 ? "var(--moss)" : "var(--dim)"
    }
  }, conflicts.size > 0 ? "Two legs are from the same game — those aren't independent, so the real win chance is off. Swap one out for a clean parlay." : pm.ev > 0 ? "Positive expected value: the lines say this combo pays more than the risk. Parlays still lose most of the time — the multiplier is the point, not the hit rate." : "Negative expected value on these lines — the payout doesn't cover the combined risk. Fewer legs or bigger edges fix that."), allKalshi && conflicts.size === 0 && /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      marginTop: 14,
      background: "rgba(0,0,0,.14)"
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "label",
    style: {
      marginBottom: 6
    }
  }, "Place this on Kalshi as one parlay"), !kp && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-sm",
    onClick: previewKalshi,
    disabled: kpBusy
  }, kpBusy ? "Building…" : "Get Kalshi's parlay price"), kp && kp.error && /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      color: "var(--rose)"
    }
  }, "Kalshi couldn't build this parlay: ", kp.error), kp && !kp.error && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "meta",
    style: {
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "Kalshi parlay price"), /*#__PURE__*/React.createElement("span", {
    className: "v",
    style: {
      color: "var(--cyan)"
    }
  }, kp.ask != null ? kp.ask.toFixed(0) + "c" : "—")), kp.ticker && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "After you buy"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, /*#__PURE__*/React.createElement("a", {
    className: "srcchip",
    href: "https://kalshi.com/portfolio",
    target: "_blank",
    rel: "noreferrer"
  }, "it shows in your Kalshi portfolio \u2197"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "Model win chance"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, pm.modelProb.toFixed(pm.modelProb < 10 ? 1 : 0), "%")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "Edge vs Kalshi (after fee)"), (() => {
    const net = kp.ask != null ? pm.modelProb - kp.ask - takerFee("Kalshi", kp.ask) : null;
    return /*#__PURE__*/React.createElement("span", {
      className: "v",
      style: {
        color: net != null && net > 2 ? "var(--moss)" : "var(--dim)"
      }
    }, net != null ? (net > 0 ? "+" : "") + net.toFixed(0) + "c" : "—");
  })())), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginTop: 10,
      alignItems: "flex-end",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "k eyebrow",
    style: {
      display: "block",
      marginBottom: 4
    }
  }, "Contracts"), /*#__PURE__*/React.createElement("input", {
    className: "srch",
    type: "number",
    min: "1",
    value: kpCount,
    onChange: e => setKpCount(Math.max(1, Math.round(Number(e.target.value) || 1))),
    style: {
      width: 100,
      padding: "8px 10px",
      flex: "none"
    }
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "Approx cost"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, kp.ask != null ? "$" + (kp.ask * kpCount / 100).toFixed(2) : "—")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "Pays if it hits"), /*#__PURE__*/React.createElement("span", {
    className: "v",
    style: {
      color: "var(--moss)"
    }
  }, "$", kpCount.toFixed(2)))), !kpConfirm ? /*#__PURE__*/React.createElement("button", {
    className: "btn btn-sm",
    style: {
      marginTop: 12
    },
    onClick: () => setKpConfirm(true),
    disabled: kp.ask == null || kp.ask >= 99
  }, "Place parlay on Kalshi") : /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      marginTop: 12,
      background: "rgba(228,112,126,.07)",
      borderColor: "rgba(228,112,126,.4)"
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "thesis",
    style: {
      margin: 0
    }
  }, "Buy ", /*#__PURE__*/React.createElement("b", null, kpCount), " contracts of this ", /*#__PURE__*/React.createElement("b", null, pm.legs, "-leg parlay"), " at market (~", kp.ask != null ? kp.ask.toFixed(0) : "?", "c, about $", kp.ask != null ? (kp.ask * kpCount / 100).toFixed(2) : "?", "). This places a real order on your Kalshi account. It pays $", kpCount.toFixed(2), " only if ", /*#__PURE__*/React.createElement("b", null, "all ", pm.legs, " legs"), " win."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 12,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-sm",
    style: {
      background: "linear-gradient(180deg,#EC8391,#E4707E)"
    },
    onClick: placeKalshi,
    disabled: kpBusy
  }, kpBusy ? "Placing…" : "Yes, place it"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost btn-sm",
    onClick: () => setKpConfirm(false),
    disabled: kpBusy
  }, "Cancel")))), kpResult && /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      marginTop: 8,
      color: kpResult.ok ? "var(--moss)" : "var(--rose)"
    }
  }, kpResult.msg), /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      marginTop: 8
    }
  }, "This builds Kalshi's native combo market for your exact legs \u2014 one all-or-nothing ticket, not separate bets.")), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost btn-sm",
    style: {
      marginTop: 12
    },
    onClick: () => setSlip([])
  }, "Clear slip")), /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, state === "loading" && /*#__PURE__*/React.createElement("p", {
    className: "pwait"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dots"
  }, "pricing every game against the book")), state === "done" && shown.length === 0 && !err && /*#__PURE__*/React.createElement("p", {
    className: "thesis",
    style: {
      color: "var(--dim)"
    }
  }, view === "live" ? "No games are in progress right now." : view === "value" ? "No games clear a " + minEdge + "c edge right now. Lower the threshold or check the favorites view." : "No strong favorites priced right now."), shown.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    className: "sel",
    style: {
      cursor: "default",
      borderColor: inSlip(p.id) ? "var(--amber)" : undefined
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: p.market.link,
    target: "_blank",
    rel: "noreferrer",
    style: {
      color: "var(--bone)",
      textDecoration: "none",
      fontWeight: 600
    },
    onMouseOver: e => {
      e.currentTarget.style.color = "var(--cyan)";
    },
    onMouseOut: e => {
      e.currentTarget.style.color = "var(--bone)";
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: p.modelProb >= 68 ? "var(--moss)" : p.modelProb >= 55 ? "var(--amber)" : "var(--dim)"
    }
  }, "Winner: "), p.market.name === p.market.question ? p.market.question : p.market.name, " \u2197"), /*#__PURE__*/React.createElement("span", {
    className: "sub"
  }, p.state === "in" ? /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--rose)"
    }
  }, "\u25CF LIVE") : null, p.state === "in" ? " " : "", p.league, " \xB7 ", p.state === "in" ? "in progress" : p.state === "post" ? "final" : "upcoming", " \xB7", p.src === "live" ? " live win prob" : p.src === "live-books" ? " in-play books" : p.src === "pregame-line" ? " pregame line (no live model)" : p.src === "model" ? " model projection" : " " + (p.books > 1 ? p.books + " books" : "1 book"), " \xB7 costs ", p.entry.toFixed(0), "c", p.disp > 6 ? " · books split" : "")), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      gap: 10,
      alignItems: "center",
      flex: "0 0 auto"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "sig",
    style: {
      color: p.modelProb >= 68 ? "var(--moss)" : p.modelProb >= 55 ? "var(--amber)" : "var(--dim)",
      borderColor: p.modelProb >= 68 ? "var(--moss)" : p.modelProb >= 55 ? "var(--amber)" : "var(--dim)"
    },
    title: "True odds " + p.modelProb.toFixed(1) + "% by " + (p.books || 1) + " book(s); contract costs " + p.entry.toFixed(0) + "c"
  }, p.modelProb.toFixed(0), "% TO WIN"), /*#__PURE__*/React.createElement("button", {
    className: "chip" + (inSlip(p.id) ? " on" : ""),
    onClick: () => toggle(p)
  }, inSlip(p.id) ? "added" : "add"), /*#__PURE__*/React.createElement("button", {
    className: "chip",
    onClick: () => onPick(p.market),
    title: "Full nine-way analysis and a firm wager decision"
  }, "deep dive"), /*#__PURE__*/React.createElement("a", {
    className: "chip",
    href: p.market.link,
    target: "_blank",
    rel: "noreferrer"
  }, "open \u2197")))), state === "done" && shown.length > 0 && /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      marginTop: 12
    }
  }, "The percentage is each side's chance of winning by the de-vigged book consensus and live models \u2014 stack the outcomes you believe in and the slip shows the chance they all happen. Tap ", /*#__PURE__*/React.createElement("b", null, "deep dive"), " for the full nine-way read on any pick.")));
}

/* ---------------- Browse ---------------- */
function Browse({
  onPick
}) {
  const [rows, setRows] = useState([]);
  const [state, setState] = useState("idle");
  const [err, setErr] = useState(null);
  const [counts, setCounts] = useState({
    Kalshi: 0,
    Polymarket: 0
  });
  const [qy, setQy] = useState("");
  const [venue, setVenue] = useState("all");
  const [catF, setCatF] = useState("all");
  async function load() {
    setState("loading");
    setErr(null);
    const out = [];
    const problems = [];

    // Kalshi returns 200 at a time behind a cursor. One page is an arbitrary
    // slice of the exchange, so walk several pages to get a real picture.
    const kalshi = async () => {
      const root = "https://api.elections.kalshi.com/trade-api/v2";
      let raw = 0,
        sample = null,
        kept = 0;
      const take = ms => {
        ms.forEach(m => {
          if (!sample && m && m.ticker) sample = m;
          const km = kaMarket(m);
          if (km.price !== null) {
            out.push(km);
            kept++;
          }
        });
      };

      // Paged market list.
      let cursor = "",
        pages = 0;
      while (pages < 6) {
        const r = await fetch(px(root + "/markets?status=open&limit=200" + (cursor ? "&cursor=" + cursor : "")));
        if (!r.ok) {
          problems.push("Kalshi /markets returned " + r.status);
          break;
        }
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
          const ms = (d.events || []).flatMap(e => e.markets || []);
          raw += ms.length;
          take(ms);
        }
      } catch {/* the market list above is the primary source */}
      if (raw && !kept) {
        problems.push("Kalshi sent " + raw + " markets, none with a price field I recognise. Fields on the first record: " + (sample ? Object.keys(sample).join(", ") : "none"));
      }
      if (!raw) problems.push("Kalshi sent 0 markets.");
    };
    const poly = async () => {
      const r = await fetch(px("https://gamma-api.polymarket.com/events?closed=false&limit=100&order=volume24hr&ascending=false"));
      if (!r.ok) {
        problems.push("Polymarket returned " + r.status);
        return;
      }
      const d = await r.json();
      (Array.isArray(d) ? d : []).forEach(ev => {
        const ms = (ev.markets || []).map(m => pmMarket(m, ev)).filter(m => m.price !== null);
        if (ms.length) out.push(ms.sort((a, b) => b.volume - a.volume)[0]);
      });
    };
    const res = await Promise.allSettled([kalshi(), poly()]);
    res.forEach(x => {
      if (x.status === "rejected") problems.push(String(x.reason && x.reason.message || x.reason));
    });
    const seen = new Set();
    const uniq = out.filter(m => {
      const k = m.venue + m.id;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    out.length = 0;
    uniq.forEach(m => out.push(m));
    const c = {
      Kalshi: 0,
      Polymarket: 0
    };
    out.forEach(m => {
      c[m.venue] = (c[m.venue] || 0) + 1;
    });
    setCounts(c);
    if (!out.length) {
      setErr("Neither venue returned markets. " + (problems.join(" · ") || "No error reported — check /api/desk/diag."));
      setState("idle");
      return;
    }
    if (problems.length) setErr(problems.join(" · "));
    setRows(out.sort((a, b) => (b.quoted === a.quoted ? 0 : b.quoted ? 1 : -1) || b.volume - a.volume));
    setState("done");
  }
  useEffect(() => {
    load();
  }, []);
  const shown = useMemo(() => rows.filter(m => {
    if (venue !== "all" && m.venue !== venue) return false;
    if (catF !== "all" && guessCategory(m.question + " " + m.name + " " + m.id) !== catF) return false;
    if (!qy.trim()) return true;
    // Ticker matters: a WTA contract is titled by player, not by "tennis".
    const t = (m.question + " " + m.name + " " + m.id).toLowerCase();
    return qy.toLowerCase().split(/\s+/).every(w => t.includes(w));
  }).slice(0, 120), [rows, qy, venue, catF]);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "bar"
  }, /*#__PURE__*/React.createElement("input", {
    className: "srch",
    value: qy,
    onChange: e => setQy(e.target.value),
    placeholder: "Filter by keyword or ticker \u2014 wta, fed, lakers, kxhigh\u2026",
    "aria-label": "Filter markets"
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost",
    onClick: load,
    disabled: state === "loading"
  }, state === "loading" ? "Loading" : "Refresh")), /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      marginTop: 12
    }
  }, "Everything trading right now on both exchanges, busiest first. Tap one to analyze it."), /*#__PURE__*/React.createElement("div", {
    className: "chips"
  }, ["all", "Polymarket", "Kalshi"].map(v => /*#__PURE__*/React.createElement("button", {
    key: v,
    className: "chip" + (venue === v ? " on" : ""),
    onClick: () => setVenue(v)
  }, v)), ["sports", "politics", "finance", "weather"].map(k => /*#__PURE__*/React.createElement("button", {
    key: k,
    className: "chip" + (catF === k ? " on" : ""),
    onClick: () => setCatF(catF === k ? "all" : k)
  }, k)), /*#__PURE__*/React.createElement("span", {
    className: "chip static"
  }, "Kalshi ", counts.Kalshi, " \xB7 Polymarket ", counts.Polymarket, " \xB7 ", shown.length, " shown")), err && /*#__PURE__*/React.createElement("div", {
    className: "panel err"
  }, err), /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, state === "loading" && /*#__PURE__*/React.createElement("p", {
    className: "pwait"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dots"
  }, "loading markets from both exchanges")), state === "done" && shown.length === 0 && /*#__PURE__*/React.createElement("p", {
    className: "thesis",
    style: {
      color: "var(--dim)"
    }
  }, rows.length ? "No contract matches \"" + qy + "\". Kalshi titles name the player or number, not the sport — try a ticker fragment like wta or kxhigh, or clear the filter." : "Nothing loaded. Hit Refresh."), shown.map(m => /*#__PURE__*/React.createElement("button", {
    key: m.venue + m.id,
    className: "sel",
    onClick: () => onPick(m)
  }, /*#__PURE__*/React.createElement("span", null, m.name === m.question ? m.question : m.question + " — " + m.name, /*#__PURE__*/React.createElement("span", {
    className: "sub"
  }, m.venue, " \xB7 ", m.id, " \xB7 vol ", Math.round(m.volume).toLocaleString(), m.close ? " · " + String(m.close).slice(0, 10) : "")), /*#__PURE__*/React.createElement("span", {
    className: "px"
  }, m.quoted === false ? "—" : m.price.toFixed(0) + "c")))));
}

/* ---------------- Frameworks ---------------- */
function Frameworks({
  fw,
  save,
  ledger,
  reset
}) {
  const [cat, setCat] = useState("politics");
  const lib = fw[cat];
  const reliability = useMemo(() => {
    const acc = {};
    ledger.filter(e => e.status === "resolved" && e.outcome !== null).forEach(e => {
      if (e.category !== cat) return;
      (e.pillars || []).forEach(p => {
        if (!p.signal || p.signal === "NEUTRAL" || (p.strength || 0) < 1) return;
        acc[p.n] = acc[p.n] || {
          hit: 0,
          n: 0
        };
        acc[p.n].n++;
        const said = p.signal === "YES" ? 1 : 0;
        if (said === e.outcome) acc[p.n].hit++;
      });
    });
    return acc;
  }, [ledger, cat]);
  function edit(n, key, value) {
    const next = {
      ...fw,
      [cat]: {
        ...lib,
        items: lib.items.map(p => p.n === n ? {
          ...p,
          [key]: value
        } : p)
      }
    };
    save(next);
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "chips",
    style: {
      marginTop: 0
    }
  }, Object.keys(fw).map(k => /*#__PURE__*/React.createElement("button", {
    key: k,
    className: "chip" + (k === cat ? " on" : ""),
    onClick: () => setCat(k)
  }, fw[k].label))), /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("p", {
    className: "sect"
  }, "The nine checks for ", lib.label.toLowerCase()), /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      marginBottom: 18
    }
  }, "Each box is an instruction I follow when researching. Reword one and my analysis changes \u2014 these go to the model exactly as written. Switch one off and it stops running, which also makes each analysis cheaper. The percentage is how often that check pointed the right way on markets you have already seen settle."), lib.items.map(p => {
    const r = reliability[p.n];
    return /*#__PURE__*/React.createElement("div", {
      key: p.n,
      className: "fw"
    }, /*#__PURE__*/React.createElement("div", {
      className: "fw-top"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 10,
        alignItems: "center",
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "pnum"
    }, String(p.n).padStart(2, "0")), /*#__PURE__*/React.createElement("input", {
      type: "text",
      value: p.name,
      onChange: e => edit(p.n, "name", e.target.value),
      style: {
        marginTop: 0,
        fontWeight: 600,
        fontSize: 13.5
      },
      "aria-label": "Framework name"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        alignItems: "center",
        flex: "0 0 auto"
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "rel",
      style: {
        color: r ? r.hit / r.n >= 0.6 ? "var(--moss)" : r.hit / r.n < 0.4 ? "var(--rose)" : "var(--dim)" : "var(--dim)"
      }
    }, r ? Math.round(r.hit / r.n * 100) + "% · n" + r.n : "no data"), /*#__PURE__*/React.createElement("button", {
      className: "sw" + (p.enabled ? " on" : ""),
      onClick: () => edit(p.n, "enabled", !p.enabled),
      "aria-label": p.enabled ? "Turn off" : "Turn on"
    }, /*#__PURE__*/React.createElement("i", null)))), /*#__PURE__*/React.createElement("textarea", {
      rows: 2,
      value: p.method,
      onChange: e => edit(p.n, "method", e.target.value),
      "aria-label": "Method"
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 10,
        marginTop: 7,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "text",
      value: p.sources,
      onChange: e => edit(p.n, "sources", e.target.value),
      placeholder: "Preferred sources",
      style: {
        flex: "1 1 200px",
        marginTop: 0,
        fontSize: 11.5
      },
      "aria-label": "Preferred sources"
    }), /*#__PURE__*/React.createElement("label", {
      className: "eyebrow",
      style: {
        display: "flex",
        alignItems: "center",
        gap: 7
      }
    }, "Weight", /*#__PURE__*/React.createElement("input", {
      type: "number",
      min: "0",
      max: "3",
      step: "0.5",
      value: p.weight,
      onChange: e => edit(p.n, "weight", Number(e.target.value)),
      style: {
        width: 60,
        marginTop: 0
      },
      "aria-label": "Weight"
    }))));
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost btn-sm",
    style: {
      marginTop: 10
    },
    onClick: reset
  }, "Put everything back the way it was")));
}

/* ---------------- Ledger ---------------- */
function Ledger({
  ledger,
  setLedger,
  fw
}) {
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState(null);

  // Check for settled markets automatically when the tab opens, at most
  // once an hour — reliability scores stay fresh without anyone remembering.
  useEffect(() => {
    let last = 0;
    try {
      last = Number(localStorage.getItem("cd:lastResCheck") || 0);
    } catch {/* fine */}
    if (ledger.some(e => e.status === "open") && Date.now() - last > 3600000) {
      try {
        localStorage.setItem("cd:lastResCheck", String(Date.now()));
      } catch {/* fine */}
      checkResolutions();
    }
  }, []);
  async function checkResolutions() {
    setChecking(true);
    setNote(null);
    const open = ledger.filter(e => e.status === "open");
    const updates = [];
    for (const e of open) {
      try {
        let outcome = null;
        if (e.venue === "Kalshi") {
          const r = await fetch(px("https://api.elections.kalshi.com/trade-api/v2/markets/" + e.marketId));
          const d = await r.json();
          const m = d.market;
          if (m && m.result === "yes") outcome = 1;else if (m && m.result === "no") outcome = 0;
        } else if (e.slug) {
          const r = await fetch(px("https://gamma-api.polymarket.com/events?slug=" + encodeURIComponent(e.slug)));
          const d = await r.json();
          const ev = Array.isArray(d) ? d[0] : d;
          const m = ev && (ev.markets || []).find(x => (x.conditionId || String(x.id)) === e.marketId);
          if (m && m.closed) {
            const pxs = jparse(m.outcomePrices).map(Number);
            const outs = jparse(m.outcomes);
            const yi = Math.max(0, outs.findIndex(o => String(o).toLowerCase() === "yes"));
            if (pxs[yi] >= 0.99) outcome = 1;else if (pxs[yi] <= 0.01) outcome = 0;
          }
        }
        if (outcome !== null) updates.push({
          ...e,
          status: "resolved",
          outcome,
          resolvedAt: Date.now()
        });
      } catch {/* leave it open, try again later */}
    }
    if (updates.length) {
      setLedger(L => L.map(e => updates.find(u => u.id === e.id) || e));
      try {
        await fetch("/api/desk/ledger", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(updates)
        });
      } catch {/* in memory */}
    }
    setNote(updates.length ? updates.length + " market" + (updates.length === 1 ? "" : "s") + " resolved and scored." : open.length ? "Nothing has settled yet. " + open.length + " still open." : "No open calls to check.");
    setChecking(false);
  }
  const done = ledger.filter(e => e.status === "resolved" && e.outcome !== null);
  const stats = useMemo(() => {
    if (!done.length) return null;
    const brier = (p, o) => Math.pow(p / 100 - o, 2);
    // Brier comparison only over genuine analyses — synced positions have
    // fair === price by construction and would flatten the gap.
    const scored = done.filter(e => e.call !== "SYNCED");
    const model = scored.length ? scored.reduce((s, e) => s + brier(e.fair, e.outcome), 0) / scored.length : null;
    const mkt = scored.length ? scored.reduce((s, e) => s + brier(e.price, e.outcome), 0) / scored.length : null;
    // A "call" bets the side it named: BUY YES/NO from analyses, the actual
    // held side for positions synced from Kalshi.
    const acted = done.filter(e => e.call === "BUY YES" || e.call === "BUY NO" || e.call === "SYNCED" && e.taken && e.taken.side);
    const calledSide = e => e.call === "BUY YES" ? 1 : e.call === "BUY NO" ? 0 : e.taken && e.taken.side === "YES" ? 1 : 0;
    const wins = acted.filter(e => calledSide(e) === e.outcome).length;
    return {
      n: done.length,
      model,
      mkt,
      acted: acted.length,
      wins,
      hit: acted.length ? wins / acted.length : null
    };
  }, [done]);
  async function clearAll() {
    setLedger([]);
    try {
      await fetch("/api/desk/ledger", {
        method: "DELETE"
      });
    } catch {/* in memory */}
    setNote("Ledger cleared.");
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("p", {
    className: "sect"
  }, "Am I any good at this?"), /*#__PURE__*/React.createElement("p", {
    className: "help",
    style: {
      marginBottom: 4
    }
  }, "Every analysis gets logged. When a market settles, I score what I said against what happened \u2014 and against what the market\u2019s own price would have scored."), !stats ? /*#__PURE__*/React.createElement("p", {
    className: "thesis",
    style: {
      color: "var(--dim)",
      marginTop: 10
    }
  }, "Nothing has settled yet. Run some analyses, come back after those markets resolve, and hit \"Check for results\" \u2014 this fills in then. Until it does, treat every call you see as unproven.") : /*#__PURE__*/React.createElement("div", {
    className: "scorecard",
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "k eyebrow"
  }, "Settled"), /*#__PURE__*/React.createElement("div", {
    className: "n"
  }, stats.n)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "k eyebrow"
  }, "My score"), /*#__PURE__*/React.createElement("div", {
    className: "n",
    style: {
      color: stats.model != null && stats.model < stats.mkt ? "var(--moss)" : "var(--rose)"
    }
  }, stats.model == null ? "—" : stats.model.toFixed(3))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "k eyebrow"
  }, "Market score"), /*#__PURE__*/React.createElement("div", {
    className: "n",
    style: {
      color: "var(--dim)"
    }
  }, stats.mkt == null ? "—" : stats.mkt.toFixed(3))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "k eyebrow"
  }, "Calls I got right"), /*#__PURE__*/React.createElement("div", {
    className: "n"
  }, stats.hit === null ? "—" : Math.round(stats.hit * 100) + "%"), /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, stats.wins, "/", stats.acted, " acted"))), stats && /*#__PURE__*/React.createElement("p", {
    className: "thesis",
    style: {
      marginTop: 16,
      color: "var(--dim)"
    }
  }, "These scores measure how close a probability landed to what actually happened \u2014 lower is better, and the comparison is the whole point. ", stats.model == null ? "Only synced positions have settled so far — no desk analyses to score yet." : stats.model < stats.mkt ? "Right now I score better than the market's own prices. Don't read much into it yet; a few dozen calls prove nothing." : "Right now the market's prices score better than mine. Until that flips, treat every gap I show you as noise."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      display: "flex",
      gap: 10,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-sm",
    onClick: checkResolutions,
    disabled: checking
  }, checking ? "Checking" : "Check for results"), ledger.length > 0 && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost btn-sm",
    onClick: clearAll
  }, "Clear ledger")), note && /*#__PURE__*/React.createElement("p", {
    className: "thesis",
    style: {
      marginTop: 12
    }
  }, note)), /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("p", {
    className: "sect"
  }, "Every call I have made (", ledger.length, ")"), ledger.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "thesis",
    style: {
      color: "var(--dim)",
      marginTop: 10
    }
  }, "Nothing yet. Analyze a market and it lands here so you can hold me to it later.") : /*#__PURE__*/React.createElement("table", {
    className: "tbl"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Market"), /*#__PURE__*/React.createElement("th", null, "I said"), /*#__PURE__*/React.createElement("th", null, "Price \u2192 my price"), /*#__PURE__*/React.createElement("th", null, "Topic"), /*#__PURE__*/React.createElement("th", null, "Happened?"))), /*#__PURE__*/React.createElement("tbody", null, ledger.slice(0, 80).map(e => /*#__PURE__*/React.createElement("tr", {
    key: e.id
  }, /*#__PURE__*/React.createElement("td", null, e.name === e.question ? e.question : e.question + " — " + e.name, /*#__PURE__*/React.createElement("span", {
    className: "sub eyebrow",
    style: {
      display: "block",
      marginTop: 3
    }
  }, e.venue, " \xB7 ", new Date(e.ts).toISOString().slice(0, 10))), /*#__PURE__*/React.createElement("td", {
    className: "m",
    style: {
      color: e.call === "PASS" ? "var(--dim)" : e.call === "BUY YES" ? "var(--amber)" : "var(--rose)"
    }
  }, e.call), /*#__PURE__*/React.createElement("td", {
    className: "m"
  }, e.price.toFixed(0), "\u2192", e.fair.toFixed(0), "c"), /*#__PURE__*/React.createElement("td", {
    className: "m",
    style: {
      color: "var(--dim)"
    }
  }, (fw[e.category] || {}).label || e.category), /*#__PURE__*/React.createElement("td", {
    className: "m"
  }, e.status === "open" ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--dim)"
    }
  }, "open") : /*#__PURE__*/React.createElement("span", {
    style: {
      color: e.outcome === 1 ? "var(--moss)" : "var(--rose)"
    }
  }, e.outcome === 1 ? "YES" : "NO"))))))));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));
window.__deskMounted = true; // boot watchdog in index.html stands down