import { NextRequest, NextResponse } from "next/server";
import { cgGet } from "@/lib/cg/client";
import {
  cvdKpis,
  detectDivergences,
  flowRows,
  FlowGrid,
  pickInstruments,
  recompute,
  type CvdInstrument,
  type CvdSeries,
  type TickerRow,
} from "@/lib/cg/cvd";
import type { KlineRow } from "@/lib/cg/types";
import { anyTerminalSym, knownSym } from "@/lib/cg/sym-gate";
import { pinCvdInstruments, symDecs } from "@/lib/cg/assets";
import { BoundedMap } from "@/lib/cg/bounded";
import { hlCoinOf, resolveCgSym } from "@/lib/binance/aliases";
import { fetchBinCandles, fetchHlCandles, fetchHlRecentTrades } from "@/lib/cg/fallbacks";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/cvd?itv=m15&limit=1500&mode=perp|spot|total|split&anchor=all|day|week
 *
 * Cumulative Volume Delta — the Coinglass /cvd/BTC page:
 * futures CVD, spot CVD, taker-buy share, spot-vs-futures quadrant and the
 * Bull/Bear divergence list, all computed by their exact client-side engine
 * (src/lib/cg/cvd.ts) over per-venue taker flows (#bs_usd klines).
 *
 * Pure API data: /api/select/coins/tickers + /api/v2/kline (#kline, #bs_usd).
 * Curated perps are members since 2026-11-12. CRYPTO syms use instrument
 * discovery (keyword-driven, covers every venue that lists the coin — 13
 * perp venues incl. Binance/OKX/Bybit/Gate/Bitget/Bitfinex/Kraken + 9 spot
 * venues). TRADFI syms never keyword-resolve (keyword=MUB returns the
 * MUBARAK memecoin — verified trap): their instruments are PINNED via
 * pinCvdInstruments() (Binance/OKX/Bybit/Bitget/Gate perps + the Binance
 * B-token spot leg, all verified live on #bs_usd).
 *
 * Degradation ladder (feat-v2): Coinglass aggregate → deterministic probe →
 * Binance /fapi/v1/klines taker-buy/sell USD (real exchange tape). Classic
 * instruments return { ok: true, supported: false } with the HL xyz tape
 * when available — never a dead 400.
 */

const ITVS: Record<string, { api: string; ms: number }> = {
  "1m": { api: "m1", ms: 60_000 },
  "5m": { api: "m5", ms: 300_000 },
  "15m": { api: "m15", ms: 900_000 },
  "30m": { api: "m30", ms: 1_800_000 },
  "1h": { api: "h1", ms: 3_600_000 },
  "4h": { api: "h4", ms: 14_400_000 },
  "1d": { api: "d1", ms: 86_400_000 },
};

const cache = new BoundedMap<{ at: number; body: unknown }>(24);

interface BuiltCvd {
  inst: CvdInstrument[];
  priceKey: string;
  series: CvdSeries;
  loaded: { key: string; ok: boolean }[];
  itv: { api: string; ms: number };
  source: string;
  reqSym: string;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<(R | null)[]> {
  const out: (R | null)[] = new Array(items.length).fill(null);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        out[i] = await fn(items[i], i);
      } catch {
        out[i] = null;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function buildFromBinanceFapi(reqSym: string, itvKey: string, limit: number): Promise<BuiltCvd> {
  const itv = ITVS[itvKey];
  const candles = await fetchBinCandles(reqSym, itv.api, Math.min(limit, 1500));
  if (!candles.length) throw new Error("no binance candles for CVD");
  const last = candles[candles.length - 1];
  const dayStart = candles[0].t;
  let vol24hUsd = 0;
  const cutoff = last.t - 86_400_000;
  for (const c of candles) if (c.t >= cutoff) vol24hUsd += c.q ?? c.v * c.c;
  void dayStart;

  const pair = `${resolveCgSym(reqSym)}USDT`;
  const inst: CvdInstrument[] = [
    { key: `Binance_${pair}`, venue: "Binance", kind: "perp", instrumentId: pair, volUsd: vol24hUsd, price: last.c },
  ];
  const grid = new FlowGrid(itv.ms, inst.map((i) => i.key));
  grid.setCandles(
    candles.map((c) => [Math.floor(c.t / 1000), c.o, c.h, c.l, c.c]) as [number, number, number, number, number][]
  );
  const bFlows: [number, number, number][] = candles.map((c) => {
    const q = c.q ?? c.v * c.c;
    const tbq = c.tbq ?? q * 0.5;
    const sellQ = Math.max(0, q - tbq);
    return [Math.floor(c.t / 1000), tbq, sellQ];
  });
  grid.mergeFlow(0, flowRows(bFlows));
  const series = recompute(grid, inst);
  if (!series) throw new Error("binance fapi cvd recompute failed");
  return {
    inst,
    priceKey: inst[0].key,
    series: series as NonNullable<ReturnType<typeof recompute>>,
    loaded: [{ key: inst[0].key, ok: true }],
    itv,
    source: "binance-fapi",
    reqSym,
  };
}

async function buildCvd(reqSym: string, itvKey: string, limit: number): Promise<BuiltCvd> {
  const itv = ITVS[itvKey];
  const cgSym = resolveCgSym(reqSym);

  // 0) TRADFI: pinned keys — never keyword discovery (keyword=MUB returns
  //    the MUBARAK memecoin — verified trap); all five perp legs + the
  //    Binance B-token spot leg are live-verified on #bs_usd.
  const pinned = pinCvdInstruments(cgSym);

  // 1) Long-TTL discovery (30m) so symbol switching doesn't hit Coinglass 429
  let inst: CvdInstrument[] = [];
  let priceKey = "";
  if (pinned) {
    inst = pinned.map((p) => ({ key: p.key, venue: p.venue, kind: p.kind, instrumentId: p.key, volUsd: 0, price: 0 }));
    priceKey = pinned[0]?.key ?? `Binance_${cgSym}USDT`;
  } else {
    try {
      const [fut, spot] = await Promise.all([
        cgGet(`/api/select/coins/tickers?type=FUTURES&keyword=${encodeURIComponent(cgSym)}`, 1_800_000) as Promise<TickerRow[] | { data: TickerRow[] }>,
        cgGet(`/api/select/coins/tickers?type=SPOT&keyword=${encodeURIComponent(cgSym)}`, 1_800_000)
          .then((d) => d as TickerRow[] | { data: TickerRow[] })
          .catch(() => [] as TickerRow[]),
      ]);
      const futRows = Array.isArray(fut) ? fut : ((fut as { data?: TickerRow[] }).data ?? []);
      const spotRows = Array.isArray(spot) ? spot : ((spot as { data?: TickerRow[] }).data ?? []);
      const picked = pickInstruments(futRows, spotRows, cgSym);
      inst = picked.inst;
      priceKey = picked.priceKey;
    } catch {
      /* fallback below */
    }
  }

  // Deterministic probe if /select/coins/tickers 429'd
  if (!inst.length || !priceKey) {
    inst = [
      { key: `Binance_${cgSym}USDT`, venue: "Binance", kind: "perp", instrumentId: `${cgSym}USDT`, volUsd: 0, price: 0 },
      { key: `OKX_${cgSym}-USDT-SWAP`, venue: "OKX", kind: "perp", instrumentId: `${cgSym}-USDT-SWAP`, volUsd: 0, price: 0 },
      { key: `Bybit_${cgSym}USDT`, venue: "Bybit", kind: "perp", instrumentId: `${cgSym}USDT`, volUsd: 0, price: 0 },
      { key: `Bitget_${cgSym}USDT_UMCBL`, venue: "Bitget", kind: "perp", instrumentId: `${cgSym}USDT_UMCBL`, volUsd: 0, price: 0 },
    ];
    priceKey = inst[0].key;
  }

  try {
    const kl = (await cgGet(
      `/api/v2/kline?symbol=${encodeURIComponent(priceKey + "#kline")}&interval=${itv.api}&limit=${limit}&minLimit=false`,
      60_000
    )) as { data?: KlineRow[] } | KlineRow[];
    const klRows = Array.isArray(kl) ? kl : (kl.data ?? []);
    const candles = klRows.filter((r) => r && Number.isFinite(+r[4]));
    if (candles.length) {
      const grid = new FlowGrid(itv.ms, inst.map((i) => i.key));
      grid.setCandles(candles as unknown as [number, string | number, string | number, string | number, string | number][]);
      const loaded: { key: string; ok: boolean }[] = [];
      const flows = await mapLimit(inst, 4, async (v: CvdInstrument) => {
        const r = (await cgGet(
          `/api/v2/kline?symbol=${encodeURIComponent(v.key + "#bs_usd")}&interval=${itv.api}&limit=${limit}&minLimit=false`,
          60_000
        )) as { data?: [number, string | number, string | number][] } | [number, string | number, string | number][];
        return (Array.isArray(r) ? r : (r.data ?? [])) as [number, string | number, string | number][];
      });
      let anyFlow = false;
      flows.forEach((rows, i) => {
        const ok = Array.isArray(rows) && rows.length > 0;
        if (ok) anyFlow = true;
        loaded.push({ key: inst[i].key, ok });
        if (ok) grid.mergeFlow(i, flowRows(rows as [number, string | number, string | number][]));
      });
      if (anyFlow) {
        const series = recompute(grid, inst);
        if (series) {
          return {
            inst,
            priceKey,
            series: series as NonNullable<ReturnType<typeof recompute>>,
            loaded,
            itv,
            source: "coinglass",
            reqSym,
          };
        }
      }
    }
  } catch {
    /* fallback cleanly to Binance exchange taker flow */
  }

  // Fallback: exact exchange taker buy/sell USD directly from Binance /fapi/v1/klines
  return buildFromBinanceFapi(reqSym, itvKey, limit);
}

function round1e6(x: number) {
  return Math.round(x / 1e6);
}

const NORMALIZE: Record<string, string> = { m1: "1m", m5: "5m", m15: "15m", m30: "30m", h1: "1h", h4: "4h", d1: "1d" };

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sym = (sp.get("sym") ?? "BTC").trim().toUpperCase();
  if (!(await anyTerminalSym(sym))) {
    return NextResponse.json({ ok: false, error: `unknown asset ${sym}` }, { status: 400 });
  }
  const rawItv = sp.get("itv") ?? "m15";
  const itvKey = ITVS[rawItv] ? rawItv : (NORMALIZE[rawItv] ?? "m15");
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 1500) || 1500, 300), 1500);
  const mode = ["perp", "spot", "total", "split"].includes(sp.get("mode") ?? "") ? (sp.get("mode") as string) : "total";
  const anchor = ["all", "day", "week"].includes(sp.get("anchor") ?? "") ? (sp.get("anchor") as "all" | "day" | "week") : "all";

  if (!(await knownSym(sym))) {
    const hlCoin = hlCoinOf(sym);
    if (hlCoin) {
      const [candles, trades] = await Promise.all([
        fetchHlCandles(hlCoin, ITVS[itvKey].api, 300).catch(() => []),
        fetchHlRecentTrades(hlCoin).catch(() => []),
      ]);
      const buyUsd = trades.filter((t) => t.side === "buy").reduce((a, t) => a + t.usd, 0);
      const sellUsd = trades.filter((t) => t.side === "sell").reduce((a, t) => a + t.usd, 0);
      return NextResponse.json({
        ok: true,
        supported: false,
        sym,
        itv: ITVS[itvKey].api,
        mode,
        anchor,
        source: "hl-xyz",
        hlTape: {
          coin: hlCoin,
          trades: trades.length,
          buyUsd: Math.round(buyUsd),
          sellUsd: Math.round(sellUsd),
          netUsd: Math.round(buyUsd - sellUsd),
          buyPct: buyUsd + sellUsd > 0 ? +((buyUsd / (buyUsd + sellUsd)) * 100).toFixed(1) : null,
          lastPrice: candles[candles.length - 1]?.c ?? trades[0]?.px ?? null,
        },
        reason: "Historical multi-venue CVD bars unavailable on Hyperliquid xyz — showing real-time HL recent-trades taker split",
        updatedAt: Date.now(),
      });
    }
    return NextResponse.json({
      ok: true,
      supported: false,
      sym,
      itv: ITVS[itvKey].api,
      mode,
      anchor,
      reason: "Cumulative Volume Delta requires a perpetual or spot exchange order tape (unavailable for cash/CFD index)",
      updatedAt: Date.now(),
    });
  }

  const key = `${sym}|${itvKey}|${limit}`;
  let built: BuiltCvd;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 15_000 && hit.body && typeof hit.body === "object" && "built" in (hit.body as object)) {
    built = (hit.body as { built: BuiltCvd }).built;
  } else {
    try {
      built = await buildCvd(sym, itvKey, limit);
    } catch (e) {
      const stale = cache.get(key);
      if (stale) {
        const b = (stale.body as { built: BuiltCvd }).built;
        return render(b, mode, anchor, stale.at);
      }
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : "fetch failed" },
        { status: 502 }
      );
    }
    cache.set(key, { at: Date.now(), body: { built } });
  }
  return render(built, mode, anchor, cache.get(key)?.at ?? Date.now());
}

function render(
  built: BuiltCvd,
  mode: string,
  anchor: "all" | "day" | "week",
  at: number
) {
  const { series, inst, loaded } = built;
  const cvdArr = mode === "spot" ? series.spot : mode === "perp" ? series.perp : series.total;
  const divs = detectDivergences(series, cvdArr);
  const kpis = cvdKpis(series, anchor, divs);

  const lastPx = series.c[series.n - 1] ?? 0;
  const dec = symDecs(built.reqSym, lastPx);
  return NextResponse.json({
    ok: true,
    supported: true,
    source: built.source,
    sym: built.reqSym,
    itv: built.itv.api,
    mode,
    anchor,
    priceKey: built.priceKey,
    instruments: inst.map((i) => ({ key: i.key, venue: i.venue, kind: i.kind, vol24hUsd: Math.round(i.volUsd) })),
    flowsLoaded: loaded,
    n: series.n,
    candles: series.ts.map((t, i) => [t, series.o[i], series.h[i], series.l[i], series.c[i]]),
    perp: Array.from(series.perp.slice(1), round1e6),
    spot: Array.from(series.spot.slice(1), round1e6),
    total: Array.from(series.total.slice(1), round1e6),
    delta: Array.from(series.delta, round1e6),
    ratio: Array.from(series.ratio, (x) => (Number.isFinite(x) ? +x.toFixed(4) : null)),
    divergences: divs.map((d) => ({
      type: d.t,
      ts: d.ts,
      priceA: +d.priceA.toFixed(dec),
      priceB: +d.priceB.toFixed(dec),
      priceC: +d.priceC.toFixed(dec),
      bars: [d.a, d.b, d.c],
      ret12: d.r !== undefined ? +(d.r * 100).toFixed(2) : null,
      hit: d.hit ?? null,
    })),
    kpis: {
      ...kpis,
      perpCvd: round1e6(kpis.perpCvd),
      spotCvd: round1e6(kpis.spotCvd),
      perpBuy: round1e6(kpis.perpBuy),
      perpSell: round1e6(kpis.perpSell),
      spotBuy: round1e6(kpis.spotBuy),
      spotSell: round1e6(kpis.spotSell),
      buyRatio: Number.isFinite(kpis.buyRatio) ? +(kpis.buyRatio * 100).toFixed(1) : null,
      latestDiv: kpis.latestDiv
        ? {
            type: kpis.latestDiv.t,
            ts: kpis.latestDiv.ts,
            price: +kpis.latestDiv.priceB.toFixed(dec),
          }
        : null,
    },
    updatedAt: at,
  });
}
