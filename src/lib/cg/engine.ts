/**
 * Continuity engine — keeps every series gap-free across restarts.
 *
 * Boot: for each series, read the last stored timestamp from the local
 * store and page upstream history (endTime pagination) up to now.
 * Then: background pollers append only new rows (store dedups by key).
 *
 * Series (all pure Coinglass API data):
 *  - kline:Binance_BTCUSDT:m15        — price candles (#kline)
 *  - bs_usd:<inst>:m15                — per-venue taker flows for CVD
 *  - stopmap                          — liquidation-heatmap windows
 *    (rows keyed [barTs, price] — overlapping windows dedupe)
 *  - bookwalls                        — order-book depth snapshots (strip cells)
 *  - lto:open                         — point-in-time whale open orders
 *    (no upstream history — gaps during downtime are unavoidable and marked)
 *  - liqlevels:3d                     — liquidation-levels model snapshots
 *
 * Enable/disable: CG_ENGINE=off disables. CG_ENGINE_BACKFILL_DAYS (default 3)
 * bounds how far boot backfill reaches on a fresh store.
 */
import { cgGet, FAPI } from "./client";
import { makeObeToken } from "./crypto";
import { decodeRow, fetchAggregateStream, rebin, type BookSnapshot } from "./book-walls";
import { append, lastTs, markPoll, markBackfilling, stat, gapCount } from "./store";
import { startMemWatch } from "./memwatch";
import type { KlineRow } from "./types";
import { ASSETS, aggVenues, isCuratedPerp, leadInstr, liqVenues } from "./assets";
import { curatedPerps } from "@/lib/universe/curated";
import { startScanner } from "./scan";

const STEP_MS = 900_000; // m15 master step
const POLL_KLINE = 60_000;
const POLL_LTO = 60_000;
const POLL_STOPMAP = 300_000;
const POLL_BOOKWALLS = 120_000;
const POLL_LIQLEVELS = 120_000;

interface EngineState {
  started: boolean;
  startedAt: number;
  timers: NodeJS.Timeout[];
  instrumentKeys: string[] | null;
  bootDone: Promise<void> | null;
}

const g = globalThis as unknown as { __cgEngine?: EngineState };
const engine: EngineState = (g.__cgEngine ??= { started: false, startedAt: 0, timers: [], instrumentKeys: null, bootDone: null });

const keyKline = (r: any) => String(r.t);
const keyFlow = (r: any) => String(r.t);
const keyStop = (r: any) => `${r.t}|${r.p}`;
const keyWall = (r: any) => `${r.t}|${r.p}`;
// Row identity for append() dedup — the key must distinguish EVERY distinct
// row a single poll produces or rows silently collapse (store.ts dedups by
// exact string):
//  - lto: `at` is one poll timestamp (identical for all rows of the poll) and
//    `i` (exName_instrumentId) repeats per ORDER — without the order `id`, one
//    poll kept exactly one row per instrument, the last order winning
//    arbitrarily (live 2026-11-11: 1316 ≥$1M BTC orders → 20 rows stored).
//  - liq: same (at, side, price) recurs ACROSS venues and across leverage
//    tiers within a poll — without venue+tier ~6% of rows collapsed
//    (live: 9508 levels → 8885 stored).
const keyLto = (r: any) => `${r.at}|${r.i}|${r.id}`;
const keyLiq = (r: any) => `${r.at}|${r.v}|${r.side}|${r.p}|${r.l2}`;

async function fetchKlines(symbol: string, itv: string, limit: number, endTime?: number): Promise<KlineRow[]> {
  const q = `/api/v2/kline?symbol=${encodeURIComponent(symbol + "#kline")}&interval=${itv}&limit=${limit}&minLimit=false${endTime ? `&endTime=${endTime}` : ""}`;
  const r = (await cgGet(q, 0)) as { data?: KlineRow[] } | KlineRow[];
  const rows = Array.isArray(r) ? r : (r.data ?? []);
  return rows.filter((x) => x && Number.isFinite(+x[4]));
}

async function fetchFlows(symbol: string, itv: string, limit: number, endTime?: number): Promise<[number, number, number][]> {
  const q = `/api/v2/kline?symbol=${encodeURIComponent(symbol + "#bs_usd")}&interval=${itv}&limit=${limit}&minLimit=false${endTime ? `&endTime=${endTime}` : ""}`;
  const r = (await cgGet(q, 0)) as { data?: [number, string | number, string | number][] } | [number, string | number, string | number][];
  const rows = Array.isArray(r) ? r : (r.data ?? []);
  // normalize timestamps to milliseconds (upstream returns unix seconds)
  return rows.map((x) => [1000 * Number(x[0]), Number(x[1]) || 0, Number(x[2]) || 0]);
}

type TickerRaw = { instrument?: { exName?: string; instrumentId?: string; baseAsset?: string; type?: number }; volUsd?: number };

async function cvdInstrumentKeys(): Promise<string[]> {
  if (engine.instrumentKeys) return engine.instrumentKeys;
  // both lanes are best-effort: a transient failure must not abort the whole
  // flows lane (pollFlows/boot would reject before any markPoll)
  const futRaw = (await cgGet(`/api/select/coins/tickers?type=FUTURES&keyword=BTC`, 300_000).catch(() => null)) as ({ data?: TickerRaw[] } | TickerRaw[]) | null;
  const spotRaw = (await cgGet(`/api/select/coins/tickers?type=SPOT&keyword=BTC`, 300_000).catch(() => null)) as ({ data?: TickerRaw[] } | TickerRaw[]) | null;
  // the decrypted payload is a bare array (not wrapped in .data)
  const asRows = (x: unknown): TickerRaw[] => (Array.isArray(x) ? (x as TickerRaw[]) : ((x as { data?: TickerRaw[] })?.data ?? []));
  const fut = { data: asRows(futRaw) };
  const spot = { data: asRows(spotRaw) };
  const perpOk = ["Binance", "OKX", "Bybit", "Gate", "Bitget", "Deribit", "MEXC", "Hyperliquid", "BingX", "Kraken", "HTX", "KuCoin", "Bitfinex"];
  const spotOk = ["Binance", "Coinbase", "OKX", "Bybit", "Bitget", "Gate", "Kraken", "Bitfinex", "Crypto.com"];
  const best = new Map<string, string>();
  const bestVol = new Map<string, number>();
  const scan = (rows: TickerRaw[], kind: "perp" | "spot") => {
    for (const t of rows ?? []) {
      const i = t.instrument;
      if (!i || i.baseAsset !== "BTC") continue;
      if (kind === "perp" && Number(i.type) !== 1) continue;
      if (kind === "spot" && Number(i.type) !== 10) continue;
      const list = kind === "perp" ? perpOk : spotOk;
      if (!i.exName || !list.includes(i.exName)) continue;
      const k = `${i.exName}|${kind}`;
      const vol = +(t.volUsd ?? 0);
      if (!best.has(k) || vol > (bestVol.get(k) ?? -1)) {
        best.set(k, `${i.exName}_${kind === "spot" ? "SPOT_" : ""}${i.instrumentId}`);
        bestVol.set(k, vol);
      }
    }
  };
  scan(fut?.data ?? [], "perp");
  scan(spot?.data ?? [], "spot");
  // per-venue highest volume: keep the first (tickers are volume-sorted upstream)
  const keys = [...new Set([...best.values()])];
  engine.instrumentKeys = keys.length ? keys : ["Binance_BTCUSDT"];
  return engine.instrumentKeys;
}

async function pollKline() {
  const name = "kline:Binance_BTCUSDT:m15";
  try {
    const rows = await fetchKlines("Binance_BTCUSDT", "m15", 96);
    append(
      name,
      rows.map((r) => ({ t: 1000 * Number(r[0]), o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5] })),
      keyKline
    );
    markPoll(name, keyKline);
  } catch (e) {
    markPoll(name, keyKline, e instanceof Error ? e.message : "error");
  }
}

/** The engine's continuity list: the 58 curated perps + any legacy Tier-1
 * registry sym that is not curated (XPT) — Tier-1 code paths keep their
 * series continuity. */
function continuitySyms(): string[] {
  const curated = curatedPerps().map((c) => c.sym);
  const legacy = ASSETS.map((a) => a.sym).filter((s) => !isCuratedPerp(s));
  return [...curated, ...legacy];
}

/** round-robin kline poller for every asset of the curated universe */
let assetPollIdx = 0;
async function pollAssetKlines() {
  const list = continuitySyms().map((s) => leadInstr(s));
  // 3 assets per 60s tick → a full pass over the 59 instruments ≈ 20 min;
  // every poll fetches a 96-bar (24h) page so m15 continuity never gaps
  // (store dedups by bar timestamp), freshness just staggers.
  for (let k = 0; k < 3; k++) {
    const inst = list[assetPollIdx % list.length];
    assetPollIdx++;
    const name = `kline:${inst}:m15`;
    if (inst === "Binance_BTCUSDT") continue; // dedicated BTC poller above
    try {
      const rows = await fetchKlines(inst, "m15", 96);
      append(name, rows.map((r) => ({ t: 1000 * Number(r[0]), o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5] })), keyKline);
      markPoll(name, keyKline);
    } catch (e) {
      markPoll(name, keyKline, e instanceof Error ? e.message : "error");
    }
  }
}

async function pollFlows() {
  const keys = await cvdInstrumentKeys();
  for (const k of keys.slice(0, 24)) {
    const name = `bs_usd:${k}:m15`;
    try {
      const rows = await fetchFlows(k, "m15", 96);
      append(name, rows.map((r) => ({ t: r[0], b: r[1], s: r[2] })), keyFlow);
      markPoll(name, keyFlow);
    } catch (e) {
      markPoll(name, keyFlow, e instanceof Error ? e.message : "error");
    }
  }
}

interface StopmapWindow {
  instrument?: string;
  liq?: [number, number, number][];
  prices?: [number, string | number, string | number, string | number, string | number][];
  y?: number[];
  updateTime?: number;
}

async function fetchStopmap(endTime?: number): Promise<StopmapWindow | null> {
  const q = new URLSearchParams({ merge: "true", symbol: "Binance_BTCUSDT", interval: "5", limit: "288", data: makeObeToken() });
  if (endTime) q.set("endTime", String(endTime));
  const r = (await cgGet(`/api/index/v2/liqHeatMap?${q.toString()}`, 0)) as StopmapWindow & { code?: string };
  if (!r || !Array.isArray(r.liq)) return null;
  return r;
}

function storeStopmap(w: StopmapWindow): number {
  if (!w.liq || !w.prices || !w.y) return 0;
  const tsOf = (barIdx: number) => 1000 * Number(w.prices![Math.min(barIdx, w.prices!.length - 1)][0]);
  const rows = w.liq
    .filter(([b, yi, usd]) => usd > 0 && yi >= 0 && yi < w.y!.length)
    .map(([b, yi, usd]) => ({ t: tsOf(b), p: w.y![yi], u: usd }));
  return append("stopmap", rows, keyStop);
}

async function pollStopmap() {
  try {
    const w = await fetchStopmap();
    if (w) {
      storeStopmap(w);
      markPoll("stopmap", keyStop);
    } else markPoll("stopmap", keyStop, "upstream empty");
  } catch (e) {
    markPoll("stopmap", keyStop, e instanceof Error ? e.message : "error");
  }
}

async function fetchWallSnapshots(limit: number, endTime?: number): Promise<{ size: number; snaps: BookSnapshot[] }> {
  const stream = await fetchAggregateStream({
    coin: "BTC",
    exchanges: aggVenues("BTC", "futures"),
    market: "futures",
    interval: "m15",
    limit,
    endTime,
  });
  const snaps: BookSnapshot[] = [];
  for (const row of stream.rows) {
    const s = decodeRow(row, stream.size);
    if (s) snaps.push(s);
  }
  snaps.sort((a, b) => a.t - b.t);
  return { size: stream.size, snaps };
}

function storeWalls(snaps: BookSnapshot[]): number {
  // store a compact ±8% band at $50 grid keyed (ts, priceBucket)
  const last = snaps[snaps.length - 1];
  if (!last) return 0;
  const grid = 50;
  const lo = Math.floor((last.mid * 0.92) / grid);
  const hi = Math.ceil((last.mid * 1.08) / grid);
  const cnt = hi - lo + 1;
  const rows: { t: number; p: number; u: number }[] = [];
  const scratch = new Float64Array(cnt);
  for (const s of snaps) {
    rebin(s, grid, lo, cnt, scratch);
    for (let i = 0; i < cnt; i++) {
      if (scratch[i] > 0) {
        const p = (lo + i) * grid + grid / 2;
        rows.push({ t: s.t, p: Math.round(p), u: Math.round(scratch[i] * p) });
      }
    }
  }
  return append("bookwalls", rows, keyWall);
}

async function pollBookwalls() {
  try {
    const { snaps } = await fetchWallSnapshots(120);
    storeWalls(snaps);
    markPoll("bookwalls", keyWall);
  } catch (e) {
    markPoll("bookwalls", keyWall, e instanceof Error ? e.message : "error");
  }
}

async function pollLto() {
  try {
    // per-exchange like the live page (support + v3 on fapi)
    const support = (await cgGet(`/api/largeTakerOrder/support/v3?symbol=BTC`, 10 * 60_000, FAPI)) as {
      futures?: { exchange: string }[];
      spot?: { exchange: string }[];
    } | null;
    const exchanges = [...new Set([...(support?.futures ?? []), ...(support?.spot ?? [])].map((s) => s.exchange))];
    const at = Date.now();
    const rows: { at: number; i: string; id: number; p: number; side: number; usd: number; qty: number }[] = [];
    const settled = await Promise.allSettled(
      exchanges.map((ex) =>
        cgGet(
          `/api/largeTakerOrder/v3?exchange=${encodeURIComponent(ex)}&symbol=BTC&market=all&limit=3000&minVolUsd=1000000`,
          0,
          FAPI
        )
      )
    );
    settled.forEach((r) => {
      if (r.status !== "fulfilled" || !Array.isArray(r.value)) return;
      for (const grp of r.value as {
        instrument?: { exName?: string; instrumentId?: string };
        list?: { id: number; price: number; side: number; currentUsd: number; currentAmount: number }[];
      }[]) {
        const inst = `${grp.instrument?.exName ?? "?"}_${grp.instrument?.instrumentId ?? "?"}`;
        for (const o of grp.list ?? []) {
          if (!(o.currentUsd >= 1_000_000)) continue;
          rows.push({ at, i: inst, id: o.id, p: o.price, side: o.side, usd: o.currentUsd, qty: o.currentAmount });
        }
      }
    });
    append("lto:open", rows, keyLto);
    markPoll("lto:open", keyLto);
  } catch (e) {
    markPoll("lto:open", keyLto, e instanceof Error ? e.message : "error");
  }
}

async function pollLiqLevels() {
  // single registry: derive BTC's venue list instead of a second hardcoded copy
  const venues = liqVenues("BTC").map((v) => v.key);
  try {
    const at = Date.now();
    const rows: { at: number; v: string; side: number; p: number; s: number; l2: string }[] = [];
    for (const v of venues) {
      const r = (await cgGet(`/api/liquidationLevels/v2?symbol=${encodeURIComponent(v)}&limit=4000&range=3d`, 0)) as {
        data?: { price: number; size: number; side: number; level2?: string }[];
      };
      for (const lv of r.data ?? []) {
        if (!(lv.size > 0)) continue;
        rows.push({ at, v, side: lv.side, p: lv.price, s: lv.size, l2: lv.level2 ?? "" });
      }
    }
    append("liqlevels:3d", rows, keyLiq);
    markPoll("liqlevels:3d", keyLiq);
  } catch (e) {
    markPoll("liqlevels:3d", keyLiq, e instanceof Error ? e.message : "error");
  }
}

// ---------------------------------------------------------------------------
// Boot backfill
// ---------------------------------------------------------------------------

/**
 * Page-count guard for an m15 backfill of `days` days.
 *
 * A full upstream v2/kline page is ~504 bars ≈ 5.25 d, so the legacy fixed
 * caps (12 pages kline/flows, 8 pages per-asset) cover 63 d / 42 d — fine at
 * full pages. But some instruments SHORT-PAGE at ~100 bars ≈ 1 d/page
 * (observed live 2026-11-11 on the spot bs_usd series), where 8 pages silently
 * stops a CG_ENGINE_BACKFILL_DAYS=30 boot at ~8 d with no signal. Scale the
 * guard with the requested days at the WORST observed page size, floored at
 * the legacy caps so default 3-day boots behave identically. The guard is
 * only a loop bound — once history is exhausted the loop exits via the
 * `end > targetFrom` condition, so full-page series never spend the extra
 * requests.
 */
const m15PagesFor = (days: number, floor: number) => Math.max(floor, Math.ceil((days * 96) / 100) + 2);

async function backfillKlineAndFlows(days: number) {
  const keys = ["Binance_BTCUSDT", ...(await cvdInstrumentKeys())];
  const uniqueKeys = [...new Set(keys)];
  const backMs = days * 86_400_000;
  for (const k of uniqueKeys) {
    const isPrice = k === "Binance_BTCUSDT";
    const name = isPrice ? `kline:${k}:m15` : `bs_usd:${k}:m15`;
    const stored = lastTs(name, isPrice ? keyKline : keyFlow) ?? 0;
    const targetFrom = Math.max(Date.now() - backMs, stored);
    if (Date.now() - targetFrom < STEP_MS) continue; // fresh
    markBackfilling(name, isPrice ? keyKline : keyFlow, true);
    let end = Math.floor(Date.now() / 1000) + 60;
    let guard = 0;
    const pages = m15PagesFor(days, 12);
    while (end * 1000 > targetFrom && guard++ < pages) {
      try {
        const rows = isPrice ? await fetchKlines(k, "m15", 500, end) : (await fetchFlows(k, "m15", 500, end)).map((r) => ({ t: r[0], b: r[1], s: r[2] }));
        if (!rows.length) break;
        const mapped = isPrice
          ? (rows as KlineRow[]).map((r) => ({ t: 1000 * Number(r[0]), o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5] }))
          : (rows as { t: number }[]);
        append(name, mapped, isPrice ? keyKline : keyFlow);
        const minTs = Math.min(...mapped.map((r: { t: number }) => r.t));
        if (minTs >= end * 1000 - STEP_MS) break;
        end = Math.floor(minTs / 1000) - 1;
        await new Promise((r) => setTimeout(r, 600));
      } catch {
        break;
      }
    }
    markBackfilling(name, isPrice ? keyKline : keyFlow, false, Date.now());
    markPoll(name, isPrice ? keyKline : keyFlow);
  }
}

/** backfill m15 klines for the curated universe (continuity on boot) */
async function backfillAllAssets(days: number) {
  const backMs = days * 86_400_000;
  for (const sym of continuitySyms()) {
    const inst = leadInstr(sym);
    const name = `kline:${inst}:m15`;
    const stored = lastTs(name, keyKline) ?? 0;
    const targetFrom = Math.max(Date.now() - backMs, stored);
    if (Date.now() - targetFrom < STEP_MS) continue;
    markBackfilling(name, keyKline, true);
    let end = Math.floor(Date.now() / 1000) + 60;
    let guard = 0;
    try {
      // see m15PagesFor: legacy cap was a flat 8 pages
      while (end * 1000 > targetFrom && guard++ < m15PagesFor(days, 8)) {
        const rows = await fetchKlines(inst, "m15", 500, end);
        if (!rows.length) break;
        const mapped = rows.map((r) => ({ t: 1000 * Number(r[0]), o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5] }));
        append(name, mapped, keyKline);
        const minTs = Math.min(...mapped.map((r) => r.t));
        if (minTs >= end * 1000 - STEP_MS) break;
        end = Math.floor(minTs / 1000) - 1;
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch {
      /* venue not listed — skip */
    }
    markBackfilling(name, keyKline, false, Date.now());
    markPoll(name, keyKline);
  }
}

async function backfillStopmap(days: number) {
  const name = "stopmap";
  const stored = lastTs(name, keyStop) ?? 0;
  const backMs = days * 86_400_000;
  const targetFrom = Math.max(Date.now() - backMs, stored);
  if (Date.now() - targetFrom < 300_000) return;
  markBackfilling(name, keyStop, true);
  let end = Math.floor(Date.now() / 1000);
  let guard = 0;
  // a full liqHeatMap page is 288 × 5-min bars = exactly 1 day; tolerate
  // half-size pages by allowing 2 pages per requested day (legacy: days + 2)
  while (end * 1000 > targetFrom && guard++ < 2 * days + 2) {
    try {
      const w = await fetchStopmap(end);
      if (!w) break;
      const n = storeStopmap(w);
      const bars = w.prices ?? [];
      if (!bars.length) break;
      const minTs = 1000 * Number(bars[0][0]);
      if (n === 0 && minTs >= end * 1000 - 300_000) break;
      end = Math.floor(minTs / 1000) - 60;
      await new Promise((r) => setTimeout(r, 1200));
    } catch {
      break;
    }
  }
  markBackfilling(name, keyStop, false, Date.now());
  markPoll(name, keyStop);
}

async function backfillBookwalls(days: number) {
  // NOTE: both call sites pass Math.min(days, 2) — bookwall snapshots are the
  // heaviest series (~74k rows/day) so the boot backfill is deliberately
  // capped at 2 days; 2 d = 192 m15 snaps = 2 full pages of 150, and the
  // m15PagesFor guard (worst-case 100-snap pages) yields 4 pages for that —
  // same bound as the legacy flat cap, now derived instead of hardcoded.
  const name = "bookwalls";
  const stored = lastTs(name, keyWall) ?? 0;
  const backMs = days * 86_400_000;
  const targetFrom = Math.max(Date.now() - backMs, stored);
  if (Date.now() - targetFrom < STEP_MS) return;
  markBackfilling(name, keyWall, true);
  let end = Math.floor(Date.now() / 1000);
  let guard = 0;
  while (end * 1000 > targetFrom && guard++ < m15PagesFor(days, 4)) {
    try {
      const { snaps } = await fetchWallSnapshots(150, end);
      if (!snaps.length) break;
      storeWalls(snaps);
      const minTs = snaps[0].t;
      if (minTs >= end * 1000 - STEP_MS) break;
      end = Math.floor(minTs / 1000) - 60;
      await new Promise((r) => setTimeout(r, 1500));
    } catch {
      break;
    }
  }
  markBackfilling(name, keyWall, false, Date.now());
  markPoll(name, keyWall);
}

async function boot(days: number) {
  await backfillKlineAndFlows(days).catch(() => undefined);
  await backfillAllAssets(days).catch(() => undefined);
  await backfillStopmap(days).catch(() => undefined);
  await backfillBookwalls(Math.min(days, 2)).catch(() => undefined);
  // point-in-time series have no upstream history; a fresh snapshot now:
  await pollLto().catch(() => undefined);
  await pollLiqLevels().catch(() => undefined);
  await pollKline().catch(() => undefined);
  await pollFlows().catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Engine control
// ---------------------------------------------------------------------------

export function ensureEngine(): { started: boolean; startedAt: number; bootDone: Promise<void> | null } {
  if (engine.started || process.env.CG_ENGINE === "off") return engine;
  engine.started = true;
  engine.startedAt = Date.now();
  startMemWatch(); // 2026-11-11 postmortem: RSS/heap telemetry every 5 min
  const days = Math.max(1, Math.min(30, Number(process.env.CG_ENGINE_BACKFILL_DAYS ?? 3) || 3));
  // gentle boot: let the server finish its own startup work first
  const bootDelay = Number(process.env.CG_ENGINE_BOOT_DELAY_MS ?? 15_000) || 15_000;
  engine.bootDone = new Promise<void>((resolve) => {
    const t = setTimeout(() => {
      boot(days)
        .catch(() => undefined)
        .finally(() => resolve());
    }, bootDelay);
    t.unref?.();
  });
  // staggered pollers (each fires first after its own delay + interval).
  // Overlap guard: a pass that outlives its interval (slow upstream, 429
  // backoffs) must NOT stack a second concurrent pass — the pileup amplifies
  // rate-limit episodes and multiplies transient heap pressure.
  const t = (ms: number, firstDelay: number, fn: () => Promise<void>) => {
    let busy = false;
    const run = () => {
      if (busy) return; // previous pass still in flight — skip this tick
      busy = true;
      fn()
        .catch(() => undefined)
        .finally(() => {
          busy = false;
        });
    };
    const first = setTimeout(() => {
      run();
      const id = setInterval(run, ms);
      id.unref?.();
      engine.timers.push(id);
    }, firstDelay);
    first.unref?.();
  };
  t(POLL_KLINE, 20_000, pollKline);
  t(POLL_KLINE, 25_000, pollFlows);
  t(POLL_KLINE, 35_000, pollAssetKlines);
  t(POLL_LTO, 30_000, pollLto);
  t(POLL_STOPMAP, 60_000, pollStopmap);
  t(POLL_BOOKWALLS, 90_000, pollBookwalls);
  t(POLL_LIQLEVELS, 45_000, pollLiqLevels);
  // live notification scanner (all assets, all tabs)
  startScanner();
  // never let an unexpected rejection kill the host process
  process.on?.("unhandledRejection", (r) => console.warn("[cg-engine] unhandled rejection:", r));
  return engine;
}

export function engineStatus() {
  const e = ensureEngine();
  const days = Number(process.env.CG_ENGINE_BACKFILL_DAYS ?? 3) || 3;
  const series = [
    stat("kline:Binance_BTCUSDT:m15", keyKline),
    stat("stopmap", keyStop),
    stat("bookwalls", keyWall),
    stat("lto:open", keyLto),
    stat("liqlevels:3d", keyLiq),
  ];
  // per-asset kline continuity (curated universe + legacy Tier-1 extras)
  const assetSeries: { asset: string; count: number; lastTs: number | null; lastError: string | null; gaps: number }[] = [];
  for (const sym of continuitySyms()) {
    if (sym === "BTC") continue;
    const s = stat(`kline:${leadInstr(sym)}:m15`, keyKline);
    assetSeries.push({ asset: sym, count: s.count, lastTs: s.lastTs, lastError: s.lastError, gaps: gapCount(`kline:${leadInstr(sym)}:m15`, keyKline, STEP_MS) });
  }
  // per-instrument flows
  const flowNames = engine.instrumentKeys ?? [];
  for (const k of flowNames) {
    series.push(stat(`bs_usd:${k}:m15`, keyFlow));
  }
  return {
    enabled: process.env.CG_ENGINE !== "off",
    started: e.started,
    startedAt: e.startedAt,
    backfillDays: days,
    instrumentKeys: flowNames,
    series,
    assetSeries,
    klineGaps: gapCount("kline:Binance_BTCUSDT:m15", keyKline, STEP_MS),
    dataDir: process.env.CG_DATA_DIR || "data/cg-series",
  };
}

/** trigger a gap-fill pass right now (used by POST /api/cg/engine/backfill) */
export async function forceBackfill() {
  const e = ensureEngine();
  if (e.bootDone) await e.bootDone.catch(() => undefined);
  const days = Number(process.env.CG_ENGINE_BACKFILL_DAYS ?? 3) || 3;
  await Promise.allSettled([
    backfillKlineAndFlows(days),
    backfillAllAssets(days),
    backfillStopmap(days),
    backfillBookwalls(Math.min(days, 2)),
    pollLto(),
    pollLiqLevels(),
  ]);
  return engineStatus();
}
