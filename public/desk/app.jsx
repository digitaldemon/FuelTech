/* global React, ReactDOM */
const { useState, useRef, useEffect, useMemo } = React;

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

/* signature: probability rail */
.rail-box { margin:26px 0 6px; }
.rail { position:relative; height:52px; background:rgba(0,0,0,.22);
  border:1px solid var(--slate-600); border-radius:9px; overflow:visible;
  box-shadow:0 2px 8px rgba(0,0,0,.25) inset; }
.rail-tick { position:absolute; top:0; bottom:0; width:1px; background:var(--line); }
.rail-band { position:absolute; top:1px; bottom:1px;
  background-image:repeating-linear-gradient(45deg, rgba(242,179,61,.30) 0 5px, rgba(242,179,61,.07) 5px 10px);
  transition:left .7s cubic-bezier(.22,1,.36,1), width .7s cubic-bezier(.22,1,.36,1); }
.rail-band.neg { background-image:repeating-linear-gradient(45deg, rgba(228,112,126,.30) 0 5px, rgba(228,112,126,.07) 5px 10px); }
.rail-mark { position:absolute; top:-7px; bottom:-7px; width:2px; transition:left .7s cubic-bezier(.22,1,.36,1); }
.rail-mark .lbl { position:absolute; left:50%; transform:translateX(-50%); white-space:nowrap;
  font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:.08em; padding:3px 8px; border-radius:6px;
  box-shadow:0 2px 8px rgba(0,0,0,.3); }
.rail-mark .lbl.top { bottom:calc(100% + 5px); }
.rail-mark .lbl.bot { top:calc(100% + 5px); }
.rail-scale { display:flex; justify-content:space-between; margin-top:26px; }
.rail-scale span { font-family:'JetBrains Mono',monospace; font-size:10px; color:var(--dim); }
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
const today = () => new Date().toISOString().slice(0, 10);
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
    volume: num(m.volume) || num(m.volume_fp) || num(m.volume_24h_fp),
    liquidity: num(m.open_interest) || num(m.open_interest_fp) || num(m.liquidity_dollars),
    close: m.close_time || null,
    rules: String(m.rules_primary || "").slice(0, 900),
    venue: "Kalshi",
    link: "https://kalshi.com/markets/" + String(m.ticker).split("-")[0].toLowerCase(),
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
    // Some payloads quote dollars, others cents — normalise to cents.
    if (Math.max.apply(null, points.map((pt) => pt.p)) <= 1.001) points = points.map((pt) => ({ t: pt.t, p: pt.p * 100 }));
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
async function fetchCurrentPrice(e) {
  try {
    if (e.venue === "Kalshi") {
      const r = await fetch(px("https://api.elections.kalshi.com/trade-api/v2/markets/" + e.marketId));
      if (!r.ok) return null;
      const d = await r.json();
      if (d.market) return kaPrice(d.market).price;
    } else if (e.slug) {
      const r = await fetch(px("https://gamma-api.polymarket.com/events?slug=" + encodeURIComponent(e.slug)));
      if (!r.ok) return null;
      const d = await r.json();
      const ev = Array.isArray(d) ? d[0] : d;
      const m = ev && (ev.markets || []).find((x) => (x.conditionId || String(x.id)) === e.marketId);
      if (m) return pmMarket(m, ev).price;
    }
  } catch { /* quote later */ }
  return null;
}

// Deterministic stay/sell guidance — free to compute, honest about its
// source. During a live game the win-probability model outranks the desk's
// own (possibly hours-old) fair value.
function positionAdvice(e, cur, live) {
  const side = e.taken.side;
  const curSide = side === "YES" ? cur : 100 - cur;
  const pnl = curSide - e.taken.entryPrice;

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
  if (liveProb != null) { eff = liveProb; src = "the live win probability"; independent = true; }
  else if (freshAnalysis && !inGame) { eff = fairSide; src = "my recent analysis"; independent = true; }
  else { eff = curSide; src = "the market price"; independent = false; }

  // Entry price is sunk — decisions are forward-looking only. Selling pays
  // fees and crosses the spread; holding to resolution is free. So exiting
  // is only right when an INDEPENDENT read says the market overpays.
  const exitCost = takerFee(e.venue, curSide) + 0.5;
  const rem = eff - curSide;

  if (independent && rem <= -(2 + exitCost)) {
    return { act: pnl >= 0 ? "TAKE PROFIT" : "SELL NOW",
      why: "By " + src + " your side is worth about " + eff.toFixed(0) + "c but the market pays " + curSide.toFixed(0) +
        "c — selling collects more than the position is worth, even after ~" + exitCost.toFixed(1) + "c in exit costs." };
  }
  if (independent && rem >= 2) return { act: "HOLD",
    why: "About " + rem.toFixed(0) + "c of edge left by " + src + ". " +
      (pnl >= 0 ? "Up " : "Down ") + Math.abs(pnl).toFixed(0) + "c a contract so far." };

  if (!independent) return { act: "HOLD",
    why: "No fresh independent read right now, so the market price is the best estimate — it already reflects a " +
      curSide.toFixed(0) + "% chance, which is what your side is worth. Selling pays ~" + exitCost.toFixed(1) +
      "c in fees and spread; holding to resolution is free and wins that " + curSide.toFixed(0) +
      "% of the time. What you paid (" + Number(e.taken.entryPrice).toFixed(0) + "c) is already spent and shouldn't drive this." };

  return { act: "HOLD",
    why: "Priced about right by " + src + ": worth ~" + eff.toFixed(0) + "c, sells for " + curSide.toFixed(0) +
      "c. Selling costs ~" + exitCost.toFixed(1) + "c in fees and spread; holding to resolution costs nothing and wins " +
      eff.toFixed(0) + "% of the time. What you paid (" + Number(e.taken.entryPrice).toFixed(0) +
      "c) is already spent — it shouldn't drive this decision." };
}

const ADVICE_COLORS = { HOLD: "var(--moss)", "TAKE PROFIT": "var(--amber)", "SELL NOW": "var(--rose)", "RE-CHECK": "var(--cyan)", SETTLING: "var(--dim)" };

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
];

function detectLeague(m) {
  const hay = (m.id || "") + " " + (m.question || "") + " " + (m.name || "");
  for (const [re, path, label] of LEAGUES) if (re.test(hay)) return { path, label };
  return null;
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
    if (run.length >= 4 && run.length % 2 === 0) {
      push(run.slice(0, run.length / 2));
      push(run.slice(run.length / 2));
    }
  }
  return out;
}

const codeHit = (codes, abbrs) =>
  codes.filter((c) => abbrs.some((a) => a && (a === c || a.startsWith(c) || c.startsWith(a)))).length;

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
    if (base.homeWinPct == null && sm.predictor && sm.predictor.homeTeam) {
      const v = Number(sm.predictor.homeTeam.gameProjection);
      if (Number.isFinite(v)) base.homeWinPct = v;
    }
    const od = (sm.odds || sm.pickcenter || [])[0];
    if (od) {
      base.odds = {
        provider: (od.provider && od.provider.name) || "book",
        details: od.details || "",
        overUnder: od.overUnder != null ? od.overUnder : null,
        homeML: od.homeTeamOdds && od.homeTeamOdds.moneyLine,
        awayML: od.awayTeamOdds && od.awayTeamOdds.moneyLine,
      };
    }
    const sit = sm.situation || (sm.header && sm.header.competitions && sm.header.competitions[0].situation);
    if (sit) {
      if (sit.lastPlay && sit.lastPlay.text) base.lastPlay = String(sit.lastPlay.text).slice(0, 180);
      // Football: down, distance and who has the ball.
      if (sit.downDistanceText) base.downDistance = sit.downDistanceText;
      if (sit.possessionText) base.possessionText = sit.possessionText;
      // Baseball: the count and outs.
      if (sit.balls != null) base.extra = sit.balls + "-" + sit.strikes + " count, " + (sit.outs != null ? sit.outs : "?") + " out";
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
  let sideIdx = -1, bestS = 0;
  sides.forEach((sd, i) => {
    const sc = Math.max(overlap(m.name || "", sd.name), sd.abbr && codes.length ? (codes[0] === sd.abbr ? 1 : 0) : 0);
    if (sc > bestS) { bestS = sc; sideIdx = i; }
  });
  const mySide = sideIdx >= 0 && bestS > 0.3 ? sides[sideIdx] : null;

  let impliedCents = null;
  if (espn && espn.homeWinPct != null && mySide) {
    impliedCents = mySide.home ? espn.homeWinPct : 100 - espn.homeWinPct;
  }

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
${m.rules ? "RESOLUTION RULES: " + m.rules : ""}`;
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

function verifyPrompt(m, side, entry, fairSide, thesis, live) {
  return `Today is ${today()}. You are the final check before real money goes down on a ${m.venue} contract.

${ctx(m)}${live || ""}

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
  if (hit(["fed ", "cpi", "inflation", "gdp", "s&p", "nasdaq", "bitcoin", "ethereum", "earnings", "stock", "rate cut", "interest rate", "unemployment", "recession", "ipo"])) return "finance";
  return "general";
}

/* ================= app ================= */
function App() {
  const [tab, setTab] = useState("analyze");
  const [fw, setFw] = useState(buildFrameworks);
  const [ledger, setLedger] = useState([]);

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
              Pick a market, and I'll research it nine ways and tell you whether the price looks wrong.
            </p>
          </div>
          <div className="eyebrow">{today()}</div>
        </header>

        <nav className="tabs">
          {[["analyze", "Analyze a market"], ["positions", "My trades" + (openTrades ? " (" + openTrades + ")" : "")], ["browse", "Find a market"], ["frameworks", "What I check"], ["ledger", "How I'm doing"]].map(([k, l]) => (
            <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
          ))}
        </nav>

        {tab === "analyze" && <Analyze fw={fw} onSave={saveEntry} pending={pending} clearPending={() => setPending(null)} ledger={ledger} />}
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
      const match = top[j.index].c;
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
    const liveNow = () => liveSummary(liveRef.current) + histSummary(histRef.current) + sibLine + liqLine;

    // Step 0: read the fine print before researching, so every later step
    // prices the contract that actually exists rather than the headline.
    let auditJ = null;
    if (m.rules) {
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
      if (lNow && lNow.impliedCents != null && lNow.state !== "pre" && !lNow.disagree) {
        anchorInputs[99] = { n: 99, strength: 3, implied: clamp(lNow.impliedCents, 1, 99) };
        anchorByN[99] = { n: 99, enabled: true, weight: 1.5 };
      }
      const anchor = anchorFair(m.price, anchorInputs, anchorByN, relMult);

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

      const sr = await callClaude(synthPrompt(m, summarize(active.map((p) => p.n)), extra, anchor, auditLine), { model: MODELS.judge, maxTokens: 1400 });
      if (id !== runId.current) return;
      const j = extractJson(sr.text);
      let fair = Number(j.fairValue);
      if (!Number.isFinite(fair)) fair = anchor;
      // The model can argue with the anchor, but only within 10c of it.
      fair = clamp(clamp(fair, anchor - 10, anchor + 10), 0.5, 99.5);

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

      // Final red-team pass: a trade only stands if it survives an active
      // attempt to refute it with fresh searches.
      let verify = null;
      if (call !== "PASS") {
        setPhase("verifying");
        try {
          const vr = await callClaude(verifyPrompt(m, side, entry, fairSide, j.thesis || "", liveNow()), { search: true, maxTokens: 1200 });
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
        resolution: j.resolution || "", strong, verify, vetoed, thin };
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

          <div className="rail-box">
            <div className="rail">
              {[25, 50, 75].map((t) => <div key={t} className="rail-tick" style={{ left: t + "%" }} />)}
              {busy && <div className="sweep" />}
              {result && (
                <div className={"rail-band" + (result.edge < 0 ? " neg" : "")}
                  style={{ left: pos(Math.min(market.price, result.fair)) + "%", width: Math.abs(result.fair - market.price) + "%" }} />
              )}
              <div className="rail-mark" style={{ left: pos(market.price) + "%", background: "var(--cyan)" }}>
                <span className="lbl top" style={{ background: "var(--cyan)", color: "#1B202B" }}>MARKET {market.price.toFixed(1)}c</span>
              </div>
              {xp && xp.status === "found" && (
                <div className="rail-mark" style={{ left: pos(xp.match.price) + "%", background: "var(--moss)", width: 1 }}>
                  <span className="lbl top" style={{ background: "var(--moss)", color: "#1B202B", opacity: .9 }}>{xp.match.venue.slice(0, 4).toUpperCase()} {xp.match.price.toFixed(0)}c</span>
                </div>
              )}
              {live && live.impliedCents != null && (
                <div className="rail-mark" style={{ left: pos(live.impliedCents) + "%", background: "var(--violet)", width: 1 }}>
                  <span className="lbl top" style={{ background: "var(--violet)", color: "#1B202B", opacity: .92 }}>
                    WIN PROB {live.impliedCents.toFixed(0)}c
                  </span>
                </div>
              )}
              {result && (
                <div className="rail-mark" style={{ left: pos(result.fair) + "%", background: railColor }}>
                  <span className="lbl bot" style={{ background: railColor, color: "#1B202B" }}>FAIR {result.fair.toFixed(1)}c</span>
                </div>
              )}
            </div>
            <div className="rail-scale"><span>0c</span><span>25c</span><span>50c</span><span>75c</span><span>100c</span></div>
            <p className="help">
              A contract pays 100c if it happens, nothing if it doesn't — so the price is roughly the market's
              odds. {market.price.toFixed(0)}c means about a {market.price.toFixed(0)}% chance.
              {result ? " The shaded band is the gap between that price and what I think it's worth." : ""}
            </p>
          </div>

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
              <div className="verdict">
                <div>
                  <div className="label" style={{ marginBottom: 6 }}>My call</div>
                  <h2 style={{ color: callColor }}>{result.call}</h2>
                </div>
              </div>

              <p className="answer">
                {result.call === "PASS" ? (
                  <>
                    I'd <strong>sit this one out</strong>. It trades at {market.price.toFixed(0)}c and I make it worth{" "}
                    {result.fair.toFixed(0)}c —{" "}
                    {result.verify && result.verify.verdict === "REFUTE" ? "the final check killed the trade."
                      : result.strong < 3 ? "but too few checks found solid evidence to lean on."
                      : result.vetoed ? "and my own risk officer found solid evidence for the other side."
                      : "after the real fill price and fees, that gap isn't worth paying for."}
                  </>
                ) : (
                  <>
                    I'd <strong>buy {result.side}</strong>. Filling actually costs about {result.entry.toFixed(0)}c
                    {result.fee > 0.05 ? " plus " + result.fee.toFixed(1) + "c in fees" : ""}, I make that side worth{" "}
                    {(result.side === "YES" ? result.fair : 100 - result.fair).toFixed(0)}c, and the trade survived a final
                    attempt to knock it down — about <strong>{result.netEdge.toFixed(0)}c of value</strong> per contract
                    after costs, if I'm right.
                  </>
                )}
              </p>
              {result.thesis && <p className="thesis">{result.thesis}</p>}
              {result.verify && (
                <p className="thesis" style={{ color: result.verify.verdict === "CONFIRM" ? "var(--moss)" : "var(--rose)" }}>
                  Final check ({result.verify.verdict.toLowerCase()}): {result.verify.reason}
                </p>
              )}

              <div className="figures">
                <div className="fig">
                  <span className="big" style={{ color: callColor }}>
                    {result.netEdge > 0 ? "+" : ""}{result.netEdge.toFixed(1)}c
                  </span>
                  <span className="cap">Value after costs</span>
                  <span className="sub">Fair value minus the real fill price and fees{result.call === "PASS" ? " — needed " + result.bar.toFixed(1) + "c to trade" : ""}{result.thin ? " · thin market raised the bar" : ""}</span>
                </div>
                <div className="fig">
                  <span className="big">{result.anchor.toFixed(0)}c</span>
                  <span className="cap">Weighted anchor</span>
                  <span className="sub">Market price + every check's read, weighted by evidence and track record</span>
                </div>
                <div className="fig">
                  <span className="big">{result.confidence}</span>
                  <span className="cap">How sure I am</span>
                  <span className="sub">Based on how strong the evidence was</span>
                </div>
                <div className="fig">
                  <span className="big">{result.stake.toFixed(1)}%</span>
                  <span className="cap">Suggested size</span>
                  <span className="sub">Share of your betting money, half-Kelly on the net edge</span>
                </div>
                <div className="fig">
                  <span className="big">{result.strong}<span style={{ color: "var(--dim)" }}>/9</span></span>
                  <span className="cap">Checks with real data</span>
                  <span className="sub">The rest found nothing and were ignored</span>
                </div>
              </div>

              {result.call === "PASS" && (
                <p className="help" style={{ marginTop: 14 }}>
                  Passing is a real answer. Most contracts are priced about right, and no trade beats a bad one.
                </p>
              )}

              {result.call !== "PASS" && lastSaved && (
                lastSaved.taken ? (
                  <p className="help" style={{ marginTop: 16, color: "var(--moss)" }}>
                    Tracking this position — open <b>My trades</b> for live stay-or-sell feedback.
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
                      Mark it, and <b>My trades</b> will watch the price and the game and tell you when to stay or get out.
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
  const open = ledger.filter((e) => e.taken && e.status === "open");
  const settled = ledger.filter((e) => e.taken && e.status === "resolved" && e.outcome !== null);
  const candidates = ledger.filter((e) => !e.taken && e.status === "open" && e.call !== "PASS").slice(0, 8);
  const [q, setQ] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [kal, setKal] = useState(null);
  const [confirmId, setConfirmId] = useState(null); // position awaiting close confirm
  const [closing, setClosing] = useState(null);      // position id mid-close
  const [closeNote, setCloseNote] = useState(null);
  const anyLiveRef = useRef(false);

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
      const [price, live] = await Promise.all([
        fetchCurrentPrice(e),
        fetchLive({ id: e.marketId, question: e.question, name: e.name }).catch(() => null),
      ]);
      out[e.id] = { price, live, at: Date.now() };
    }));
    setQ(out);
    anyLiveRef.current = Object.values(out).some((x) => x.live && x.live.state === "in");
    setRefreshing(false);
  }

  // Refresh on open, then every 15 seconds while any game is live and
  // every 30 otherwise. Returning to the tab refreshes immediately.
  useEffect(() => {
    let alive = true, timer = null;
    const loop = async () => {
      await refresh();
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
          Live prices and game feeds against what each position is worth. Updates every 15 seconds while a game
          is live, every 30 otherwise — and it's free, no analysis credits.
        </p>
        {kal && !kal.error && (
          <div className="chips" style={{ marginTop: 8 }}>
            <span className="chip static" style={{ color: "var(--moss)", borderColor: "rgba(127,185,139,.5)" }}>
              Kalshi account connected · {kal.synced} position{kal.synced === 1 ? "" : "s"} synced
            </span>
          </div>
        )}
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
          const adv = cur != null ? positionAdvice(e, cur, live) : null;
          const curSide = cur != null ? (e.taken.side === "YES" ? cur : 100 - cur) : null;
          const pnlC = curSide != null ? curSide - e.taken.entryPrice : null;
          const pnlD = pnlC != null ? (pnlC * e.taken.contracts) / 100 : null;
          const col = adv ? ADVICE_COLORS[adv.act] || "var(--dim)" : "var(--dim)";
          return (
            <div key={e.id} className="fw" style={{ marginTop: 12 }}>
              <div className="fw-top">
                <div style={{ minWidth: 0 }}>
                  <div className="pname">{e.name === e.question ? e.question : e.question + " — " + e.name}</div>
                  <div className="pdesc">
                    {e.venue} · {e.taken.contracts} × {e.taken.side} at {Number(e.taken.entryPrice).toFixed(1)}c ·
                    my fair value {Number(e.fair).toFixed(0)}c
                  </div>
                </div>
                {adv && <span className="sig" style={{ color: col, borderColor: col }}>{adv.act}</span>}
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
                {e.link && <a className="srcchip" href={e.link} target="_blank" rel="noreferrer">open market ↗</a>}
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

      {settled.length > 0 && (
        <div className="panel">
          <p className="sect">Settled positions</p>
          <p className="thesis" style={{ marginTop: 8 }}>
            {settled.length} tracked position{settled.length === 1 ? "" : "s"} settled so far:{" "}
            <span className="mono" style={{ color: settledPnl >= 0 ? "var(--moss)" : "var(--rose)" }}>
              {settledPnl >= 0 ? "+$" : "-$"}{Math.abs(settledPnl).toFixed(2)}
            </span>{" "}
            at the fills you recorded. The full call-by-call record lives in <b>How I'm doing</b>.
          </p>
        </div>
      )}
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
    const model = done.reduce((s, e) => s + brier(e.fair, e.outcome), 0) / done.length;
    const mkt = done.reduce((s, e) => s + brier(e.price, e.outcome), 0) / done.length;
    const acted = done.filter((e) => e.call !== "PASS");
    const wins = acted.filter((e) => (e.call === "BUY YES" ? 1 : 0) === e.outcome).length;
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
              <div className="n" style={{ color: stats.model < stats.mkt ? "var(--moss)" : "var(--rose)" }}>{stats.model.toFixed(3)}</div>
            </div>
            <div>
              <span className="k eyebrow">Market score</span>
              <div className="n" style={{ color: "var(--dim)" }}>{stats.mkt.toFixed(3)}</div>
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
            comparison is the whole point. {stats.model < stats.mkt
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
