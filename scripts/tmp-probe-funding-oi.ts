// probe 4: fundingRate home + openInterest chart for TradFi plain names
import { cgGet } from "../src/lib/cg/client";

const home = (await cgGet("/api/fundingRate/v2/home", 0)) as { symbol?: string; uMarginList?: { exchangeName: string; rate?: number; fundingIntervalHours?: number; status?: number }[] }[] | null;
const items = Array.isArray(home) ? home : [];
console.log("funding home rows:", items.length);
for (const s of ["NVDA", "XAU", "XAG", "CL", "SOXL", "ANTHROPIC", "BTC", "1000PEPE", "VET", "TIA", "KORU", "DRAM", "SPCX", "MU", "SKHY", "NBIS"]) {
  const it = items.find((x) => x.symbol?.toUpperCase() === s);
  console.log("funding", s.padEnd(10), it ? `venues: ${(it.uMarginList ?? []).map((v) => `${v.exchangeName}(${v.fundingIntervalHours}h,${v.status})`).slice(0, 6).join(",")}` : "NOT FOUND");
}

for (const s of ["NVDA", "XAU", "CL", "SOXL", "ANTHROPIC", "1000PEPE", "VET"]) {
  try {
    const r = (await cgGet(`/api/openInterest/v3/chart?symbol=${encodeURIComponent(s)}&type=0&timeType=2`, 0)) as { dataMap?: Record<string, number[]>; dateList?: number[] } | null;
    const venues = Object.keys(r?.dataMap ?? {});
    const n = r?.dateList?.length ?? 0;
    const latest = venues.map((v) => `${v}=${(r?.dataMap?.[v] ?? []).slice(-1)[0]}`).join(",");
    console.log("oi", s.padEnd(10), "venues:", venues.length, "points:", n, latest.slice(0, 140));
  } catch (e) {
    console.log("oi", s.padEnd(10), "ERR", String((e as Error).message).slice(0, 90));
  }
  await new Promise((r) => setTimeout(r, 300));
}
