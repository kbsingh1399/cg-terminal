import { NextRequest, NextResponse } from "next/server";
import { CLASSIC_ASSETS, classicOf, classicCounts, isClassic } from "@/lib/cg/classic";

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
const g = globalThis as unknown as { __cgClassic?: Map<string, CacheEntry> };
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

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get("list") === "1") {
    return NextResponse.json({
      ok: true,
      counts: classicCounts(),
      assets: CLASSIC_ASSETS.map((a) => ({ sym: a.sym, name: a.name, klass: a.klass, broker: a.broker, yahoo: a.yahoo, volume: a.volume, ...(a.note ? { note: a.note } : {}) })),
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
  const { status, text } = await yahooChart(cfg.yahoo, interval, range);
  if (status !== 200) {
    cache.set(key, { at: Date.now(), body: null, err: `yahoo HTTP ${status} for ${cfg.yahoo}` });
    return NextResponse.json({ ok: false, error: `yahoo HTTP ${status} for ${cfg.yahoo} (unofficial API — retry next poll)` }, { status: 502 });
  }
  const norm = normalize(sym, text);
  if ("error" in norm) {
    cache.set(key, { at: Date.now(), body: null, err: norm.error });
    return NextResponse.json({ ok: false, error: norm.error }, { status: 502 });
  }
  const body = { ...norm, name: cfg.name, klass: cfg.klass, broker: cfg.broker, yahoo: cfg.yahoo, note: cfg.note ?? null };
  cache.set(key, { at: Date.now(), body });
  return NextResponse.json(body);
}
