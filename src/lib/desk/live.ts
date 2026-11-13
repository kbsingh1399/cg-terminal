import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getLivePrice } from "@/lib/live/server-price";
import { isClassic } from "@/lib/cg/classic";
import { microLiveQuote } from "@/lib/cg/micro";

/**
 * Read-only Desk & MT5 Bridge (V2 Cockpit).
 *
 * Reads `desk/state.json`, `desk/mt5.json`, and the tail of `desk/log.md`
 * without mutating any file. Enriches live broker orders/positions and
 * agent-suggested setups with live terminal prices and distance-to-level metrics.
 */

export interface Mt5OrderView {
  ticket: number;
  sym: string;
  mt5Symbol: string;
  type: string;
  side: "long" | "short";
  volume: number;
  entry: number;
  sl: number;
  tp: number;
  livePrice: number | null;
  distToEntryPct: number | null;
  riskR: number | null;
  placedTs: number;
  comment: string;
  spreadPct: number | null;
}

export interface Mt5PositionView {
  ticket: number;
  sym: string;
  mt5Symbol: string;
  side: "long" | "short";
  volume: number;
  openPrice: number;
  sl: number;
  tp: number;
  profitUsd: number;
  livePrice: number | null;
  distToSlPct: number | null;
  distToTpPct: number | null;
}

export interface DeskOrderView {
  id: string;
  round: string;
  sym: string;
  mt5Symbol: string;
  side: "long" | "short";
  type: string;
  status: string;
  entry: number;
  stop: number;
  targets: number[];
  riskR: number | null;
  regime: string | null;
  mode: string | null;
  rationale: string | null;
  notes: string | null;
  ticket: number | null;
  createdTs: number;
  expiresTs: number | null;
  livePrice: number | null;
  distToEntryPct: number | null;
}

export interface DeskRoundEntry {
  heading: string;
  lines: string[];
}

export interface DeskAssetScore {
  sym: string;
  price: number | null;
  chgDayPct: number | null;
  score: number | null;
  error: string | null;
}

export interface DeskLiveSnapshot {
  ok: boolean;
  ts: number;
  mt5: {
    ts: number | null;
    error: string | null;
    account: {
      currency: string;
      leverage: number;
      balance: number;
      equity: number;
      margin: number;
      marginFree: number;
      profit: number;
    } | null;
    positions: Mt5PositionView[];
    orders: Mt5OrderView[];
    slotsUsed: number;
    maxSlots: number;
  };
  analysis: {
    lastRound: string | null;
    lastRoundTs: number | null;
    engine: string | null;
    assets: DeskAssetScore[];
  };
  orders: DeskOrderView[];
  recentLog: DeskRoundEntry[];
}

const ROOT = (() => {
  const cwd = process.cwd();
  const candidates = [cwd, path.resolve(cwd, ".."), path.resolve(cwd, "..", "..")];
  for (const dir of candidates) {
    if (existsSync(path.join(/*turbopackIgnore: true*/ dir, "desk", "state.json"))) {
      return dir;
    }
  }
  return cwd;
})();

function readJsonSafe<T>(rel: string): T | null {
  try {
    const p = path.join(/*turbopackIgnore: true*/ ROOT, rel);
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
}

function parseLogTail(rel: string, maxRounds = 10): DeskRoundEntry[] {
  try {
    const p = path.join(/*turbopackIgnore: true*/ ROOT, rel);
    if (!existsSync(p)) return [];
    const txt = readFileSync(p, "utf8");
    const slice = txt.length > 24_000 ? txt.slice(-24_000) : txt;
    const blocks: DeskRoundEntry[] = [];
    let cur: DeskRoundEntry | null = null;
    for (const rawLine of slice.split(/\r?\n/)) {
      const line = rawLine.trimEnd();
      if (line.startsWith("## ")) {
        cur = { heading: line.slice(3).trim(), lines: [] };
        blocks.push(cur);
      } else if (cur && line.trim()) {
        cur.lines.push(line);
      }
    }
    return blocks.slice(-maxRounds).reverse();
  } catch {
    return [];
  }
}

function distPct(target: number, live: number | null): number | null {
  if (!Number.isFinite(target) || live == null || !(live > 0)) return null;
  return +(((target - live) / live) * 100).toFixed(3);
}

function calcR(side: "long" | "short", entry: number, sl: number, tp: number): number | null {
  if (!(entry > 0) || !(sl > 0) || !(tp > 0)) return null;
  const risk = side === "long" ? entry - sl : sl - entry;
  const reward = side === "long" ? tp - entry : entry - tp;
  if (!(risk > 0) || !(reward > 0)) return null;
  return +(reward / risk).toFixed(2);
}

interface RawState {
  config?: { max_concurrent_positions?: number; symbol_map?: Record<string, string> };
  analysis?: {
    last_round?: string;
    last_round_ts?: number;
    engine?: string;
    assets?: Record<string, { price?: number; chgDayPct?: number; score?: number; error?: string | null }>;
  };
  orders?: Array<{
    id: string;
    round?: string;
    sym?: string;
    asset?: string;
    mt5Symbol?: string;
    side?: "long" | "short" | string;
    action?: string;
    type?: string;
    status: string;
    entry?: number;
    stop?: number;
    targets?: number[];
    riskR?: number;
    regime?: string;
    mode?: string;
    rationale?: string;
    notes?: string;
    ticket?: number | null;
    createdTs?: number;
    expiresTs?: number | null;
  }>;
}

interface RawMt5 {
  ts?: number;
  error?: string | null;
  account?: {
    currency?: string;
    leverage?: number;
    balance?: number;
    equity?: number;
    margin?: number;
    margin_free?: number;
    profit?: number;
  };
  positions?: Array<{
    ticket: number;
    asset?: string;
    symbol: string;
    type?: string;
    side?: string;
    volume: number;
    price_open?: number;
    price?: number;
    sl?: number;
    tp?: number;
    profit?: number;
  }>;
  orders?: Array<{
    ticket: number;
    asset?: string;
    symbol: string;
    type: string;
    volume: number;
    price: number;
    sl?: number;
    tp?: number;
    placedTs?: number;
    comment?: string;
  }>;
  spreads?: Record<string, { spreadPct?: number; pct?: number; spread_pct?: number }>;
}

/** Fast lookup map for Screener Desk badges (`POS LONG`, `LIMIT SHORT`, `SUGGESTED`). */
export function getDeskIndex(): Map<string, { badge: string; tone: "pos" | "limit" | "suggested" }> {
  const map = new Map<string, { badge: string; tone: "pos" | "limit" | "suggested" }>();
  const st = readJsonSafe<RawState>("desk/state.json");
  const mt5 = readJsonSafe<RawMt5>("desk/mt5.json");
  const revSym = new Map<string, string>();
  for (const [k, v] of Object.entries(st?.config?.symbol_map ?? {})) {
    revSym.set(v.toUpperCase(), k.toUpperCase());
  }
  const norm = (asset?: string, mt5Sym?: string) =>
    (asset || revSym.get((mt5Sym ?? "").toUpperCase()) || (mt5Sym ?? "").replace(/USD$/i, "")).toUpperCase();

  for (const o of st?.orders ?? []) {
    const sym = (o.sym || o.asset) as string | undefined;
    const side = (o.side || o.action) as string | undefined;
    if (sym && side && (o.status === "suggested" || o.status === "placed" || o.status === "open" || o.status === "active")) {
      const s = sym.toUpperCase();
      if (!map.has(s)) {
        map.set(s, {
          badge: `${o.status === "suggested" ? "SUG" : "ORD"} ${side.toUpperCase()}`,
          tone: o.status === "suggested" ? "suggested" : "limit",
        });
      }
    }
  }
  for (const o of mt5?.orders ?? []) {
    const s = norm(o.asset, o.symbol);
    const side = o.type.toLowerCase().includes("sell") ? "SHORT" : "LONG";
    map.set(s, { badge: `MT5 ${side}`, tone: "limit" });
  }
  for (const p of mt5?.positions ?? []) {
    const s = norm(p.asset, p.symbol);
    const side = (p.side ?? p.type ?? "").toLowerCase().includes("sell") || (p.side ?? "").toLowerCase() === "short" ? "SHORT" : "LONG";
    map.set(s, { badge: `POS ${side}`, tone: "pos" });
  }
  return map;
}

export async function buildDeskLiveSnapshot(): Promise<DeskLiveSnapshot> {
  const state = readJsonSafe<RawState>("desk/state.json");
  const mt5 = readJsonSafe<RawMt5>("desk/mt5.json");
  const recentLog = parseLogTail("desk/log.md", 12);

  const revSym = new Map<string, string>();
  for (const [k, v] of Object.entries(state?.config?.symbol_map ?? {})) {
    revSym.set(v.toUpperCase(), k.toUpperCase());
  }
  const symOf = (asset?: string, mt5Sym?: string) =>
    (asset || revSym.get((mt5Sym ?? "").toUpperCase()) || (mt5Sym ?? "").replace(/USD$/i, "")).toUpperCase();

  // Gather unique active symbols cleanly so live prices fetch once per symbol
  const activeSyms = new Set<string>();
  for (const p of mt5?.positions ?? []) activeSyms.add(symOf(p.asset, p.symbol));
  for (const o of mt5?.orders ?? []) activeSyms.add(symOf(o.asset, o.symbol));
  for (const o of state?.orders ?? []) {
    const sym = (o.sym || o.asset) as string | undefined;
    if (sym && ["suggested", "placed", "open", "active"].includes(o.status)) activeSyms.add(sym.toUpperCase());
  }

  const priceMap = new Map<string, number | null>();
  await Promise.allSettled(
    [...activeSyms].map(async (s) => {
      if (isClassic(s)) {
        const mq = await microLiveQuote(s).catch(() => null);
        priceMap.set(s, mq?.price ?? null);
        return;
      }
      const lp = await getLivePrice(s).catch(() => null);
      priceMap.set(s, lp?.price ?? null);
    })
  );

  const mt5Positions: Mt5PositionView[] = (mt5?.positions ?? []).map((p) => {
    const sym = symOf(p.asset, p.symbol);
    const side: "long" | "short" =
      (p.side ?? p.type ?? "").toLowerCase().includes("sell") || (p.side ?? "").toLowerCase() === "short" ? "short" : "long";
    const livePrice = priceMap.get(sym) ?? null;
    const sl = Number(p.sl ?? 0);
    const tp = Number(p.tp ?? 0);
    return {
      ticket: p.ticket,
      sym,
      mt5Symbol: p.symbol,
      side,
      volume: Number(p.volume ?? 0),
      openPrice: Number(p.price_open ?? p.price ?? 0),
      sl,
      tp,
      profitUsd: Number(p.profit ?? 0),
      livePrice,
      distToSlPct: sl > 0 ? distPct(sl, livePrice) : null,
      distToTpPct: tp > 0 ? distPct(tp, livePrice) : null,
    };
  });

  const mt5Orders: Mt5OrderView[] = (mt5?.orders ?? []).map((o) => {
    const sym = symOf(o.asset, o.symbol);
    const side: "long" | "short" = o.type.toLowerCase().includes("sell") ? "short" : "long";
    const livePrice = priceMap.get(sym) ?? null;
    const sp = mt5?.spreads?.[o.symbol];
    return {
      ticket: o.ticket,
      sym,
      mt5Symbol: o.symbol,
      type: o.type,
      side,
      volume: Number(o.volume ?? 0),
      entry: Number(o.price ?? 0),
      sl: Number(o.sl ?? 0),
      tp: Number(o.tp ?? 0),
      livePrice,
      distToEntryPct: distPct(Number(o.price ?? 0), livePrice),
      riskR: calcR(side, Number(o.price ?? 0), Number(o.sl ?? 0), Number(o.tp ?? 0)),
      placedTs: Number(o.placedTs ?? 0),
      comment: o.comment ?? "",
      spreadPct: sp?.spreadPct ?? sp?.pct ?? sp?.spread_pct ?? null,
    };
  });

  const orders: DeskOrderView[] = [...(state?.orders ?? [])]
    .reverse()
    .slice(0, 20)
    .map((o) => {
      const sym = ((o.sym || o.asset || "") as string).toUpperCase();
      const livePrice = priceMap.get(sym) ?? null;
      const rawSide = String(o.side || o.action || "long").toLowerCase();
      const side: "long" | "short" = rawSide.includes("short") || rawSide.includes("sell") ? "short" : "long";
      return {
        id: o.id,
        round: o.round ?? "–",
        sym,
        mt5Symbol: o.mt5Symbol ?? `${sym}USD`,
        side,
        type: o.type ?? "limit",
        status: o.status,
        entry: o.entry ?? 0,
        stop: o.stop ?? 0,
        targets: o.targets ?? [],
        riskR: o.riskR ?? null,
        regime: o.regime ?? null,
        mode: o.mode ?? null,
        rationale: o.rationale ?? null,
        notes: o.notes ?? null,
        ticket: o.ticket ?? null,
        createdTs: o.createdTs ?? 0,
        expiresTs: o.expiresTs ?? null,
        livePrice,
        distToEntryPct: ["suggested", "placed", "open", "active"].includes(o.status) ? distPct(o.entry ?? 0, livePrice) : null,
      };
    });

  const assets: DeskAssetScore[] = Object.entries(state?.analysis?.assets ?? {})
    .map(([sym, a]) => ({
      sym: sym.toUpperCase(),
      price: typeof a.price === "number" ? a.price : null,
      chgDayPct: typeof a.chgDayPct === "number" ? a.chgDayPct : null,
      score: typeof a.score === "number" ? a.score : null,
      error: a.error ?? null,
    }))
    .sort((a, b) => Math.abs(b.score ?? 0) - Math.abs(a.score ?? 0));

  return {
    ok: Boolean(state || mt5),
    ts: Date.now(),
    mt5: {
      ts: mt5?.ts ?? null,
      error: mt5?.error ?? null,
      account: mt5?.account
        ? {
            currency: mt5.account.currency ?? "USD",
            leverage: Number(mt5.account.leverage ?? 0),
            balance: Number(mt5.account.balance ?? 0),
            equity: Number(mt5.account.equity ?? 0),
            margin: Number(mt5.account.margin ?? 0),
            marginFree: Number(mt5.account.margin_free ?? 0),
            profit: Number(mt5.account.profit ?? 0),
          }
        : null,
      positions: mt5Positions,
      orders: mt5Orders,
      slotsUsed: mt5Positions.length + mt5Orders.length,
      maxSlots: Number(state?.config?.max_concurrent_positions ?? 4),
    },
    analysis: {
      lastRound: state?.analysis?.last_round ?? null,
      lastRoundTs: state?.analysis?.last_round_ts ?? null,
      engine: state?.analysis?.engine ?? null,
      assets,
    },
    orders,
    recentLog,
  };
}
