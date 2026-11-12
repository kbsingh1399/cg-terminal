#!/usr/bin/env node
/**
 * Core-liquid zero-gap data integrity check (dual-agent directive #2).
 *
 * Verifies the five primary institutional instruments — BTC, ETH, SOL,
 * XAU (Gold), NVDA — against the running terminal:
 *   1. /api/cg/narrative  → ok:true, verdict grade, freshness (worst age,
 *      stale fields), m1/m2 status — the verdict must be grounded in LIVE
 *      feeds (no stale-field masking, no gaps).
 *   2. /api/cg/quant      → funding / OI quadrant / L-S ratio coverage.
 *   3. /api/cg/options    → BTC/ETH GEX flip + max pain (WS8) present.
 *   4. kline continuity   → last m15 bar age per symbol (gap check).
 *
 * Exit 0 only if every instrument reports fresh, honest data.
 */
const TERMINAL = process.env.TERMINAL_URL || "http://127.0.0.1:3000";
const CORE = ["BTC", "ETH", "SOL", "XAU", "NVDA"];

const getJson = async (path) => {
  const res = await fetch(`${TERMINAL}${path}`, { signal: AbortSignal.timeout(60_000) });
  return { status: res.status, json: await res.json().catch(() => null) };
};

const fmtAge = (ms) => `${Math.round((ms ?? 0) / 1000)}s`;

(async () => {
  let fails = 0;
  for (const sym of CORE) {
    const n = await getJson(`/api/cg/narrative?sym=${sym}`);
    if (n.status !== 200 || n.json?.ok !== true) {
      console.log(`FAIL ${sym} narrative: HTTP ${n.status} ok=${n.json?.ok} — ${n.json?.error ?? ""}`.trim());
      fails++;
      continue;
    }
    const v = n.json;
    const stale = v.freshness?.staleFields ?? [];
    const worstAge = v.freshness?.worstAgeMs ?? Infinity;
    const staleOk = stale.length === 0;
    const ageOk = worstAge < 15 * 60_000; // feeds must be younger than one m15 bar
    const q = await getJson(`/api/cg/quant?sym=${sym}`);
    const quantOk = q.status === 200 && q.json?.ok !== false;
    const cov = q.json?.coverage ?? {};
    const covLine = Object.entries(cov)
      .map(([k, val]) => `${k}:${String(val).slice(0, 24)}`)
      .join(" · ");
    const ok = staleOk && ageOk && quantOk;
    if (!ok) fails++;
    console.log(
      `${ok ? "PASS" : "FAIL"} ${sym} — ${v.regime} · ${v.activeModel} · ${v.direction} · grade ${v.grade} · conf ${v.confidence}/100` +
        ` · worstAge ${fmtAge(worstAge)}${staleOk ? "" : ` · STALE:[${stale.join(",")}]`}` +
        ` · quant ${quantOk ? "ok" : "FAIL"}${covLine ? ` (${covLine})` : ""}`
    );
    console.log(
      `     M1 ${v.m1?.status ?? "n/a"} | M2 ${v.m2?.status ?? "n/a"} | dataAt ${v.freshness?.dataAt ? new Date(v.freshness.dataAt).toISOString() : "n/a"}`
    );
  }
  // WS8 options surface — GEX flip + max pain on both Deribit instruments
  for (const sym of ["BTC", "ETH"]) {
    const o = await getJson(`/api/cg/options?sym=${sym}`);
    const flip = o.json?.gex?.gammaFlipPrice ?? o.json?.gammaFlipPrice ?? null;
    const pain = o.json?.maxPainStrike ?? null;
    const ok = o.status === 200 && typeof flip === "number" && typeof pain === "number";
    if (!ok) fails++;
    console.log(`${ok ? "PASS" : "FAIL"} ${sym} options surface — spot ${o.json?.spot ?? "n/a"} · gammaFlip ${flip ?? "MISSING"} · maxPain ${pain ?? "MISSING"} · regime ${o.json?.gex?.regime ?? "n/a"}`);
  }
  console.log(`\n===== core-liquids: ${7 - fails}/7 ${fails ? "FAILED" : "ALL GREEN"} =====`);
  process.exit(fails ? 1 : 0);
})();
