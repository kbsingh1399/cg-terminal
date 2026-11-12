import { fapiFetch } from "@/lib/live/fapi";
import { resolveBinSym } from "./aliases";

/**
 * Binance top-liquidity universe — Tier-2 of the terminal.
 *
 * User directive 2026-11-11: "integrate top 200 most liquid assets from
 * binance in our terminal". Source of truth is the Binance USDT-M futures
 * market itself (the same venue that leads every Coinglass aggregate and
 * the browser live feed): every USDT perpetual with status TRADING, ranked
 * by rolling 24h quote volume, top N (default 200).
 *
 * This tier is Binance-NATIVE (public market data, no API key, no
 * Coinglass dependency):
 *   - universe refresh  : /fapi/v1/exchangeInfo (weight 1) +
 *                         /fapi/v1/ticker/24hr (weight 40) every 4h
 *   - grid quotes       : /fapi/v1/ticker/bookTicker all-symbols (weight 10,
 *                         5s TTL) — REST fallback for browsers that cannot
 *                         hold the fstream WebSocket
 *   - per-symbol realtime: browser WS (fstream) — depth20/kline/trades are
 *                         handled client-side, not here.
 *
 * Registry assets (src/lib/cg/assets.ts) that also rank in the top-N keep
 * their Tier-1 identity (full order-flow toolset); the UI dedupes them from
 * this list. priceDecs/qtyDecs are derived from the live PRICE_FILTER
 * tickSize / LOT_SIZE stepSize so every rendered price and demo order
 * respects the exchange's own precision.
 *
 * Failure semantics (mirror the cg client): errors keep the last good list
 * serving (marked), with a 30s retry backoff so a down/banned upstream can
 * never be hammered by a hot poller.
 */

export interface BinAsset {
  /** terminal symbol = base asset, e.g. "1000PEPE" or "NVDA" */
  sym: string;
  /** full Binance pair, e.g. "1000PEPEUSDT" or "NVDAUSDT" */
  pair: string;
  /** 1..N by 24h quote volume */
  rank: number;
  quoteVol24h: number;
  priceDecs: number;
  qtyDecs: number;
  onboard: number;
  contractType: string;     // "PERPETUAL" | "TRADIFI_PERPETUAL"
  underlyingType: string;   // "COIN" | "EQUITY" | "COMMODITY" | "INDEX" | "PREMARKET" | ...
}

export interface UniverseState {
  state: "boot" | "ready" | "error";
  at: number;
  n: number;
  scannedPairs?: number;
  err?: string;
}

const DEFAULT_N = 250;
const MAX_N = 500;
const MIN_N = 10;
const MAX_AGE_MS = 4 * 60 * 60 * 1000;
const ERROR_BACKOFF_MS = 30_000;
const QUOTES_TTL_MS = 5_000;

interface UState {
  assets: BinAsset[];
  bySym: Map<string, BinAsset>;
  byPair: Map<string, BinAsset>;
  allBySym: Map<string, BinAsset>;
  allByPair: Map<string, BinAsset>;
  st: UniverseState;
  lastAttempt: number;
  refreshing: Promise<void> | null;
  quotesAt: number;
  quotes: Map<string, BinQuote> | null;
  quotesErr?: string;
  quotesInflight: Promise<void> | null;
}

const g = globalThis as unknown as { __binUniverse?: UState };
const S: UState = (g.__binUniverse ??= {
  assets: [],
  bySym: new Map(),
  byPair: new Map(),
  allBySym: new Map(),
  allByPair: new Map(),
  st: { state: "boot", at: 0, n: 0 },
  lastAttempt: 0,
  refreshing: null,
  quotesAt: 0,
  quotes: null,
  quotesInflight: null,
});

export interface BinQuote {
  last: number;
  bid: number;
  ask: number;
}

export function universeTarget(): number {
  const n = Number(process.env.BIN_UNIVERSE_N ?? DEFAULT_N) || DEFAULT_N;
  return Math.min(MAX_N, Math.max(MIN_N, Math.floor(n)));
}

/** "0.00010000" → 4 decimals (trailing zeros trimmed before counting). */
function decsFromStep(step: string | undefined): number {
  const s = (step ?? "0.01").toString().trim();
  const dot = s.indexOf(".");
  if (dot < 0) return 0;
  let end = s.length;
  while (end > dot + 1 && s[end - 1] === "0") end--;
  return end - dot - 1;
}

async function refresh(): Promise<void> {
  S.lastAttempt = Date.now();
  try {
    const [infoRes, tickRes] = await Promise.all([
      fapiFetch("/fapi/v1/exchangeInfo", 15_000),
      fapiFetch("/fapi/v1/ticker/24hr", 15_000),
    ]);
    const info = infoRes as {
      symbols?: {
        symbol: string;
        status: string;
        contractType?: string;
        underlyingType?: string;
        quoteAsset?: string;
        onboardDate?: number;
        filters?: { filterType: string; tickSize?: string; stepSize?: string }[];
      }[];
    };
    const perps = new Map<
      string,
      { priceDecs: number; qtyDecs: number; onboard: number; contractType: string; underlyingType: string }
    >();
    for (const s of info.symbols ?? []) {
      if (s.status !== "TRADING") continue;
      if (s.contractType !== "PERPETUAL" && s.contractType !== "TRADIFI_PERPETUAL") continue;
      if (s.underlyingType === "FX") continue; // no forex contracts
      if (s.quoteAsset !== "USDT" || s.symbol.includes("_")) continue; // no delivery contracts
      const pf = (s.filters ?? []).find((f) => f.filterType === "PRICE_FILTER");
      const ls = (s.filters ?? []).find((f) => f.filterType === "LOT_SIZE");
      perps.set(s.symbol, {
        priceDecs: decsFromStep(pf?.tickSize),
        qtyDecs: decsFromStep(ls?.stepSize),
        onboard: s.onboardDate ?? 0,
        contractType: s.contractType,
        underlyingType: s.underlyingType ?? "COIN",
      });
    }
    const tickers = tickRes as { symbol: string; quoteVolume: string }[];
    if (!Array.isArray(tickers) || tickers.length === 0) throw new Error("ticker/24hr returned no rows");
    const rankedAll = tickers
      .filter((t) => perps.has(t.symbol))
      .map((t) => ({ pair: t.symbol, vol: Number(t.quoteVolume) || 0 }))
      .sort((a, b) => b.vol - a.vol);
    if (rankedAll.length === 0) throw new Error("no TRADING USDT perpetuals matched");
    const fullList: BinAsset[] = rankedAll.map((r, i) => ({
      sym: r.pair.replace(/USDT$/, ""),
      pair: r.pair,
      rank: i + 1,
      quoteVol24h: r.vol,
      ...perps.get(r.pair)!,
    }));
    S.allBySym = new Map(fullList.map((a) => [a.sym, a]));
    S.allByPair = new Map(fullList.map((a) => [a.pair, a]));
    S.assets = fullList.slice(0, universeTarget());
    S.bySym = new Map(S.assets.map((a) => [a.sym, a]));
    S.byPair = new Map(S.assets.map((a) => [a.pair, a]));
    S.st = { state: "ready", at: Date.now(), n: S.assets.length, scannedPairs: tickers.length };
  } catch (err) {
    // keep the last good list serving — the state marks it
    S.st = {
      state: "error",
      at: Date.now(),
      n: S.assets.length,
      err: err instanceof Error ? err.message : "refresh failed",
    };
  }
}

async function ensureRefreshing(): Promise<void> {
  if (!S.refreshing) {
    S.refreshing = refresh().finally(() => {
      S.refreshing = null;
    });
  }
  await S.refreshing;
}

/**
 * Cached universe state. Boot: blocks on the first refresh (a cold boot
 * costs one exchangeInfo + one 24hr call, ~1-2s). Ready: serves instantly,
 * kicks a background re-rank when older than 4h. Error: keeps serving the
 * last good list and retries at most once per 30s.
 */
export async function getUniverse(): Promise<UniverseState> {
  const now = Date.now();
  if (S.st.state === "boot" || (S.assets.length === 0 && now - S.lastAttempt >= ERROR_BACKOFF_MS)) {
    await ensureRefreshing();
  } else if (
    S.st.state === "ready" &&
    now - S.st.at > MAX_AGE_MS &&
    !S.refreshing
  ) {
    void ensureRefreshing(); // background re-rank — stale list keeps serving
  } else if (S.st.state === "error" && now - S.lastAttempt >= ERROR_BACKOFF_MS && !S.refreshing) {
    void ensureRefreshing();
  }
  return { ...S.st, n: S.assets.length };
}

/** Membership test (sync) — only meaningful after a getUniverse() await. */
export function isBinanceSym(sym: string): boolean {
  const s = resolveBinSym(sym);
  return (S.allBySym?.size ?? 0) > 0 ? S.allBySym.has(s) : S.bySym.has(s);
}

export function binAssetOf(sym: string): BinAsset | undefined {
  const s = resolveBinSym(sym);
  return S.bySym.get(s) ?? S.allBySym?.get(s);
}

export function binAssets(): readonly BinAsset[] {
  return S.assets;
}

/**
 * Grid quotes — all-universe bid/ask/last from one weight-10 call,
 * 5s shared TTL, in-flight coalescing, stale-serve on upstream error.
 */
export async function getQuotes(): Promise<{ at: number; quotes: Record<string, BinQuote>; err?: string }> {
  const now = Date.now();
  if (S.quotes && now - S.quotesAt < QUOTES_TTL_MS) {
    return { at: S.quotesAt, quotes: Object.fromEntries(S.quotes) };
  }
  if (!S.quotesInflight) {
    S.quotesInflight = (async () => {
      try {
        const arr = (await fapiFetch("/fapi/v1/ticker/bookTicker", 8_000)) as {
          symbol: string;
          bidPrice: string;
          askPrice: string;
        }[];
        const m = new Map<string, BinQuote>();
        const pairMap = (S.allByPair?.size ?? 0) > 0 ? S.allByPair : S.byPair;
        for (const t of arr) {
          const a = pairMap.get(t.symbol);
          if (!a) continue;
          const bid = Number(t.bidPrice);
          const ask = Number(t.askPrice);
          if (!(bid > 0 && ask > 0)) continue;
          m.set(a.sym, { last: (bid + ask) / 2, bid, ask });
        }
        if (m.size > 0) {
          S.quotes = m;
          S.quotesAt = Date.now();
          S.quotesErr = undefined;
        }
      } catch (err) {
        S.quotesErr = err instanceof Error ? err.message : "fetch failed";
      } finally {
        S.quotesInflight = null;
      }
    })();
  }
  await S.quotesInflight;
  if (S.quotes) {
    return { at: S.quotesAt, quotes: Object.fromEntries(S.quotes), ...(S.quotesErr ? { err: S.quotesErr } : {}) };
  }
  return { at: 0, quotes: {}, err: S.quotesErr ?? "no quotes yet" };
}
