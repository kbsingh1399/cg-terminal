import { cgHeaders, decryptCgResponse } from "./crypto";

/**
 * Server-side client for the Coinglass web API (capi.coinglass.com),
 * including the encrypted-response handling and a small TTL cache.
 */

const CAPI = "https://capi.coinglass.com";
const FAPI = "https://fapi.coinglass.com";

export { FAPI };

interface CacheEntry {
  at: number;
  data: unknown;
}

const cache = new Map<string, CacheEntry>();

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

/**
 * GET a capi/fapi URL and return the decrypted payload.
 * `ttlMs` caches successful responses in memory to stay polite to upstream.
 */
export async function cgGet(pathAndQuery: string, ttlMs = 15_000, host: string = CAPI): Promise<unknown> {
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
    // stale cache better than an error for soft-failing cached endpoints
    const stale = cache.get(url);
    if (stale) return stale.data;
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
