/**
 * Canonical mapping between terminal display symbols and Binance USDT-M pairs.
 *
 * Keep this module dependency-free so both client WebSocket hooks and server
 * API routes share the exact same symbol resolution without circular imports.
 */

export const BINANCE_SYM_ALIASES: Record<string, string> = {
  USO: "CL",       // WTI Crude Oil → Binance CLUSDT ($665M+/24h)
  UKO: "BZ",       // Brent Crude Oil → Binance BZUSDT ($478M+/24h)
  GOOG: "GOOGL",   // Alphabet Class C display ticker → Binance GOOGLUSDT ($168M+/24h)
};

/** Terminal symbol → Binance base asset symbol (e.g. "USO" -> "CL", "NVDA" -> "NVDA"). */
export function resolveBinSym(sym: string): string {
  const up = sym.trim().toUpperCase().replace(/USDT$/, "");
  return BINANCE_SYM_ALIASES[up] ?? up;
}

/** Terminal symbol → full Binance USDT-M contract pair (e.g. "USO" -> "CLUSDT"). */
export function resolveBinPair(sym: string): string {
  return `${resolveBinSym(sym)}USDT`;
}

/**
 * Priority Binance USDT-M pairs streamed continuously via explicit per-symbol
 * `<pair>@bookTicker` subscriptions (unthrottled sub-100ms updates).
 *
 * Kept comfortably under Binance's 200-streams-per-socket cap (~58 pairs):
 * 30 Crucial Crypto + 3 Core Metals + Key Binance TradFi Stocks/ETFs/Commodities.
 */
export const PRIORITY_BINANCE_PAIRS: readonly string[] = [
  // Fast + Core 30 Crypto + 3 Metals
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT", "SUIUSDT", "HYPEUSDT",
  "ADAUSDT", "AVAXUSDT", "LINKUSDT", "LTCUSDT", "BCHUSDT", "XLMUSDT", "XMRUSDT", "ZECUSDT",
  "NEARUSDT", "1000PEPEUSDT", "UNIUSDT", "AAVEUSDT", "ENAUSDT", "TAOUSDT", "INJUSDT", "ARBUSDT",
  "OPUSDT", "APTUSDT", "ONDOUSDT", "WLDUSDT", "TRXUSDT", "ZROUSDT",
  "XAUUSDT", "XAGUSDT", "XPTUSDT",
  // Top Binance TRADIFI_PERPETUAL Equities, ETFs, and Energy
  "NVDAUSDT", "MUUSDT", "SNDKUSDT", "SOXLUSDT", "SOXSUSDT", "TSLAUSDT",
  "AAPLUSDT", "MSFTUSDT", "AMZNUSDT", "METAUSDT", "GOOGLUSDT", "AMDUSDT",
  "INTCUSDT", "MSTRUSDT", "COINUSDT", "CRCLUSDT", "NBISUSDT", "AVGOUSDT",
  "TSMUSDT", "PLTRUSDT", "HOODUSDT", "CLUSDT", "BZUSDT", "NATGASUSDT",
  "SPYUSDT", "QQQUSDT", "COPPERUSDT",
];

/** Canonical Hyperliquid xyz coin overrides for indices without 1:1 Binance futures scale.
 *  All entries verified live 2026-11-12 via POST api.hyperliquid.xyz/info
 *  {"type":"metaAndAssetCtxs","dex":"xyz"} (144-market universe) — the QB
 *  additions (GOOGL, CL, SPCX, SKHY, NFLX, DRAM, KORU) included. NOTE: this map
 *  is xyz-ONLY on purpose — main-dex coins (BTC, ETH, kPEPE…) live in
 *  MICRO_MAP with dex:"main" and must NOT be routed through the xyz snapshot. */
export const HL_XYZ_MAP: Record<string, string> = {
  SPX500: "xyz:SP500",
  SP500: "xyz:SP500",
  NDX100: "xyz:XYZ100",
  JP225: "xyz:JP225",
  USO: "xyz:CL",
  CL: "xyz:CL",
  UKO: "xyz:BRENTOIL",
  NATGAS: "xyz:NATGAS",
  XAU: "xyz:GOLD",
  XAG: "xyz:SILVER",
  XPT: "xyz:PLATINUM",
  AAPL: "xyz:AAPL",
  AMZN: "xyz:AMZN",
  GOOG: "xyz:GOOGL",
  GOOGL: "xyz:GOOGL",
  MSFT: "xyz:MSFT",
  NVDA: "xyz:NVDA",
  TSLA: "xyz:TSLA",
  AMD: "xyz:AMD",
  META: "xyz:META",
  INTC: "xyz:INTC",
  MU: "xyz:MU",
  SNDK: "xyz:SNDK",
  CRCL: "xyz:CRCL",
  MSTR: "xyz:MSTR",
  NBIS: "xyz:NBIS",
  COIN: "xyz:COIN",
  AVGO: "xyz:AVGO",
  TSM: "xyz:TSM",
  SOXL: "xyz:SOXL",
  SPCX: "xyz:SPCX",
  SKHY: "xyz:SKHY",
  NFLX: "xyz:NFLX",
  DRAM: "xyz:DRAM",
  KORU: "xyz:KORU",
};

export function hlCoinOf(sym: string): string | undefined {
  return HL_XYZ_MAP[sym.trim().toUpperCase()];
}

/**
 * Canonical symbol for Coinglass / Binance perp lookups.
 * Maps broker aliases like USO -> CL, UKO -> BZ, GOOG -> GOOGL so upstream
 * Coinglass queries never hit unrelated ETF tickers (e.g. OKX USO-USDT-SWAP).
 */
export function resolveCgSym(sym: string): string {
  return resolveBinSym(sym);
}
