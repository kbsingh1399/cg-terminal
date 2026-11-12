"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { COLORS, clamp, drawGridLine, fromPx, makeScale, niceStep, setupHiDPI, toPx } from "@/components/cg/charts/chart-utils";
import type { LiveBar } from "@/lib/binance/sym-feed";

/**
 * BinanceChart — TradingView-grade interactive candlestick + volume canvas.
 *
 * Interactions (exactly the TradingView set):
 *   drag chart        pan (time + price together)
 *   wheel on chart    horizontal zoom, anchored at the cursor
 *   wheel on price ax vertical zoom, anchored at the cursor
 *   drag price axis   vertical zoom, anchored at the grab price
 *   drag time axis    horizontal zoom, anchored at the right edge
 *   double-click      auto-fit (reset zoom + re-follow live)
 *
 * Data honesty: bars with impossible values (low ≤ 0, high < low, NaN) are
 * dropped, and the AUTO price range ignores extreme outlier wicks (testnet
 * prints at 0 / 90k) via a percentile clamp — a real wick still draws if you
 * pan/zoom to it, it just never squashes the default scale.
 *
 * Bars bootstrap from /api/binance/klines (REST) and the LAST candle is kept
 * live by the tape/kline stream — never more than one trade behind.
 */

export interface Bar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

const AXIS_W = 68;
const TIME_H = 24;
const VOL_FRAC = 0.16;
const MIN_BAR_W = 1.4;
const MAX_BAR_W = 64;
const DEF_BAR_W = 9;

interface View {
  barW: number; // px per bar (horizontal zoom)
  right: number; // float index of the bar whose right edge sits at plotR
  pLo: number;
  pHi: number;
}

type DragMode = "pan" | "vzoom" | "hzoom";

interface DragState {
  id: number;
  mode: DragMode;
  x: number;
  y: number;
  view: View; // view at grab time
  anchorP: number; // price under the grab point (vzoom anchor)
}

/** drop impossible candles (0-prints, NaNs, inverted rows). */
function cleanBars(raw: Bar[] | null): Bar[] {
  if (!raw) return [];
  const out: Bar[] = [];
  for (const b of raw) {
    if (
      Number.isFinite(b.t) && Number.isFinite(b.o) && Number.isFinite(b.h) && Number.isFinite(b.l) &&
      Number.isFinite(b.c) && Number.isFinite(b.v) && b.l > 0 && b.h >= b.l && b.o > 0 && b.c > 0
    ) {
      out.push(b);
    }
  }
  return out;
}

/** auto price range over visible bars, with an outlier clamp so a single
 *  wild wick (testnet-style 0 / 90k prints) can never squash the scale. */
function robustRange(vis: Bar[]): { lo: number; hi: number } {
  if (!vis.length) return { lo: 0, hi: 1 };
  let lo = Infinity;
  let hi = -Infinity;
  for (const b of vis) {
    lo = Math.min(lo, b.l);
    hi = Math.max(hi, b.h);
  }
  if (vis.length >= 24) {
    const lows = vis.map((b) => b.l).sort((a, b) => a - b);
    const highs = vis.map((b) => b.h).sort((a, b) => a - b);
    const p02 = lows[Math.floor(0.02 * (lows.length - 1))];
    const p98 = highs[Math.ceil(0.98 * (highs.length - 1))];
    if (Number.isFinite(p02) && Number.isFinite(p98) && p98 > p02 && hi - lo > 3 * (p98 - p02)) {
      lo = p02;
      hi = p98;
    }
  }
  if (!(hi > lo)) hi = lo + Math.max(lo * 0.005, 1);
  return { lo, hi };
}

function fmtVol(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
  return v.toFixed(a >= 10 ? 1 : 2);
}

function timeLabel(t: number, daily: boolean): string {
  const d = new Date(t);
  if (daily) return `${d.getUTCDate()} ${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })}`;
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export default function BinanceChart({
  bars: restBars,
  liveBar,
  interval,
  priceDecs,
  height = 460,
  base,
}: {
  bars: Bar[] | null;
  liveBar: LiveBar | null;
  interval: string;
  priceDecs: number;
  height?: number;
  base?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 900, h: height });
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [cursor, setCursor] = useState<"crosshair" | "ns-resize" | "ew-resize" | "grabbing">("crosshair");
  const [follow, setFollow] = useState(true);
  const [view, setView] = useState<View | null>(null);

  // mirrors for synchronous interaction math (no stale-closure races)
  const viewRef = useRef<View | null>(null);
  const barsRef = useRef<Bar[]>([]);
  const autoYRef = useRef(true);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // ----- data: REST bars + live forming bar, impossible rows dropped -----
  const bars = useMemo(() => {
    const arr = cleanBars(restBars);
    if (!liveBar) return arr;
    const last = arr[arr.length - 1];
    const lb: Bar = { t: liveBar.t, o: liveBar.o, h: liveBar.h, l: liveBar.l, c: liveBar.c, v: liveBar.v };
    if (lb.l <= 0 || lb.h < lb.l || !Number.isFinite(lb.c)) return arr; // garbage print — ignore
    if (last && last.t === lb.t) {
      arr[arr.length - 1] = lb;
      return arr;
    }
    if (!last || lb.t > last.t) return [...arr, lb];
    return arr;
  }, [restBars, liveBar]);
  // refs are synced in a passive effect (react-hooks/refs: no ref writes
  // during render). Declared before every reader below (fit effect, draw
  // effect, wheel/pointer handlers), so they always observe the committed
  // bars — effects run in declaration order within the same commit.
  useEffect(() => {
    barsRef.current = bars;
  }, [bars]);

  // geometry (recomputed each render — cheap)
  const plotL = 6;
  const plotR = Math.max(plotL + 80, size.w - AXIS_W);
  const plotT = 6;
  const plotB = Math.max(plotT + 60, size.h - TIME_H);
  const volH = Math.max(30, (plotB - plotT) * VOL_FRAC);
  const priceBot = plotB - volH - 4;
  const plotW = plotR - plotL;
  const priceH = Math.max(1, priceBot - plotT);
  const geomRef = useRef({ plotL, plotR, plotT, plotB, priceBot, plotW, priceH });
  // geometry re-derives every render (cheap); the mirror syncs in an effect
  // (react-hooks/refs) — runs before every geomRef reader (fit/draw effects
  // and the interaction handlers, which only ever fire after commit).
  useEffect(() => {
    geomRef.current = { plotL, plotR, plotT, plotB, priceBot, plotW, priceH };
  });

  const fitView = useCallback((bw: number, arr: Bar[]): View | null => {
    if (!arr.length) return null;
    const { plotW: pw } = geomRef.current;
    const visible = Math.max(8, Math.floor(pw / bw));
    const from = Math.max(0, arr.length - visible);
    const { lo, hi } = robustRange(arr.slice(from));
    const pad = (hi - lo) * 0.07 || Math.max(hi * 0.004, 1);
    return { barW: bw, right: arr.length - 1, pLo: lo - pad, pHi: hi + pad };
  }, []);

  /** commit a new view: syncs the ref, React state and the follow flag. */
  const commit = useCallback((v: View | null) => {
    viewRef.current = v;
    setView(v);
    if (v) {
      const n = barsRef.current.length;
      setFollow(v.right >= n - 1.05);
    }
  }, []);

  // reset on mount + interval/symbol switches (bars arrive async — the
  // follow effect below performs the first fit when they land).
  // SET-STATE-IN-EFFECT FIX (react-hooks 7): the view STATE resets during
  // render via the guarded previous-key pattern (React docs "adjust state
  // when a prop changes" — no effect cascade); the synchronous mirrors
  // (viewRef/autoYRef) reset in a ref-only effect, which runs BEFORE the
  // fit effect below by declaration order.
  const resetKey = `${interval}|${base ?? ""}`;
  const [appliedResetKey, setAppliedResetKey] = useState(resetKey);
  if (appliedResetKey !== resetKey) {
    setAppliedResetKey(resetKey);
    setView(null);
  }
  useEffect(() => {
    viewRef.current = null;
    autoYRef.current = true;
  }, [interval, base]);

  // live tick: pin the right edge while following; auto price range while
  // the user has not locked the scale manually (TradingView "auto" mode)
  useEffect(() => {
    const v = viewRef.current;
    if (!bars.length) return;
    if (!v) {
      commit(fitView(DEF_BAR_W, bars));
      return;
    }
    const right = v.right >= bars.length - 1.05 ? bars.length - 1 : v.right;
    let nv: View = { ...v, right };
    if (autoYRef.current) {
      const { plotW: pw } = geomRef.current;
      const visible = Math.max(8, Math.floor(pw / v.barW));
      const to = Math.min(bars.length - 1, Math.round(right));
      const from = Math.max(0, to - visible);
      const { lo, hi } = robustRange(bars.slice(from, to + 1));
      const pad = (hi - lo) * 0.07 || Math.max(hi * 0.004, 1);
      nv = { ...nv, pLo: lo - pad, pHi: hi + pad };
    }
    const changed = nv.right !== v.right || nv.pLo !== v.pLo || nv.pHi !== v.pHi;
    if (changed) commit(nv);
    else if (v.right >= bars.length - 1.05) setFollow(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars]);

  const lastPrice = bars.length ? bars[bars.length - 1].c : null;
  const daily = interval === "1d";

  const idxAtX = useCallback((x: number, v: View) => {
    const { plotR: pr } = geomRef.current;
    return v.right - (pr - x) / v.barW;
  }, []);
  const xOfBar = useCallback((i: number, v: View) => {
    const { plotR: pr } = geomRef.current;
    return pr - (v.right - i) * v.barW;
  }, []);
  const priceAt = useCallback((y: number, v: View) => {
    const { plotT: t, priceBot: b } = geomRef.current;
    return fromPx(makeScale(v.pHi, v.pLo, t, b), y);
  }, []);

  // ----- render -----
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = setupHiDPI(canvas);
    if (!ctx) return;
    const W = size.w;
    const H = size.h;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    if (!bars.length || !view) {
      ctx.fillStyle = COLORS.text;
      ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.fillText(restBars ? "no valid bars for this interval" : "loading bars…", W / 2, 24);
      ctx.textAlign = "left";
      return;
    }

    const { barW, right, pLo, pHi } = view;
    const sy = makeScale(pHi, pLo, plotT, priceBot);
    const yP = (p: number) => toPx(sy, p);
    const iMin = Math.max(0, Math.floor(right - plotW / barW) - 1);
    const iMax = Math.min(bars.length - 1, Math.ceil(right) + 1);
    const vis = bars.slice(iMin, iMax + 1);

    // watermark
    if (base) {
      ctx.font = "700 26px ui-monospace, monospace";
      ctx.fillStyle = "rgba(230,237,243,0.045)";
      ctx.textAlign = "center";
      ctx.fillText(`${base}USDT · ${interval}`, plotL + plotW / 2, plotT + priceH / 2);
      ctx.textAlign = "left";
    }

    // price grid + axis labels
    ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textBaseline = "middle";
    const step = niceStep(pHi - pLo, Math.max(3, Math.floor(priceH / 52)));
    const fmtP = (p: number) => p.toLocaleString("en-US", { minimumFractionDigits: priceDecs, maximumFractionDigits: priceDecs });
    for (let p = Math.ceil(pLo / step) * step; p <= pHi; p += step) {
      const y = yP(p);
      if (y < plotT || y > priceBot) continue;
      drawGridLine(ctx, plotL, y, plotR, y);
      ctx.fillStyle = COLORS.text;
      ctx.fillText(fmtP(p), plotR + 8, y);
    }

    // time grid + labels (day boundaries get the date)
    const stride = Math.max(1, Math.ceil(72 / barW));
    const niceStrides = [1, 2, 3, 5, 10, 15, 20, 30, 60, 120, 240];
    const tStride = niceStrides.find((s) => s >= stride) ?? stride;
    ctx.textAlign = "center";
    let prevDay = -1;
    for (let i = iMin; i <= iMax; i++) {
      if (i % tStride !== 0) continue;
      const cx = xOfBar(i, view) + barW / 2;
      if (cx < plotL + 4 || cx > plotR - 4) continue;
      drawGridLine(ctx, cx, plotT, cx, plotB);
      const day = Math.floor(bars[i].t / 86_400_000);
      const isDayStart = day !== prevDay && prevDay >= 0;
      const label = daily || isDayStart
        ? `${new Date(bars[i].t).getUTCDate()} ${new Date(bars[i].t).toLocaleString("en-US", { month: "short", timeZone: "UTC" })}`
        : timeLabel(bars[i].t, false);
      ctx.fillStyle = isDayStart && !daily ? "#b6c2cf" : COLORS.text;
      ctx.fillText(label, cx, plotB + 12);
      prevDay = day;
    }
    ctx.textAlign = "left";

    // volume pane (normalised over VISIBLE bars so they never vanish)
    let vMax = 0;
    for (const b of vis) vMax = Math.max(vMax, b.v);
    if (vMax > 0) {
      const volTop = priceBot + 6;
      const volPlotH = Math.max(1, plotB - volTop);
      const bw = Math.max(1, barW * 0.72);
      for (let i = iMin; i <= iMax; i++) {
        const b = bars[i];
        const x = xOfBar(i, view);
        const hV = (b.v / vMax) * volPlotH;
        ctx.fillStyle = b.c >= b.o ? COLORS.greenDim : COLORS.redDim;
        ctx.fillRect(x + (barW - bw) / 2, plotB - hV, bw, hV);
      }
    }

    // candles
    const bodyW = Math.max(1, barW * 0.72);
    for (let i = iMin; i <= iMax; i++) {
      const b = bars[i];
      const x = xOfBar(i, view) + barW / 2;
      const up = b.c >= b.o;
      const col = up ? COLORS.green : COLORS.red;
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, yP(b.h));
      ctx.lineTo(Math.round(x) + 0.5, yP(b.l));
      ctx.stroke();
      const yo = yP(b.o);
      const yc = yP(b.c);
      ctx.fillRect(x - bodyW / 2, Math.min(yo, yc), bodyW, Math.max(1, Math.abs(yc - yo)));
    }

    // last price line + axis tag
    if (lastPrice != null) {
      const prevC = bars[bars.length - 2]?.c ?? lastPrice;
      const col = lastPrice >= prevC ? COLORS.green : COLORS.red;
      const y = yP(lastPrice);
      if (y >= plotT && y <= priceBot) {
        ctx.strokeStyle = col;
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(plotL, y);
        ctx.lineTo(plotR, y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      const ty = clamp(y, plotT + 8, priceBot - 8);
      ctx.fillStyle = col;
      ctx.fillRect(plotR + 2, ty - 8, AXIS_W - 4, 16);
      ctx.fillStyle = "#0b0e11";
      ctx.font = "bold 10px ui-monospace, monospace";
      ctx.fillText(fmtP(lastPrice), plotR + 7, ty);
      ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
    }

    // crosshair + axis bubbles
    if (hover && !dragRef.current) {
      ctx.strokeStyle = "rgba(230,237,243,0.35)";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hover.x, plotT);
      ctx.lineTo(hover.x, plotB);
      ctx.moveTo(plotL, hover.y);
      ctx.lineTo(plotR, hover.y);
      ctx.stroke();
      ctx.setLineDash([]);
      const hp = priceAt(hover.y, view);
      const pTxt = fmtP(hp);
      ctx.fillStyle = "#2a313d";
      const pw = Math.max(ctx.measureText(pTxt).width + 12, AXIS_W - 4);
      ctx.fillRect(plotR + 2, hover.y - 8, pw, 16);
      ctx.fillStyle = COLORS.textBright;
      ctx.fillText(pTxt, plotR + 8, hover.y);
      const hi = clamp(Math.round(idxAtX(hover.x, view)), 0, bars.length - 1);
      const tTxt = new Date(bars[hi].t).toLocaleString("en-US", {
        timeZone: "UTC", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
      });
      const tw = ctx.measureText(tTxt).width + 12;
      ctx.fillStyle = "#2a313d";
      ctx.fillRect(clamp(hover.x - tw / 2, plotL, plotR - tw), plotB + 2, tw, 15);
      ctx.fillStyle = COLORS.textBright;
      ctx.textAlign = "center";
      ctx.fillText(tTxt, clamp(hover.x, plotL + tw / 2, plotR - tw / 2), plotB + 10);
      ctx.textAlign = "left";
    }

    // OHLCV legend (hovered bar, else live bar)
    const li = hover && !dragRef.current ? clamp(Math.round(idxAtX(hover.x, view)), 0, bars.length - 1) : bars.length - 1;
    const lb = bars[li];
    if (lb) {
      const prev = bars[li - 1]?.c ?? lb.o;
      const chg = ((lb.c - prev) / prev) * 100;
      const parts: [string, string][] = [
        ["O", fmtP(lb.o)], ["H", fmtP(lb.h)], ["L", fmtP(lb.l)], ["C", fmtP(lb.c)],
        ["Δ", `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`],
        ["V", `${fmtVol(lb.v)}${base ? ` ${base}` : ""}`],
      ];
      let x = plotL + 8;
      const y = plotT + 10;
      for (const [k, val] of parts) {
        ctx.globalAlpha = k === "O" || k === "H" || k === "L" ? 0.7 : 1;
        ctx.fillStyle = k === "C" || k === "Δ" ? (chg >= 0 ? COLORS.green : COLORS.red) : COLORS.text;
        ctx.fillText(k, x, y);
        x += ctx.measureText(k).width + 4;
        ctx.fillText(val, x, y);
        x += ctx.measureText(val).width + 12;
      }
      ctx.globalAlpha = 1;
      if (li === bars.length - 1) {
        ctx.fillStyle = lb.c >= lb.o ? COLORS.green : COLORS.red;
        ctx.globalAlpha = 0.8;
        ctx.fillText("· live", x, y);
        ctx.globalAlpha = 1;
      }
    }

    // pane separators + border
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotL + 0.5, priceBot + 3.5);
    ctx.lineTo(plotR - 0.5, priceBot + 3.5);
    ctx.moveTo(plotR + 0.5, plotT);
    ctx.lineTo(plotR + 0.5, plotB);
    ctx.moveTo(plotL + 0.5, plotB + 0.5);
    ctx.lineTo(plotR - 0.5, plotB + 0.5);
    ctx.stroke();
  }, [size, view, bars, hover, interval, priceDecs, base, lastPrice, plotL, plotR, plotT, plotB, priceBot, priceH, plotW, daily, idxAtX, xOfBar, priceAt, restBars]);

  useEffect(() => {
    draw();
  }, [draw]);

  // ----- wheel: horizontal zoom on the plot, vertical on the price axis -----
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      if (!v || !barsRef.current.length) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const { plotR: pr, plotT: t, priceH: ph, plotW: pw } = geomRef.current;
      const n = barsRef.current.length;
      if (x >= pr) {
        // vertical zoom anchored at cursor
        const f = Math.exp(-e.deltaY * 0.0012);
        const range = clamp((v.pHi - v.pLo) * f, Math.max(v.pLo, 1e-9) * 1e-4, (v.pHi - v.pLo) * 400);
        const anchor = priceAt(y, v);
        const frac = clamp((y - t) / ph, 0, 1);
        const pHi = anchor + frac * range;
        autoYRef.current = false;
        commit({ ...v, pHi, pLo: pHi - range });
        return;
      }
      // horizontal zoom anchored at cursor
      const f = Math.exp(-e.deltaY * 0.0014);
      const barW = clamp(v.barW * f, MIN_BAR_W, MAX_BAR_W);
      const idx = idxAtX(x, v);
      const right = idx + (pr - x) / barW;
      commit({ ...v, barW, right: clamp(right, 2, n - 1 + (pw / barW) * 0.75) });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [commit, idxAtX, priceAt]);

  // ----- pointer: pan / axis-drag zoom -----
  const zoneOf = useCallback((x: number, y: number): DragMode => {
    const { plotR: pr, plotB: pb } = geomRef.current;
    if (x >= pr && y <= pb) return "vzoom";
    if (y >= pb) return "hzoom";
    return "pan";
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const el = canvasRef.current;
      const v = viewRef.current;
      if (!el || !v) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const mode = zoneOf(x, y);
      try {
        el.setPointerCapture(e.pointerId); // can throw for synthetic/retired pointers
      } catch {
        /* capture is an optimization — drag still works without it */
      }
      dragRef.current = { id: e.pointerId, mode, x, y, view: v, anchorP: priceAt(y, v) };
      setCursor(mode === "vzoom" ? "ns-resize" : mode === "hzoom" ? "ew-resize" : "grabbing");
    },
    [zoneOf, priceAt]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const el = canvasRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const d = dragRef.current;
      if (!d) {
        setHover({ x, y });
        const z = zoneOf(x, y);
        setCursor(z === "vzoom" ? "ns-resize" : z === "hzoom" ? "ew-resize" : "crosshair");
        return;
      }
      setHover({ x, y });
      const dx = x - d.x;
      const dy = y - d.y;
      const { plotT: t, priceH: ph, plotW: pw } = geomRef.current;
      const n = barsRef.current.length;
      if (d.mode === "pan") {
        const pShift = (dy / ph) * (d.view.pHi - d.view.pLo);
        if (Math.abs(dy) > 2) autoYRef.current = false;
        const right = clamp(d.view.right - dx / d.view.barW, 2, n - 1 + (pw / d.view.barW) * 0.75);
        commit({ ...d.view, right, pLo: d.view.pLo + pShift, pHi: d.view.pHi + pShift });
      } else if (d.mode === "vzoom") {
        // TradingView price-scale drag: anchored at the grab price
        const range = d.view.pHi - d.view.pLo;
        const f = Math.exp(dy * 0.0045);
        const newRange = clamp(range * f, Math.max(d.view.pLo, 1e-9) * 1e-4, range * 500);
        const frac = clamp((d.y - t) / ph, 0, 1);
        const pHi = d.anchorP + frac * newRange;
        autoYRef.current = false;
        commit({ ...d.view, pHi, pLo: pHi - newRange });
      } else {
        // time-axis drag: horizontal zoom anchored at the right edge
        const barW = clamp(d.view.barW * Math.exp(-dx * 0.0045), MIN_BAR_W, MAX_BAR_W);
        commit({ ...d.view, barW });
      }
    },
    [zoneOf, commit]
  );

  const endDrag = useCallback((e: React.PointerEvent) => {
    const el = canvasRef.current;
    if (el?.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
    dragRef.current = null;
    setCursor("crosshair");
  }, []);

  const onPointerLeave = useCallback(() => setHover(null), []);

  const reset = useCallback(() => {
    autoYRef.current = true;
    commit(fitView(DEF_BAR_W, barsRef.current));
  }, [commit, fitView]);

  const zoomBtn = useCallback(
    (f: number) => {
      const v = viewRef.current;
      if (!v) return;
      const { plotL: pl, plotR: pr, plotW: pw } = geomRef.current;
      const n = barsRef.current.length;
      const barW = clamp(v.barW * f, MIN_BAR_W, MAX_BAR_W);
      const midX = pl + pw / 2;
      const midIdx = idxAtX(midX, v);
      const right = clamp(midIdx + (pr - midX) / barW, 2, n - 1 + (pw / barW) * 0.75);
      commit({ ...v, barW, right });
    },
    [commit, idxAtX]
  );

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height }}>
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        style={{ width: "100%", height: "100%", cursor, touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={onPointerLeave}
        onDoubleClick={reset}
        aria-label="Binance live candles — drag to pan, wheel to zoom, drag the price axis to scale"
      />

      {/* floating zoom toolbar (TradingView-style) */}
      <div className="absolute left-2 top-8 flex flex-col gap-1 rounded-md border border-neutral-800/80 bg-[#11151a]/90 p-1 backdrop-blur">
        <button onClick={() => zoomBtn(1.3)} title="Zoom in — more px per bar" className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button onClick={() => zoomBtn(1 / 1.3)} title="Zoom out — fewer px per bar" className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100">
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button onClick={reset} title="Auto-fit + follow live (same as double-click)" className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100">
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* jump-to-live (appears when panned away from the right edge) */}
      {!follow && bars.length > 0 && (
        <button
          onClick={reset}
          className="absolute bottom-8 right-20 rounded-md border border-neutral-700 bg-[#1a212b] px-2.5 py-1 text-[10px] font-bold tracking-wider text-amber-300 shadow-lg transition-colors hover:bg-[#232c38]"
        >
          LIVE →
        </button>
      )}

      <div className="pointer-events-none absolute bottom-8 left-2 text-[9px] text-neutral-600">
        drag = pan · wheel = zoom · drag price/time axis = scale · dbl-click = fit
      </div>
    </div>
  );
}
