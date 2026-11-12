/**
 * Live notification bus — aggregates events from every terminal tab
 * (footprint signals, indicator events, whale orders, liquidation
 * clusters, CVD divergences) into one queryable, persistent feed.
 *
 *  - in-memory ring buffer (last 2000) + JSONL persistence so the feed
 *    survives restarts (boot continuity)
 *  - SSE subscribers get every new event in real time
 *  - MCP clients (Antigravity) poll /api/cg/notifications?since=<id>
 */

import fs from "fs";
import path from "path";
import { resolveDataRoot } from "./store";

export type NotifSource = "footprint" | "indicators" | "whale-orders" | "liqlevels" | "cvd" | "engine";
export type NotifDir = "bullish" | "bearish" | "neutral";

export interface CgNotification {
  id: number; // monotonic
  ts: number; // event time (ms)
  asset: string; // BTC, ETH, …
  source: NotifSource;
  kind: string; // e.g. "absorption", "rsi_ob", "vwap_band_cross", "new_wall"
  dir: NotifDir;
  severity: "info" | "high";
  title: string;
  detail: string;
  price: number | null;
  barTs?: number; // the bar that produced it (unix sec, for jump-to)
  barType?: "time" | "vol" | "range";
  meta?: Record<string, unknown>;
}

// CRITICAL (2026-11-12 fix): same standalone-cwd trap as store.ts — the
// notification feed must survive rebuilds, so it lives in the PROJECT
// data/cg-series, never inside .next/standalone (wiped by next build).
const ROOT = resolveDataRoot();
const FEED_FILE = path.join(ROOT, "notifications.jsonl");
const MAX = 2000;

interface BusState {
  nextId: number;
  items: CgNotification[];
  subs: Set<(n: CgNotification) => void>;
  /** recent emit keys for 30-min dedup (asset|source|kind|barTs|barType|price) */
  seen: Map<string, number>;
}

const g = globalThis as unknown as { __cgNotifyBus?: BusState };
const bus: BusState = (g.__cgNotifyBus ??= { nextId: 1, items: [], subs: new Set(), seen: new Map() });

function loadFromDisk() {
  if (bus.items.length || bus.nextId > 1) return;
  try {
    if (fs.existsSync(FEED_FILE)) {
      const text = fs.readFileSync(FEED_FILE, "utf8");
      for (const line of text.split("\n")) {
        if (!line.trim()) continue;
        try {
          const n = JSON.parse(line) as CgNotification;
          if (n && Number.isFinite(n.id)) {
            bus.items.push(n);
            if (n.id >= bus.nextId) bus.nextId = n.id + 1;
          }
        } catch {
          /* skip */
        }
      }
      if (bus.items.length > MAX) bus.items = bus.items.slice(-MAX);
    }
  } catch {
    /* fresh */
  }
}

/**
 * Emit a notification, deduped per asset|source|kind|barTs|barType|price within
 * 30 min. `price` is part of the key on purpose: whale walls and sweep setups
 * carry no barTs, so without it every distinct wall/cluster at a different
 * price would collapse into one event and be silently dropped.
 */
export function emit(n: Omit<CgNotification, "id">): CgNotification | null {
  loadFromDisk();
  const priceKey = n.price != null && Number.isFinite(n.price) ? n.price.toPrecision(6) : "";
  const dedupKey = `${n.asset}|${n.source}|${n.kind}|${n.barTs ?? ""}|${n.barType ?? ""}|${priceKey}`;
  const prev = bus.seen.get(dedupKey);
  if (prev && Date.now() - prev < 30 * 60_000) return null;
  bus.seen.set(dedupKey, Date.now());
  if (bus.seen.size > 4000) {
    const cutoff = Date.now() - 30 * 60_000;
    for (const [k, t] of bus.seen) if (t < cutoff) bus.seen.delete(k);
  }
  const full: CgNotification = { ...n, id: bus.nextId++ };
  bus.items.push(full);
  if (bus.items.length > MAX) bus.items = bus.items.slice(-MAX);
  try {
    fs.mkdirSync(ROOT, { recursive: true });
    fs.appendFileSync(FEED_FILE, JSON.stringify(full) + "\n", "utf8");
  } catch {
    /* disk issues must never kill the bus */
  }
  for (const fn of bus.subs) {
    try {
      fn(full);
    } catch {
      /* subscriber error */
    }
  }
  return full;
}

export function subscribe(fn: (n: CgNotification) => void): () => void {
  loadFromDisk();
  bus.subs.add(fn);
  return () => bus.subs.delete(fn);
}

export interface FeedQuery {
  sinceId?: number;
  asset?: string;
  source?: string;
  dir?: string;
  limit?: number;
}

export function listFeed(q: FeedQuery = {}): CgNotification[] {
  loadFromDisk();
  let out = bus.items;
  if (q.sinceId != null && Number.isFinite(q.sinceId)) out = out.filter((n) => n.id > q.sinceId!);
  if (q.asset) out = out.filter((n) => n.asset === q.asset!.toUpperCase());
  if (q.source) out = out.filter((n) => n.source === q.source);
  if (q.dir) out = out.filter((n) => n.dir === q.dir);
  const limit = Math.min(Math.max(q.limit ?? 200, 1), 1000);
  return out.slice(-limit);
}

export function feedStats() {
  loadFromDisk();
  const last24h = bus.items.filter((n) => Date.now() - n.ts < 86_400_000);
  const bySource: Record<string, number> = {};
  for (const n of last24h) bySource[n.source] = (bySource[n.source] ?? 0) + 1;
  return {
    total: bus.items.length,
    lastId: bus.items.length ? bus.items[bus.items.length - 1].id : 0,
    last24h: last24h.length,
    bySource,
    subscribers: bus.subs.size,
  };
}
