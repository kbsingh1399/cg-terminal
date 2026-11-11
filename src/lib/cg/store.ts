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
  /** set after the first write error so each series logs only once */
  writeWarned?: boolean;
}

const ROOT = process.env.CG_DATA_DIR || path.join(process.cwd(), "data", "cg-series");

/**
 * Retention cap: per-series in-memory rows AND compacted file rows.
 * Routes never read historical rows (they fetch live upstream), so old rows
 * only matter for continuity bookkeeping (lastTs/gaps) — capping keeps disk
 * and memory bounded after months of uptime. bookwalls grows ~74k rows/day.
 */
const MAX_ROWS = Math.max(2_000, Number(process.env.CG_STORE_MAX_ROWS ?? 60_000) || 60_000);

/**
 * The store map lives on globalThis: Next.js dev mode can instantiate this
 * module once per route bundle — a shared map keeps the engine writer and
 * the API readers on one in-memory source of truth (files remain the
 * persistence layer).
 */
const gStore = globalThis as unknown as { __cgStores?: Map<string, StoreState> };
const stores: Map<string, StoreState> = (gStore.__cgStores ??= new Map());

/**
 * Windows-safe filename: `:` is illegal on NTFS/FAT (and would silently
 * redirect into an NTFS alternate data stream). Series names keep their
 * `name:key` form as MAP keys — only the on-disk filename is flattened.
 */
function fileOf(name: string) {
  return path.join(ROOT, `${name.replace(/[^A-Za-z0-9_.\-]/g, "_")}.jsonl`);
}

/** pre-retention filename scheme (allowed `:`) — used only for migration */
function legacyFileOf(name: string) {
  return path.join(ROOT, `${name.replace(/[^A-Za-z0-9_:.\-]/g, "_")}.jsonl`);
}

/** one-time rename of a legacy `:`-filename store to the safe name */
function migrateLegacy(name: string) {
  const f = fileOf(name);
  const legacy = legacyFileOf(name);
  if (legacy === f) return;
  try {
    if (!fs.existsSync(f) && fs.existsSync(legacy)) fs.renameSync(legacy, f);
  } catch {
    /* keep both; the safe file simply starts fresh */
  }
}

function load(name: string, keyOf: (row: any) => string): StoreState {
  let st = stores.get(name);
  if (st && st.hydrated) return st;
  if (!st) {
    st = { keys: new Set(), rows: [], lastTs: null, lastPoll: null, lastError: null, backfilling: false, backfilledMs: null, hydrated: false, writeWarned: false };
    stores.set(name, st);
  }
  // (re-)hydrate from disk until the first successful read — an empty cache
  // created before the engine wrote the file must not stick
  try {
    fs.mkdirSync(ROOT, { recursive: true });
    migrateLegacy(name);
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
      // hydrate at most the retention cap (oldest lines dropped)
      if (st.rows.length > MAX_ROWS) {
        st.rows = st.rows.slice(-MAX_ROWS);
        st.keys = new Set(st.rows.map((r) => keyOf(r)));
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
  // retention: trim in-memory to the cap; rewrite the file when meaningfully
  // over (avoids rewriting on every append)
  let compact = false;
  if (st.rows.length > MAX_ROWS * 1.2) {
    st.rows = st.rows.slice(-MAX_ROWS);
    st.keys = new Set(st.rows.map((r) => keyOf(r)));
    compact = true;
  }
  try {
    fs.mkdirSync(ROOT, { recursive: true });
    if (compact) {
      // atomic rewrite: write a sibling temp file, then rename over the target
      // (rename is atomic on POSIX and NTFS same-volume) — a crash mid-write
      // must never truncate months of continuity history
      const file = fileOf(name);
      const tmp = file + ".tmp";
      fs.writeFileSync(tmp, st.rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
      fs.renameSync(tmp, file);
    } else {
      fs.appendFileSync(fileOf(name), fresh.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
    }
  } catch (e) {
    // compaction failed: the fresh rows exist ONLY in memory now — append at
    // least those so a restart in this window cannot lose rows the UI already
    // saw (lto:open has no upstream history to re-backfill from)
    if (compact) {
      try {
        fs.appendFileSync(fileOf(name), fresh.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
      } catch {
        /* disk gone — nothing more to do */
      }
    }
    // disk issues must not kill the engine, but silence here hides Windows
    // filename problems — log once per series per process
    if (!st.writeWarned) {
      st.writeWarned = true;
      console.warn(`[cg-store] write failed for ${name}:`, e instanceof Error ? e.message : e);
    }
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
