/**
 * Shared Binance futures (fapi) client-side guard: a hard circuit breaker.
 *
 * fapi.binance.com enforces an IP weight budget (2400/min). Exceeding it
 * returns HTTP 429 and then 418 (IP ban, minutes to hours). Every fapi
 * consumer in this terminal MUST go through `fapiFetch` so that a ban
 * back-pressure ALL of them at once — during a ban we serve stale data
 * (marked) instead of hammering upstream and extending the ban.
 */

const FAPI = "https://fapi.binance.com";

const g = globalThis as unknown as { __fapiBreakerV2?: { until: number; why: string } };
const breaker = (g.__fapiBreakerV2 ??= { until: 0, why: "" });

export function fapiBanned(): { banned: boolean; until: number; why: string } {
  return { banned: Date.now() < breaker.until, until: breaker.until, why: breaker.why };
}

export class FapiBannedError extends Error {
  constructor(until: number) {
    super(`fapi IP ban active until ${new Date(until).toISOString()}`);
    this.name = "FapiBannedError";
  }
}

export async function fapiFetch(pathAndQuery: string, timeoutMs = 4_000): Promise<unknown> {
  const b = fapiBanned();
  if (b.banned) throw new FapiBannedError(b.until);
  const res = await fetch(`${FAPI}${pathAndQuery}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: "application/json" },
  });
  if (res.status === 429 || res.status === 418) {
    // PROBE-CAPPED backoff: never trust a long Retry-After blindly — real
    // bans often lift sooner (and hammering is already prevented by the
    // early check). A 60 s cap means at most one probe request per minute
    // while banned, and fast recovery the moment upstream forgives us.
    const waitMs = 60_000;
    breaker.until = Date.now() + waitMs;
    breaker.why = `HTTP ${res.status} (weight budget)`;
    throw new FapiBannedError(breaker.until);
  }
  if (res.status !== 200) throw new Error(`fapi HTTP ${res.status}`);
  return res.json();
}
