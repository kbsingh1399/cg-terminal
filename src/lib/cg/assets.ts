/**
 * Multi-asset registry — the perp-scanned assets of the terminal.
 *
 * All venue instruments are REAL Coinglass instrument ids (verified live):
 *   - 12 crypto perps: BTC ETH SOL BNB XRP ADA AVAX DOGE LINK LTC XLM XMR
 *     (Binance + OKX + Bybit + Hyperliquid aggregated futures)
 *   - 3 metals: XAU (gold) / XAG (silver) / XPT (platinum) — USDT perps on
 *     the crypto venues; Hyperliquid does not carry them, so footprints
 *     aggregate over 1-3 venues.
 *
 * USO REMOVED 2026-11-11 (DIR-0009 critical finding): OKX USO-USDT-SWAP
 * tracks the United States Oil Fund ETF (~$141), a +63% underlying mismatch
 * vs broker USOUSD WTI (~$86) — wrong-instrument data is worse than no data;
 * WTI now lives in src/lib/cg/classic.ts on Yahoo CL=F.
 *
 * Tier-3 instruments (14 indices · 48 FX · 19 equities · UKO + USO) have NO
 * perp data anywhere — they live in src/lib/cg/classic.ts (Yahoo-backed quotes)
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
  /** optional lead-instrument override (future non-Binance leads; unused) */
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
  // 2026-11-11 expansion: XPT = platinum perp (Binance+OKX only — metals venue
  // branch, no Hyperliquid). USO REMOVED (DIR-0009: OKX USO perp = USO ETF,
  // +63% mismatch vs broker USOUSD WTI) — WTI + UKO Brent live in classic.ts.
  mk("XPT", "Platinum", "metal", 2, "slow", false),
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
  return assetOf(sym)?.leadKey(sym) ?? `Binance_${sym.toUpperCase()}USDT`;
}

/** Perp aggregation venues for a symbol — mirrors the fp route's VENUES.
 * The registry's LEAD instrument goes first (fp-load merges onto keys[0]);
 * the lead-override mechanism is currently unused (every listed asset leads
 * on Binance since the USO removal) but stays for future non-Binance leads.
 * 2026-11-11 (Tier-2 unlock): unknown symbols join as-is — venues without a
 * pair fail per-venue and land in `missing` (live-verified: ARIA aggregates
 * Binance+Bybit). Bitget is deliberately NOT here: the /api/orderFlow
 * endpoint carries no Bitget instrument keys (verified on BTC and ARIA);
 * Bitget DOES serve liquidationLevels/v2, CVD flows and LTO orders. */
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

/** Liquidation-levels venues for a symbol (aggregate).
 * 2026-11-11 (Tier-2 unlock): Bitget joins the crypto candidates (registry +
 * top-200); a venue without the pair returns no payload and shows 0 rows in
 * perVenue — never breaks the aggregate. Metals keep their curated 3. */
export function liqVenues(sym: string): { name: string; key: string }[] {
  const s = sym.toUpperCase();
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

/**
 * Liquidity-heatmap AGGREGATE-stream venues per asset (live-verified against
 * capi.coinglass.com): BTC and ETH keep their curated full sets. Every other
 * crypto asset (registry alts + Tier-2 top-200) gets the FULL candidate list —
 * the route's resolveAggVenues() probes the stream once per (coin, market),
 * drops venues the stream itself rejects ("No supported … pair for COIN on X")
 * and caches the pruned set, so each coin aggregates over every venue that
 * actually carries its book (Binance/OKX/Gate/Bitget/Hyperliquid futures;
 * + Coinbase/Kraken/Bitfinex spot). Metals stay Binance-only (no spot books).
 */
export function aggVenues(sym: string, market: "futures" | "spot"): string[] {
  const s = sym.toUpperCase();
  const a = assetOf(s);
  if (market === "futures") {
    if (s === "BTC" || s === "ETH") return ["Binance", "OKX", "Gate", "Bitget", "Hyperliquid"];
    if (s === "USO") return []; // USO left the perp registry 2026-11-11 (ETF mismatch) — kept as a guard: honest 400, never a stream error
    if (a?.kind === "metal") return ["Binance"];
    return ["Binance", "OKX", "Gate", "Bitget", "Hyperliquid"];
  }
  if (s === "BTC" || s === "ETH") return ["Binance", "Coinbase", "OKX", "Bitget", "Gate", "Kraken", "Bitfinex"];
  if (a?.kind === "metal") return []; // no spot books for metals on the stream
  return ["Binance", "Coinbase", "OKX", "Bitget", "Gate", "Kraken", "Bitfinex"];
}

export function fmtAssetPrice(v: number | null | undefined, sym: string): string {
  if (null == v || !Number.isFinite(v)) return "–";
  const a = assetOf(sym);
  return v.toLocaleString("en-US", { minimumFractionDigits: a?.priceDecs ?? 2, maximumFractionDigits: a?.priceDecs ?? 2 });
}

/** Display decimals for ANY terminal symbol — registry asset, Tier-2 Binance
 * top-200 symbol, or unknown: registry priceDecs win; otherwise derive from a
 * live reference price (sub-cent coins get 5-8 decimals, majors 1-3), exactly
 * the way Binance's own tick sizes spread. Used by every tool that renders a
 * symbol outside the 15-asset registry. */
export function symDecs(sym: string, refPrice?: number | null): number {
  const a = assetOf(sym);
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
