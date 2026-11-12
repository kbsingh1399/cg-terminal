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
