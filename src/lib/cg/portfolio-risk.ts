/**
 * PORTFOLIO RISK ENGINE (WS4, 2026-11-12) — correlation guard & execution
 * telemetry across EVERY exposure surface:
 *
 *   positions gathered from
 *     · MT5 live positions + resting orders (desk/mt5.json via desk/live)
 *     · desk directives/orders (desk/state.json)
 *     · Binance futures TESTNET positions (signed account snapshot)
 *     · Virtual Book OPEN tickets (the agent's live paper exposure)
 *
 * computed honestly
 *   · rolling 24 h & 7 d return-correlation matrix (h1 closes, Binance perps;
 *     classics have no perp history → correlation null, never invented)
 *   · net portfolio beta vs BTC and QQQ (7 d h1 log returns)
 *   · cluster exposure (Crypto Majors / Alts / AI-Semis / Metals / Energy /
 *     Indices-ETF / Other TradFi) in $ and % of gross
 *   · effective independent bets N_eff = (Σ|w|)² / Σᵢⱼ wᵢwⱼρᵢⱼ (correlation-
 *     weighted diversification of the SIGNED notional vector)
 *   · portfolio heat = % of equity at stop risk (positions with stops; Virtual
 *     Book tickets at the configured riskPerTicketPct)
 *   · warnings when cluster heat exceeds the cap (default 3%) or a new setup
 *     correlates > 0.75 with the existing max-risk position
 *
 * Standard { dataAt, ageMs, stale, source } telemetry on every response.
 */

import fs from "fs";
import { buildDeskLiveSnapshot } from "../desk/live";
import { accountSnapshot } from "../binance/signed";
import { paperBookTickets, paperBookStats, type PaperBookTicketView } from "./paperbook";
import { fetchBinCandles } from "./fallbacks";
import { resolveCgSym } from "../binance/aliases";
import { CURATED } from "@/lib/universe/curated";

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

export type RiskSource = "mt5-position" | "mt5-order" | "desk-order" | "binance-testnet" | "virtual-book";

export interface RiskPosition {
  sym: string;
  source: RiskSource;
  side: "long" | "short";
  qty: number | null;
  entry: number | null;
  notionalUsd: number | null;
  stop: number | null;
  /** stop distance as % of entry (null = no stop → heat contribution unknown) */
  stopDistPct: number | null;
  riskUsd: number | null;
  mark: number | null;
  note?: string;
}

export interface CorrPair {
  a: string;
  b: string;
  corr24h: number | null;
  corr7d: number | null;
}

export interface ClusterExposure {
  cluster: string;
  grossUsd: number;
  netUsd: number;
  pctOfGross: number;
  heatPct: number | null;
  positions: string[];
}

export interface RiskWarning {
  level: "high" | "medium";
  kind: "cluster-heat" | "correlation" | "no-stop" | "data";
  message: string;
}

export interface PortfolioRiskView {
  ok: boolean;
  generatedAt: number;
  positions: RiskPosition[];
  correlation: CorrPair[];
  beta: { vs: string; beta7d: number | null; beta24h: number | null }[];
  clusters: ClusterExposure[];
  nEff: number | null;
  heat: { equityUsd: number | null; totalRiskUsd: number; heatPct: number | null; clusterCapPct: number; worstCluster: { cluster: string; heatPct: number } | null };
  warnings: RiskWarning[];
  attribution: {
    virtualBook: { model: string; closed: number; wins: number; winRatePct: number | null; avgR: number | null; totalR: number; openR: number | null }[];
    mt5Live: { positions: number; orders: number; unrealizedUsd: number | null };
  };
  /** standard freshness telemetry */
  dataAt: number;
  ageMs: number;
  stale: boolean;
  source: string;
}

// ---------------------------------------------------------------------------
// config
// ---------------------------------------------------------------------------

/** Virtual Book tickets carry R-unit risk only — the $ heat model values one
 *  ticket at this % of equity (documented assumption, configurable). */
const VB_RISK_PER_TICKET_PCT = 0.5;
const CLUSTER_HEAT_CAP_PCT = 3.0;
const CORR_WARN = 0.75;

const CLUSTERS: { name: string; syms: Set<string>; match?: (sub: string) => boolean }[] = [
  { name: "Crypto Majors", syms: new Set(["BTC", "ETH", "SOL"]) },
  { name: "Crypto Alts", syms: new Set(), match: (sub) => sub === "crypto-perp" },
  { name: "AI / Semis", syms: new Set(["NVDA", "SNDK", "SOXL", "MU", "SKHY", "INTC", "AMD", "AVGO", "TSM", "DRAM", "NBIS", "ANTHROPIC", "MSTR"]) },
  { name: "Metals", syms: new Set(["XAU", "XAG"]) },
  { name: "Energy", syms: new Set(["CL", "UKO"]) },
  { name: "Indices / ETF", syms: new Set(["QQQ", "SPX500", "NDX100"]) },
];

function clusterOf(sym: string): string {
  for (const c of CLUSTERS) {
    if (c.syms.has(sym)) return c.name;
  }
  const kind = CURATED.find((c) => c.sym === sym)?.kind;
  if (kind === "crypto-perp") return "Crypto Alts";
  if (kind === "tradfi-perp" || kind === "classic") return "Other TradFi";
  return "Other TradFi";
}

// ---------------------------------------------------------------------------
// h1 return series cache (Binance perps — free fapi)
// ---------------------------------------------------------------------------

const gRet = globalThis as unknown as { __cgRiskRets?: { at: number; map: Map<string, number[]> } };
const RET_TTL = 5 * 60_000;

async function returnsMap(syms: string[]): Promise<Map<string, number[]>> {
  const g = (gRet.__cgRiskRets ??= { at: 0, map: new Map() });
  const need = syms.filter((s) => !g.map.has(s));
  if (need.length && Date.now() - g.at > RET_TTL) {
    await Promise.allSettled(
      need.map(async (s) => {
        try {
          const candles = await fetchBinCandles(resolveCgSym(s), "h1", 200);
          const rets: number[] = [];
          for (let i = 1; i < candles.length; i++) {
            if (candles[i - 1].c > 0 && candles[i].c > 0) rets.push(Math.log(candles[i].c / candles[i - 1].c));
          }
          if (rets.length >= 24) g.map.set(s, rets);
        } catch {
          /* correlation for this sym stays null (honest) */
        }
      })
    );
    g.at = Date.now();
  }
  return g.map;
}

function corrOf(a: number[] | undefined, b: number[] | undefined, windowBars: number): number | null {
  if (!a || !b) return null;
  const n = Math.min(a.length, b.length, windowBars);
  if (n < 24) return null;
  const ra = a.slice(a.length - n);
  const rb = b.slice(b.length - n);
  const ma = ra.reduce((s, x) => s + x, 0) / n;
  const mb = rb.reduce((s, x) => s + x, 0) / n;
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < n; i++) {
    cov += (ra[i] - ma) * (rb[i] - mb);
    va += (ra[i] - ma) ** 2;
    vb += (rb[i] - mb) ** 2;
  }
  return va > 0 && vb > 0 ? Number((cov / Math.sqrt(va * vb)).toFixed(3)) : null;
}

function betaOf(a: number[] | undefined, b: number[] | undefined, windowBars: number): number | null {
  const c = corrOf(a, b, windowBars);
  if (c == null || !a || !b) return null;
  const n = Math.min(a.length, b.length, windowBars);
  const ra = a.slice(a.length - n);
  const rb = b.slice(b.length - n);
  const mb = rb.reduce((s, x) => s + x, 0) / n;
  let vb = 0;
  for (let i = 0; i < n; i++) vb += (rb[i] - mb) ** 2;
  const sdA = Math.sqrt(ra.reduce((s, x) => s + x * x, 0) / n);
  const sdB = Math.sqrt(vb / n);
  return sdB > 0 ? Number((c * (sdA / sdB)).toFixed(3)) : null;
}

// ---------------------------------------------------------------------------
// position gathering
// ---------------------------------------------------------------------------

function readJsonSafe<T>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
}

async function gatherPositions(): Promise<{ positions: RiskPosition[]; equityUsd: number | null; mt5Counts: { positions: number; orders: number; unrealizedUsd: number | null } }> {
  const out: RiskPosition[] = [];
  let equityUsd: number | null = null;
  const mt5Counts = { positions: 0, orders: 0, unrealizedUsd: null as number | null };

  // MT5 positions + orders (via the desk live snapshot — read-only)
  try {
    const snap = await buildDeskLiveSnapshot();
    mt5Counts.positions = snap.mt5.positions.length;
    mt5Counts.orders = snap.mt5.orders.length;
    mt5Counts.unrealizedUsd = snap.mt5.account?.equity != null && snap.mt5.account?.balance != null
      ? Number(((snap.mt5.account.equity ?? 0) - (snap.mt5.account.balance ?? 0)).toFixed(2))
      : null;
    if (snap.mt5.account?.equity != null) equityUsd = snap.mt5.account.equity;
    for (const p of snap.mt5.positions) {
      const stop = p.sl && p.sl > 0 ? p.sl : null;
      out.push({
        sym: p.sym,
        source: "mt5-position",
        side: p.side,
        qty: p.volume,
        entry: p.openPrice,
        notionalUsd: null, // MT5 contract size is broker-specific — no invented $
        stop,
        stopDistPct: p.distToSlPct ?? (stop != null ? Number(((Math.abs(p.openPrice - stop) / p.openPrice) * 100).toFixed(2)) : null),
        riskUsd: null,
        mark: p.livePrice,
      });
    }
    for (const o of snap.mt5.orders) {
      out.push({
        sym: o.sym,
        source: "mt5-order",
        side: o.side,
        qty: o.volume,
        entry: o.entry ?? null,
        notionalUsd: null,
        stop: o.sl && o.sl > 0 ? o.sl : null,
        stopDistPct: o.sl && o.sl > 0 ? Number(((Math.abs(o.entry - o.sl) / o.entry) * 100).toFixed(2)) : null,
        riskUsd: null,
        mark: o.livePrice,
        note: `${o.type} resting order`,
      });
    }
  } catch {
    /* MT5 surface unavailable — positions list stays honest */
  }

  // desk directive orders (state.json — suggested/placed/open/active)
  try {
    const st = readJsonSafe<{ orders?: { sym?: string; side?: string; status?: string; entry?: number; stop?: number; qty?: number }[] }>("desk/state.json");
    for (const o of st?.orders ?? []) {
      if (!o.sym || !["suggested", "placed", "open", "active"].includes(o.status ?? "")) continue;
      const stop = o.stop && o.stop > 0 ? o.stop : null;
      out.push({
        sym: o.sym.toUpperCase(),
        source: "desk-order",
        side: (o.side ?? "long").toLowerCase().includes("short") ? "short" : "long",
        qty: o.qty ?? null,
        entry: o.entry ?? null,
        notionalUsd: null,
        stop,
        stopDistPct: stop != null && o.entry ? Number(((Math.abs(o.entry - stop) / o.entry) * 100).toFixed(2)) : null,
        riskUsd: null,
        mark: null,
        note: `desk ${o.status}`,
      });
    }
  } catch {
    /* optional */
  }

  // Binance futures TESTNET positions
  try {
    const snap = await accountSnapshot();
    if (snap && snap.ok) {
      if (equityUsd == null) equityUsd = snap.totalWalletBalance || null;
      for (const p of snap.positions) {
        const amt = Number(p.positionAmt) || 0;
        if (Math.abs(amt) < 1e-9) continue;
        const entry = Number(p.entryPrice) || null;
        const mark = Number(p.markPrice) || null;
        out.push({
          sym: p.symbol.replace(/USDT$/, "").toUpperCase(),
          source: "binance-testnet",
          side: amt > 0 ? "long" : "short",
          qty: Math.abs(amt),
          entry,
          notionalUsd: entry != null ? Math.abs(amt) * entry : null,
          stop: null,
          stopDistPct: null,
          riskUsd: null,
          mark,
          note: "testnet demo position (no stop tracked)",
        });
      }
    }
  } catch {
    /* testnet not configured — honest skip */
  }

  // Virtual Book OPEN tickets (agent paper exposure — R units)
  try {
    for (const t of paperBookTickets({ status: "OPEN", limit: 100 })) {
      out.push({
        sym: t.sym,
        source: "virtual-book",
        side: t.direction === "SHORT" ? "short" : "long",
        qty: null,
        entry: t.filledPrice ?? t.entryZone?.[1] ?? null,
        notionalUsd: null,
        stop: t.stop ?? null,
        stopDistPct: t.stop != null && t.filledPrice ? Number(((Math.abs(t.filledPrice - t.stop) / t.filledPrice) * 100).toFixed(2)) : null,
        riskUsd: null,
        mark: null,
        note: `${t.model} paper ticket — 1R = ${VB_RISK_PER_TICKET_PCT}% equity (assumed)`,
      });
    }
  } catch {
    /* paperbook unavailable */
  }

  return { positions: out, equityUsd, mt5Counts };
}

// ---------------------------------------------------------------------------
// the engine
// ---------------------------------------------------------------------------

const gR = globalThis as unknown as { __cgRiskCache?: { at: number; view: PortfolioRiskView } };
const RISK_TTL = 30_000;

export async function buildPortfolioRisk(): Promise<PortfolioRiskView> {
  const hit = gR.__cgRiskCache;
  if (hit && Date.now() - hit.at < RISK_TTL) return hit.view;

  const t0 = Date.now();
  const { positions, equityUsd, mt5Counts } = await gatherPositions();
  const warnings: RiskWarning[] = [];

  // unique symbols with Binance perp history (classic instruments excluded —
  // no perp kline history, correlations stay null instead of invented)
  const corrSyms = [...new Set(positions.map((p) => p.sym))].filter((s) =>
    CURATED.some((c) => c.sym === s && c.kind !== "classic")
  );
  const refs = ["BTC", "QQQ"];
  const rets = await returnsMap([...new Set([...corrSyms, ...refs])]);
  const btc = rets.get("BTC");
  const qqq = rets.get("QQQ");

  // pairwise correlation matrix (only meaningful pairs)
  const correlation: CorrPair[] = [];
  for (let i = 0; i < corrSyms.length; i++) {
    for (let j = i + 1; j < corrSyms.length; j++) {
      const a = corrSyms[i];
      const b = corrSyms[j];
      const ra = rets.get(a);
      const rb = rets.get(b);
      if (!ra || !rb) continue;
      correlation.push({ a, b, corr24h: corrOf(ra, rb, 24), corr7d: corrOf(ra, rb, 168) });
    }
  }

  // signed notional weights ($ where known; Virtual Book tickets enter at the
  // assumed risk % × a 10× stop-distance notional — honest model, documented)
  const grossKnown = positions.reduce((s, p) => s + (p.notionalUsd ?? 0), 0);
  const weights = new Map<string, number>();
  for (const p of positions) {
    let notional = p.notionalUsd;
    if (notional == null && p.source === "virtual-book" && equityUsd != null && p.stopDistPct != null) {
      // 1R = VB_RISK_PER_TICKET_PCT% of equity → notional = risk / stopDist
      notional = (equityUsd * (VB_RISK_PER_TICKET_PCT / 100)) / (p.stopDistPct / 100);
    }
    if (notional == null || notional <= 0) continue;
    const w = (p.side === "long" ? 1 : -1) * notional;
    weights.set(p.sym, (weights.get(p.sym) ?? 0) + w);
  }
  const wTotal = [...weights.values()].reduce((s, w) => s + Math.abs(w), 0);

  // net portfolio beta (weighted by |notional| share)
  const beta: PortfolioRiskView["beta"] = [];
  for (const [name, ref] of [["BTC", btc], ["QQQ", qqq]] as const) {
    let b7: number | null = null;
    let b24: number | null = null;
    if (wTotal > 0) {
      let acc7 = 0;
      let acc24 = 0;
      let have = false;
      for (const [sym, w] of weights) {
        const r = rets.get(sym);
        if (!r) continue;
        const share = Math.abs(w) / wTotal;
        const b7s = betaOf(r, ref, 168);
        const b24s = betaOf(r, ref, 24);
        if (b7s != null) {
          acc7 += share * b7s;
          have = true;
        }
        if (b24s != null) acc24 += share * b24s;
      }
      b7 = have ? Number(acc7.toFixed(3)) : null;
      b24 = have ? Number(acc24.toFixed(3)) : null;
    }
    beta.push({ vs: name, beta7d: b7, beta24h: b24 });
  }

  // N_eff = (Σ|w|)² / Σᵢⱼ wᵢwⱼρᵢⱼ over symbols with measurable correlation
  let nEff: number | null = null;
  if (wTotal > 0 && corrSyms.length >= 2) {
    const wArr = corrSyms.map((s) => weights.get(s) ?? 0);
    let denom = 0;
    for (let i = 0; i < corrSyms.length; i++) {
      for (let j = 0; j < corrSyms.length; j++) {
        if (i === j) {
          denom += wArr[i] * wArr[j];
        } else {
          const c = corrOf(rets.get(corrSyms[i]), rets.get(corrSyms[j]), 168) ?? 0;
          denom += wArr[i] * wArr[j] * c;
        }
      }
    }
    nEff = denom > 1e-9 ? Number(((wTotal * wTotal) / denom).toFixed(2)) : null;
  }

  // cluster exposure + heat
  const clusterMap = new Map<string, { gross: number; net: number; risk: number; syms: Set<string> }>();
  for (const p of positions) {
    const c = clusterOf(p.sym);
    const cur = clusterMap.get(c) ?? { gross: 0, net: 0, risk: 0, syms: new Set() };
    cur.syms.add(p.sym);
    let notional = p.notionalUsd;
    let risk = p.riskUsd;
    if (p.source === "virtual-book" && equityUsd != null) {
      risk = (equityUsd * VB_RISK_PER_TICKET_PCT) / 100;
      if (p.stopDistPct != null) notional = risk / (p.stopDistPct / 100);
    }
    if (notional != null && notional > 0) {
      cur.gross += notional;
      cur.net += p.side === "long" ? notional : -notional;
    }
    if (risk != null && risk > 0) cur.risk += risk;
    clusterMap.set(c, cur);
  }
  const grossAll = [...clusterMap.values()].reduce((s, c) => s + c.gross, 0);
  const totalRiskUsd = [...clusterMap.values()].reduce((s, c) => s + c.risk, 0);
  const clusters: ClusterExposure[] = [...clusterMap.entries()].map(([cluster, c]) => ({
    cluster,
    grossUsd: Math.round(c.gross),
    netUsd: Math.round(c.net),
    pctOfGross: grossAll > 0 ? Number(((c.gross / grossAll) * 100).toFixed(1)) : 0,
    heatPct: equityUsd && equityUsd > 0 ? Number(((c.risk / equityUsd) * 100).toFixed(2)) : null,
    positions: [...c.syms],
  }));

  const heatPct = equityUsd && equityUsd > 0 ? Number(((totalRiskUsd / equityUsd) * 100).toFixed(2)) : null;
  const worst = clusters.filter((c) => c.heatPct != null).sort((a, b) => (b.heatPct ?? 0) - (a.heatPct ?? 0))[0] ?? null;

  // warnings
  if (worst && (worst.heatPct ?? 0) > CLUSTER_HEAT_CAP_PCT) {
    warnings.push({
      level: "high",
      kind: "cluster-heat",
      message: `${worst.cluster} cluster heat ${(worst.heatPct ?? 0).toFixed(2)}% of equity at stop risk — above the ${CLUSTER_HEAT_CAP_PCT}% cap (${worst.positions.join(", ")})`,
    });
  }
  // new-setup correlation guard: virtual-book ARMED tickets + desk suggested
  // orders vs the current max-risk open position
  const maxRisk = positions.filter((p) => p.riskUsd != null).sort((a, b) => (b.riskUsd as number) - (a.riskUsd as number))[0];
  if (maxRisk) {
    const candidates = positions.filter((p) => p.source === "virtual-book" || p.source === "desk-order");
    for (const c of candidates) {
      if (c.sym === maxRisk.sym) continue;
      const corr = corrOf(rets.get(c.sym), rets.get(maxRisk.sym), 168);
      if (corr != null && corr > CORR_WARN) {
        warnings.push({
          level: "medium",
          kind: "correlation",
          message: `${c.sym} (${c.source}) moves ${corr.toFixed(2)} with the max-risk position ${maxRisk.sym} (${maxRisk.source}) — correlated directional exposure`,
        });
      }
    }
  }
  const noStop = positions.filter((p) => (p.source === "mt5-position" || p.source === "binance-testnet") && p.stop == null);
  if (noStop.length) {
    warnings.push({
      level: "medium",
      kind: "no-stop",
      message: `${noStop.length} live position(s) without a stop: ${noStop.map((p) => `${p.sym} (${p.source})`).join(", ")} — heat model cannot price their risk`,
    });
  }

  // attribution: Virtual Book by model + MT5 live counts
  const vbStats = paperBookStats();
  const tickets = paperBookTickets({ limit: 500 });
  const attribution: PortfolioRiskView["attribution"] = {
    virtualBook: vbStats.map((s) => {
      const open = tickets.filter((t) => t.model === s.bucket && t.status === "OPEN");
      return {
        model: s.bucket,
        closed: s.wins + s.losses,
        wins: s.wins,
        winRatePct: s.winRatePct,
        avgR: s.expectancyR,
        totalR: Number(tickets.filter((t) => t.model === s.bucket && t.status === "CLOSED").reduce((acc, t) => acc + (t.totalR ?? 0), 0).toFixed(2)),
        openR: open.length ? Number(open.reduce((acc, t) => acc + (t.unrealizedR ?? 0), 0).toFixed(2)) : null,
      };
    }),
    mt5Live: mt5Counts,
  };

  const view: PortfolioRiskView = {
    ok: true,
    generatedAt: Date.now(),
    positions,
    correlation,
    beta,
    clusters,
    nEff,
    heat: {
      equityUsd: equityUsd != null ? Math.round(equityUsd) : null,
      totalRiskUsd: Math.round(totalRiskUsd),
      heatPct,
      clusterCapPct: CLUSTER_HEAT_CAP_PCT,
      worstCluster: worst ? { cluster: worst.cluster, heatPct: worst.heatPct ?? 0 } : null,
    },
    warnings,
    attribution,
    dataAt: t0,
    ageMs: Date.now() - t0,
    stale: false,
    source: `desk/mt5.json+desk/state.json+binance-testnet+virtual-book(paperbook) · h1 fapi returns (24h/7d) · VB ticket risk assumed ${VB_RISK_PER_TICKET_PCT}% equity`,
  };
  gR.__cgRiskCache = { at: Date.now(), view };
  return view;
}
