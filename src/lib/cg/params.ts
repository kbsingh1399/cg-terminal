/**
 * Shared upstream-param validation for API routes.
 *
 * Query params must NEVER be interpolated into upstream URLs unvalidated:
 * URLSearchParams.get() decodes %26/%23, so a raw `interval` can inject
 * arbitrary upstream query params (&limit=... — clamp bypass, response
 * amplification) or truncate the query (#). These helpers are the single
 * chokepoint: allowlist intervals, clamp limits from BOTH sides, and
 * shape-check instrument keys.
 */

export const INTERVALS = new Set(["m1", "m3", "m5", "m15", "m30", "h1", "h2", "h4", "h6", "h12", "d1", "w1"]);

/** Returns the interval if allowlisted, else null (route should 400). */
export function parseInterval(v: string | null, fallback = "m15"): string | null {
  const s = (v ?? fallback).trim();
  return INTERVALS.has(s) ? s : null;
}

/** Clamp a numeric limit from both sides (fallback on garbage/negative). */
export function clampLimit(v: string | null, fallback: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}

/** Instrument keys are `Exchange_SYMBOLQUOTE` — shape-gate before upstream use. */
export function instrumentKeyOK(s: string): boolean {
  return /^[A-Za-z0-9_-]{3,48}$/.test(s);
}
