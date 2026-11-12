/**
 * Classic (Tier-3) instrument registry — TradFi indices, commodities, and equities
 * served by /api/cg/classic (+ Binance TRADIFI_PERPETUAL / Hyperliquid xyz live feeds).
 */
import { resolveBinPair } from "../binance/aliases";

export type ClassicKlass = "index" | "equity" | "commodity";

export interface ClassicCfg {
  sym: string;        // desk symbol (FundedNext naming)
  name: string;
  klass: ClassicKlass;
  broker: string | null; // FundedNext MT5 ticker (null = not listed at broker, watchlist only)
  yahoo: string;      // Yahoo chart API ticker
  binPair?: string;   // Binance fapi TRADIFI_PERPETUAL pair (e.g. NVDAUSDT, CLUSDT) when listed
  volume: boolean;    // live-verified: bars carry volume?
  /** Highlighted in Curated TradFi Core views (high-OI/macro benchmarks & leaders). */
  tradfiCore?: boolean;
  /** Yahoo FUTURES lead ticker (24/5 Globex hours, ~10min-delayed feed) for
   *  indices with NO micro-layer anchor: Yahoo cash indices freeze outside
   *  their cash session (US cash = 19.5h/day frozen) while broker CFDs keep
   *  quoting — the futures chain is what the CFD tracks, so it is the honest
   *  headline when cash is closed. Micro-mapped instruments (SPX500, NDX100,
   *  JP225, USO, UKO, NATGAS, big equities) use the 24/7 live WS/micro
   *  anchor instead and need no futYahoo. */
  futYahoo?: string;
  note?: string;
}

function eq(
  sym: string,
  name: string,
  yahoo: string,
  note?: string,
  opts?: { broker?: string | null; tradfiCore?: boolean; binPair?: string | false }
): ClassicCfg {
  const binPair = opts?.binPair === false ? undefined : (opts?.binPair ?? resolveBinPair(sym));
  return {
    sym,
    name,
    klass: "equity",
    broker: opts && "broker" in opts ? opts.broker ?? null : sym,
    yahoo,
    ...(binPair ? { binPair } : {}),
    volume: true,
    tradfiCore: opts?.tradfiCore,
    note,
  };
}

export const CLASSIC_ASSETS: ClassicCfg[] = [
  // ---- indices (14 · user broker audit incl. VIX, which the FN site omits) ----
  // Live-quote ladder per instrument (2026-11-11 stale-values fix):
  //   micro anchor (24/7, seconds-fresh) → futYahoo (24/5, ~10m delayed) → cash (session-bound).
  // US30 + US2000 have no micro-mapped perp, so they ride Yahoo futures leads.
  { sym: "US30", name: "Dow Jones 30", klass: "index", broker: "US30", yahoo: "^DJI", volume: true, tradfiCore: true, futYahoo: "YM=F" },
  { sym: "SPX500", name: "S&P 500", klass: "index", broker: "SPX500", yahoo: "^GSPC", volume: true, tradfiCore: true },
  { sym: "NDX100", name: "Nasdaq 100", klass: "index", broker: "NDX100", yahoo: "^NDX", volume: true, tradfiCore: true },
  { sym: "US2000", name: "Russell 2000", klass: "index", broker: "US2000", yahoo: "^RUT", volume: false, futYahoo: "RTY=F" },
  { sym: "VIX", name: "CBOE Volatility Index", klass: "index", broker: "VIX", yahoo: "^VIX", volume: false, tradfiCore: true, note: "cash VIX is price-only; VIX futures not on Yahoo" },
  { sym: "GER30", name: "DAX 40", klass: "index", broker: "GER30", yahoo: "^GDAXI", volume: false, tradfiCore: true },
  { sym: "UK100", name: "FTSE 100", klass: "index", broker: "UK100", yahoo: "^FTSE", volume: false },
  { sym: "FRA40", name: "CAC 40", klass: "index", broker: "FRA40", yahoo: "^FCHI", volume: false },
  { sym: "EUSTX50", name: "Euro Stoxx 50", klass: "index", broker: "EUSTX50", yahoo: "^STOXX50E", volume: false },
  { sym: "SWI20", name: "SMI", klass: "index", broker: "SWI20", yahoo: "^SSMI", volume: false },
  { sym: "NTH25", name: "AEX", klass: "index", broker: "NTH25", yahoo: "^AEX", volume: false },
  { sym: "JP225", name: "Nikkei 225", klass: "index", broker: "JP225", yahoo: "^N225", volume: false, tradfiCore: true },
  { sym: "HK50", name: "Hang Seng", klass: "index", broker: "HK50", yahoo: "^HSI", volume: false },
  { sym: "AUS200", name: "ASX 200", klass: "index", broker: "AUS200", yahoo: "^AXJO", volume: false },
  // ---- commodities (Binance TRADIFI_PERPETUAL + Yahoo futures) ----
  { sym: "UKO", name: "Brent Crude", klass: "commodity", broker: "UKOUSD", yahoo: "BZ=F", binPair: "BZUSDT", volume: true, tradfiCore: true, note: "Binance BZUSDT live WS + Yahoo Brent futures" },
  { sym: "USO", name: "WTI Crude Oil", klass: "commodity", broker: "USOUSD", yahoo: "CL=F", binPair: "CLUSDT", volume: true, tradfiCore: true, note: "Binance CLUSDT (WTI Crude) live WS + Yahoo CL=F" },
  { sym: "NATGAS", name: "Natural Gas (Henry Hub)", klass: "commodity", broker: null, yahoo: "NG=F", binPair: "NATGASUSDT", volume: true, tradfiCore: true, note: "Binance NATGASUSDT live WS + HL xyz:NATGAS (watchlist only)" },
  // ---- equities ----
  eq("AAPL", "Apple", "AAPL", undefined, { tradfiCore: true }),
  eq("AMZN", "Amazon", "AMZN", undefined, { tradfiCore: true }),
  eq("GOOG", "Alphabet", "GOOG", undefined, { tradfiCore: true, binPair: "GOOGLUSDT" }),
  eq("MSFT", "Microsoft", "MSFT", undefined, { tradfiCore: true }),
  eq("NVDA", "Nvidia", "NVDA", undefined, { tradfiCore: true }),
  eq("TSLA", "Tesla", "TSLA", undefined, { tradfiCore: true }),
  eq("AMD", "AMD", "AMD", undefined, { tradfiCore: true }),
  eq("META", "Meta", "META", undefined, { tradfiCore: true }),
  eq("BABA", "Alibaba", "BABA"),
  eq("NFLX", "Netflix", "NFLX"),
  eq("INTC", "Intel", "INTC", undefined, { tradfiCore: true }),
  eq("NKE", "Nike", "NKE"),
  eq("KO", "Coca-Cola", "KO"),
  eq("MBG", "Mercedes-Benz", "MBG.DE", undefined, { binPair: false }),
  eq("BAYN", "Bayer", "BAYN.DE", undefined, { binPair: false }),
  eq("MC", "LVMH", "MC.PA", undefined, { binPair: false }),
  eq("VOW3", "Volkswagen Vz.", "VOW3.DE", undefined, { binPair: false }),
  eq("ADS", "Adidas", "ADS.DE", undefined, { binPair: false }),
  eq("BMW", "BMW", "BMW.DE", undefined, { binPair: false }),
  // ---- V2 Curated High-OI / High-Volume TradFi Equities & ETFs (signal/watchlist only, broker: null) ----
  eq("MU", "Micron Technology", "MU", "High-OI AI memory perp on HL xyz & Lighter — watchlist only (not MT5-listed)", { broker: null, tradfiCore: true }),
  eq("SNDK", "SanDisk Corp", "SNDK", "High-OI flash storage leader on HL xyz & Lighter — watchlist only", { broker: null, tradfiCore: true }),
  eq("CRCL", "Circle Internet", "CRCL", "Stablecoin equity perp on HL xyz & Lighter — watchlist only", { broker: null, tradfiCore: true }),
  eq("MSTR", "Strategy (MicroStrategy)", "MSTR", "BTC-beta corporate proxy on HL xyz & Lighter — watchlist only", { broker: null, tradfiCore: true }),
  eq("NBIS", "Nebius Group", "NBIS", "AI compute infra perp on HL xyz & Lighter — watchlist only", { broker: null, tradfiCore: true }),
  eq("COIN", "Coinbase Global", "COIN", "Crypto exchange proxy on HL xyz & Lighter — watchlist only", { broker: null, tradfiCore: true }),
  eq("AVGO", "Broadcom", "AVGO", "Custom AI silicon bellwether on HL xyz & Lighter — watchlist only", { broker: null, tradfiCore: true }),
  eq("TSM", "TSMC", "TSM", "Foundry leader on HL xyz & Lighter — watchlist only", { broker: null, tradfiCore: true }),
  eq("SOXL", "3x Semis Bull ETF", "SOXL", "Leveraged semiconductor gauge on HL xyz & Lighter — watchlist only", { broker: null, tradfiCore: true }),
  eq("SOXS", "3x Semis Bear ETF", "SOXS", "Inverse semiconductor gauge on Lighter L3 — watchlist only", { broker: null, tradfiCore: true }),
];

const bySym = new Map(CLASSIC_ASSETS.map((a) => [a.sym, a]));

export const CLASSIC_SYMS = CLASSIC_ASSETS.map((a) => a.sym);
export const TRADFI_CORE_ASSETS = CLASSIC_ASSETS.filter((a) => a.tradfiCore);

export function classicOf(sym: string): ClassicCfg | undefined {
  return bySym.get(sym.toUpperCase());
}

export function isClassic(sym: string): boolean {
  return bySym.has(sym.toUpperCase());
}

/** Count per class — used by /api/cg/classic?list=1 and the desk digest. */
export function classicCounts(): Record<string, number> {
  const c: Record<string, number> = { index: 0, equity: 0, commodity: 0 };
  for (const a of CLASSIC_ASSETS) c[a.klass] += 1;
  return c;
}
