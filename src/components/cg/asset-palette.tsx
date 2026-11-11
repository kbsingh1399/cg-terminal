"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * AssetPalette — the CURATED-universe switcher (user directive 2026-11-12:
 * a fixed 61-asset universe — 30 crypto perps + 28 TradFi perps + 3 classic).
 * One searchable palette over the curated list: type-ahead filter matching
 * symbol + name + aliases (resolveCurated semantics), grouped Crypto /
 * TradFi perps / Classic, keyboard navigable (↑/↓ move, Enter picks, Esc
 * closes). Pure client component — the universe list is passed in by page.tsx.
 */

export interface UniAsset {
  sym: string;
  name: string;
  kind: string; // crypto-perp | tradfi-perp | classic
  classic: boolean; // true = classic instrument (Yahoo quotes), false = perp engine
  sub?: string; // curated sub-category ("Semiconductors", "Meme", "Index"…)
  aliases?: string[]; // search-only alternate names (PEPE, GOLD, WTI…)
  punchable?: boolean; // demo-tradable on the futures testnet
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
};

export default function AssetPalette({
  universe,
  current,
  onPick,
  open,
  onClose,
}: {
  universe: UniAsset[];
  current: string;
  onPick: (sym: string) => void;
  open: boolean;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0); // highlighted row within the filtered list
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // reset the palette state each time it opens — adjusted during render on
  // prop change (React docs pattern), no effect needed
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setQ("");
      setHi(0);
    }
  }

  // focus after open so the key handler below doesn't steal the first keys
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toUpperCase();
    if (!s) return universe;
    return universe.filter(
      (a) =>
        a.sym.includes(s) ||
        a.name.toUpperCase().includes(s) ||
        a.kind.toUpperCase().startsWith(s) ||
        (a.sub ?? "").toUpperCase().includes(s) ||
        (a.aliases ?? []).some((x) => x.toUpperCase().includes(s))
    );
  }, [q, universe]);

  // keep hi within range as the filtered list shrinks — render-time clamp
  const [prevLen, setPrevLen] = useState(filtered.length);
  if (filtered.length !== prevLen) {
    setPrevLen(filtered.length);
    if (hi >= filtered.length) setHi(0);
  }

  // scroll the highlighted row into view
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
  groups.sort((x, y) => KLASS_ORDER.indexOf(x.kind) - KLASS_ORDER.indexOf(y.kind));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-[10vh]"
      onClick={onClose}
      role="dialog"
      aria-label="All assets"
    >
      <div
        className="flex max-h-[75vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-neutral-700 bg-[#11151a] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-neutral-800 px-4 py-3">
          <span className="text-sm font-semibold text-neutral-200">All assets</span>
          <span className="text-[10px] text-neutral-500">
            {filtered.length}/{universe.length} · ↑↓ move · ⏎ select · esc close
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
                setHi((h) => Math.min(h + 1, filtered.length - 1));
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
            className="ml-auto w-1/2 rounded-md border border-neutral-700 bg-[#0b0e11] px-3 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-neutral-500">
              No instrument matches “{q}”.
            </div>
          )}
          {groups.map((g) => (
            <div key={g.kind} className="mb-2">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                {KLASS_LABEL[g.kind] ?? g.kind} · {g.items.length}
              </div>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                {g.items.map(({ a, i }) => (
                  <button
                    key={a.sym}
                    data-idx={i}
                    onClick={() => pick(a.sym)}
                    onMouseEnter={() => setHi(i)}
                    className={`flex items-baseline gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors ${
                      i === hi ? "bg-neutral-800 ring-1 ring-emerald-600/50" : "hover:bg-neutral-900"
                    } ${a.sym === current ? "bg-emerald-500/10" : ""}`}
                  >
                    <span className={`text-xs font-bold ${KLASS_COLOR[a.kind] ?? "text-neutral-300"}`}>{a.sym}</span>
                    <span className="truncate text-[10px] text-neutral-500">{a.name}</span>
                    {a.classic ? (
                      <span className="ml-auto shrink-0 rounded bg-neutral-800 px-1 text-[9px] text-neutral-400">classic</span>
                    ) : a.punchable === false ? (
                      <span
                        className="ml-auto shrink-0 rounded bg-amber-500/10 px-1 text-[9px] font-semibold text-amber-400"
                        title="live data only — not listed on the Binance futures testnet"
                      >
                        live-only
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-neutral-800 px-4 py-2 text-[10px] text-neutral-600">
          Curated 61: 30 crypto + 28 TradFi USDT-M perps + 3 classic. "classic" = S&P 500 / Brent / Nasdaq-100 — live
          quote + bars (Yahoo v8), order-flow tabs are perp-only and stay hidden. "live-only" = real Binance perp data
          everywhere, but the symbol is not on the futures testnet (no demo execution).
        </div>
      </div>
    </div>
  );
}
