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
    // REAL-WINDOW BACKOFF: Binance's 418 body carries the authoritative ban
    // end ("...auto-banned until 2026-11-11T16:09:25.641Z") and ANY request
    // made during the ban EXTENDS it — a fixed 60s probe loop can therefore
    // keep a ban alive forever. Parse the real end and stay silent past it
    // (+10s margin). Without a parseable end: exponential 60s→120s→240s→…
    // capped at 15 min, so a hostile/absent header can never pin us down
    // either. 429 honors Retry-After when sane (≤15 min).
    let until = 0;
    if (res.status === 429) {
      const ra = Number(res.headers.get("retry-after"));
      until = Number.isFinite(ra) && ra > 0 && ra <= 900 ? Date.now() + ra * 1000 : Date.now() + 60_000;
    } else {
      const body = (await res.text().catch(() => "")) as string;
      const m = body.match(/until (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)/i);
      if (m) {
        const t = Date.parse(m[1]);
        until = Number.isFinite(t) ? t + 10_000 : 0;
      }
      if (!until) {
        const prev = breaker.until;
        const step = prev > Date.now() ? Math.min((prev - Date.now()) * 2, 900_000) : 60_000;
        until = Date.now() + Math.max(60_000, step);
      }
    }
    breaker.until = until;
    breaker.why = `HTTP ${res.status} (weight budget)`;
    throw new FapiBannedError(breaker.until);
  }
  if (res.status !== 200) throw new Error(`fapi HTTP ${res.status}`);
  return res.json();
}
