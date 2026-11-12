"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FootprintCanvas, { type FootprintMode, type FootprintUnit } from "./charts/footprint-canvas";
import { usePolling } from "./use-cg-data";
import {
  autoThreshold,
  buildDerivedBars,
  cgSigName,
  cgSigText,
  computeCgSignals,
  diagonalImbalances,
  fmtCnt,
  fmtPctSigned,
  fmtPriceDec,
  fmtQty,
  fmtTs,
  fmtUsdVal,
  priceDecimals,
  decOf,
  type CgSignal,
  type FpBar,
  type SigUnit,
} from "@/lib/cg/cg-signals";
import { fmtPrice } from "@/lib/cg/format";
import { assetOf, fpVenues, symDecs } from "@/lib/cg/assets";
import { useTicker } from "./use-cg-data";
import { useLiveForming, foldTapeIntoFp } from "@/lib/live/forming";
import { Button } from "@/components/ui/button";

/**
 * Footprint — EXACT replica of the Coinglass footprint page's signal system.
 *
 * Data: the same API calls the live page makes (aggregated futures:
 * Binance + OKX + Bybit + Hyperliquid where listed — metals drop the
 * Hyperliquid venue), loaded through /api/cg/fp which mirrors their
 * aggregation 1:1 (lead-venue kline OHLC, USD-venue price offset,
 * coarsest-tick row merge).
 *
 * Signals: their client-side engine ported line-for-line (cg-signals.ts) and
 * run on the same three bar types they compute — time bars (selected
 * interval), volume bars (auto = 10× avg 1m volume, ladder-rounded) and
 * range bars (auto = 0.25% of price, ladder-rounded).
 * "The same move gives different signals on different bars" — click a signal
 * to switch to its bars and jump to it.
 */

const TIME_INTERVALS = ["m1", "m5", "m15", "m30", "h1", "h4"] as const;
const TF_LABEL: Record<string, string> = { m1: "1m", m5: "5m", m15: "15m", m30: "30m", h1: "1h", h4: "4h" };
const MODES: { key: FootprintMode; label: string }[] = [
  { key: "volume", label: "Volume" },
  { key: "delta", label: "Delta" },
  { key: "bar", label: "Volume bar" },
  { key: "trades", label: "Trade count" },
  { key: "avgSize", label: "Avg size" },
];
const RATIOS = [1.5, 2, 3, 4];
const BTV_LADDER = [0.25, 0.5, 1, 2, 4];

type BarType = "time" | "vol" | "range";
type TypeFilter = "all" | "abs" | "trap" | "div" | "exh";
type PanelTab = "details" | "signals" | "imbalances";

interface CandleFlowRow {
  ts: number;
  v: number;
  buyVol?: number;
  sellVol?: number;
}

interface FpResponse {
  ok: boolean;
  supported?: boolean;
  bucketsAvailable?: boolean;
  source?: string;
  reason?: string;
  error?: string;
  sym: string;
  itv?: string;
  bars: FpBar[];
  candleFlow?: CandleFlowRow[];
  missing?: string[];
  updatedAt?: number;
}

interface SignalSet {
  bt: BarType;
  label: string;
  bars: FpBar[];
  sigs: CgSignal[];
}

export default function FootprintTool({ sym = "BTC" }: { sym?: string }) {
  // ---- bar-type state (their prefs) ----
  const [tf, setTf] = useState<string>("m15");
  const [bt, setBt] = useState<BarType>("time");
  const [btvMode, setBtvMode] = useState<"auto" | number>("auto"); // manual = multiple of auto
  // ---- display state ----
  const [mode, setMode] = useState<FootprintMode>("volume");
  const [unit, setUnit] = useState<FootprintUnit>("coin");
  const [ratio, setRatio] = useState(3);
  const [showProfile, setShowProfile] = useState(true);
  const [tab, setTab] = useState<PanelTab>("signals");
  const [sigBt, setSigBt] = useState<"all" | BarType>("all");
  const [sigTy, setSigTy] = useState<TypeFilter>("all");
  const [activeSignal, setActiveSignal] = useState<CgSignal | null>(null);
  const [jump, setJump] = useState<{ ts: number; key: string } | null>(null);
  const [hoverBar, setHoverBar] = useState<FpBar | null>(null);

  // symbol switch: every per-symbol UI selection (hovered bar, active signal,
  // jump target) belongs to the PREVIOUS asset's bar series — reset during
  // render (React docs adjust-state pattern) so a BTC bar's volume/delta/
  // ladder can never render under an ETH header, not even for one frame
  const [prevSym, setPrevSym] = useState(sym);
  if (sym !== prevSym) {
    setPrevSym(sym);
    setActiveSignal(null);
    setJump(null);
    setHoverBar(null);
  }

  // ---- data: the exact calls the live page makes ----
  // time series at the selected interval (their TBS/D, 300 bars)
  const tfQ = usePolling<FpResponse>(`/api/cg/fp?sym=${sym}&itv=${tf}&limit=300`, 10_000);
  // m1 series for volume / range bars (their M1S, 1000 bars)
  const m1Q = usePolling<FpResponse>(`/api/cg/fp?sym=${sym}&itv=m1&limit=1000`, 30_000);

  // ---- LIVE LANES ----
  // fast REST lane: the last ≤8 bars of the ACTIVE bar-type's source series,
  // 8 s server TTL → the forming aggregate bar resyncs 1–2×/10 s
  const liveItv = bt === "time" ? tf : "m1";
  const liveQ = usePolling<FpResponse>(`/api/cg/fp?sym=${sym}&itv=${liveItv}&limit=8&live=1`, 8_000);
  // real-time lane: Binance futures aggTrade tape → the forming bar moves
  // on every print (4 Hz render), merged ON TOP of the aggregate (trades
  // newer than the aggregate's updatedAt are added — never double-counted)
  const forming = useLiveForming(sym, liveItv);
  const liveOk = liveQ.data?.sym === sym && liveQ.data.itv === liveItv && !!liveQ.data.ok;
  const aggUpdatedAt = liveOk ? (liveQ.data as FpResponse & { updatedAt?: number }).updatedAt ?? null : null;

  // merge the fresh tail into the heavy history loads (same-ts bars: fresh wins)
  const mergeTail = (big: FpBar[], small: FpBar[] | undefined): FpBar[] => {
    if (!small?.length) return big;
    if (!big.length) return small;
    const cutoff = small[0].ts;
    return [...big.filter((b) => b.ts < cutoff), ...small];
  };

  // defense-in-depth: never render bars that belong to another symbol
  const timeBars = useMemo(
    () => mergeTail(tfQ.data?.sym === sym ? tfQ.data.bars : [], liveOk && liveItv === tf ? liveQ.data?.bars : undefined),
    [tfQ.data, liveQ.data, sym, tf, liveItv, liveOk]
  );
  const m1Bars = useMemo(
    () => mergeTail(m1Q.data?.sym === sym ? m1Q.data.bars : [], liveOk && liveItv === "m1" ? liveQ.data?.bars : undefined),
    [m1Q.data, liveQ.data, sym, liveItv, liveOk]
  );

  // ---- auto thresholds (their ef) ----
  const volAuto = useMemo(() => (m1Bars.length ? autoThreshold(m1Bars, "vol") : 0), [m1Bars]);
  const rangeAuto = useMemo(() => (m1Bars.length ? autoThreshold(m1Bars, "range") : 0), [m1Bars]);
  // manual threshold applies to the currently displayed derived bars only
  const volThr = btvMode === "auto" || bt !== "vol" ? volAuto : volAuto * btvMode;
  const rangeThr = btvMode === "auto" || bt !== "range" ? rangeAuto : rangeAuto * btvMode;

  // ---- the three bar series (their sigSets) ----
  const timeSet: SignalSet | null = useMemo(() => {
    if (!timeBars.length) return null;
    return { bt: "time", label: TF_LABEL[tf] ?? tf, bars: timeBars, sigs: computeCgSignals(timeBars) };
  }, [timeBars, tf]);

  const volSet: SignalSet | null = useMemo(() => {
    if (!m1Bars.length || !volThr) return null;
    const bars = buildDerivedBars(m1Bars, "vol", volThr);
    return { bt: "vol", label: `Volume ${fmtQty(volThr)} ${sym}`, bars, sigs: computeCgSignals(bars) };
  }, [m1Bars, volThr, sym]);

  const rangeSet: SignalSet | null = useMemo(() => {
    if (!m1Bars.length || !rangeThr) return null;
    const bars = buildDerivedBars(m1Bars, "range", rangeThr);
    return { bt: "range", label: `Range ${fmtPriceDec(rangeThr, decOf(rangeThr))}`, bars, sigs: computeCgSignals(bars) };
  }, [m1Bars, rangeThr]);

  const sets = useMemo(
    () => [timeSet, volSet, rangeSet].filter((s): s is SignalSet => !!s),
    [timeSet, volSet, rangeSet]
  );

  // ---- signals list (their panel logic: type filter, bt filter, top 200) ----
  const typeOk = useCallback(
    (s: CgSignal) => sigTy === "all" || (sigTy === "div" ? s.t === "div" || s.t === "sdiv" : s.t === sigTy),
    [sigTy]
  );

  const rows = useMemo(() => {
    const out: { g: CgSignal; set: SignalSet; t: number }[] = [];
    for (const set of sets) {
      for (const g of set.sigs) {
        if (!typeOk(g)) continue;
        out.push({ g, set, t: set.bars[g.i]?.ts ?? g.ts });
      }
    }
    const f = sigBt === "all" ? out : out.filter((r) => r.set.bt === sigBt);
    return f.sort((a, b) => b.t - a.t).slice(0, 200);
  }, [sets, sigBt, typeOk]);

  const countByBt = useMemo(() => {
    const m: Record<string, number> = { time: 0, vol: 0, range: 0 };
    for (const set of sets) {
      m[set.bt] = set.sigs.filter(typeOk).length;
    }
    return m;
  }, [sets, typeOk]);

  const bullCount = rows.filter((r) => r.g.side === "buy").length;

  // ---- currently displayed series ----
  const currentSet = useMemo(() => (bt === "time" ? timeSet : bt === "vol" ? volSet : rangeSet), [bt, timeSet, volSet, rangeSet]);
  const currentBars = useMemo(() => currentSet?.bars ?? [], [currentSet]);
  const currentSigs = useMemo(() => currentSet?.sigs ?? [], [currentSet]);

  // ---- REAL-TIME DISPLAY OVERLAY (the forming bar moves on every print) ----
  // aggregate bars stay authoritative for history + signals; the LAST bar
  // gets the Binance tape folded in (trades newer than the aggregate's
  // updatedAt) and its h/l/c extended by the live prints. 4 Hz refresh.
  const displayBars = useMemo(() => {
    if (!forming || !currentBars.length || aggUpdatedAt == null) return currentBars;
    const last = currentBars[currentBars.length - 1];
    // +1.5 s guard: trades inside the upstream build-lag ambiguity window are
    // skipped — the forming bar may slightly undercount for a moment, but it
    // can NEVER show phantom (double-counted) volume. The 8 s resync corrects.
    const cut = Math.max(aggUpdatedAt + 1_500, Date.now() - 40_000);
    // SANITY ENVELOPE (blowout fix, layer 3): the tape extremes may extend
    // the aggregate bar, but never more than 25% away from its close — a
    // 40-second tape window cannot move 25% on any asset in the universe,
    // so anything wider is garbage and must never fold into h/l (an l=0
    // overlay bar blew the y-axis out to a 0-baseline — verified live).
    const saneHi = (v: number | null | undefined, ref: number): number | null =>
      v != null && Number.isFinite(v) && v > 0 && v <= ref * 1.25 ? v : null;
    const saneLo = (v: number | null | undefined, ref: number): number | null =>
      v != null && Number.isFinite(v) && v > 0 && v >= ref * 0.75 ? v : null;
    if (bt === "time") {
      // overlay the forming tf bar directly
      if (forming.barTs !== last.ts || !forming.lastPrice) return currentBars;
      const overlaid: FpBar = {
        ...last,
        h: Math.max(last.h, saneHi(forming.hi, last.c) ?? last.h),
        l: Math.min(last.l, saneLo(forming.lo, last.c) ?? last.l),
        c: forming.lastPrice,
        fp: last.fp ? foldTapeIntoFp(last.fp, forming.tape, cut) : null,
      };
      return [...currentBars.slice(0, -1), overlaid];
    }
    // derived bars: rebuild from the overlaid forming m1 bar
    const m1Last = m1Bars[m1Bars.length - 1];
    if (!m1Last || m1Last.ts !== forming.barTs || !forming.lastPrice) return currentBars;
    const m1Overlaid: FpBar = {
      ...m1Last,
      h: Math.max(m1Last.h, saneHi(forming.hi, m1Last.c) ?? m1Last.h),
      l: Math.min(m1Last.l, saneLo(forming.lo, m1Last.c) ?? m1Last.l),
      c: forming.lastPrice,
      fp: m1Last.fp ? foldTapeIntoFp(m1Last.fp, forming.tape, cut) : null,
    };
    const m1Live = [...m1Bars.slice(0, -1), m1Overlaid];
    const rebuilt = bt === "vol" ? buildDerivedBars(m1Live, "vol", volThr || 1) : buildDerivedBars(m1Live, "range", rangeThr || 1);
    return rebuilt.length ? rebuilt : currentBars;
  }, [currentBars, forming, aggUpdatedAt, bt, m1Bars, volThr, rangeThr]);

  const overlayActive =
    !!forming &&
    forming.lastPrice != null &&
    displayBars !== currentBars &&
    Date.now() - (forming.at ?? 0) < 5_000;

  const onSignalClick = (g: CgSignal, set: SignalSet) => {
    setActiveSignal(g);
    // switch to the signal's bars (their gotoSig) and jump the chart to it
    if (set.bt === "time" && bt === "time" && tf !== TF_TO_ITV[set.label]) {
      // time signals always use the selected interval — nothing to switch
    }
    setBt(set.bt);
    if (set.bt === "time") {
      const itv = LABEL_TO_TF[set.label] ?? tf;
      if (itv !== tf) setTf(itv);
    }
    setJump({ ts: set.bars[g.i]?.ts ?? g.ts, key: `${g.t}-${g.i}-${set.bt}-${Date.now()}` });
  };

  // ---- focus bar stats ----
  const focusBar = hoverBar ?? displayBars[displayBars.length - 1] ?? null;
  const focusStats = useMemo(() => {
    if (!focusBar?.fp) return null;
    const fp = focusBar.fp;
    let buy = 0;
    let sell = 0;
    let buyCnt = 0;
    let sellCnt = 0;
    for (let i = 0; i < fp.b.length; i++) {
      buy += fp.b[i];
      sell += fp.s[i];
      buyCnt += fp.bc[i];
      sellCnt += fp.sc[i];
    }
    const range = focusBar.h - focusBar.l;
    return {
      buy,
      sell,
      buyCnt,
      sellCnt,
      vol: buy + sell,
      delta: buy - sell,
      closePos: range > 0 ? (focusBar.c - focusBar.l) / range : 0.5,
    };
  }, [focusBar]);

  // diagonal imbalances of the focus bar
  const focusImb = useMemo(() => {
    if (!focusBar?.fp) return { buy: [], sell: [] } as ReturnType<typeof diagonalImbalances>;
    return diagonalImbalances(focusBar.fp, ratio);
  }, [focusBar, ratio]);

  // stats strip + live ticker — the same real-time price the header shows (one truth)
  const tk = useTicker(sym);
  const lastBar = displayBars[displayBars.length - 1] ?? null;
  const dp = symDecs(sym, tk.price ?? lastBar?.c ?? null);
  const latestSignal = currentSigs.length ? currentSigs.reduce((a, b) => (b.ts > a.ts ? b : a)) : null;
  const err = tfQ.error ?? m1Q.error;
  const missing = [...new Set([...(tfQ.data?.sym === sym ? tfQ.data.missing ?? [] : []), ...(m1Q.data?.sym === sym ? m1Q.data.missing ?? [] : [])])];
  const sigUnit: SigUnit = unit === "usd" ? "usd" : "qty";
  const livePrice = tk.price ?? lastBar?.c ?? null;

  const marks = useMemo(
    () => currentSigs.map((s) => ({ ts: s.ts, dir: s.side === "buy" ? ("bullish" as const) : ("bearish" as const), type: s.t })),
    [currentSigs]
  );

  const basisBtn = (b: BarType, label: string, active: boolean, onClick: () => void) => (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-xs ${active ? "bg-neutral-700 text-white" : "text-neutral-400 hover:bg-neutral-800"}`}
    >
      {label}
    </button>
  );

  const btLabel =
    bt === "time" ? TF_LABEL[tf] : bt === "vol" ? `Volume ${fmtQty(volThr)} ${sym}` : `Range ${fmtPriceDec(rangeThr, decOf(rangeThr))}`;

  return (
    <div className="flex flex-col gap-3">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 p-2.5">
        <div className="flex items-center gap-1.5 pr-2">
          <span className="text-sm font-semibold text-neutral-100">{sym}</span>
          <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">
            aggregated futures · {fpVenues(sym).map((v) => v.id.replace("-perp", "")).join("+")}
          </span>
        </div>

        {/* bar type: time / volume / range (their bt) */}
        <div className="flex overflow-hidden rounded border border-neutral-700">
          {basisBtn("time", TF_LABEL[tf], bt === "time", () => setBt("time"))}
          {basisBtn("vol", `Volume ${fmtQty(volThr)}`, bt === "vol", () => setBt("vol"))}
          {basisBtn("range", `Range ${fmtPriceDec(rangeThr, decOf(rangeThr))}`, bt === "range", () => setBt("range"))}
        </div>

        {/* interval for time bars */}
        {bt === "time" && (
          <div className="flex overflow-hidden rounded border border-neutral-700">
            {TIME_INTERVALS.map((iv) => (
              <button
                key={iv}
                onClick={() => setTf(iv)}
                className={`px-2 py-1 text-[11px] ${tf === iv ? "bg-neutral-700 text-white" : "text-neutral-400 hover:bg-neutral-800"}`}
              >
                {TF_LABEL[iv]}
              </button>
            ))}
          </div>
        )}

        {/* threshold for derived bars: auto + ladder (their btv) */}
        {bt !== "time" && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-neutral-500">threshold</span>
            <div className="flex overflow-hidden rounded border border-neutral-700">
              <button
                onClick={() => setBtvMode("auto")}
                className={`px-1.5 py-1 text-[11px] ${btvMode === "auto" ? "bg-neutral-700 text-white" : "text-neutral-400 hover:bg-neutral-800"}`}
              >
                Auto
              </button>
              {BTV_LADDER.map((m) => {
                const thr = bt === "vol" ? volAuto * m : rangeAuto * m;
                const label = bt === "vol" ? fmtQty(thr) : fmtPriceDec(thr, decOf(thr));
                return (
                  <button
                    key={m}
                    onClick={() => setBtvMode(m)}
                    className={`px-1.5 py-1 text-[11px] ${btvMode === m ? "bg-neutral-700 text-white" : "text-neutral-400 hover:bg-neutral-800"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex overflow-hidden rounded border border-neutral-700">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`px-2 py-1 text-[11px] ${mode === m.key ? "bg-neutral-700 text-white" : "text-neutral-400 hover:bg-neutral-800"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex overflow-hidden rounded border border-neutral-700">
          {(["coin", "usd"] as const).map((u) => (
            <button
              key={u}
              onClick={() => setUnit(u)}
              className={`px-2 py-1 text-[11px] ${unit === u ? "bg-neutral-700 text-white" : "text-neutral-400 hover:bg-neutral-800"}`}
            >
              {u === "coin" ? sym : "USD"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-neutral-500">ratio</span>
          <div className="flex overflow-hidden rounded border border-neutral-700">
            {RATIOS.map((r) => (
              <button
                key={r}
                onClick={() => setRatio(r)}
                className={`px-1.5 py-1 text-[11px] ${ratio === r ? "bg-neutral-700 text-white" : "text-neutral-400 hover:bg-neutral-800"}`}
              >
                {r}×
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-neutral-400">
          <input
            type="checkbox"
            checked={showProfile}
            onChange={(e) => setShowProfile(e.target.checked)}
            className="accent-emerald-500"
          />
          Profile
        </label>
        <div className="ml-auto flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${
              overlayActive
                ? "bg-emerald-500/15 text-emerald-400 ring-emerald-500/40"
                : "bg-neutral-800/60 text-neutral-500 ring-neutral-700/60"
            }`}
            title="Binance futures aggTrade tape folded into the forming bar in real time (4 Hz); multi-venue aggregate resyncs every 8 s"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${overlayActive ? "animate-pulse bg-emerald-400" : "bg-neutral-600"}`} />
            {overlayActive ? "tape live" : "tape off"}
          </span>
          <span className={`flex items-center gap-1.5 text-xs ${err ? "text-red-400" : "text-emerald-400"}`}>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${err ? "bg-red-400" : "animate-pulse bg-emerald-400"}`} />
            {err ? "offline" : "live"}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 border-neutral-700 text-xs"
            onClick={() => {
              tfQ.refresh();
              m1Q.refresh();
            }}
          >
            Refresh
          </Button>
        </div>
      </div>

      {err && (
        <div className="rounded border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          Data error: {err} — retrying automatically.
        </div>
      )}
      {!err && missing.length > 0 && (
        <div className="rounded border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
          {missing.join(", ")} returned no data this time, so the aggregate only includes the other exchanges for now.
        </div>
      )}

      {/* stats strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat
          label="Latest price"
          value={livePrice != null ? fmtPriceDec(livePrice, dp) : "—"}
          sub={`${tk.source === "ws" ? "real-time tape" : tk.source === "rest" ? "0.25s rest" : "aggregate"}${
            focusStats ? ` · ${fmtPctSigned(lastBar && currentBars.length > 96 ? (lastBar.c - (currentBars[currentBars.length - 97]?.c ?? lastBar.c)) / (currentBars[currentBars.length - 97]?.c ?? 1) : 0, 2)} 96 bars` : ""
          }`}
          tone={
            lastBar && currentBars.length > 96
              ? lastBar.c >= (currentBars[currentBars.length - 97]?.c ?? lastBar.c)
                ? "up"
                : "down"
              : undefined
          }
        />
        <Stat
          label={`Bar volume · ${btLabel}`}
          value={focusStats ? `${fmtQty(focusStats.vol)} ${sym}` : "—"}
          sub={focusStats ? `${fmtQty(focusStats.buy)} buy · ${fmtQty(focusStats.sell)} sell` : ""}
        />
        <Stat
          label={`Trades · ${focusBar ? fmtTs(focusBar.ts, true) : ""}`}
          value={focusStats ? fmtCnt(focusStats.buyCnt + focusStats.sellCnt) : "—"}
          sub={focusStats ? `avg ${focusStats.buyCnt + focusStats.sellCnt ? fmtQty(focusStats.vol / (focusStats.buyCnt + focusStats.sellCnt)) : "—"} ${sym}` : ""}
        />
        <Stat
          label="Delta"
          value={focusStats ? fmtQty(focusStats.delta) : "—"}
          sub={focusStats ? `${Math.round((focusStats.buy / (focusStats.vol || 1)) * 100)}% buys · close at ${Math.round(focusStats.closePos * 100)}%` : ""}
          tone={focusStats ? (focusStats.delta >= 0 ? "up" : "down") : undefined}
        />
        <Stat
          label="Latest signal"
          value={latestSignal ? cgSigName(latestSignal) : "—"}
          sub={latestSignal ? `${cgSigText(latestSignal, currentBars, sigUnit)[0]} · ${fmtTs(latestSignal.ts, true)}` : "none on this bar type"}
          tone={latestSignal ? (latestSignal.side === "buy" ? "up" : "down") : undefined}
        />
        <Stat
          label="Bars in window"
          value={String(currentBars.length)}
          sub={`${rows.length} signals listed · ${sets.map((s) => `${s.label} ${s.sigs.length}`).join(" · ")}`}
        />
      </div>

      {tfQ.data?.sym === sym && tfQ.data.bucketsAvailable === false && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-800/40 bg-sky-950/20 px-3 py-2 text-[11px] text-sky-200/90">
          <span>
            <span className="font-semibold text-sky-300">{sym} · OHLC + Bar Flow Mode:</span>{" "}
            {tfQ.data.reason ?? "Price-ladder footprint buckets unavailable upstream; showing live OHLC candles & bar taker volume."}
          </span>
          <span className="rounded border border-sky-800/50 bg-[#0e1216] px-2 py-0.5 text-[10px] uppercase tracking-wider text-sky-300">
            {tfQ.data.source ?? "live"}
          </span>
        </div>
      )}

      {/* chart + right panel */}
      <div className="flex flex-col gap-3 xl:flex-row">
        <div className="h-[560px] min-w-0 flex-1 overflow-hidden rounded-lg border border-neutral-800 bg-[#0b0e11]">
          {currentBars.length > 0 ? (
            <FootprintCanvas
              bars={displayBars}
              mode={mode}
              unit={unit}
              imbalanceRatio={ratio}
              showProfile={showProfile}
              resetKey={`${sym}-${bt}-${bt === "time" ? tf : btvMode === "auto" ? "auto" : btvMode}`}
              onHoverBar={setHoverBar}
              signals={marks}
              jump={jump}
              activeSignalTs={activeSignal && (activeSignal.bt ?? bt) === bt ? activeSignal.ts : null}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-neutral-500">
              {tfQ.loading || m1Q.loading ? "Loading aggregated order flow…" : "No order-flow data"}
            </div>
          )}
        </div>

        {/* right panel with tabs */}
        <div className="flex h-[560px] w-full flex-col rounded-lg border border-neutral-800 bg-neutral-900/60 xl:w-[420px]">
          <div className="flex items-center gap-1 border-b border-neutral-800 px-2 pt-2">
            {(
              [
                ["signals", "Signals"],
                ["details", "Bar details"],
                ["imbalances", "Imbalances"],
              ] as [PanelTab, string][]
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`rounded-t px-3 py-1.5 text-xs ${
                  tab === k ? "bg-neutral-800 font-semibold text-neutral-100" : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {/* ---- Signals tab (mirrors the live panel) ---- */}
          {tab === "signals" && (
            <>
              <div className="border-b border-neutral-800 px-3 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      ["all", `All ${rows.length ? countAll(sets, typeOk) : 0}`],
                      ["time", `${timeSet?.label ?? "Time"} ${countByBt.time}`],
                      ["vol", `Volume ${countByBt.vol}`],
                      ["range", `Range ${countByBt.range}`],
                    ] as ["all" | BarType, string][]
                  ).map(([k, l]) => (
                    <button
                      key={k}
                      onClick={() => setSigBt(k)}
                      className={`rounded-full px-2 py-0.5 text-[10px] ${
                        sigBt === k ? "bg-neutral-700 text-white" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700/60"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                  <span className="mx-1 h-3 w-px bg-neutral-800" />
                  {(
                    [
                      ["all", "All types"],
                      ["abs", "Absorption"],
                      ["trap", "Trapped"],
                      ["div", "Divergence"],
                      ["exh", "Exhaustion"],
                    ] as [TypeFilter, string][]
                  ).map(([k, l]) => (
                    <button
                      key={k}
                      onClick={() => setSigTy(k)}
                      className={`rounded-full px-2 py-0.5 text-[10px] ${
                        sigTy === k ? "bg-neutral-700 text-white" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700/60"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 text-xs font-semibold text-neutral-200">
                  {rows.length ? (
                    <>
                      {rows.length} signals: <span className="text-emerald-400">{bullCount} bullish</span>,{" "}
                      <span className="text-red-400">{rows.length - bullCount} bearish</span>
                    </>
                  ) : (
                    "No signals here"
                  )}
                </div>
                <div className="mt-1 text-[10px] leading-relaxed text-neutral-500">
                  The same move gives different signals on different bars, so they&apos;re computed for each:{" "}
                  {sets.map((s) => s.label).join(", ")}. Click a signal to switch to its bars and jump to it.
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {rows.map((r, idx) => {
                  const [title, detail] = cgSigText(r.g, r.set.bars, sigUnit);
                  const active = activeSignal === r.g && activeSignal?.ts === r.g.ts;
                  return (
                    <button
                      key={`${r.set.bt}-${r.g.t}-${r.g.i}-${r.g.side}-${idx}`}
                      onClick={() => onSignalClick(r.g, r.set)}
                      className={`flex w-full items-start gap-2 border-b border-neutral-800/60 px-3 py-2 text-left transition-colors hover:bg-neutral-800/40 ${
                        active ? "bg-neutral-800/70" : ""
                      }`}
                    >
                      <span className="mt-0.5 shrink-0 text-left font-mono text-[10px] leading-4 text-neutral-500">
                        <b className="text-neutral-400">{fmtTs(r.t, true)}</b>
                        <br />
                        <small className="text-[9px] text-neutral-600">{r.set.label}</small>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-1.5">
                          <span
                            className={`rounded px-1 py-0.5 text-[9px] font-semibold ${
                              r.g.side === "buy" ? "bg-emerald-900/60 text-emerald-400" : "bg-red-900/60 text-red-400"
                            }`}
                          >
                            {cgSigName(r.g)}
                          </span>
                          <span className="ml-auto font-mono text-[10px] text-neutral-300">
                            {fmtPriceDec(r.g.p, dp)}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] font-medium text-neutral-200">{title}</span>
                        <span className="block text-[10px] leading-snug text-neutral-500">{detail}</span>
                      </span>
                    </button>
                  );
                })}
                {!rows.length && (
                  <div className="px-3 py-8 text-center text-xs text-neutral-600">
                    {sets.length ? "No signals match the current filters." : "Loading the three bar series…"}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ---- Bar details tab ---- */}
          {tab === "details" && (
            <div className="flex-1 overflow-y-auto">
              {focusBar?.fp ? (
                <>
                  <div className="border-b border-neutral-800 px-3 py-2 text-xs text-neutral-300">
                    <span className="font-mono text-neutral-500">{fmtTs(focusBar.ts, true)}</span> ·{" "}
                    <span className="rounded bg-neutral-800 px-1 text-[9px] text-neutral-400">{btLabel}</span> O{" "}
                    {fmtPrice(focusBar.o)} · H {fmtPrice(focusBar.h)} · L {fmtPrice(focusBar.l)} · C {fmtPrice(focusBar.c)}
                    {focusStats && (
                      <div className="mt-1 text-[10px] text-neutral-500">
                        vol {fmtQty(focusStats.vol)} ${sym} · delta {fmtQty(focusStats.delta)} ·{" "}
                        {fmtCnt(focusStats.buyCnt + focusStats.sellCnt)} trades · close at{" "}
                        {Math.round(focusStats.closePos * 100)}% of range
                      </div>
                    )}
                  </div>
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-neutral-900 text-neutral-500">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-medium">Price</th>
                        <th className="px-2 py-1.5 text-right font-medium">Buy</th>
                        <th className="px-2 py-1.5 text-right font-medium">Sell</th>
                        <th className="px-2 py-1.5 text-right font-medium">Delta</th>
                        <th className="px-3 py-1.5 text-right font-medium">Trades</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const fp = focusBar.fp!;
                        const out: React.ReactNode[] = [];
                        for (let i = fp.b.length - 1; i >= 0; i--) {
                          if (!(fp.b[i] || fp.s[i])) continue;
                          const d = fp.b[i] - fp.s[i];
                          out.push(
                            <tr key={i} className="border-t border-neutral-800/50">
                              <td className="px-3 py-1 font-mono text-neutral-300">
                                {fmtPriceDec(fp.lo + i * fp.tick, dp)}
                                <span className="text-neutral-600">–{fmtPriceDec(fp.lo + (i + 1) * fp.tick, dp)}</span>
                              </td>
                              <td className="px-2 py-1 text-right font-mono text-emerald-400">
                                {unit === "usd" ? fmtUsdVal(fp.b[i] * (fp.lo + (i + 0.5) * fp.tick)) : fmtQty(fp.b[i])}
                              </td>
                              <td className="px-2 py-1 text-right font-mono text-red-400">
                                {unit === "usd" ? fmtUsdVal(fp.s[i] * (fp.lo + (i + 0.5) * fp.tick)) : fmtQty(fp.s[i])}
                              </td>
                              <td className={`px-2 py-1 text-right font-mono ${d >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {fmtQty(d)}
                              </td>
                              <td className="px-3 py-1 text-right font-mono text-neutral-500">{fmtCnt(fp.bc[i] + fp.sc[i])}</td>
                            </tr>
                          );
                        }
                        return out;
                      })()}
                    </tbody>
                  </table>
                </>
              ) : tfQ.data?.sym === sym && tfQ.data.candleFlow?.length ? (
                <div className="p-2">
                  <div className="border-b border-neutral-800 px-1 pb-2 text-[11px] text-neutral-400">
                    Bar Taker Flow Summary ({tfQ.data.source ?? "live"} · recent {Math.min(20, tfQ.data.candleFlow.length)} bars)
                  </div>
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-neutral-900 text-neutral-500">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium">Time</th>
                        <th className="px-2 py-1.5 text-right font-medium">Vol</th>
                        <th className="px-2 py-1.5 text-right font-medium">Buy</th>
                        <th className="px-2 py-1.5 text-right font-medium">Sell</th>
                        <th className="px-2 py-1.5 text-right font-medium">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...tfQ.data.candleFlow].slice(-20).reverse().map((cf) => {
                        const buy = cf.buyVol ?? 0;
                        const sell = cf.sellVol ?? Math.max(0, cf.v - buy);
                        const d = buy - sell;
                        const hasSplit = cf.buyVol != null;
                        return (
                          <tr key={cf.ts} className="border-t border-neutral-800/50 font-mono">
                            <td className="px-2 py-1 text-neutral-400">{fmtTs(cf.ts, true)}</td>
                            <td className="px-2 py-1 text-right text-neutral-300">{fmtQty(cf.v)}</td>
                            <td className="px-2 py-1 text-right text-emerald-400">{hasSplit ? fmtQty(buy) : "–"}</td>
                            <td className="px-2 py-1 text-right text-red-400">{hasSplit ? fmtQty(sell) : "–"}</td>
                            <td className={`px-2 py-1 text-right ${!hasSplit ? "text-neutral-500" : d >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {hasSplit ? `${d >= 0 ? "+" : ""}${fmtQty(d)}` : "–"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-3 py-8 text-center text-xs text-neutral-600">Hover a bar to inspect it.</div>
              )}
            </div>
          )}

          {/* ---- Imbalances tab (diagonal, their definition) ---- */}
          {tab === "imbalances" && (
            <div className="flex-1 overflow-y-auto px-3 py-2">
              {focusBar?.fp ? (
                <>
                  <div className="mb-2 text-[11px] text-neutral-500">
                    Diagonal imbalances on{" "}
                    <span className="font-mono text-neutral-300">{fmtTs(focusBar.ts, true)}</span> — buys vs sells one
                    level below, sells vs buys one level above, ≥ {ratio}×.
                  </div>
                  <div className="mb-1 text-[10px] font-semibold uppercase text-emerald-500">
                    Buy imbalances · {focusImb.buy.length}
                  </div>
                  {focusImb.buy.map((r, i) => (
                    <div key={`b${i}`} className="flex items-center justify-between border-b border-neutral-800/50 py-1 text-[11px]">
                      <span className="font-mono text-neutral-300">{fmtPriceDec(r.price, dp)}</span>
                      <span className="font-mono text-emerald-400">
                        {fmtQty(r.buy)} vs {fmtQty(r.diagBuy)} ({r.ratio.toFixed(1)}×)
                      </span>
                    </div>
                  ))}
                  {!focusImb.buy.length && <div className="py-1 text-[11px] text-neutral-600">none</div>}
                  <div className="mb-1 mt-3 text-[10px] font-semibold uppercase text-red-500">
                    Sell imbalances · {focusImb.sell.length}
                  </div>
                  {focusImb.sell.map((r, i) => (
                    <div key={`s${i}`} className="flex items-center justify-between border-b border-neutral-800/50 py-1 text-[11px]">
                      <span className="font-mono text-neutral-300">{fmtPriceDec(r.price, dp)}</span>
                      <span className="font-mono text-red-400">
                        {fmtQty(r.sell)} vs {fmtQty(r.diagBuy)} ({r.ratio.toFixed(1)}×)
                      </span>
                    </div>
                  ))}
                  {!focusImb.sell.length && <div className="py-1 text-[11px] text-neutral-600">none</div>}
                </>
              ) : (
                <div className="py-8 text-center text-xs text-neutral-600">Hover a bar to inspect its imbalances.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// helpers ----------------------------------------------------------------

const TF_TO_ITV: Record<string, string> = TF_LABEL; // label -> itv
const LABEL_TO_TF: Record<string, string> = Object.fromEntries(Object.entries(TF_LABEL).map(([k, v]) => [v, k]));

function countAll(sets: SignalSet[], typeOk: (s: CgSignal) => boolean): number {
  let n = 0;
  for (const set of sets) n += set.sigs.filter(typeOk).length;
  return n;
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 transition-colors hover:border-neutral-700">
      <div className="truncate text-[10px] uppercase tracking-wide text-neutral-500" title={label}>
        {label}
      </div>
      <div
        className={`mt-0.5 truncate font-mono text-sm font-semibold tabular-nums ${
          tone === "up" ? "text-emerald-400" : tone === "down" ? "text-red-400" : "text-neutral-100"
        }`}
        title={value}
      >
        {value}
      </div>
      {/* wrap instead of truncate: sub lines carry per-bar-type signal counts
          the user scans — clipping them ("Volume 500 BT…") hides information */}
      {sub && (
        <div className="mt-0.5 line-clamp-2 break-words text-[10px] leading-tight text-neutral-500" title={sub}>
          {sub}
        </div>
      )}
    </div>
  );
}
