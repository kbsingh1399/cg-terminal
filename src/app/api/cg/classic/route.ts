import { NextRequest, NextResponse } from "next/server";
import { CLASSIC_ASSETS, classicOf, classicCounts, isClassic } from "@/lib/cg/classic";
import { microLiveQuote, microMapOf, type LiveQuote } from "@/lib/cg/micro";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/classic?list=1                  → registry inventory
 * GET /api/cg/classic?sym=US30                → quote + 15m/5d bars (default)
 * GET /api/cg/classic?sym=EURUSD&interval=1h&range=1mo
 *
 * Tier-3 market data (indices · FX · equities · UKO): a server-side proxy of
 * the Yahoo Finance chart API (v8) — the only free, key-less source that
 * covers the whole classic universe (live-verified 2026-11-11). The terminal
 * adds: registry gating (unknown symbol → 400, same contract as /market),
 * a 60 s response cache, and query2 host fallback. Yahoo is an unofficial
 * API — treat 429s as expected and retry on the next poll, never hammer.
 *
 * 2026-11-11 stale-values fix (user report: "many values are stale like forex
 * and other indices"): the Yahoo body alone cannot be the headline quote —
 * cash indices freeze outside their cash session (US cash frozen 19.5h/day)
 * and EU/oil feeds are 10-15min delayed. The route now assembles a QUOTE
 * LADDER concurrently with the Yahoo fetch:
 *   live  — microLiveQuote() 24/7 anchor (Kraken spot FX / Hyperliquid xyz
 *           perp mark / Lighter L3 mid) for the 25 mapped instruments
 *   fut   — Yahoo futures lead (YM=F, RTY=F; 24/5 Globex hours, ~10m delayed)
 *           for indices with no micro anchor
 *   price — Yahoo cash quote + bars (indicators/history stay cash-anchored)
 * plus chg24hPct (vs the last bar that closed ≥24h ago) — the old chgPct is
 * the RANGE change (chartPreviousClose of the requested range, e.g. 5 days)
 * and was being read as today's move. Every block carries its own timestamp
 * so the UI can age it honestly; blocks are absent (not faked) when their
 * source is down.
 */

const TTL_MS = 60_000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const INTERVALS = new Set(["1m", "5m", "15m", "30m", "1h", "1d"]);
const RANGES = new Set(["1d", "5d", "1mo", "3mo", "6mo", "1y"]);

interface CacheEntry {
  at: number;
  body: unknown;
  err?: string;
}
const g = globalThis as unknown as { __cgClassic?: Map<string, CacheEntry>; __cgClassicFut?: Map<string, CacheEntry> };
const cache = (g.__cgClassic ??= new Map<string, CacheEntry>());
const CACHE_MAX = 96; // whitelist key space is 78×6×6 — cap live memory (review G5/E7)

async function yahooChart(yahoo: string, interval: string, range: string): Promise<{ status: number; text: string }> {
  const path = `/v8/finance/chart/${encodeURIComponent(yahoo)}?interval=${interval}&range=${range}&includePrePost=false`;
  for (const host of ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"]) {
    try {
      const res = await fetch(`${host}${path}`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
      if (res.status === 429) {
        // rate-limited: retrying on query2 doubles the request exactly when
        // Yahoo asked us to stop (review E6) — surface it immediately
        return { status: res.status, text: await res.text() };
      }
      if (res.status >= 500) {
        if (host.includes("query2")) return { status: res.status, text: await res.text() };
        continue; // try query2 before giving up
      }
      return { status: res.status, text: await res.text() };
    } catch {
      if (host.includes("query2")) return { status: -1, text: "network error" };
    }
  }
  return { status: -1, text: "network error" };
}

interface Bar {
  t: number; o: number | null; h: number | null; l: number | null; c: number | null; v: number;
}

interface NormalizeOk {
  ok: true;
  sym: string;
  price: number | null;
  prevClose: number | null;
  chgPct: number | null;
  currency: unknown;
  exchange: unknown;
  tz: unknown;
  instrumentType: unknown;
  regularMarketTime: unknown;
  hasVolume: boolean;
  nBars: number;
  bars: Bar[];
  source: string;
  fetchedAt: number;
}

function normalize(sym: string, raw: string): NormalizeOk | { error: string } {
  let j: {
    chart?: {
      result?: Array<{
        meta?: Record<string, unknown>;
        timestamp?: number[];
        indicators?: { quote?: Array<Record<string, Array<number | null>>> };
      }>;
      error?: { description?: string } | null;
    };
  };
  try {
    j = JSON.parse(raw);
  } catch {
    return { error: "yahoo returned non-JSON" };
  }
  const r = j.chart?.result?.[0];
  if (!r) {
    return { error: j.chart?.error?.description || "no chart result" };
  }
  const m = r.meta ?? {};
  const q = r.indicators?.quote?.[0] ?? {};
  const ts = r.timestamp ?? [];
  const bars: Bar[] = [];
  for (let i = 0; i < ts.length; i++) {
    bars.push({
      t: 1000 * ts[i],
      o: q.open?.[i] ?? null,
      h: q.high?.[i] ?? null,
      l: q.low?.[i] ?? null,
      c: q.close?.[i] ?? null,
      v: q.volume?.[i] ?? 0,
    });
  }
  const price = typeof m.regularMarketPrice === "number" ? m.regularMarketPrice : bars.length ? bars[bars.length - 1].c : null;
  const prev = typeof m.chartPreviousClose === "number" ? m.chartPreviousClose : null;
  return {
    ok: true,
    sym,
    price,
    prevClose: prev,
    chgPct: price != null && prev ? +(((price - prev) / prev) * 100).toFixed(2) : null,
    currency: m.currency ?? null,
    exchange: m.fullExchangeName ?? m.exchangeName ?? null,
    tz: m.exchangeTimezoneName ?? null,
    instrumentType: m.instrumentType ?? null,
    regularMarketTime: m.regularMarketTime ?? null,
    hasVolume: bars.some((b) => b.v > 0),
    nBars: bars.length,
    bars,
    source: "yahoo-chart-v8",
    fetchedAt: Date.now(),
  };
}

/** Futures lead quote — meta-only parse (price + exchange timestamp) of the
 *  same Yahoo chart endpoint, range=1d for the lightest payload. */
interface FutQuote {
  ok: boolean;
  price: number | null;
  yahoo: string;
  rmt: number | null;
  at: number;
  err?: string;
}

async function yahooFutQuote(ticker: string): Promise<FutQuote> {
  const { status, text } = await yahooChart(ticker, "15m", "1d");
  if (status !== 200) {
    return { ok: false, price: null, yahoo: ticker, rmt: null, at: Date.now(), err: `yahoo HTTP ${status} for ${ticker}` };
  }
  try {
    const j = JSON.parse(text) as { chart?: { result?: Array<{ meta?: Record<string, unknown> }> } };
    const m = j.chart?.result?.[0]?.meta ?? {};
    const p = typeof m.regularMarketPrice === "number" ? m.regularMarketPrice : null;
    const rmt = typeof m.regularMarketTime === "number" ? m.regularMarketTime : null;
    if (p == null || !Number.isFinite(p) || p <= 0) {
      return { ok: false, price: null, yahoo: ticker, rmt: null, at: Date.now(), err: `no fut price for ${ticker}` };
    }
    return { ok: true, price: p, yahoo: ticker, rmt, at: Date.now() };
  } catch {
    return { ok: false, price: null, yahoo: ticker, rmt: null, at: Date.now(), err: `non-JSON from ${ticker}` };
  }
}

/** 24h change: price vs the close of the newest bar that closed ≥24h ago.
 *  Null when no such bar exists (1d range) or the reference is implausibly
 *  old (>96h — long weekend + short window): never a fabricated Δ. */
function chg24h(bars: Bar[], price: number | null): number | null {
  if (price == null || !Number.isFinite(price) || !bars.length) return null;
  const cutoff = Date.now() - 24 * 3600_000;
  let ref: Bar | undefined;
  for (const b of bars) {
    if (b.t > cutoff) break;
    if (b.c != null) ref = b;
  }
  if (!ref || ref.c == null || ref.c <= 0) return null;
  if (Date.now() - ref.t > 96 * 3600_000) return null;
  return +(((price - ref.c) / ref.c) * 100).toFixed(2);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get("list") === "1") {
    return NextResponse.json({
      ok: true,
      counts: classicCounts(),
      assets: CLASSIC_ASSETS.map((a) => ({
        sym: a.sym,
        name: a.name,
        klass: a.klass,
        broker: a.broker,
        yahoo: a.yahoo,
        ...(a.binPair ? { binPair: a.binPair } : {}),
        volume: a.volume,
        ...(a.tradfiCore ? { tradfiCore: true } : {}),
        ...(a.note ? { note: a.note } : {}),
      })),
    });
  }
  const sym = (sp.get("sym") ?? "").toUpperCase();
  if (!sym) {
    return NextResponse.json({ ok: false, error: "missing sym (or ?list=1 for the inventory)" }, { status: 400 });
  }
  if (!isClassic(sym)) {
    return NextResponse.json(
      { ok: false, error: `unknown classic asset ${sym} — perp assets use /api/cg/market; registry: /api/cg/classic?list=1` },
      { status: 400 }
    );
  }
  const cfg = classicOf(sym)!;
  const interval = sp.get("interval") ?? "15m";
  const range = sp.get("range") ?? "5d";
  if (!INTERVALS.has(interval) || !RANGES.has(range)) {
    return NextResponse.json({ ok: false, error: `interval must be one of ${[...INTERVALS].join("/")} and range one of ${[...RANGES].join("/")}` }, { status: 400 });
  }
  const key = `${sym}|${interval}|${range}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    if (hit.err) return NextResponse.json({ ok: false, error: hit.err }, { status: 502 });
    return NextResponse.json(hit.body);
  }
  if (hit) cache.delete(key); // expired: evict, never pin stale bodies (review E7)
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  // ---- quote-ladder side channels, launched BEFORE the Yahoo await so all
  // chains run CONCURRENTLY (RV-SEC convention: worst-case latency is
  // max(chain), not the sum; a dead side channel degrades to its absence —
  // it can never fail the response) ----
  const liveP: Promise<LiveQuote> | null = microMapOf(sym) ? microLiveQuote(sym) : null;
  const futP: Promise<FutQuote> | null = cfg.futYahoo
    ? (async () => {
        const futCache = (g.__cgClassicFut ??= new Map<string, CacheEntry>());
        const k = `fut|${sym}`;
        const h = futCache.get(k);
        if (h && Date.now() - h.at < TTL_MS) return h.body as FutQuote;
        if (h) futCache.delete(k);
        const fq = await yahooFutQuote(cfg.futYahoo!);
        futCache.set(k, { at: Date.now(), body: fq });
        return fq;
      })()
    : null;

  const { status, text } = await yahooChart(cfg.yahoo, interval, range);

  if (status !== 200) {
    const [live, fut] = await Promise.all([liveP, futP]);
    // Yahoo body failed but a live/futures anchor may still be fresh enough to
    // serve a quote-only response — far better for the user than a flat 502
    // (Yahoo 429s are routine). Bars/indicators are honestly absent.
    if (live?.ok || fut?.ok) {
      const qb = {
        ok: true,
        quoteOnly: true,
        sym,
        name: cfg.name,
        klass: cfg.klass,
        broker: cfg.broker,
        yahoo: cfg.yahoo,
        binPair: cfg.binPair ?? null,
        note: cfg.note ?? null,
        price: live?.ok ? live.price : fut?.price,
        prevClose: null,
        chgPct: null,
        chg24hPct: null,
        currency: null,
        exchange: null,
        tz: null,
        instrumentType: null,
        regularMarketTime: null,
        hasVolume: false,
        nBars: 0,
        bars: [] as Bar[],
        source: "quote-ladder (yahoo body unavailable)",
        fetchedAt: Date.now(),
        ...(live ? { live } : {}),
        ...(fut ? { fut } : {}),
      };
      return NextResponse.json(qb);
    }
    cache.set(key, { at: Date.now(), body: null, err: `yahoo HTTP ${status} for ${cfg.yahoo}` });
    return NextResponse.json({ ok: false, error: `yahoo HTTP ${status} for ${cfg.yahoo} (unofficial API — retry next poll)` }, { status: 502 });
  }
  const [live, fut] = await Promise.all([liveP, futP]);
  const norm = normalize(sym, text);
  if ("error" in norm) {
    cache.set(key, { at: Date.now(), body: null, err: norm.error });
    return NextResponse.json({ ok: false, error: norm.error }, { status: 502 });
  }
  const body = {
    ...norm,
    chg24hPct: chg24h(norm.bars, norm.price),
    name: cfg.name,
    klass: cfg.klass,
    broker: cfg.broker,
    yahoo: cfg.yahoo,
    binPair: cfg.binPair ?? null,
    note: cfg.note ?? null,
    ...(live ? { live } : {}),
    ...(fut ? { fut } : {}),
  };
  cache.set(key, { at: Date.now(), body });
  return NextResponse.json(body);
}
