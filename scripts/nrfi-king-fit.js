/* How close a replica of NRFIKINGKY's dual score can get, cross-validated.
 *
 *   node scripts/nrfi-king-fit.js
 *
 * The equation itself is not fitted — it is published in the "How the dual score
 * works" dialog on his board, and nrfi-king-verify.js pins our implementation to
 * his own worked examples. What IS fitted here is the one part he states only as
 * "small caps-limited adjustments (+-3%) for the opposing lineup's YRFI tendency
 * and park tier": how big those actually are.
 *
 * nrfi-king-boards.json holds 10 games off his board with his printed DS, his
 * park flag, and both arms' SZN/L30 cells. Leave-one-out, because 10
 * observations against 3 parameters will fit anything — in-sample RMSE alone
 * picks model C, and model C is wrong.
 *
 *   A. published only   0 params  LOO 2.21  tiers  9/10
 *   B. + park scale     1 param   LOO 1.36  tiers  9/10   <- shipped
 *   C. + park + lineup  3 params  LOO 0.98  tiers 10/10
 *
 * MODEL C IS NOT SHIPPED DESPITE WINNING EVERY COLUMN. Its lineup coefficient
 * fits NEGATIVE (cy about -0.065) — it claims a lineup that scores in the 1st
 * MORE often makes a clean 1st MORE likely — and its intercept pins to the edge
 * of the search range. Both are the signature of a term absorbing a constant
 * offset rather than measuring an effect. His card also rounds SZN and L30 to
 * whole percents, which floors any board-fitted RMSE around 0.5-0.9, so C is
 * fitting inside the rounding. Model B's park scale lands at 1.00 per flag-unit,
 * which is exactly his stated +-2% falling back out of the data, and that
 * agreement is the reason to trust it.
 *
 * The sample is 10 games off one board: this measures how far off the REPLICA
 * is, not whether his method works. What his method is worth is
 * nrfi-king-mode.js over 14,009 games, and the answer there is: nothing yet. */
const G = require("./nrfi-king-boards.json");
const X = {
  "MIA@PHI":{yA:28.8,yH:32.3},"BAL@TB":{yA:25.2,yH:32.5},"SD@NYM":{yA:23.2,yH:27.2},
  "STL@CIN1":{yA:32.3,yH:26.6},"ATH@KC":{yA:27.4,yH:29.6},"ATL@MIN":{yA:32.0,yH:32.0},
  "STL@CIN2":{yA:32.3,yH:26.6},"DET@PIT":{yA:33.3,yH:31.0},"CWS@CHC":{yA:33.3,yH:24.8},
  "LAD@COL":{yA:30.4,yH:33.1},
};
const LG=78, PH=10, cap3=v=>Math.max(-3,Math.min(3,v));
const rawOf = w => 0.60*w.SZN[0] + 0.40*w.L30[0];
const shrink = (raw,n) => (n*raw + PH*LG)/(n+PH);
const dsOf = (g,p) => {
  const x=X[g.g];
  const A = shrink(rawOf(g.a),g.a.SZN[1]) + cap3((p.yBase-x.yH)*p.cy + g.park*p.cp);
  const H = shrink(rawOf(g.h),g.h.SZN[1]) + cap3((p.yBase-x.yA)*p.cy + g.park*p.cp);
  return A*H/100;
};
const rmseOn = (set,p) => Math.sqrt(set.reduce((s,g)=>s+(dsOf(g,p)-g.ds)**2,0)/set.length);
function fit(set, free){
  let best=null;
  const CY = free.cy ? range(-0.4,0.4,0.01) : [0];
  const YB = free.cy ? range(20,40,0.5) : [30];
  const CP = free.cp ? range(0,2.5,0.05) : [0];
  for (const cy of CY) for (const yBase of YB) for (const cp of CP){
    const p={cy,yBase,cp}, r=rmseOn(set,p);
    if(!best||r<best.r) best={p,r};
  }
  return best;
}
function range(a,b,s){ const o=[]; for(let v=a;v<=b+1e-9;v+=s) o.push(+v.toFixed(4)); return o; }
const MODELS = {
  "A. published only (0 free params)":      {cy:false,cp:false},
  "B. + park scale (1 free param)":         {cy:false,cp:true},
  "C. + park + lineup YRFI (3 free params)":{cy:true, cp:true},
};
console.log("model                                     insample   LOO      maxerr   tiers");
const tier=d=>d>=68?"ELITE":d>=64?"GREEN":d>=58?"YELLOW":"RED";
for (const [name,free] of Object.entries(MODELS)){
  const b=fit(G,free);
  let lss=0;
  for (let i=0;i<G.length;i++){
    const tr=G.filter((_,j)=>j!==i);
    const bb=fit(tr,free);
    lss += (dsOf(G[i],bb.p)-G[i].ds)**2;
  }
  const mx=Math.max(...G.map(g=>Math.abs(dsOf(g,b.p)-g.ds)));
  const hits=G.filter(g=>tier(dsOf(g,b.p))===tier(g.ds)).length;
  console.log(name.padEnd(42)+b.r.toFixed(2).padStart(7)+Math.sqrt(lss/G.length).toFixed(2).padStart(9)+
    mx.toFixed(2).padStart(9)+`   ${hits}/10`);
}
const b=fit(G,{cy:false,cp:true});
console.log(`\nModel B params: park ${b.p.cp.toFixed(2)} per flag-unit (his flags are +-2, so about +-${(2*b.p.cp).toFixed(1)}%)`);
