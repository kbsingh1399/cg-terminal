"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Candle } from "../use-cg-data";
import type { LiquidationLevel } from "@/lib/cg/types";
import { COLORS, clamp, drawGridLine, fromPx, makeScale, niceStep, setupHiDPI, toPx } from "./chart-utils";
import { fmtNum, fmtPrice, fmtUsd } from "@/lib/cg/format";

interface Props {
  candles: Candle[];
  levels: LiquidationLevel[];
  lastPrice: number | null;
  tiers: Record<string, boolean>; // { h1: true, h2: true, h3: true }
  range: string; // 3d | 7d | 30d
}

const AXIS_W = 64;
const TIME_H = 22;

/** A level line: starts at its opening bar and runs right until swept by price. */
interface Seg {
  level: LiquidationLevel;
  xStart: number; // bar index float
  xEnd: number; // bar index float (swept) or live edge
  swept: boolean;
}

export default function LiqLevelsCanvas({ candles, levels, lastPrice, tiers, range }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 560 });
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; lines: string[] } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Map levels to chart segments using candle sweep detection
  const segs = useMemo<Seg[]>(() => {
    if (!candles.length || !levels.length) return [];
    const ts0 = candles[0].ts;
    const step = candles.length > 1 ? candles[1].ts - candles[0].ts : 900;
    const out: Seg[] = [];
    for (const lv of levels) {
      if (!tiers[lv.level2]) continue;
      const startIdx = clamp((lv.beginDate - ts0) / step, 0, candles.length - 1);
      // find sweep: first candle after start whose range touches the price
      let endIdx = candles.length - 1;
      let swept = false;
      for (let i = Math.ceil(startIdx); i < candles.length; i++) {
        const c = candles[i];
        if (lv.side === 2 ? c.h >= lv.price : c.l <= lv.price) {
          endIdx = i;
          swept = true;
          break;
        }
      }
      out.push({ level: lv, xStart: startIdx, xEnd: endIdx, swept });
    }
    return out;
  }, [candles, levels, tiers]);

  const bounds = useMemo(() => {
    if (!candles.length) return null;
    const count = Math.min(candles.length, range === "3d" ? 288 : range === "7d" ? 400 : 600);
    const start = Math.max(0, candles.length - count);
    let pLo = Infinity;
    let pHi = -Infinity;
    for (let i = start; i < candles.length; i++) {
      pLo = Math.min(pLo, candles[i].l);
      pHi = Math.max(pHi, candles[i].h);
    }
    // include significant liquidation clusters within ±12%
    if (lastPrice) {
      const band = 0.12;
      for (const s of segs) {
        if (Math.abs(s.level.price - lastPrice) / lastPrice < band) {
          pLo = Math.min(pLo, s.level.price);
          pHi = Math.max(pHi, s.level.price);
        }
      }
    }
    const pad = (pHi - pLo) * 0.05 || 1;
    return { start, count, pLo: pLo - pad, pHi: pHi + pad };
  }, [candles, segs, lastPrice, range]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = setupHiDPI(canvas);
    if (!ctx) return;
    const W = size.w;
    const H = size.h;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    if (!candles.length || !bounds) return;

    const plotL = 8;
    const plotR = W - AXIS_W - 6;
    const plotT = 8;
    const plotB = H - TIME_H;
    const plotW = plotR - plotL;
    const plotH = plotB - plotT;
    const { start, count, pLo, pHi } = bounds;
    const barW = plotW / count;
    const yScale = makeScale(pHi, pLo, plotT, plotB);
    const xOfIdx = (i: number) => plotL + (i - start) * barW;

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
    const labelEvery = Math.max(1, Math.round(90 / barW));
    for (let vi = 0; vi < count; vi++) {
      const i = start + vi;
      if (i >= candles.length) break;
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

    // size normalization
    const maxSize = Math.max(1, ...segs.map((s) => s.level.size));

    // liquidation level lines (draw before candles, semi-transparent)
    for (const s of segs) {
      const lv = s.level;
      const y = toPx(yScale, lv.price);
      if (y < plotT - 2 || y > plotB + 2) continue;
      const x0 = Math.max(plotL, xOfIdx(s.xStart));
      const x1 = Math.min(plotR, xOfIdx(s.xEnd + 1));
      if (x1 <= plotL || x0 >= plotR) continue;
      const strength = lv.size / maxSize;
      const isShort = lv.side === 2; // short liquidations above price
      const base = isShort ? "246,70,93" : "14,203,129";
      const alpha = (s.swept ? 0.18 : 0.25 + strength * 0.65).toFixed(3);
      ctx.strokeStyle = `rgba(${base},${alpha})`;
      ctx.lineWidth = clamp(1 + strength * 2.4, 1, 3.2);
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
    }

    // candles on top
    const cw = Math.max(2, barW * 0.6);
    for (let vi = 0; vi < count; vi++) {
      const i = start + vi;
      if (i >= candles.length) break;
      const c = candles[i];
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
      const tw = ctx.measureText(txt).width + 8;
      ctx.fillRect(W - AXIS_W + 2, hover.y - 8, tw, 16);
      ctx.fillStyle = COLORS.textBright;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(txt, W - AXIS_W + 6, hover.y);
    }

    ctx.strokeStyle = COLORS.axis;
    ctx.strokeRect(plotL + 0.5, plotT + 0.5, plotW, plotH);
  }, [size, candles, bounds, segs, hover, lastPrice]);

  useEffect(() => {
    draw();
  }, [draw]);

  // tooltip computed in the event handler (no state mutation inside draw)
  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setHover({ x, y });
      if (!bounds) {
        setTip(null);
        return;
      }
      const plotT = 8;
      const plotB = size.h - TIME_H;
      const yScale = makeScale(bounds.pHi, bounds.pLo, plotT, plotB);
      let best: Seg | null = null;
      let bestDy = Infinity;
      for (const s of segs) {
        const dy = Math.abs(toPx(yScale, s.level.price) - y);
        if (dy < bestDy && dy < 14) {
          bestDy = dy;
          best = s;
        }
      }
      if (best) {
        const lv = best.level;
        setTip({
          x,
          y,
          lines: [
            `${lv.side === 2 ? "Short" : "Long"} liquidations · ${lv.level2.toUpperCase()}`,
            `Price ${fmtPrice(lv.price)}`,
            `Est. size ${fmtNum(lv.size, 1)} BTC`,
            `Opened ${new Date(lv.beginDate * 1000).toISOString().slice(5, 16).replace("T", " ")} UTC`,
            best.swept ? "Swept" : "Open",
          ],
        });
      } else {
        setTip(null);
      }
    },
    [bounds, segs, size.h]
  );

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-crosshair"
        onMouseMove={onMouseMove}
        onMouseLeave={() => {
          setHover(null);
          setTip(null);
        }}
      />
      {tip && (
        <div
          className="pointer-events-none absolute z-10 rounded border border-neutral-700 bg-neutral-900/95 px-2.5 py-2 text-[11px] leading-relaxed text-neutral-200 shadow-lg"
          style={{ left: Math.min(tip.x + 12, size.w - 180), top: Math.max(8, tip.y - 60) }}
        >
          {tip.lines.map((l, i) => (
            <div key={i} className={i === 0 ? "font-semibold" : ""}>
              {l}
            </div>
          ))}
        </div>
      )}
      <div className="pointer-events-none absolute right-3 top-2 text-[10px] text-neutral-500">
        lines above price = short liquidations (red) · below = long liquidations (green) · brightness = intensity
      </div>
    </div>
  );
}
