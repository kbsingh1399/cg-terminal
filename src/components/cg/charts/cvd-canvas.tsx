"use client";

import { useEffect, useRef } from "react";
import { COLORS, drawGridLine, makeScale, niceStep, setupHiDPI, toPx, type Scale } from "./chart-utils";

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
 */
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

    const { candles, perp, spot, total, delta, ratio, divergences, n } = model;
    if (!n || !candles.length) return;

    const padL = 8;
    const padR = 78;
    const padT = 10;
    const padB = 22;

    const hMain = showDelta && showRatio ? H * 0.56 : showDelta || showRatio ? H * 0.7 : H * 0.92;
    const subH = showDelta && showRatio ? H * 0.17 : showDelta || showRatio ? H * 0.2 : 0;
    const mainTop = padT;
    const mainBot = padT + hMain - padB * 0.4;
    const plotW = W - padL - padR;

    const cvd = mode === "perp" ? perp : mode === "spot" ? spot : total;
    const t0 = candles[0][0];
    const t1 = candles[candles.length - 1][0];
    const xOf = (t: number) => padL + ((t - t0) / Math.max(1, t1 - t0)) * plotW;
    const bw = Math.max(1, plotW / n);

    // ---- main pane: candles + CVD ----
    let pLo = Infinity;
    let pHi = -Infinity;
    for (const c of candles) {
      pLo = Math.min(pLo, c[3]);
      pHi = Math.max(pHi, c[2]);
    }
    const syP: Scale = makeScale(pLo, pHi, mainBot, mainTop);
    const yP = (p: number) => toPx(syP, p);

    const step = niceStep(pHi - pLo, 6);
    ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
    for (let p = Math.ceil(pLo / step) * step; p <= pHi; p += step) {
      const yy = yP(p);
      drawGridLine(ctx, padL, yy, padL + plotW, yy);
      ctx.fillStyle = COLORS.text;
      ctx.fillText(p.toLocaleString("en-US", { minimumFractionDigits: priceDecs, maximumFractionDigits: priceDecs }), padL + plotW + 8, yy + 3);
    }

    candles.forEach((c, i) => {
      const x = padL + bw * (i + 0.5);
      const up = c[4] >= c[1];
      ctx.strokeStyle = up ? COLORS.green : COLORS.red;
      ctx.fillStyle = up ? COLORS.green : COLORS.red;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, yP(c[3]));
      ctx.lineTo(x, yP(c[2]));
      ctx.stroke();
      const yo = yP(c[1]);
      const yc = yP(c[4]);
      ctx.fillRect(x - bw * 0.35, Math.min(yo, yc), Math.max(1, bw * 0.7), Math.max(1, Math.abs(yc - yo)));
    });

    // CVD line (right sub-scale, its own axis like the page's normalized view)
    let cLo = Infinity;
    let cHi = -Infinity;
    for (const v of cvd) {
      if (!Number.isFinite(v)) continue;
      cLo = Math.min(cLo, v);
      cHi = Math.max(cHi, v);
    }
    const cPad = (cHi - cLo) * 0.08 || 1;
    cLo -= cPad;
    cHi += cPad;
    const syC: Scale = makeScale(cLo, cHi, mainBot, mainTop);
    ctx.strokeStyle = "#58a6ff";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    let started = false;
    cvd.forEach((v, i) => {
      if (!Number.isFinite(v)) return;
      const x = padL + bw * (i + 0.5);
      const yy = toPx(syC, v);
      if (!started) {
        ctx.moveTo(x, yy);
        started = true;
      } else ctx.lineTo(x, yy);
    });
    ctx.stroke();
    // CVD zero line
    const zy = toPx(syC, 0);
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = "rgba(88,166,255,0.4)";
    ctx.beginPath();
    ctx.moveTo(padL, zy);
    ctx.lineTo(padL + plotW, zy);
    ctx.stroke();
    ctx.setLineDash([]);
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
    ctx.fillText(fmtCvd(cHi), padL + plotW + 8, mainTop + 8);
    ctx.fillText(fmtCvd(cLo), padL + plotW + 8, mainBot - 2);

    // divergence markers
    for (const d of divergences) {
      const [a, b, c] = d.bars;
      if (c >= n) continue;
      const xb = padL + bw * (b + 0.5);
      const xa = padL + bw * (a + 0.5);
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
    if (showDelta && subH > 0) {
      const dTop = mainBot + 14;
      const dBot = dTop + subH;
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(padL, dTop, plotW, subH);
      ctx.fillStyle = COLORS.text;
      ctx.fillText("Delta (M USD)", padL + 4, dTop + 11);
      const dMax = Math.max(1, ...delta.map((d) => Math.abs(d)));
      const y0 = dTop + subH / 2;
      delta.forEach((d, i) => {
        if (!d) return;
        const x = padL + bw * i;
        const h = (Math.abs(d) / dMax) * (subH / 2 - 4);
        ctx.fillStyle = d >= 0 ? "rgba(14,203,129,0.7)" : "rgba(246,70,93,0.7)";
        ctx.fillRect(x, d >= 0 ? y0 - h : y0, Math.max(1, bw * 0.8), h);
      });
      drawGridLine(ctx, padL, y0, padL + plotW, y0);
    }

    // ---- ratio pane ----
    if (showRatio && subH > 0) {
      const dTop = mainBot + 14 + (showDelta ? subH + 6 : 0);
      const dBot = dTop + subH;
      if (dBot < H - padB + 10) {
        ctx.fillStyle = "rgba(255,255,255,0.03)";
        ctx.fillRect(padL, dTop, plotW, subH);
        ctx.fillStyle = COLORS.text;
        ctx.fillText("Taker buy share", padL + 4, dTop + 11);
        const syR: Scale = makeScale(0.35, 0.65, dBot, dTop);
        ctx.strokeStyle = "#d29922";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        let st = false;
        ratio.forEach((v, i) => {
          if (v == null || !Number.isFinite(v)) return;
          const x = padL + bw * (i + 0.5);
          const yy = toPx(syR, v);
          if (!st) {
            ctx.moveTo(x, yy);
            st = true;
          } else ctx.lineTo(x, yy);
        });
        ctx.stroke();
        const yHalf = toPx(syR, 0.5);
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = "rgba(210,153,34,0.4)";
        ctx.beginPath();
        ctx.moveTo(padL, yHalf);
        ctx.lineTo(padL + plotW, yHalf);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // time axis
    for (let i = 0; i <= 6; i++) {
      const t = t0 + ((t1 - t0) * i) / 6;
      const x = xOf(t);
      drawGridLine(ctx, x, padT, x, mainBot);
      const d = new Date(t);
      const label = i === 0 || i === 6
        ? `${d.getMonth() + 1}/${d.getDate()}`
        : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      ctx.fillStyle = COLORS.text;
      ctx.fillText(label, x - 14, H - 8);
    }
  }, [model, mode, showDelta, showRatio]);

  return <canvas ref={ref} style={{ width: "100%", height }} className="rounded-md" />;
}
