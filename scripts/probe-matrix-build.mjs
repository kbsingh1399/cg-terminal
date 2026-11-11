#!/usr/bin/env node
/**
 * PROBE — final coverage-matrix builder.
 *
 * 1) Light completion pass: aggTrades + depth for ALL 23 kind-B spot pairs
 *    (kind-A + CG results come from /tmp/binance-coverage.json,
 *    /tmp/cg-btokens.json, /tmp/btoken-perps.json, /tmp/baseline.json).
 * 2) Merges everything into download/coverage_matrix_probe.json.
 *
 * Usage: node scripts/probe-matrix-build.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const B_SYMS = ["NVDAB","SNDKB","SOXLB","SPCXB","MUB","INTCB","CRCLB","SKHYB","MSTRB","KORUB","GOOGLB","NBISB","TSLAB","METAB","AAPLB","DRAMB","MSFTB","AMZNB","AMDB","COINB","NFLXB","AVGOB","TSMB"];
const A_SYMS = ["BTC","ETH","BNB","SOL","XRP","ADA","DOGE","TRX","LINK","LTC","AVAX","DOT","NEAR","UNI","ATOM","XLM","ETC","FIL","ICP","HBAR","APT","ARB","OP","SUI","SEI","INJ","TIA","1000PEPE","1000SHIB","TON","XAU","XAG","CL"];
const PLAIN_OF = {
  NVDAB: "NVDA", SNDKB: "SNDK", SOXLB: "SOXL", SPCXB: "SPCX", MUB: "MU",
  INTCB: "INTC", CRCLB: "CRCL", SKHYB: "SKHY", MSTRB: "MSTR", KORUB: "KORU",
  GOOGLB: "GOOGL", NBISB: "NBIS", TSLAB: "TSLA", METAB: "META", AAPLB: "AAPL",
  DRAMB: "DRAM", MSFTB: "MSFT", AMZNB: "AMZN", AMDB: "AMD", COINB: "COIN",
  NFLXB: "NFLX", AVGOB: "AVGO", TSMB: "TSM",
};

const bin = JSON.parse(readFileSync("/tmp/binance-coverage.json", "utf8"));
const cgB = JSON.parse(readFileSync("/tmp/cg-btokens.json", "utf8"));
const perps = JSON.parse(readFileSync("/tmp/btoken-perps.json", "utf8"));
const base = JSON.parse(readFileSync("/tmp/baseline.json", "utf8"));

// ---------- 1) light aggTrades + depth pass for all 23 ----------
console.log("== light microstructure pass (all 23 B-token spot pairs) ==");
const micro = {};
for (const s of B_SYMS) {
  const pair = `${s}USDT`;
  const rec = {};
  try {
    const r = await (await fetch(`https://api.binance.com/api/v3/aggTrades?symbol=${pair}&limit=5`)).json();
    rec.aggTrades = { ok: Array.isArray(r) && r.length > 0, rows: Array.isArray(r) ? r.length : 0, lastPx: Array.isArray(r) && r.length ? r[0].p : null };
  } catch (e) { rec.aggTrades = { ok: null, err: e.message }; }
  try {
    const d = await (await fetch(`https://api.binance.com/api/v3/depth?symbol=${pair}&limit=100`)).json();
    const bb = +d?.bids?.[0]?.[0] ?? 0, ba = +d?.asks?.[0]?.[0] ?? 0;
    const mid = (bb + ba) / 2;
    rec.depth = {
      ok: !!(d?.bids?.length && d?.asks?.length),
      bids: d?.bids?.length ?? 0, asks: d?.asks?.length ?? 0,
      bestBid: bb || null, bestAsk: ba || null,
      spreadPct: mid > 0 ? +(((ba - bb) / mid) * 100).toFixed(4) : null,
    };
  } catch (e) { rec.depth = { ok: null, err: e.message }; }
  micro[s] = rec;
  console.log(`  ${s.padEnd(7)} aggTrades=${rec.aggTrades.ok ? "✓" : "✗"}(rows=${rec.aggTrades.rows}) depth=${rec.depth.ok ? "✓" : "✗"}(bids=${rec.depth.bids}/asks=${rec.depth.asks}, spreadPct=${rec.depth.spreadPct})`);
}

// ---------- 2) assemble matrix ----------
const matrix = {
  _meta: {
    generatedAt: new Date().toISOString(),
    probeScripts: [
      "scripts/probe-binance-coverage.mjs",
      "scripts/probe-cg-btokens.mjs",
      "scripts/probe-btoken-perps.mjs",
      "scripts/probe-baseline.mjs",
      "scripts/probe-matrix-build.mjs",
    ],
    rawArtifacts: ["/tmp/binance-coverage.json", "/tmp/cg-btokens.json", "/tmp/btoken-perps.json", "/tmp/baseline.json"],
  },

  perps: {},
  btokens: {},
  classic: {},
  baseline: {},
  notes: {},
};

// perps (kind A)
for (const s of A_SYMS) {
  const p = bin.perps[s] ?? {};
  matrix.perps[s] = {
    pair: `${s}USDT`,
    listed: p.listed ?? null,
    testnet: p.testnet ?? null,
    contractType: p.contractType ?? null,
    status: p.status ?? null,
    ...(s === "TON" ? { note: "production SETTLING (delisted — empty book, ticker {}); TRADING on testnet only" } : {}),
    ...(s === "XAU" || s === "XAG" || s === "CL"
      ? { note: `TRADIFI_PERPETUAL (not classic PERPETUAL) — live 24/7 data, quoteVol24h see ticker; excluded by src/lib/binance/universe.ts contractType!=='PERPETUAL' filter (hence 400s through current terminal gates)` }
      : {}),
    ...(s === "ICP" ? { note: "prod TRADING; NOT LISTED on futures testnet" } : {}),
  };
}

// btokens (kind B)
for (const s of B_SYMS) {
  const spot = bin.btokens[s] ?? {};
  const cg = cgB.btokens[s] ?? {};
  const plain = PLAIN_OF[s];
  const plainFapi = perps.fapi[s] ?? {};
  const plainCg = perps.cg[plain] ?? {};
  const mic = micro[s] ?? {};
  const cgTickersFut = cg.tickers?.FUTURES ?? {};
  const cgTickersSpot = cg.tickers?.SPOT ?? {};
  matrix.btokens[s] = {
    spot: spot.spot ?? null,
    spotStatus: spot.status ?? null,
    aggTrades: mic.aggTrades?.ok ?? null,
    depth: mic.depth?.ok ?? null,
    depthLiquidity: mic.depth?.ok ? { spreadPct: mic.depth.spreadPct, top100Levels: { bids: mic.depth.bids, asks: mic.depth.asks } } : null,
    // Coinglass surface for the B-SUFFIXED symbol (Binance spot pair):
    cg_coin_keyword: cgTickersFut.ok || cgTickersSpot.ok
      ? `FUTURES:${cgTickersFut.rows ?? 0} rows${cgTickersFut.ok && (cgTickersFut.venues ?? []).some((v) => v.includes(s + "(type=1")) ? " (incl. exact perp match!)" : ""} / SPOT:${cgTickersSpot.rows ?? 0} rows [${(cgTickersSpot.venues ?? []).slice(0, 2).join(", ")}]`
      : null,
    cg_orderflow: cg.orderflow?.ok ?? null,       // Binance_<SYM>USDT#order_flow — 40001 for all
    cg_lto: cg.lto?.ok ?? null,                    // support/v3 — spot=[Binance]
    cg_liq: cg.liqlevels?.ok ?? null,              // liquidationLevels/v2 — 40001 for all
    cg_kline: cg.kline?.ok ?? null,                // 20001 Not Supported for all
    // THE DECISIVE FINDING: the plain-name underlying has a REAL Binance
    // USDT-M TRADIFI perp with a FULL Coinglass surface:
    plain: plain,
    plain_perp_prod: plainFapi.prod?.listed ?? null,
    plain_perp_testnet: plainFapi.testnet?.listed ?? null,
    plain_perp_contractType: plainFapi.prod?.contractType ?? null,
    cg_plain_kline: plainCg.kline?.ok ?? null,
    cg_plain_orderflow: plainCg.orderflow?.ok ?? null,
    cg_plain_liq: plainCg.liqlevels?.ok ?? null,
    cg_plain_cvd_bs_usd: plainCg.bs_usd?.ok ?? null,
    cg_plain_lto_support: plainCg.lto_support?.ok ?? null,
    cg_plain_lto_venues: plainCg.lto_support?.futures ?? null,
  };
}

// classic (kind C)
matrix.classic = {
  SP500: {
    classic_registry_sym: "SPX500",
    classic_route: 200,
    note: "/api/cg/classic?sym=SP500 → 400 'unknown classic asset' — registry name is SPX500 (yahoo ^GSPC + xyz:SP500 live anchor + tradeXYZ_SP500-USD/Bitget_SP500USDT_UMCBL perp venues in perpmap)",
    perpmap_venues: ["tradeXYZ_SP500-USD", "Bitget_SP500USDT_UMCBL"],
    hl_xyz: "xyz:SP500",
  },
  NDX100: {
    classic_registry_sym: "NDX100",
    classic_route: base["cg.classic.NDX100"]?.status ?? null,
    baseline_summary: base["cg.classic.NDX100"]?.summary ?? null,
    note: "works via Yahoo ^NDX; perpmap venue Bitget_NDX100USDT_UMCBL (thin); xyz:XYZ100 tracker on Hyperliquid HIP-3 (micro map)",
    perpmap_venues: ["Bitget_NDX100USDT_UMCBL"],
    hl_xyz: "xyz:XYZ100",
  },
  BRENTOIL: {
    classic_registry_sym: "UKO",
    classic_route: 200,
    note: "/api/cg/classic?sym=BRENTOIL → 400 'unknown classic asset' — registry name is UKO (yahoo BZ=F + xyz:BRENTOIL live anchor); perpmap venue tradeXYZ_BRENTOIL-USD",
    perpmap_venues: ["tradeXYZ_BRENTOIL-USD"],
    hl_xyz: "xyz:BRENTOIL",
  },
  ANTHROPIC: {
    hl_xyz: null,
    hl_main_dex: null,
    note: "NO ANTHROPIC market on Hyperliquid xyz dex (144 mkts) or main dex (235 mkts) — but a REAL Binance USDT-M TRADIFI perp exists (ANTHROPICUSDT, TRADING, ~$236M/24h, 1.53M trades/day) + full CG surface (kline/orderFlow/liqlevels/bs_usd/lto all ✓; lto 74 open orders on Binance_ANTHROPICUSDT)",
    fapi_perp_prod: perps.fapi.ANTHROPIC?.prod?.listed ?? null,
    fapi_perp_testnet: perps.fapi.ANTHROPIC?.testnet?.listed ?? null,
    cg_venues_futures: ["Binance", "OKX", "Bybit", "Bitget", "Gate", "MEXC", "Lighter", "Bitunix"],
    cg_orderflow_venues_ok: ["Binance_ANTHROPICUSDT", "OKX_ANTHROPIC-USDT-SWAP"],
    cg_lto_support_futures: (perps.cg.ANTHROPIC?.lto_support?.futures) ?? null,
  },
};

// baseline
for (const [id, v] of Object.entries(base)) {
  matrix.baseline[id] = { status: v.status, ms: v.ms, summary: v.summary ?? v.error ?? null };
}

// notes — the implementation drivers
matrix.notes = {
  kind_A: "32/33 TRADING on fapi prod. TONUSDT is PERPETUAL/SETTLING (empty book, 24h ticker {}) — no production data path; it IS Trading on testnet. XAU/XAG/CL are TRADIFI_PERPETUAL contractType (onboarded Dec-2025…Apr-2026) with live data (XAU $1.44B/24h, XAG $481M, CL $619M).",
  kind_A_gate_blocker: "src/lib/binance/universe.ts refresh() line ~127 filters contractType !== 'PERPETUAL' → TRADIFI perps (XAU/XAG/CL and all stock perps) are EXCLUDED from the Tier-2 universe; knownSym() therefore 400s them ('unknown asset NVDA/XAU…'). Admitting kind A metals + plain-name stock perps requires widening that filter to /PERPETUAL$/ (or a curated Tier-0 list).",
  kind_B_spot: "All 23 <BASE>USDT spot pairs TRADING on api.binance.com with real liquidity (sampled NVDAB spread 0.0057% top-1000 $3.9M; MUB 0.0037% $1.5M; SOXL 0.0147% $2.9M; aggTrades 1000/1000 rows; klines 10/10).",
  kind_B_cg_btoken_keys: "Coinglass does NOT serve B-token market data: /api/v2/kline Binance_NVDABUSDT#kline → code 20001 'Not Supported'; /api/orderFlow …#order_flow → 40001 'instrument'; /api/liquidationLevels/v2 → 40001 'liquidation levels instrument unavailable'. Only /api/select/coins/tickers?type=SPOT&keyword=<BASE>B finds Binance_<BASE>BUSDT (type=10), and largeTakerOrder support/v3 returns spot=[Binance]; v3 actually returns orders (NVDAB spot: 16 orders). MUB keyword traps: FUTURES keyword=MUB matches the MUBARAK memecoin (Binance/Gate/OKX/Bitget/Bybit/KuCoin) — WRONG instrument.",
  kind_B_plain_perps: "DECISIVE: every kind-B underlying has a REAL Binance USDT-M TRADIFI_PERPETUAL under the PLAIN name (NVDAB→NVDAUSDT $1.29B/24h, SOXLB→SOXLUSDT $5.49B/24h, TSMB→TSMUSDT, AMDB→AMDUSDT, …) — ALL 23 TRADING on prod, 13/23 on testnet (missing: SNDK SKHY NBIS AAPL DRAM MSFT AMD NFLX AVGO TSM). On Coinglass the plain names have the FULL surface: kline ✓, orderFlow ✓ (Binance/OKX/Bybit keys), liquidationLevels ✓, #bs_usd (CVD) ✓, lto support/v3 futures=[Aster,Binance,Bitget,Bybit,Gate,OKX] ✓ with real v3 orders (NVDA 100, ANTHROPIC 74). CG discovery venues for plain names: tradeXYZ_<NAME>-USD, Binance_<NAME>USDT, OKX_<NAME>-USDT-SWAP, Bybit_<NAME>USDT, Gate_<NAME>_USDT, Bitget_<NAME>USDT_UMCBL, Lighter_<NAME>-USDC, MEXC_<NAME>STOCK_USDT, KuCoin, LBank, Bitunix.",
  cg_orderflow_venue_rule: "For these names /api/orderFlow works ONLY on Binance_<SYM>USDT, OKX_<SYM>-USDT-SWAP, Bybit_<SYM>USDT keys; Gate/Bitget/tradeXYZ/MEXC/Lighter keys → 20001 'Not Supported' (fpVenues() already only fans out to Binance/OKX/Bybit/Hyperliquid — but note Hyperliquid has NO equity/stock markets, so the Hyperliquid leg will be 'missing' for plain names; fpVenues(sym) for an unknown sym pushes Hyperliquid_<s>-USD which will 400/missing — acceptable, lands in missing[]).",
  kind_C: "SP500/BRENTOIL are NOT classic-registry names — the terminal names are SPX500 and UKO (both 200, Yahoo body + xyz live anchors). ANTHROPIC: no Hyperliquid HIP-3/tradeXYZ market (checked live: xyz dex 144 markets, main dex 235 — zero ANTH*), but Binance_ANTHROPICUSDT TRADIFI perp (~$236M/24h) + full CG surface + OKX/Bybit/Bitget/Gate/MEXC perps. Best path for ANTHROPIC = the same perp pipeline as plain-name stocks (NOT synthetic, NOT classic).",
  testnet_executability: "Kind A on testnet: 31/33 TRADING (ICPUSDT and CLUSDT not listed; TONUSDT trades on testnet despite settling in prod). Plain-name stock perps on testnet: 13/23 (NVDA SOXL SPCX MU INTC CRCL MSTR KORU GOOGL TSLA META AMZN COIN). ANTHROPICUSDT NOT on testnet.",
  baseline_btc: "Full toolset live for BTC: fp 50 bars/4 venues, liqlevels 5 venues ~2k rows each, bookwalls 55 walls/5 venues, cvd 300 bars/22 instruments (limit clamped 200→300), lto 15 exchanges/22 groups (minVolUsd=1e6), livebook grid=40. NVDAB correctly 400s at fp + binance/market gates; livebook ETH 200 (isAsset-only gate, top-15 registry).",
};

mkdirSync("/home/z/my-project/download", { recursive: true });
writeFileSync("/home/z/my-project/download/coverage_matrix_probe.json", JSON.stringify(matrix, null, 2));
console.log("\nwrote /home/z/my-project/download/coverage_matrix_probe.json");

// compact console digest
const nA = Object.values(matrix.perps).filter((v) => v.listed).length;
const nB = Object.values(matrix.btokens).filter((v) => v.spot).length;
const nBp = Object.values(matrix.btokens).filter((v) => v.plain_perp_prod).length;
console.log(`digest: kind-A perps ${nA}/33 prod | kind-B spot ${nB}/23 | kind-B plain perps ${nBp}/23 | classic SPX500/NDX100/UKO ✓ | ANTHROPIC perp ✓ (no HL)`);
