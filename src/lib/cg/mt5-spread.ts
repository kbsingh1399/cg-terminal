/**
 * MT5 EXECUTION-COST FEED (WS7.3, 2026-11-13 directive).
 *
 * Reads the desk daemon's desk/mt5.json snapshot (written by
 * scripts/mt5_report.py every daemon cycle on the trader's machine) and
 * exposes per-asset live spread for the narrative engine's spread-adjusted
 * EV gate:
 *
 *   spreadDragRatio = spreadPct / stopDistPct
 *     > 0.25 → SKIP   (the spread eats a quarter of the risk unit)
 *     > 0.12 → grade C (SPREAD_DRAG_EXCESSIVE — edge eroded, trade smaller
 *                       or not at all)
 *
 * HONESTY RULES — identical to every other feed in this terminal:
 *   - missing file / missing symbol / broker "no tick" → null (checklist n/a,
 *     NO penalty: the gate only fires on verified live numbers);
 *   - snapshot older than MT5_SPREAD_STALE_MS (default 20 min) → reported
 *     with stale:true and treated as unavailable by the gate (stale spreads
 *     are worse than no spreads — they punish or pass setups on dead data).
 */

import fs from "node:fs";
import path from "node:path";

export interface Mt5SpreadInfo {
  sym: string;
  /** (ask − bid) / mid × 100 — verified live numbers only */
  spreadPct: number | null;
  spreadPoints: number | null;
  bid: number | null;
  ask: number | null;
  ok: boolean;
  reason?: string;
  /** age of the desk/mt5.json snapshot in ms */
  ageMs: number | null;
  stale: boolean;
  source: string;
}

const STALE_MS = Number(process.env.MT5_SPREAD_STALE_MS ?? 20 * 60_000) || 20 * 60_000;
const CACHE_TTL = 60_000;

interface CacheRow {
  at: number;
  mtimeMs: number;
  rows: Mt5SpreadInfo[];
  ts: number | null;
}

const g = globalThis as unknown as { __cgMt5SpreadCache?: CacheRow };
const READ_ROOT = process.env.CG_DATA_ROOT ?? path.join(process.cwd(), "data", "cg-series");
const MT5_FILE = path.join(path.dirname(READ_ROOT), "desk", "mt5.json");

interface Mt5FileSpread {
  ok?: boolean;
  asset?: string;
  bid?: number;
  ask?: number;
  spreadPoints?: number;
  spreadPct?: number;
  reason?: string;
}

interface Mt5File {
  ts?: number;
  spreads?: Record<string, Mt5FileSpread>;
}

function readAll(): CacheRow {
  const hit = g.__cgMt5SpreadCache;
  let mtimeMs = 0;
  try {
    mtimeMs = fs.statSync(MT5_FILE).mtimeMs;
  } catch {
    return { at: Date.now(), mtimeMs: -1, rows: [], ts: null };
  }
  if (hit && hit.mtimeMs === mtimeMs && Date.now() - hit.at < CACHE_TTL) return hit;

  let parsed: Mt5File | null = null;
  try {
    parsed = JSON.parse(fs.readFileSync(MT5_FILE, "utf8")) as Mt5File;
  } catch {
    parsed = null;
  }
  const ts = parsed?.ts ?? null;
  const ageMs = ts != null ? Date.now() - ts : null;
  const stale = ageMs == null ? true : ageMs > STALE_MS;
  const rows: Mt5SpreadInfo[] = [];
  if (parsed?.spreads) {
    for (const [mt5Sym, s] of Object.entries(parsed.spreads)) {
      const ok = s?.ok === true && Number.isFinite(s.spreadPct);
      rows.push({
        sym: String(s?.asset ?? mt5Sym.replace(/USD$/, "")),
        spreadPct: ok ? Number(s.spreadPct) : null,
        spreadPoints: Number.isFinite(s?.spreadPoints) ? Number(s.spreadPoints) : null,
        bid: Number.isFinite(s?.bid) ? Number(s.bid) : null,
        ask: Number.isFinite(s?.ask) ? Number(s.ask) : null,
        ok,
        reason: s?.reason,
        ageMs,
        stale,
        source: `desk/mt5.json (${mt5Sym})`,
      });
    }
  }
  const row: CacheRow = { at: Date.now(), mtimeMs, rows, ts };
  g.__cgMt5SpreadCache = row;
  return row;
}

/** Live MT5 spread for a terminal symbol — null when honestly unavailable. */
export function mt5SpreadOf(symRaw: string): Mt5SpreadInfo | null {
  const sym = symRaw.trim().toUpperCase();
  const { rows } = readAll();
  const hit = rows.find((r) => r.sym === sym);
  if (!hit) return null;
  // unavailable states are surfaced (age/reason) but the gate must not fire
  if (!hit.ok || hit.spreadPct == null || hit.stale) return hit;
  return hit;
}

/**
 * The WS7.3 spread-drag verdict.
 *   stopDistPct  — |entry − stop| / entry × 100
 *   spreadPct    — live MT5 spread as % of mid
 * Returns null when either input is missing (gate honest-off).
 */
export function spreadDragVerdict(
  spreadPct: number | null | undefined,
  stopDistPct: number | null | undefined
): { ratio: number; verdict: "SKIP" | "C" } | null {
  if (spreadPct == null || !(spreadPct >= 0)) return null;
  if (stopDistPct == null || !(stopDistPct > 0)) return null;
  const ratio = spreadPct / stopDistPct;
  if (ratio > 0.25) return { ratio, verdict: "SKIP" };
  if (ratio > 0.12) return { ratio, verdict: "C" };
  return null;
}
