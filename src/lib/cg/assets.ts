/**
 * Multi-asset registry — the perp-scanned Tier-1 assets of the terminal.
 *
 * V2 (2026-11-12): Expanded from 12 → 30 crucial crypto perpetuals across
 * Majors, L1/L2, DeFi, AI, Privacy, and Meme leaders (live-verified across
 * Binance USDT-M + Coinglass orderFlow / liquidationLevels / funding / OI)
 * plus 3 core metals (`XAU`, `XAG`, `XPT`) = 33 Tier-1 assets:
 *   - fast (8): primary high-turnover movers (high-frequency scan + boot backfill)
 *   - slow (25): remaining 22 crucial crypto + 3 metals (staggered scan + on-demand)
 *
 * USO REMOVED 2026-11-11 (DIR-0009 critical finding): OKX USO-USDT-SWAP
 * tracks the United States Oil Fund ETF (~$141), a +63% underlying mismatch
 * vs broker USOUSD WTI (~$86) — wrong-instrument data is worse than no data;
 * WTI now lives in src/lib/cg/classic.ts on Yahoo CL=F.
 *
 * Tier-3 instruments (TradFi equities, ETFs, indices, FX, commodities) live
 * in src/lib/cg/classic.ts and never enter this perp registry.
 *
 * Every downstream route derives its instrument keys from this table so
 * adding a new asset is a one-line change.
 */

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

/** Centralized lead-instrument derivation — the ONLY place that builds the
 *  kline/lead key (multi-agent review A2: 5 call sites hardcoded
 *  `Binance_${sym}USDT`). Unknown symbols keep the legacy Binance form. */
export function leadInstr(sym: string): string {
  const s = resolveCgSym(sym);
  return assetOf(s)?.leadKey(s) ?? `Binance_${s}USDT`;
}

/** Perp aggregation venues for a symbol — mirrors the fp route's VENUES. */
export function fpVenues(sym: string): { id: string; key: string; usd: boolean }[] {
  const s = resolveCgSym(sym);
  const a = assetOf(s);
  const venues: { id: string; key: string; usd: boolean }[] = [
    { id: "binance-perp", key: `Binance_${s}USDT`, usd: false },
    { id: "okx-perp", key: `OKX_${s}-USDT-SWAP`, usd: false },
    { id: "bybit-perp", key: `Bybit_${s}USDT`, usd: false },
  ];
  if (!a || a.hl) venues.push({ id: "hyperliquid-perp", key: `Hyperliquid_${s}-USD`, usd: true });
  const lead = a?.leadKey(s);
  const li = venues.findIndex((v) => v.key === lead);
  if (li > 0) venues.unshift(...venues.splice(li, 1));
  return venues;
}

/** Liquidation-levels venues for a symbol (aggregate). */
export function liqVenues(sym: string): { name: string; key: string }[] {
  const s = resolveCgSym(sym);
  const a = assetOf(s);
  const metal = a?.kind === "metal";
  const v = [
    { name: "Binance", key: `Binance_${s}USDT` },
    { name: "OKX", key: `OKX_${s}-USDT-SWAP` },
    { name: "Bybit", key: `Bybit_${s}USDT` },
  ];
  if (!metal) v.push({ name: "Bitget", key: `Bitget_${s}USDT_UMCBL` });
  if (!a || a.hl) v.push({ name: "Hyperliquid", key: `Hyperliquid_${s}-USD` });
  return v;
}

/** Liquidity-heatmap AGGREGATE-stream venues per asset. */
export function aggVenues(sym: string, market: "futures" | "spot"): string[] {
  const s = resolveCgSym(sym);
  const a = assetOf(s);
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
