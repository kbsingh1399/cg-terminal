import { fapiFetch } from "@/lib/live/fapi";
import { curatedPerps, type CuratedAsset } from "@/lib/universe/curated";
import { resolveBinSym } from "./aliases";

/**
 * CURATED Binance universe — the terminal's FIXED 58-perp membership.
 *
 * User directive 2026-11-12 ("no gaps"): the palette is a curated 61 (30
 * crypto perps + 28 TradFi perps + 3 classic). This module serves the 58
 * perps through the same exported interface the old dynamic top-200 used
 * (getUniverse / isBinanceSym / binAssetOf / binAssets / getQuotes), so
 * every existing route and component keeps working — membership is just no
 * longer dynamic. The canonical list lives in
 * src/lib/universe/curated.ts (DO NOT re-derive it here).
 *
 * Both Binance USDT-M contract types are members:
 *   - PERPETUAL           (crypto: BTCUSDT, SOLUSDT, 1000PEPEUSDT …)
 *   - TRADIFI_PERPETUAL   (TradFi plain names: NVDAUSDT, XAUUSDT, CLUSDT,
 *                          ANTHROPICUSDT … — real perps, verified TRADING)
 *
 * The live enrichment loop (exchangeInfo + ticker/24hr, every 4h) is kept
 * but only ENRICHES: priceDecs/qtyDecs from the live PRICE_FILTER tickSize /
 * LOT_SIZE stepSize (so demo orders respect the exchange's own precision),
 * quoteVol24h from the rolling 24h volume, and delisting detection — a
 * curated pair that is missing or not TRADING keeps its slot, flagged
 * state:"delisted", never silently dropped. Rank is the CURATED position,
 * not a volume rank (the palette order is editorial, not a leaderboard).
 *
 * Membership is STATIC (built from CURATED at module load), so isBinanceSym
 * / binAssetOf answer correctly even while the first enrichment is still in
 * flight or when fapi is down entirely (defaults serve, the state marks it).
 *
 * Failure semantics (mirror the cg client): errors keep the last good list
 * serving (marked), with a 30s retry backoff so a down/banned upstream can
 * never be hammered by a hot poller.
 */

export interface BinAsset {
  /** terminal symbol = base asset, e.g. "1000PEPE" or the TradFi plain name "NVDA" */
  sym: string;
  /** full Binance pair, e.g. "1000PEPEUSDT" / "NVDAUSDT" */
  pair: string;
  /** position in the CURATED order (1-based, fixed) */
  rank: number;
  /** rolling 24h quote volume (live; 0 until the first enrichment lands) */
  quoteVol24h: number;
  priceDecs: number;
  qtyDecs: number;
  onboard: number;
  /** curated metadata (static, from src/lib/universe/curated.ts) — present on
   *  the curated 58; the full-exchange all-index rows omit them */
  kind?: "crypto-perp" | "tradfi-perp";
  name?: string;
  category?: "Crypto" | "TradFi";
  /** sub-category label ("Semiconductors", "Metal", "Meme" …) */
  sub?: string;
  /** Binance SPOT B-token leg (NVDABUSDT) or XAUTUSDT for gold, if any */
  spotPair?: string;
  /** tradable on futures TESTNET (demo order execution) */
  punchable?: boolean;
  origin?: "user" | "fill";
  /** live exchange status from the enrichment loop */
  state: "trading" | "delisted" | "unverified";
  contractType?: string;     // "PERPETUAL" | "TRADIFI_PERPETUAL"
  underlyingType?: string;   // "COIN" | "EQUITY" | "COMMODITY" | "INDEX" | "PREMARKET" | ...
}

export interface UniverseState {
  state: "boot" | "ready" | "error";
  at: number;
  n: number;
  /** curated pairs currently missing/not-TRADING on fapi (flagged, not dropped) */
  delisted?: string[];
  err?: string;
}

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

/** static default display precision before the first enrichment lands
 * (enrichment replaces these with the exchange's own tick/step precision). */
function staticDefaults(c: CuratedAsset): { priceDecs: number; qtyDecs: number } {
  if (c.kind === "tradfi-perp") return { priceDecs: 2, qtyDecs: 2 };
  // sub-cent crypto majors keep a sane default; exchangeInfo corrects on boot
  if (c.sym === "1000PEPE" || c.sym === "1000SHIB" || c.sym === "VET" || c.sym === "XLM" || c.sym === "ADA")
    return { priceDecs: 6, qtyDecs: 0 };
  return { priceDecs: 2, qtyDecs: 3 };
}

function fromCurated(c: CuratedAsset, i: number, prev?: BinAsset): BinAsset {
  const d = staticDefaults(c);
  return {
    sym: c.sym,
    pair: c.pair ?? `${c.sym}USDT`,
    rank: i + 1,
    quoteVol24h: prev?.quoteVol24h ?? 0,
    priceDecs: prev?.priceDecs ?? d.priceDecs,
    qtyDecs: prev?.qtyDecs ?? d.qtyDecs,
    onboard: prev?.onboard ?? 0,
    kind: c.kind === "crypto-perp" ? "crypto-perp" : "tradfi-perp",
    name: c.name,
    category: c.category,
    sub: c.sub,
    ...(c.spotPair ? { spotPair: c.spotPair } : {}),
    punchable: c.punchable,
    origin: c.origin,
    state: prev?.state ?? "unverified",
  };
}

/** build the fixed membership ONCE from the canonical registry */
function staticAssets(prev?: Map<string, BinAsset>): BinAsset[] {
  return curatedPerps().map((c, i) => fromCurated(c, i, prev?.get(c.pair)));
}

const g = globalThis as unknown as { __binUniverse?: UState };
const S: UState = (g.__binUniverse ??= {
  assets: staticAssets(),
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
if (S.bySym.size === 0) {
  S.bySym = new Map(S.assets.map((a) => [a.sym, a]));
  S.byPair = new Map(S.assets.map((a) => [a.pair, a]));
  S.st = { state: "boot", at: 0, n: S.assets.length };
}

export interface BinQuote {
  last: number;
  bid: number;
  ask: number;
  /** 24h enrichment (quotes route, shared ticker/24hr batch) — optional
   *  fields: absent when the batch tier fails, present for the grid's
   *  chg/range/vol REST fallback columns. */
  chgPct?: number;
  high?: number;
  low?: number;
  quoteVol?: number;
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
    // BOTH perp families are members: crypto PERPETUAL + TradFi
    // TRADIFI_PERPETUAL (plain names — the old !== "PERPETUAL" filter is what
    // used to exclude NVDA/XAU/CL from every route).
    const perps = new Map<
      string,
      { status: string; priceDecs: number; qtyDecs: number; onboard: number; contractType?: string; underlyingType?: string }
    >();
    for (const s of info.symbols ?? []) {
      if (s.status !== "TRADING") continue;
      if (s.contractType !== "PERPETUAL" && s.contractType !== "TRADIFI_PERPETUAL") continue;
      if (s.underlyingType === "FX") continue; // no forex contracts
      if (s.quoteAsset !== "USDT" || s.symbol.includes("_")) continue; // no delivery contracts
      if (s.contractType !== "PERPETUAL" && s.contractType !== "TRADIFI_PERPETUAL") continue;
      const pf = (s.filters ?? []).find((f) => f.filterType === "PRICE_FILTER");
      const ls = (s.filters ?? []).find((f) => f.filterType === "LOT_SIZE");
      perps.set(s.symbol, {
        status: s.status,
        priceDecs: decsFromStep(pf?.tickSize),
        qtyDecs: decsFromStep(ls?.stepSize),
        onboard: s.onboardDate ?? 0,
        contractType: s.contractType,
        underlyingType: s.underlyingType ?? "COIN",
      });
    }
    const tickers = tickRes as { symbol: string; quoteVolume: string }[];
    if (!Array.isArray(tickers) || tickers.length === 0) throw new Error("ticker/24hr returned no rows");
    const vols = new Map<string, number>();
    for (const t of tickers) vols.set(t.symbol, Number(t.quoteVolume) || 0);

    // full TRADING-perp index (allBySym/allByPair) so isBinanceSym() answers
    // for EVERY live Binance perp — not just the curated 58 (feat-v2 idea).
    S.allBySym = new Map();
    S.allByPair = new Map();
    for (const [pair, meta] of perps) {
      const sym = pair.replace(/USDT$/, "");
      const entry: BinAsset = {
        sym,
        pair,
        rank: 0,
        quoteVol24h: vols.get(pair) ?? 0,
        priceDecs: meta.priceDecs,
        qtyDecs: meta.qtyDecs,
        onboard: meta.onboard,
        state: "trading",
        ...(meta.contractType ? { contractType: meta.contractType } : {}),
        ...(meta.underlyingType ? { underlyingType: meta.underlyingType } : {}),
      };
      S.allBySym.set(sym, entry);
      S.allByPair.set(pair, entry);
    }

    // enrich the FIXED membership — never re-rank, never drop: a curated pair
    // that fapi no longer carries (or is not TRADING) keeps its slot flagged
    // state:"delisted" so the UI can label it honestly.
    const prevByPair = S.byPair;
    const delisted: string[] = [];
    S.assets = curatedPerps().map((c, i) => {
      const pair = c.pair ?? `${c.sym}USDT`;
      const meta = perps.get(pair);
      const base = fromCurated(c, i, prevByPair.get(pair));
      const vol = vols.get(pair);
      return {
        ...base,
        quoteVol24h: vol != null ? vol : 0,
        ...(meta
          ? { priceDecs: meta.priceDecs, qtyDecs: meta.qtyDecs, onboard: meta.onboard, state: meta.status === "TRADING" ? ("trading" as const) : ("delisted" as const), ...(meta.contractType ? { contractType: meta.contractType } : {}), ...(meta.underlyingType ? { underlyingType: meta.underlyingType } : {}) }
          : { state: "delisted" as const }),
      };
    });
    for (const a of S.assets) if (a.state === "delisted") delisted.push(a.sym);
    S.bySym = new Map(S.assets.map((a) => [a.sym, a]));
    S.byPair = new Map(S.assets.map((a) => [a.pair, a]));
    S.st = {
      state: "ready",
      at: Date.now(),
      n: S.assets.length,
      ...(delisted.length ? { delisted } : {}),
    };
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
 * Cached universe state. Boot: blocks on the first enrichment (a cold boot
 * costs one exchangeInfo + one 24hr call, ~1-2s) — membership itself is
 * static, so even a failed first refresh serves the full list with defaults.
 * Ready: serves instantly, kicks a background re-enrich when older than 4h.
 * Error: keeps serving the last good list and retries at most once per 30s.
 */
export async function getUniverse(): Promise<UniverseState> {
  const now = Date.now();
  if (S.st.state === "boot" || (S.st.state === "error" && now - S.lastAttempt >= ERROR_BACKOFF_MS)) {
    await ensureRefreshing();
  } else if (S.st.state === "ready" && now - S.st.at > MAX_AGE_MS && !S.refreshing) {
    void ensureRefreshing(); // background re-enrich — stale list keeps serving
  }
  return { ...S.st, n: S.assets.length };
}

/**
 * Membership test (sync). Membership is the static curated set, so this is
 * authoritative at any time — no getUniverse() await required.
 */
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
