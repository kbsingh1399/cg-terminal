import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/debug/mem — server memory introspection (bug-hunt R6).
 *
 * The terminal OOM-died at ~1.9GB RSS (kernel oom-kill, pid evidence in
 * dmesg) while serving, AND leaks ~20MB/min fully idle — so every
 * module-level structure must be measurable in production. This endpoint
 * walks every known globalThis-resident cache/buffer and reports sizes next
 * to process.memoryUsage(), so a growing structure names its owner module.
 * Read-only, no data leaves the server, force-dynamic.
 */

interface Row { k: string; size: number; note?: string }

function gVal<T = unknown>(key: string): T | undefined {
  return (globalThis as unknown as Record<string, T | undefined>)[key];
}

function mapSize(key: string, note?: string): Row | null {
  const m = gVal<Map<unknown, unknown>>(key);
  if (!m || typeof m.size !== "number") return null;
  return { k: key, size: m.size, note };
}

export async function GET() {
  const m = process.memoryUsage();
  const rows: Row[] = [];

  const push = (r: Row | null) => { if (r) rows.push(r); };

  push(mapSize("__cgClientCache", "cgGet TTL cache (cap 800 entries)"));
  const cb = gVal<{ n: number }>("__cgClientCacheBytes");
  if (cb) rows.push({ k: "__cgClientCacheBytes", size: Math.round(cb.n / 1048576), note: "MB of cached raw upstream bytes (budget 96MB)" });
  push(mapSize("__cgClientInflight", "cgGet in-flight coalesce"));
  push(mapSize("__cnbcCache", "cnbc route (cap 48)"));
  push(mapSize("__cgClassic", "classic route (cap 96)"));
  push(mapSize("__cotCache", "cot route (cap 32)"));
  push(mapSize("__cgPerpDepth", "perpdepth route (cap 32)"));
  push(mapSize("__cgTicker", "ticker route (sym-keyed)"));
  push(mapSize("__cgLivePrice", "server-price (sym-keyed)"));
  push(mapSize("__hlOiHist", "micro OI history (cap 26/coin)"));
  push(mapSize("__microHlSnap", "micro HL snapshot cache"));
  push(mapSize("__microHlBook", "micro HL book cache"));
  push(mapSize("__microLoBook", "micro Lighter book cache"));
  push(mapSize("__microLoTrades", "micro Lighter trades cache"));

  // engine store map: per-series rows/keys (capped 60k rows each)
  const stores = gVal<Map<string, { rows: unknown[]; keys: Set<string>; hydrated?: boolean }>>("__cgStores");
  if (stores) {
    let totalRows = 0;
    let totalKeys = 0;
    let series = 0;
    let maxSeries = "";
    let maxRows = 0;
    for (const [name, st] of stores) {
      series++;
      totalRows += st.rows?.length ?? 0;
      totalKeys += st.keys?.size ?? 0;
      if ((st.rows?.length ?? 0) > maxRows) { maxRows = st.rows?.length ?? 0; maxSeries = name; }
    }
    rows.push({ k: "__cgStores", size: series, note: `rows=${totalRows} keys=${totalKeys} max=${maxSeries}:${maxRows}` });
  }

  // notify bus: items ring + seen dedup + SSE subs
  const bus = gVal<{ items: unknown[]; seen: Map<string, number>; subs: Set<unknown> }>("__cgNotifyBus");
  if (bus) rows.push({ k: "__cgNotifyBus", size: bus.items?.length ?? 0, note: `seen=${bus.seen?.size ?? 0} subs=${bus.subs?.size ?? 0}` });

  // scanner: per-asset states incl. the grow-only seen sets
  const scanner = gVal<{
    states: Map<string, { seenSig: Set<string>; whaleSeen: Set<string>; cvdNotified: Set<string>; liqNotified: Map<string, number> }>;
    signals: Map<string, unknown>;
    whale: Map<string, unknown>;
    liq: Map<string, unknown>;
    cvd: Map<string, unknown>;
    ticks: number;
  }>("__cgScanner");
  if (scanner) {
    let seenSig = 0;
    let whaleSeen = 0;
    let cvd = 0;
    let liq = 0;
    for (const st of scanner.states.values()) {
      seenSig += st.seenSig?.size ?? 0;
      whaleSeen += st.whaleSeen?.size ?? 0;
      cvd += st.cvdNotified?.size ?? 0;
      liq += st.liqNotified?.size ?? 0;
    }
    rows.push({
      k: "__cgScanner",
      size: scanner.states.size,
      note: `ticks=${scanner.ticks} sigs=${scanner.signals.size} whale=${scanner.whale.size} liq=${scanner.liq.size} cvd=${scanner.cvd.size} seenSig=${seenSig} whaleSeen=${whaleSeen} cvdNotified=${cvd} liqNotified=${liq}`,
    });
  }

  // livebook rings: count + total ring entries
  const rings = gVal<Map<string, { snaps: unknown[]; timer: unknown }>>("__cgLiveBook");
  if (rings) {
    let snaps = 0;
    let timers = 0;
    for (const r of rings.values()) { snaps += r.snaps?.length ?? 0; if (r.timer) timers++; }
    rows.push({ k: "__cgLiveBook", size: rings.size, note: `snaps=${snaps} activeTimers=${timers}` });
  }

  // engine state
  const engine = gVal<{ started: boolean; startedAt: number; timers: unknown[] }>("__cgEngine");
  if (engine) rows.push({ k: "__cgEngine", size: engine.timers?.length ?? 0, note: `started=${engine.started} uptimeMin=${Math.round((Date.now() - engine.startedAt) / 60000)}` });

  const mem = {
    rss: Math.round(m.rss / 1048576),
    heapUsed: Math.round(m.heapUsed / 1048576),
    heapTotal: Math.round(m.heapTotal / 1048576),
    external: Math.round(m.external / 1048576),
    arrayBuffers: Math.round((m.arrayBuffers ?? 0) / 1048576),
    uptimeMin: Math.round(process.uptime() / 60),
  };

  return NextResponse.json({ ok: true, mem, structures: rows, at: Date.now() });
}
