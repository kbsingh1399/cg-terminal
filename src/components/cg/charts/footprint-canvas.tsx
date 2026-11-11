"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FpBar } from "@/lib/cg/cg-signals";
import { COLORS, clamp, drawGridLine, fromPx, makeScale, niceStep, setupHiDPI, toPx } from "./chart-utils";
import { fmtPrice } from "@/lib/cg/format";

export type FootprintMode = "volume" | "delta" | "trades" | "avgSize" | "bar";
export type FootprintUnit = "coin" | "usd";

export interface SignalMark {
  ts: number;
  dir: "bullish" | "bearish";
  type: string;
}

interface Props {
  bars: FpBar[];
  mode: FootprintMode;
  unit: FootprintUnit;
  imbalanceRatio: number; // e.g. 3 = 300%
  showProfile: boolean;
  resetKey: string; // changing this resets pan/zoom (e.g. bar-type switch)
  onHoverBar?: (bar: FpBar | null) => void;
  signals?: SignalMark[]; // markers drawn on the chart
  jump?: { ts: number; key: string } | null; // center view on this bar when key changes
  activeSignalTs?: number | null; // highlight this signal's bar
}

interface AggRow {
  pLo: number;
  pHi: number;
  buy: number;
  sell: number;
  buyCnt: number;
  sellCnt: number;
}

const AXIS_W = 64;
const TIME_H = 22;
const PROFILE_W = 150;
const BAR_GAP = 2;
const MIN_ROW_H = 15;

export default function FootprintCanvas({
  bars,
  mode,
  unit,
  imbalanceRatio,
  showProfile,
  resetKey,
  onHoverBar,
  signals,
  jump,
  activeSignalTs,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 560 });
  const [view, setView] = useState<{ start: number; count: number; pLo: number; pHi: number } | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; bi: number } | null>(null);
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
  // MEASURED GATE: the ResizeObserver hasn't fired during the first render,
  // so `size` is still the {900×560} fallback — initializing the view then
  // locks the width-aware bar count to the fallback width forever (the
  // `inited` flag never re-runs). Wait for a real measurement before the
  // first default view (review finding: defaultView was dead on arrival).
  const [measured, setMeasured] = useState(false);
  const [inited, setInited] = useState(false);
  // set on the first user pan/zoom/wheel: once the user has an opinion about
  // the viewport, the history-growth re-adopt must never steal it. (STATE,
  // not a ref — the render-adjust below reads it, and the React Compiler
  // forbids ref reads during render.)
  const [userTouched, setUserTouched] = useState(false);
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  const [lastJumpKey, setLastJumpKey] = useState("");

  // bar price extremes. Footprint rows MUST lie inside the candle range
  // (every trade of a bar prints within [low, high]) — upstream grids that
  // extend beyond it (garbage extents, e.g. a ladder reported from 0) are
  // clamped so one bad payload can never squash the y-scale to 0–90k.
  const merged = useMemo(
    () =>
      bars.map((b) => {
        let pLo = b.l;
        let pHi = b.h;
        if (b.fp && Number.isFinite(b.fp.lo) && b.fp.tick > 0) {
          const gridLo = Math.max(b.fp.lo, b.l);
          const gridHi = Math.min(b.fp.lo + b.fp.b.length * b.fp.tick, b.h);
          if (gridHi > gridLo) {
            pLo = Math.min(pLo, gridLo);
            pHi = Math.max(pHi, gridHi);
          }
        }
        return { ...b, pLo, pHi };
      }),
    [bars]
  );

  // default view: enough bars to keep footprint NUMBERS readable at the
  // current width (target ~58px per bar — Coinglass's default zoom shows the
  // buy/sell digits; a 40-bar default squeezed cells to ~25px and the chart
  // looked like a candle skeleton), full price range
  const defaultView = useMemo(() => {
    if (!merged.length) return null;
    const plotW = Math.max(240, size.w - (showProfile ? PROFILE_W + 20 : AXIS_W + 16));
    const count = Math.min(clamp(Math.floor(plotW / 58), 12, 28), merged.length);
    const start = Math.max(0, merged.length - count);
    let pLo = Infinity;
    let pHi = -Infinity;
    for (let i = start; i < merged.length; i++) {
      pLo = Math.min(pLo, merged[i].pLo);
      pHi = Math.max(pHi, merged[i].pHi);
    }
    const pad = (pHi - pLo) * 0.05 || 1;
    return { start, count, pLo: pLo - pad, pHi: pHi + pad };
  }, [merged, size.w, showProfile]);

  // render-adjust pattern: init/reset the viewport without effects.
  // HISTORY-GROWTH RE-ADOPT: the fast live lane (≤8 bars) often renders
  // before the heavy 300-bar history lands — a view initialized from it
  // stayed stuck at 8 bars forever (inited is one-way). Until the user
  // actually pans/zooms (userTouched), the view re-adopts the default
  // whenever the default count grows — the chart settles at the proper
  // width-aware zoom the moment history arrives.
  if ((!inited || (!userTouched && view && defaultView && defaultView.count > view.count)) && defaultView && measured) {
    setInited(true);
    setView(defaultView);
  }
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setUserTouched(false); // a bar-type/symbol switch is a fresh start
    setView(defaultView);
  }
  // jump-to-bar (signal click): center the view on the target bar
  if (jump && jump.key !== lastJumpKey && defaultView) {
    setLastJumpKey(jump.key);
    setUserTouched(true); // an explicit navigation is user intent
    const idx = merged.findIndex((b) => b.ts === jump.ts);
    if (idx >= 0) {
      setView((v) => {
        const count = Math.min(v?.count ?? defaultView.count, merged.length);
        const start = clamp(Math.round(idx - count / 2), 0, Math.max(0, merged.length - count));
        let pLo = v?.pLo ?? defaultView.pLo;
        let pHi = v?.pHi ?? defaultView.pHi;
        pLo = Math.min(pLo, merged[idx].pLo);
        pHi = Math.max(pHi, merged[idx].pHi);
        const pad = (pHi - pLo) * 0.05 || 1;
        return { start, count, pLo: pLo - pad, pHi: pHi + pad };
      });
    }
  }
  // live follow (render-adjust): the real-time forming bar must never clip —
  // when live prints extend past the visible price range (and the live bar
  // is actually on screen), expand it; when a new bar appends while the tail
  // is on screen, keep the tail on screen. Manual pan/zoom into history —
  // on EITHER axis — is never stolen.
  if (view && merged.length) {
    const last = merged[merged.length - 1];
    const liveOnScreen = view.start + view.count >= merged.length - 1;
    let { pLo, pHi, start, count } = view;
    let changed = false;
    if (liveOnScreen) {
      if (last.pLo < pLo) {
        pLo = last.pLo - (pHi - pLo) * 0.02;
        changed = true;
      }
      if (last.pHi > pHi) {
        const span = pHi - pLo;
        pHi = last.pHi + span * 0.02;
        changed = true;
      }
    }
    if (count < merged.length && start + count >= merged.length - 1 && start + count < merged.length) {
      start = Math.max(0, merged.length - count);
      changed = true;
    }
    if (changed) setView({ start, count, pLo, pHi });
  }

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
      setMeasured(true);
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    setMeasured(true);
    return () => ro.disconnect();
  }, []);

  const lastPrice = bars.length ? bars[bars.length - 1].c : null;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = setupHiDPI(canvas);
    if (!ctx) return;
    const W = size.w;
    const H = size.h;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    if (!merged.length || !view) return;

    const plotL = 8;
    const plotR = W - (showProfile ? PROFILE_W + 10 : AXIS_W + 6);
    const plotT = 8;
    const plotB = H - TIME_H;
    const plotW = plotR - plotL;
    const plotH = plotB - plotT;
    if (plotW < 60 || plotH < 60) return;

    const { start, count, pLo, pHi } = view;
    const barW = plotW / count;
    const cellW = Math.max(4, barW - BAR_GAP);

    // ----- aggregate price rows so text fits -----
    const priceRange = pHi - pLo;
    // native tick from the visible bars
    const bucketSize = (() => {
      for (let i = start; i < Math.min(merged.length, start + count); i++) {
        const fp = merged[i]?.fp;
        if (fp && fp.tick > 0) return fp.tick;
      }
      return 1;
    })();
    const rawRows = priceRange / bucketSize;
    const rowMult = Math.max(1, Math.ceil(rawRows / Math.max(1, Math.floor(plotH / MIN_ROW_H))));
    const rowSize = bucketSize * rowMult;

    const rowIndex = (p: number) => Math.floor((p - pLo) / rowSize);

    // pre-aggregate per visible bar (Fp rows → display rows)
    const agg = new Map<number, AggRow[]>();
    for (let i = start; i < Math.min(merged.length, start + count); i++) {
      const bar = merged[i];
      if (!bar) continue;
      const fp = bar.fp;
      if (!fp) continue;
      const rows: AggRow[] = [];
      const byRow = new Map<number, AggRow>();
      for (let r = 0; r < fp.b.length; r++) {
        const buy = fp.b[r];
        const sell = fp.s[r];
        if (!(buy || sell)) continue;
        const rLo = fp.lo + r * fp.tick;
        const rHi = rLo + fp.tick;
        const ri = rowIndex((rLo + rHi) / 2);
        let row = byRow.get(ri);
        if (!row) {
          row = { pLo: pLo + ri * rowSize, pHi: pLo + (ri + 1) * rowSize, buy: 0, sell: 0, buyCnt: 0, sellCnt: 0 };
          byRow.set(ri, row);
          rows.push(row);
        }
        const usdMult = unit === "usd" ? (rLo + rHi) / 2 : 1;
        row.buy += buy * usdMult;
        row.sell += sell * usdMult;
        row.buyCnt += fp.bc[r];
        row.sellCnt += fp.sc[r];
      }
      rows.sort((a, b) => b.pHi - a.pHi);
      agg.set(i, rows);
    }

    // per-bar diagonal imbalance rows (Coinglass: buys vs sells one level
    // below, sells vs buys one level above) at native tick
    const diagImb = new Map<number, { buy: Set<number>; sell: Set<number> }>();
    if (imbalanceRatio > 1) {
      for (let i = start; i < Math.min(merged.length, start + count); i++) {
        const fp = merged[i]?.fp;
        if (!fp) continue;
        const buy = new Set<number>();
        const sell = new Set<number>();
        for (let r = 0; r < fp.b.length; r++) {
          const diagSell = r > 0 ? fp.s[r - 1] : 0;
          const diagBuy = r + 1 < fp.b.length ? fp.b[r + 1] : 0;
          if (fp.b[r] > 0 && diagSell >= 0 && fp.b[r] >= imbalanceRatio * diagSell) buy.add(r);
          if (fp.s[r] > 0 && diagBuy >= 0 && fp.s[r] >= imbalanceRatio * diagBuy) sell.add(r);
        }
        diagImb.set(i, { buy, sell });
      }
    }

    const yScale = makeScale(pHi, pLo, plotT, plotB);
    const rowH = Math.max(3, toPx(yScale, pLo) - toPx(yScale, pLo + rowSize));

    // ----- price grid -----
    ctx.font = "10px ui-monospace, monospace";
    const step = niceStep(priceRange, Math.max(4, Math.floor(plotH / 46)));
    const gridStart = Math.ceil(pLo / step) * step;
    for (let p = gridStart; p <= pHi; p += step) {
      const y = toPx(yScale, p);
      drawGridLine(ctx, plotL, y, plotR, y);
      ctx.fillStyle = COLORS.text;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(fmtPrice(p), showProfile ? plotR + PROFILE_W - AXIS_W + 6 : plotR + 6, y);
    }

    // ----- time grid -----
    const labelEvery = Math.max(1, Math.round(80 / barW));
    for (let vi = 0; vi < count; vi++) {
      const i = start + vi;
      if (i >= merged.length) break;
      if (!merged[i]) continue;
      if (vi % labelEvery === 0) {
        const x = plotL + vi * barW;
        drawGridLine(ctx, x, plotT, x, plotB);
        ctx.fillStyle = COLORS.text;
        ctx.textAlign = "center";
        const d = new Date(merged[i].ts * 1000);
        const hh = String(d.getUTCHours()).padStart(2, "0");
        const mm = String(d.getUTCMinutes()).padStart(2, "0");
        ctx.fillText(`${hh}:${mm}`, x + barW / 2, plotB + 12);
      }
    }

    // ----- max volume for normalization -----
    let maxVol = 0;
    for (const [, rows] of agg) {
      for (const r of rows) maxVol = Math.max(maxVol, r.buy + r.sell);
    }
    if (maxVol <= 0) maxVol = 1;

    // ----- draw footprint cells -----
    for (let vi = 0; vi < count; vi++) {
      const i = start + vi;
      const rows = agg.get(i);
      if (!rows) continue;
      const x0 = plotL + vi * barW + 1;
      const cellTextW = cellW - 4;
      const bar = merged[i];

      for (const r of rows) {
        const yTop = toPx(yScale, r.pHi);
        const yBot = toPx(yScale, r.pLo);
        const h = Math.max(2, yBot - yTop - 1);
        const total = r.buy + r.sell;

        // background tint (two halves: sell left red, buy right green).
        // Perceptual scaling: raw intensity leaves low-volume rows nearly
        // invisible on dark backgrounds — pow(0.62) lifts the mid range the
        // way Coinglass's own cell shading reads.
        const intensity = Math.pow(total / maxVol, 0.62);
        ctx.fillStyle = `rgba(246,70,93,${(intensity * 0.5).toFixed(3)})`;
        ctx.fillRect(x0, yTop, cellTextW / 2, h);
        ctx.fillStyle = `rgba(14,203,129,${(intensity * 0.5).toFixed(3)})`;
        ctx.fillRect(x0 + cellTextW / 2, yTop, cellTextW / 2, h);

        // texts — two size tiers so digits appear as early as possible
        if (h >= 9 && cellW >= 44) {
          const fs = cellW >= 56 ? 9 : 8;
          ctx.font = `${fs}px ui-monospace, monospace`;
          ctx.textBaseline = "middle";
          const sellTxt = modeText(r, "sell", mode);
          const buyTxt = modeText(r, "buy", mode);
          ctx.fillStyle = "#ff8ba0";
          ctx.textAlign = "left";
          ctx.fillText(sellTxt, x0 + 2, yTop + h / 2);
          ctx.fillStyle = "#5fe3a8";
          ctx.textAlign = "right";
          ctx.fillText(buyTxt, x0 + cellTextW - 2, yTop + h / 2);
        }

        // volume proportion bar at bottom of cell
        if (h >= 6 && mode === "bar") {
          const bw = (r.buy / (total || 1)) * cellTextW;
          ctx.fillStyle = COLORS.green;
          ctx.fillRect(x0, yBot - 3, bw, 2.5);
          ctx.fillStyle = COLORS.red;
          ctx.fillRect(x0 + bw, yBot - 3, cellTextW - bw, 2.5);
        }

        // diagonal imbalance highlight (native rows of this bar)
        const imb = diagImb.get(i);
        if (imb) {
          const fp = bar.fp!;
          let buyHit = false;
          let sellHit = false;
          for (let r2 = 0; r2 < fp.b.length; r2++) {
            const mid = fp.lo + (r2 + 0.5) * fp.tick;
            if (mid < r.pLo || mid >= r.pHi) continue;
            if (imb.buy.has(r2)) buyHit = true;
            if (imb.sell.has(r2)) sellHit = true;
          }
          if (buyHit) {
            ctx.strokeStyle = COLORS.green;
            ctx.lineWidth = 1.4;
            ctx.strokeRect(x0 + cellTextW / 2 + 0.5, yTop + 0.5, cellTextW / 2 - 1, h - 1);
          } else if (sellHit) {
            ctx.strokeStyle = COLORS.red;
            ctx.lineWidth = 1.4;
            ctx.strokeRect(x0 + 0.5, yTop + 0.5, cellTextW / 2 - 1, h - 1);
          }
        }
      }

      // candle skeleton (thin, left edge of the bar)
      if (bar) {
        const cx = x0 - 2;
        ctx.strokeStyle = bar.c >= bar.o ? COLORS.green : COLORS.red;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, toPx(yScale, bar.h));
        ctx.lineTo(cx, toPx(yScale, bar.l));
        ctx.stroke();
      }
    }

    // ----- volume profile + POC + value area -----
    if (showProfile) {
      const profByRow = new Map<number, number>();
      for (const [, rows] of agg) {
        for (const r of rows) {
          const ri = rowIndex((r.pLo + r.pHi) / 2);
          profByRow.set(ri, (profByRow.get(ri) ?? 0) + r.buy + r.sell);
        }
      }
      let pocRi = -1;
      let pocVol = -1;
      for (const [ri, v] of profByRow) {
        if (v > pocVol) {
          pocVol = v;
          pocRi = ri;
        }
      }
      // value area: expand from POC until 70% of profile volume
      let vaLoRi = pocRi;
      let vaHiRi = pocRi;
      if (pocRi >= 0) {
        const sortedRis = [...profByRow.keys()].sort((a, b) => a - b);
        const totalV = [...profByRow.values()].reduce((s, x) => s + x, 0);
        let acc = profByRow.get(pocRi) ?? 0;
        while (acc < totalV * 0.7) {
          const upNext = sortedRis.includes(vaHiRi + 1) ? profByRow.get(vaHiRi + 1) ?? -1 : -1;
          const dnNext = sortedRis.includes(vaLoRi - 1) ? profByRow.get(vaLoRi - 1) ?? -1 : -1;
          if (upNext < 0 && dnNext < 0) break;
          if (upNext >= dnNext) {
            vaHiRi++;
            acc += Math.max(0, upNext);
          } else {
            vaLoRi--;
            acc += Math.max(0, dnNext);
          }
        }
      }
      const maxProf = Math.max(1, ...profByRow.values());
      const profX0 = plotR + 8;
      // profile must END before the price-label zone — with the labels moved
      // into the same right gutter, sharing it wider than the profile was
      // unreadable (profile bars painted over every label in the traded range)
      const profW = PROFILE_W - AXIS_W - 14;
      for (const [ri, v] of profByRow) {
        const yTop = toPx(yScale, pLo + ri * rowSize + rowSize);
        const yBot = toPx(yScale, pLo + ri * rowSize);
        const h = Math.max(1.5, yBot - yTop - 1);
        const inVA = ri >= vaLoRi && ri <= vaHiRi;
        ctx.fillStyle = inVA ? "rgba(232,163,61,0.5)" : "rgba(139,148,158,0.35)";
        ctx.fillRect(profX0, yTop, (v / maxProf) * profW, h);
      }
      if (pocRi >= 0) {
        const y = toPx(yScale, pLo + pocRi * rowSize + rowSize / 2);
        ctx.strokeStyle = COLORS.accent;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(plotL, y);
        ctx.lineTo(profX0 + profW, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = COLORS.accent;
        ctx.textAlign = "left";
        ctx.font = "9px ui-monospace, monospace";
        ctx.fillText("POC", profX0 + 2, y - 5);
      }
      ctx.font = "9px ui-monospace, monospace";
      ctx.textAlign = "left";
      if (vaHiRi > pocRi) {
        const y = toPx(yScale, pLo + (vaHiRi + 1) * rowSize);
        ctx.strokeStyle = "rgba(232,163,61,0.55)";
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(plotL, y);
        ctx.lineTo(profX0 + profW, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(232,163,61,0.9)";
        ctx.fillText(`VAH ${fmtPrice(pLo + (vaHiRi + 1) * rowSize)}`, profX0 + 2, y - 4);
      }
      if (vaLoRi < pocRi) {
        const y = toPx(yScale, pLo + vaLoRi * rowSize);
        ctx.strokeStyle = "rgba(232,163,61,0.55)";
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(plotL, y);
        ctx.lineTo(profX0 + profW, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(232,163,61,0.9)";
        ctx.fillText(`VAL ${fmtPrice(pLo + vaLoRi * rowSize)}`, profX0 + 2, y + 10);
      }
    }

    // ----- last price line -----
    if (lastPrice != null && lastPrice > pLo && lastPrice < pHi) {
      const y = toPx(yScale, lastPrice);
      ctx.strokeStyle = COLORS.accent;
      ctx.setLineDash([2, 2]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotL, y);
      ctx.lineTo(plotR, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ----- signal markers -----
    if (signals && signals.length) {
      const tsIdx = new Map<number, number>();
      for (let vi = 0; vi < count; vi++) {
        const i = start + vi;
        if (i >= merged.length) break;
        tsIdx.set(merged[i].ts, vi);
      }
      for (const s of signals) {
        const vi = tsIdx.get(s.ts);
        if (vi === undefined) continue;
        const bar = merged[start + vi];
        if (!bar) continue;
        const cx = plotL + vi * barW + barW / 2;
        const active = activeSignalTs === s.ts;
        const r = active ? 6 : 4.5;
        ctx.fillStyle = s.dir === "bullish" ? COLORS.green : COLORS.red;
        ctx.beginPath();
        if (s.dir === "bullish") {
          const y = toPx(yScale, bar.l) + r + 3;
          ctx.moveTo(cx, y - r);
          ctx.lineTo(cx - r, y);
          ctx.lineTo(cx + r, y);
        } else {
          const y = toPx(yScale, bar.h) - r - 3;
          ctx.moveTo(cx, y + r);
          ctx.lineTo(cx - r, y);
          ctx.lineTo(cx + r, y);
        }
        ctx.closePath();
        ctx.fill();
        if (active) {
          ctx.strokeStyle = "#e8a33d";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }

    // ----- crosshair -----
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

    // border
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1;
    ctx.strokeRect(plotL + 0.5, plotT + 0.5, plotW, plotH);
  }, [size, view, merged, mode, unit, imbalanceRatio, showProfile, hover, lastPrice, signals, activeSignalTs]);

  useEffect(() => {
    draw();
  }, [draw]);

  // ----- interactions -----
  // native NON-PASSIVE wheel listener: React 19 registers root wheel
  // handlers as passive, so preventDefault() inside a React onWheel prop is
  // a silent no-op and the page scrolls while the chart zooms
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setUserTouched(true);
      setView((v) => {
        if (!v || !merged.length) return v;
        const factor = e.deltaY > 0 ? 1.15 : 0.87;
        // keep indices integral: fractional i makes merged[i] undefined
        const count = Math.round(clamp(v.count * factor, 8, Math.min(400, merged.length)));
        const anchor = clamp((hover?.bi ?? merged.length - 1) - v.start, 0, v.count);
        const start = Math.round(clamp(v.start + anchor * (1 - count / v.count), 0, Math.max(0, merged.length - count)));
        return { ...v, start, count };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [merged.length, hover]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!view) return;
      setUserTouched(true);
      const zone: "pan" | "vzoom" | "hzoom" =
        e.nativeEvent.offsetX >= size.w - AXIS_W - 6
          ? "vzoom"
          : e.nativeEvent.offsetY >= size.h - TIME_H
            ? "hzoom"
            : "pan";
      const priceH = Math.max(1, size.h - TIME_H - 8);
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
    [view, size]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const el = canvasRef.current;
      if (!el || !view || !merged.length) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const plotL = 8;
      const plotR = size.w - (showProfile ? PROFILE_W + 10 : AXIS_W + 6);
      const barW = (plotR - plotL) / view.count;
      const bi = Math.floor((x - plotL) / barW) + view.start;
      setHover({ x, y, bi: clamp(bi, 0, merged.length - 1) });
      const d = drag.current;
      if (!d) {
        const zone = x >= size.w - AXIS_W - 6 ? "vzoom" : y >= size.h - TIME_H ? "hzoom" : "pan";
        setCursor(zone === "vzoom" ? "ns-resize" : zone === "hzoom" ? "ew-resize" : "crosshair");
        return;
      }
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (d.mode === "vzoom") {
        // TradingView price-scale drag: zoom anchored at the grab price
        const range = d.pHi - d.pLo;
        const f = Math.exp(dy * 0.0045);
        const newRange = clamp(range * f, Math.max(d.pLo, 1e-9) * 1e-4, range * 500);
        const priceH = Math.max(1, size.h - TIME_H - 8);
        const frac = clamp((d.y - el.getBoundingClientRect().top - 8) / priceH, 0, 1);
        const pHi = d.anchorP + frac * newRange;
        setView({ ...view, pHi, pLo: pHi - newRange });
      } else if (d.mode === "hzoom") {
        // time-axis drag: bar-count scaling anchored at the right edge
        // (absolute math from the GRAB-time count — never compounding)
        const end = d.start + d.count;
        const count = Math.round(clamp(d.count * Math.exp(-dx * 0.0045), 8, Math.min(400, merged.length)));
        const start = clamp(Math.round(end - count), 0, Math.max(0, merged.length - count));
        setView({ ...view, start, count });
      } else {
        const barsShift = Math.round(dx / barW);
        const start = Math.round(clamp(d.start - barsShift, 0, Math.max(0, merged.length - view.count)));
        const plotH = Math.max(1, size.h - TIME_H - 16);
        const priceShift = (dy / plotH) * (d.pHi - d.pLo);
        setView({ ...view, start, pLo: d.pLo + priceShift, pHi: d.pHi + priceShift });
      }
    },
    [view, merged.length, size, showProfile]
  );

  const onMouseUp = useCallback(() => {
    drag.current = null;
    setCursor("crosshair");
  }, []);

  const onMouseLeave = useCallback(() => {
    drag.current = null;
    setHover(null);
    onHoverBar?.(null);
  }, [onHoverBar]);

  // notify parent about hovered bar
  useEffect(() => {
    if (!hover || !merged.length) return;
    const b = merged[clamp(hover.bi, 0, merged.length - 1)];
    onHoverBar?.(b ?? null);
  }, [hover, merged, onHoverBar]);

  const onDoubleClick = useCallback(() => {
    setUserTouched(false); // reset = re-adopt the default behavior
    setView(defaultView);
  }, [defaultView]);

  // keyboard: Home/End jump the window to the newest/oldest bars without
  // touching the price scale (TradingView chart-nav convention)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Home" && e.key !== "End") return;
      e.preventDefault();
      setView((v) => {
        if (!v || !merged.length) return v;
        const start = e.key === "End" ? Math.max(0, merged.length - v.count) : 0;
        return { ...v, start };
      });
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [merged.length]);

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
        onMouseLeave={onMouseLeave}
        onDoubleClick={onDoubleClick}
      />
      <div className="pointer-events-none absolute right-3 top-2 text-[10px] text-neutral-500">
        drag = pan · wheel = zoom · drag price/time axis = scale · dbl-click = reset
      </div>
    </div>
  );
}

function modeText(r: AggRow, side: "buy" | "sell", mode: FootprintMode): string {
  switch (mode) {
    case "delta":
      return side === "buy" ? `+${fmtShort(r.buy)}` : `−${fmtShort(r.sell)}`;
    case "trades":
      return String(side === "buy" ? r.buyCnt : r.sellCnt);
    case "avgSize":
      return fmtNum2(side === "buy" ? (r.buyCnt ? r.buy / r.buyCnt : 0) : r.sellCnt ? r.sell / r.sellCnt : 0);
    case "bar":
    default:
      return fmtShort(side === "buy" ? r.buy : r.sell);
  }
}

function fmtShort(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `${(n / 1e3).toFixed(0)}K`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  if (a >= 100) return n.toFixed(0);
  if (a >= 10) return n.toFixed(1);
  if (a >= 0.01) return n.toFixed(2);
  return a > 0 ? "<.01" : "0";
}

function fmtNum2(n: number): string {
  const a = Math.abs(n);
  if (a >= 100) return n.toFixed(0);
  if (a >= 10) return n.toFixed(1);
  if (a >= 1) return n.toFixed(2);
  return String(+n.toPrecision(2));
}
