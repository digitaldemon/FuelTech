/* Undo the rounding on his window cells.
 *
 * Every cell on his card is a percent PLUS its denominator -- "83%" over "23g".
 * A clean-1st rate over 23 starts can only be k/23, so the displayed percent
 * pins k exactly: k = round(pct * n / 100). Checked across all 110 cells on the
 * 2026-08-18 board, every one inverts to a UNIQUE integer, because n is always
 * far below 100 and adjacent k differ by 100/n >= 1 percentage point.
 *
 * This matters more than it sounds. Every fit against his board so far has been
 * reported with the caveat "he prints whole percents, so ~0.5-0.9 RMSE is
 * unrecoverable" -- which was wrong, and it was wrong in the direction that
 * makes weak candidates look acceptable. There is no display floor. A model
 * that cannot get under 0.9 against exact cells is genuinely missing something.
 *
 * exact(cell) -> the recovered percent, or the displayed one if n is missing
 * (a 0-start arm prints no denominator and there is nothing to recover). */
function exact(cell) {
  if (!cell || cell[0] == null) return null;
  const [pct, n] = cell;
  if (!n) return pct;
  return (Math.round((pct * n) / 100) / n) * 100;
}

/* How far the displayed number was from the truth, for reporting. */
function rounding(cell) {
  const e = exact(cell);
  return e == null ? null : e - cell[0];
}

module.exports = { exact, rounding };
