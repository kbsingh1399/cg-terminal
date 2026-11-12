import { NextRequest, NextResponse } from "next/server";
import { buildWallsModel, minWallForSym, type BookSnapshot } from "@/lib/cg/book-walls";
import { knownSym, anyTerminalSym } from "@/lib/cg/sym-gate";
import { hlCoinOf, resolveBinPair } from "@/lib/binance/aliases";
import { cleanGridStep, fetchHlCtxAndBook } from "@/lib/cg/fallbacks";
import { fapiFetch, FapiBannedError, fapiBanned } from "@/lib/live/fapi";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/livebook?sym=BTC&band=5&grid=50 — the LIVE order-book tier.
 *
 * ARCHITECTURE (weight-bounded, ban-proof):
 *  - ONE self-driven server poller per active (sym, grid, band) fetches the
 *    Binance USDT-M futures depth (top 1000 levels, weight 20) every 2.5 s
 *    — no matter how many tabs/agents poll this route, upstream cost is
 *    fixed at ~480 weight/min per active symbol (20% of the fapi IP budget).
 *  - The poller stops itself after 30 s without requests.
 *  - All fapi traffic goes through the shared circuit breaker
 *    (src/lib/live/fapi.ts): on HTTP 429/418 everything backs off for the
 *    ban window and this route serves the last ring (marked stale) — we
 *    never extend a ban by hammering.
 *
 * The poller keeps a ~6-minute ring of gridded snapshots and runs the EXACT
 * wall scanner of the aggregate model (src/lib/cg/book-walls.ts) over it:
 *  - depth / imbalance within ±band% over the covered book (top-1000 levels
 *    ≈ ±0.2% around mid on BTC — the covered range is returned and labeled,
 *    never silently mixed with full-depth aggregate numbers)
 *  - confirmed walls (same 2-consecutive-scan rule) with age + touch state
 *  - add/fill/pull events of the live ring
 *  - the last ring snapshot as a strip column the heatmap can append
 *
 * The `grid` param comes from the client's aggregate model so live walls
 * and aggregate walls land on the same price buckets.
 */

const POLL_MS = Math.max(1_500, Number(process.env.CG_LIVEBOOK_POLL_MS ?? 2_500) || 2_500);
const IDLE_STOP_MS = 30_000;
const RING_MS = 6.5 * 60_000; // covers the 5m-ago imbalance comparison
const RING_MAX = 320;
/** total poller cap — a looping client must not be able to spin up rings
 *  without bound (each costs recurring fapi weight + CPU + memory). */
const MAX_RINGS = 24;
/** guard against degenerate grids: a snapshot may never need more buckets
 *  than this regardless of grid granularity (top-1000 depth levels). */
const MAX_BUCKETS = 250_000;

interface Ring {
  grid: number;
  band: number;
  snaps: BookSnapshot[];
  at: number; // last successful poll
  body?: unknown;
  lastRequestAt: number;
  timer: ReturnType<typeof setInterval> | null;
  busy: boolean;
}

const g = globalThis as unknown as { __cgLiveBook?: Map<string, Ring> };
const rings = (g.__cgLiveBook ??= new Map<string, Ring>());

const ringKey = (sym: string, grid: number, band: number) => `${sym}|${grid}|${band}`;

/**
 * Quantize a client-supplied grid to ONE significant digit (47 → 50,
 * 0.037 → 0.04, 137 → 100). The grid is client-controllable and keys the
 * ring map — without quantization a looping request can mint unlimited
 * distinct rings (each with its own fapi poller and snapshot buffers).
 * The aggregate model's grids are already nice values, so snapping is
 * lossless for legitimate callers.
 */
function snapGrid(g: number): number {
  if (!(g > 0) || !Number.isFinite(g)) return 0;
  const mag = Math.pow(10, Math.floor(Math.log10(g)));
  const snapped = Number((Math.round(g / mag) * mag).toPrecision(6));
  return snapped > 0 && Number.isFinite(snapped) ? snapped : 0;
}

function niceGrid(mid: number): number {
  return cleanGridStep(mid);
}

async function fetchDepthSnapshot(sym: string, grid: number): Promise<BookSnapshot | null> {
  let bids: [string | number, string | number][] = [];
  let asks: [string | number, string | number][] = [];
  if (await knownSym(sym)) {
    const pair = resolveBinPair(sym);
    const d = (await fapiFetch(`/fapi/v1/depth?symbol=${encodeURIComponent(pair)}&limit=1000`)) as {
      bids?: [string, string][];
      asks?: [string, string][];
    };
    bids = d.bids ?? [];
    asks = d.asks ?? [];
  } else if (hlCoinOf(sym)) {
    const hl = await fetchHlCtxAndBook(sym).catch(() => null);
    bids = (hl?.book?.bids ?? []).map((b) => [b.px, b.sz]);
    asks = (hl?.book?.asks ?? []).map((a) => [a.px, a.sz]);
  }
  if (!bids.length || !asks.length) return null;
  let bb = -Infinity;
  let ba = Infinity;
  for (const [p, q] of bids) if (+q > 0 && +p > bb) bb = +p;
  for (const [p, q] of asks) if (+q > 0 && +p < ba) ba = +p;
  if (!(bb > 0) || !Number.isFinite(ba) || ba <= bb) return null;

  // same bucketing as decodeRow(): k = round(price / grid)
  let kMin = Infinity;
  let kMax = -Infinity;
  const flat: number[] = [];
  const add = (rows: [string | number, string | number][], side: "b" | "a") => {
    for (const [ps, qs] of rows) {
      const p = +ps;
      const q = +qs;
      if (!(q > 0)) continue;
      if (side === "b" && p > bb) continue; // glitched bid above best
      if (side === "a" && p < ba) continue; // glitched ask below best
      const k = Math.round(p / grid);
      if (k < kMin) kMin = k;
      if (k > kMax) kMax = k;
      flat.push(k, q);
    }
  };
  add(bids, "b");
  add(asks, "a");
  if (!flat.length) return null;
  // degenerate-grid guard: never allocate a giant bucket array
  if (kMax - kMin + 1 > MAX_BUCKETS) return null;
  const q = new Float64Array(kMax - kMin + 1);
  for (let i = 0; i < flat.length; i += 2) q[flat[i] - kMin] += flat[i + 1];
  return { t: Date.now(), g: grid, k0: kMin, q, bb, ba, mid: (bb + ba) / 2 };
}

async function pollOnce(sym: string, ring: Ring): Promise<void> {
  if (ring.busy) return;
  ring.busy = true;
  try {
    const snap = await fetchDepthSnapshot(sym, ring.grid);
    const at = Date.now();
    ring.at = at;
    if (snap) {
      ring.snaps.push(snap);
      while (ring.snaps.length > RING_MAX || (ring.snaps.length > 2 && ring.snaps[0].t < at - RING_MS)) ring.snaps.shift();
    } else {
      console.warn(`[livebook] ${sym}|${ring.grid}|${ring.band}: depth snapshot null (payload rejected)`);
    }
    if (!ring.snaps.length) return;

    const model = buildWallsModel(ring.snaps, sym, ring.band);
    if (!model) {
      console.warn(`[livebook] ${sym}|${ring.grid}|${ring.band}: model null (snaps=${ring.snaps.length})`);
      return;
    }
    const last = ring.snaps[ring.snaps.length - 1];
    const pctFrom = (p: number) => +(((p - last.mid) / last.mid) * 100).toFixed(2);
    const coverLo = last.k0 * ring.grid;
    const coverHi = (last.k0 + last.q.length - 1) * ring.grid;
    ring.body = {
      ok: true,
      sym,
      market: "futures-live",
      band: ring.band,
      grid: ring.grid,
      venues: [hlCoinOf(sym) && !(await knownSym(sym)) ? `Hyperliquid ${hlCoinOf(sym)}` : "Binance (live top-1000 levels)"],
      minWallUsd: minWallForSym(sym),
      covered: {
        lo: coverLo,
        hi: coverHi,
        loPct: pctFrom(coverLo),
        hiPct: pctFrom(coverHi),
        levels: 1000,
      },
      model,
      updatedAt: at,
      fapiBanned: false,
    };
  } catch (e) {
    if (e instanceof FapiBannedError) {
      if (ring.body && typeof ring.body === "object") {
        (ring.body as Record<string, unknown>).fapiBanned = true;
      }
    } else {
      console.warn("[livebook] poll failed:", e instanceof Error ? e.message : e);
    }
  } finally {
    ring.busy = false;
  }
}

async function resolveGrid(sym: string, clientGrid: number | null): Promise<number> {
  if (clientGrid && clientGrid > 0) return clientGrid;
  for (const [k, r] of rings) if (k.startsWith(`${sym}|`) && r.snaps.length) return r.grid;
  if (await knownSym(sym)) {
    const pair = resolveBinPair(sym);
    const t = (await fapiFetch(`/fapi/v1/ticker/bookTicker?symbol=${encodeURIComponent(pair)}`)) as { bidPrice?: string };
    return niceGrid(Number(t.bidPrice) || 0);
  }
  const hl = await fetchHlCtxAndBook(sym).catch(() => null);
  const px = hl?.book?.bids[0]?.px ?? Number(hl?.ctx?.markPx ?? 0);
  return px > 0 ? niceGrid(px) : 0;
}

function ensurePoller(sym: string, grid: number, band: number): Ring {
  const key = ringKey(sym, grid, band);
  let ring = rings.get(key);
  if (!ring) {
    if (rings.size >= MAX_RINGS) {
      let oldestKey: string | null = null;
      let oldestAt = Infinity;
      for (const [k, r] of rings) {
        if (r.lastRequestAt < oldestAt) {
          oldestAt = r.lastRequestAt;
          oldestKey = k;
        }
      }
      if (oldestKey) {
        const old = rings.get(oldestKey)!;
        if (old.timer) clearInterval(old.timer);
        rings.delete(oldestKey);
      }
    }
    ring = { grid, band, snaps: [], at: 0, lastRequestAt: Date.now(), timer: null, busy: false };
    rings.set(key, ring);
  }
  ring.lastRequestAt = Date.now();
  if (ring.timer) return ring;
  pollOnce(sym, ring).catch(() => undefined);
  ring.timer = setInterval(() => {
    const r = rings.get(ringKey(sym, grid, band));
    if (!r) {
      clearInterval(ring!.timer!);
      return;
    }
    if (Date.now() - r.lastRequestAt > IDLE_STOP_MS) {
      clearInterval(r.timer!);
      r.timer = null;
      rings.delete(ringKey(sym, grid, band));
      return;
    }
    pollOnce(sym, r).catch(() => undefined);
  }, POLL_MS);
  (ring.timer as unknown as { unref?: () => void }).unref?.();
  return ring;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sym = (sp.get("sym") ?? "BTC").trim().toUpperCase();
  if (!(await anyTerminalSym(sym))) {
    return NextResponse.json({ ok: false, error: `unknown asset ${sym}` }, { status: 400 });
  }
  const hasPerp = await knownSym(sym);
  if (!hasPerp && !hlCoinOf(sym)) {
    return NextResponse.json({ ok: true, supported: false, sym, model: null, updatedAt: Date.now() });
  }
  const band = [0.5, 1, 2, 5].includes(Number(sp.get("band"))) ? Number(sp.get("band")) : 5;
  const gridRaw = Number(sp.get("grid") ?? 0);
  const clientGrid = Number.isFinite(gridRaw) && gridRaw > 0 ? snapGrid(gridRaw) : null;

  // find an existing fresh-enough ring — exact (sym,grid,band) first, then
  // same (sym,grid) with a different band as a degraded hit
  const exact = clientGrid ? rings.get(ringKey(sym, clientGrid, band)) : undefined;
  let ring = exact;
  if (!ring && clientGrid) {
    for (const [k, r] of rings) if (k.startsWith(`${sym}|${clientGrid}|`)) ring = r;
  }

  const ban = fapiBanned();
  if (ring?.body && Date.now() - ring.at < POLL_MS * 4) {
    return NextResponse.json(ring.body);
  }
  if (ban.banned && ring?.body) {
    return NextResponse.json(ring.body);
  }

  const grid = clientGrid ?? (await resolveGrid(sym, null).catch(() => 0));
  if (!(grid > 0)) {
    return NextResponse.json(
      { ok: false, error: ban.banned ? `fapi banned until ${new Date(ban.until).toISOString()}` : "no grid" },
      { status: 502 }
    );
  }
  const r = ensurePoller(sym, grid, band);
  // serve what we have; the poller fills/refreshes asynchronously — a cold
  // start waits for the first snapshot (bounded by the fetch timeout)
  if (!r.body) {
    await new Promise<void>((resolve) => {
      const t0 = Date.now();
      const wait = setInterval(() => {
        if (r.body || Date.now() - t0 > 5_000) {
          clearInterval(wait);
          resolve();
        }
      }, 100);
      (wait as unknown as { unref?: () => void }).unref?.();
    });
  }
  if (r.body) return NextResponse.json(r.body);
  return NextResponse.json({ ok: false, error: "live book warming up — retry" }, { status: 503 });
}
