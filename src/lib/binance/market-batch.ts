import { fapiFetch } from "@/lib/live/fapi";

/**
 * Shared ALL-SYMBOL fapi batch caches for the market stats block.
 *
 * Why: the old per-symbol market route issued 3 fapi requests per symbol per
 * 3s TTL (ticker/24hr + premiumIndex + openInterest). A 58-asset grid or a
 * coverage probe fanning over the universe therefore produced up to
 * 3 × 58 requests per cache cycle — the primary driver of the 2400 req/min
 * shared-egress 429 storms observed 2026-11-12.
 *
 * Binance serves the same data in TWO all-symbol batch calls:
 *   /fapi/v1/ticker/24hr    (weight 40, every symbol)
 *   /fapi/v1/premiumIndex   (weight 10, every symbol)
 * A single shared pair of fetches with a 4s TTL now serves ticker + mark +
 * funding for the WHOLE universe. openInterest stays per-symbol (no batch
 * endpoint exists) with its own 10s per-symbol TTL.
 *
 * Failure semantics match the repo standard: stale-serve on upstream error,
 * in-flight coalescing, honest section absence.
 */

interface BatchState<T> {
  at: number;
  data: Map<string, T> | null;
  err?: string;
  inflight: Promise<void> | null;
}

const g = globalThis as unknown as {
  __binT24All?: BatchState<Record<string, string>>;
  __binPremAll?: BatchState<Record<string, string>>;
  __binOi?: Map<string, { at: number; oi: { contracts: number; usd: number | null } | null }>;
};
const TTL_MS = 4_000;
const OI_TTL_MS = 10_000;

async function refreshAll<T>(slot: BatchState<T>, path: string): Promise<void> {
  slot.err = undefined;
  try {
    const arr = (await fapiFetch(path, 8_000)) as Record<string, string>[];
    if (!Array.isArray(arr) || arr.length === 0) throw new Error(`${path}: empty`);
    const m = new Map<string, Record<string, string>>();
    for (const row of arr) {
      if (row && typeof row.symbol === "string") m.set(row.symbol, row);
    }
    slot.data = m as unknown as Map<string, T>;
    slot.at = Date.now();
  } catch (err) {
    slot.err = err instanceof Error ? err.message : "fetch failed";
  }
}

async function ensure<T>(slot: BatchState<T>, path: string): Promise<Map<string, T> | null> {
  if (!slot.data || Date.now() - slot.at >= TTL_MS) {
    if (!slot.inflight) {
      slot.inflight = refreshAll(slot, path).finally(() => {
        slot.inflight = null;
      });
    }
    await slot.inflight;
  }
  return slot.data;
}

export async function t24Of(pair: string): Promise<Record<string, string> | null> {
  const slot = (g.__binT24All ??= { at: 0, data: null, inflight: null });
  const m = await ensure(slot, "/fapi/v1/ticker/24hr");
  if (!m) throw new Error(`ticker batch: ${slot.err ?? "no data"}`);
  return m?.get(pair) ?? null;
}

export async function premOf(pair: string): Promise<Record<string, string> | null> {
  const slot = (g.__binPremAll ??= { at: 0, data: null, inflight: null });
  const m = await ensure(slot, "/fapi/v1/premiumIndex");
  if (!m) throw new Error(`premium batch: ${slot.err ?? "no data"}`);
  return m?.get(pair) ?? null;
}

/** Per-symbol open interest with a 10s shared TTL (no batch endpoint). */
export async function oiOf(pair: string, priceForUsd: number): Promise<{ contracts: number; usd: number | null } | null> {
  const cache = (g.__binOi ??= new Map());
  const hit = cache.get(pair);
  if (hit && Date.now() - hit.at < OI_TTL_MS) return hit.oi;
  try {
    const d = (await fapiFetch(`/fapi/v1/openInterest?symbol=${pair}`, 5_000)) as Record<string, string>;
    const contracts = Number(d?.openInterest);
    if (!Number.isFinite(contracts) || contracts < 0) throw new Error("bad oi body");
    const oi = { contracts, usd: priceForUsd > 0 ? contracts * priceForUsd : null };
    if (cache.size > 128) {
      // drop the oldest quarter — cheap and bounded
      const keys = [...cache.keys()].slice(0, 32);
      for (const k of keys) cache.delete(k);
    }
    cache.set(pair, { at: Date.now(), oi });
    return oi;
  } catch {
    return hit?.oi ?? null; // stale-serve on error
  }
}
