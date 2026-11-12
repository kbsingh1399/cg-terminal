import { NextRequest, NextResponse } from "next/server";
import {
  microMapOf, MICRO_SYMS, MICRO_UNMAPPED_NOTES, hlDexOf, getHlSnapshot, hlBook, buildHlCard,
  recordOi, oiD24hPct, lighterBook, lighterTrades, buildLighterCard, fetchBboSection,
  microCache as mkCache, microCached as cached, microStore as store, microCachedAt,
  BOOK_TTL, STALE_MS,
  type MicroResp, type HlCard, type LighterCard, type BboSection,
} from "@/lib/cg/micro";
import { resolveCurated } from "@/lib/universe/curated";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/micro?sym=BTC — the L2/L3 microstructure layer (R4; full-universe
 * expansion QB 2026-11-12: 30 crypto perps + 28 TradFi perps + 3 classics).
 *
 * Independent free sources per instrument (see src/lib/cg/micro.ts header for
 * live-verification evidence and the honest rules):
 *   hl      — Hyperliquid perp L2 ladder w/ order count, OI(+Δ24h), 1h funding
 *             (+APR if persisted), mark vs oracle, venue-health gate. TWO dexes:
 *             xyz HIP-3 (xyz:* coins) and the MAIN dex (BTC, ETH, …, kPEPE).
 *   lighter — Lighter DEX true L3: resting orders clustered by owner account
 *             (directional whales vs quoting/MM), visible partial fills,
 *             maker/taker prints (count+span labelled), id-drift guards
 *   bbo     — multi-venue best-bid/offer: Binance fapi bookTicker (5s cache),
 *             OKX USDT-SWAP ticker (10s), Bybit linear tickers (10s), Coinbase
 *             spot ticker (10s, BTC/ETH/SOL/DOGE/XRP/LINK only). Every venue
 *             failure is {ok:false, reason}; bestBbo = tightest spreadBps.
 *
 * Per-source {ok,error,suppressed} independence — one dead source never kills
 * the others; the whole response is ok:true when ANY source is ok. Unmapped
 * unknown symbol → honest 200 {ok:true, supported:false} listing the mapped
 * universe (cot/route.ts convention). Curated members with NO HL/Lighter market
 * (VET, QQQ, ANTHROPIC — verified absences, MICRO_UNMAPPED_NOTES) get the same
 * 200 supported:false shape but WITH their multi-venue BBO.
 *
 * Caches (globalThis TTL, R3 convention; per-source maps, cap 128 — RV-ARCH m2):
 * HL dex snapshots 60s (shared, per-dex) · books/trades 30s (RV-ARCH M1) ·
 * Binance BBO 5s · OKX/Bybit/Coinbase BBO 10s · errors 30s (transient upstreams
 * must not pin dead panels).
 *
 * Concurrency (RV-SEC): HL snap+book, Lighter book+trades AND the 4 BBO venues
 * all fetch CONCURRENTLY — worst-case latency is max(chain), not the sum. Card
 * assembly stays ordered because the Lighter drift guard consumes this
 * response's HL mark.
 *
 * Freshness telemetry (QB): dataAt = the OLDEST successful upstream fetch
 * completion time tracked during assembly (cache hits count at their original
 * store time — a warm body is honestly aged, never re-stamped); ageMs/stale
 * derive from it; source lists which legs actually contributed.
 */

const HL_ERR: HlCard = { ok: false, error: "HL snapshot/book unavailable", coin: "?", mark: null, oracle: null,
  markVsOraclePct: null, vol24hUsd: null, oiBase: null, oiNotionalUsd: null, oiD24hPct: null,
  funding1hPct: null, fundingAprPct: null, spreadPct: null,
  bids: { levels: [], notionalUsd: 0 }, asks: { levels: [], notionalUsd: 0 }, imbalance20: null };

const LO_ERR = (id: number, symbol: string, err: string): LighterCard => ({ ok: false, error: err,
  marketId: id, symbol, kind: null, bestBid: null, bestAsk: null, spreadPct: null, nResting: 0,
  capHint: false, bidNotionalUsd: 0, askNotionalUsd: 0, imbalance: null, whales: [], quoting: [],
  partials: [], prints: [], printSpanS: null, newestPrintAgeS: null, takerBuyUsd: null, takerSellUsd: null });

export async function GET(req: NextRequest) {
  const sym = (req.nextUrl.searchParams.get("sym") ?? "").toUpperCase();
  if (!sym) return NextResponse.json({ ok: false, error: "missing sym" }, { status: 400 });
  const cfg = microMapOf(sym);
  const curated = resolveCurated(sym);
  // BBO is served for every micro-mapped sym AND every curated perp (58) —
  // even the ones with no HL/Lighter market (VET, QQQ, ANTHROPIC).
  const bboEligible = !!cfg || !!curated?.pair;

  if (!cfg && !bboEligible) {
    // 200 (ok:true, supported:false) — an asset with no HL/Lighter/Binance
    // market degrades honestly instead of painting a red 400 in every
    // browser console (user directive: zero console noise across all 61).
    return NextResponse.json(
      {
        ok: true,
        supported: false,
        unmapped: true,
        sym,
        reason: `no L2/L3 microstructure market mapped for ${sym} on Hyperliquid/Lighter and no Binance perp for a multi-venue BBO — curated members with an exchange book use /api/binance/* depth routes`,
        mapped: MICRO_SYMS.filter((s) => s !== "SP500"),
        dataAt: Date.now(),
        ageMs: 0,
        stale: false,
        source: "micro-map",
      },
      { status: 200 }
    );
  }

  if (!cfg) {
    // Curated perp with a verified-absent HL/Lighter market (VET, QQQ,
    // ANTHROPIC): serve the multi-venue BBO with the honest reason.
    const bbo = await fetchBboSection(sym).catch(() => null);
    const okAts = bbo?.venues.filter((v) => v.ok).map((v) => v.at) ?? [];
    const dataAt = okAts.length ? Math.min(...okAts) : Date.now();
    const reasonKey = curated?.sym ?? sym;
    return NextResponse.json(
      {
        ok: true,
        supported: false,
        unmapped: true,
        sym,
        reason:
          MICRO_UNMAPPED_NOTES[reasonKey] ??
          `no L2/L3 microstructure market mapped for ${sym} on Hyperliquid/Lighter — multi-venue BBO is served`,
        mapped: MICRO_SYMS.filter((s) => s !== "SP500"),
        ...(bbo ? { bbo } : {}),
        dataAt,
        ageMs: Date.now() - dataAt,
        stale: Date.now() - dataAt > STALE_MS,
        source: bbo?.best ? "bbo" : "none",
        ...(bbo ? { missingVenues: bbo.missingVenues } : {}),
      },
      { status: 200 }
    );
  }

  const now = Date.now();
  const bookCache = mkCache<Awaited<ReturnType<typeof hlBook>>>("__microHlBook");
  const loBookCache = mkCache<Awaited<ReturnType<typeof lighterBook>>>("__microLoBook");
  const loTradesCache = mkCache<Awaited<ReturnType<typeof lighterTrades>>>("__microLoTrades");
  const dex = cfg.hl ? hlDexOf(cfg.hl.coin) : null;

  // successful upstream fetch completion times — dataAt = min(...) at the end
  const ats: number[] = [];

  // ---- fetch phase — HL + Lighter + BBO run CONCURRENTLY (RV-SEC:
  // worst-case latency is max(chain), not sum). The Lighter drift cross-check
  // consumes this response's HL mark, so card ASSEMBLY stays ordered:
  // fetches parallel → hl resolves → lighter builds with hlMark.
  const hlTask = (async (): Promise<HlCard | undefined> => {
    if (!cfg.hl) return undefined;
    const coin = cfg.hl.coin;
    // dex-aware snapshot (main vs xyz) with shared per-dex caching — the old
    // code always requested the xyz dex; main-dex coins (BTC…) need the
    // no-dex-param request (verified live 2026-11-12).
    const { snap, err: snapErr, at: snapAt } = await getHlSnapshot(dex!);
    if (snapAt != null) ats.push(snapAt);
    const bookHit = cached(bookCache, coin, BOOK_TTL);
    let book = bookHit.hit;
    // ERROR HONESTY (P2): bookHit is read BEFORE the fetch attempt — reading
    // IT back in the error return hid a just-thrown upstream message (it went
    // into the cache but the card fell back to the generic HL_ERR text). The
    // locals below carry either the cached error or the FRESH one.
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
    const bookAt = microCachedAt(bookCache, coin);
    if (book && bookAt != null) ats.push(bookAt);
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
        const bAt = microCachedAt(loBookCache, idKey);
        const tAt = microCachedAt(loTradesCache, idKey);
        if (lb && bAt != null) ats.push(bAt);
        if (lt && tAt != null) ats.push(tAt);
        return { lb, lt, bErr, tErr };
      })()
    : null;

  // fetchBboSection never throws internally; the catch is a belt-and-braces
  // guard so a catastrophic failure can never 500 the whole micro response.
  const bboTask: Promise<BboSection | null> = bboEligible
    ? fetchBboSection(sym).catch(() => null)
    : Promise.resolve(null);

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
  const bbo = await bboTask;
  if (bbo) for (const v of bbo.venues) if (v.ok) ats.push(v.at);

  // ok = any source live OR suppressed-with-reason (RV-QA MAJOR-1: a
  // suppressed-only sym like XPT/JP225 must still render its amber THIN box,
  // not die as a 502). A live BBO venue also keeps the response alive when the
  // HL/Lighter legs are down. Plain dead-everything stays a 502.
  const anyOk = !!(hl?.ok || lighter?.ok || hl?.suppressed || lighter?.suppressed || bbo?.best);
  const dataAt = ats.length ? Math.min(...ats) : Date.now();
  const ageMs = Date.now() - dataAt;
  const srcParts: string[] = [];
  if ((hl?.ok || hl?.suppressed) && cfg.hl) srcParts.push(`hl-${hlDexOf(cfg.hl.coin)}`);
  if (lighter?.ok || lighter?.suppressed) srcParts.push("lighter");
  if (bbo?.best) srcParts.push("bbo");
  const body: MicroResp = {
    ok: anyOk,
    sym,
    fetchedAt: now,
    ...(hl ? { hl } : {}),
    ...(lighter ? { lighter } : {}),
    ...(bbo ? { bbo } : {}),
    ...(cfg.note ? { note: cfg.note } : {}),
    dataAt,
    ageMs,
    stale: ageMs > STALE_MS,
    source: srcParts.length ? srcParts.join("+") : "none",
    ...(bbo ? { missingVenues: bbo.missingVenues } : {}),
  };
  if (!anyOk) {
    const reasons = [hl?.error, lighter?.error].filter(Boolean).join(" · ");
    body.error = reasons || "all mapped microstructure sources failed";
  }
  return NextResponse.json(body, { status: anyOk ? 200 : 502 });
}
