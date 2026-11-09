/**
 * Local persistence for the continuity engine — append-only JSONL stores
 * under <project>/data/cg-series/<name>.jsonl with in-memory dedup by key.
 *
 * The engine appends every polled series; on restart, the boot backfill
 * pages upstream history (endTime pagination) from the last stored
 * timestamp so nothing between shutdown and startup is lost.
 */
import fs from "fs";
import path from "path";

export interface SeriesStat {
  name: string;
  count: number;
  firstTs: number | null;
  lastTs: number | null;
  lastPoll: number | null;
  lastError: string | null;
  backfilling: boolean;
  backfilledMs: number | null;
}

interface StoreState {
  keys: Set<string>;
  rows: unknown[];
  lastTs: number | null;
  lastPoll: number | null;
  lastError: string | null;
  backfilling: boolean;
  backfilledMs: number | null;
  hydrated: boolean;
}

const ROOT = process.env.CG_DATA_DIR || path.join(process.cwd(), "data", "cg-series");

/**
 * The store map lives on globalThis: Next.js dev mode can instantiate this
 * module once per route bundle — a shared map keeps the engine writer and
 * the API readers on one in-memory source of truth (files remain the
 * persistence layer).
 */
const gStore = globalThis as unknown as { __cgStores?: Map<string, StoreState> };
const stores: Map<string, StoreState> = (gStore.__cgStores ??= new Map());

function fileOf(name: string) {
  return path.join(ROOT, `${name.replace(/[^A-Za-z0-9_:.\-]/g, "_")}.jsonl`);
}

function load(name: string, keyOf: (row: any) => string): StoreState {
  let st = stores.get(name);
  if (st && st.hydrated) return st;
  if (!st) {
    st = { keys: new Set(), rows: [], lastTs: null, lastPoll: null, lastError: null, backfilling: false, backfilledMs: null, hydrated: false };
    stores.set(name, st);
  }
  // (re-)hydrate from disk until the first successful read — an empty cache
  // created before the engine wrote the file must not stick
  try {
    fs.mkdirSync(ROOT, { recursive: true });
    const f = fileOf(name);
    if (fs.existsSync(f)) {
      const text = fs.readFileSync(f, "utf8");
      for (const line of text.split("\n")) {
        if (!line.trim()) continue;
        try {
          const row = JSON.parse(line);
          const k = keyOf(row);
          if (st.keys.has(k)) continue;
          st.keys.add(k);
          st.rows.push(row);
          const t = Number(row.t ?? row.ts ?? row.at ?? 0);
          if (t > (st.lastTs ?? 0)) st.lastTs = t;
        } catch {
          /* skip corrupt line */
        }
      }
    }
  } catch {
    /* fresh store */
  }
  st.hydrated = true;
  return st;
}

/** Append rows (deduped by keyOf). Returns the number of NEW rows stored. */
export function append(name: string, rows: unknown[], keyOf: (row: any) => string): number {
  const st = load(name, keyOf);
  if (!rows.length) return 0;
  const fresh: unknown[] = [];
  for (const r of rows) {
    const k = keyOf(r);
    if (st.keys.has(k)) continue;
    st.keys.add(k);
    st.rows.push(r);
    fresh.push(r);
    const t = Number((r as { t?: number; ts?: number; at?: number }).t ?? (r as { ts?: number }).ts ?? (r as { at?: number }).at ?? 0);
    if (t > (st.lastTs ?? 0)) st.lastTs = t;
  }
  if (!fresh.length) return 0;
  try {
    fs.mkdirSync(ROOT, { recursive: true });
    fs.appendFileSync(fileOf(name), fresh.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
  } catch {
    /* disk issues shouldn't kill the engine */
  }
  return fresh.length;
}

export function lastTs(name: string, keyOf: (row: any) => string): number | null {
  return load(name, keyOf).lastTs;
}

export function rowsOf(name: string, keyOf: (row: any) => string): unknown[] {
  return load(name, keyOf).rows;
}

export function markPoll(name: string, keyOf: (row: any) => string, error?: string) {
  const st = load(name, keyOf);
  st.lastPoll = Date.now();
  st.lastError = error ?? null;
}

export function markBackfilling(name: string, keyOf: (row: any) => string, on: boolean, doneTo?: number) {
  const st = load(name, keyOf);
  st.backfilling = on;
  if (doneTo) st.backfilledMs = doneTo;
}

export function stat(name: string, keyOf: (row: any) => string): SeriesStat {
  const st = load(name, keyOf);
  return {
    name,
    count: st.rows.length,
    firstTs: st.rows.length ? Number((st.rows[0] as { t?: number }).t ?? (st.rows[0] as { ts?: number }).ts ?? (st.rows[0] as { at?: number }).at ?? 0) : null,
    lastTs: st.lastTs,
    lastPoll: st.lastPoll,
    lastError: st.lastError,
    backfilling: st.backfilling,
    backfilledMs: st.backfilledMs,
  };
}

/** simple integer-hour gap count for kline-style series (stepSec bars) */
export function gapCount(name: string, keyOf: (row: any) => string, stepMs: number): number {
  const st = load(name, keyOf);
  const ts = st.rows.map((r) => Number((r as { t?: number }).t ?? 0)).sort((a, b) => a - b);
  let gaps = 0;
  for (let i = 1; i < ts.length; i++) {
    const d = ts[i] - ts[i - 1];
    if (d > stepMs * 1.5) gaps += Math.round(d / stepMs) - 1;
  }
  return gaps;
}
