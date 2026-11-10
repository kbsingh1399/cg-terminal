"use client";

/** Shared helpers for canvas charts (scales, DPI, hit-testing). */

export interface Scale {
  d0: number;
  d1: number;
  p0: number;
  p1: number;
}

export function makeScale(d0: number, d1: number, p0: number, p1: number): Scale {
  return { d0, d1, p0, p1 };
}

export function toPx(s: Scale, v: number): number {
  if (s.d1 === s.d0) return (s.p0 + s.p1) / 2;
  return s.p0 + ((v - s.d0) / (s.d1 - s.d0)) * (s.p1 - s.p0);
}

export function fromPx(s: Scale, p: number): number {
  if (s.p1 === s.p0) return s.d0;
  return s.d0 + ((p - s.p0) / (s.p1 - s.p0)) * (s.d1 - s.d0);
}

export function setupHiDPI(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(50, Math.floor(rect.width));
  const h = Math.max(50, Math.floor(rect.height));
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export function clearCanvas(ctx: CanvasRenderingContext2D, w: number, h: number, color = "#0b0e11") {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
}

/** Nice round price grid steps for a given price range and target tick count. */
export function niceStep(range: number, targetTicks: number): number {
  const raw = range / Math.max(1, targetTicks);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return step * mag;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export const COLORS = {
  bg: "#0b0e11",
  panel: "#11151c",
  grid: "#1c222c",
  text: "#8e9aa8",
  textBright: "#e6edf3",
  green: "#0ecb81",
  greenDim: "rgba(14,203,129,0.16)",
  red: "#f6465d",
  redDim: "rgba(246,70,93,0.16)",
  accent: "#f0b90b",
  axis: "#2a313d",
};

export function drawGridLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5);
  ctx.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5);
  ctx.stroke();
}
