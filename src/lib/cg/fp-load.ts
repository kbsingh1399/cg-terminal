/**
 * Footprint bar loader — the exact data pipeline of the Coinglass footprint
 * page (their `eM`), extracted from the /api/cg/fp route so the notification
 * scanner can run the identical computation server-side.
 *
 * Per venue: /api/orderFlow buckets; kline from the lead venue (Binance) plus
 * USD-quote venues (Hyperliquid) shifted onto the lead price level; optional
 * aggregated OI. Merged rows follow the lead venue's time grid.
 */

import { cgGet } from "./client";
import { BoundedMap } from "./bounded";
import { fpFromBuckets, mergeFp, type Fp, type FpBar } from "./cg-signals";
import { fpVenues } from "./assets";
import { knownSym } from "./sym-gate";
import { hlCoinOf } from "../binance/aliases";
import { fetchBinCandles, fetchHlCandles, fetchYahooCandles, resolveClassicYahooTicker } from "./fallbacks";

const INTERVALS = new Set(["m1", "m5", "m15", "m30", "h1", "h4"]);

function num(v: unknown): number | null {
  if (null == v || v === "") return null;
  const n = +v;
  return isFinite(n) ? n : null;
}

function toMap<T>(data: unknown, val: (row: unknown[]) => T): Map<number, T> {
  const m = new Map<number, T>();
  if (!Array.isArray(data)) return m;
  for (const row of data as unknown[][]) {
    if (row && null != row[0]) m.set(+row[0], val(row));
  }
  return m;
}

function parseEnvelope(d: unknown): unknown {
  if (d && typeof d === "object" && "data" in (d as Record<string, unknown>)) {
    return (d as { data?: unknown }).data ?? null;
  }
  return d;
}

export interface FpLoadResult {
  ok: boolean;
  supported?: boolean;
  bucketsAvailable?: boolean;
  source?: string;
  reason?: string;
  sym: string;
  itv: string;
  limit: number;
  venues: string[];
  missing: string[];
  bars: FpBar[];
  candleFlow?: { ts: number; v: number; buyVol?: number; sellVol?: number }[];
  updatedAt: number;
}

/** module-level snapshot cache: (sym|itv|limit|oi) → {at, result}. */
const snapCache = new BoundedMap<{ at: number; res: FpLoadResult }>(24);

export async function loadFpBars(
  symRaw: string,
  itv: string,
  limit: number,
  withOi = false,
  ttlMs = 45_000
): Promise<FpLoadResult> {
  const sym = symRaw.trim().toUpperCase();
  const ck = `${sym}|${itv}|${limit}|${withOi ? 1 : 0}`;
  const hit = snapCache.get(ck);
  if (hit && Date.now() - hit.at < ttlMs) return hit.res;

  if (!INTERVALS.has(itv)) throw new Error(`bad interval ${itv}`);

  const hasPerp = await knownSym(sym);

  // Non-perp Classic assets (e.g. SPX500/NDX100 on HL xyz, US30/VIX on Yahoo):
  // supply authentic OHLC candles cleanly with bucketsAvailable=false (zero synthetic buckets).
  if (!hasPerp) {
    const hlCoin = hlCoinOf(sym);
    if (hlCoin) {
      const candles = await fetchHlCandles(hlCoin, itv, limit).catch(() => []);
      if (candles.length) {
        const res: FpLoadResult = {
          ok: true,
          supported: true,
          bucketsAvailable: false,
          source: "hl-xyz",
          reason: "Price-ladder footprint buckets unavailable on Hyperliquid xyz — showing real HL OHLC + live tape",
          sym,
          itv,
          limit,
          venues: [`Hyperliquid ${hlCoin}`],
          missing: [],
          bars: candles.map((c) => ({ ts: c.t, o: c.o, h: c.h, l: c.l, c: c.c, fp: null, oio: null, oic: null })),
          candleFlow: candles.map((c) => ({ ts: c.t, v: c.v })),
          updatedAt: Date.now(),
        };
        snapCache.set(ck, { at: Date.now(), res });
        return res;
      }
    }
    const yf = resolveClassicYahooTicker(sym);
    if (yf) {
      const yItv = itv === "d1" ? "1d" : itv === "h1" || itv === "h4" ? "1h" : "15m";
      const yRange = yItv === "1d" ? "1y" : yItv === "1h" ? "1mo" : "5d";
      const candles = await fetchYahooCandles(yf.yahoo, yItv, yRange).catch(() => []);
      if (candles.length) {
        const sliced = candles.slice(-limit);
        const res: FpLoadResult = {
          ok: true,
          supported: true,
          bucketsAvailable: false,
          source: "yahoo",
          reason: "Footprint order-flow buckets unavailable on cash/CFD index — showing real market OHLC bars",
          sym,
          itv,
          limit,
          venues: [`Yahoo (${yf.yahoo})`],
          missing: [],
          bars: sliced.map((c) => ({ ts: c.t, o: c.o, h: c.h, l: c.l, c: c.c, fp: null, oio: null, oic: null })),
          candleFlow: sliced.map((c) => ({ ts: c.t, v: c.v })),
          updatedAt: Date.now(),
        };
        snapCache.set(ck, { at: Date.now(), res });
        return res;
      }
    }
    throw new Error(`no bar history for ${sym}`);
  }

  const keys = fpVenues(sym).map((v) => ({ ...v }));
  const lead = keys[0];
  const needKline = (v: (typeof keys)[number]) => v === lead || v.usd !== lead.usd;

  const flowP = keys.map((v) =>
    cgGet(
      `/api/orderFlow?symbol=${encodeURIComponent(`${v.key}#order_flow`)}&interval=${itv}&minLimit=false&limit=${limit}`,
      20_000
    ).then(
      (r) => ({ v, rows: parseEnvelope(r) as unknown[] }),
      () => ({ v, rows: null as unknown[] | null })
    )
  );
  const klineP = keys
    .filter((v) => needKline(v))
    .map((v) =>
      cgGet(
        `/api/v2/kline?symbol=${encodeURIComponent(`${v.key}#kline`)}&interval=${itv}&minLimit=false&limit=${limit}`,
        30_000
      ).then(
        (r) => ({ v, rows: parseEnvelope(r) as unknown[] }),
        () => ({ v, rows: null as unknown[] | null })
      )
    );
  const oiP = withOi
    ? keys.map((v) =>
        cgGet(
          `/api/v2/kline?symbol=${encodeURIComponent(`${v.key}#oi_kline`)}&interval=${itv}&minLimit=false&limit=${limit}`,
          30_000
        ).then(
          (r) => ({ v, rows: parseEnvelope(r) as unknown[] }),
          () => ({ v, rows: null as unknown[] | null })
        )
      )
    : [];

  const [flows, klines, ois] = await Promise.all([Promise.all(flowP), Promise.all(klineP), Promise.all(oiP)]);

  const leadK = klines.find((k) => k.v === lead);
  if (!leadK || !leadK.rows) {
    // Fallback cleanly to Binance USDT-M klines + taker buy/sell bar totals
    const binCandles = await fetchBinCandles(sym, itv, limit).catch(() => []);
    if (!binCandles.length) throw new Error("lead kline unavailable");
    const res: FpLoadResult = {
      ok: true,
      supported: true,
      bucketsAvailable: false,
      source: "binance-fapi",
      reason: "Upstream price-ladder buckets unavailable — showing live Binance OHLC + bar taker volume/delta",
      sym,
      itv,
      limit,
      venues: ["binance-perp (kline fallback)"],
      missing: keys.map((k) => k.id),
      bars: binCandles.map((c) => ({ ts: c.t, o: c.o, h: c.h, l: c.l, c: c.c, fp: null, oio: null, oic: null })),
      candleFlow: binCandles.map((c) => ({
        ts: c.t,
        v: c.v,
        buyVol: c.tbb,
        sellVol: c.tbb != null ? Math.max(0, c.v - c.tbb) : undefined,
      })),
      updatedAt: Date.now(),
    };
    snapCache.set(ck, { at: Date.now(), res });
    return res;
  }
  const leadOhlc = toMap(
    leadK.rows,
    (row) => [num(row[1]), num(row[2]), num(row[3]), num(row[4])] as [number | null, number | null, number | null, number | null]
  );

  const flowMaps = flows.map((f) => ({
    v: f.v,
    map: f.rows ? toMap(f.rows, (row) => fpFromBuckets(row[1]) as Fp | null) : new Map<number, Fp | null>(),
    ok: !!f.rows,
  }));

  const klineCloses = new Map<string, Map<number, number | null>>();
  for (const k of klines) {
    if (k.v === lead || !k.rows) continue;
    klineCloses.set(k.v.id, toMap(k.rows, (row) => num(row[4])));
  }

  const oiMaps = ois.map((o) => ({
    v: o.v,
    map: o.rows ? toMap(o.rows, (row) => [num(row[1]), num(row[4])] as [number | null, number | null]) : new Map<number, [number | null, number | null]>(),
  }));

  for (const fm of flowMaps) {
    if (fm.v === lead) continue;
    const closes = klineCloses.get(fm.v.id);
    if (!closes) continue;
    const shifted = new Map<number, Fp | null>();
    for (const [ts, fp] of fm.map) {
      if (!fp) {
        shifted.set(ts, null);
        continue;
      }
      const vc = closes.get(ts);
      const leadC = leadOhlc.get(ts)?.[3];
      const off = null != vc && null != leadC ? leadC - vc : 0;
      shifted.set(ts, off ? { ...fp, lo: fp.lo + off } : fp);
    }
    fm.map = shifted;
  }

  const bars: FpBar[] = [];
  const missing: string[] = [];
  for (const fm of flowMaps) if (!fm.ok) missing.push(fm.v.id);

  const tsList = [...leadOhlc.keys()].sort((a, b) => a - b);
  for (const ts of tsList) {
    const ohlc = leadOhlc.get(ts)!;
    if (ohlc.some((x) => null == x)) continue;
    const fs: Fp[] = [];
    for (const fm of flowMaps) {
      const fp = fm.map.get(ts);
      if (fp) fs.push(fp);
    }
    const fp = fs.length > 1 ? mergeFp(fs) : fs[0] ?? null;
    let oio: number | null = null;
    let oic: number | null = null;
    if (withOi && oiMaps.length && oiMaps.every((o) => o.map.size > 0)) {
      let all = true;
      let so = 0;
      let sc = 0;
      for (const o of oiMaps) {
        const pair = o.map.get(ts);
        if (!pair || null == pair[0] || null == pair[1]) {
          all = false;
          break;
        }
        so += pair[0];
        sc += pair[1];
      }
      if (all) {
        oio = so;
        oic = sc;
      }
    }
    bars.push({ ts, o: ohlc[0]!, h: ohlc[1]!, l: ohlc[2]!, c: ohlc[3]!, fp, oio, oic });
  }

  if (!bars.length) throw new Error("no bars");
  const bucketsAvailable = bars.some((b) => !!b.fp);
  let candleFlow: FpLoadResult["candleFlow"];
  if (!bucketsAvailable) {
    const binCandles = await fetchBinCandles(sym, itv, limit).catch(() => []);
    if (binCandles.length) {
      candleFlow = binCandles.map((c) => ({
        ts: c.t,
        v: c.v,
        buyVol: c.tbb,
        sellVol: c.tbb != null ? Math.max(0, c.v - c.tbb) : undefined,
      }));
    }
  }
  const res: FpLoadResult = {
    ok: true,
    supported: true,
    bucketsAvailable,
    source: bucketsAvailable ? "coinglass" : "binance-fapi",
    ...(bucketsAvailable
      ? {}
      : { reason: "Upstream price-ladder buckets unavailable — showing live Binance OHLC + bar taker volume/delta" }),
    sym,
    itv,
    limit,
    venues: keys.map((v) => v.id),
    missing,
    bars,
    ...(candleFlow ? { candleFlow } : {}),
    updatedAt: Date.now(),
  };
  snapCache.set(ck, { at: Date.now(), res });
  return res;
}
