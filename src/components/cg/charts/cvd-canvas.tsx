"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COLORS, clamp, drawGridLine, makeScale, niceStep, setupHiDPI, toPx, type Scale } from "./chart-utils";

export interface CvdChartModel {
  n: number;
  candles: [number, number, number, number, number][];
  perp: number[]; // USD millions
  spot: number[];
  total: number[];
  delta: number[];
  ratio: (number | null)[];
  divergences: { type: "bull" | "bear"; bars: [number, number, number]; priceA: number; priceB: number }[];
}

/**
 * CVD chart — candles with the CVD line overlay (their normalized view),
 * a per-bar delta pane and a taker-buy-ratio pane; Bull/Bear divergence
 * markers on the swings they connect.
 *
 * TradingView interactions: drag = pan (time + price) · wheel = horizontal
 * zoom anchored at the cursor · drag the price axis = vertical zoom · drag
 * the time axis = horizontal zoom · double-click = reset. The price auto-range
 * follows the visible window and ignores impossible candles (low ≤ 0, NaN).
 */

const AXIS_W = 78;
const TIME_H = 22;
const MIN_BARS = 12;
const MAX_BARS = 600;

interface View {
  start: number; // first visible bar index
  count: number; // visible bars
  pLo: number;
  pHi: number;
}

type DragMode = "pan" | "vzoom" | "hzoom";

interface DragState {
  x: number;
  y: number;
  startY: number;
  start: number;
  count: number;
  pLo: number;
  pHi: number;
  mode: DragMode;
  anchorP: number;
}

export default function CvdCanvas({
  model,
  mode,
  showDelta,
  showRatio,
  height = 460,
  priceDecs = 1,
}: {
  model: CvdChartModel;
  mode: "perp" | "spot" | "total";
  showDelta: boolean;
  showRatio: boolean;
  height?: number;
  /** per-asset price decimals (assetOf(sym).priceDecs) for axis labels */
  priceDecs?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 900, h: height });
  const [view, setView] = useState<View | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [cursor, setCursor] = useState<"crosshair" | "ns-resize" | "ew-resize" | "grabbing">("crosshair");
  const drag = useRef<DragState | null>(null);
  const [modelKey, setModelKey] = useState("");

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const { candles, perp, spot, total, delta, ratio, divergences, n } = model;
  const cvd = mode === "perp" ? perp : mode === "spot" ? spot : total;

  // impossible candles dropped from the scale (never from the tape — they
  // still draw, just can't squash the axis)
  const clean = useMemo(
    () => candles.filter((c) => Number.isFinite(c[1]) && Number.isFinite(c[2]) && Number.isFinite(c[3]) && Number.isFinite(c[4]) && c[3] > 0),
    [candles]
  );

  // reset the viewport when the model identity changes (symbol/interval)
  useEffect(() => {
    const key = `${model.n}:${candles[0]?.[0] ?? 0}:${mode}:${showDelta}:${showRatio}`;
    if (key === modelKey) return;
    setModelKey(key);
    setView(null); // re-fit below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, mode, showDelta, showRatio]);

  const padL = 8;
  const plotR = Math.max(padL + 60, size.w - AXIS_W);
  const plotT = 10;
  const plotB = Math.max(plotT + 60, size.h - TIME_H);
  const plotW = plotR - padL;

  // default/fit view: last ~160 bars (or all)
  const fitView = useCallback((): View | null => {
    if (!clean.length) return null;
    const count = Math.min(160, clean.length);
    const start = Math.max(0, clean.length - count);
    let pLo = Infinity;
    let pHi = -Infinity;
    for (let i = start; i < clean.length; i++) {
      pLo = Math.min(pLo, clean[i][3]);
      pHi = Math.max(pHi, clean[i][2]);
    }
    if (!(pHi > pLo)) pHi = pLo + Math.max(pLo * 0.005, 1);
    const pad = (pHi - pLo) * 0.06 || Math.max(pHi * 0.004, 1);
    return { start, count, pLo: pLo - pad, pHi: pHi + pad };
  }, [clean]);

  // render-adjust: fit once, and grow the window when new bars append while
  // the tail is on screen (live follow — manual history views are untouched)
  if (!view && clean.length) {
    const v = fitView();
    if (v) setView(v);
  } else if (view && clean.length) {
    const end = view.start + view.count;
    if (view.count < clean.length && end >= clean.length - 1 && end < clean.length) {
      const start = Math.max(0, clean.length - view.count);
      let pLo = view.pLo;
      let pHi = view.pHi;
      const lastC = clean[clean.length - 1];
      if (lastC[3] < pLo) pLo = lastC[3] - (pHi - pLo) * 0.02;
      if (lastC[2] > pHi) pHi = lastC[2] + (pHi - pLo) * 0.02;
      setView({ ...view, start, pLo, pHi });
    }
  }

  const idxAtX = useCallback(
    (x: number, v: View) => v.start + ((x - padL) / plotW) * v.count,
    [padL, plotW]
  );
  const priceAt = useCallback(
    (y: number, v: View, top: number, bot: number) => {
      const s = makeScale(v.pHi, v.pLo, top, bot);
      return s.d1 === s.d0 ? s.d0 : s.d0 + ((y - s.p0) / (s.p1 - s.p0)) * (s.d1 - s.d0);
    },
    []
  );

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = setupHiDPI(canvas);
    if (!ctx) return;
    const W = size.w;
    const H = size.h;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    if (!n || !candles.length || !view) {
      ctx.fillStyle = COLORS.text;
      ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText("loading CVD model…", 12, 20);
      return;
    }

    const { start, count, pLo, pHi } = view;
    const end = Math.min(clean.length, start + count);
    const bw = plotW / count;

    const hMain = showDelta && showRatio ? H * 0.56 : showDelta || showRatio ? H * 0.7 : H * 0.92 - plotT;
    const mainTop = plotT;
    const mainBot = plotT + hMain - TIME_H * 0.4;

    // ---- main pane: candles + CVD ----
    // ORIENTATION FIX (2026-11-12 review): the pixel anchors were swapped
    // (pHi→bottom), inverting the whole price pane — candles, grid labels and
    // last-price tag all read backwards while the CVD sub-scale was upright.
    // Anchors now map the HIGH price to the TOP, matching priceAt() and the
    // vzoom/pan anchor math.
    const syP: Scale = makeScale(pHi, pLo, mainTop, mainBot);
    const yP = (p: number) => toPx(syP, p);

    const step = niceStep(pHi - pLo, 6);
    ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
    for (let p = Math.ceil(pLo / step) * step; p <= pHi; p += step) {
      const yy = yP(p);
      if (yy < mainTop || yy > mainBot) continue;
      drawGridLine(ctx, padL, yy, plotR, yy);
      ctx.fillStyle = COLORS.text;
      ctx.fillText(
        p.toLocaleString("en-US", { minimumFractionDigits: priceDecs, maximumFractionDigits: priceDecs }),
        plotR + 8,
        yy + 3
      );
    }

    // time grid: stride so labels never overlap
    const tStride = Math.max(1, Math.ceil(72 / bw));
    ctx.textAlign = "center";
    for (let i = start; i < end; i++) {
      if (i % tStride !== 0) continue;
      const x = padL + (i - start) * bw + bw / 2;
      if (x < padL + 4 || x > plotR - 4) continue;
      drawGridLine(ctx, x, plotT, x, mainBot);
      const d = new Date(candles[i]?.[0] ?? 0);
      const dayStart = i > 0 && new Date(candles[i - 1][0]).getUTCDate() !== d.getUTCDate();
      const label = dayStart
        ? `${d.getUTCDate()} ${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })}`
        : `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
      ctx.fillStyle = dayStart ? "#b6c2cf" : COLORS.text;
      ctx.fillText(label, x, H - 8);
    }
    ctx.textAlign = "left";

    for (let i = start; i < end; i++) {
      const c = candles[i];
      if (!c) continue;
      const x = padL + (i - start) * bw + bw / 2;
      const up = c[4] >= c[1];
      ctx.strokeStyle = up ? COLORS.green : COLORS.red;
      ctx.fillStyle = up ? COLORS.green : COLORS.red;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, yP(c[3]));
      ctx.lineTo(Math.round(x) + 0.5, yP(c[2]));
      ctx.stroke();
      const yo = yP(c[1]);
      const yc = yP(c[4]);
      ctx.fillRect(x - bw * 0.35, Math.min(yo, yc), Math.max(1, bw * 0.7), Math.max(1, Math.abs(yc - yo)));
    }

    // CVD line (right sub-scale, its own axis like the page's normalized view)
    let cLo = Infinity;
    let cHi = -Infinity;
    for (let i = start; i < end; i++) {
      const v = cvd[i];
      if (v == null || !Number.isFinite(v)) continue;
      cLo = Math.min(cLo, v);
      cHi = Math.max(cHi, v);
    }
    if (!(cHi > cLo)) {
      cHi = (Number.isFinite(cHi) ? cHi : 0) + 1;
      cLo = cHi - 2;
    }
    const cPad = (cHi - cLo) * 0.08 || 1;
    cLo -= cPad;
    cHi += cPad;
    const syC: Scale = makeScale(cLo, cHi, mainBot, mainTop);
    ctx.strokeStyle = "#58a6ff";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    let started = false;
    for (let i = start; i < end; i++) {
      const v = cvd[i];
      if (v == null || !Number.isFinite(v)) continue;
      const x = padL + (i - start) * bw + bw / 2;
      const yy = toPx(syC, v);
      if (!started) {
        ctx.moveTo(x, yy);
        started = true;
      } else ctx.lineTo(x, yy);
    }
    ctx.stroke();
    // CVD zero line
    const zy = toPx(syC, 0);
    if (zy >= mainTop && zy <= mainBot) {
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = "rgba(88,166,255,0.4)";
      ctx.beginPath();
      ctx.moveTo(padL, zy);
      ctx.lineTo(plotR, zy);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // CVD axis labels (right, blue) — adaptive K/M/B so low-volume assets
    // (XAG, ADA …) don't render as "0.0B"
    const fmtCvd = (v: number) => {
      const a = Math.abs(v);
      if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
      if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
      if (a >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
      return v.toFixed(0);
    };
    ctx.fillStyle = "#58a6ff";
    ctx.fillText(fmtCvd(cHi), plotR + 8, mainTop + 8);
    ctx.fillText(fmtCvd(cLo), plotR + 8, mainBot - 2);

    // divergence markers (only those with the pivot inside the window)
    for (const d of divergences) {
      const [a, b] = d.bars;
      if (b < start || a >= end) continue;
      const xb = padL + (b - start) * bw + bw / 2;
      const xa = padL + (a - start) * bw + bw / 2;
      const yb = yP(d.priceB);
      ctx.fillStyle = d.type === "bull" ? "rgba(14,203,129,0.9)" : "rgba(246,70,93,0.9)";
      ctx.beginPath();
      ctx.arc(xb, yb, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = d.type === "bull" ? "rgba(14,203,129,0.5)" : "rgba(246,70,93,0.5)";
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(xa, yP(d.priceA));
      ctx.lineTo(xb, yb);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ---- delta pane ----
    const subH = showDelta && showRatio ? H * 0.17 : showDelta || showRatio ? H * 0.2 : 0;
    if (showDelta && subH > 0) {
      const dTop = mainBot + 14;
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(padL, dTop, plotW, subH);
      ctx.fillStyle = COLORS.text;
      ctx.fillText("Delta (M USD)", padL + 4, dTop + 11);
      let dMax = 1;
      for (let i = start; i < end; i++) {
        const d = delta[i];
        if (Number.isFinite(d)) dMax = Math.max(dMax, Math.abs(d));
      }
      const y0 = dTop + subH / 2;
      for (let i = start; i < end; i++) {
        const d = delta[i];
        if (!d || !Number.isFinite(d)) continue;
        const x = padL + (i - start) * bw;
        const h = (Math.abs(d) / dMax) * (subH / 2 - 4);
        ctx.fillStyle = d >= 0 ? "rgba(14,203,129,0.7)" : "rgba(246,70,93,0.7)";
        ctx.fillRect(x, d >= 0 ? y0 - h : y0, Math.max(1, bw * 0.8), h);
      }
      drawGridLine(ctx, padL, y0, plotR, y0);
    }

    // ---- ratio pane ----
    if (showRatio && subH > 0) {
      const dTop = mainBot + 14 + (showDelta ? subH + 6 : 0);
      const dBot = dTop + subH;
      if (dBot < H - TIME_H + 10) {
        ctx.fillStyle = "rgba(255,255,255,0.03)";
        ctx.fillRect(padL, dTop, plotW, subH);
        ctx.fillStyle = COLORS.text;
        ctx.fillText("Taker buy share", padL + 4, dTop + 11);
        const syR: Scale = makeScale(0.35, 0.65, dBot, dTop);
        ctx.strokeStyle = "#d29922";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        let st = false;
        for (let i = start; i < end; i++) {
          const v = ratio[i];
          if (v == null || !Number.isFinite(v)) continue;
          const x = padL + (i - start) * bw + bw / 2;
          const yy = toPx(syR, v);
          if (!st) {
            ctx.moveTo(x, yy);
            st = true;
          } else ctx.lineTo(x, yy);
        }
        ctx.stroke();
        const yHalf = toPx(syR, 0.5);
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = "rgba(210,153,34,0.4)";
        ctx.beginPath();
        ctx.moveTo(padL, yHalf);
        ctx.lineTo(plotR, yHalf);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // last price tag
    const lastC = candles[candles.length - 1];
    if (lastC && view.start + view.count >= candles.length - 1) {
      const y = yP(lastC[4]);
      if (y >= mainTop && y <= mainBot) {
        const txt = lastC[4].toLocaleString("en-US", { minimumFractionDigits: priceDecs, maximumFractionDigits: priceDecs });
        ctx.fillStyle = lastC[4] >= lastC[1] ? COLORS.green : COLORS.red;
        ctx.fillRect(plotR + 2, y - 8, AXIS_W - 6, 16);
        ctx.fillStyle = "#0b0e11";
        ctx.font = "bold 10px ui-monospace, monospace";
        ctx.fillText(txt, plotR + 8, y + 3);
        ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
      }
    }

    // crosshair + bubbles
    if (hover && !drag.current) {
      ctx.strokeStyle = "rgba(230,237,243,0.35)";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hover.x, plotT);
      ctx.lineTo(hover.x, mainBot);
      ctx.moveTo(padL, hover.y);
      ctx.lineTo(plotR, hover.y);
      ctx.stroke();
      ctx.setLineDash([]);
      const hp = priceAt(hover.y, view, mainTop, mainBot);
      const pTxt = hp.toLocaleString("en-US", { minimumFractionDigits: priceDecs, maximumFractionDigits: priceDecs });
      const pw = Math.max(ctx.measureText(pTxt).width + 12, AXIS_W - 6);
      ctx.fillStyle = "#2a313d";
      ctx.fillRect(plotR + 2, hover.y - 8, pw, 16);
      ctx.fillStyle = COLORS.textBright;
      ctx.fillText(pTxt, plotR + 8, hover.y + 3);
      const hi = clamp(Math.round(idxAtX(hover.x, view)), 0, candles.length - 1);
      const tTxt = new Date(candles[hi][0]).toLocaleString("en-US", {
        timeZone: "UTC", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
      });
      const tw = ctx.measureText(tTxt).width + 12;
      ctx.fillStyle = "#2a313d";
      ctx.fillRect(clamp(hover.x - tw / 2, padL, plotR - tw), H - TIME_H + 2, tw, 15);
      ctx.fillStyle = COLORS.textBright;
      ctx.textAlign = "center";
      ctx.fillText(tTxt, clamp(hover.x, padL + tw / 2, plotR - tw / 2), H - TIME_H + 10);
      ctx.textAlign = "left";
    }

    // border
    ctx.strokeStyle = COLORS.axis;
    ctx.strokeRect(padL + 0.5, plotT + 0.5, plotW, mainBot - plotT);
  }, [model, mode, showDelta, showRatio, size, view, hover, candles, cvd, delta, ratio, divergences, n, clean, priceDecs, padL, plotR, plotT, plotB, plotW, idxAtX, priceAt]);

  // ----- wheel: horizontal zoom anchored at the cursor -----
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setView((v) => {
        if (!v || !candles.length) return v;
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const f = Math.exp(-e.deltaY * 0.0014);
        const count = Math.round(clamp(v.count * f, MIN_BARS, Math.min(MAX_BARS, candles.length)));
        const idx = idxAtX(x, v);
        const start = Math.round(clamp(idx - ((x - padL) / plotW) * count, 0, Math.max(0, candles.length - count)));
        return { ...v, start, count };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [candles.length, idxAtX, padL, plotW]);

  const zoneOf = useCallback(
    (x: number, y: number): DragMode => {
      if (x >= plotR && y <= plotB) return "vzoom";
      if (y >= plotB) return "hzoom";
      return "pan";
    },
    [plotR, plotB]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const el = ref.current;
      if (!el || !view) return;
      try {
        el.setPointerCapture(e.pointerId); // can throw for synthetic/retired pointers
      } catch {
        /* capture is an optimization — drag still works without it */
      }
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const mode = zoneOf(x, y);
      const mainBot = plotT + (showDelta && showRatio ? size.h * 0.56 : showDelta || showRatio ? size.h * 0.7 : size.h * 0.92 - plotT) - TIME_H * 0.4;
      const anchorP = view.pHi - ((y - plotT) / Math.max(1, mainBot - plotT)) * (view.pHi - view.pLo);
      drag.current = { x: e.clientX, y: e.clientY, startY: y, start: view.start, count: view.count, pLo: view.pLo, pHi: view.pHi, mode, anchorP };
      setCursor(mode === "vzoom" ? "ns-resize" : mode === "hzoom" ? "ew-resize" : "grabbing");
    },
    [view, zoneOf, showDelta, showRatio, size.h, plotT]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setHover({ x, y });
      const d = drag.current;
      if (!d || !view || !candles.length) {
        const z = zoneOf(x, y);
        setCursor(z === "vzoom" ? "ns-resize" : z === "hzoom" ? "ew-resize" : "crosshair");
        return;
      }
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (d.mode === "pan") {
        const barsShift = Math.round((dx / plotW) * d.count);
        const start = clamp(d.start - barsShift, 0, Math.max(0, candles.length - d.count));
        const mainBot = plotT + (showDelta && showRatio ? size.h * 0.56 : showDelta || showRatio ? size.h * 0.7 : size.h * 0.92 - plotT) - TIME_H * 0.4;
        const pShift = (dy / Math.max(1, mainBot - plotT)) * (d.pHi - d.pLo);
        setView({ ...view, start, pLo: d.pLo + pShift, pHi: d.pHi + pShift });
      } else if (d.mode === "vzoom") {
        const range = d.pHi - d.pLo;
        const newRange = clamp(range * Math.exp(dy * 0.0045), Math.max(d.pLo, 1e-9) * 1e-4, range * 500);
        const mainBot = plotT + (showDelta && showRatio ? size.h * 0.56 : showDelta || showRatio ? size.h * 0.7 : size.h * 0.92 - plotT) - TIME_H * 0.4;
        const frac = clamp((d.startY - plotT) / Math.max(1, mainBot - plotT), 0, 1);
        const pHi = d.anchorP + frac * newRange;
        setView({ ...view, pHi, pLo: pHi - newRange });
      } else {
        const count = Math.round(clamp(d.count * Math.exp(-dx * 0.0045), MIN_BARS, Math.min(MAX_BARS, candles.length)));
        const end = d.start + d.count;
        const start = clamp(Math.round(end - count), 0, Math.max(0, candles.length - count));
        setView({ ...view, start, count });
      }
    },
    [view, candles.length, plotW, zoneOf, plotT, showDelta, showRatio, size.h]
  );

  const endDrag = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (el?.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
    drag.current = null;
    setCursor("crosshair");
  }, []);

  const onPointerLeave = useCallback(() => setHover(null), []);
  const onDoubleClick = useCallback(() => setView(fitView()), [fitView]);

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height }}>
      <canvas
        ref={ref}
        style={{ width: "100%", height: "100%", cursor, touchAction: "none" }}
        className="rounded-md"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={onPointerLeave}
        onDoubleClick={onDoubleClick}
        aria-label="CVD chart — drag to pan, wheel to zoom, drag the price axis to scale"
      />
      <div className="pointer-events-none absolute right-3 top-2 text-[10px] text-neutral-500">
        drag = pan · wheel = zoom · drag price/time axis = scale · dbl-click = reset
      </div>
    </div>
  );
}
