/**
 * Multi-asset registry — the 12 traded assets of the terminal.
 *
 * All venue instruments are REAL Coinglass instrument ids (verified live):
 *   - 10 crypto perps: BTC ETH SOL BNB XRP ADA AVAX DOGE LINK LTC
 *     (Binance + OKX + Bybit + Hyperliquid aggregated futures)
 *   - 2 metals: XAU (gold) / XAG (silver) — listed as USDT perps on
 *     Binance/OKX/Bybit in 2026; Hyperliquid does not carry them yet,
 *     so the footprint aggregate falls back to 3 venues (handled).
 *
 * Every downstream route derives its instrument keys from this table so
 * adding a new asset is a one-line change.
 */

export interface AssetCfg {
  sym: string;
  name: string;
  kind: "crypto" | "metal";
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
  hl = true
): AssetCfg {
  return {
    sym,
    name,
    kind,
    hl,
    tier,
    priceDecs,
    leadKey: (s: string) => `Binance_${s}USDT`,
  };
}

export const ASSETS: AssetCfg[] = [
  mk("BTC", "Bitcoin", "crypto", 1, "fast"),
  mk("ETH", "Ethereum", "crypto", 2, "fast"),
  mk("SOL", "Solana", "crypto", 2, "fast"),
  mk("BNB", "BNB", "crypto", 2),
  mk("XRP", "XRP", "crypto", 4),
  mk("ADA", "Cardano", "crypto", 4),
  mk("AVAX", "Avalanche", "crypto", 2),
  mk("DOGE", "Dogecoin", "crypto", 5),
  mk("LINK", "Chainlink", "crypto", 3),
  mk("LTC", "Litecoin", "crypto", 2),
  mk("XAU", "Gold", "metal", 2, "slow", false),
  mk("XAG", "Silver", "metal", 3, "slow", false),
];

export const ASSET_SYMS = ASSETS.map((a) => a.sym);

const bySym = new Map(ASSETS.map((a) => [a.sym, a]));

export function assetOf(sym: string): AssetCfg | undefined {
  return bySym.get(sym.toUpperCase());
}

export function isAsset(sym: string): boolean {
  return bySym.has(sym.toUpperCase());
}

/** Perp aggregation venues for a symbol — mirrors the fp route's VENUES. */
export function fpVenues(sym: string): { id: string; key: string; usd: boolean }[] {
  const s = sym.toUpperCase();
  const a = assetOf(s);
  const venues: { id: string; key: string; usd: boolean }[] = [
    { id: "binance-perp", key: `Binance_${s}USDT`, usd: false },
    { id: "okx-perp", key: `OKX_${s}-USDT-SWAP`, usd: false },
    { id: "bybit-perp", key: `Bybit_${s}USDT`, usd: false },
  ];
  if (!a || a.hl) venues.push({ id: "hyperliquid-perp", key: `Hyperliquid_${s}-USD`, usd: true });
  return venues;
}

/** Liquidation-levels venues for a symbol (4-venue aggregate). */
export function liqVenues(sym: string): { name: string; key: string }[] {
  const s = sym.toUpperCase();
  const a = assetOf(s);
  const v = [
    { name: "Binance", key: `Binance_${s}USDT` },
    { name: "OKX", key: `OKX_${s}-USDT-SWAP` },
    { name: "Bybit", key: `Bybit_${s}USDT` },
  ];
  if (!a || a.hl) v.push({ name: "Hyperliquid", key: `Hyperliquid_${s}-USD` });
  return v;
}

/**
 * Liquidity-heatmap AGGREGATE-stream venues per asset (live-verified against
 * capi.coinglass.com): the full multi-venue futures/spot aggregates exist
 * only for BTC and ETH. Alt-coin perps aggregate over Binance+Hyperliquid
 * (OKX/Gate/Bitget/Bybit carry no alt futures heatmap pairs — the stream
 * errors with "No supported futures heatmap pair" if any listed venue lacks
 * the pair). Metals are Binance-only (no Hyperliquid listing, no spot books).
 */
export function aggVenues(sym: string, market: "futures" | "spot"): string[] {
  const s = sym.toUpperCase();
  const a = assetOf(s);
  if (market === "futures") {
    if (s === "BTC" || s === "ETH") return ["Binance", "OKX", "Gate", "Bitget", "Hyperliquid"];
    if (a?.kind === "metal") return ["Binance"];
    return ["Binance", "Hyperliquid"];
  }
  if (s === "BTC" || s === "ETH") return ["Binance", "Coinbase", "OKX", "Bitget", "Gate", "Kraken", "Bitfinex"];
  if (a?.kind === "metal") return []; // no spot books for metals on the stream
  return ["Binance"];
}

export function fmtAssetPrice(v: number | null | undefined, sym: string): string {
  if (null == v || !Number.isFinite(v)) return "–";
  const a = assetOf(sym);
  return v.toLocaleString("en-US", { minimumFractionDigits: a?.priceDecs ?? 2, maximumFractionDigits: a?.priceDecs ?? 2 });
}
