/**
 * VIRTUAL BOOK — paper-trade outcome tracker for the Agent Setups (2026-11-12).
 *
 * Every qualifying narrative verdict (M1 trend-pullback · M1 WAIT_PULLBACK
 * zone · M2 VWAP ±2σ mean-reversion) becomes a deterministic VIRTUAL TICKET:
 *
 *   ARMED  ── price trades into the entry zone ──▶ OPEN
 *   OPEN   ── rung ladder: R1 50% off + stop→BE, R2 remainder ──▶ CLOSED
 *   ARMED  ── never filled within TTL ──▶ EXPIRED
 *   ARMED  ── newer conflicting narrative ──▶ CANCELLED (superseded / flip)
 *   OPEN   ── opposite-direction armable setup ──▶ CLOSED · FLIP_CLOSE at mark
 *   OPEN   ── model time-stop (M1 48h / M2 18h) ──▶ CLOSED · TIME_STOP
 *
 * Accounting rules (quant-honest, frozen before implementation):
 *   - Entry/stop/targets are FROZEN at arm time — no look-ahead mutation.
 *     Re-emitted setups that drift < 0.6% refresh the same ticket; larger
 *     drifts supersede (cancel + re-arm) so the book follows the live plan.
 *   - M2 is a market-entry model ("enter on the confirmation bar close"):
 *     it is born FILLED at the live mark, and only arms from verdicts whose
 *     market data is < 10 min old (no stale-sweep look-ahead).
 *   - Fill/SL/TP detection uses m1 candles (intrabar wicks count — high/low,
 *     not close). Within one bar the STOP is evaluated before targets
 *     (pessimistic, standard conservative backtest convention); gap opens
 *     fill at the open (exchange-honest price improvement/degradation).
 *   - Realized R = Σ legs frac × dir × (exit − entry) / risk. Unrealized adds
 *     the remaining fraction at the live mark. MFE/MAE tracked in R.
 *   - Classic instruments (SPX500/NDX100/UKO) track on Hyperliquid xyz m1
 *     candles + mark; the 58 perps track on Binance fapi m1 + bookTicker.
 *   - Every transition persists to data/cg-series/paperbook.jsonl (append
 *     only, replayed on boot) and emits a "paperbook" notification.
 *
 * Zero fabrication: a ticket only moves on real bars / real marks; each
 * transition records the price source and the triggering bar timestamp.
 */

import fs from "fs";
import path from "path";
import { createHash } from "node:crypto";
import { fetchBinCandles, fetchHlCandles, type OHLCVCandle } from "./fallbacks";
import { getLivePrice } from "../live/server-price";
import { hlXyzSnapshot } from "./micro";
import { hlCoinOf } from "../binance/aliases";
import { isClassic } from "./classic";
import { CURATED } from "@/lib/universe/curated";
import { buildNarrative, type NarrativeVerdict } from "./narrative";
import { emit } from "./notify";
import { resolveDataRoot } from "./store";

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

export type PbStatus = "ARMED" | "OPEN" | "CLOSED";
export type PbOutcome = "TP1" | "TP2" | "SL" | "BE" | "TIME_STOP" | "FLIP_CLOSE" | "EXPIRED" | "CANCELLED" | null;
export type PbModel = "M1_TREND_PULLBACK" | "WAIT_PULLBACK" | "M2_MEAN_REVERSION";

export interface PaperTarget {
  level: number;
  label: string;
  rMultiple: number | null;
  hitAt: number | null;
  hitPrice: number | null;
}

export interface PaperLeg {
  price: number;
  frac: number;
  r: number;
  at: number;
  tag: string;
}

export interface PaperEvent {
  at: number;
  type: string;
  note: string;
  price: number | null;
}

export interface PaperTicket {
  id: string;
  hash: string;
  sym: string;
  kind: string;
  model: PbModel;
  direction: "LONG" | "SHORT";
  grade: string;
  confidence: number;
  regime: string;
  entryZone: [number, number];
  stop: number;
  stopInitial: number;
  stopAtBe: boolean;
  targets: PaperTarget[];
  status: PbStatus;
  outcome: PbOutcome;
  cancelReason: string | null;
  armedAt: number;
  lastSeenAt: number;
  expiresAt: number;
  timeStopAt: number;
  filledAt: number | null;
  filledPrice: number | null;
  fillSource: string | null;
  fillBarTs: number | null;
  closedAt: number | null;
  legs: PaperLeg[];
  mfeR: number;
  maeR: number;
  lastMark: number | null;
  lastMarkAt: number | null;
  markSource: string | null;
  lastBarTs: number;
  events: PaperEvent[];
}

export interface PbStats {
  bucket: string;
  armed: number;
  filled: number;
  wins: number;
  losses: number;
  winRatePct: number | null;
  avgWinR: number | null;
  avgLossR: number | null;
  expectancyR: number | null;
  totalR: number | null;
  avgHoldMin: number | null;
  fillRatePct: number | null;
}

export interface PbArmResult {
  action: "armed" | "filled" | "refreshed" | "superseded" | "skipped" | "flip-closed";
  reason: string;
  id: string | null;
}

// ---------------------------------------------------------------------------
// tuning (all thresholds in one place)
// ---------------------------------------------------------------------------

const TTL_WAIT_MS = 12 * 3_600_000; // WAIT_PULLBACK zone validity
const TTL_M1_MS = 24 * 3_600_000; // M1 zone validity
const TSTOP_M1_MS = 48 * 3_600_000; // M1/WAIT open time-stop
const TSTOP_M2_MS = 18 * 3_600_000; // M2 open time-stop
const M2_ARM_MAX_MARKET_AGE_MS = 10 * 60_000; // no stale-sweep market entries
const ZONE_ARM_MAX_MARKET_AGE_MS = 30 * 60_000;
const FRESH_MARK_MS = 10 * 60_000; // expiry/time-stop/flip need a fresh mark
const DRIFT_TOL = 0.006; // 0.6% relative — zone/stop drift = same setup
const MAX_OPEN = 24;
const MAX_ARMED = 24;
const CLOSED_RETAIN_MS = 14 * 24 * 3_600_000;
const TRACK_EVERY_MS = 60_000;
const SWEEP_EVERY_MS = 90_000;
const SWEEP_PER_TICK = 2;
const SWEEP_SYM_DEDUP_MS = 10 * 60_000;
const BARS_CACHE_MS = 15_000;
const MAX_EVENTS_PER_TICKET = 10;
const FILE_MAX_LINES = 6000;
const FILE_TRIM_TO = 3000;

const ARMABLE_MODELS: ReadonlySet<string> = new Set(["M1_TREND_PULLBACK", "WAIT_PULLBACK", "M2_MEAN_REVERSION"]);

// ---------------------------------------------------------------------------
// state (globalThis — survives Next route-module re-instantiation)
// ---------------------------------------------------------------------------

interface PbGlobal {
  started: boolean;
  tickets: Map<string, PaperTicket>;
  loaded: boolean;
  sweepIdx: number;
  lastArmAt: Map<string, number>;
  lastPassAt: number;
  lastPassErr: string | null;
  lastSweepAt: number;
  lastSweepErr: string | null;
  passTelemetry: { sym: string; bars: number; mark: number | null; source: string }[];
  armLog: { at: number; sym: string; result: string }[];
}

const g = globalThis as unknown as { __cgPaperBook?: PbGlobal };
const PB: PbGlobal = (g.__cgPaperBook ??= {
  started: false,
  tickets: new Map(),
  loaded: false,
  sweepIdx: 0,
  lastArmAt: new Map(),
  lastPassAt: 0,
  lastPassErr: null,
  lastSweepAt: 0,
  lastSweepErr: null,
  passTelemetry: [],
  armLog: [],
});

const ROOT = resolveDataRoot();
const BOOK_FILE = path.join(ROOT, "paperbook.jsonl");

// ---------------------------------------------------------------------------
// persistence — append-only event log, replayed on boot
// ---------------------------------------------------------------------------

interface PbLogLine {
  at: number;
  type: "ARMED" | "FILLED" | "RUNG" | "CLOSED" | "EXPIRED" | "CANCELLED" | "REFRESH" | "RESET";
  id: string;
  ticket?: PaperTicket;
  reason?: string;
}

function loadFromDisk() {
  if (PB.loaded) return;
  PB.loaded = true;
  try {
    if (!fs.existsSync(BOOK_FILE)) return;
    const text = fs.readFileSync(BOOK_FILE, "utf8");
    const lines = text.split("\n").filter((l) => l.trim());
    const now = Date.now();
    for (const line of lines) {
      let ev: PbLogLine;
      try {
        ev = JSON.parse(line) as PbLogLine;
      } catch {
        continue;
      }
      if (!ev || typeof ev.id !== "string") continue;
      if (ev.type === "RESET") {
        PB.tickets.clear();
        continue;
      }
      if (!ev.ticket || !ev.ticket.id) continue;
      const t = ev.ticket;
      // drop long-dead closed tickets on boot
      if (t.status === "CLOSED" && (t.closedAt ?? 0) < now - CLOSED_RETAIN_MS) continue;
      PB.tickets.set(t.id, t);
    }
    if (PB.tickets.size > 400) {
      const keep = [...PB.tickets.values()]
        .sort((a, b) => (b.closedAt ?? b.armedAt) - (a.closedAt ?? a.armedAt))
        .slice(0, 400);
      PB.tickets = new Map(keep.map((t) => [t.id, t]));
    }
    // trim the file if it grew past the cap (single rewrite, boot only)
    if (lines.length > FILE_MAX_LINES) {
      const trimmed = lines.slice(-FILE_TRIM_TO).join("\n") + "\n";
      fs.writeFileSync(BOOK_FILE, trimmed, "utf8");
    }
  } catch {
    /* fresh book */
  }
}

function persist(type: PbLogLine["type"], ticket: PaperTicket, reason?: string) {
  try {
    fs.mkdirSync(ROOT, { recursive: true });
    const line: PbLogLine = { at: Date.now(), type, id: ticket.id, ticket, ...(reason ? { reason } : {}) };
    fs.appendFileSync(BOOK_FILE, JSON.stringify(line) + "\n", "utf8");
  } catch {
    /* disk issues must never kill the book */
  }
}

function pushEvent(t: PaperTicket, type: string, note: string, price: number | null) {
  t.events.push({ at: Date.now(), type, note, price });
  if (t.events.length > MAX_EVENTS_PER_TICKET) t.events = t.events.slice(-MAX_EVENTS_PER_TICKET);
}

function notify(t: PaperTicket, kind: string, title: string, detail: string, price: number | null) {
  try {
    emit({
      ts: Date.now(),
      asset: t.sym,
      source: "paperbook",
      kind,
      dir: t.direction === "LONG" ? "bullish" : "bearish",
      severity: "info",
      title,
      detail,
      price,
      meta: { ticket: t.id, model: t.model, status: t.status, outcome: t.outcome },
    });
  } catch {
    /* bus issues must never kill the book */
  }
}

// ---------------------------------------------------------------------------
// price / bar sources (perps: fapi · classic: Hyperliquid xyz)
// ---------------------------------------------------------------------------

interface Mark {
  price: number | null;
  source: string;
  at: number;
}

async function markOf(sym: string): Promise<Mark> {
  if (!isClassic(sym)) {
    try {
      const lp = await getLivePrice(sym);
      if (lp.price != null && lp.price > 0) return { price: lp.price, source: lp.source, at: lp.at };
    } catch {
      /* fall through */
    }
  }
  const coin = hlCoinOf(sym);
  if (coin) {
    try {
      const snap = await hlXyzSnapshot(); // 12 s shared cache
      const mk = Number(snap[coin]?.markPx);
      if (Number.isFinite(mk) && mk > 0) return { price: mk, source: "hl-xyz", at: Date.now() };
    } catch {
      /* fall through */
    }
  }
  return { price: null, source: "none", at: Date.now() };
}

const barsCache = new Map<string, { at: number; bars: OHLCVCandle[] }>();

async function m1Bars(sym: string, sinceMs: number): Promise<OHLCVCandle[]> {
  const hit = barsCache.get(sym);
  if (hit && Date.now() - hit.at < BARS_CACHE_MS) return hit.bars;
  const need = Math.min(1000, Math.max(20, Math.ceil((Date.now() - sinceMs) / 60_000) + 4));
  let bars: OHLCVCandle[] = [];
  if (!isClassic(sym)) {
    try {
      bars = await fetchBinCandles(sym, "m1", need);
    } catch {
      bars = [];
    }
  }
  if (!bars.length) {
    const coin = hlCoinOf(sym);
    if (coin) {
      try {
        bars = await fetchHlCandles(coin, "m1", need);
      } catch {
        bars = [];
      }
    }
  }
  barsCache.set(sym, { at: Date.now(), bars });
  return bars;
}

// ---------------------------------------------------------------------------
// ticket math
// ---------------------------------------------------------------------------

/** compact model label for notifications: M1 · M1w (wait-zone) · M2 */
function modelShort(t: PaperTicket): string {
  if (t.model === "M1_TREND_PULLBACK") return "M1";
  if (t.model === "WAIT_PULLBACK") return "M1w";
  return "M2";
}

function dirSign(t: PaperTicket): number {
  return t.direction === "LONG" ? 1 : -1;
}

function riskOf(t: PaperTicket): number {
  // RISK IS FROZEN AT FILL against the INITIAL stop — after rung-1 moves the
  // stop to breakeven, |entry − stop| collapses to 0 and every later R number
  // (rung-2 booking, MFE/MAE, unrealized) would silently zero out.
  if (t.filledPrice == null) return Math.abs(nearEdge(t) - t.stopInitial);
  return Math.abs(t.filledPrice - t.stopInitial);
}

/** the zone edge price reaches FIRST when retracing into the zone */
function nearEdge(t: PaperTicket): number {
  return t.direction === "LONG" ? t.entryZone[1] : t.entryZone[0];
}

function rAt(t: PaperTicket, price: number): number {
  const risk = riskOf(t);
  const entry = t.filledPrice ?? nearEdge(t);
  if (!(risk > 0) || !(entry > 0)) return 0;
  return (dirSign(t) * (price - entry)) / risk;
}

function remainingFrac(t: PaperTicket): number {
  return Math.max(0, 1 - t.legs.reduce((s, l) => s + l.frac, 0));
}

function realizedR(t: PaperTicket): number {
  // fraction-weighted: a 50% partial at +1R books +0.5R on the book
  return t.legs.reduce((s, l) => s + l.frac * l.r, 0);
}

/** active rungs = targets with a level, in ladder order */
function rungs(t: PaperTicket): PaperTarget[] {
  return t.targets.filter((x) => Number.isFinite(x.level) && x.level > 0);
}

function closeTicket(t: PaperTicket, outcome: Exclude<PbOutcome, null>, price: number, at: number, note: string, source: string) {
  const frac = remainingFrac(t);
  if (frac > 1e-9) {
    const risk = riskOf(t);
    const entry = t.filledPrice ?? nearEdge(t);
    const r = risk > 0 && entry > 0 ? (dirSign(t) * (price - entry)) / risk : 0;
    t.legs.push({ price, frac, r, at, tag: outcome });
  }
  t.status = "CLOSED";
  t.outcome = outcome;
  t.closedAt = at;
  t.lastMark = price;
  t.lastMarkAt = at;
  t.markSource = source;
  pushEvent(t, outcome, note, price);
  persist("CLOSED", t, note);
  notify(
    t,
    "paper_close",
    `${t.sym} virtual ${modelShort(t)} ${t.direction} ${outcome} — ${realizedR(t) >= 0 ? "+" : ""}${realizedR(t).toFixed(2)}R`,
    `${note} · entry ${t.filledPrice ?? "–"} · exit ${price} · MFE ${t.mfeR.toFixed(2)}R / MAE ${t.maeR.toFixed(2)}R (source ${source})`,
    price
  );
}

// ---------------------------------------------------------------------------
// arming
// ---------------------------------------------------------------------------

function fingerprint(sym: string, model: string, direction: string, zone: [number, number], stop: number): string {
  const raw = `${sym}|${model}|${direction}|${zone[0].toPrecision(10)}|${zone[1].toPrecision(10)}|${stop.toPrecision(10)}`;
  return createHash("sha1").update(raw).digest("hex").slice(0, 12);
}

function modelTtl(model: PbModel): { ttl: number; tstop: number } {
  if (model === "M2_MEAN_REVERSION") return { ttl: TTL_M1_MS, tstop: TSTOP_M2_MS };
  if (model === "WAIT_PULLBACK") return { ttl: TTL_WAIT_MS, tstop: TSTOP_M1_MS };
  return { ttl: TTL_M1_MS, tstop: TSTOP_M1_MS };
}

/** zone/stop drift tolerance — same live setup, refresh instead of re-arm */
function isRefreshSibling(a: PaperTicket, model: PbModel, direction: "LONG" | "SHORT", zone: [number, number], stop: number): boolean {
  if (a.model !== model || a.direction !== direction || a.status !== "ARMED") return false;
  const midA = (a.entryZone[0] + a.entryZone[1]) / 2;
  const midB = (zone[0] + zone[1]) / 2;
  if (!(midA > 0) || !(midB > 0)) return false;
  if (Math.abs(midA - midB) / midA > DRIFT_TOL) return false;
  if (Math.abs(a.stop - stop) / Math.abs(a.stop) > DRIFT_TOL) return false;
  return true;
}

export function armFromVerdict(v: NarrativeVerdict, source: "route" | "sweep"): PbArmResult {
  loadFromDisk();
  const skip = (reason: string): PbArmResult => ({ action: "skipped", reason, id: null });

  if (!v || v.ok !== true || v.supported === false) return skip("verdict unsupported");
  if (v.direction !== "LONG" && v.direction !== "SHORT") return skip("neutral direction");
  if (!ARMABLE_MODELS.has(v.activeModel)) return skip(`model ${v.activeModel} not armable`);
  if (v.grade === "SKIP") return skip("grade SKIP");
  const model = v.activeModel as PbModel;
  const zone = v.plan.entryZone;
  const stop = v.plan.stop;
  if (!zone || !Number.isFinite(zone[0]) || !Number.isFinite(zone[1]) || zone[1] < zone[0]) return skip("no valid entry zone");
  if (stop == null || !Number.isFinite(stop) || stop <= 0) return skip("no valid stop");
  const near = v.direction === "LONG" ? zone[1] : zone[0];
  const risk0 = Math.abs(near - stop);
  if (!(risk0 > 0)) return skip("zero risk at near edge");
  if (risk0 / near > 0.25) return skip("stop distance > 25% — garbage guard");

  // freshness gates (no look-ahead from stale sweeps)
  const marketAge = v.freshness?.ageMs ?? Number.POSITIVE_INFINITY;
  if (model === "M2_MEAN_REVERSION" && marketAge > M2_ARM_MAX_MARKET_AGE_MS) return skip(`M2 market entry needs < 10 min old data (${Math.round(marketAge / 60000)} min)`);
  if (model !== "M2_MEAN_REVERSION" && marketAge > ZONE_ARM_MAX_MARKET_AGE_MS) return skip(`zone arm needs < 30 min old data (${Math.round(marketAge / 60000)} min)`);

  const now = Date.now();
  const hash = fingerprint(v.sym, model, v.direction, zone, stop);
  const id = `PB-${v.sym}-${hash.slice(0, 6)}`;
  PB.lastArmAt.set(v.sym, now);

  // exact re-emission → refresh
  const existing = PB.tickets.get(id);
  if (existing && existing.status !== "CLOSED") {
    const { ttl } = modelTtl(model);
    existing.lastSeenAt = now;
    existing.expiresAt = Math.max(existing.expiresAt, now + ttl);
    existing.grade = v.grade;
    existing.confidence = v.confidence;
    pushEvent(existing, "REFRESH", `setup re-emitted (${source}) — expiry extended`, null);
    persist("REFRESH", existing);
    return { action: "refreshed", reason: `re-emitted via ${source}`, id };
  }

  // drift sibling → refresh (same live setup, levels drifted < 0.6%)
  for (const a of PB.tickets.values()) {
    if (a.sym === v.sym && a.status === "ARMED" && isRefreshSibling(a, model, v.direction, zone, stop)) {
      const { ttl } = modelTtl(model);
      a.lastSeenAt = now;
      a.expiresAt = Math.max(a.expiresAt, now + ttl);
      a.grade = v.grade;
      a.confidence = v.confidence;
      pushEvent(a, "REFRESH", `setup drifted but within ${DRIFT_TOL * 100}% — original frozen levels kept, expiry extended (${source})`, null);
      persist("REFRESH", a);
      return { action: "refreshed", reason: `drift sibling via ${source}`, id: a.id };
    }
  }

  // caps
  const armedCount = [...PB.tickets.values()].filter((x) => x.status === "ARMED").length;
  const openCount = [...PB.tickets.values()].filter((x) => x.status === "OPEN").length;
  if (armedCount >= MAX_ARMED) return skip(`armed cap ${MAX_ARMED} reached`);
  if (openCount >= MAX_OPEN && model === "M2_MEAN_REVERSION") return skip(`open cap ${MAX_OPEN} reached (M2 needs a slot)`);

  // per-symbol housekeeping: one ARMED + one OPEN
  for (const a of [...PB.tickets.values()]) {
    if (a.sym !== v.sym) continue;
    if (a.status === "ARMED") {
      const reason = a.direction === v.direction ? "superseded by a newer plan" : "model flip before fill";
      a.status = "CLOSED";
      a.outcome = "CANCELLED";
      a.cancelReason = reason;
      a.closedAt = now;
      pushEvent(a, "CANCELLED", reason, null);
      persist("CANCELLED", a, reason);
      notify(a, "paper_cancel", `${a.sym} virtual ${modelShort(a)} ${a.direction} setup cancelled`, `${reason} — the zone never filled (armed ${new Date(a.armedAt).toISOString()})`, null);
    } else if (a.status === "OPEN" && a.direction !== v.direction) {
      // opposite-direction armable setup → close the open ticket at last mark
      const mark = a.lastMark;
      const fresh = a.lastMarkAt != null && now - a.lastMarkAt < FRESH_MARK_MS;
      if (mark != null && fresh) {
        closeTicket(a, "FLIP_CLOSE", mark, now, "opposite-direction setup armed — thesis flipped", a.markSource ?? "mark");
      } else {
        pushEvent(a, "FLIP_PENDING", "opposite setup armed but mark not fresh — flip deferred to next pass", null);
      }
    }
  }

  // build the ticket
  const { ttl, tstop } = modelTtl(model);
  // M2 is a market-entry model — its ARMED state is only the sub-minute
  // wait for the first live mark; if no mark lands within 15 min the entry
  // moment has passed and the ticket must expire (no look-ahead fills).
  const armedTtl = model === "M2_MEAN_REVERSION" ? 15 * 60_000 : ttl;
  const targets: PaperTarget[] = (v.plan.targets ?? [])
    .filter((x) => x != null && Number.isFinite(x.level) && (x.level ?? 0) > 0)
    .slice(0, 3)
    .map((x) => ({ level: x.level as number, label: x.label, rMultiple: x.rMultiple, hitAt: null, hitPrice: null }));

  const t: PaperTicket = {
    id,
    hash,
    sym: v.sym,
    kind: v.kind,
    model,
    direction: v.direction,
    grade: v.grade,
    confidence: v.confidence,
    regime: v.regime,
    entryZone: [zone[0], zone[1]],
    stop,
    stopInitial: stop,
    stopAtBe: false,
    targets,
    status: "ARMED",
    outcome: null,
    cancelReason: null,
    armedAt: now,
    lastSeenAt: now,
    expiresAt: now + armedTtl,
    timeStopAt: now + tstop,
    filledAt: null,
    filledPrice: null,
    fillSource: null,
    fillBarTs: null,
    closedAt: null,
    legs: [],
    mfeR: 0,
    maeR: 0,
    lastMark: null,
    lastMarkAt: null,
    markSource: null,
    lastBarTs: 0,
    events: [],
  };

  PB.tickets.set(id, t);
  pushEvent(t, "ARMED", `${model} ${v.direction} ${source} · grade ${v.grade} · zone ${zone[0].toPrecision(8)}-${zone[1].toPrecision(8)} stop ${stop.toPrecision(8)}`, null);
  persist("ARMED", t);

  // M2 = market-entry model → born FILLED at the live mark
  if (model === "M2_MEAN_REVERSION") {
    // fill happens on the next track pass via markOf (async, honest source);
    // the ARMED state lasts < 60 s and M2's expiry never bites before that.
    return { action: "armed", reason: `M2 armed pending immediate market fill (${source})`, id };
  }

  notify(
    t,
    "paper_armed",
    `${t.sym} virtual ${modelShort(t)} ${t.direction} setup armed`,
    `${t.regime.replace(/_/g, " ").toLowerCase()} · grade ${t.grade} (conf ${t.confidence}) · zone ${zone[0].toPrecision(8)}–${zone[1].toPrecision(8)} · stop ${stop.toPrecision(8)} · ${rungs(t).length} rungs`,
    null
  );
  return { action: "armed", reason: `${model} via ${source}`, id };
}

// ---------------------------------------------------------------------------
// tracking — m1 bar sweep (wicks count) + live mark
// ---------------------------------------------------------------------------

function fillTicket(t: PaperTicket, price: number, at: number, source: string, barTs: number | null) {
  t.status = "OPEN";
  t.filledAt = at;
  t.filledPrice = price;
  t.fillSource = source;
  t.fillBarTs = barTs;
  // MFE/MAE are POST-FILL excursions — discard any pre-fill zone drift the
  // mark updates accumulated while the ticket was ARMED
  t.mfeR = 0;
  t.maeR = 0;
  // recompute rung R at the ACTUAL fill
  const risk = riskOf(t);
  for (const rung of t.targets) {
    rung.rMultiple = risk > 0 ? Math.abs(rung.level - price) / risk : null;
  }
  pushEvent(t, "FILLED", `filled at ${price.toPrecision(8)} (${source})`, price);
  persist("FILLED", t);
  notify(
    t,
    "paper_fill",
    `${t.sym} virtual ${modelShort(t)} ${t.direction} FILLED @ ${price.toPrecision(8)}`,
    `zone ${t.entryZone[0].toPrecision(8)}–${t.entryZone[1].toPrecision(8)} touched · stop ${t.stop.toPrecision(8)} · rung ladder ${rungs(t).map((r) => r.level.toPrecision(8)).join(" / ")} · source ${source}`,
    price
  );
}

/** apply one m1 bar to a ticket — deterministic, exported for the test
 * harness (scripts/test-paperbook.ts) and any future replay tooling */
export function processBar(t: PaperTicket, bar: OHLCVCandle) {
  const long = t.direction === "LONG";

  if (t.status === "ARMED") {
    const hi = t.entryZone[1];
    const lo = t.entryZone[0];
    const touched = long ? bar.l <= hi : bar.h >= lo;
    if (touched) {
      const fillPx = long ? Math.min(bar.o, hi) : Math.max(bar.o, lo);
      fillTicket(t, fillPx, bar.t + 60_000, "m1-bar", bar.t);
    } else {
      return;
    }
  }

  if (t.status === "OPEN") {
    const risk = riskOf(t);
    const entry = t.filledPrice ?? nearEdge(t);
    const rOf = (p: number) => (risk > 0 && entry > 0 ? (dirSign(t) * (p - entry)) / risk : 0);
    // excursions (wick-based)
    const favPx = long ? bar.h : bar.l;
    const advPx = long ? bar.l : bar.h;
    t.mfeR = Math.max(t.mfeR, rOf(favPx));
    t.maeR = Math.min(t.maeR, rOf(advPx));

    // 1) STOP first (pessimistic) — includes the BE stop after rung 1
    const stopHit = long ? bar.l <= t.stop : bar.h >= t.stop;
    if (stopHit) {
      const stopPx = long ? Math.min(bar.o, t.stop) : Math.max(bar.o, t.stop);
      const outcome = t.stopAtBe ? "BE" : "SL";
      closeTicket(t, outcome, stopPx, bar.t + 60_000, t.stopAtBe ? "breakeven stop (post rung-1) hit" : "structural stop hit", "m1-bar");
      return;
    }

    // 2) rung ladder: rung 1 = 50% off + stop→BE (when ≥ 2 rungs), the SECOND
    //    rung exits the remainder; a third rung is informational only
    //    (hit recorded for MFE flavor, never an exit)
    const rs = rungs(t);
    const nextIdx = rs.findIndex((r) => r.hitAt == null);
    if (nextIdx >= 0) {
      const rung = rs[nextIdx];
      const hit = long ? bar.h >= rung.level : bar.l <= rung.level;
      if (hit) {
        const rungPx = long ? Math.max(bar.o, rung.level) : Math.min(bar.o, rung.level);
        rung.hitAt = bar.t + 60_000;
        rung.hitPrice = rungPx;
        const partial = nextIdx === 0 && rs.length >= 2; // 50% + BE move
        const frac = partial ? 0.5 : remainingFrac(t);
        t.legs.push({ price: rungPx, frac, r: rOf(rungPx), at: bar.t + 60_000, tag: `RUNG${nextIdx + 1}` });
        pushEvent(t, `RUNG${nextIdx + 1}`, `rung ${nextIdx + 1} (${rung.label}) hit at ${rungPx.toPrecision(8)} — ${(frac * 100).toFixed(0)}% off @ ${rOf(rungPx).toFixed(2)}R`, rungPx);
        persist("RUNG", t);
        notify(
          t,
          "paper_tp",
          `${t.sym} virtual ${modelShort(t)} ${t.direction} rung ${nextIdx + 1} hit @ ${rungPx.toPrecision(8)}`,
          `${(frac * 100).toFixed(0)}% off at ${rOf(rungPx).toFixed(2)}R${partial ? " · stop moved to breakeven" : " · position fully closed"} · rung ${rung.label}`,
          rungPx
        );
        if (!partial) {
          t.status = "CLOSED";
          t.outcome = nextIdx === 0 ? "TP1" : "TP2";
          t.closedAt = bar.t + 60_000;
          t.lastMark = rungPx;
          t.lastMarkAt = bar.t + 60_000;
          t.markSource = "m1-bar";
          persist("CLOSED", t, `final rung ${nextIdx + 1}`);
          return;
        }
        // move stop to breakeven; same-bar BE re-check (pessimistic)
        t.stop = entry;
        t.stopAtBe = true;
        const beHit = long ? bar.l <= entry : bar.h >= entry;
        if (beHit) {
          const bePx = long ? Math.min(bar.o, entry) : Math.max(bar.o, entry);
          closeTicket(t, "BE", bePx, bar.t + 60_000, "breakeven stop hit within the rung-1 bar (pessimistic)", "m1-bar");
        }
      }
    }
  }
}

/** live-mark fallback when bars are unavailable (degraded but honest) */
function processMark(t: PaperTicket, mark: Mark) {
  if (mark.price == null || !(mark.price > 0)) return;
  const now = mark.at || Date.now();
  t.lastMark = mark.price;
  t.lastMarkAt = now;
  t.markSource = mark.source;
  if (t.status === "CLOSED") return;
  const risk = riskOf(t);
  if (risk > 0) {
    const r = rAt(t, mark.price);
    t.mfeR = Math.max(t.mfeR, r);
    t.maeR = Math.min(t.maeR, r);
  }
  const long = t.direction === "LONG";
  if (t.status === "ARMED") {
    const hi = t.entryZone[1];
    const lo = t.entryZone[0];
    // mark inside the zone (or at its near edge) → fill at near edge
    if (long ? mark.price <= hi && mark.price >= lo : mark.price >= lo && mark.price <= hi) {
      fillTicket(t, nearEdge(t), now, `mark:${mark.source}`, null);
    }
    return;
  }
  if (t.status === "OPEN") {
    const stopHit = long ? mark.price <= t.stop : mark.price >= t.stop;
    if (stopHit) {
      closeTicket(t, t.stopAtBe ? "BE" : "SL", t.stop, now, `stop crossed by live mark (${mark.source})`, `mark:${mark.source}`);
      return;
    }
    const rs = rungs(t);
    const nextIdx = rs.findIndex((r) => r.hitAt == null);
    if (nextIdx >= 0) {
      const rung = rs[nextIdx];
      const hit = long ? mark.price >= rung.level : mark.price <= rung.level;
      if (hit) {
        rung.hitAt = now;
        rung.hitPrice = rung.level;
        const partial = nextIdx === 0 && rs.length >= 2;
        const frac = partial ? 0.5 : remainingFrac(t);
        const entry = t.filledPrice ?? nearEdge(t);
        const r = risk > 0 && entry > 0 ? (dirSign(t) * (rung.level - entry)) / risk : 0;
        t.legs.push({ price: rung.level, frac, r, at: now, tag: `RUNG${nextIdx + 1}` });
        pushEvent(t, `RUNG${nextIdx + 1}`, `rung ${nextIdx + 1} hit via mark (${mark.source})`, rung.level);
        persist("RUNG", t);
        if (!partial) {
          t.status = "CLOSED";
          t.outcome = nextIdx === 0 ? "TP1" : "TP2";
          t.closedAt = now;
          persist("CLOSED", t, `final rung ${nextIdx + 1} via mark`);
        } else {
          t.stop = entry;
          t.stopAtBe = true;
        }
      }
    }
  }
}

async function trackPass() {
  loadFromDisk();
  const now = Date.now();
  const active = [...PB.tickets.values()].filter((x) => x.status !== "CLOSED");
  if (!active.length) {
    PB.lastPassAt = now;
    PB.passTelemetry = [];
    return;
  }
  const bySym = new Map<string, PaperTicket[]>();
  for (const t of active) {
    const arr = bySym.get(t.sym) ?? [];
    arr.push(t);
    bySym.set(t.sym, arr);
  }
  const telemetry: { sym: string; bars: number; mark: number | null; source: string }[] = [];
  for (const [sym, tickets] of bySym) {
    const since = Math.min(...tickets.map((x) => (x.lastBarTs > 0 ? x.lastBarTs : x.armedAt)));
    const [bars, mark] = await Promise.all([m1Bars(sym, since).catch(() => [] as OHLCVCandle[]), markOf(sym).catch(() => ({ price: null, source: "none", at: Date.now() }) as Mark)]);
    telemetry.push({ sym, bars: bars.length, mark: mark.price, source: mark.source });
    const lastBarTs = bars.length ? bars[bars.length - 1].t : 0;
    for (const t of tickets) {
      try {
        // M2 born-armed → immediate market fill at the live mark (market-entry
        // semantics: "enter on the confirmation bar close"; the first tracking
        // tick ≤ 60 s later IS that close's market). No mark → retry next pass;
        // the 15-min armed expiry retires unreachable entries honestly.
        if (t.status === "ARMED" && t.model === "M2_MEAN_REVERSION" && mark.price != null) {
          fillTicket(t, mark.price, now, `mark:${mark.source}`, null);
        }
        // chronological bar sweep (bars that were live during/after arming)
        if (bars.length) {
          for (const bar of bars) {
            if (bar.t + 60_000 <= t.armedAt) continue; // bar closed before arm
            if (t.status === "CLOSED") break;
            processBar(t, bar);
          }
          // lastBarTs = last CLOSED bar (forming bar re-processed next pass, idempotent)
          const forming = lastBarTs > now - 60_000;
          const lastClosedTs = forming && bars.length > 1 ? bars[bars.length - 2].t : lastBarTs;
          if (lastClosedTs > t.lastBarTs) t.lastBarTs = lastClosedTs;
        }
        // live mark: unrealized + degraded-path fills/stops
        processMark(t, mark);
        // expiry (ARMED) / time-stop (OPEN) — fresh mark required
        const freshMark = t.lastMarkAt != null && now - t.lastMarkAt < FRESH_MARK_MS;
        if (t.status === "ARMED" && now > t.expiresAt) {
          t.status = "CLOSED";
          t.outcome = "EXPIRED";
          t.closedAt = now;
          pushEvent(t, "EXPIRED", "zone never filled within TTL", null);
          persist("EXPIRED", t);
          notify(t, "paper_expire", `${t.sym} virtual setup expired unfilled`, `zone ${t.entryZone[0].toPrecision(8)}–${t.entryZone[1].toPrecision(8)} never traded in ${(t.expiresAt - t.armedAt) / 3_600_000} h`, null);
        } else if (t.status === "OPEN" && now > t.timeStopAt && freshMark && t.lastMark != null) {
          closeTicket(t, "TIME_STOP", t.lastMark, now, `model time-stop (${t.model === "M2_MEAN_REVERSION" ? 18 : 48} h)`, t.markSource ?? "mark");
        }
      } catch {
        /* one bad ticket must not kill the pass */
      }
    }
  }
  PB.passTelemetry = telemetry;
  PB.lastPassAt = now;
}

// ---------------------------------------------------------------------------
// arm sweep — full-universe narrative pass (route hits keep hot syms fresh)
// ---------------------------------------------------------------------------

function sweepList(): string[] {
  const env = (process.env.CG_PAPERBOOK_ASSETS ?? "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const perps = CURATED.filter((c) => c.kind !== "classic").map((c) => c.sym);
  const classics = CURATED.filter((c) => c.kind === "classic").map((c) => c.sym);
  const all = [...perps, ...classics];
  return env.length ? all.filter((s) => env.includes(s)) : all;
}

async function sweepPass() {
  loadFromDisk();
  const list = sweepList();
  if (!list.length) return;
  const now = Date.now();
  let picked = 0;
  let idx = PB.sweepIdx;
  const results: { at: number; sym: string; result: string }[] = [];
  while (picked < SWEEP_PER_TICK && idx < PB.sweepIdx + list.length) {
    const sym = list[idx % list.length];
    idx++;
    const last = PB.lastArmAt.get(sym) ?? 0;
    if (now - last < SWEEP_SYM_DEDUP_MS) continue;
    PB.lastArmAt.set(sym, now);
    picked++;
    try {
      const v = await buildNarrative(sym);
      const res = armFromVerdict(v, "sweep");
      results.push({ at: now, sym, result: `${res.action}: ${res.reason}` });
    } catch (e) {
      PB.lastSweepErr = e instanceof Error ? e.message : "narrative build failed";
      results.push({ at: now, sym, result: `error: ${PB.lastSweepErr}` });
    }
  }
  PB.sweepIdx = idx % list.length;
  PB.lastSweepAt = now;
  if (results.length) {
    PB.armLog = [...PB.armLog, ...results].slice(-40);
  }
}

// ---------------------------------------------------------------------------
// public snapshot + stats
// ---------------------------------------------------------------------------

export interface PaperBookTicketView extends PaperTicket {
  unrealizedR: number | null;
  totalR: number | null;
  riskPerUnit: number | null;
  remainingFrac: number;
}

function withDerived(t: PaperTicket): PaperBookTicketView {
  const risk = riskOf(t);
  const rem = remainingFrac(t);
  const unreal = t.status === "OPEN" && t.lastMark != null && risk > 0 ? rem * rAt(t, t.lastMark) : null;
  return {
    ...t,
    unrealizedR: unreal,
    totalR: t.status === "CLOSED" ? realizedR(t) : unreal != null ? realizedR(t) + unreal : null,
    riskPerUnit: risk > 0 ? risk : null,
    remainingFrac: rem,
  };
}

export function paperBookTickets(filter?: { sym?: string; status?: "ARMED" | "OPEN" | "CLOSED"; limit?: number }): PaperBookTicketView[] {
  loadFromDisk();
  let out = [...PB.tickets.values()];
  if (filter?.sym) out = out.filter((t) => t.sym === filter.sym?.toUpperCase());
  if (filter?.status) out = out.filter((t) => t.status === filter.status);
  const rank = (t: PaperTicket): number => (t.status === "OPEN" ? 0 : t.status === "ARMED" ? 1 : 2);
  out.sort((a, b) => rank(a) - rank(b) || (b.closedAt ?? b.armedAt) - (a.closedAt ?? a.armedAt));
  const limit = filter?.limit ?? 200;
  return out.slice(0, limit).map(withDerived);
}

function statsBucket(bucket: string, list: PaperTicket[]): PbStats {
  const filled = list.filter((t) => t.filledAt != null);
  const closed = list.filter((t) => t.status === "CLOSED" && t.filledAt != null);
  const rs = closed.map((t) => realizedR(t));
  const wins = rs.filter((r) => r > 0);
  const losses = rs.filter((r) => r <= 0);
  const holds = closed.map((t) => ((t.closedAt ?? t.filledAt ?? 0) - (t.filledAt ?? 0)) / 60_000);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  return {
    bucket,
    armed: list.length,
    filled: filled.length,
    wins: wins.length,
    losses: losses.length,
    winRatePct: closed.length ? Number(((wins.length / closed.length) * 100).toFixed(1)) : null,
    avgWinR: mean(wins) != null ? Number(mean(wins)!.toFixed(3)) : null,
    avgLossR: mean(losses) != null ? Number(mean(losses)!.toFixed(3)) : null,
    expectancyR: mean(rs) != null ? Number(mean(rs)!.toFixed(3)) : null,
    totalR: rs.length ? Number(rs.reduce((s, x) => s + x, 0).toFixed(2)) : null,
    avgHoldMin: mean(holds) != null ? Number(mean(holds)!.toFixed(0)) : null,
    fillRatePct: list.length ? Number(((filled.length / list.length) * 100).toFixed(1)) : null,
  };
}

export function paperBookStats(): PbStats[] {
  loadFromDisk();
  const all = [...PB.tickets.values()];
  return [
    statsBucket("ALL", all),
    statsBucket("M1_TREND_PULLBACK", all.filter((t) => t.model === "M1_TREND_PULLBACK")),
    statsBucket("WAIT_PULLBACK", all.filter((t) => t.model === "WAIT_PULLBACK")),
    statsBucket("M2_MEAN_REVERSION", all.filter((t) => t.model === "M2_MEAN_REVERSION")),
  ];
}

export function paperBookTelemetry() {
  loadFromDisk();
  const tickets = [...PB.tickets.values()];
  return {
    started: PB.started,
    enabled: process.env.CG_PAPERBOOK !== "off",
    universe: sweepList().length,
    sweepPos: PB.sweepIdx,
    armed: tickets.filter((t) => t.status === "ARMED").length,
    open: tickets.filter((t) => t.status === "OPEN").length,
    closed: tickets.filter((t) => t.status === "CLOSED").length,
    lastPassAt: PB.lastPassAt,
    lastPassErr: PB.lastPassErr,
    lastSweepAt: PB.lastSweepAt,
    lastSweepErr: PB.lastSweepErr,
    passTelemetry: PB.passTelemetry,
    armLog: PB.armLog.slice(-12),
  };
}

/** full route payload with the honest freshness envelope */
export function paperBookSnapshot(filter?: { sym?: string; status?: "ARMED" | "OPEN" | "CLOSED"; limit?: number }) {
  const neverRan = !PB.lastPassAt;
  const ageMs = neverRan ? -1 : Math.max(0, Date.now() - PB.lastPassAt);
  return {
    ok: true as const,
    tickets: paperBookTickets(filter),
    stats: paperBookStats(),
    telemetry: paperBookTelemetry(),
    freshness: {
      dataAt: PB.lastPassAt,
      ageMs,
      stale: neverRan || ageMs > 5 * 60_000,
      source: neverRan
        ? "engine:paperbook(booting — first track pass pending)"
        : "engine:paperbook(track 60s · sweep 90s) · bars fapi/hl-m1 · marks bookTicker/hl-xyz",
    },
  };
}

/** raw stored ticket by id — test harness / replay tooling (mutations land
 * on the live book object, unlike the derived API views) */
export function getRawTicket(id: string): PaperTicket | null {
  loadFromDisk();
  return PB.tickets.get(id) ?? null;
}

/** the most relevant ticket for a symbol (OPEN > ARMED > recent CLOSED) */
export function paperTicketOfSym(sym: string): PaperBookTicketView | null {
  loadFromDisk();
  const s = sym.toUpperCase();
  const mine = [...PB.tickets.values()].filter((t) => t.sym === s);
  if (!mine.length) return null;
  const open = mine.filter((t) => t.status === "OPEN").sort((a, b) => (b.filledAt ?? 0) - (a.filledAt ?? 0))[0];
  if (open) return withDerived(open);
  const armed = mine.filter((t) => t.status === "ARMED").sort((a, b) => b.armedAt - a.armedAt)[0];
  if (armed) return withDerived(armed);
  const closed = mine.filter((t) => t.status === "CLOSED").sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0))[0];
  return closed ? withDerived(closed) : null;
}

/** reset the book (ops/testing) — clears memory + writes a RESET marker */
export function resetPaperBook(): void {
  loadFromDisk();
  PB.tickets.clear();
  PB.armLog = [];
  try {
    fs.mkdirSync(ROOT, { recursive: true });
    fs.writeFileSync(BOOK_FILE, JSON.stringify({ at: Date.now(), type: "RESET", id: "book" }) + "\n", "utf8");
  } catch {
    /* best effort */
  }
}

// ---------------------------------------------------------------------------
// engine wiring
// ---------------------------------------------------------------------------

export function ensurePaperBook(): { started: boolean } {
  loadFromDisk();
  if (PB.started || process.env.CG_PAPERBOOK === "off") return { started: PB.started };
  PB.started = true;
  // track pass: every 60 s (overlap-guarded)
  let trackBusy = false;
  const trackFirst = setTimeout(() => {
    const id = setInterval(() => {
      if (trackBusy) return;
      trackBusy = true;
      trackPass()
        .catch((e) => {
          PB.lastPassErr = e instanceof Error ? e.message : "track pass failed";
        })
        .finally(() => {
          trackBusy = false;
        });
    }, TRACK_EVERY_MS);
    id.unref?.();
  }, 40_000);
  trackFirst.unref?.();
  // arm sweep: every 90 s, SWEEP_PER_TICK symbols per tick
  let sweepBusy = false;
  const sweepFirst = setTimeout(() => {
    const id = setInterval(() => {
      if (sweepBusy) return;
      sweepBusy = true;
      sweepPass()
        .catch((e) => {
          PB.lastSweepErr = e instanceof Error ? e.message : "sweep pass failed";
        })
        .finally(() => {
          sweepBusy = false;
        });
    }, SWEEP_EVERY_MS);
    id.unref?.();
  }, 70_000);
  sweepFirst.unref?.();
  return { started: true };
}
