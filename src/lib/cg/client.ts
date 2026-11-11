import { cgHeaders, decryptCgResponse } from "./crypto";

/**
 * Server-side client for the Coinglass web API (capi.coinglass.com),
 * including the encrypted-response handling and a small TTL cache.
 */

const CAPI = "https://capi.coinglass.com";
const FAPI = "https://fapi.coinglass.com";

export { FAPI, CAPI };

interface CacheEntry {
  at: number;
  data: unknown;
}

/** on globalThis: dev mode can instantiate this module per route bundle —
 *  one shared cache keeps TTL politeness intact (project convention). */
const gC = globalThis as unknown as { __cgClientCache?: Map<string, CacheEntry>; __cgClientInflight?: Map<string, Promise<unknown>> };
const cache = (gC.__cgClientCache ??= new Map());
/** in-flight request coalescing: N concurrent misses for one URL = 1 fetch */
const inflight = (gC.__cgClientInflight ??= new Map());

/**
 * Bound the upstream cache: unique URLs (endTime-paginated backfills add new
 * ones every restart) would otherwise grow the Map forever. Insertion-order
 * eviction keeps the newest entries — they are the ones likely to be re-hit.
 */
const CACHE_MAX = Math.max(50, Number(process.env.CG_CLIENT_CACHE_MAX ?? 800) || 800);

function cacheSet(url: string, data: unknown) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(url, { at: Date.now(), data });
}

async function rawGet(url: string, cacheTs: string): Promise<{ status: number; headers: Record<string, string>; bodyText: string }> {
  const res = await fetch(url, {
    headers: cgHeaders(cacheTs),
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    headers[k] = v;
  });
  return { status: res.status, headers, bodyText: await res.text() };
}

async function cgGetInner(pathAndQuery: string, ttlMs: number, host: string): Promise<unknown> {
  const url = `${host}${pathAndQuery}`;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data;

  const cacheTs = String(Date.now());
  let resp = await rawGet(url, cacheTs);
  // rate-limited: honor Retry-After (fallback 5 s) and retry once — a burst
  // of 429s must back off, not hammer upstream in a hot retry loop
  if (resp.status === 429) {
    const ra = Number(resp.headers["retry-after"]);
    const waitMs = Math.min(Math.max(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 5_000, 1_000), 30_000);
    await new Promise((r) => setTimeout(r, waitMs));
    resp = await rawGet(url, String(Date.now()));
  }
  if (resp.status !== 200) {
    // stale-serve is a soft-fail LADDER, only for cached endpoints with a
    // real TTL and only within a bounded age. ttlMs === 0 means "always
    // fresh" (engine writers): returning stale there would silently freeze
    // a series while engineStatus reports it healthy — fail loudly instead.
    const stale = cache.get(url);
    if (stale && ttlMs > 0 && Date.now() - stale.at < Math.max(10 * ttlMs, 60_000)) return stale.data;
    throw new Error(`upstream HTTP ${resp.status} for ${pathAndQuery}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(resp.bodyText);
  } catch {
    throw new Error(`upstream returned non-JSON for ${pathAndQuery}`);
  }
  // Plain responses: { code:"0", data: [...] } with non-string data
  const body = parsed as { code?: string; msg?: string; data?: unknown };
  if (body && typeof body === "object" && "data" in body && typeof (body as { data?: unknown }).data !== "string") {
    if (body.code !== "0" && Number(body.code) !== 0) throw new Error(`upstream code ${body.code}: ${body.msg ?? ""}`);
    cacheSet(url, body.data);
    return body.data;
  }
  // Encrypted responses carry a string data field
  const data = decryptCgResponse({ status: resp.status, headers: resp.headers, bodyText: resp.bodyText }, cacheTs, url);
  cacheSet(url, data);
  return data;
}

/**
 * GET a capi/fapi URL and return the decrypted payload.
 * `ttlMs` caches successful responses in memory to stay polite to upstream.
 * Concurrent misses for the same URL are coalesced into one upstream fetch.
 */
export async function cgGet(pathAndQuery: string, ttlMs = 15_000, host: string = CAPI): Promise<unknown> {
  const url = `${host}${pathAndQuery}`;
  const running = inflight.get(url);
  if (running) return running;
  const p = cgGetInner(pathAndQuery, ttlMs, host);
  inflight.set(url, p);
  try {
    return await p;
  } finally {
    inflight.delete(url);
  }
}
