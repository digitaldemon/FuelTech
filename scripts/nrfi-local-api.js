/* The relative-URL fetch shim every analysis script needs, in one place.
 *
 * WHY THIS FILE EXISTS. app.jsx runs in a browser and pulls Statcast
 * peripherals from its own Next route, /api/desk/savant. A Node script has no
 * server, so nine scripts had each pasted the same line:
 *
 *   c.fetch = (u, o) => (String(u).startsWith("/") ? Promise.reject(...) : realFetch(u, o));
 *
 * which turns that into a failure. It does not degrade gracefully:
 * ctx.awayPeri/homePeri arrive null,
 * pitchSkillFactor takes its `!peri` early return, and it returns exactly 1.00
 * on every game. That factor carries weight 1.0 in pitMult and, once actually
 * fed, accounts for ~37% of all movement in the model — the largest single
 * share, ahead of homeOffAdvantage. Every one of those nine scripts was
 * therefore scoring a model missing its dominant pitcher term, silently,
 * including nrfi-calib-audit.js, whose entire job is to judge whether the
 * shipped calibration constant is right for "the SHIPPED model".
 *
 * Nine copies of a bug is not nine bugs, it is one missing module. Same reason
 * nrfi-model-lib.js exists: a rule that lives in one place can be fixed once.
 *
 * WHAT IS SERVED vs WHAT IS REFUSED. Savant is served for real, from the same
 * fetcher nrfi-model-lib uses, which reads baseballsavant's leaderboard CSV
 * directly and resolves ~750 arms. Anything else is REFUSED LOUDLY and
 * recorded, and callers can ask what went unserved and say so in their output.
 * A report that cannot reach an input must print that fact rather than quietly
 * scoring the input as neutral — an absence and a zero are not the same
 * measurement, and this whole class of bug is what happens when a harness lets
 * them look alike.
 *
 * /api/desk/umpires used to be the worked example of a loud refusal here. It is
 * gone: the ABS challenge system retired the umpire term from the model, so no
 * caller requests that route any more. The refusal machinery stays, because the
 * next input added to app.jsx from a Next route will need it and the lesson is
 * not specific to umpires.
 */
const { savant } = require("./nrfi-model-lib");

/** Patch `c.fetch` on a loaded desk-model context. Returns a handle reporting
 *  which local routes were served and which were refused. */
function installLocalApi(c, opts) {
  const season = (opts && opts.season) || new Date().getFullYear();
  const realFetch = global.fetch;
  const served = new Set();
  const refused = new Set();

  c.fetch = async (u, o) => {
    const url = String(u);
    if (!url.startsWith("/")) return realFetch(u, o);

    if (url.startsWith("/api/desk/savant")) {
      const s = await savant(season);
      served.add("/api/desk/savant");
      // The shape app.jsx destructures off the route: { byId, lg }. Only .json()
      // is used at that call site, so a full Response is not needed — but if a
      // caller ever reaches for .ok or .status this must grow, not lie.
      return { ok: true, status: 200, json: async () => ({ byId: s.by, lg: s.lg }) };
    }

    refused.add(url.split("?")[0]);
    throw new Error("local api unavailable to this harness: " + url);
  };

  return {
    served: () => [...served],
    refused: () => [...refused],
    /** True when a route was asked for and could not be served — the caller
     *  should treat anything downstream of it as not measured, not as zero. */
    missing: (prefix) => [...refused].some((u) => u.startsWith(prefix)),
    /** One line for the bottom of a report. Empty string when nothing was
     *  refused, so it can be printed unconditionally. */
    note: () => {
      const r = [...refused];
      if (!r.length) return "";
      return "\nNOT REACHABLE from this harness (inputs below are absent, NOT neutral):\n" +
        r.map((u) => "  " + u).join("\n");
    },
  };
}

module.exports = { installLocalApi };
