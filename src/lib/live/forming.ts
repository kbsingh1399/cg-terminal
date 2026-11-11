"use client";

import { useEffect, useState } from "react";
import { useTradeTape } from "./feed";

/**
 * useLiveForming — the REAL-TIME forming-bar accumulator.
 *
 * Every aggregated trade off the Binance futures tape (WS aggTrade) is
 * folded into the currently forming bar of the selected interval the moment
 * it prints. Consumers merge the result on top of the multi-venue
 * Coinglass aggregate forming bar: trades newer than the aggregate's
 * `updatedAt` are ADDED (never double-counted), so the visible bar moves
 * tick-by-tick while the 8-second aggregate resync keeps the multi-venue
 * totals exact.
 */

export interface FormingAcc {
  /** unix SECONDS — the bar this accumulator is currently filling (same
   *  unit as FpBar.ts, so the overlay guard compares like with like) */
  barTs: number;
  /** last traded price (exchange "last price") */
  lastPrice: number | null;
  /** running totals of the forming bar (Binance share) */
  buyQty: number;
  sellQty: number;
  buyCnt: number;
  sellCnt: number;
  hi: number | null;
  lo: number | null;
  /** raw tape ring (last ~40 s) — the overlay folds trades newer than a cutoff */
  tape: { t: number; p: number; q: number; buy: boolean }[];
  /** timestamp of the LAST TRADE folded in (ms) — the honest liveness signal.
   *  NOT the commit time: a dead tape must age out, not look fresh. */
  lastTradeAt: number;
  /** commit timestamp of this snapshot (ms) */
  at: number;
}

export const ITV_MS: Record<string, number> = {
  m1: 60_000,
  m5: 300_000,
  m15: 900_000,
  m30: 1_800_000,
  h1: 3_600_000,
  h4: 14_400_000,
};

const COMMIT_HZ = 4; // React re-render rate for the forming bar
const TAPE_MS = 40_000;

// module-level accumulators (outside React so the tape callback can mutate
// them freely — the hook only READS snapshots at COMMIT_HZ).
// Exposed on globalThis for live debugging of the tape pipeline.
const stores: Map<string, FormingAcc> = ((globalThis as unknown as { __formingStores?: Map<string, FormingAcc> }).__formingStores ??= new Map());

function storeOf(sym: string, itv: string, stepMs: number): FormingAcc {
  const key = `${sym}|${itv}`;
  let s = stores.get(key);
  if (!s) {
    s = { barTs: 0, lastPrice: null, buyQty: 0, sellQty: 0, buyCnt: 0, sellCnt: 0, hi: null, lo: null, tape: [], lastTradeAt: 0, at: 0 };
    stores.set(key, s);
  }
  return s;
}

export function useLiveForming(sym: string, itv: string): FormingAcc | null {
  const [snap, setSnap] = useState<FormingAcc | null>(null);
  const stepMs = ITV_MS[itv] ?? 900_000;
  const key = `${sym}|${itv}`;

  // symbol/interval switch — render-adjust pattern (same as the canvases):
  // reset the snapshot so the old key's forming bar can never render under
  // the new key's header, not even for one frame. Store lifecycle (fresh
  // accumulator per mount) is handled by the effect below.
  const [lastKey, setLastKey] = useState(key);
  if (lastKey !== key) {
    setLastKey(key);
    setSnap(null);
  }

  useTradeTape(sym, (tr) => {
    // bar boundary in SECONDS (FpBar.ts unit)
    const stepS = stepMs / 1000;
    const barTs = Math.floor(tr.t / stepMs) * stepS;
    const a = storeOf(sym, itv, stepMs);
    // SANITY BAND (blowout fix, layer 2): one insane exchange print (p≈0 or
    // p≈∞) must never seed hi/lo — reject prints outside (0.25×, 4×) of the
    // accumulator's current state. No liquid asset in the universe moves 4×
    // in a 40 s tape window; the 8 s aggregate resync picks up genuine
    // extremes anyway.
    const ref = a.lastPrice ?? tr.p;
    if (ref > 0 && Number.isFinite(ref) && (tr.p < ref * 0.25 || tr.p > ref * 4)) return;
    if (!Number.isFinite(tr.p) || !(tr.p > 0)) return;
    if (!a.barTs || a.barTs !== barTs) {
      if (a.barTs && barTs < a.barTs) return; // stale out-of-order print
      a.barTs = barTs;
      a.lastPrice = null;
      a.buyQty = 0;
      a.sellQty = 0;
      a.buyCnt = 0;
      a.sellCnt = 0;
      a.hi = null;
      a.lo = null;
      a.tape = [];
    }
    a.lastPrice = tr.p;
    a.lastTradeAt = tr.t;
    if (tr.buy) {
      a.buyQty += tr.q;
      a.buyCnt += 1;
    } else {
      a.sellQty += tr.q;
      a.sellCnt += 1;
    }
    if (a.hi == null || tr.p > a.hi) a.hi = tr.p;
    if (a.lo == null || tr.p < a.lo) a.lo = tr.p;
    a.tape.push({ t: tr.t, p: tr.p, q: tr.q, buy: tr.buy });
    const cut = tr.t - TAPE_MS;
    if (a.tape.length > 64 && a.tape[0].t < cut) a.tape = a.tape.filter((x) => x.t >= cut);
  });

  useEffect(() => {
    // FRESH accumulator per mount: a remount mid-bar (tab switch and back)
    // must not resurrect the pre-unmount price/delta as "live" — the store
    // rebuilds from new prints only. Cleanup drops the store so the map
    // stays bounded by currently-mounted consumers.
    stores.delete(key);
    const id = setInterval(() => {
      const a = stores.get(key);
      setSnap(a && a.lastPrice != null ? { ...a, tape: a.tape, at: a.lastTradeAt } : null);
    }, 1000 / COMMIT_HZ);
    return () => {
      clearInterval(id);
      stores.delete(key);
    };
  }, [key]);

  return snap;
}

/**
 * Fold the tape newer than `cutoffMs` into the aggregate Fp grid.
 * Pure function — exported for the footprint tool.
 */
export function foldTapeIntoFp(
  fp: { tick: number; lo: number; b: number[]; s: number[]; bc: number[]; sc: number[] },
  tape: { t: number; p: number; q: number; buy: boolean }[],
  cutoffMs: number
): { tick: number; lo: number; b: number[]; s: number[]; bc: number[]; sc: number[] } {
  const out = {
    tick: fp.tick,
    lo: fp.lo,
    b: [...fp.b],
    s: [...fp.s],
    bc: [...fp.bc],
    sc: [...fp.sc],
  };
  for (const tr of tape) {
    if (tr.t < cutoffMs) continue;
    let idx = Math.floor((tr.p - out.lo) / out.tick);
    if (idx < 0) {
      // price BELOW the aggregate grid (new low while aggregate is 8s old):
      // extend the grid downward
      const add = -idx;
      out.b = [...new Array(add).fill(0), ...out.b];
      out.s = [...new Array(add).fill(0), ...out.s];
      out.bc = [...new Array(add).fill(0), ...out.bc];
      out.sc = [...new Array(add).fill(0), ...out.sc];
      out.lo -= add * out.tick;
      idx = 0;
    } else if (idx >= out.b.length) {
      // price ABOVE the grid: extend upward
      const add = idx - out.b.length + 1;
      out.b = [...out.b, ...new Array(add).fill(0)];
      out.s = [...out.s, ...new Array(add).fill(0)];
      out.bc = [...out.bc, ...new Array(add).fill(0)];
      out.sc = [...out.sc, ...new Array(add).fill(0)];
    }
    if (tr.buy) {
      out.b[idx] += tr.q;
      out.bc[idx] += 1;
    } else {
      out.s[idx] += tr.q;
      out.sc[idx] += 1;
    }
  }
  return out;
}
