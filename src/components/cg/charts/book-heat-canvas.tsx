"use client";

import { useEffect, useRef } from "react";
import { COLORS, drawGridLine, makeScale, niceStep, setupHiDPI, toPx, type Scale } from "./chart-utils";

export interface StripModel {
  strip: { t: number; mid: number; cells: [number, number][] }[];
  ladder: { price: number; qty: number; usd: number; side: "b" | "a" }[];
  last: { price: number; bid: number; ask: number };
  walls: { side: "b" | "a"; price: number; usd: number }[];
}

export interface LiveOverlay {
  /** real-time WS price (last trade) */
  price: number;
  /** real-time book column: resting USD per price bucket, updates ~1.5 s */
  cells: [number, number][];
  /** live near-book ladder (Binance top-1000) */
  ladder: { price: number; qty: number; usd: number; side: "b" | "a" }[];
  /** ms — how fresh the live column is */
  at: number;
}

/**
 * Order-book heat strip (time → price, intensity = resting USD) with the
 * current ladder profile on the right edge — the Coinglass LiquidityHeatmap
 * look in compact form.
 *
 * `live` adds the REAL-TIME layer: the live Binance book column pinned to
 * the right edge (bright border), the mid line extended to the live WS
 * price, and the near-book ladder drawn bright on top of the dim aggregate
 * profile.
 */
export default function BookHeatCanvas({
  model,
  height = 300,
  priceDecs = 1,
  live = null,
}: {
  model: StripModel;
  height?: number;
  /** per-asset price decimals (assetOf(sym).priceDecs) for axis/tag labels */
  priceDecs?: number;
  live?: LiveOverlay | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

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

    const { strip, ladder, last, walls } = model;
    if (!strip.length) return;

    const padL = 8;
    const padR = 110;
    const padT = 10;
    const padB = 20;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const prices = strip.flatMap((s) => s.cells.map((c) => c[0]));
    if (live) prices.push(live.price, ...live.cells.map((c) => c[0]));
    let yLo = Math.min(...prices, last.price);
    let yHi = Math.max(...prices, last.price);
    const pad = (yHi - yLo) * 0.04;
    yLo -= pad;
    yHi += pad;
    const sy: Scale = makeScale(yLo, yHi, padT + plotH, padT);
    const yOf = (p: number) => toPx(sy, p);

    const t0 = strip[0].t;
    const t1 = strip[strip.length - 1].t;
    const xOf = (t: number) => padL + ((t - t0) / Math.max(1, t1 - t0)) * plotW;
    const bw = Math.max(1.5, plotW / strip.length);
    const edgeX = padL + plotW;

    const maxCell = Math.max(1, ...strip.flatMap((s) => s.cells.map((c) => c[1])), ...(live ? live.cells.map((c) => c[1]) : []));
    for (const s of strip) {
      const x = xOf(s.t);
      for (const [price, usd] of s.cells) {
        const k = Math.min(1, Math.pow(usd / maxCell, 0.5));
        ctx.fillStyle = `rgba(${Math.round(30 + 130 * k)},${Math.round(60 + 60 * k)},${Math.round(220 - 60 * k)},${(0.25 + 0.65 * k).toFixed(3)})`;
        const yy = yOf(price);
        ctx.fillRect(x - bw / 2, yy - 2, bw, 4.5);
      }
    }

    // mid line — historical, then extended to the REAL-TIME price at the edge
    ctx.strokeStyle = "rgba(232,232,232,0.75)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    strip.forEach((s, i) => {
      const x = xOf(s.t);
      const yy = yOf(s.mid);
      if (i === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    });
    ctx.stroke();
    if (live) {
      const lastMid = strip[strip.length - 1].mid;
      const grad = ctx.createLinearGradient(edgeX - Math.min(90, plotW * 0.1), 0, edgeX, 0);
      grad.addColorStop(0, "rgba(232,232,232,0.75)");
      grad.addColorStop(1, "rgba(52,211,153,0.95)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(edgeX - Math.min(90, plotW * 0.1), yOf(lastMid));
      ctx.lineTo(edgeX, yOf(live.price));
      ctx.stroke();
    }

    // walls markers
    for (const w of walls.slice(0, 12)) {
      const yy = yOf(w.price);
      ctx.strokeStyle = w.side === "b" ? "rgba(14,203,129,0.85)" : "rgba(246,70,93,0.85)";
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, yy);
      ctx.lineTo(edgeX, yy);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // LIVE book column pinned to the right edge (Binance top-1000, ~1.5 s)
    if (live && live.cells.length) {
      const lw = Math.max(bw * 0.9, 5);
      for (const [price, usd] of live.cells) {
        const k = Math.min(1, Math.pow(usd / maxCell, 0.5));
        ctx.fillStyle = `rgba(${Math.round(30 + 130 * k)},${Math.round(60 + 60 * k)},${Math.round(220 - 60 * k)},${(0.3 + 0.7 * k).toFixed(3)})`;
        const yy = yOf(price);
        ctx.fillRect(edgeX - lw, yy - 2, lw, 4.5);
      }
      ctx.strokeStyle = "rgba(52,211,153,0.8)";
      ctx.lineWidth = 1;
      ctx.strokeRect(edgeX - lw - 1.5, padT, lw + 3, plotH);
      ctx.fillStyle = "rgba(52,211,153,0.95)";
      ctx.font = "bold 8px ui-monospace, monospace";
      ctx.fillText("LIVE", edgeX - lw - 1.5, padT - 2);
    }

    // ladder profile (right edge): aggregate dim, live bright on top
    const maxUsd = Math.max(1, ...ladder.map((l) => l.usd), ...(live ? live.ladder.map((l) => l.usd) : []));
    const profW = 72;
    ctx.globalAlpha = live ? 0.45 : 0.9;
    for (const l of ladder) {
      const w = (l.usd / maxUsd) * profW;
      const yy = yOf(l.price);
      ctx.fillStyle = l.side === "b" ? "rgba(14,203,129,0.5)" : "rgba(246,70,93,0.5)";
      ctx.fillRect(padL + plotW + 18 - w, yy - 1.2, w, 2.6);
    }
    ctx.globalAlpha = 1;
    if (live) {
      for (const l of live.ladder) {
        const w = (l.usd / maxUsd) * profW;
        const yy = yOf(l.price);
        ctx.fillStyle = l.side === "b" ? "rgba(16,224,143,0.95)" : "rgba(255,90,110,0.95)";
        ctx.fillRect(padL + plotW + 18 - w, yy - 1.2, w, 2.6);
      }
    }

    // price axis
    const step = niceStep(yHi - yLo, 7);
    ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
    for (let p = Math.ceil(yLo / step) * step; p <= yHi; p += step) {
      const yy = yOf(p);
      drawGridLine(ctx, padL, yy, edgeX, yy);
      ctx.fillStyle = COLORS.text;
      ctx.fillText(p.toLocaleString("en-US", { minimumFractionDigits: priceDecs, maximumFractionDigits: priceDecs }), padL + plotW + 6, yy + 3);
    }

    // time labels
    for (let i = 0; i <= 5; i++) {
      const t = t0 + ((t1 - t0) * i) / 5;
      const x = xOf(t);
      drawGridLine(ctx, x, padT, x, padT + plotH);
      const d = new Date(t);
      ctx.fillStyle = COLORS.text;
      ctx.fillText(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`, x - 12, H - 6);
    }

    // last price tag — REAL-TIME when the live layer is on
    const tagPrice = live ? live.price : last.price;
    const ly = yOf(tagPrice);
    ctx.fillStyle = live ? "#10e08f" : "#e8e8e8";
    ctx.fillRect(padL + plotW + 2, ly - 8, 60, 16);
    ctx.fillStyle = "#000";
    ctx.font = "bold 10px ui-monospace, monospace";
    ctx.fillText(tagPrice.toLocaleString("en-US", { minimumFractionDigits: priceDecs, maximumFractionDigits: priceDecs }), padL + plotW + 6, ly + 4);
  }, [model, priceDecs, live]);

  return <canvas ref={ref} style={{ width: "100%", height }} className="rounded-md" />;
}
