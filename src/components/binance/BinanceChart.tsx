"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { COLORS, drawGridLine, makeScale, niceStep, setupHiDPI, toPx } from "@/components/cg/charts/chart-utils";
import type { LiveBar } from "@/lib/binance/sym-feed";

/**
 * BinanceChart — real-time candlestick + volume canvas for the Binance tier.
 *
 * Bars bootstrap from /api/binance/klines (REST) and the LAST candle is then
 * kept live by the fstream kline WebSocket (updates on every trade, final
 * bars roll over) — the chart is never more than one trade behind the
 * exchange, at any interval. All drawing conventions (DPR, grid, palette)
 * match the terminal's other canvas charts.
 */

export interface Bar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export default function BinanceChart({
  bars: restBars,
  liveBar,
  interval,
  priceDecs,
  height = 380,
}: {
  bars: Bar[] | null;
  liveBar: LiveBar | null;
  interval: string;
  priceDecs: number;
  height?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [resizeTick, setResizeTick] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setResizeTick((t) => t + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const bars = useMemo(() => {
    const base = restBars ?? [];
    if (!liveBar) return base;
    const last = base[base.length - 1];
    if (last && last.t === liveBar.t) {
      const arr = base.slice();
      arr[arr.length - 1] = { t: liveBar.t, o: liveBar.o, h: liveBar.h, l: liveBar.l, c: liveBar.c, v: liveBar.v };
      return arr;
    }
    if (!last || liveBar.t > last.t) {
      return [...base, { t: liveBar.t, o: liveBar.o, h: liveBar.h, l: liveBar.l, c: liveBar.c, v: liveBar.v }];
    }
    return base; // stale frame (e.g. REST refetch just returned newer rows)
  }, [restBars, liveBar]);

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
    if (!bars || bars.length < 2) {
      ctx.fillStyle = COLORS.text;
      ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText("loading bars…", 12, 20);
      return;
    }

    const padL = 8;
    const padR = 76;
    const padT = 10;
    const padB = 20;
    const volH = (H - padT - padB) * 0.18;
    const priceBot = H - padB - volH;
    const plotW = W - padL - padR;
    const n = bars.length;
    const bw = plotW / n;

    let pLo = Infinity;
    let pHi = -Infinity;
    let vMax = 0;
    for (const b of bars) {
      pLo = Math.min(pLo, b.l);
      pHi = Math.max(pHi, b.h);
      vMax = Math.max(vMax, b.v);
    }
    const pad = (pHi - pLo) * 0.06 || pHi * 0.01 || 1;
    pLo -= pad;
    pHi += pad;
    const syP = makeScale(pLo, pHi, priceBot, padT);
    const yP = (p: number) => toPx(syP, p);

    ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
    const step = niceStep(pHi - pLo, 6);
    for (let p = Math.ceil(pLo / step) * step; p <= pHi; p += step) {
      const yy = yP(p);
      drawGridLine(ctx, padL, yy, padL + plotW, yy);
      ctx.fillStyle = COLORS.text;
      ctx.fillText(
        p.toLocaleString("en-US", { minimumFractionDigits: priceDecs, maximumFractionDigits: priceDecs }),
        padL + plotW + 8,
        yy + 3
      );
    }

    // time axis: UTC, every ~6th bar
    const daily = interval === "1d";
    const tStride = Math.max(1, Math.ceil(n / 6));
    ctx.fillStyle = COLORS.text;
    for (let i = 0; i < n; i += tStride) {
      const x = padL + bw * (i + 0.5);
      drawGridLine(ctx, x, padT, x, H - padB);
      const d = new Date(bars[i].t);
      const label = daily
        ? `${d.getUTCDate()} ${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })}`
        : `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
      ctx.fillText(label, x - 14, H - padB + 13);
    }

    // volume pane
    const volTop = priceBot + 4;
    bars.forEach((b, i) => {
      if (vMax <= 0) return;
      const x = padL + bw * (i + 0.5);
      const hV = (b.v / vMax) * (volH - 4);
      ctx.fillStyle = b.c >= b.o ? COLORS.greenDim : COLORS.redDim;
      ctx.fillRect(x - bw * 0.35, volTop + (volH - 4 - hV), Math.max(1, bw * 0.7), hV);
    });

    // candles
    bars.forEach((b, i) => {
      const x = padL + bw * (i + 0.5);
      const up = b.c >= b.o;
      ctx.strokeStyle = up ? COLORS.green : COLORS.red;
      ctx.fillStyle = up ? COLORS.green : COLORS.red;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, yP(b.h));
      ctx.lineTo(x, yP(b.l));
      ctx.stroke();
      const yo = yP(b.o);
      const yc = yP(b.c);
      ctx.fillRect(x - bw * 0.35, Math.min(yo, yc), Math.max(1, bw * 0.7), Math.max(1, Math.abs(yc - yo)));
    });

    // last-price line + tag (live-forming candle close)
    const lastC = bars[n - 1].c;
    const prevC = bars[n - 2]?.c ?? lastC;
    const yLast = yP(lastC);
    if (yLast > padT && yLast < priceBot) {
      ctx.strokeStyle = lastC >= prevC ? COLORS.green : COLORS.red;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(padL, yLast);
      ctx.lineTo(padL + plotW, yLast);
      ctx.stroke();
      ctx.setLineDash([]);
      const label = lastC.toLocaleString("en-US", { minimumFractionDigits: priceDecs, maximumFractionDigits: priceDecs });
      ctx.fillStyle = lastC >= prevC ? COLORS.green : COLORS.red;
      ctx.fillRect(padL + plotW + 2, yLast - 8, padR - 6, 16);
      ctx.fillStyle = "#0b0e11";
      ctx.fillText(label, padL + plotW + 8, yLast + 3);
    }
  }, [bars, interval, priceDecs, resizeTick, height]);

  return <canvas ref={ref} style={{ width: "100%", height }} aria-label="Binance live candles" />;
}
