/**
 * Classic (Tier-3) instrument registry — the 83 FundedNext-listed instruments
 * with NO crypto-perp data anywhere: 14 indices · 48 FX · 19 equities · UKO + USO.
 *
 * 2026-11-11 (DIR-0009 symbols-dump reconciliation): +5 MT5 FX pairs missing
 * from the first pass (EURHUF MXNJPY NOKJPY USDHKD ZARJPY) → FX 43→48, full
 * broker coverage. USO moved here from the perp registry: OKX USO-USDT-SWAP
 * tracks the United States Oil Fund ETF (~$141), NOT WTI (~$86) — a +63%
 * underlying mismatch vs broker USOUSD; WTI is served by Yahoo CL=F instead.
 *
 * Market-data path: Yahoo Finance chart API (v8) — live-verified 2026-11-11
 * (scripts/probe_t3_universe.py): every ticker below returned HTTP 200 with
 * fresh quotes; intraday depth 1m/5m/15m/1h/1d and 1y history. Volume exists
 * on equities, US cash indices (US30/SPX500/NDX100) and commodity futures;
 * FX, VIX and the EU/Asian cash indices are price-only (no volume upstream —
 * reports print price-only session stats, never fake volume).
 *
 * These instruments NEVER enter the perp registry (src/lib/cg/assets.ts):
 * the Coinglass engine (funding/OI/liquidations/CVD/walls) has no data for
 * them, and the background scanner must not poll dead endpoints. They are
 * served by /api/cg/classic (quote + OHLCV proxy) and the deepscan prints
 * them with an honest reduced scorecard (watchlist-only).
 */

export type ClassicKlass = "index" | "fx" | "equity" | "commodity";

export interface ClassicCfg {
  sym: string;        // desk symbol (FundedNext naming)
  name: string;
  klass: ClassicKlass;
  broker: string | null; // FundedNext MT5 ticker (null = not listed at broker, watchlist only)
  yahoo: string;      // Yahoo chart API ticker
  volume: boolean;    // live-verified: bars carry volume?
  /** Yahoo FUTURES lead ticker (24/5 Globex hours, ~10min-delayed feed) for
   *  indices with NO micro-layer anchor: Yahoo cash indices freeze outside
   *  their cash session (US cash = 19.5h/day frozen) while broker CFDs keep
   *  quoting — the futures chain is what the CFD tracks, so it is the honest
   *  headline when cash is closed. Micro-mapped instruments (SPX500, NDX100,
   *  JP225, USO, UKO, NATGAS, FX majors, big equities) use the 24/7 R4 live
   *  anchor instead (see microLiveQuote) and need no futYahoo. */
  futYahoo?: string;
  note?: string;
}

function fx(sym: string): ClassicCfg {
  return { sym, name: `${sym.slice(0, 3)}/${sym.slice(3)}`, klass: "fx", broker: sym, yahoo: `${sym}=X`, volume: false };
}

function eq(sym: string, name: string, yahoo: string, note?: string): ClassicCfg {
  return { sym, name, klass: "equity", broker: sym, yahoo, volume: true, note };
}

export const CLASSIC_ASSETS: ClassicCfg[] = [
  // ---- indices (14 · user broker audit incl. VIX, which the FN site omits) ----
  // Live-quote ladder per instrument (2026-11-11 stale-values fix):
  //   micro anchor (24/7, seconds-fresh) → futYahoo (24/5, ~10m delayed) → cash (session-bound).
  // US30 + US2000 have no micro-mapped perp, so they ride Yahoo futures leads.
  { sym: "US30", name: "Dow Jones 30", klass: "index", broker: "US30", yahoo: "^DJI", volume: true, futYahoo: "YM=F" },
  { sym: "SPX500", name: "S&P 500", klass: "index", broker: "SPX500", yahoo: "^GSPC", volume: true },
  { sym: "NDX100", name: "Nasdaq 100", klass: "index", broker: "NDX100", yahoo: "^NDX", volume: true },
  { sym: "US2000", name: "Russell 2000", klass: "index", broker: "US2000", yahoo: "^RUT", volume: false, futYahoo: "RTY=F" },
  { sym: "VIX", name: "CBOE Volatility Index", klass: "index", broker: "VIX", yahoo: "^VIX", volume: false, note: "cash VIX is price-only; VIX futures not on Yahoo" },
  { sym: "GER30", name: "DAX 40", klass: "index", broker: "GER30", yahoo: "^GDAXI", volume: false },
  { sym: "UK100", name: "FTSE 100", klass: "index", broker: "UK100", yahoo: "^FTSE", volume: false },
  { sym: "FRA40", name: "CAC 40", klass: "index", broker: "FRA40", yahoo: "^FCHI", volume: false },
  { sym: "EUSTX50", name: "Euro Stoxx 50", klass: "index", broker: "EUSTX50", yahoo: "^STOXX50E", volume: false },
  { sym: "SWI20", name: "SMI", klass: "index", broker: "SWI20", yahoo: "^SSMI", volume: false },
  { sym: "NTH25", name: "AEX", klass: "index", broker: "NTH25", yahoo: "^AEX", volume: false },
  { sym: "JP225", name: "Nikkei 225", klass: "index", broker: "JP225", yahoo: "^N225", volume: false },
  { sym: "HK50", name: "Hang Seng", klass: "index", broker: "HK50", yahoo: "^HSI", volume: false },
  { sym: "AUS200", name: "ASX 200", klass: "index", broker: "AUS200", yahoo: "^AXJO", volume: false },
  // ---- commodities with no perp data (2 · WTI + Brent) ----
  { sym: "UKO", name: "Brent Crude", klass: "commodity", broker: "UKOUSD", yahoo: "BZ=F", volume: true, note: "zero Coinglass perp data — Yahoo Brent futures are the reference market" },
  { sym: "USO", name: "WTI Crude Oil", klass: "commodity", broker: "USOUSD", yahoo: "CL=F", volume: true, note: "MOVED from perp registry 2026-11-11 (DIR-0009): OKX USO-USDT-SWAP is the USO ETF (+63% mismatch) — WTI rides Yahoo CL=F; real WTI perp depth (Binance CLUSDT etc.) via /api/cg/perpdepth" },
  { sym: "NATGAS", name: "Natural Gas (Henry Hub)", klass: "commodity", broker: null, yahoo: "NG=F", volume: true, note: "added 2026-11-11: 3-venue perp market (Binance/Bitget/tradeXYZ) with funding+flow — NOT listed at FundedNext (watchlist only, no execution)" },
  // ---- forex (48 · full MT5 broker coverage after DIR-0009 reconciliation) ----
  fx("EURUSD"), fx("GBPUSD"), fx("USDJPY"), fx("USDCHF"), fx("AUDUSD"), fx("USDCAD"),
  fx("NZDUSD"), fx("EURGBP"), fx("EURJPY"), fx("EURCHF"), fx("EURAUD"), fx("EURCAD"),
  fx("EURNZD"), fx("EURHKD"), fx("EURNOK"), fx("EURSGD"), fx("GBPJPY"), fx("GBPCHF"),
  fx("GBPAUD"), fx("GBPCAD"), fx("GBPNZD"), fx("GBPSGD"), fx("AUDJPY"), fx("AUDNZD"),
  fx("AUDCAD"), fx("AUDCHF"), fx("AUDSGD"), fx("CADJPY"), fx("CADCHF"), fx("CHFJPY"),
  fx("NZDJPY"), fx("NZDCAD"), fx("NZDCHF"), fx("NZDSGD"), fx("SGDJPY"), fx("USDCNH"),
  fx("USDDKK"), fx("USDHUF"), fx("USDMXN"), fx("USDNOK"), fx("USDSEK"), fx("USDSGD"),
  fx("USDZAR"),
  fx("EURHUF"),
  fx("MXNJPY"),
  fx("NOKJPY"),
  fx("USDHKD"),
  fx("ZARJPY"),
  // ---- equities (19 scanned · FN help-centre lists 20 incl. SPCX — REMOVED 2026-11-11:
  // Yahoo "SPCX" is Tuttle's SPAC/New-Issue ETF, a different instrument entirely;
  // wrong-instrument data is worse than no data. Restore only after the FN
  // contract spec is verified against the broker symbol dump (DIR-0009). ----
  eq("AAPL", "Apple", "AAPL"),
  eq("AMZN", "Amazon", "AMZN"),
  eq("GOOG", "Alphabet", "GOOG"),
  eq("MSFT", "Microsoft", "MSFT"),
  eq("NVDA", "Nvidia", "NVDA"),
  eq("TSLA", "Tesla", "TSLA"),
  eq("AMD", "AMD", "AMD"),
  eq("META", "Meta", "META"),
  eq("BABA", "Alibaba", "BABA"),
  eq("NFLX", "Netflix", "NFLX"),
  eq("INTC", "Intel", "INTC"),
  eq("NKE", "Nike", "NKE"),
  eq("KO", "Coca-Cola", "KO"),
  eq("MBG", "Mercedes-Benz", "MBG.DE"),
  eq("BAYN", "Bayer", "BAYN.DE"),
  eq("MC", "LVMH", "MC.PA"),
  eq("VOW3", "Volkswagen Vz.", "VOW3.DE"),
  eq("ADS", "Adidas", "ADS.DE"),
  eq("BMW", "BMW", "BMW.DE"),
];

const bySym = new Map(CLASSIC_ASSETS.map((a) => [a.sym, a]));

export const CLASSIC_SYMS = CLASSIC_ASSETS.map((a) => a.sym);

export function classicOf(sym: string): ClassicCfg | undefined {
  return bySym.get(sym.toUpperCase());
}

export function isClassic(sym: string): boolean {
  return bySym.has(sym.toUpperCase());
}

/** Count per class — used by /api/cg/classic?list=1 and the desk digest. */
export function classicCounts(): Record<string, number> {
  const c: Record<string, number> = { index: 0, fx: 0, equity: 0, commodity: 0 };
  for (const a of CLASSIC_ASSETS) c[a.klass] += 1;
  return c;
}
