"use client";

import { useEffect, useRef, useState } from "react";
import { COLORS, drawGridLine, makeScale, niceStep, setupHiDPI, toPx, type Scale } from "./chart-utils";

export interface StopmapModel {
  candles: { ts: number; o: number; h: number; l: number; c: number }[];
  y: number[];
  grid: { ts: number; cells: [number, number][] }[];
  profile: number[];
  lastPrice: number;
  clusters: { below: { price: number; usd: number; distPct: number }[]; above: { price: number; usd: number; distPct: number }[] };
}

/**
 * Liquidation-heatmap canvas — the Coinglass "Liquidation Heatmap" look:
 * heat cells (bar × price level), price line on top, and the cumulative
 * cluster profile on the right edge (their rainbow heatmap view).
 */
export default function StopmapCanvas({
  model,
  height = 360,
  priceDecs = 1,
}: {
  model: StopmapModel;
  height?: number;
  /** per-asset price decimals (assetOf(sym).priceDecs) for axis/tag labels */
  priceDecs?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  // redraw on container resize (see cvd-canvas for rationale)
  const [resizeTick, setResizeTick] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setResizeTick((t) => t + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = setupHiDPI(canvas);
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(50, Math.floor(rect.width));
    const H = Math.max(50, Math.floor(rect.height));

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    const { candles, y, grid, profile, lastPrice } = model;
    if (!candles.length || !y.length) return;

    const padL = 8;
    const padR = 96;
    const padT = 10;
    const padB = 22;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const t0 = candles[0].ts;
    const t1 = candles[candles.length - 1].ts;
    const xOf = (t: number) => padL + ((t - t0) / Math.max(1, t1 - t0)) * plotW;

    const yLo = y[0];
    const yHi = y[y.length - 1];
    const sy: Scale = makeScale(yLo, yHi, padT + plotH, padT);
    const yOf = (p: number) => toPx(sy, p);

    // heat cells
    const maxCell = Math.max(1, ...grid.flatMap((g) => g.cells.map((c) => c[1])));
    const rowH = Math.max(1, plotH / y.length);
    for (const bar of grid) {
      const x = xOf(bar.ts);
      const bw = Math.max(1.5, plotW / candles.length);
      for (const [yi, usd] of bar.cells) {
        const p = y[yi];
        if (p == null) continue;
        const intensity = Math.min(1, Math.pow(usd / maxCell, 0.42));
        const yy = yOf(p);
        ctx.fillStyle = heatColor(intensity, p < lastPrice);
        ctx.fillRect(x - bw / 2, yy - rowH / 2 - 0.5, bw, rowH + 1);
      }
    }

    // price grid + labels
    const step = niceStep(yHi - yLo, 8);
    ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
    for (let p = Math.ceil(yLo / step) * step; p <= yHi; p += step) {
      const yy = yOf(p);
      drawGridLine(ctx, padL, yy, padL + plotW, yy);
      ctx.fillStyle = COLORS.text;
      ctx.fillText(p.toLocaleString("en-US", { minimumFractionDigits: priceDecs, maximumFractionDigits: priceDecs }), padL + plotW + 8, yy + 3);
    }

    // time labels
    const nT = 6;
    for (let i = 0; i <= nT; i++) {
      const t = t0 + ((t1 - t0) * i) / nT;
      const x = xOf(t);
      drawGridLine(ctx, x, padT, x, padT + plotH);
      const d = new Date(t);
      ctx.fillStyle = COLORS.text;
      ctx.fillText(
        `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`,
        x - 14,
        H - 8
      );
    }

    // price line (close)
    ctx.strokeStyle = "#e8e8e8";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    candles.forEach((c, i) => {
      const x = xOf(c.ts);
      const yy = yOf(c.c);
      if (i === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    });
    ctx.stroke();

    // last price marker
    const ly = yOf(lastPrice);
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = "rgba(232,232,232,0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, ly);
    ctx.lineTo(padL + plotW, ly);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#e8e8e8";
    ctx.fillRect(padL + plotW + 2, ly - 8, padR - 6, 16);
    ctx.fillStyle = "#000";
    ctx.font = "bold 10px ui-monospace, monospace";
    ctx.fillText(lastPrice.toLocaleString("en-US", { minimumFractionDigits: priceDecs, maximumFractionDigits: priceDecs }), padL + plotW + 6, ly + 4);

    // cumulative cluster profile on the right edge
    const maxProfile = Math.max(1, ...profile);
    const profW = 60;
    for (let i = 0; i < y.length; i++) {
      if (profile[i] <= 0) continue;
      const w = (profile[i] / maxProfile) * profW;
      const yy = yOf(y[i]);
      ctx.fillStyle = y[i] < lastPrice ? "rgba(14,203,129,0.55)" : "rgba(246,70,93,0.55)";
      ctx.fillRect(padL + plotW + 20 - w, yy - rowH / 2 - 0.5, w, rowH + 1);
    }

    // top cluster markers
    for (const cl of [...model.clusters.below.slice(0, 3), ...model.clusters.above.slice(0, 3)]) {
      const yy = yOf(cl.price);
      ctx.strokeStyle = cl.price < lastPrice ? COLORS.green : COLORS.red;
      ctx.setLineDash([2, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, yy);
      ctx.lineTo(padL + plotW, yy);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [model, resizeTick]);

  return <canvas ref={ref} style={{ width: "100%", height }} className="rounded-md" />;
}

/** their heatmap palette: dark → purple → blue → cyan → yellow (below) / red variant */
function heatColor(intensity: number, below: boolean): string {
  if (intensity < 0.03) return "rgba(255,255,255,0.02)";
  const stops: [number, number, number, number][] = below
    ? [
        [10, 14, 20, 0.15],
        [30, 40, 90, 0.55],
        [24, 110, 180, 0.75],
        [22, 200, 190, 0.85],
        [250, 210, 60, 0.95],
      ]
    : [
        [10, 14, 20, 0.15],
        [70, 25, 80, 0.55],
        [150, 40, 110, 0.75],
        [220, 80, 90, 0.85],
        [250, 150, 60, 0.95],
      ];
  const t = Math.min(0.999, Math.max(0, intensity)) * (stops.length - 1);
  const i = Math.floor(t);
  const f = t - i;
  const a = stops[i];
  const b = stops[Math.min(stops.length - 1, i + 1)];
  const r = Math.round(a[0] + (b[0] - a[0]) * f);
  const g = Math.round(a[1] + (b[1] - a[1]) * f);
  const bl = Math.round(a[2] + (b[2] - a[2]) * f);
  const al = a[3] + (b[3] - a[3]) * f;
  return `rgba(${r},${g},${bl},${al.toFixed(3)})`;
}
