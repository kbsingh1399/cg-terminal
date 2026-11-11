import { NextRequest, NextResponse } from "next/server";
import { perpMapOf } from "@/lib/cg/perpmap";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/cnbc?syms=SP500,XAU,USO,EURUSD — CNBC's web quote webservice
 * (unofficial, keyless — live-verified 2026-11-11). Gives us what Yahoo
 * cannot: front-month FUTURES with settle price, open interest, roll
 * calendar (@GC.1 = GCZ26 Dec'26, @CL.1, @SI.1, @PL.1, @BZ.1, @NG.1) plus
 * live index/FX quotes (.SPX .NDX .DJI .DXY, EUR= JPY= GBP=).
 *
 * Symbol map is perpmap-driven and only contains VERIFIED forms (probed):
 * @ES.1 returns empty — the S&P futures reference is .SPX instead.
 * ~5s edge cache upstream; we cache 60s. Batched with pipe separators
 * (comma batching does not work — probed).
 */

const TTL_MS = 60_000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

interface CnbcQuote {
  symbol?: string;
  name?: string;
  last?: string;
  change?: string;
  change_pct?: string;
  settlePrice?: string;
  open_interest?: string;
  expiration_date?: string;
  altSymbol?: string;
  last_time?: string;
  exchange?: string;
  realTime?: string | boolean;
}

interface CacheEntry { at: number; body: unknown; err?: string }
const g = globalThis as unknown as { __cnbcCache?: Map<string, CacheEntry> };
const cache = (g.__cnbcCache ??= new Map());

function num(v: string | undefined): number | null {
  if (v == null || v === "") return null;
  // RV-DATA minor: CNBC sends change_pct with a trailing % sign — strip it
  const n = Number(String(v).replace(/,/g, "").replace(/%/g, ""));
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest) {
  const symsRaw = (req.nextUrl.searchParams.get("syms") ?? "").toUpperCase();
  if (!symsRaw) return NextResponse.json({ ok: false, error: "missing syms (comma list, e.g. syms=SP500,XAU,USO)" }, { status: 400 });
  const syms = [...new Set(symsRaw.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 12);
  const mapped: { sym: string; cnbc: string }[] = [];
  for (const s of syms) {
    const e = perpMapOf(s);
    if (e?.cnbc) mapped.push({ sym: s, cnbc: e.cnbc });
  }
  if (!mapped.length) {
    return NextResponse.json(
      { ok: false, error: `no CNBC symbol mapped for any of: ${syms.join(", ")} — mapped: SP500 NDX100 USO UKO NATGAS EURUSD USDJPY GBPUSD XAU XAG XPT` },
      { status: 400 }
    );
  }
  const key = mapped.map((m) => m.sym).join(",");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    if (hit.err) return NextResponse.json({ ok: false, error: hit.err }, { status: 502 });
    return NextResponse.json(hit.body);
  }

  const url =
    `https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=${encodeURIComponent(mapped.map((m) => m.cnbc).join("|"))}` +
    `&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&events=1`;
  let quotes: CnbcQuote[] | null = null;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(12_000) });
    if (res.status !== 200) {
      cache.set(key, { at: Date.now(), body: null, err: `cnbc HTTP ${res.status}` });
      return NextResponse.json({ ok: false, error: `cnbc HTTP ${res.status}` }, { status: 502 });
    }
    const j = (await res.json()) as { FormattedQuoteResult?: { FormattedQuote?: CnbcQuote[] } };
    quotes = j.FormattedQuoteResult?.FormattedQuote ?? [];
  } catch (e) {
    const msg = e instanceof Error ? e.message : "network error";
    cache.set(key, { at: Date.now(), body: null, err: msg });
    return NextResponse.json({ ok: false, error: `cnbc request failed: ${msg}` }, { status: 502 });
  }

  const byCnbc = new Map(quotes.map((q) => [String(q.symbol ?? "").toUpperCase(), q]));
  const out: Record<string, unknown> = {};
  for (const m of mapped) {
    const q = byCnbc.get(m.cnbc.toUpperCase());
    if (!q || (q.last == null && q.settlePrice == null)) {
      out[m.sym] = { ok: false, error: "empty quote" };
      continue;
    }
    out[m.sym] = {
      ok: true,
      cnbcSymbol: m.cnbc,
      name: q.name ?? null,
      last: num(q.last),
      change: num(q.change),
      changePct: num(q.change_pct),
      settle: num(q.settlePrice),
      openInterest: num(q.open_interest),
      activeContract: q.altSymbol ?? null,
      expiry: q.expiration_date ?? null,
      lastTime: q.last_time ?? null,
      isFuture: m.cnbc.startsWith("@"),
    };
  }
  const body = {
    ok: true,
    source: "CNBC quote-html-webservice (unofficial — field drift tolerated, Yahoo fallback)",
    quotes: out,
    fetchedAt: Date.now(),
  };
  cache.set(key, { at: Date.now(), body });
  if (cache.size > 48) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return NextResponse.json(body);
}
