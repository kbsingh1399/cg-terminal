/**
 * CUSTOM USER ALERT RULES ENGINE (WS5, 2026-11-12).
 *
 * Persistent JSON rules (data/cg-series/alert-rules.json) evaluated inside
 * the scanner loop every 30 s against live engine state — ZERO extra upstream
 * quota (narrative radar verdicts, scanner market snapshots, liq-live rings,
 * radar funding APR, server price hub):
 *
 *   grade      — narrative M1/M2 grade ≥ threshold (B / A / A+)
 *   vwapZ      — |Day VWAP z-score| ≥ threshold
 *   cascade5m  — trailing-5m liquidation cascade USD ≥ threshold (liq-live)
 *   fundingApr — OI-weighted funding APR % ≥ threshold (narrative radar / quant)
 *   priceCross — live price crossing a level (above/below)
 *
 * Fires push a [HIGH] notification into notify.ts (SSE → the Alerts tab and
 * every open terminal), and — when ALERT_WEBHOOK_URL is configured — an
 * authenticated-free JSON POST to the webhook (fire-and-forget, never
 * blocking the scanner). Per rule+symbol 30-minute cooldown; every fire
 * bumps fireCount/lastFiredAt in the persisted file.
 */

import fs from "fs";
import path from "path";
import { resolveDataRoot } from "./store";
import { emit } from "./notify";
import { getMarketSnapshot } from "./scan";
import { liqWindows5m } from "./liq-live";
import { narrativeRadarStates } from "./narrative";
import { getLivePrice } from "../live/server-price";
import { CURATED } from "@/lib/universe/curated";

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

export type AlertRuleKind = "grade" | "vwapZ" | "cascade5m" | "fundingApr" | "priceCross";

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  kind: AlertRuleKind;
  /** target syms (empty = all Curated-61) */
  syms: string[];
  /** grade: 2=B 3=A 4=A+ · vwapZ: |σ| · cascade5m: USD · fundingApr: % APR */
  threshold: number | null;
  /** priceCross: the level */
  level: number | null;
  /** priceCross direction */
  direction: "above" | "below";
  createdAt: number;
  fires: number;
  lastFiredAt: number | null;
}

interface RulesFile {
  version: 1;
  rules: AlertRule[];
}

// ---------------------------------------------------------------------------
// persistence
// ---------------------------------------------------------------------------

const ROOT = resolveDataRoot();
const RULES_FILE = path.join(ROOT, "alert-rules.json");

const gAr = globalThis as unknown as {
  __cgAlertRules?: { rules: AlertRule[]; loaded: boolean; cooldown: Map<string, number>; lastSide: Map<string, "above" | "below">; persistAt: number | null };
};
const AR: { rules: AlertRule[]; loaded: boolean; cooldown: Map<string, number>; lastSide: Map<string, "above" | "below">; persistAt: number | null } =
  (gAr.__cgAlertRules ??= { rules: [] as AlertRule[], loaded: false, cooldown: new Map(), lastSide: new Map(), persistAt: null });
const COOLDOWN_MS = 30 * 60_000;

function loadRules(): AlertRule[] {
  if (AR.loaded) return AR.rules;
  try {
    const f = JSON.parse(fs.readFileSync(RULES_FILE, "utf8")) as RulesFile;
    AR.rules = Array.isArray(f.rules) ? f.rules.filter((r) => r && r.id && r.kind) : [];
  } catch {
    AR.rules = [];
  }
  AR.loaded = true;
  return AR.rules;
}

function persistRules() {
  try {
    fs.mkdirSync(ROOT, { recursive: true });
    const body: RulesFile = { version: 1, rules: AR.rules };
    fs.writeFileSync(RULES_FILE, JSON.stringify(body, null, 2));
  } catch {
    /* disk issues must never break evaluation */
  }
}

export function listRules(): AlertRule[] {
  return [...loadRules()].sort((a, b) => b.createdAt - a.createdAt);
}

const GRADE_RANK: Record<string, number> = { "A+": 4, A: 3, B: 2, C: 1, SKIP: 1 };

function newId(): string {
  return `AR-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createRule(input: Partial<AlertRule> & { kind: AlertRuleKind }): AlertRule | { error: string } {
  loadRules();
  const kinds: AlertRuleKind[] = ["grade", "vwapZ", "cascade5m", "fundingApr", "priceCross"];
  if (!kinds.includes(input.kind)) return { error: `kind must be one of ${kinds.join(", ")}` };
  const rule: AlertRule = {
    id: newId(),
    name: (input.name ?? `${input.kind} rule`).slice(0, 64),
    enabled: input.enabled ?? true,
    kind: input.kind,
    syms: (input.syms ?? []).map((s) => s.trim().toUpperCase()).filter((s) => CURATED.some((c) => c.sym === s)).slice(0, 61),
    threshold: input.threshold != null && Number.isFinite(input.threshold) ? input.threshold : input.kind === "grade" ? 3 : null,
    level: input.level != null && Number.isFinite(input.level) ? input.level : null,
    direction: input.direction === "below" ? "below" : "above",
    createdAt: Date.now(),
    fires: 0,
    lastFiredAt: null,
  };
  if (rule.kind === "priceCross" && (rule.level == null || !Number.isFinite(rule.level))) {
    return { error: "priceCross requires a numeric level" };
  }
  if (rule.kind !== "priceCross" && rule.kind !== "grade" && rule.threshold == null) {
    return { error: `${rule.kind} requires a numeric threshold` };
  }
  AR.rules.push(rule);
  persistRules();
  return rule;
}

export function updateRule(id: string, patch: Partial<AlertRule>): AlertRule | { error: string } {
  loadRules();
  const r = AR.rules.find((x) => x.id === id);
  if (!r) return { error: `rule ${id} not found` };
  if (patch.name != null) r.name = String(patch.name).slice(0, 64);
  if (patch.enabled != null) r.enabled = Boolean(patch.enabled);
  if (patch.syms != null) r.syms = patch.syms.map((s) => s.trim().toUpperCase()).filter((s) => CURATED.some((c) => c.sym === s)).slice(0, 61);
  if (patch.threshold != null && Number.isFinite(patch.threshold)) r.threshold = patch.threshold;
  if (patch.level != null && Number.isFinite(patch.level)) r.level = patch.level;
  if (patch.direction != null) r.direction = patch.direction === "below" ? "below" : "above";
  persistRules();
  return r;
}

export function deleteRule(id: string): { ok: boolean } | { error: string } {
  loadRules();
  const before = AR.rules.length;
  AR.rules = AR.rules.filter((x) => x.id !== id);
  if (AR.rules.length === before) return { error: `rule ${id} not found` };
  persistRules();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// webhook (optional — ALERT_WEBHOOK_URL in .env)
// ---------------------------------------------------------------------------

async function webhookFire(rule: AlertRule, sym: string, detail: string, extra: Record<string, unknown>) {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "cg-alert-rule", rule: { id: rule.id, name: rule.name, kind: rule.kind }, sym, detail, at: Date.now(), ...extra }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    /* webhook failures never break the scanner */
  }
}

// ---------------------------------------------------------------------------
// evaluation (called from the scanner loop every 30 s)
// ---------------------------------------------------------------------------

interface EvalResult {
  evaluated: number;
  fired: number;
  skippedCooldown: number;
}

export async function evaluateAlertRules(): Promise<EvalResult> {
  const rules = loadRules().filter((r) => r.enabled);
  if (!rules.length) return { evaluated: 0, fired: 0, skippedCooldown: 0 };
  const radar = narrativeRadarStates();
  const universe = CURATED.map((c) => c.sym);
  const cascade5m = new Map<string, number>();
  for (const w of liqWindows5m()) cascade5m.set(w.sym, w.longUsd + w.shortUsd);

  let evaluated = 0;
  let fired = 0;
  let skippedCooldown = 0;
  const now = Date.now();

  for (const rule of rules) {
    const targets = rule.syms.length ? rule.syms : universe;
    for (const sym of targets) {
      evaluated++;
      const cdKey = `${rule.id}|${sym}`;
      if (AR.cooldown.has(cdKey) && now - (AR.cooldown.get(cdKey) ?? 0) < COOLDOWN_MS) {
        skippedCooldown++;
        continue;
      }
      let hit = false;
      let value = "";
      let detail = "";
      let dir: "bullish" | "bearish" | "neutral" = "neutral";
      let price: number | null = null;

      if (rule.kind === "grade") {
        const m = radar.get(sym);
        const rank = m ? GRADE_RANK[m.grade] ?? 0 : 0;
        const armable = m?.activeModel === "M1_TREND_PULLBACK" || m?.activeModel === "M2_MEAN_REVERSION";
        if (m && armable && rank >= (rule.threshold ?? 3)) {
          hit = true;
          value = `${m.activeModel} ${m.grade}`;
          detail = `${m.activeModel} grade ${m.grade} (${m.direction}, confidence ${m.confidence}/100, EV ${m.evR != null ? `${m.evR}R` : "n/a"})`;
          dir = m.direction === "LONG" ? "bullish" : m.direction === "SHORT" ? "bearish" : "neutral";
          price = null;
        }
      } else if (rule.kind === "vwapZ") {
        const mkt = getMarketSnapshot(sym);
        const vwap = mkt?.vwap.vwap ?? null;
        const sd1 = mkt?.vwap.bands.sd1 ?? null;
        const px = mkt?.price.last ?? null;
        const z = px != null && vwap != null && sd1 != null && sd1 > 0 ? (px - vwap) / sd1 : radar.get(sym)?.vwapZ ?? null;
        if (z != null && Math.abs(z) >= (rule.threshold ?? 2)) {
          hit = true;
          value = `${z >= 0 ? "+" : ""}${z.toFixed(2)}σ`;
          detail = `Day VWAP z ${value} (|z| ≥ ${rule.threshold}) — ${z >= 0 ? "upside" : "downside"} stretch`;
          dir = z >= 0 ? "bearish" : "bullish"; // stretch exhaustion framing
          price = px;
        }
      } else if (rule.kind === "cascade5m") {
        const usd = cascade5m.get(sym) ?? 0;
        if (usd >= (rule.threshold ?? 200_000)) {
          hit = true;
          value = `$${Math.round(usd / 1000)}k`;
          detail = `trailing-5m liquidation cascade ${value} (≥ $${Math.round((rule.threshold ?? 0) / 1000)}k, liq-live multi-venue)`;
          dir = "neutral";
        }
      } else if (rule.kind === "fundingApr") {
        const apr = radar.get(sym)?.fundingAprPct ?? null;
        if (apr != null && apr >= (rule.threshold ?? 50)) {
          hit = true;
          value = `${apr.toFixed(1)}% APR`;
          detail = `OI-weighted funding APR ${value} (≥ ${rule.threshold}%) — crowded long carry`;
          dir = "bearish";
        }
      } else if (rule.kind === "priceCross" && rule.level != null) {
        let px: number | null = null;
        try {
          const lp = await getLivePrice(sym);
          px = lp?.price ?? null;
        } catch {
          px = null;
        }
        if (px == null) px = getMarketSnapshot(sym)?.price.last ?? null;
        if (px != null && rule.level != null) {
          const side = px > rule.level ? "above" : "below";
          const prev = AR.lastSide.get(cdKey);
          AR.lastSide.set(cdKey, side);
          if (prev != null && prev !== side && side === rule.direction) {
            hit = true;
            value = px.toPrecision(8);
            detail = `price crossed ${rule.direction} ${rule.level.toPrecision(8)} → now ${value}`;
            dir = side === "above" ? "bullish" : "bearish";
            price = px;
          }
        }
      }

      if (!hit) continue;
      AR.cooldown.set(cdKey, now);
      fired++;
      rule.fires++;
      rule.lastFiredAt = now;
      AR.persistAt = now;
      const emitted = emit({
        ts: now,
        asset: sym,
        source: "alert-rules",
        kind: `rule_${rule.kind}`,
        dir,
        severity: "high",
        title: `${sym} ${rule.name} — ${value}`,
        detail: `user rule "${rule.name}" (${rule.kind}${rule.threshold != null ? ` ≥ ${rule.threshold}` : ""}) fired: ${detail}`,
        price,
        meta: { ruleId: rule.id, ruleKind: rule.kind, threshold: rule.threshold, value },
      });
      void webhookFire(rule, sym, detail, { notificationId: emitted?.id ?? null });
    }
  }

  if (AR.persistAt != null && now - AR.persistAt < 5_000) {
    persistRules(); // throttled: only after fires
    AR.persistAt = null;
  }
  if (AR.cooldown.size > 2_000) {
    for (const [k, t] of AR.cooldown) if (now - t > COOLDOWN_MS) AR.cooldown.delete(k);
  }
  return { evaluated, fired, skippedCooldown };
}

/** liveness telemetry for /api/cg/alert-rules and the scanner status */
export function alertRulesTelemetry() {
  const rules = loadRules();
  return {
    rules: rules.length,
    enabled: rules.filter((r) => r.enabled).length,
    fires: rules.reduce((s, r) => s + r.fires, 0),
    webhookConfigured: Boolean(process.env.ALERT_WEBHOOK_URL),
    cooldownEntries: AR.cooldown.size,
  };
}
