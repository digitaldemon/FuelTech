# NRFI — the first-inning model, in plain language

*Last audited 2026-09-08. If you are reading this months later, re-run the
health checks in section 6 before trusting any number in here.*

## 1. What this is

The NRFI tab on the desk predicts whether the **first inning of an MLB game
will be scoreless** (NRFI = no run first inning, YRFI = a run scores). The
league base rate is about **51-52% scoreless** — nearly a coin flip — so this
is a game of tiny edges. Anyone claiming big certain edges here is selling
something.

The model lives in `public/desk/app.jsx` (search `First Inning — NRFI`).
Everything in `scripts/nrfi-*.js` exists to measure, audit, or challenge it.

## 2. How a probability gets made

For each game, the model walks this pipeline:

1. **Each starting pitcher** gets a "keeps the first inning clean" rate:
   his own record, heavily regressed toward the league average
   (`NRFI_PIT_REG = 50` — a pitcher's 20-start sample keeps less than a
   third of its own signal, because first innings are mostly luck).
2. **Each lineup** adjusts it: top-of-order OBP, strikeout rate, platoon,
   recent form.
3. **Park and weather** adjust both: Coors Field is the only park that has
   ever proven itself (`NRFI_PARK = { COL: 1.23 }` — more runs), plus
   temperature and wind nudges.
4. The two half-inning probabilities are **multiplied together**…
5. …and then **calibrated** (`NRFI_CALIB_SEED`, a Platt shift that keeps
   learning from graded games). This step is not optional: the two halves of
   an inning are correlated (weather, ball, umpire move both), so the raw
   product is ~1.5x overconfident. Multiplying two *correct* numbers gives a
   *wrong* answer here — measured, not theoretical.
6. The final probability lands on a ladder:
   **STRONG ≥ 63% · BET ≥ 57% · LEAN ≥ 52% · else PASS**
   (on `max(p, 1-p)`, so both NRFI and YRFI sides are playable — a Coors
   YRFI counts the same as a clean-arms NRFI).

**To explain any single call, do NOT read the code and reason it out — run
`node scripts/nrfi-why.js AWY@HOM YYYY-MM-DD`.** It re-scores the game with
each input neutralized and reports what actually moved the number. The stack
is multiplicative, capped, and calibrated; no one line of source "is" the
reason, and reading it that way has already produced a wrong explanation once.

## 3. How good it honestly is

- **Skill is real but small.** Across 6,500+ mature games the model removes
  well under 1% of base-rate error. Its ranking separates games
  (AUC ≈ 0.57), its scale is right (calibration slope ≈ 1). The board is a
  small, honest edge — not a money printer.
- **Live record (graded automatically, checked 2026-09-08):** 267 graded
  board calls, 142-125 overall (53.2%) — that's *every* game including the
  ones it said PASS on. The tiers it actually tells you to play are the
  point: **BET 13-5, BET+LEAN 41-22 (65%, +13.8 units flat-staked)** since
  strength tiers shipped 2026-08-14. Sixty-three bets is still a small
  sample; the tier *ordering* (BET > LEAN > PASS) is the encouraging part.
- **Closing-line value is positive:** +0.30¢ ± 0.12 per pick across 135
  cleanly-measured picks — the market drifts toward our side after we log a
  call more often than away. CLV is the number that predicts future results.

## 4. The dials, and why they are set where they are

Every constant below was **fitted leak-free and is documented in app.jsx
next to its value**. None of them is a hunch. Do not tune by feel.

| Constant | Value | Plain meaning |
|---|---|---|
| `NRFI_LG_P0` | 0.72 | League chance a half-inning is clean |
| `NRFI_PIT_REG` | 50 | Phantom league starts added to a pitcher's record. Fitted optimum 75, CI [50,150]; 50 was chosen deliberately as the most-aggressive-defensible edge. **Do not go below 50.** |
| `NRFI_OFF_REG` | 1200 | A team's own season 1st-inning scoring rate is pure noise — this effectively zeroes it. Team offense still enters via lineup OBP/K%/form. |
| `NRFI_PARK` | COL 1.23 | Coors only, residualized against the pitcher term. Raising it required the weatherPark clamp to go to 1.30 — recheck the clamp if a second park is ever added. |
| `NRFI_CALIB_SEED` | c −0.063, n 558 | Starting point for the live calibrator. Tested against a refit: statistically a tie, because the live fit converges either way. Leave it. |
| `PITCHER_BT` | generated block | **Never hand-edit.** `node scripts/nrfi-pitcherbt-rebuild.js && node scripts/nrfi-pitcherbt-emit.js`. Stores *posterior* (luck-removed) clean rates; tiers are relative quantiles. True pitcher skill spans only ~64-77% clean — any table saying wider is ranking luck. |

## 5. Settled questions — do not re-litigate without new data

Each of these was measured properly at least once. Re-opening one costs a
session; check the named script's header first.

- **Pitcher rest / team rest: dead** (0.00pp signal, `nrfi-park-rest.js`).
  **Travel is NOT the same verdict** — it leans real (+1.4pp, t 1.84) but
  sits under its own measurement floor. Unmeasured, not disproved.
- **Month of season: dead.** Temperature is already carried by weather.
- **A team's own 1st-inning scoring history: dead** (spread narrower than
  its own noise floor — it is not even a weak signal).
- **The 3+ days rest arm is set to 1.00 on purpose** — the measured effect
  was *backwards* from the old assumption, but 440 games is exactly the
  sample size at which this codebase has been burned before.
- **Re-weighting our 33 factors: closed.** Out of sample it is worse at
  every regularization strength (`nrfi-factor-residual.js`). The model's
  weakness is *discrimination* (new information), not weights.
- **The env/run-environment tilt: dead, tested live** (`nrfi-tout-match.js`).
- **The rolling trend/venue factors: unmeasured, kept.** 409 games can't
  resolve their effect either way (`nrfi-backtest-ab.js`).
- **The first-inning market (Kalshi) is not NRFI-biased — it is too timid
  both ways** (outcomes land ~2x further from 50/50 than prices, slope
  1.94). Buying the favored side has paid on both sides historically.

## 6. Health checks — run these before trusting anything

| When | Run | Why |
|---|---|---|
| Before quoting ANY backtest/fit | `node scripts/nrfi-ctx-parity.js` | The harness once silently starved 5 factors on every backtest ever run. This is the guard. (PASS as of 2026-09-08.) |
| Explaining a call | `node scripts/nrfi-why.js AWY@HOM DATE` | Attribution by ablation, never by reading source. |
| "Does term X earn its place?" | `node scripts/nrfi-backtest-ab.js` | Paired on gamePk, resampled by date. Subtracting two printed Briers is not a test. |
| KING MODE correctness | `node scripts/nrfi-king-verify.js` | Asserts the replica against his worked examples. (ALL PASS as of 2026-09-08.) |
| Grade pending picks | `ADMIN_SECRET=… node scripts/nrfi-grade-now.js` | Server-side, safe to re-run. The app also self-grades. |
| ~Monthly in season | rebuild `PITCHER_BT` (section 4) | It goes stale as starts accumulate. Rebuilt 2026-09-08. |

Standing rules learned the hard way:

- **A missing input renders as a neutral value.** A starved model looks
  identical to a healthy one by eye. This is the house failure mode — it is
  why ctx-parity exists, and why "it looks fine" proves nothing.
- **The board bets `max(p, 1-p)`.** Any analysis that filters only on
  p ≥ threshold silently discards every YRFI play (this once hid 9 real
  Coors bets).
- **`nrfi-ladder-sweep.js` is leaky** — its cached inputs contain each
  game's own result. It will confidently recommend whatever mines the leak.
  Never settle a constant with it.
- **New-model test:** a candidate scorer with real information *complements*
  the market price in a joint fit (both coefficients survive). One that
  kills the price coefficient is leaking.
- **Verify constants against the working tree**, not against memory or old
  commits — several values here moved deliberately (75→50, 1.14→1.23).

## 7. The one open question that matters

**NRFIKINGKY** (the tout, `nrfi-edge.replit.app`): at equal model
probability, matched by date, his picks hit ~17 points better than peers
(z ≈ 5). That edge is real, his published record is faithful (independently
regraded, 240/241 agree), **and nothing we record explains it** — every
factor profile, every field his own API exposes, and re-weighting have all
been tested and falsified. His published equation is fully replicated in
KING MODE (gates 15/15, tiers 14/15) except for a +0.95 bias that is not
rounding and not his lineup term.

What would actually move this forward (in order of cheapness):

1. **Capture more of his boards** (`nrfi-king-capture.js`, with every card
   EXPANDED) — one board cannot identify what splits his residual.
2. Hunt **new information** our model never sees: bullpen state, umpire,
   weather at lock, lineup confirmations. Any candidate must pass the
   price-coefficient test above and be judged on Brier/AUC — never on
   agreement with him.
3. Do NOT fit our model to his picks (326 legs = curve-fitting), and do not
   copy his habits (his thin-arm avoidance was tested — copying it costs
   volume and buys nothing).

## 8. Script map (what's in this folder)

**Daily/operational:** `nrfi-grade-now.js` (grade picks) ·
`nrfi-why.js` (explain a call) · `nrfi-today-vs-tout.js` (today's board vs
his open legs) · `nrfi-local-api.js` / `nrfi-model-lib.js` /
`nrfi-model-load.js` (harness plumbing — model-lib slices the real app.jsx,
so the harness can never drift from the shipped model)

**Guards (run before trusting results):** `nrfi-ctx-parity.js` ·
`nrfi-backtest-ab.js` · `nrfi-leak-check.js` / `nrfi-leak-quantify.js` /
`nrfi-rewind-test.js` (leak detection) · `nrfi-cache-noise.js` (how much
the backtest moves when nothing changes) · `nrfi-sig-immunity.js` /
`nrfi-simpath-audit.js` / `nrfi-slice-gap.js` / `nrfi-gate-audit.js` /
`nrfi-model-audit.js` (regression checks on the model surface)

**Fitted constants (each script header = the finding):**
`nrfi-pitreg-fit.js` (PIT_REG) · `nrfi-offreg-fit.js` (OFF_REG) ·
`nrfi-calib-fit.js` / `nrfi-calib-walk-sig.js` / `nrfi-calib-audit.js`
(calibration) · `nrfi-park-rest.js` / `nrfi-travel-fit.js` /
`nrfi-rest-measure.js` (park/travel/rest) · `nrfi-temp-measure.js` /
`nrfi-starthour-measure.js` / `nrfi-daynight-measure.js` (weather/time) ·
`nrfi-pitcherbt-rebuild.js` + `nrfi-pitcherbt-emit.js` + 
`nrfi-pitcherbt-audit.js` (the PITCHER_BT table)

**Model criticism:** `nrfi-factor-residual.js` / `nrfi-residual-fit.js`
(do factors predict our error? no) · `nrfi-factor-contrib.js` /
`nrfi-weight-audit.js` / `nrfi-factor-center.js` / `nrfi-overlap-audit.js`
(what each factor is worth) · `nrfi-leakfree.js` (the clean walk-forward
reference model) · `nrfi-kalshi-bias.js` / `nrfi-vs-kalshi.js` (vs the
market) · `nrfi-bankroll-sim.js` / `nrfi-rung-roi.js` /
`nrfi-ladder-split.js` (staking/ladder; remember ladder-sweep is leaky)

**NRFIKINGKY:** `nrfi-king-*.js` (his equation, boards, record —
`king-verify` asserts the replica, `king-capture` grabs a board,
`king-record-grade` regrades his record) · `nrfi-tout-*.js` (his JuiceReel
picks vs our model — `tout-mediate` is the "does a factor EXPLAIN his edge"
test, `tout-conviction` verifies our cache against his feed)

## 9. Glossary

- **NRFI/YRFI** — no run / yes run in the first inning.
- **Brier score** — mean squared error of a probability; 0.25 = coin-flip
  knowledge. Lower is better; differences show up in the 3rd decimal.
- **AUC** — how often the model ranks a random scoreless game above a random
  scoring one; 0.5 = blind, our ~0.57 = "separates, barely."
- **Calibration** — when the model says 60%, does it happen 60% of the time?
  Ours does; that part is solved.
- **CLV** — closing-line value: did the price move toward your side after
  you picked? The best single predictor of whether an edge is real.
- **Leak** — any input that already contains the answer (e.g. season-to-date
  stats that include the game being predicted). The recurring villain of
  this project; several "great" results died of it.
- **Walk-forward** — scoring each game using only information from strictly
  earlier games. The only backtest style trusted here.
- **Platt shift** — a small logit-space correction fitted on graded games;
  how the calibrator works.
- **Posterior / regressed rate** — a player's observed rate pulled toward
  league average in proportion to how little data he has. What PITCHER_BT
  stores.
