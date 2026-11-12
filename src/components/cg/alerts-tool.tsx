"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmtAssetPrice, symDecs } from "@/lib/cg/assets";

/**
 * Live notification feed — every event from every tab (footprint signals,
 * indicator events, whale walls, liquidation sweep setups, CVD divergences),
 * streamed over SSE the moment the scanner detects it, with the full
 * persisted history on load. Filters by asset / source / direction.
 */

interface Notif {
  id: number;
  ts: number;
  asset: string;
  source: string;
  kind: string;
  dir: "bullish" | "bearish" | "neutral";
  severity: "info" | "high";
  title: string;
  detail: string;
  price: number | null;
  barTs?: number;
  barType?: string;
}

const SOURCES: { key: string; label: string }[] = [
  { key: "footprint", label: "Footprint signals" },
  { key: "indicators", label: "Indicators" },
  { key: "whale-orders", label: "Whale orders" },
  { key: "liqlevels", label: "Liq clusters" },
  { key: "liq-live", label: "Liq cascades" },
  { key: "cvd", label: "CVD" },
  { key: "paperbook", label: "Paper book" },
  { key: "engine", label: "Engine" },
];

const SOURCE_COLOR: Record<string, string> = {
  footprint: "bg-sky-500/15 text-sky-300",
  indicators: "bg-violet-500/15 text-violet-300",
  "whale-orders": "bg-amber-500/15 text-amber-300",
  liqlevels: "bg-rose-500/15 text-rose-300",
  "liq-live": "bg-red-600/20 text-red-300",
  cvd: "bg-teal-500/15 text-teal-300",
  paperbook: "bg-fuchsia-500/15 text-fuchsia-300",
  engine: "bg-neutral-500/15 text-neutral-300",
};

export default function AlertsTool({ sym }: { sym?: string }) {
  const [items, setItems] = useState<Notif[]>([]);
  const [assetFilter, setAssetFilter] = useState<string>(sym ?? "all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [dirFilter, setDirFilter] = useState<string>("all");
  const [live, setLive] = useState(false);
  const [stats, setStats] = useState<{ total: number; last24h: number; bySource: Record<string, number> } | null>(null);
  const alive = useRef(true);
  const loadedRef = useRef(false);
  const [derived, setDerived] = useState<{ sym: string; items: Notif[] }>({ sym: "", items: [] });

  useEffect(() => {
    if (!sym) return;
    let cancelled = false;
    (async () => {
      const target = sym.trim().toUpperCase();
      const out: Notif[] = [];
      let nextId = -1000;
      const fmtP = (n: number | null | undefined) => {
        if (n == null || !Number.isFinite(n)) return "–";
        const d = symDecs(target, n);
        return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
      };
      try {
        const [mktRes, sigRes] = await Promise.all([
          fetch(`/api/cg/market?sym=${encodeURIComponent(target)}`),
          fetch(`/api/cg/signals?sym=${encodeURIComponent(target)}`),
        ]);
        const mkt = mktRes.ok ? await mktRes.json() : null;
        const sig = sigRes.ok ? await sigRes.json() : null;
        if (cancelled) return;

        if (sig?.ok && Array.isArray(sig.sets)) {
          for (const set of sig.sets) {
            for (const g of set.sigs ?? []) {
              const high = g.t === "Absorption" || g.t === "Trap" || g.t === "Strong Divergence";
              out.push({
                id: nextId--,
                ts: g.ts * 1000,
                asset: target,
                source: "footprint",
                kind: g.t,
                dir: g.side === "buy" ? "bullish" : "bearish",
                severity: high ? "high" : "info",
                title: `${g.name ?? g.t} (${set.label})`,
                detail: `${g.side === "buy" ? "Bullish" : "Bearish"} footprint signal @ ${fmtP(g.p)} on ${set.label} bars`,
                price: g.p,
                barType: set.bt,
              });
            }
          }
        }

        if (mkt?.ok && mkt.price?.last != null) {
          const px: number = mkt.price.last;
          const tsNow = mkt.updatedAt || Date.now();
          for (const tfKey of ["h4", "d1", "h1", "m15"] as const) {
            const emaRow = mkt.ema?.[tfKey];
            const rsiVal: number | null = mkt.rsi?.[tfKey] ?? null;
            if (!emaRow && rsiVal == null) continue;
            const tfName = tfKey === "h4" ? "4H" : tfKey === "d1" ? "1D" : tfKey === "h1" ? "1H" : "15m";
            if (emaRow?.e13 != null && emaRow?.e89 != null && (tfKey === "h4" || tfKey === "d1")) {
              const bull = emaRow.e13 > emaRow.e89;
              const spreadPct = Math.abs((emaRow.e13 - emaRow.e89) / emaRow.e89) * 100;
              out.push({
                id: nextId--,
                ts: tsNow,
                asset: target,
                source: "indicators",
                kind: "ema-trend",
                dir: bull ? "bullish" : "bearish",
                severity: "info",
                title: `${tfName} EMA13 ${bull ? ">" : "<"} EMA89 Trend`,
                detail: `EMA13 ${fmtP(emaRow.e13)} vs EMA89 ${fmtP(emaRow.e89)} (${spreadPct.toFixed(2)}% spread)`,
                price: px,
              });
            }
            if (rsiVal != null && (rsiVal >= 70 || rsiVal <= 30)) {
              const ob = rsiVal >= 70;
              out.push({
                id: nextId--,
                ts: tsNow,
                asset: target,
                source: "indicators",
                kind: "rsi-extreme",
                dir: ob ? "bearish" : "bullish",
                severity: "high",
                title: `${tfName} RSI(14) ${ob ? "Overbought" : "Oversold"} (${rsiVal.toFixed(1)})`,
                detail: `${target} momentum extreme on ${tfName} close @ ${fmtP(px)}`,
                price: px,
              });
            }
          }
          const vwap = mkt.vwap?.vwap;
          const sd2 = mkt.vwap?.bands?.sd2;
          if (vwap != null && sd2 != null && sd2 > 0) {
            const z = (px - vwap) / sd2;
            if (Math.abs(z) >= 1.0) {
              out.push({
                id: nextId--,
                ts: tsNow,
                asset: target,
                source: "indicators",
                kind: "vwap-band",
                dir: z >= 0 ? "bullish" : "bearish",
                severity: Math.abs(z) >= 1.4 ? "high" : "info",
                title: `${z >= 0 ? "Above +2σ" : "Below −2σ"} Day VWAP`,
                detail: `Price ${fmtP(px)} vs VWAP ${fmtP(vwap)} (${z >= 0 ? "+" : ""}${(z * 2).toFixed(1)}σ band)`,
                price: px,
              });
            }
          }
          const dayPoc = mkt.auction?.day?.poc;
          if (dayPoc != null && dayPoc > 0 && Math.abs(px - dayPoc) / dayPoc < 0.003) {
            out.push({
              id: nextId--,
              ts: tsNow,
              asset: target,
              source: "indicators",
              kind: "poc-magnet",
              dir: "neutral",
              severity: "info",
              title: `Testing Day POC Value Magnet`,
              detail: `Price ${fmtP(px)} within 0.3% of Day POC ${fmtP(dayPoc)}`,
              price: px,
            });
          }
        }
      } catch {
        /* ignore offline/timeout */
      }
      if (!cancelled) setDerived({ sym: target, items: out });
    })();
    return () => {
      cancelled = true;
    };
  }, [sym]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/cg/notifications?limit=500");
      const json = await res.json();
      if (!alive.current) return;
      if (json.ok) {
        setItems(json.items as Notif[]);
        setStats(json.stats ?? null);
      }
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    let kick: ReturnType<typeof setTimeout> | undefined;
    if (!loadedRef.current) {
      loadedRef.current = true;
      // kick the initial load off the effect body — `load`'s setState lands
      // after its awaits anyway; the timeout keeps it out of the synchronous
      // effect path (no cascading render from the effect itself).
      kick = setTimeout(load, 0);
    }
    const es = new EventSource("/api/cg/stream");
    es.addEventListener("hello", () => setLive(true));
    es.addEventListener("notification", (ev) => {
      try {
        const n = JSON.parse((ev as MessageEvent).data) as Notif;
        setItems((prev) => (prev.some((x) => x.id === n.id) ? prev : [...prev, n].slice(-800)));
      } catch {
        /* skip */
      }
    });
    es.onerror = () => setLive(false);
    const poll = setInterval(load, 120_000); // safety net behind SSE
    return () => {
      alive.current = false;
      es.close();
      clearInterval(poll);
      if (kick) clearTimeout(kick);
    };
  }, [load]);

  // keep the asset filter glued to the active symbol — adjusted during render
  // on prop change (React docs pattern), no effect needed
  const [prevSym, setPrevSym] = useState(sym);
  if (sym !== prevSym) {
    setPrevSym(sym);
    if (sym) setAssetFilter(sym);
  }

  const merged = useMemo(() => {
    const derivedItems = sym && derived.sym === sym.trim().toUpperCase() ? derived.items : [];
    if (!derivedItems.length) return items;
    const sseForSym = sym ? items.filter((n) => n.asset === sym) : [];
    // Include SSE notifications first; supplement with derived market/signal alerts when none or for structural context
    const existingKeys = new Set(sseForSym.map((n) => `${n.source}:${n.kind}:${Math.round(n.ts / 60000)}`));
    const extra = derivedItems.filter((d) => !existingKeys.has(`${d.source}:${d.kind}:${Math.round(d.ts / 60000)}`));
    return [...items, ...extra];
  }, [items, derived, sym]);

  const filtered = useMemo(() => {
    let out = merged;
    if (assetFilter !== "all") out = out.filter((n) => n.asset === assetFilter);
    if (sourceFilter !== "all") out = out.filter((n) => n.source === sourceFilter);
    if (dirFilter !== "all") out = out.filter((n) => n.dir === dirFilter);
    return [...out].sort((a, b) => a.ts - b.ts).reverse(); // newest first
  }, [merged, assetFilter, sourceFilter, dirFilter]);

  const assets = useMemo(() => ["all", ...new Set(merged.map((n) => n.asset))], [merged]);

  const hasSseForSym = Boolean(sym && items.some((n) => n.asset === sym));

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-neutral-800 bg-[#11151a]/60 px-4 py-2.5 text-[11px] leading-relaxed text-neutral-400">
        <span className="font-semibold text-neutral-300">Scanner scope:</span> the notification engine scans all 58
        curated perps (30 crypto + 28 TradFi). Cadence lanes — fast BTC · ETH · SOL (~every 3 min), mid crypto (~every 40
        min), slow TradFi (~every 56 min); whale walls and liq/CVD lanes rotate the full list. The 3 classic instruments
        (SPX500 · UKO · NDX100) have no perp engine — they are quotes+bars only.
      </div>
      {!hasSseForSym && (
        <div className="rounded-lg border border-sky-800/40 bg-sky-950/25 px-4 py-2.5 text-[11px] leading-relaxed text-sky-200/90">
          <span className="font-semibold text-sky-300">{sym ?? "Asset"} · Live Computed Alerts:</span> the background
          SSE daemon streams continuous events for Tier-1 core assets; below are live EMA, RSI, VWAP band, POC, and
          signal alerts computed directly for {sym ?? "this market"}, alongside the full Tier-1 daemon feed when filtered to{" "}
          <span className="font-mono text-sky-300">All assets</span>.
        </div>
      )}
      {/* header */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-800 bg-[#11151a] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`relative flex h-2 w-2 ${live ? "" : "opacity-40"}`}>
            {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${live ? "bg-emerald-400" : "bg-neutral-500"}`} />
          </span>
          <span className="text-sm font-semibold text-neutral-100">Live notification feed</span>
          <span className="text-[10px] text-neutral-500">{live ? "SSE connected" : "reconnecting…"}</span>
        </div>
        {stats && (
          <div className="flex gap-4 text-[10px] text-neutral-500">
            <span>
              <span className="tabular-nums text-neutral-300">{stats.last24h}</span> events / 24h
            </span>
            <span className="hidden sm:inline">
              <span className="tabular-nums text-neutral-300">{stats.total}</span> stored
            </span>
            {SOURCES.filter((s) => stats.bySource[s.key]).map((s) => (
              <span key={s.key} className="hidden lg:inline">
                {s.label.split(" ")[0]} <span className="tabular-nums text-neutral-300">{stats.bySource[s.key]}</span>
              </span>
            ))}
          </div>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={assetFilter} onChange={setAssetFilter} options={assets.map((a) => ({ v: a, l: a === "all" ? "All assets" : a }))} />
          <Select value={sourceFilter} onChange={setSourceFilter} options={[{ v: "all", l: "All sources" }, ...SOURCES.map((s) => ({ v: s.key, l: s.label }))]} />
          <Select
            value={dirFilter}
            onChange={setDirFilter}
            options={[
              { v: "all", l: "Both sides" },
              { v: "bullish", l: "Bullish" },
              { v: "bearish", l: "Bearish" },
            ]}
          />
        </div>
      </div>

      {/* feed */}
      <div className="space-y-1.5">
        {filtered.map((n) => (
          <div
            key={n.id}
            className={`flex items-start gap-3 rounded-lg border bg-[#11151a] px-3 py-2.5 ${
              n.severity === "high" ? "border-amber-600/40" : "border-neutral-800"
            }`}
          >
            <div className="flex w-14 shrink-0 flex-col items-start gap-1">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${n.dir === "bullish" ? "bg-emerald-500/15 text-emerald-400" : n.dir === "bearish" ? "bg-red-500/15 text-red-400" : "bg-neutral-700/30 text-neutral-300"}`}>
                {n.dir === "bullish" ? "LONG" : n.dir === "bearish" ? "SHORT" : "INFO"}
              </span>
              {n.severity === "high" && <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-400">high</span>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-neutral-100">{n.title}</span>
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${SOURCE_COLOR[n.source] ?? "bg-neutral-700/30 text-neutral-300"}`}>{n.source}</span>
              </div>
              <div className="mt-0.5 text-[11px] leading-snug text-neutral-400">{n.detail}</div>
            </div>
            <div className="shrink-0 text-right">
              {n.price != null && (
                <div className="tabular-nums text-xs text-neutral-300">
                  {n.price.toLocaleString("en-US", {
                    minimumFractionDigits: symDecs(n.asset, n.price),
                    maximumFractionDigits: symDecs(n.asset, n.price),
                  }) || fmtAssetPrice(n.price, n.asset)}
                </div>
              )}
              <div className="tabular-nums text-[10px] text-neutral-600">
                {new Date(n.ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
              <div className="text-[10px] text-neutral-600">{new Date(n.ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</div>
            </div>
          </div>
        ))}
        {!filtered.length && (
          <div className="rounded-lg border border-dashed border-neutral-800 py-16 text-center text-sm text-neutral-600">
            {items.length ? "no events match the filters" : "waiting for the first scan — the engine primes on boot, live events follow (m15 closes, wall changes, cluster approaches…)"}
          </div>
        )}
      </div>
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-neutral-700 bg-[#0e1216] px-2 py-1 text-xs text-neutral-300 outline-none focus:border-neutral-500"
    >
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.l}
        </option>
      ))}
    </select>
  );
}
