/**
 * fp-research step 3 — build the historical signal dataset.
 *
 * Reconstructs FlowBars from disk-cached fapi klines and runs the repo's
 * OWN signal engine (src/lib/cg/signals.ts computeSignals) verbatim —
 * zero methodology drift vs the terminal's live Coinglass-style signals.
 *
 *   m15 klines → buy/sell/delta/vol/OHLC/closePos  (taker-buy split)
 *   m1  klines → lowZoneSell / highZoneBuy         (price-zone attribution,
 *                exactly mirroring barsToFlow's bucket-overlap weighting)
 *
 * Output per symbol: data/fp-research/signals_{SYM}.jsonl
 *   {ts, type, dir, strength, price, confirmBars}
 *   confirmBars = bars after ts at which the signal is KNOWABLE:
 *     absorption → 2 (hold check reads bars i+1, i+2), others → 0.
 * Entry convention downstream: open of bar ts + (confirmBars+1)*15m.
 *
 * Run: bun scripts/fp-research/build_signals.ts
 */
import { computeSignals, type FlowBar } from "../../src/lib/cg/signals";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const DIR = "data/fp-research";

interface Kline { t: number; o: string; h: string; l: string; c: string; v: string; qv: string; n: number; tb: string }

function loadKlines(path: string): Kline[] {
  if (!existsSync(path)) return [];
  const raw = gunzipSync(readFileSync(path)).toString("utf8");
  const out: Kline[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const j = JSON.parse(line) as Omit<Kline, "o" | "h" | "l" | "c" | "v" | "qv" | "tb"> & Record<string, unknown>;
    out.push({
      t: j.t, o: String(j.o), h: String(j.h), l: String(j.l), c: String(j.c),
      v: String(j.v), qv: String(j.qv), n: j.n, tb: String(j.tb),
    });
  }
  return out;
}

const M15 = 900_000;
const M1 = 60_000;

/** Build FlowBars: m15 structure + m1-derived zone volumes (barsToFlow-equivalent). */
function buildFlow(m15: Kline[], m1: Kline[]): FlowBar[] {
  // group m1 bars by their m15 bucket
  const m1ByBucket = new Map<number, Kline[]>();
  for (const b of m1) {
    const bucket = Math.floor(b.t / M15) * M15;
    const arr = m1ByBucket.get(bucket);
    if (arr) arr.push(b);
    else m1ByBucket.set(bucket, [b]);
  }
  const out: FlowBar[] = [];
  for (const k of m15) {
    const buy = parseFloat(k.tb);
    const vol = parseFloat(k.v);
    const sell = vol - buy;
    const h = parseFloat(k.h);
    const l = parseFloat(k.l);
    const range = h - l || 1;
    let lowZoneSell = 0;
    let highZoneBuy = 0;
    const subs = m1ByBucket.get(k.t) ?? [];
    for (const s of subs) {
      const sLo = parseFloat(s.l);
      const sHi = parseFloat(s.h);
      const w = sHi - sLo || 1;
      const sv = parseFloat(s.v) - parseFloat(s.tb); // sell volume of the minute
      const bv = parseFloat(s.tb); // buy volume of the minute
      // overlap of the minute's range with the bottom 30% / top 30% of the m15 range
      const ovLow = Math.max(0, Math.min(sHi, l + 0.3 * range) - sLo) / w;
      const ovHigh = Math.max(0, sHi - Math.max(sLo, h - 0.3 * range)) / w;
      lowZoneSell += sv * ovLow;
      highZoneBuy += bv * ovHigh;
    }
    const c = parseFloat(k.c);
    out.push({
      ts: k.t / 1000, // signals.ts uses seconds
      buy, sell, vol, delta: buy - sell,
      lowZoneSell, highZoneBuy,
      lowZoneSellCnt: 0, highZoneBuyCnt: 0, // trade counts per zone unavailable from klines (display-only upstream)
      buyCnt: 0, sellCnt: 0,
      closePos: Math.min(1, Math.max(0, (c - l) / (h - l))),
      o: parseFloat(k.o), h, l, c,
    });
  }
  return out;
}

function main() {
  mkdirSync(DIR, { recursive: true });
  const uni = JSON.parse(readFileSync(`${DIR}/universe.json`, "utf8")) as { symbol: string }[];
  let total = 0;
  const counts: Record<string, number> = {};
  for (const { symbol } of uni) {
    const m15 = loadKlines(`${DIR}/15m_${symbol}.jsonl.gz`);
    const m1 = loadKlines(`${DIR}/1m_${symbol}.jsonl.gz`);
    const flow = buildFlow(m15, m1);
    // pass candles? buildFlow already folds OHLC — direct FlowBar construction
    const signals = computeSignals(flow, { basis: "15m", label: "15m", window: 60 });
    // confirmLag: absorption reads next 2 bars → knowable 2 bars after ts
    const tsSet = new Set(flow.map((f) => f.ts));
    const lines = signals.map((s) => ({
      ts: s.ts,
      type: s.type,
      dir: s.dir,
      strength: s.strength,
      price: s.price,
      text: s.text,
      confirmBars: s.type === "absorption" ? 2 : 0,
      hasM1: tsSet.has(s.ts),
    }));
    writeFileSync(`${DIR}/signals_${symbol}.jsonl`, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
    total += signals.length;
    for (const s of signals) {
      const key = `${s.type}|${s.dir}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    console.log(`${symbol}: ${flow.length} flow bars (m1 ${m1.length}) → ${signals.length} signals`);
  }
  console.log(`\nTOTAL ${total} signals`);
  for (const k of Object.keys(counts).sort()) console.log(`  ${k}: ${counts[k]}`);
}

main();
