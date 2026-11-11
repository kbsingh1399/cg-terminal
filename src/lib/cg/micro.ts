/**
 * Micro-map + fetchers — the L2/L3 microstructure layer (R4, 2026-11-11).
 *
 * LIVE-VERIFIED sources (evidence: scripts/research/probes/l2l3/ — probe_l2l3_sources.py,
 * verify_l2l3_mapping.py, probe_l2l3_fix.py; design: scripts/research/MICRO-DESIGN-R4.md
 * incl. the RV-ARCH + RV-QUANT review addendum whose conditions are all implemented here):
 *
 *  1. Hyperliquid xyz HIP-3 perps — POST api.hyperliquid.xyz/info
 *     · {"type":"metaAndAssetCtxs","dex":"xyz"} → 144 markets: mark, oracle, OI,
 *       1h funding, vol24h. · {"type":"l2Book","coin":"xyz:GOLD"} → 20 levels/side
 *       {px, sz, n} where n = resting order count.
 *  2. Lighter DEX (ZK-rollup CLOB) — mainnet.zklighter.elliot.ai/api/v1
 *     · orderBookOrders?market_id&limit → {code, asks[], bids[]} TRUE L3:
 *       order_id, owner_account_index, initial/remaining_base_amount, price, order_expiry.
 *     · recentTrades → maker/taker attribution (ask_account_id, bid_account_id,
 *       is_maker_ask, usd_amount) + market_symbol echo (drift guard).
 *  3. Kraken spot FX — api.kraken.com/0/public/Depth (real fiat-to-fiat L2).
 *
 * Honest rules (never fabricate):
 *  · THIN suppression per source: HL card dies below $5M vol24h (JP225, XPT, xyz:EUR,
 *    BABA, NFLX, QCOM, GME…); Lighter card dies below $250k visible side notional.
 *  · Whale floor max($50k, 5% of visible side notional); two-sided accounts (both
 *    sides ≥20% of own notional) are "quoting/MM" context, never directional whales.
 *  · "Visible partials only" — fully-filled orders vanish from the book (censored).
 *  · funding APR = 1h rate × 8760, labelled "if persisted"; |APR|>500 → null.
 *  · Venue-health gate: |mark−oracle|>0.3% or |APR|>200% → xyz reads suppressed
 *    (venue stress is not market signal — NATGAS 574% APR trips this).
 *  · Lighter id drift guard: market_symbol echo must match; Lighter mid vs HL mark
 *    must agree within 1.5% when both live.
 *  · Order AGE is NOT computable (transaction_time returns 0) — only TTL via
 *    order_expiry. We never print a fabricated age.
 *  · ΔOI 24h from an hourly in-memory history — honest null until ≥23h observed.
 *  · Execution stays at broker MT5 — these venues are SIGNAL markets only.
 */

export interface MicroHlCfg { coin: string }
export interface MicroLighterCfg { id: number; symbol: string }
export interface MicroMapEntry {
  hl?: MicroHlCfg;
  lighter?: MicroLighterCfg;
  kraken?: string;
  note?: string;
}

// Terminal symbol -> verified source keys. SP500 aliases SPX500 (perpmap B3 lesson).
// Kraken NZDUSD probed = "Unknown asset pair" — dropped (6 majors live).
// GOOG (registry) rides xyz:GOOGL — share-class proxy, labeled in note.
export const MICRO_MAP: Record<string, MicroMapEntry> = {
  // metals (perp-registry assets get their L3 here; Coinglass engine stays untouched)
  XAU: { hl: { coin: "xyz:GOLD" }, lighter: { id: 92, symbol: "XAU" } },
  XAG: { hl: { coin: "xyz:SILVER" }, lighter: { id: 93, symbol: "XAG" } },
  XPT: { hl: { coin: "xyz:PLATINUM" }, note: "xyz platinum is thin (~$1M/day) — HL card auto-suppresses below $5M" },
  // indices
  SPX500: { hl: { coin: "xyz:SP500" }, lighter: { id: 180, symbol: "US500" } },
  SP500: { hl: { coin: "xyz:SP500" }, lighter: { id: 180, symbol: "US500" }, note: "alias of SPX500" },
  NDX100: { hl: { coin: "xyz:XYZ100" }, lighter: { id: 181, symbol: "US100" }, note: "XYZ100 = Nasdaq-100 tracker market" },
  JP225: { hl: { coin: "xyz:JP225" }, note: "xyz JP225 thin (~$1M/day) — HL card auto-suppresses" },
  // energies
  USO: { hl: { coin: "xyz:CL" }, lighter: { id: 145, symbol: "WTI" }, note: "WTI crude" },
  UKO: { hl: { coin: "xyz:BRENTOIL" }, lighter: { id: 159, symbol: "BRENTOIL" } },
  NATGAS: { hl: { coin: "xyz:NATGAS" }, lighter: { id: 158, symbol: "NATGAS" }, note: "watchlist — not broker-listed" },
  // FX
  EURUSD: { hl: { coin: "xyz:EUR" }, lighter: { id: 96, symbol: "EURUSD" }, kraken: "EURUSD" },
  USDJPY: { hl: { coin: "xyz:JPY" }, lighter: { id: 98, symbol: "USDJPY" }, kraken: "USDJPY" },
  GBPUSD: { lighter: { id: 97, symbol: "GBPUSD" }, kraken: "GBPUSD", note: "xyz:GBP dead ($37k/day) — omitted by design" },
  AUDUSD: { kraken: "AUDUSD" },
  USDCAD: { kraken: "USDCAD" },
  USDCHF: { kraken: "USDCHF" },
  // US equities (xyz HIP-3 perps; thin ones auto-suppress below $5M vol24h)
  AAPL: { hl: { coin: "xyz:AAPL" } },
  AMZN: { hl: { coin: "xyz:AMZN" } },
  GOOG: { hl: { coin: "xyz:GOOGL" }, note: "xyz:GOOGL = Class A proxy for registry GOOG (Class C)" },
  MSFT: { hl: { coin: "xyz:MSFT" } },
  NVDA: { hl: { coin: "xyz:NVDA" } },
  TSLA: { hl: { coin: "xyz:TSLA" } },
  AMD: { hl: { coin: "xyz:AMD" } },
  META: { hl: { coin: "xyz:META" } },
  INTC: { hl: { coin: "xyz:INTC" } },
  MU: { hl: { coin: "xyz:MU" } },
  // BABA/NFLX verified live but <$5M/day — auto-suppress; no entry needed (honest absence).
};

export function microMapOf(sym: string): MicroMapEntry | undefined {
  return MICRO_MAP[sym.toUpperCase()];
}

export const MICRO_SYMS = Object.keys(MICRO_MAP);

// ---------------------------------------------------------------------------
// types shared with the route/UI

export interface HlLevel { px: number; sz: number; n: number }
export interface HlBookSide { levels: HlLevel[]; notionalUsd: number }
export interface HlCard {
  ok: boolean;
  error?: string;
  coin: string;
  mark: number | null;
  oracle: number | null;
  markVsOraclePct: number | null;
  vol24hUsd: number | null;
  oiBase: number | null;
  oiNotionalUsd: number | null;
  oiD24hPct: number | null;       // honest null until ≥23h in-memory history
  funding1hPct: number | null;
  fundingAprPct: number | null;   // = 1h rate × 8760, "if persisted"
  fundingAprNote?: string;        // "data error" when |APR|>500
  spreadPct: number | null;
  bids: HlBookSide;
  asks: HlBookSide;
  imbalance20: number | null;     // bid notional / (bid+ask) — snapshot, noisy
  suppressed?: string;            // venue-health / thin reason
}

export interface LighterWhale {
  account: string;
  orders: number;
  notionalUsd: number;
  side: "bid" | "ask";
  avgPx: number;
  pxLo: number;
  pxHi: number;
  fillPct: number | null;         // visible partials average, censored sample
}
export interface LighterPartial {
  orderId: string;
  account: string;
  px: number;
  initialSz: number;
  remainingSz: number;
  fillPct: number;
}
export interface LighterPrint {
  px: number;
  sz: number;
  usd: number;
  isMakerAsk: boolean;            // true = taker bought into resting ask
  ts: number;
}
export interface LighterCard {
  ok: boolean;
  error?: string;
  marketId: number;
  symbol: string;
  kind: string | null;
  bestBid: number | null;
  bestAsk: number | null;
  spreadPct: number | null;
  nResting: number;
  capHint: boolean;               // 250/side REST cap reached
  bidNotionalUsd: number;
  askNotionalUsd: number;
  imbalance: number | null;
  whales: LighterWhale[];
  quoting: { account: string; orders: number; notionalUsd: number }[];
  partials: LighterPartial[];
  prints: LighterPrint[];
  printSpanS: number | null;
  newestPrintAgeS: number | null;
  takerBuyUsd: number | null;
  takerSellUsd: number | null;
  suppressed?: string;
}

export interface KrakenLevel { px: number; sz: number; ts: number }
export interface KrakenCard {
  ok: boolean;
  error?: string;
  pair: string;
  bestBid: number | null;
  bestAsk: number | null;
  spreadPct: number | null;
  bids: KrakenLevel[];
  asks: KrakenLevel[];
  imbalance10: number | null;
  stale: boolean;                 // newest level >120s old (RV-QUANT B4)
  staleReason?: string;
}

export interface MicroResp {
  ok: boolean;
  sym: string;
  fetchedAt: number;
  hl?: HlCard;
  lighter?: LighterCard;
  kraken?: KrakenCard;
  error?: string;
}

// ---------------------------------------------------------------------------
// fetch plumbing (R3 conventions: UA, no-store, timeout; caches live in the route)

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function getJson<T>(url: string, timeoutMs = 8_000): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function postJson<T>(url: string, body: unknown, timeoutMs = 8_000): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Hyperliquid xyz

interface HlCtx { dayNtlVlm?: string; funding?: string; markPx?: string; openInterest?: string; oraclePx?: string }
export type { HlCtx }
interface HlMetaResp { universe?: { name: string }[] }
type HlDexResp = [HlMetaResp, (HlCtx | null)[]];
interface HlBookResp { levels?: { px: string; sz: string; n: number }[][] }

/** shared snapshot of the whole xyz dex (mark/oracle/OI/funding/vol per coin) */
export async function hlXyzSnapshot(): Promise<Record<string, HlCtx>> {
  const [meta, ctxs] = await postJson<HlDexResp>("https://api.hyperliquid.xyz/info", { type: "metaAndAssetCtxs", dex: "xyz" }, 8_000);
  const out: Record<string, HlCtx> = {};
  const uni = meta?.universe ?? [];
  uni.forEach((u, i) => {
    const c = ctxs?.[i];
    if (u?.name && c) out[u.name] = c;
  });
  return out;
}

export async function hlBook(coin: string): Promise<{ bids: HlLevel[]; asks: HlLevel[] }> {
  const j = await postJson<HlBookResp>("https://api.hyperliquid.xyz/info", { type: "l2Book", coin }, 8_000);
  const raw = j.levels ?? [[], []];
  const map = (arr: { px: string; sz: string; n: number }[]): HlLevel[] =>
    arr.map((l) => ({ px: +l.px, sz: +l.sz, n: l.n })).filter((l) => Number.isFinite(l.px));
  return { bids: map(raw[0] ?? []), asks: map(raw[1] ?? []) };
}

/** hourly OI history (globalThis — honest null until ≥23h observed) */
interface OiSample { t: number; oi: number }
const gHl = globalThis as unknown as { __hlOiHist?: Map<string, OiSample[]> };
const oiHist = (gHl.__hlOiHist ??= new Map<string, OiSample[]>());

export function recordOi(coin: string, oi: number): OiSample[] {
  const h = oiHist.get(coin) ?? [];
  const now = Date.now();
  if (!h.length || now - h[h.length - 1].t > 55 * 60_000) {
    h.push({ t: now, oi });
    while (h.length > 26) h.shift(); // ~25h
    oiHist.set(coin, h);
  }
  return h;
}

export function oiD24hPct(hist: OiSample[], oiNow: number): number | null {
  if (hist.length < 2) return null;
  const target = Date.now() - 23 * 3600_000;
  const base = hist.find((s) => s.t >= target) ?? hist[0];
  if (Date.now() - base.t < 23 * 3600_000) return null; // not enough history yet
  if (!base.oi) return null;
  return +((((oiNow - base.oi) / base.oi) * 100).toFixed(2));
}

export function buildHlCard(coin: string, ctx: HlCtx | undefined, book: { bids: HlLevel[]; asks: HlLevel[] }): HlCard {
  const card: HlCard = {
    ok: true, coin,
    mark: ctx?.markPx != null ? +ctx.markPx : null,
    oracle: ctx?.oraclePx != null ? +ctx.oraclePx : null,
    markVsOraclePct: null,
    vol24hUsd: ctx?.dayNtlVlm != null ? Math.round(+ctx.dayNtlVlm) : null,
    oiBase: ctx?.openInterest != null ? +ctx.openInterest : null,
    oiNotionalUsd: null,
    oiD24hPct: null,
    funding1hPct: ctx?.funding != null ? +( (+ctx.funding) * 100 ).toFixed(5) : null,
    fundingAprPct: null,
    spreadPct: null,
    bids: { levels: book.bids.slice(0, 20), notionalUsd: 0 },
    asks: { levels: book.asks.slice(0, 20), notionalUsd: 0 },
    imbalance20: null,
  };
  card.bids.notionalUsd = Math.round(book.bids.slice(0, 20).reduce((a, l) => a + l.px * l.sz, 0));
  card.asks.notionalUsd = Math.round(book.asks.slice(0, 20).reduce((a, l) => a + l.px * l.sz, 0));
  const tot = card.bids.notionalUsd + card.asks.notionalUsd;
  if (tot > 0) card.imbalance20 = +(card.bids.notionalUsd / tot).toFixed(3);
  if (card.mark != null && card.oracle) card.markVsOraclePct = +(((card.mark - card.oracle) / card.oracle) * 100).toFixed(3);
  if (card.mark != null && card.oiBase != null) card.oiNotionalUsd = Math.round(card.mark * card.oiBase);
  if (card.funding1hPct != null) {
    const apr = +(card.funding1hPct * 8760).toFixed(2); // 1h rate × 8760h — fixtures: 0.00063→5.51, 0.00452→39.58, −0.0145→−127.02
    if (Math.abs(apr) > 500) {
      card.fundingAprNote = "data error — 1h rate implies |APR|>500%, suppressed";
    } else {
      card.fundingAprPct = apr;
    }
  }
  const bb = book.bids[0]?.px, ba = book.asks[0]?.px;
  if (bb && ba) card.spreadPct = +(((ba - bb) / bb) * 100).toFixed(4);
  // venue-health gate (RV-QUANT rule 2) + thin suppression (B3)
  const dislocated = card.markVsOraclePct != null && Math.abs(card.markVsOraclePct) > 0.3;
  const hotFunding = card.fundingAprPct != null && Math.abs(card.fundingAprPct) > 200;
  const thin = card.vol24hUsd != null && card.vol24hUsd < 5_000_000;
  if (dislocated || hotFunding) {
    card.ok = false;
    card.suppressed = dislocated
      ? `venue dislocation: mark ${card.markVsOraclePct}% vs oracle (|>0.3%|) — xyz reads suppressed, venue stress is not market signal`
      : `funding stress: APR ${card.fundingAprPct}% (>200%) — xyz reads suppressed; 1h rate ${card.funding1hPct}%/h is real but the venue is overheated`;
  } else if (thin) {
    card.ok = false;
    card.suppressed = `thin xyz market: $${((card.vol24hUsd ?? 0) / 1e6).toFixed(2)}M/24h < $5M — suppressed rather than misread`;
  }
  return card;
}

// ---------------------------------------------------------------------------
// Lighter DEX

interface LoOrder {
  order_id?: string;
  order_index?: number | string;
  owner_account_index?: number | string;
  initial_base_amount?: string;
  remaining_base_amount?: string;
  price?: string;
  order_expiry?: number;
}
interface LoBookResp { code?: number; asks?: LoOrder[]; bids?: LoOrder[]; total_asks?: number; total_bids?: number }
interface LoTrade {
  market_symbol?: string; market_kind?: string;
  price?: string; size?: string; usd_amount?: string;
  is_maker_ask?: boolean; timestamp?: number | string;
}
type LoTradesResp = LoTrade[] | { trades?: LoTrade[] };

export async function lighterBook(marketId: number): Promise<{ asks: LoOrder[]; bids: LoOrder[]; capHint: boolean }> {
  const j = await getJson<LoBookResp>(`https://mainnet.zklighter.elliot.ai/api/v1/orderBookOrders?market_id=${marketId}&limit=250`, 8_000);
  // defensive caps (RV-SEC): bound what a hostile/compromised upstream can push
  // into memory — 400/side is generous over the documented 250 cap
  const asks = (j.asks ?? []).slice(0, 400), bids = (j.bids ?? []).slice(0, 400);
  return { asks, bids, capHint: asks.length >= 250 || bids.length >= 250 };
}

export async function lighterTrades(marketId: number): Promise<LoTrade[]> {
  const j = await getJson<LoTradesResp>(`https://mainnet.zklighter.elliot.ai/api/v1/recentTrades?market_id=${marketId}&limit=100`, 8_000);
  const arr = Array.isArray(j) ? j : (j.trades ?? []);
  return arr.slice(0, 150); // defensive cap (RV-SEC)
}

const WHALE_ABS_FLOOR = 50_000;
const WHALE_PCT_FLOOR = 0.05;

export function buildLighterCard(
  cfg: MicroLighterCfg,
  book: { asks: LoOrder[]; bids: LoOrder[]; capHint: boolean },
  trades: LoTrade[],
  hlMark: number | null,
  now: number
): LighterCard {
  const num = (v: unknown): number => (v == null ? NaN : +v);
  const sideOf = (o: LoOrder) => ({ px: num(o.price), rem: num(o.remaining_base_amount), init: num(o.initial_base_amount) });
  const askNotional = book.asks.reduce((a, o) => { const s = sideOf(o); return a + (Number.isFinite(s.px) && Number.isFinite(s.rem) ? s.px * s.rem : 0); }, 0);
  const bidNotional = book.bids.reduce((a, o) => { const s = sideOf(o); return a + (Number.isFinite(s.px) && Number.isFinite(s.rem) ? s.px * s.rem : 0); }, 0);
  // ±Infinity guard (P2): Math.min()/Math.max() over an EMPTY spread returns
  // ±Infinity — a non-empty side whose prices are ALL non-finite used to leak
  // Infinity/-Infinity into bestBid/bestAsk → mid, spreadPct (NaN) and the
  // HL-mark drift guard. Filter FIRST; null when empty-after-filter, on BOTH
  // sides — every derived value below is then finite-or-null by construction.
  const askPx = book.asks.map((o) => num(o.price)).filter(Number.isFinite);
  const bidPx = book.bids.map((o) => num(o.price)).filter(Number.isFinite);
  const bestAsk = askPx.length ? Math.min(...askPx) : null;
  const bestBid = bidPx.length ? Math.max(...bidPx) : null;
  const mid = bestBid != null && bestAsk != null ? (bestBid + bestAsk) / 2 : (bestBid ?? bestAsk);

  const card: LighterCard = {
    ok: true, marketId: cfg.id, symbol: cfg.symbol,
    kind: trades[0]?.market_kind ?? null,
    bestBid, bestAsk,
    spreadPct: bestBid && bestAsk ? +(((bestAsk - bestBid) / bestBid) * 100).toFixed(4) : null,
    nResting: book.asks.length + book.bids.length,
    capHint: book.capHint,
    bidNotionalUsd: Math.round(bidNotional),
    askNotionalUsd: Math.round(askNotional),
    imbalance: bidNotional + askNotional > 0 ? +(bidNotional / (bidNotional + askNotional)).toFixed(3) : null,
    whales: [], quoting: [], partials: [], prints: [],
    printSpanS: null, newestPrintAgeS: null, takerBuyUsd: null, takerSellUsd: null,
  };

  // --- drift guards (RV-ARCH B2) ---
  const echo = trades[0]?.market_symbol;
  if (echo != null && echo.toUpperCase() !== cfg.symbol.toUpperCase()) {
    card.ok = false;
    card.error = `market id drift suspected: market_id ${cfg.id} echoes '${echo}', registry expects '${cfg.symbol}' — refusing to serve`;
    return card;
  }
  if (mid != null && hlMark != null && hlMark > 0) {
    const diff = Math.abs(mid - hlMark) / hlMark;
    if (diff > 0.015) {
      card.ok = false;
      card.error = `market id drift suspected: Lighter mid ${mid.toFixed(4)} vs Hyperliquid mark ${hlMark} diverge ${(diff * 100).toFixed(2)}% (>1.5%)`;
      return card;
    }
  }

  // --- thin suppression (B3) ---
  const thinFloor = 250_000;
  if (Math.min(bidNotional, askNotional) < thinFloor) {
    card.ok = false;
    card.suppressed = `thin visible book: bid $${Math.round(bidNotional).toLocaleString()} / ask $${Math.round(askNotional).toLocaleString()} (<$250k side) — suppressed rather than misread`;
    return card;
  }

  // --- account clustering (MM vs directional, RV-QUANT) ---
  interface Acc { bid: number; ask: number; n: number; init: number; rem: number; pxLo: number; pxHi: number; pxSum: number }
  const accs = new Map<string, Acc>();
  const partials: LighterPartial[] = [];
  const push = (o: LoOrder, side: "bid" | "ask") => {
    const s = sideOf(o);
    if (!Number.isFinite(s.px) || !Number.isFinite(s.rem) || !Number.isFinite(s.init) || s.init <= 0) return;
    const key = String(o.owner_account_index ?? "?");
    const a = accs.get(key) ?? { bid: 0, ask: 0, n: 0, init: 0, rem: 0, pxLo: Infinity, pxHi: -Infinity, pxSum: 0 };
    const notional = s.px * s.rem;
    a[side] += notional; a.n += 1; a.init += s.init; a.rem += s.rem;
    a.pxLo = Math.min(a.pxLo, s.px); a.pxHi = Math.max(a.pxHi, s.px); a.pxSum += s.px * s.rem;
    accs.set(key, a);
    const initNotional = s.px * s.init;
    const fillPct = 1 - s.rem / s.init;
    if (initNotional >= 10_000 && fillPct >= 0.3) {
      partials.push({
        orderId: String(o.order_id ?? o.order_index ?? "?"), account: key, px: s.px,
        initialSz: +s.init.toFixed(6), remainingSz: +s.rem.toFixed(6), fillPct: +(fillPct * 100).toFixed(1),
      });
    }
  };
  book.asks.forEach((o) => push(o, "ask"));
  book.bids.forEach((o) => push(o, "bid"));
  partials.sort((a, b) => b.fillPct - a.fillPct);

  const whaleFloor = Math.max(WHALE_ABS_FLOOR, WHALE_PCT_FLOOR * Math.max(bidNotional, askNotional));
  const whaleList: LighterWhale[] = [];
  const quotingList: { account: string; orders: number; notionalUsd: number }[] = [];
  for (const [account, a] of accs) {
    const total = a.bid + a.ask;
    if (total <= 0) continue;
    const bidShare = a.bid / total;
    const twoSided = a.bid > 0 && a.ask > 0 && Math.min(bidShare, 1 - bidShare) >= 0.2;
    if (twoSided) {
      quotingList.push({ account, orders: a.n, notionalUsd: Math.round(total) });
      continue;
    }
    if (total >= whaleFloor && a.n > 0) {
      const side: "bid" | "ask" = bidShare >= 0.8 ? "bid" : "ask";
      whaleList.push({
        account, orders: a.n, notionalUsd: Math.round(total), side,
        avgPx: +(a.pxSum / (a.rem > 0 ? a.rem : 1)).toFixed(4),
        pxLo: +a.pxLo.toFixed(4), pxHi: +a.pxHi.toFixed(4),
        fillPct: a.init > 0 ? +((1 - a.rem / a.init) * 100).toFixed(1) : null,
      });
    }
  }
  whaleList.sort((x, y) => y.notionalUsd - x.notionalUsd);
  quotingList.sort((x, y) => y.notionalUsd - x.notionalUsd);
  card.whales = whaleList.slice(0, 8);
  card.quoting = quotingList.slice(0, 3);
  card.partials = partials.slice(0, 6);

  // --- prints (labelled anecdote on thin markets: count + span, RV-QUANT) ---
  // Lighter timestamps are MILLISECONDS — normalize to seconds before any
  // span/age math (caught in R4 smoke: a 1000× bug showed "39d" for a
  // 56-minute print window).
  const tms = trades.map((t) => num(t.timestamp)).filter(Number.isFinite);
  const tsSec = tms.map((t) => (t > 1e12 ? t / 1000 : t));
  card.prints = trades.slice(0, 10).map((t) => {
    const raw = num(t.timestamp) || 0;
    return {
      px: +(+ (t.price ?? "0")).toFixed(6),
      sz: +(+(t.size ?? "0")).toFixed(6),
      usd: +(+(t.usd_amount ?? "0")).toFixed(2),
      isMakerAsk: !!t.is_maker_ask,
      ts: Math.round(raw > 1e12 ? raw / 1000 : raw),
    };
  });
  if (tsSec.length >= 2) card.printSpanS = Math.round(Math.max(...tsSec) - Math.min(...tsSec));
  if (tsSec.length) card.newestPrintAgeS = Math.round(now / 1000 - Math.max(...tsSec));
  card.takerBuyUsd = Math.round(trades.reduce((a, t) => a + (t.is_maker_ask ? +(t.usd_amount ?? 0) : 0), 0));
  card.takerSellUsd = Math.round(trades.reduce((a, t) => a + (!t.is_maker_ask ? +(t.usd_amount ?? 0) : 0), 0));
  return card;
}

// ---------------------------------------------------------------------------
// Kraken spot FX

interface KDepthResp { error?: string[]; result?: Record<string, { bids?: [string, string, string][]; asks?: [string, string, string][] }> }

export async function krakenDepth(pair: string): Promise<KrakenCard> {
  const j = await getJson<KDepthResp>(`https://api.kraken.com/0/public/Depth?pair=${encodeURIComponent(pair)}&count=10`, 8_000);
  if (j.error?.length) throw new Error(`kraken: ${j.error.join("; ")}`);
  const key0 = Object.keys(j.result ?? {})[0];
  const r = j.result?.[key0];
  if (!r) throw new Error("kraken: empty result");
  const mapLv = (arr: [string, string, string][] | undefined): KrakenLevel[] =>
    (arr ?? []).map(([p, s, t]) => ({ px: +p, sz: +s, ts: +t })).filter((l) => Number.isFinite(l.px));
  const bids = mapLv(r.bids), asks = mapLv(r.asks);
  const bestBid = bids.length ? Math.max(...bids.map((l) => l.px)) : null;
  const bestAsk = asks.length ? Math.min(...asks.map((l) => l.px)) : null;
  const bidVol = bids.reduce((a, l) => a + l.sz, 0), askVol = asks.reduce((a, l) => a + l.sz, 0);
  const newest = Math.max(0, ...bids.map((l) => l.ts), ...asks.map((l) => l.ts));
  const ageS = Math.round(Date.now() / 1000 - newest);
  const spreadPct = bestBid && bestAsk && bestBid > 0 ? +(((bestAsk - bestBid) / bestBid) * 100).toFixed(5) : null;
  const stale = newest > 0 && (ageS > 120 || (spreadPct != null && spreadPct > 0.5));
  return {
    ok: true, pair: key0, bestBid, bestAsk, spreadPct, bids, asks,
    imbalance10: bidVol + askVol > 0 ? +(bidVol / (bidVol + askVol)).toFixed(3) : null,
    stale,
    staleReason: stale
      ? ageS > 120
        ? `newest level ${ageS}s old (>120s) — spot book stale, never gate basis on this`
        : `spread ${spreadPct}% (>0.5%) — one-sided/weekend book, never gate basis on this`
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Shared micro caches — single source of truth for /api/cg/micro AND
// microLiveQuote() below (same globalThis maps ⇒ warm-cache sharing: the
// classic route's live anchors ride the exact entries the micro panel just
// fetched, and vice versa — no doubled upstream weight).

export const SNAP_TTL = 60_000;
export const BOOK_TTL = 30_000;
export const ERR_TTL = 30_000;

export interface MicroCacheEntry<T> { at: number; v: T; err?: string }

export function microCache<T>(name: string): Map<string, MicroCacheEntry<T>> {
  const g = globalThis as unknown as Record<string, Map<string, MicroCacheEntry<T>> | undefined>;
  return (g[name] ??= new Map<string, MicroCacheEntry<T>>());
}

/** errors age out faster than successes (ERR_TTL) — a transient upstream hiccup
 *  must not pin a dead panel (RV-ARCH M1 / R3 convention) */
export function microCached<T>(m: Map<string, MicroCacheEntry<T>>, key: string, ttl: number): { hit: T | null; err: string | null } {
  const e = m.get(key);
  if (!e) return { hit: null, err: null };
  if (Date.now() - e.at >= (e.err ? ERR_TTL : ttl)) return { hit: null, err: null };
  return e.err ? { hit: null, err: e.err } : { hit: e.v, err: null };
}

export function microStore<T>(m: Map<string, MicroCacheEntry<T>>, key: string, v: T | null, err?: string) {
  m.set(key, { at: Date.now(), v: v as T, err });
  if (m.size > 128) {
    const oldest = m.keys().next().value;
    if (oldest !== undefined) m.delete(oldest);
  }
}

// ---------------------------------------------------------------------------
// Live quote anchor — the freshest tradable price for a classic instrument
// (user report 2026-11-11: "many values are stale like forex and other
// indices" — Yahoo cash indices freeze outside their cash session for up to
// 19.5h/day while broker CFDs keep quoting; the R4 micro sources trade 24/7).
//
// Ladder: Kraken real spot FX (closest to broker FX CFDs) → Hyperliquid xyz
// perp mark (one shared snapshot request covers every coin) → Lighter DEX L3
// top-of-book mid. `at` is the epoch-ms the quote was computed so consumers
// can age it themselves even when served from a cached body.

export interface LiveQuote {
  ok: boolean;
  sym: string;
  price: number | null;
  source: "kraken" | "hl-xyz" | "lighter" | null;
  sourceDetail: string | null;
  at: number;
  err?: string;
}

export async function microLiveQuote(sym: string): Promise<LiveQuote> {
  const cfg = microMapOf(sym);
  if (!cfg) {
    return { ok: false, sym, price: null, source: null, sourceDetail: null, at: Date.now(), err: "no micro source mapped" };
  }

  // 1) Kraken spot FX — real interbank-adjacent spot, not a perp mark
  if (cfg.kraken) {
    const krCache = microCache<KrakenCard>("__microKraken");
    const hit = microCached(krCache, cfg.kraken, BOOK_TTL);
    let kc: KrakenCard | null = hit.hit;
    if (!kc && !hit.err) {
      try {
        kc = await krakenDepth(cfg.kraken);
        microStore(krCache, cfg.kraken, kc);
      } catch (e) {
        microStore(krCache, cfg.kraken, null, e instanceof Error ? e.message : "kraken failed");
      }
    }
    if (kc?.ok && !kc.stale && kc.bestBid != null && kc.bestAsk != null) {
      const mid = +(((kc.bestBid + kc.bestAsk) / 2).toFixed(6)); // toFixed kills FP noise (1.11364000…2)
      if (Number.isFinite(mid) && mid > 0) {
        return { ok: true, sym, price: mid, source: "kraken", sourceDetail: `Kraken ${cfg.kraken} spot mid`, at: Date.now() };
      }
    }
  }

  // 2) Hyperliquid xyz mark — the shared dex snapshot covers every coin in
  //    ONE request, so this is the cheapest 24/7 anchor in the whole system
  if (cfg.hl) {
    const snapCache = microCache<Record<string, HlCtx>>("__microHlSnap");
    const hit = microCached(snapCache, "dex", SNAP_TTL);
    let snap = hit.hit;
    if (!snap && !hit.err) {
      try {
        snap = await hlXyzSnapshot();
        microStore(snapCache, "dex", snap);
      } catch (e) {
        microStore(snapCache, "dex", null, e instanceof Error ? e.message : "hl snapshot failed");
      }
    }
    const mark = snap?.[cfg.hl.coin]?.markPx;
    const m = mark != null ? +mark : NaN;
    if (Number.isFinite(m) && m > 0) {
      return { ok: true, sym, price: m, source: "hl-xyz", sourceDetail: `${cfg.hl.coin} perp mark`, at: Date.now() };
    }
  }

  // 3) Lighter DEX true-L3 top of book
  if (cfg.lighter) {
    const loCache = microCache<Awaited<ReturnType<typeof lighterBook>>>("__microLoBook");
    const idKey = String(cfg.lighter.id);
    const hit = microCached(loCache, idKey, BOOK_TTL);
    let lb = hit.hit;
    if (!lb && !hit.err) {
      try {
        lb = await lighterBook(cfg.lighter.id);
        microStore(loCache, idKey, lb);
      } catch (e) {
        microStore(loCache, idKey, null, e instanceof Error ? e.message : "lighter book failed");
      }
    }
    if (lb) {
      const num = (v: unknown) => (v == null ? NaN : +v);
      const askPx = lb.asks.map((o) => num(o.price)).filter(Number.isFinite);
      const bidPx = lb.bids.map((o) => num(o.price)).filter(Number.isFinite);
      const bA = askPx.length ? Math.min(...askPx) : null;
      const bB = bidPx.length ? Math.max(...bidPx) : null;
      const mid = bA != null && bB != null ? (bA + bB) / 2 : bA ?? bB;
      if (mid != null && Number.isFinite(mid) && mid > 0) {
        return { ok: true, sym, price: mid, source: "lighter", sourceDetail: `Lighter ${cfg.lighter.symbol} L3 mid`, at: Date.now() };
      }
    }
  }

  return { ok: false, sym, price: null, source: null, sourceDetail: null, at: Date.now(), err: "all mapped live sources unavailable" };
}
