#!/usr/bin/env node
/**
 * Unit-lock for the liq-live venue normalizers (2026-11-12).
 *
 * The Bybit + OKX paths are live-verified from this host (real events
 * journaled). The Binance forceOrder path cannot be observed from a
 * 418-banned host (verified: bookTicker flows, !forceOrder@arr suppressed),
 * so this test replays the DOCUMENTED payload shape through the exact
 * normalization expressions the collector uses — the user's local (unbanned)
 * run delivers the real frames into the same code.
 */

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${detail ? " — " + detail : ""}`);
  }
}

// --- exact expressions from src/lib/cg/liq-live.ts (binance leg) ---
function normalizeBinance(m) {
  if (!m.data) return null;
  if (m.stream === "!forceOrder@arr" || m.data.e === "forceOrder") {
    const o = m.data.o;
    if (!o) return null;
    const qty = Number(o.z) || Number(o.q) || 0;
    const px = Number(o.ap) || Number(o.p) || 0;
    const pair = String(o.s ?? "");
    if (qty > 0 && px > 0 && pair) {
      return { pair, side: o.S === "SELL" ? "long" : "short", qtyBase: qty, price: px, usd: qty * px, t: Number(o.T) };
    }
  }
  return null;
}

// --- documented Binance combined-stream forceOrder frame (futures docs) ---
const binanceFrame = {
  stream: "!forceOrder@arr",
  data: {
    e: "forceOrder",
    E: 1568014460893,
    o: {
      s: "BTCUSDT",
      S: "SELL", // SELL force order = a LONG position liquidated
      o: "LIMIT",
      f: "IOC",
      q: "0.014",
      p: "9910",
      ap: "9910.04",
      X: "FILLED",
      l: "0.014",
      z: "0.014",
      T: 1568014460893,
    },
  },
};
const nb = normalizeBinance(binanceFrame);
check("binance: normalized", nb != null);
check("binance: side SELL→long", nb?.side === "long", JSON.stringify(nb));
check("binance: qty from z", nb?.qtyBase === 0.014, JSON.stringify(nb));
check("binance: px from ap", nb?.price === 9910.04, JSON.stringify(nb));
check("binance: usd", nb?.usd != null && Math.abs(nb.usd - 138.74) < 0.01, JSON.stringify(nb));

// ap missing → p fallback (documented payload variants)
const nb2 = normalizeBinance({ stream: "!forceOrder@arr", data: { e: "forceOrder", o: { s: "ETHUSDT", S: "BUY", q: "0.5", p: "2000", z: "0.4", ap: "0", T: 1 } } });
check("binance: ap=0 falls back to p", nb2?.price === 2000 && nb2?.qtyBase === 0.4, JSON.stringify(nb2));
check("binance: BUY→short", nb2?.side === "short", JSON.stringify(nb2));

// --- bybit allLiquidation (live-verified shape, doc example) ---
function normalizeBybit(msg) {
  const m = msg;
  if (!m.topic || !m.topic.startsWith("allLiquidation") || !Array.isArray(m.data)) return [];
  const out = [];
  for (const d of m.data) {
    const qty = Number(d.v) || 0;
    const px = Number(d.p) || 0;
    if (qty > 0 && px > 0) out.push({ pair: String(d.s), side: d.S === "Buy" ? "long" : "short", qtyBase: qty, price: px, usd: qty * px, t: Number(d.T) });
  }
  return out;
}
const bybitFrame = {
  topic: "allLiquidation.ROSEUSDT",
  type: "snapshot",
  ts: 1739502303204,
  data: [{ T: 1739502302929, s: "ROSEUSDT", S: "Sell", v: "20000", p: "0.04499" }],
};
const vb = normalizeBybit(bybitFrame);
check("bybit: 1 event", vb.length === 1);
check("bybit: usd 20000×0.04499", Math.abs((vb[0]?.usd ?? 0) - 899.8) < 0.01, JSON.stringify(vb));

// --- okx liquidation-orders (live-verified frame from this host) ---
const okxFrame = {
  arg: { channel: "liquidation-orders", instType: "SWAP" },
  data: [
    {
      details: [{ bkLoss: "0", bkPx: "159.86", ccy: "", posSide: "long", side: "sell", sz: "6.23", ts: "1794485174408" }],
      instFamily: "NVDA-USDT",
      instId: "NVDA-USDT-SWAP",
      instType: "SWAP",
      uly: "NVDA-USDT",
    },
  ],
};
function normalizeOkx(msg, ctVal) {
  const out = [];
  for (const row of msg.data ?? []) {
    const ct = ctVal ?? 1;
    for (const d of row.details ?? []) {
      const px = Number(d.bkPx) || 0;
      const sz = Number(d.sz) || 0;
      const qtyBase = sz * ct;
      if (px > 0 && sz > 0) {
        out.push({
          instId: row.instId,
          side: d.posSide === "short" || (!d.posSide && d.side === "buy") ? "short" : "long",
          qtyBase,
          usd: qtyBase * px,
          t: Number(d.ts),
        });
      }
    }
  }
  return out;
}
const vo = normalizeOkx(okxFrame, 1);
check("okx: 1 event", vo.length === 1);
check("okx: posSide long → long liq", vo[0]?.side === "long", JSON.stringify(vo));
check("okx: usd 6.23×159.86", Math.abs((vo[0]?.usd ?? 0) - 995.9) < 0.1, JSON.stringify(vo));
// ctVal scaling (BTC-USDT-SWAP ctVal = 0.01 BTC)
const vo2 = normalizeOkx(
  { data: [{ instId: "BTC-USDT-SWAP", details: [{ bkPx: "72000", side: "sell", posSide: "long", sz: "3", ts: "1" }] }] },
  0.01
);
check("okx: ctVal scaling 3×0.01 BTC", vo2[0]?.qtyBase === 0.03 && Math.abs(vo2[0].usd - 2160) < 0.01, JSON.stringify(vo2));

// --- resolveOkxAsset (exact mirror of src/lib/cg/liq-live.ts, 2026-11-12 fix) ---
// OKX lists k-unit coins under the PLAIN base with a large ctVal (verified
// live: SHIB-USDT-SWAP ctVal=1,000,000 SHIB · PEPE-USDT-SWAP ctVal=10,000,000)
// while the terminal asset is the 1000-form — without the `1000${base}`
// fallback those prints were silently dropped.
const TERMINAL_PERP_ASSETS = [
  "BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "NVDA", "1000PEPE", "1000SHIB",
].map((sym) => ({ sym }));
function resolveOkxAsset(instId) {
  if (!instId.endsWith("-USDT-SWAP")) return undefined;
  const base = instId.slice(0, -"-USDT-SWAP".length);
  const direct = TERMINAL_PERP_ASSETS.find((a) => a.sym === base);
  if (direct) return direct.sym;
  if (base.startsWith("1000")) {
    const stripped = base.slice(4);
    const hit = TERMINAL_PERP_ASSETS.find((a) => a.sym === stripped);
    if (hit) return hit.sym;
  }
  const kForm = TERMINAL_PERP_ASSETS.find((a) => a.sym === `1000${base}`);
  if (kForm) return kForm.sym;
  return undefined;
}
check("okx-resolve: BTC direct", resolveOkxAsset("BTC-USDT-SWAP") === "BTC");
check("okx-resolve: NVDA direct (TradFi perp)", resolveOkxAsset("NVDA-USDT-SWAP") === "NVDA");
check("okx-resolve: SHIB → 1000SHIB (k-unit plain form, was DROPPED before the fix)", resolveOkxAsset("SHIB-USDT-SWAP") === "1000SHIB", String(resolveOkxAsset("SHIB-USDT-SWAP")));
check("okx-resolve: PEPE → 1000PEPE (k-unit plain form, was DROPPED before the fix)", resolveOkxAsset("PEPE-USDT-SWAP") === "1000PEPE", String(resolveOkxAsset("PEPE-USDT-SWAP")));
check("okx-resolve: 1000SHIB direct (if OKX ever lists the prefixed form)", resolveOkxAsset("1000SHIB-USDT-SWAP") === "1000SHIB");
check("okx-resolve: unknown dropped", resolveOkxAsset("SOMECOIN-USDT-SWAP") === undefined);
check("okx-resolve: non-swap dropped", resolveOkxAsset("BTC-USDT") === undefined);

// --- cascade trigger matrix (exact mirror of scanLiqCascades in src/lib/cg/scan.ts) ---
const LIQ_CASCADE_MAJORS = new Set(["BTC", "ETH", "SOL"]);
const LIQ_MAJOR_ABS_USD = 1_500_000;
const LIQ_MAJOR_CONC_USD = 500_000;
const LIQ_MAJOR_CONC_SHARE = 0.8;
const LIQ_MAJOR_CONC_COUNT = 5;
const LIQ_ALT_ABS_USD = 200_000;
const LIQ_ALT_SHARE = 0.75;
const LIQ_ALT_OI_PCT = 0.0015;
const LIQ_ALT_OI_FETCH_FLOOR_USD = 50_000;
const LIQ_ALT_OI_MIN_COUNT = 3;
function cascadeTrigger(w, oiUsd) {
  const totalUsd = w.longUsd + w.shortUsd;
  if (totalUsd <= 0) return { triggered: false, threshold: "" };
  const longShare = w.longUsd / totalUsd;
  const domShare = Math.max(longShare, 1 - longShare);
  const domSide = domShare >= 0.55 ? (longShare >= 0.5 ? "long" : "short") : "mixed";
  const isMajor = LIQ_CASCADE_MAJORS.has(w.sym);
  let triggered = false;
  let threshold = "";
  if (isMajor) {
    if (totalUsd >= LIQ_MAJOR_ABS_USD) {
      triggered = true;
      threshold = "major ≥$1.5M/5m";
    } else if (totalUsd >= LIQ_MAJOR_CONC_USD && domShare >= LIQ_MAJOR_CONC_SHARE && w.count >= LIQ_MAJOR_CONC_COUNT) {
      triggered = true;
      threshold = "major concentrated";
    }
  } else if (domShare >= LIQ_ALT_SHARE) {
    if (totalUsd >= LIQ_ALT_ABS_USD) {
      triggered = true;
      threshold = "alt ≥$200k/5m + 75% single-side";
    } else if (totalUsd >= LIQ_ALT_OI_FETCH_FLOOR_USD && w.count >= LIQ_ALT_OI_MIN_COUNT) {
      if (oiUsd != null && totalUsd >= oiUsd * LIQ_ALT_OI_PCT) {
        triggered = true;
        threshold = "alt ≥0.15% of OI";
      }
    }
  }
  return { triggered, threshold, domSide, domShare, totalUsd };
}
const w = (sym, longUsd, shortUsd, count) => ({ sym, longUsd, shortUsd, count });
let ct = cascadeTrigger(w("BTC", 800_000, 900_000, 22), null); // $1.7M mixed
check("cascade: BTC $1.7M mixed → major abs triggers (no side condition)", ct.triggered && ct.domSide === "mixed" && ct.threshold.includes("1.5M"), JSON.stringify(ct));
ct = cascadeTrigger(w("BTC", 580_000, 40_000, 6), null); // $620k, 93.5% long, 6 prints
check("cascade: BTC $620k 94% one side 6 prints → concentrated", ct.triggered && ct.threshold.includes("concentrated"), JSON.stringify(ct));
ct = cascadeTrigger(w("BTC", 460_000, 60_000, 9), null); // 88% but only $520k → conc OK
check("cascade: BTC $520k 88% 9 prints → concentrated triggers", ct.triggered, JSON.stringify(ct));
ct = cascadeTrigger(w("BTC", 400_000, 80_000, 9), null); // $480k < $500k
check("cascade: BTC $480k 83% → below both major paths, no alert", !ct.triggered, JSON.stringify(ct));
ct = cascadeTrigger(w("BTC", 420_000, 40_000, 3), null); // 91% but only 3 prints
check("cascade: BTC $460k 91% 3 prints → print-count gate blocks", !ct.triggered, JSON.stringify(ct));
ct = cascadeTrigger(w("BTC", 900_000, 300_000, 10), null); // $1.2M but 75% < 80% and < $1.5M
check("cascade: BTC $1.2M 75% → below both major paths, no alert", !ct.triggered, JSON.stringify(ct));
ct = cascadeTrigger(w("DOGE", 210_000, 10_000, 14), null); // $220k, 95% long
check("cascade: DOGE $220k 95% one side → alt abs triggers", ct.triggered && ct.domSide === "long" && ct.threshold.includes("200k"), JSON.stringify(ct));
ct = cascadeTrigger(w("DOGE", 120_000, 90_000, 14), null); // $210k but 57%
check("cascade: DOGE $210k 57% split → side gate blocks", !ct.triggered, JSON.stringify(ct));
ct = cascadeTrigger(w("DOGE", 59_000, 1_000, 5), 30_000_000); // $60k = 0.20% of $30M OI
check("cascade: DOGE $60k 98% 5 prints vs $30M OI (0.20% ≥ 0.15%) → OI path triggers", ct.triggered && ct.threshold.includes("OI"), JSON.stringify(ct));
ct = cascadeTrigger(w("DOGE", 59_000, 1_000, 5), 100_000_000); // $60k = 0.06% of $100M OI
check("cascade: DOGE $60k vs $100M OI (0.06% < 0.15%) → no alert", !ct.triggered, JSON.stringify(ct));
ct = cascadeTrigger(w("DOGE", 59_000, 1_000, 2), 30_000_000); // OI path but 2 prints
check("cascade: DOGE OI path with 2 prints → count gate blocks", !ct.triggered, JSON.stringify(ct));
ct = cascadeTrigger(w("DOGE", 30_000, 25_000, 20), 30_000_000); // $55k but 55% split
check("cascade: DOGE $55k 55% split → side gate blocks OI path", !ct.triggered, JSON.stringify(ct));
ct = cascadeTrigger(w("NVDA", 260_000, 20_000, 9), null); // TradFi perp, alt rules
check("cascade: NVDA $280k 93% → alt abs triggers (TradFi perps share the alt tier)", ct.triggered, JSON.stringify(ct));

// --- journalCounts arithmetic (exact mirror of ingest()'s compaction trigger) ---
const JOURNAL_MAX_ROWS = 20_000;
const RING_MAX = 3_000;
const journalCounts = new Map();
const rings = new Map(); // per-asset ring, like the collector's rings Map
function ingestCount(asset) {
  const ring = rings.get(asset);
  ring.push(1);
  if (ring.length > RING_MAX) ring.splice(0, ring.length - RING_MAX);
  const rows = (journalCounts.get(asset) ?? 0) + 1;
  if (rows > JOURNAL_MAX_ROWS * 1.2) {
    // compaction rewrites the file with the in-memory ring tail
    journalCounts.set(asset, ring.length);
    return "compact";
  }
  journalCounts.set(asset, rows);
  return "append";
}
// BTC: hydrate seeded 19,900 rows from the file; the ring is warm at cap
rings.set("BTC", new Array(RING_MAX).fill(1));
journalCounts.set("BTC", 19_900);
let allAppend = true;
for (let i = 0; i < 4_100; i++) if (ingestCount("BTC") !== "append") allAppend = false;
check("journalCounts: 19,900 + 4,100 = exactly 24,000 → no compaction (strictly-greater line)", allAppend && journalCounts.get("BTC") === 24_000, String(journalCounts.get("BTC")));
check("journalCounts: append #4,101 (24,001 > 24,000) compacts to the ring tail", ingestCount("BTC") === "compact" && journalCounts.get("BTC") === RING_MAX, String(journalCounts.get("BTC")));
check("journalCounts: post-compaction appends count from the tail (3,001)", ingestCount("BTC") === "append" && journalCounts.get("BTC") === RING_MAX + 1, String(journalCounts.get("BTC")));
// ETH boundary: 23,999 seeded, full ring — compact exactly at 24,001, never at 24,000
rings.set("ETH", new Array(RING_MAX).fill(1));
journalCounts.set("ETH", 23_999);
const ethResults = [];
for (let i = 0; i < 5; i++) ethResults.push(ingestCount("ETH"));
check("journalCounts: 23,999+1=24,000 appends (NOT > 24,000 — no compaction), then compact at 24,001", ethResults[0] === "append" && ethResults[1] === "compact" && ethResults.slice(2).every((c) => c === "append"), JSON.stringify(ethResults));
check("journalCounts: ETH post-compaction counter restarts from its own ring tail (3,003)", journalCounts.get("ETH") === RING_MAX + 3, String(journalCounts.get("ETH")));

// --- probability math sanity (probability.ts) ---
function normCdf(x) {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return 0.5 * (1 + sign * y);
}
check("normCdf(0) = 0.5", Math.abs(normCdf(0) - 0.5) < 1e-9);
check("normCdf(1.96) ≈ 0.975", Math.abs(normCdf(1.96) - 0.975) < 0.001, String(normCdf(1.96)));
check("normCdf(-1) ≈ 0.1587", Math.abs(normCdf(-1) - 0.1587) < 0.001, String(normCdf(-1)));
// first passage: d = sigma*sqrt(N)*1.0 → P ≈ 2(1-Φ(1)) ≈ 0.317
const p = 2 * (1 - normCdf(1));
check("pTouch(1σ,1 bar) ≈ 0.317", Math.abs(p - 0.3173) < 0.001, String(p));
// gambler's ruin symmetric: entry mid → 0.5
function ruin(e, s, t) {
  return Math.abs(e - s) / Math.abs(t - s);
}
check("gamblerRuin mid = 0.5", ruin(105, 90, 120) === 0.5);
check("gamblerRuin 1/3 span", Math.abs(ruin(100, 90, 120) - 1/3) < 1e-9);
check("gamblerRuin near-stop = 0.1", Math.abs(ruin(91, 90, 100) - 0.1) < 1e-9);

console.log(`\n[liq-live/probability unit-lock] ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
