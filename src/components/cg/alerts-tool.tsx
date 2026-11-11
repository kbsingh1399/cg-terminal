"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmtAssetPrice } from "@/lib/cg/assets";

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
  { key: "cvd", label: "CVD" },
  { key: "engine", label: "Engine" },
];

const SOURCE_COLOR: Record<string, string> = {
  footprint: "bg-sky-500/15 text-sky-300",
  indicators: "bg-violet-500/15 text-violet-300",
  "whale-orders": "bg-amber-500/15 text-amber-300",
  liqlevels: "bg-rose-500/15 text-rose-300",
  cvd: "bg-teal-500/15 text-teal-300",
  engine: "bg-neutral-500/15 text-neutral-300",
};

export default function AlertsTool({ sym, tier2 = false }: { sym?: string; tier2?: boolean }) {
  const [items, setItems] = useState<Notif[]>([]);
  const [assetFilter, setAssetFilter] = useState<string>(sym ?? "all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [dirFilter, setDirFilter] = useState<string>("all");
  const [live, setLive] = useState(false);
  const [stats, setStats] = useState<{ total: number; last24h: number; bySource: Record<string, number> } | null>(null);
  const alive = useRef(true);
  const loadedRef = useRef(false);

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

  const filtered = useMemo(() => {
    let out = items;
    if (assetFilter !== "all") out = out.filter((n) => n.asset === assetFilter);
    if (sourceFilter !== "all") out = out.filter((n) => n.source === sourceFilter);
    if (dirFilter !== "all") out = out.filter((n) => n.dir === dirFilter);
    return [...out].reverse(); // newest first
  }, [items, assetFilter, sourceFilter, dirFilter]);

  const assets = useMemo(() => ["all", ...new Set(items.map((n) => n.asset))], [items]);

  return (
    <div className="space-y-3">
      {tier2 && (
        <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-4 py-2.5 text-[11px] leading-relaxed text-amber-300">
          <span className="font-semibold">Scanner scope:</span> the notification engine scans the 15 Tier-1 registry
          assets (BTC · ETH · SOL · … · XAU · XAG · XPT). Tier-2 Binance top-200 symbols are not scanned — switch the
          filter to All assets for the live feed, or pick a registry symbol for its events.
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
              {n.price != null && <div className="tabular-nums text-xs text-neutral-300">{fmtAssetPrice(n.price, n.asset)}</div>}
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
