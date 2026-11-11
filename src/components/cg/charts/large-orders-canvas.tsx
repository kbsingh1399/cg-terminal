"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Candle } from "../use-cg-data";
import type { LargeOrderItem } from "@/lib/cg/types";
import { COLORS, clamp, drawGridLine, fromPx, makeScale, niceStep, setupHiDPI, toPx } from "./chart-utils";
import { fmtNum, fmtPrice, fmtTime, fmtUsd } from "@/lib/cg/format";

interface Props {
  candles: Candle[];
  orders: LargeOrderItem[]; // resting walls (futures only for clarity)
  trades: LargeOrderItem[]; // large executed trades
  lastPrice: number | null;
  imbalanceWindowPct: number; // ±N% window for the imbalance pane
  showWalls: boolean;
  showTrades: boolean;
  showImbalance: boolean;
  resetKey: string;
}

const AXIS_W = 64;
const TIME_H = 22;
const IMB_H = 90; // imbalance pane height

export default function LargeOrdersCanvas({
  candles,
  orders,
  trades,
  lastPrice,
  imbalanceWindowPct,
  showWalls,
  showTrades,
  showImbalance,
  resetKey,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 560 });
  const [view, setView] = useState<{ start: number; count: number; pLo: number; pHi: number } | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  // TradingView-style axis drags: pan (chart) · vzoom (price axis) · hzoom (time axis)
  const drag = useRef<{
    x: number;
    y: number;
    start: number;
    count: number;
    pLo: number;
    pHi: number;
    mode: "pan" | "vzoom" | "hzoom";
    anchorP: number;
  } | null>(null);
  const [cursor, setCursor] = useState<"crosshair" | "ns-resize" | "ew-resize" | "grabbing">("crosshair");
  const [inited, setInited] = useState(false);
  const [lastResetKey, setLastResetKey] = useState(resetKey);

  const defaultView = useMemo(() => {
    if (!candles.length) return null;
    const count = Math.min(96, candles.length);
    const start = Math.max(0, candles.length - count);
    let pLo = Infinity;
    let pHi = -Infinity;
    for (let i = start; i < candles.length; i++) {
      pLo = Math.min(pLo, candles[i].l);
      pHi = Math.max(pHi, candles[i].h);
    }
    // include nearby walls in range
    if (lastPrice) {
      pLo = Math.min(pLo, lastPrice * (1 - imbalanceWindowPct / 100));
      pHi = Math.max(pHi, lastPrice * (1 + imbalanceWindowPct / 100));
    }
    const pad = (pHi - pLo) * 0.06 || 1;
    return { start, count, pLo: pLo - pad, pHi: pHi + pad };
  }, [candles, lastPrice, imbalanceWindowPct]);

  // render-adjust pattern: init/reset viewport without effects
  if (!inited && defaultView) {
    setInited(true);
    setView(defaultView);
  }
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setView(defaultView);
  }

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = setupHiDPI(canvas);
    if (!ctx) return;
    const W = size.w;
    const H = size.h;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    if (!candles.length || !view) return;

    const imbH = showImbalance ? IMB_H : 0;
    const plotL = 8;
    const plotR = W - AXIS_W - 6;
    const plotT = 8;
    const plotB = H - TIME_H - imbH;
    const plotW = plotR - plotL;
    const plotH = plotB - plotT;
    if (plotW < 60 || plotH < 60) return;

    const { start, count, pLo, pHi } = view;
    const barW = plotW / count;
    const yScale = makeScale(pHi, pLo, plotT, plotB);
    const tsStart = candles[start]?.ts ?? 0;
    const tsEnd = candles[Math.min(candles.length - 1, start + count - 1)]?.ts ?? tsStart + 1;
    const barTs = candles.length > 1 ? candles[1].ts - candles[0].ts : 900;
    const tsSpan = Math.max(1, tsEnd - tsStart + barTs);
    const xOfTs = (ts: number) => plotL + ((ts - tsStart) / tsSpan) * plotW;

    // grid
    ctx.font = "10px ui-monospace, monospace";
    const step = niceStep(pHi - pLo, Math.max(4, Math.floor(plotH / 46)));
    for (let p = Math.ceil(pLo / step) * step; p <= pHi; p += step) {
      const y = toPx(yScale, p);
      drawGridLine(ctx, plotL, y, plotR, y);
      ctx.fillStyle = COLORS.text;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(fmtPrice(p), plotR + 6, y);
    }
    const t0 = candles[start]?.ts ?? 0;
    const labelEvery = Math.max(1, Math.round(90 / barW));
    for (let vi = 0; vi < count; vi++) {
      const i = start + vi;
      if (i >= candles.length) break;
      if (!candles[i]) continue;
      if (vi % labelEvery === 0) {
        const x = plotL + vi * barW;
        drawGridLine(ctx, x, plotT, x, plotB);
        ctx.fillStyle = COLORS.text;
        ctx.textAlign = "center";
        const d = new Date(candles[i].ts * 1000);
        ctx.fillText(
          `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`,
          x,
          H - 9
        );
      }
    }

    // candles
    const cw = Math.max(2, barW * 0.62);
    for (let vi = 0; vi < count; vi++) {
      const i = start + vi;
      if (i >= candles.length) break;
      const c = candles[i];
      if (!c) continue;
      const x = plotL + vi * barW + barW / 2;
      const up = c.c >= c.o;
      ctx.strokeStyle = up ? COLORS.green : COLORS.red;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, toPx(yScale, c.h));
      ctx.lineTo(x, toPx(yScale, c.l));
      ctx.stroke();
      const yo = toPx(yScale, c.o);
      const yc = toPx(yScale, c.c);
      ctx.fillStyle = up ? COLORS.green : COLORS.red;
      ctx.fillRect(x - cw / 2, Math.min(yo, yc), cw, Math.max(1.5, Math.abs(yc - yo)));
    }

    // wall markers: horizontal dashes at price, length by size
    if (showWalls) {
      const maxQ = Math.max(1, ...orders.map((o) => o.quoteVol));
      const visible = orders.filter((o) => o.price >= pLo && o.price <= pHi);
      visible.sort((a, b) => a.quoteVol - b.quoteVol);
      for (const o of visible) {
        const y = toPx(yScale, o.price);
        const x = xOfTs(o.createTime / 1000);
        // clamp BOTH edges (review finding): a wall placed after the visible
        // window painted leftward across the price-axis gutter
        if (x < plotL || x > plotR) continue;
        const len = clamp(14 + (o.quoteVol / maxQ) * 60, 10, 80);
        const thick = clamp(1.5 + (o.quoteVol / maxQ) * 3.5, 1.2, 4.5);
        ctx.strokeStyle = o.side === 2 ? COLORS.green : COLORS.red; // side2 = bid, side1 = ask
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = thick;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(Math.min(plotR, x + len), y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // large trades: triangles at time & price
    if (showTrades) {
      const maxQ = Math.max(1, ...trades.map((t) => t.quoteVol));
      for (const t of trades) {
        const x = xOfTs((t.turnoverTime ?? t.createTime) / 1000);
        if (x < plotL || x > plotR) continue;
        const y = toPx(yScale, t.price);
        const r = clamp(2.5 + (t.quoteVol / maxQ) * 5, 2, 7);
        ctx.fillStyle = t.side === 2 ? COLORS.green : COLORS.red;
        ctx.beginPath();
        if (t.side === 2) {
          // aggressive buy: triangle up
          ctx.moveTo(x, y - r);
          ctx.lineTo(x - r, y + r);
          ctx.lineTo(x + r, y + r);
        } else {
          ctx.moveTo(x, y + r);
          ctx.lineTo(x - r, y - r);
          ctx.lineTo(x + r, y - r);
        }
        ctx.closePath();
        ctx.fill();
      }
    }

    // last price
    if (lastPrice && lastPrice > pLo && lastPrice < pHi) {
      const y = toPx(yScale, lastPrice);
      ctx.strokeStyle = COLORS.accent;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(plotL, y);
      ctx.lineTo(plotR, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ----- imbalance pane -----
    if (showImbalance && lastPrice) {
      const imbT = plotB + 14;
      const imbB = H - TIME_H;
      const imbMid = (imbT + imbB) / 2;
      ctx.strokeStyle = COLORS.axis;
      ctx.strokeRect(plotL + 0.5, imbT + 0.5, plotW, imbB - imbT);
      drawGridLine(ctx, plotL, imbMid, plotR, imbMid);
      ctx.fillStyle = COLORS.text;
      ctx.font = "9px ui-monospace, monospace";
      ctx.textAlign = "left";
      ctx.fillText("Wall imbalance ±" + imbalanceWindowPct + "%", plotL + 4, imbT + 10);

      const win = lastPrice * (imbalanceWindowPct / 100);
      // sample per candle bar
      ctx.beginPath();
      let started = false;
      const pts: { x: number; v: number }[] = [];
      for (let vi = 0; vi < count; vi++) {
        const i = start + vi;
        if (i >= candles.length) break;
        if (!candles[i]) continue;
        const ts = candles[i].ts;
        let bid = 0;
        let ask = 0;
        for (const o of orders) {
          if (Math.abs(o.price - lastPrice) > win) continue;
          const placed = o.createTime / 1000 <= ts + 900;
          if (!placed) continue;
          if (o.side === 2) bid += o.quoteVol;
          else ask += o.quoteVol;
        }
        const v = bid + ask > 0 ? (bid - ask) / (bid + ask) : 0;
        pts.push({ x: plotL + vi * barW + barW / 2, v });
      }
      const yOfV = (v: number) => imbMid - (v / 1) * ((imbB - imbT) / 2 - 4);
      for (const p of pts) {
        if (!started) {
          ctx.moveTo(p.x, yOfV(p.v));
          started = true;
        } else ctx.lineTo(p.x, yOfV(p.v));
      }
      ctx.strokeStyle = "#e8a33d";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      // zero fill
      ctx.lineTo(pts.length ? pts[pts.length - 1].x : plotL, imbMid);
      ctx.lineTo(pts.length ? pts[0].x : plotL, imbMid);
      ctx.closePath();
      ctx.fillStyle = "rgba(232,163,61,0.12)";
      ctx.fill();
    }

    // crosshair
    if (hover) {
      ctx.strokeStyle = "rgba(230,237,243,0.35)";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hover.x, plotT);
      ctx.lineTo(hover.x, plotB);
      ctx.moveTo(plotL, hover.y);
      ctx.lineTo(plotR, hover.y);
      ctx.stroke();
      ctx.setLineDash([]);
      const hp = fromPx(yScale, hover.y);
      ctx.fillStyle = "#2a313d";
      const txt = fmtPrice(hp);
      ctx.font = "10px ui-monospace, monospace";
      const tw = ctx.measureText(txt).width + 8;
      ctx.fillRect(W - AXIS_W + 2, hover.y - 8, tw, 16);
      ctx.fillStyle = COLORS.textBright;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(txt, W - AXIS_W + 6, hover.y);
    }

    ctx.strokeStyle = COLORS.axis;
    ctx.strokeRect(plotL + 0.5, plotT + 0.5, plotW, plotH);
  }, [size, view, candles, orders, trades, lastPrice, showWalls, showTrades, showImbalance, imbalanceWindowPct, hover]);

  useEffect(() => {
    draw();
  }, [draw]);

  // native NON-PASSIVE wheel listener (React 19 passive onWheel makes
  // preventDefault a no-op — page would scroll while the chart zooms)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setView((v) => {
        if (!v || !candles.length) return v;
        const factor = e.deltaY > 0 ? 1.15 : 0.87;
        // keep indices integral: fractional i makes candles[i] undefined
        const count = Math.round(clamp(v.count * factor, 12, Math.min(400, candles.length)));
        const anchor = v.count / 2;
        const start = Math.round(
          clamp(v.start + anchor * (1 - count / v.count), 0, Math.max(0, candles.length - count))
        );
        return { ...v, count, start };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [candles.length]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!view) return;
      const zone: "pan" | "vzoom" | "hzoom" =
        e.nativeEvent.offsetX >= size.w - AXIS_W - 6
          ? "vzoom"
          : e.nativeEvent.offsetY >= size.h - TIME_H
            ? "hzoom"
            : "pan";
      const priceH = Math.max(1, size.h - TIME_H - (showImbalance ? IMB_H : 0) - 8);
      const anchorP = view.pHi - ((e.nativeEvent.offsetY - 8) / priceH) * (view.pHi - view.pLo);
      drag.current = {
        x: e.clientX,
        y: e.clientY,
        start: view.start,
        count: view.count,
        pLo: view.pLo,
        pHi: view.pHi,
        mode: zone,
        anchorP,
      };
      setCursor(zone === "vzoom" ? "ns-resize" : zone === "hzoom" ? "ew-resize" : "grabbing");
    },
    [view, size, showImbalance]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const el = canvasRef.current;
      if (!el || !view || !candles.length) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setHover({ x, y });
      const d = drag.current;
      if (!d) {
        const zone = x >= size.w - AXIS_W - 6 ? "vzoom" : y >= size.h - TIME_H ? "hzoom" : "pan";
        setCursor(zone === "vzoom" ? "ns-resize" : zone === "hzoom" ? "ew-resize" : "crosshair");
        return;
      }
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      const plotL = 8;
      const plotR = size.w - AXIS_W - 6;
      const barW = (plotR - plotL) / d.count;
      if (d.mode === "vzoom") {
        // TradingView price-scale drag: zoom anchored at the grab price
        const range = d.pHi - d.pLo;
        const f = Math.exp(dy * 0.0045);
        const newRange = clamp(range * f, Math.max(d.pLo, 1e-9) * 1e-4, range * 500);
        const priceH = Math.max(1, size.h - TIME_H - (showImbalance ? IMB_H : 0) - 8);
        const frac = clamp((d.y - rect.top - 8) / priceH, 0, 1);
        const pHi = d.anchorP + frac * newRange;
        setView({ ...view, pHi, pLo: pHi - newRange });
      } else if (d.mode === "hzoom") {
        // time-axis drag: bar-count scaling anchored at the right edge
        const end = d.start + d.count;
        const count = Math.round(clamp(d.count * Math.exp(-dx * 0.0045), 12, Math.min(400, candles.length)));
        const start = clamp(Math.round(end - count), 0, Math.max(0, candles.length - count));
        setView({ ...view, start, count });
      } else {
        const shift = Math.round(dx / barW);
        const start = Math.round(clamp(d.start - shift, 0, Math.max(0, candles.length - view.count)));
        const plotH = Math.max(1, size.h - TIME_H - (showImbalance ? IMB_H : 0) - 16);
        const priceShift = (dy / plotH) * (d.pHi - d.pLo);
        setView({ ...view, start, pLo: d.pLo + priceShift, pHi: d.pHi + priceShift });
      }
    },
    [view, candles.length, size, showImbalance]
  );

  const onMouseUp = useCallback(() => {
    drag.current = null;
    setCursor("crosshair");
  }, []);

  const onDoubleClick = useCallback(() => setView(defaultView), [defaultView]);

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        style={{ width: "100%", height: "100%", cursor, outline: "none" }}
        tabIndex={0}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => {
          drag.current = null;
          setHover(null);
          setCursor("crosshair");
        }}
        onDoubleClick={onDoubleClick}
      />
      <div className="pointer-events-none absolute right-3 top-2 text-[10px] text-neutral-500">
        drag = pan · wheel = zoom · drag price/time axis = scale · dbl-click = reset
      </div>
    </div>
  );
}
