/**
 * PROBE — multi-venue footprint key audit for 1000-multiple + VET assets.
 *
 * 1. Venue truth (free public APIs, zero Coinglass quota):
 *    - OKX    /api/v5/public/instruments?instType=SWAP      → SHIB/PEPE/VET forms
 *    - Bybit  /v5/market/instruments-info?category=linear   → SHIB1000USDT etc.
 *    - Hyperliquid /info {"type":"meta"}                    → kSHIB/kPEPE/VET
 * 2. Coinglass orderFlow key validation for the CORRECTED keys
 *    (a handful of calls, one per candidate key, limit=2 m15).
 *
 * Usage: bun scripts/probe-fp-1000x.ts
 */
import { cgGet } from "../src/lib/cg/client";

const BASES = ["SHIB", "PEPE", "VET"];

// ---------- 1. venue instrument truth ----------
console.log("== OKX SWAP instruments ==");
{
  const j = (await fetch("https://www.okx.com/api/v5/public/instruments?instType=SWAP")).json() as {
    data?: { instId: string; ctVal: string; ctMult: string; settlePx?: string }[];
  };
  for (const b of BASES) {
    const hits = (j.data ?? []).filter((x) => x.instId.startsWith(b) && x.instId.endsWith("USDT-SWAP"));
    for (const h of hits) console.log(`  ${b}: ${h.instId} ctVal=${h.ctVal} ctMult=${h.ctMult}`);
    if (!hits.length) console.log(`  ${b}: NO USDT-SWAP listing`);
  }
}

console.log("== Bybit linear instruments ==");
{
  const j = (await fetch("https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1000")).json() as {
    result?: { list?: { symbol: string; baseCoin: string; status: string }[] };
  };
  const list = (j.result?.list ?? []).filter((x) => x.status === "Trading");
  for (const b of BASES) {
    const hits = list.filter((x) => x.baseCoin === b || x.baseCoin === `1000${b}` || x.symbol.includes(b));
    for (const h of hits) console.log(`  ${b}: ${h.symbol} (baseCoin=${h.baseCoin})`);
    if (!hits.length) console.log(`  ${b}: NO linear listing`);
  }
}

console.log("== Hyperliquid perp meta ==");
{
  const j = (await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "meta" }),
  })).json() as { universe?: { name: string }[] };
  const names = (j.universe ?? []).map((x) => x.name);
  for (const b of BASES) {
    const hits = names.filter((n) => n === b || n === `1000${b}` || n === `k${b}` || n.includes(b));
    console.log(`  ${b}: ${hits.length ? hits.join(", ") : "NO listing"}`);
  }
}

// ---------- 2. Coinglass orderFlow key validation ----------
console.log("== Coinglass /api/orderFlow key validation (current vs corrected) ==");
const candidates: { sym: string; label: string; key: string }[] = [
  // current (broken) keys for 1000SHIB
  { sym: "1000SHIB", label: "CURRENT okx  1000SHIB-USDT-SWAP", key: "OKX_1000SHIB-USDT-SWAP#order_flow" },
  { sym: "1000SHIB", label: "FIXED   okx  SHIB-USDT-SWAP", key: "OKX_SHIB-USDT-SWAP#order_flow" },
  { sym: "1000SHIB", label: "CURRENT bybit 1000SHIBUSDT", key: "Bybit_1000SHIBUSDT#order_flow" },
  { sym: "1000SHIB", label: "FIXED   bybit SHIB1000USDT", key: "Bybit_SHIB1000USDT#order_flow" },
  { sym: "1000SHIB", label: "CURRENT hl    1000SHIB-USD", key: "Hyperliquid_1000SHIB-USD#order_flow" },
  { sym: "1000SHIB", label: "FIXED   hl    kSHIB-USD", key: "Hyperliquid_kSHIB-USD#order_flow" },
  // 1000PEPE
  { sym: "1000PEPE", label: "CURRENT okx  1000PEPE-USDT-SWAP", key: "OKX_1000PEPE-USDT-SWAP#order_flow" },
  { sym: "1000PEPE", label: "FIXED   okx  PEPE-USDT-SWAP", key: "OKX_PEPE-USDT-SWAP#order_flow" },
  { sym: "1000PEPE", label: "CURRENT bybit 1000PEPEUSDT", key: "Bybit_1000PEPEUSDT#order_flow" },
  { sym: "1000PEPE", label: "CURRENT hl    1000PEPE-USD", key: "Hyperliquid_1000PEPE-USD#order_flow" },
  { sym: "1000PEPE", label: "FIXED   hl    kPEPE-USD", key: "Hyperliquid_kPEPE-USD#order_flow" },
  // VET (plain name — verify each venue actually lists it)
  { sym: "VET", label: "PLAIN  okx  VET-USDT-SWAP", key: "OKX_VET-USDT-SWAP#order_flow" },
  { sym: "VET", label: "PLAIN  bybit VETUSDT", key: "Bybit_VETUSDT#order_flow" },
  { sym: "VET", label: "PLAIN  hl    VET-USD", key: "Hyperliquid_VET-USD#order_flow" },
  // kline variant spot-check for the fixed forms
  { sym: "1000SHIB", label: "KLINE  okx  SHIB-USDT-SWAP", key: "OKX_SHIB-USDT-SWAP#kline" },
  { sym: "1000SHIB", label: "KLINE  bybit SHIB1000USDT", key: "Bybit_SHIB1000USDT#kline" },
  { sym: "1000SHIB", label: "KLINE  hl    kSHIB-USD", key: "Hyperliquid_kSHIB-USD#kline" },
];
for (const c of candidates) {
  try {
    const r = (await cgGet(
      `/api/orderFlow?symbol=${encodeURIComponent(c.key)}&interval=m15&minLimit=false&limit=2`.replace(
        "/api/orderFlow",
        c.key.endsWith("#kline") ? "/api/v2/kline" : "/api/orderFlow"
      ),
      15_000
    )) as unknown;
    const rows = Array.isArray((r as { data?: unknown }).data)
      ? ((r as { data: unknown[] }).data as unknown[])
      : Array.isArray(r)
        ? (r as unknown[])
        : null;
    console.log(`  [${rows && rows.length ? "OK " : "EMPTY"}] ${c.label} → rows=${rows ? rows.length : "null"}`);
  } catch (e) {
    console.log(`  [FAIL] ${c.label} → ${e instanceof Error ? e.message : e}`);
  }
}
