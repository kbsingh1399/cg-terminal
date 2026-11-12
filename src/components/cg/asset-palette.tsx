"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * AssetPalette — full-universe command palette (`Ctrl+K` / drawer triggers).
 *
 * Covers the CURATED-61 universe (user directive: 30 crypto perps + 28 TradFi perps
 * + 3 classic — zero gaps), grouped and searchable with category drawer
 * pre-filtering, watchlist pinning and alias matching (PEPE, GOLD, WTI…). Supports category drawer pre-filtering and watchlist pinning.
 */

export type PaletteFilter =
  | "all"
  | "pinned"
  | "crypto"
  | "tradfi"
  | "metal"
  | "binance"
  | "index"
  | "equity"
  | "commodity";

export interface UniAsset {
  sym: string;
  name: string;
  kind: string; // crypto-perp | tradfi-perp | classic (+ legacy crypto/metal/equity/…)
  classic: boolean; // true = classic instrument (Yahoo quotes), false = perp engine
  sub?: string; // curated sub-category ("Semiconductors", "Meme", "Index"…)
  aliases?: string[]; // search-only alternate names (PEPE, GOLD, WTI…)
  punchable?: boolean; // demo-tradable on the futures testnet
  sector?: string;
  tier?: "fast" | "slow";
  tradfiCore?: boolean;
  broker?: string | null;
  rank?: number; // Binance tier liquidity rank
  note?: string;
}

const KLASS_ORDER = ["crypto-perp", "tradfi-perp", "classic"];
const KLASS_LABEL: Record<string, string> = {
  "crypto-perp": "Crypto perps (30)",
  "tradfi-perp": "TradFi perps — stocks · metals · energy (28)",
  classic: "Classic — indices & oil, no perp (3)",
};

const KLASS_COLOR: Record<string, string> = {
  "crypto-perp": "text-emerald-400",
  "tradfi-perp": "text-amber-400",
  classic: "text-sky-400",
  crypto: "text-emerald-400",
  metal: "text-amber-400",
  binance: "text-cyan-400",
  index: "text-sky-400",
  equity: "text-rose-400",
  commodity: "text-orange-400",
};

const FILTER_TABS: { id: PaletteFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pinned", label: "Pinned ★" },
  { id: "crypto", label: "Crypto 30" },
  { id: "tradfi", label: "TradFi Core" },
  { id: "equity", label: "Equities & ETFs" },
  { id: "commodity", label: "Commodities" },
  { id: "index", label: "Indices" },
  { id: "metal", label: "Metals" },
  { id: "binance", label: "Binance Perps" },
];

export default function AssetPalette({
  universe,
  current,
  onPick,
  open,
  onClose,
  initialFilter = "all",
  pinned = [],
  onTogglePin,
}: {
  universe: UniAsset[];
  current: string;
  onPick: (sym: string) => void;
  open: boolean;
  onClose: () => void;
  initialFilter?: PaletteFilter;
  pinned?: string[];
  onTogglePin?: (sym: string) => void;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<PaletteFilter>(initialFilter);
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [prevOpen, setPrevOpen] = useState(open);
  const [prevInitFilter, setPrevInitFilter] = useState(initialFilter);
  if (open !== prevOpen || initialFilter !== prevInitFilter) {
    setPrevOpen(open);
    setPrevInitFilter(initialFilter);
    if (open) {
      setQ("");
      setHi(0);
      setFilter(initialFilter);
    }
  }

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  const pinnedSet = useMemo(() => new Set(pinned), [pinned]);

  const filtered = useMemo(() => {
    const s = q.trim().toUpperCase();
    return universe.filter((a) => {
      if (filter === "pinned" && !pinnedSet.has(a.sym)) return false;
      else if (filter === "tradfi" && a.kind !== "tradfi-perp" && !a.tradfiCore) return false;
      else if (filter === "crypto" && a.kind !== "crypto-perp") return false;
      else if (filter !== "all" && filter !== "pinned" && filter !== "tradfi" && filter !== "crypto" && a.kind !== filter) {
        return false;
      }
      if (!s) return true;
      return (
        a.sym.includes(s) ||
        a.name.toUpperCase().includes(s) ||
        a.kind.toUpperCase().startsWith(s) ||
        (a.sub ?? "").toUpperCase().includes(s) ||
        (a.sector ? a.sector.toUpperCase().includes(s) : false) ||
        (a.aliases ?? []).some((x) => x.toUpperCase().includes(s))
      );
    });
  }, [q, universe, filter, pinnedSet]);

  const [prevLen, setPrevLen] = useState(filtered.length);
  if (filtered.length !== prevLen) {
    setPrevLen(filtered.length);
    if (hi >= filtered.length) setHi(0);
  }

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${hi}"]`)?.scrollIntoView({ block: "nearest" });
  }, [hi]);

  if (!open) return null;

  const pick = (sym: string) => {
    onPick(sym);
    onClose();
  };

  const groups: { kind: string; items: { a: UniAsset; i: number }[] }[] = [];
  filtered.forEach((a, i) => {
    const g = groups.find((x) => x.kind === a.kind);
    if (g) g.items.push({ a, i });
    else groups.push({ kind: a.kind, items: [{ a, i }] });
  });
  groups.sort((x, y) => {
    const ix = KLASS_ORDER.indexOf(x.kind);
    const iy = KLASS_ORDER.indexOf(y.kind);
    return (ix === -1 ? 99 : ix) - (iy === -1 ? 99 : iy);
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 p-4 pt-[8vh] backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-label="Command asset palette"
    >
      <div
        className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-neutral-700 bg-[#11151a] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-neutral-100">Universe Switcher</span>
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">
              {filtered.length}/{universe.length}
            </span>
          </div>
          <span className="hidden text-[10px] text-neutral-500 sm:inline">
            ↑↓ move · ⏎ select · esc close
          </span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setHi(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHi((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHi((h) => Math.max(h - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (filtered[hi]) pick(filtered[hi].sym);
              } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
            placeholder="Search symbol / name / alias (e.g. NVDA, gold, PEPE, WTI, Brent)…"
            className="ml-auto w-full rounded-md border border-neutral-700 bg-[#0b0e11] px-3 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none sm:w-80"
          />
        </div>

        {/* Category drawer filter strip */}
        <div className="flex flex-wrap items-center gap-1 border-b border-neutral-800/80 bg-[#0d1117] px-3 py-2">
          {FILTER_TABS.map((t) => {
            const active = filter === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setFilter(t.id);
                  setHi(0);
                }}
                className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                  active
                    ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40"
                    : "text-neutral-400 hover:bg-neutral-800/70 hover:text-neutral-200"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-2.5">
          {filtered.length === 0 && (
            <div className="px-3 py-10 text-center text-sm text-neutral-500">
              No instrument matches {q ? `“${q}”` : `filter "${filter}"`}.
            </div>
          )}
          {groups.map((g) => (
            <div key={g.kind} className="mb-3">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                {KLASS_LABEL[g.kind] ?? g.kind} · {g.items.length}
              </div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3">
                {g.items.map(({ a, i }) => {
                  const isPinned = pinnedSet.has(a.sym);
                  return (
                    <div
                      key={a.sym}
                      data-idx={i}
                      onMouseEnter={() => setHi(i)}
                      className={`group flex items-center gap-1 rounded-md px-2 py-1.5 transition-colors ${
                        i === hi ? "bg-neutral-800 ring-1 ring-emerald-500/50" : "hover:bg-neutral-900"
                      } ${a.sym === current ? "bg-emerald-500/10" : ""}`}
                    >
                      {onTogglePin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTogglePin(a.sym);
                          }}
                          title={isPinned ? "Unpin from ribbon" : "Pin to header ribbon"}
                          className={`shrink-0 rounded px-1 text-xs transition-colors ${
                            isPinned
                              ? "text-amber-400 hover:text-amber-300"
                              : "text-neutral-700 opacity-60 hover:text-amber-400 group-hover:opacity-100"
                          }`}
                        >
                          {isPinned ? "★" : "☆"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => pick(a.sym)}
                        className="flex min-w-0 flex-1 items-baseline gap-1.5 text-left"
                      >
                        <span className={`shrink-0 font-mono text-xs font-bold ${KLASS_COLOR[a.kind] ?? "text-neutral-200"}`}>
                          {a.sym}
                        </span>
                        <span className="truncate text-[10px] text-neutral-500">{a.name}</span>
                        <span className="ml-auto flex shrink-0 items-center gap-1">
                          {a.sector && (
                            <span className="rounded bg-neutral-800/90 px-1 text-[9px] uppercase text-neutral-400">
                              {a.sector}
                            </span>
                          )}
                          {a.tradfiCore && (
                            <span
                              className={`rounded px-1 text-[9px] font-semibold ${
                                a.broker ? "bg-emerald-500/15 text-emerald-300" : "bg-neutral-800 text-neutral-400"
                              }`}
                              title={a.broker ? `MT5 broker (${a.broker})` : "Watchlist only (no MT5 ticker)"}
                            >
                              {a.broker ? "MT5" : "WL"}
                            </span>
                          )}
                          {!a.classic && !a.tradfiCore && a.rank ? (
                            <span className="rounded bg-cyan-500/10 px-1 text-[9px] font-semibold text-cyan-400">
                              #{a.rank}
                            </span>
                          ) : a.classic && !a.tradfiCore ? (
                            <span className="rounded bg-neutral-800 px-1 text-[9px] text-neutral-500">T3</span>
                          ) : a.tier === "fast" ? (
                            <span className="rounded bg-emerald-500/10 px-1 text-[9px] text-emerald-400" title="Fast scan lane">
                              ⚡
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-800 bg-[#0d1117] px-4 py-2 text-[10px] text-neutral-500">
          <span>
            Curated 61: 30 crypto + 28 TradFi USDT-M perps + 3 classic. "classic" = S&P 500 / Brent / Nasdaq-100 — live quote + bars (Yahoo v8), order-flow tabs are perp-only and stay hidden. ★ = pinned · MT5 = Broker executable
          </span>
          <span className="font-mono text-neutral-400">Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}
