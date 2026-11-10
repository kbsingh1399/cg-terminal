/**
 * Multi-asset registry — the perp-scanned assets of the terminal.
 *
 * All venue instruments are REAL Coinglass instrument ids (verified live):
 *   - 12 crypto perps: BTC ETH SOL BNB XRP ADA AVAX DOGE LINK LTC XLM XMR
 *     (Binance + OKX + Bybit + Hyperliquid aggregated futures)
 *   - 4 metals/commodities: XAU (gold) / XAG (silver) / XPT (platinum) /
 *     USO (WTI crude) — USDT perps on the crypto venues; Hyperliquid does
 *     not carry them, so footprints aggregate over 1-3 venues.
 *
 * Tier-3 instruments (14 indices · 42 FX · 20 equities · UKO) have NO perp
 * data anywhere — they live in src/lib/cg/classic.ts (Yahoo-backed quotes)
 * and never enter this perp registry.
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
  hl = true,
  /** optional lead-instrument override (USO: no Binance perp — OKX lead) */
  lead?: string
): AssetCfg {
  return {
    sym,
    name,
    kind,
    hl,
    tier,
    priceDecs,
    leadKey: (s: string) => lead ?? `Binance_${s}USDT`,
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
  // 2026-11-10 broker-universe expansion (FundedNext audit + live Coinglass probe):
  // XLM (4-venue perp) and XMR (3-venue: Binance/Bybit/Hyperliquid — no OKX swap).
  mk("XLM", "Stellar", "crypto", 4),
  mk("XMR", "Monero", "crypto", 3),
  mk("XAU", "Gold", "metal", 2, "slow", false),
  mk("XAG", "Silver", "metal", 3, "slow", false),
  // 2026-11-11 expansion (user directive: metals + classic universe):
  // XPT = platinum perp (Binance+OKX only — metals venue branch, no Hyperliquid).
  // USO = WTI oil perp, OKX-LEAD (no Binance kline — the registry's only
  // non-Binance lead; see leadInstr() for the centralized derivation).
  // UKO (Brent) has zero perp data on every Coinglass venue → classic.ts.
  mk("XPT", "Platinum", "metal", 2, "slow", false),
  mk("USO", "WTI Crude Oil", "metal", 2, "slow", false, "OKX_USO-USDT-SWAP"),
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
 *  `Binance_${sym}USDT`, which would silently keep USO on a dead Binance
 *  lead). Unknown symbols keep the legacy Binance form. */
export function leadInstr(sym: string): string {
  return assetOf(sym)?.leadKey(sym) ?? `Binance_${sym.toUpperCase()}USDT`;
}

/** Perp aggregation venues for a symbol — mirrors the fp route's VENUES.
 * The registry's LEAD instrument goes first (fp-load merges onto keys[0]):
 * USO's lead is OKX (no Binance kline), every other asset leads on Binance. */
export function fpVenues(sym: string): { id: string; key: string; usd: boolean }[] {
  const s = sym.toUpperCase();
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
    if (s === "USO") return []; // OKX-only oil perp — no heatmap aggregate pair exists (honest 400, not a stream error)
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
