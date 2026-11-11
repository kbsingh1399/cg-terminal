import { NextRequest, NextResponse } from "next/server";
import {
  microMapOf, MICRO_SYMS, hlXyzSnapshot, hlBook, buildHlCard, recordOi, oiD24hPct,
  lighterBook, lighterTrades, buildLighterCard, krakenDepth,
  microCache as mkCache, microCached as cached, microStore as store,
  SNAP_TTL, BOOK_TTL,
  type MicroResp, type HlCard, type LighterCard, type KrakenCard, type HlCtx,
} from "@/lib/cg/micro";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/micro?sym=XAU — the L2/L3 microstructure layer (R4).
 *
 * Three independent free sources per instrument (see src/lib/cg/micro.ts header
 * for live-verification evidence and the honest rules):
 *   hl      — Hyperliquid xyz HIP-3 perp: L2 ladder w/ order count, OI(+Δ24h),
 *             1h funding (+APR if persisted), mark vs oracle, venue-health gate
 *   lighter — Lighter DEX true L3: resting orders clustered by owner account
 *             (directional whales vs quoting/MM), visible partial fills,
 *             maker/taker prints (count+span labelled), id-drift guards
 *   kraken  — real spot FX L2 depth (6 majors), staleness-gated
 *
 * Per-source {ok,error,suppressed} independence — one dead source never kills
 * the others; the whole response is ok:true when ANY source is ok. Unmapped
 * symbol → honest 400 listing the mapped universe (cot/route.ts convention).
 *
 * Caches (globalThis TTL, R3 convention; per-source maps, cap 128 — RV-ARCH m2):
 * xyz dex snapshot 60s (shared) · books/trades/depth 30s (RV-ARCH M1) ·
 * errors 30s (transient upstreams must not pin dead panels).
 *
 * Concurrency (RV-SEC): the three source chains (HL snap+book, Lighter
 * book+trades, Kraken) fetch CONCURRENTLY — worst-case latency is max(chain)
 * ≈16s cold, not the 40s sum. Card assembly stays ordered because the
 * Lighter drift guard consumes this response's HL mark.
 */

// Cache helpers + TTLs live in @/lib/cg/micro (shared with microLiveQuote so
// the classic route's live anchors ride the same warm entries — no doubled
// upstream weight).

const HL_ERR: HlCard = { ok: false, error: "xyz snapshot/book unavailable", coin: "?", mark: null, oracle: null,
  markVsOraclePct: null, vol24hUsd: null, oiBase: null, oiNotionalUsd: null, oiD24hPct: null,
  funding1hPct: null, fundingAprPct: null, spreadPct: null,
  bids: { levels: [], notionalUsd: 0 }, asks: { levels: [], notionalUsd: 0 }, imbalance20: null };

const LO_ERR = (id: number, symbol: string, err: string): LighterCard => ({ ok: false, error: err,
  marketId: id, symbol, kind: null, bestBid: null, bestAsk: null, spreadPct: null, nResting: 0,
  capHint: false, bidNotionalUsd: 0, askNotionalUsd: 0, imbalance: null, whales: [], quoting: [],
  partials: [], prints: [], printSpanS: null, newestPrintAgeS: null, takerBuyUsd: null, takerSellUsd: null });

const KR_ERR = (pair: string, err: string): KrakenCard => ({ ok: false, error: err, pair, bestBid: null,
  bestAsk: null, spreadPct: null, bids: [], asks: [], imbalance10: null, stale: false });

export async function GET(req: NextRequest) {
  const sym = (req.nextUrl.searchParams.get("sym") ?? "").toUpperCase();
  if (!sym) return NextResponse.json({ ok: false, error: "missing sym" }, { status: 400 });
  const cfg = microMapOf(sym);
  if (!cfg) {
    return NextResponse.json(
      { ok: false, error: `no L2/L3 microstructure mapped for ${sym} — mapped: ${MICRO_SYMS.filter((s) => s !== "SP500").join(" ")}` },
      { status: 400 }
    );
  }

  const now = Date.now();
  const snapCache = mkCache<Record<string, HlCtx>>("__microHlSnap");
  const bookCache = mkCache<Awaited<ReturnType<typeof hlBook>>>("__microHlBook");
  const loBookCache = mkCache<Awaited<ReturnType<typeof lighterBook>>>("__microLoBook");
  const loTradesCache = mkCache<Awaited<ReturnType<typeof lighterTrades>>>("__microLoTrades");
  const krCache = mkCache<KrakenCard>("__microKraken");

  // ---- fetch phase — the three source groups run CONCURRENTLY (RV-SEC:
  // worst-case latency is max(chain), not sum). The Lighter drift cross-check
  // consumes this response's HL mark, so card ASSEMBLY stays ordered:
  // fetches parallel → hl resolves → lighter builds with hlMark → kraken joins.
  const hlTask = (async (): Promise<HlCard | undefined> => {
    if (!cfg.hl) return undefined;
    const coin = cfg.hl.coin;
    const snapHit = cached(snapCache, "dex", SNAP_TTL);
    let snap = snapHit.hit;
    // ERROR HONESTY (P2): snapHit/bookHit are read BEFORE the fetch attempt —
    // reading THEM back in the error return hid a just-thrown upstream message
    // (it went into the cache but the card fell back to the generic HL_ERR
    // text). The locals below carry either the cached error or the FRESH one.
    let snapErr = snapHit.err;
    if (!snap && !snapErr) {
      try {
        snap = await hlXyzSnapshot();
        store(snapCache, "dex", snap);
      } catch (e) {
        snapErr = e instanceof Error ? e.message : "hl snapshot failed";
        store(snapCache, "dex", null, snapErr);
      }
    }
    const bookHit = cached(bookCache, coin, BOOK_TTL);
    let book = bookHit.hit;
    let bookErr = bookHit.err;
    if (!book && !bookErr) {
      try {
        book = await hlBook(coin);
        store(bookCache, coin, book);
      } catch (e) {
        bookErr = e instanceof Error ? e.message : "hl book failed";
        store(bookCache, coin, null, bookErr);
      }
    }
    if (snap && book) {
      const ctx = snap[coin];
      const card = buildHlCard(coin, ctx, book);
      if (ctx?.openInterest != null && Number.isFinite(+ctx.openInterest)) {
        const hist = recordOi(coin, +ctx.openInterest);
        if (card.oiBase != null) card.oiD24hPct = oiD24hPct(hist, card.oiBase);
      }
      if (!card.ok && card.suppressed) card.error = card.suppressed;
      return card;
    }
    return { ...HL_ERR, coin, error: snapErr ?? bookErr ?? HL_ERR.error };
  })();

  const loFetch = cfg.lighter
    ? (async () => {
        const idKey = String(cfg.lighter!.id);
        const bHit = cached(loBookCache, idKey, BOOK_TTL);
        let bErr = bHit.err; // same honesty fix as hlTask: fresh throw overrides the pre-fetch cache read
        const lbP = bErr ? null : (bHit.hit ?? lighterBook(cfg.lighter!.id).then((r) => { store(loBookCache, idKey, r); return r; }).catch((e) => { bErr = e instanceof Error ? e.message : "lighter book failed"; store(loBookCache, idKey, null, bErr); return null; }));
        const tHit = cached(loTradesCache, idKey, BOOK_TTL);
        let tErr = tHit.err;
        const ltP = tErr ? null : (tHit.hit ?? lighterTrades(cfg.lighter!.id).then((r) => { store(loTradesCache, idKey, r); return r; }).catch((e) => { tErr = e instanceof Error ? e.message : "lighter trades failed"; store(loTradesCache, idKey, null, tErr); return null; }));
        const [lb, lt] = await Promise.all([lbP, ltP]);
        return { lb, lt, bErr, tErr };
      })()
    : null;

  const krTask = cfg.kraken
    ? (async () => {
        const hit = cached(krCache, cfg.kraken!, BOOK_TTL);
        if (hit.err) return KR_ERR(cfg.kraken!, hit.err);
        if (hit.hit) return hit.hit;
        try {
          const kc = await krakenDepth(cfg.kraken!);
          store(krCache, cfg.kraken!, kc);
          return kc;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "kraken failed";
          store(krCache, cfg.kraken!, null, msg);
          return KR_ERR(cfg.kraken!, msg);
        }
      })()
    : null;

  // ---- assembly (ordered: HL first — its mark feeds the Lighter drift guard) ----
  const hl = await hlTask;
  const hlMarkForDrift = hl?.ok && hl.mark != null ? hl.mark : null;
  let lighter: LighterCard | undefined;
  if (cfg.lighter && loFetch) {
    const { lb, lt, bErr, tErr } = await loFetch;
    lighter = lb && lt
      ? buildLighterCard(cfg.lighter, lb, lt, hlMarkForDrift, now)
      : LO_ERR(cfg.lighter.id, cfg.lighter.symbol, bErr ?? tErr ?? "lighter book/trades unavailable");
  }
  const kraken = krTask ? await krTask : undefined;

  // ok = any source live OR suppressed-with-reason (RV-QA MAJOR-1: a
  // suppressed-only sym like XPT/JP225 must still render its amber THIN box,
  // not die as a 502). Plain dead-everything stays a 502.
  const anyOk = !!(hl?.ok || lighter?.ok || kraken?.ok || hl?.suppressed || lighter?.suppressed);
  const body: MicroResp = {
    ok: anyOk,
    sym,
    fetchedAt: now,
    ...(hl ? { hl } : {}),
    ...(lighter ? { lighter } : {}),
    ...(kraken ? { kraken } : {}),
    ...(cfg.note ? { note: cfg.note } : {}),
  } as MicroResp;
  if (!anyOk) {
    const reasons = [hl?.error, lighter?.error, kraken?.error].filter(Boolean).join(" · ");
    body.error = reasons || "all mapped microstructure sources failed";
  }
  return NextResponse.json(body, { status: anyOk ? 200 : 502 });
}
