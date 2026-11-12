/**
 * Multi-asset registry — venue derivations for the CURATED universe.
 *
 * 2026-11-12 consolidation ("no gaps" directive): the terminal universe is
 * the curated 61 (src/lib/universe/curated.ts — 30 crypto + 28 TradFi perps
 * + 3 classic). This module keeps the legacy Tier-1 table below (XPT still
 * works in Tier-1 code paths even though it left the palette) and derives
 * every venue instrument key per symbol, curated-aware:
 *
 *   fpVenues()     — THE COINGLASS AGGREGATED METHOD (agg-perp): Binance +
 *                    OKX + Bybit + Hyperliquid perps merged (their default
 *                    footprint aggregate; Hyperliquid price-shifted onto the
 *                    Binance lead). Curated TradFi drops Hyperliquid (no HL
 *                    equity/metal markets). Verified live: /api/orderFlow on
 *                    the plain TradFi names works on Binance/OKX/Bybit keys
 *                    only (Gate/Bitget/tradeXYZ/MEXC/Lighter → 20001).
 *   liqVenues()    — multi-venue aggregate. TradFi gets PINNED seed keys
 *                    (Binance/OKX/Bybit/Bitget/Gate — all five verified live
 *                    2026-11-12 on NVDA/MU/XAU: ~1.5-2k rows each). Crypto
 *                    keeps the live candidate set (missing[] stays honest).
 *   aggVenues()    — liquidity-heatmap stream candidates. TradFi is seeded
 *                    Binance-only (verified: every other venue 20001s the
 *                    futures heatmap pair for plain names); crypto keeps
 *                    per-coin discovery (the stream names + the route prunes).
 *   pinCvdInstruments() — TradFi CVD instruments are PINNED (never keyword-
 *                    discovered: keyword=MUB returns the MUBARAK memecoin —
 *                    verified trap). Crypto keeps keyword discovery (verified
 *                    safe for every curated crypto sym incl. 1000PEPE).
 *
 * All venue instruments are REAL Coinglass instrument ids (verified live).
 *
 * Tier-3 instruments (TradFi indices/commodities without perps) live in
 * src/lib/cg/classic.ts and never enter this perp registry.
 */

import { CURATED_BY_SYM, type CuratedAsset } from "@/lib/universe/curated";
import { resolveCgSym } from "../binance/aliases";

export type CryptoSector = "major" | "l1" | "defi" | "ai" | "l2" | "meme" | "privacy" | "metal";

export interface AssetCfg {
  sym: string;
  name: string;
  kind: "crypto" | "metal";
  sector: CryptoSector;
  /** lead venue kline instrument (price + volume source) */
  leadKey: (sym: string) => string;
  priceDecs: number;
  /** Hyperliquid instrument (null = venue not listed) */
  hl: boolean;
  /** scan cadence tier: "fast" = primary trading assets */
  tier: "fast" | "slow";
}

function mk(
  sym: string,
  name: string,
  kind: "crypto" | "metal",
  priceDecs: number,
  tier: "fast" | "slow" = "slow",
  hl = true,
  sector: CryptoSector = kind === "metal" ? "metal" : "major",
  /** optional lead-instrument override (future non-Binance leads; unused) */
  lead?: string
): AssetCfg {
  return {
    sym,
    name,
    kind,
    sector,
    hl,
    tier,
    priceDecs,
    leadKey: (s: string) => lead ?? `Binance_${s}USDT`,
  };
}

export const ASSETS: AssetCfg[] = [
  // ---- Fast tier (8 · primary trading movers) ----
  mk("BTC", "Bitcoin", "crypto", 1, "fast", true, "major"),
  mk("ETH", "Ethereum", "crypto", 2, "fast", true, "major"),
  mk("SOL", "Solana", "crypto", 2, "fast", true, "major"),
  mk("BNB", "BNB", "crypto", 2, "fast", true, "major"),
  mk("XRP", "XRP", "crypto", 4, "fast", true, "major"),
  mk("DOGE", "Dogecoin", "crypto", 5, "fast", true, "meme"),
  mk("SUI", "Sui", "crypto", 4, "fast", true, "l1"),
  mk("HYPE", "Hyperliquid", "crypto", 3, "fast", true, "l1"),

  // ---- Crucial Core 22 Crypto (Majors · L1 · L2 · DeFi · AI · Privacy · Meme) ----
  mk("ADA", "Cardano", "crypto", 4, "slow", true, "major"),
  mk("AVAX", "Avalanche", "crypto", 2, "slow", true, "l1"),
  mk("LINK", "Chainlink", "crypto", 3, "slow", true, "defi"),
  mk("LTC", "Litecoin", "crypto", 2, "slow", true, "major"),
  mk("BCH", "Bitcoin Cash", "crypto", 2, "slow", true, "major"),
  mk("XLM", "Stellar", "crypto", 4, "slow", true, "major"),
  mk("XMR", "Monero", "crypto", 3, "slow", true, "privacy"),
  mk("ZEC", "Zcash", "crypto", 2, "slow", true, "privacy"),
  mk("NEAR", "NEAR Protocol", "crypto", 3, "slow", true, "l1"),
  mk("1000PEPE", "Pepe (1000x)", "crypto", 7, "slow", true, "meme"),
  mk("UNI", "Uniswap", "crypto", 3, "slow", true, "defi"),
  mk("AAVE", "Aave", "crypto", 2, "slow", true, "defi"),
  mk("ENA", "Ethena", "crypto", 5, "slow", true, "defi"),
  mk("TAO", "Bittensor", "crypto", 2, "slow", true, "ai"),
  mk("INJ", "Injective", "crypto", 3, "slow", true, "defi"),
  mk("ARB", "Arbitrum", "crypto", 4, "slow", true, "l2"),
  mk("OP", "Optimism", "crypto", 4, "slow", true, "l2"),
  mk("APT", "Aptos", "crypto", 4, "slow", true, "l1"),
  mk("ONDO", "Ondo", "crypto", 4, "slow", true, "defi"),
  mk("WLD", "Worldcoin", "crypto", 4, "slow", true, "ai"),
  mk("TRX", "TRON", "crypto", 5, "slow", true, "l1"),
  mk("ZRO", "LayerZero", "crypto", 4, "slow", true, "l2"),

  // ---- Core Metals (3 · USDT perps, no Hyperliquid on CG venues) ----
  mk("XAU", "Gold", "metal", 2, "slow", false, "metal"),
  mk("XAG", "Silver", "metal", 3, "slow", false, "metal"),
  mk("XPT", "Platinum", "metal", 2, "slow", false, "metal"),
];

export const ASSET_SYMS = ASSETS.map((a) => a.sym);

const bySym = new Map(ASSETS.map((a) => [a.sym, a]));

export function assetOf(sym: string): AssetCfg | undefined {
  return bySym.get(sym.toUpperCase());
}

export function isAsset(sym: string): boolean {
  return bySym.has(sym.toUpperCase());
}

// ---------------------------------------------------------------------------
// Curated membership helpers (src/lib/universe/curated.ts is canonical)
// ---------------------------------------------------------------------------

/** curated perp entry for a terminal sym (undefined for classic/unknown). */
export function curatedAssetOf(sym: string): CuratedAsset | undefined {
  const c = CURATED_BY_SYM.get(sym.toUpperCase());
  return c && c.kind !== "classic" ? c : undefined;
}

/** true for the 58 curated perp syms (crypto + TradFi alike) — static. */
export function isCuratedPerp(sym: string): boolean {
  return curatedAssetOf(sym) !== undefined;
}

/** true for the 28 curated TradFi perp syms (NVDA, XAU, CL …). */
export function isCuratedTradfi(sym: string): boolean {
  return curatedAssetOf(sym)?.kind === "tradfi-perp";
}

/** Centralized lead-instrument derivation — the ONLY place that builds the
 *  kline/lead key (multi-agent review A2: 5 call sites hardcoded
 *  `Binance_${sym}USDT`). Unknown symbols keep the legacy Binance form. */
export function leadInstr(sym: string): string {
  const s = resolveCgSym(sym);
  return assetOf(s)?.leadKey(s) ?? `Binance_${s}USDT`;
}

/** Footprint venues for a symbol — THE COINGLASS AGGREGATED METHOD (agg-perp).
 *
 * User directive 2026-11-12: the Footprint tab must keep the same aggregated
 * methodology Coinglass's footprint page uses — their `agg-perp` market is
 * exactly [binance-perp, okx-perp, bybit-perp, hyperliquid-perp] (verified in
 * their published page bundle, footprint-page.pretty.js `C` table), with the
 * lead kline from venues[0] (Binance) and USD-quote venues (Hyperliquid)
 * price-shifted onto the lead level before merging (their eM loader — our
 * fp-load.ts is a 1:1 port). Signals run on the merged aggregate, so BTC/ETH
 * signal counts/types match their page 1:1 (see scripts/test-signal-parity.ts).
 *
 * CURATED TradFi (NVDA, XAU, CL …) uses the same aggregate minus Hyperliquid
 * (HL carries no equity/metal markets — live-verified; /api/orderFlow on the
 * plain TradFi names works on Binance/OKX/Bybit keys, Gate/Bitget/tradeXYZ/
 * MEXC/Lighter → 20001).
 *
 * Legacy metals (XPT) keep the 3-venue USDT set (no HL market).
 *
 * 1000-multiples (1000SHIB/1000PEPE) and VET need per-venue key forms and
 * exclusions — see FP_KEY_FORMS / NO_*_PERP below (live-verified 2026-11-12
 * against the real /api/orderFlow + /api/v2/kline endpoints). */
/** Per-venue instrument KEY FORMS for 1000-multiple assets (live-verified
 *  2026-11-12 against Coinglass /api/orderFlow + /api/v2/kline — see
 *  scripts/probe-fp-1000x.ts raw output):
 *    OKX         lists the PLAIN base          SHIB-USDT-SWAP / PEPE-USDT-SWAP
 *    Bybit       PEPE keeps the 1000-prefix    1000PEPEUSDT, but SHIB renames
 *                to the suffix form           SHIB1000USDT
 *    Hyperliquid uses the k-form              kSHIB-USD / kPEPE-USD
 *  Without these forms every non-Binance fp leg 40001s and the aggregate
 *  silently degrades to binance-only (exactly the 1000SHIB missing[] bug). */
const FP_KEY_FORMS: Record<string, { okx?: string; bybit?: string; hl?: string }> = {
  "1000SHIB": { okx: "SHIB-USDT-SWAP", bybit: "SHIB1000USDT", hl: "kSHIB-USD" },
  "1000PEPE": { okx: "PEPE-USDT-SWAP", bybit: "1000PEPEUSDT", hl: "kPEPE-USD" },
};

/** Venue EXCLUSIONS for symbols with genuinely dead keys (live-verified
 *  40001, scripts/probe-fp-1000x.ts + probe-fp-1000x-liq.ts):
 *  XMR has no OKX USDT-SWAP; VET has no OKX swap, no Hyperliquid market and
 *  no Bitget liq-levels (Binance+Bybit only). Constructing dead keys only
 *  burns upstream 40001s on every load — drop them (the aggregate stays
 *  honest through each route's missing[] reporting). */
const NO_OKX_PERP = new Set(["XMR", "VET"]);
const NO_HL_MARKET = new Set(["VET"]);
const NO_BITGET_LIQ = new Set(["VET", "1000SHIB", "1000PEPE"]);

/** liquidationLevels/v2 key forms + dead legs (live-verified 2026-11-12,
 *  scripts/probe-fp-1000x-liq.ts): the endpoint's venue coverage differs from
 *  orderFlow — kPEPE orderFlow works but kPEPE liq-levels 40001s
 *  ("price/OI row unavailable"), Bitget carries no SHIB/PEPE levels at all. */
const LIQ_KEY_FORMS: Record<string, { okx?: string; bybit?: string; hl?: string; dropHl?: boolean }> = {
  "1000SHIB": { okx: "SHIB-USDT-SWAP", bybit: "SHIB1000USDT", hl: "kSHIB-USD" },
  "1000PEPE": { okx: "PEPE-USDT-SWAP", dropHl: true },
};

export function fpVenues(sym: string): { id: string; key: string; usd: boolean }[] {
  const s = resolveCgSym(sym);
  const a = assetOf(s);
  const kf = FP_KEY_FORMS[s];
  const venues: { id: string; key: string; usd: boolean }[] = [
    { id: "binance-perp", key: `Binance_${s}USDT`, usd: false },
    { id: "okx-perp", key: `OKX_${kf?.okx ?? `${s}-USDT-SWAP`}`, usd: false },
    { id: "bybit-perp", key: `Bybit_${kf?.bybit ?? `${s}USDT`}`, usd: false },
  ];
  // XMR/VET have NO OKX-USDT-SWAP (live-verified 40001): constructing the
  // dead key only burns an upstream error per load — drop it (the aggregate
  // stays honest through the route's missing[] reporting).
  if (NO_OKX_PERP.has(s)) venues.splice(1, 1);
  // Hyperliquid joins the aggregate for every crypto perp (curated or legacy
  // registry) — exactly Coinglass's agg-perp membership — but never for
  // curated TradFi, registry metals, or VET (no HL market, verified).
  if (!isCuratedTradfi(s) && !NO_HL_MARKET.has(s) && (!a || a.hl)) {
    venues.push({ id: "hyperliquid-perp", key: `Hyperliquid_${kf?.hl ?? `${s}-USD`}`, usd: true });
  }
  const lead = a?.leadKey(s);
  const li = venues.findIndex((v) => v.key === lead);
  if (li > 0) venues.unshift(...venues.splice(li, 1));
  return venues;
}

/** Liquidation-levels venues for a symbol (aggregate).
 *
 * CURATED TradFi gets PINNED seed instrument keys — never keyword discovery
 * (keyword=MUB returns the MUBARAK memecoin, verified). Live-verified
 * 2026-11-12 on NVDA/MU/XAU: all five seeds below return ~1.5-2k rows on
 * /api/liquidationLevels/v2 (Gate's id form is <S>_USDT with an underscore).
 * CURATED crypto keeps the candidate set — a venue without the pair returns
 * no payload and shows 0 rows in perVenue, never breaking the aggregate
 * (live: Bitget/Hyperliquid miss on 1000PEPE, Binance/Bybit carry it).
 * 1000-multiples use LIQ_KEY_FORMS (the endpoint's venue coverage differs
 * from orderFlow — verified 2026-11-12) and VET drops its dead legs.
 * Legacy metals (XPT) keep their curated 3. */
export function liqVenues(sym: string): { name: string; key: string }[] {
  const s = resolveCgSym(sym);
  if (isCuratedTradfi(s)) {
    return [
      { name: "Binance", key: `Binance_${s}USDT` },
      { name: "OKX", key: `OKX_${s}-USDT-SWAP` },
      { name: "Bybit", key: `Bybit_${s}USDT` },
      { name: "Bitget", key: `Bitget_${s}USDT_UMCBL` },
      { name: "Gate", key: `Gate_${s}_USDT` },
    ];
  }
  const a = assetOf(s);
  const metal = a?.kind === "metal";
  const kf = LIQ_KEY_FORMS[s];
  const v = [
    { name: "Binance", key: `Binance_${s}USDT` },
    { name: "OKX", key: `OKX_${kf?.okx ?? `${s}-USDT-SWAP`}` },
    { name: "Bybit", key: `Bybit_${kf?.bybit ?? `${s}USDT`}` },
  ];
  if (NO_OKX_PERP.has(s)) v.splice(1, 1); // XMR/VET: no OKX USDT-SWAP (verified)
  if (!metal && !NO_BITGET_LIQ.has(s)) v.push({ name: "Bitget", key: `Bitget_${s}USDT_UMCBL` });
  if ((!a || a.hl) && !NO_HL_MARKET.has(s) && !kf?.dropHl) {
    v.push({ name: "Hyperliquid", key: `Hyperliquid_${kf?.hl ?? `${s}-USD`}` });
  }
  return v;
}

/**
 * Liquidity-heatmap AGGREGATE-stream venues per asset (live-verified against
 * capi.coinglass.com): BTC and ETH keep their curated full sets. Every other
 * curated CRYPTO asset gets the FULL candidate list — the route's discovery
 * probes the stream once per (coin, market), drops venues the stream itself
 * rejects ("No supported … pair for COIN on X") and caches the pruned set
 * (live-verified 2026-11-12: VET converges to Binance, TIA/SUI/SEI/INJ to
 * Binance+Hyperliquid — discovery handles every curated crypto coin).
 *
 * CURATED TradFi is seeded BINANCE-ONLY (live-verified: OKX, Gate, Bitget
 * AND Hyperliquid all 20001 the futures heatmap pair for NVDA/XAU/XAG/CL/
 * ANTHROPIC/… — seeding them would only burn four probe streams per coin).
 * The B-token SPOT books are not heatmap pairs either → spot stays empty
 * (honest 400 "use market=futures", same contract as legacy metals).
 * Legacy metals (XPT) stay Binance-only (no spot books).
 */
export function aggVenues(sym: string, market: "futures" | "spot"): string[] {
  const s = resolveCgSym(sym);
  const a = assetOf(s);
  if (isCuratedTradfi(s)) {
    return market === "futures" ? ["Binance"] : [];
  }
  const noSpot = a?.kind === "metal" || s === "CL" || s === "BZ" || s === "NATGAS";
  if (market === "futures") {
    if (s === "BTC" || s === "ETH") return ["Binance", "OKX", "Gate", "Bitget", "Hyperliquid"];
    if (noSpot) return ["Binance"];
    return ["Binance", "OKX", "Gate", "Bitget", "Hyperliquid"];
  }
  if (s === "BTC" || s === "ETH") return ["Binance", "Coinbase", "OKX", "Bitget", "Gate", "Kraken", "Bitfinex"];
  if (noSpot) return []; // no crypto spot books for metals/commodities
  return ["Binance", "Coinbase", "OKX", "Bitget", "Gate", "Kraken", "Bitfinex"];
}

export interface PinnedCvdInstrument {
  key: string;
  venue: string;
  kind: "perp" | "spot";
}

/**
 * PINNED CVD instruments for curated TradFi syms (the /api/cg/cvd route).
 *
 * Coinglass keyword discovery is a TRAP for plain TradFi names — keyword=MUB
 * returns the MUBARAK memecoin (verified) — so the CVD route must never
 * keyword-resolve them. Instead the perp legs are constructed explicitly
 * (live-verified 2026-11-12 on NVDA/MU/XAU/CL/ANTHROPIC: all five venues
 * serve #bs_usd) and the SPOT leg uses the Binance B-token (Binance_SPOT_
 * NVDABUSDT / Binance_SPOT_MUBUSDT / Binance_SPOT_XAUTUSDT — all verified
 * live on #bs_usd) so the spot-vs-futures quadrant stays honest for stocks.
 * Binance is always first (the priceKey lead).
 *
 * Curated crypto returns undefined → the route keeps keyword discovery
 * (verified safe for every curated crypto sym, incl. 1000PEPE/1000SHIB
 * whose per-venue instrument ids differ, e.g. OKX lists PEPE-USDT-SWAP).
 */
export function pinCvdInstruments(sym: string): PinnedCvdInstrument[] | undefined {
  const c = curatedAssetOf(sym);
  if (!c || c.kind !== "tradfi-perp") return undefined;
  const s = c.sym;
  const inst: PinnedCvdInstrument[] = [
    { key: `Binance_${s}USDT`, venue: "Binance", kind: "perp" },
    { key: `OKX_${s}-USDT-SWAP`, venue: "OKX", kind: "perp" },
    { key: `Bybit_${s}USDT`, venue: "Bybit", kind: "perp" },
    { key: `Bitget_${s}USDT_UMCBL`, venue: "Bitget", kind: "perp" },
    { key: `Gate_${s}_USDT`, venue: "Gate", kind: "perp" },
  ];
  if (c.spotPair) inst.push({ key: `Binance_SPOT_${c.spotPair}`, venue: "Binance", kind: "spot" });
  return inst;
}

export function fmtAssetPrice(v: number | null | undefined, sym: string): string {
  if (null == v || !Number.isFinite(v)) return "–";
  const dec = symDecs(sym, v);
  return v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function symDecs(sym: string, refPrice?: number | null): number {
  const s = resolveCgSym(sym);
  const a = assetOf(s) ?? assetOf(sym);
  if (a) return a.priceDecs;
  const p = typeof refPrice === "number" && Number.isFinite(refPrice) && refPrice > 0 ? refPrice : null;
  if (p == null) return 4; // safe default for an unseen Tier-2 symbol
  if (p >= 1000) return 2;
  if (p >= 100) return 2;
  if (p >= 10) return 3;
  if (p >= 1) return 3;
  if (p >= 0.1) return 4;
  if (p >= 0.01) return 5;
  if (p >= 0.001) return 6;
  if (p >= 0.0001) return 7;
  return 8;
}
