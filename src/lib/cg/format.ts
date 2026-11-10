/** Number formatting helpers (locale en, concise crypto conventions). */

export function fmtUsd(n: number, digits = 1): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(digits)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(digits)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(digits)}K`;
  return `$${n.toFixed(digits)}`;
}

export function fmtNum(n: number, digits = 1): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(digits)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(digits)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(digits)}K`;
  if (abs >= 100) return n.toFixed(0);
  return n.toFixed(digits);
}

export function fmtPrice(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: n >= 1000 ? 1 : 4 });
}

export function fmtPct(n: number, digits = 2): string {
  const s = n.toFixed(digits);
  return `${n > 0 ? "+" : ""}${s}%`;
}

export function fmtSigned(n: number, digits = 1): string {
  const s = fmtNum(Math.abs(n), digits);
  return `${n >= 0 ? "+" : "−"}${s}`;
}

export function fmtTime(tsSec: number, withDate = false): string {
  const d = new Date(tsSec * 1000);
  const hm = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  if (!withDate) return hm;
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")} ${hm}`;
}

export function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

export function fmtAge(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function toNum(v: string | number | undefined | null): number {
  if (v == null) return NaN;
  return typeof v === "number" ? v : Number(v);
}
