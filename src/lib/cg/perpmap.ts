/**
 * Perp-map — verified derivatives coverage for classic (Tier-3) instruments.
 *
 * LIVE-VERIFIED 2026-11-11 (scripts/probe_cg_venue_keys.py +
 * probe_cg_engine_surface.py + CFTC/CNBC probes; user screenshot discovery:
 * coinglass.com lists index perps — tradeXYZ SP500-USD $463M vol):
 *   - Coinglass carries REAL perp markets for SP500 / JP225 / WTI(CL) /
 *     Brent / NatGas (+ tradeXYZ GOLD/SILVER/PLATINUM as extra venues for
 *     XAU/XAG/XPT).
 *   - Surface per instrument: price klines ✓ everywhere; OI klines ✓;
 *     order_flow buckets only on Binance/Bybit/Bitget venues (NOT tradeXYZ);
 *     funding only where fundingRate/v2/home carries a rate (CL, NATGAS,
 *     JP225-OKX, XAU/XAG/XPT — SP500/GOLD/BRENTOIL have empty margin lists).
 *   - Liquidation levels / large-taker orders / heatmap walls: NOT available
 *     for any of these (empty) — honest n/a in every consumer.
 *
 * TRAPS (probed and EXCLUDED — wrong-instrument data is worse than no data):
 *   - "SPX" on Binance/OKX/Bybit @ ~$0.37 = SPX6900 memecoin, NOT the S&P 500
 *   - Bitget "ASXUSDT" @ ~36.89 = wrong instrument (ASX200 ≈ 8,000+)
 *   - OKX "USO-USDT-SWAP" @ ~$141 = United States Oil Fund ETF (DIR-0009),
 *     +63% off broker USOUSD WTI — WTI rides the CL instruments below.
 */

export interface PerpVenue {
  id: string;          // venue label for display
  key: string;         // Coinglass instrument key
  lead?: boolean;      // price/volume lead
  flow?: boolean;      // order_flow buckets verified on this venue
}

export interface PerpMapEntry {
  venues: PerpVenue[];
  /** Coinglass fundingRate/v2/home symbol (funding aggregation) */
  fundingSym?: string;
  /** CFTC COT legacy futures-only contract code (verified live) */
  cot?: { code: string; contract: string };
  /** CNBC quote-webservice symbol (verified live) */
  cnbc?: string;
  /** liquidity verdict from the 2026-11-11 probe (contracts per 15m on lead) */
  liquidity: "real" | "thin";
  note?: string;
}

export const PERP_MAP: Record<string, PerpMapEntry> = {
  SP500: {
    venues: [
      { id: "tradeXYZ", key: "tradeXYZ_SP500-USD", lead: true },
      { id: "Bitget", key: "Bitget_SP500USDT_UMCBL" },
    ],
    cot: { code: "13874A", contract: "E-MINI S&P 500" },
    cnbc: ".SPX",
    liquidity: "real",
    note: "no funding/flow on tradeXYZ — OI+price+vol only",
  },
  // SPX500 = the FundedNext classic-registry name for the same S&P 500
  // coverage (review RV-ARCH B3: the classic UI/deepscan send SPX500, not
  // SP500 — without this alias every derivatives panel was silently dead).
  SPX500: {
    venues: [
      { id: "tradeXYZ", key: "tradeXYZ_SP500-USD", lead: true },
      { id: "Bitget", key: "Bitget_SP500USDT_UMCBL" },
    ],
    cot: { code: "13874A", contract: "E-MINI S&P 500" },
    cnbc: ".SPX",
    liquidity: "real",
    note: "alias of SP500 (Coinglass naming) for the classic registry's SPX500",
  },
  NDX100: {
    venues: [{ id: "Bitget", key: "Bitget_NDX100USDT_UMCBL", lead: true }],
    cot: { code: "20974+", contract: "NASDAQ-100 Consolidated" },
    cnbc: ".NDX",
    liquidity: "thin",
    note: "Bitget only, ~0 contracts/15m at probe time",
  },
  US2000: {
    venues: [],
    cot: { code: "239742", contract: "RUSSELL E-MINI" },
    liquidity: "thin",
    note: "no perp venues found — COT only",
  },
  JP225: {
    venues: [
      { id: "tradeXYZ", key: "tradeXYZ_JP225-USD", lead: true },
      { id: "Bitget", key: "Bitget_JP225USDT_UMCBL" },
      { id: "OKX", key: "OKX_JP225-USDT-SWAP" },
    ],
    fundingSym: "JP225",
    cot: { code: "240743", contract: "NIKKEI STOCK AVERAGE YEN DENOM" },
    liquidity: "real",
    note: "OKX funding 0.0%/8h at probe",
  },
  HK50: {
    venues: [{ id: "Bitget", key: "Bitget_HSIUSDT_UMCBL", lead: true }],
    liquidity: "thin",
    note: "Bitget HSI, ~0 contracts/15m at probe",
  },
  USO: {
    venues: [
      { id: "Binance", key: "Binance_CLUSDT", lead: true, flow: true },
      { id: "OKX", key: "OKX_CL-USDT-SWAP" },
      { id: "Bybit", key: "Bybit_CLUSDT", flow: true },
      { id: "Bitget", key: "Bitget_CLUSDT_UMCBL" },
    ],
    fundingSym: "CL",
    cot: { code: "067651", contract: "WTI-PHYSICAL" },
    cnbc: "@CL.1",
    liquidity: "real",
    note: "the REAL WTI perp market (Binance 11.3M vol/15m, OI 1.77M ≈ COT) — replaced the OKX USO-ETF trap 2026-11-11",
  },
  UKO: {
    venues: [{ id: "tradeXYZ", key: "tradeXYZ_BRENTOIL-USD", lead: true }],
    cot: { code: "06765T", contract: "BRENT LAST DAY" },
    cnbc: "@BZ.1",
    liquidity: "real",
    note: "565k contracts/15m on tradeXYZ at probe",
  },
  NATGAS: {
    venues: [
      { id: "Binance", key: "Binance_NATGASUSDT", lead: true, flow: true },
      { id: "Bitget", key: "Bitget_NATGASUSDT_UMCBL" },
      { id: "tradeXYZ", key: "tradeXYZ_NATGAS-USD" },
    ],
    fundingSym: "NATGAS",
    cnbc: "@NG.1",
    liquidity: "real",
    note: "not listed at FundedNext — watchlist only, no execution path",
  },
  XAU: {
    venues: [{ id: "tradeXYZ", key: "tradeXYZ_GOLD-USD" }],
    fundingSym: "XAU",
    cot: { code: "088691", contract: "GOLD" },
    cnbc: "@GC.1",
    liquidity: "real",
    note: "extra venue ON TOP of the perp registry (Binance/OKX lead there); this map serves the classic view",
  },
  XAG: {
    venues: [{ id: "tradeXYZ", key: "tradeXYZ_SILVER-USD" }],
    fundingSym: "XAG",
    cot: { code: "084691", contract: "SILVER" },
    cnbc: "@SI.1",
    liquidity: "real",
    note: "extra venue on top of the perp registry",
  },
  XPT: {
    venues: [{ id: "tradeXYZ", key: "tradeXYZ_PLATINUM-USD" }],
    fundingSym: "XPT",
    cot: { code: "076651", contract: "PLATINUM" },
    cnbc: "@PL.1",
    liquidity: "thin",
    note: "tradeXYZ platinum was 0 vol at probe — venue table still serves OI",
  },
};

export function perpMapOf(sym: string): PerpMapEntry | undefined {
  return PERP_MAP[sym.toUpperCase()];
}

/** Classic instruments that have at least one verified perp venue. */
export const CLASSIC_PERP_SYMS = Object.entries(PERP_MAP)
  .filter(([, v]) => v.venues.length > 0)
  .map(([k]) => k);
