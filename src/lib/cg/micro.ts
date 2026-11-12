/**
 * Micro-map + fetchers — the L2/L3 microstructure layer (R4, 2026-11-11;
 * full-universe expansion QB, 2026-11-12).
 *
 * LIVE-VERIFIED sources (evidence: scripts/research/probes/l2l3/ — probe_l2l3_sources.py,
 * verify_l2l3_mapping.py, probe_l2l3_fix.py; design: scripts/research/MICRO-DESIGN-R4.md
 * incl. the RV-ARCH + RV-QUANT review addendum whose conditions are all implemented here;
 * full-universe verification: scripts/verify-micro-map.mjs):
 *
 *  1. Hyperliquid — POST api.hyperliquid.xyz/info, TWO dexes:
 *     · xyz HIP-3 builder dex: {"type":"metaAndAssetCtxs","dex":"xyz"} → 144 markets
 *       (mark, oracle, OI, 1h funding, vol24h) + {"type":"l2Book","coin":"xyz:GOLD"}
 *       → 20 levels/side {px, sz, n} where n = resting order count.
 *     · MAIN dex (QB): {"type":"metaAndAssetCtxs"} (no dex param) → 235-coin universe —
 *       every curated crypto perp trades there under its plain name (BTC, ETH, …, TIA);
 *       1000PEPE/1000SHIB map to the "k"-series listings kPEPE/kSHIB which are quoted
 *       at the SAME 1000×-denominated scale as Binance's 1000PEPEUSDT/1000SHIBUSDT
 *       (verified live 2026-11-12: HL kPEPE mark 0.004486 vs Binance 1000PEPEUSDT
 *       0.0044842; HL kSHIB 0.004322 vs Binance 1000SHIBUSDT 0.004318 — no scale
 *       factor needed). Same l2Book endpoint serves both dexes; only the snapshot
 *       request differs.
 *  2. Lighter DEX (ZK-rollup CLOB) — mainnet.zklighter.elliot.ai/api/v1
 *     · orderBookOrders?market_id&limit → {code, asks[], bids[]} TRUE L3:
 *       order_id, owner_account_index, initial/remaining_base_amount, price, order_expiry.
 *     · recentTrades → maker/taker attribution (ask_account_id, bid_account_id,
 *       is_maker_ask, usd_amount) + market_symbol echo (drift guard).
 *     · The /markets listing endpoint 403s — Lighter ids stay registry-pinned
 *       (R4 evidence); no new Lighter ids are invented here.
 *  3. Multi-venue BBO (QB) — Binance fapi bookTicker (breaker-aware), OKX USDT-SWAP
 *     ticker, Bybit linear tickers, Coinbase spot ticker (6 majors). Every venue
 *     failure is {ok:false, reason} — never a throw, never a fabricated quote.
 *
 * Honest rules (never fabricate):
 *  · THIN suppression per source: HL card dies below $5M vol24h (JP225, XPT, xyz:EUR,
 *    BABA, NFLX, QCOM, GME… — and on the main dex: BNB, TRX, LTC, DOT, ATOM, XLM, ETC,
 *    FIL, ICP, HBAR, APT, OP, SEI, INJ, TIA, kSHIB); Lighter card dies below $250k
 *    visible side notional. Thin coins stay MAPPED so the amber reason is served.
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
 *  · OKX quotes PEPE/SHIB spot-scale (1/1000 of the terminal scale) — those are
 *    NOT scaled into the BBO (verified live 2026-11-12); the venue entry carries
 *    a note instead of a mixed-scale quote.
 *  · Execution stays at broker MT5 — these venues are SIGNAL markets only.
 */

import { resolveBinSym, resolveCgSym } from "../binance/aliases";
import { resolveCurated } from "../universe/curated";
import { fapiFetch } from "../live/fapi";

export interface MicroHlCfg {
  coin: string;
  /** Which Hyperliquid dex the coin lives on: "xyz" = HIP-3 builder dex (coin
   *  literally begins "xyz:"), "main" = the main perp dex (BTC, ETH, kPEPE…).
 *  Optional — hlDexOf() infers it from the coin prefix when omitted. */
  dex?: "main" | "xyz";
}
export interface MicroLighterCfg { id: number; symbol: string }
export interface MicroMapEntry {
  hl?: MicroHlCfg;
  lighter?: MicroLighterCfg;
  note?: string;
}

// Terminal symbol -> verified source keys. SP500 aliases SPX500 (perpmap B3 lesson).
// GOOG (registry) rides xyz:GOOGL — share-class proxy, labeled in note.
//
// FULL CURATED UNIVERSE (QB, 2026-11-12): every curated crypto perp with a live
// Hyperliquid main-dex market, every curated TradFi perp with a live xyz market,
// and the 3 classics. Every coin below was verified to exist live on its dex via
// POST api.hyperliquid.xyz/info {"type":"metaAndAssetCtxs"} (main: 235-coin
// universe; xyz: 144-market universe) — evidence: scripts/verify-micro-map.mjs.
// ZERO fabricated ids: VET/QQQ/ANTHROPIC have NO Hyperliquid market (verified
// absent from BOTH dexes) and stay unmapped — see MICRO_UNMAPPED_NOTES.
export const MICRO_MAP: Record<string, MicroMapEntry> = {
  // ─── CRYPTO 30 → Hyperliquid MAIN-DEX perps (plain names) ────────────────
  // Verified live 2026-11-12 via metaAndAssetCtxs (235-coin main universe).
  // Books: {"type":"l2Book","coin":"BTC"} — same endpoint as xyz. Thin main-dex
  // books (<$5M/24h: BNB TRX LTC DOT ATOM XLM ETC FIL ICP HBAR APT OP SEI INJ
  // TIA kSHIB) auto-suppress with the amber THIN reason — mapped anyway so the
  // reason is served, never a bare unsupported.
  BTC: { hl: { coin: "BTC", dex: "main" } },
  ETH: { hl: { coin: "ETH", dex: "main" } },
  BNB: { hl: { coin: "BNB", dex: "main" } },
  SOL: { hl: { coin: "SOL", dex: "main" } },
  XRP: { hl: { coin: "XRP", dex: "main" } },
  ADA: { hl: { coin: "ADA", dex: "main" } },
  DOGE: { hl: { coin: "DOGE", dex: "main" } },
  TRX: { hl: { coin: "TRX", dex: "main" } },
  LINK: { hl: { coin: "LINK", dex: "main" } },
  LTC: { hl: { coin: "LTC", dex: "main" } },
  AVAX: { hl: { coin: "AVAX", dex: "main" } },
  DOT: { hl: { coin: "DOT", dex: "main" } },
  NEAR: { hl: { coin: "NEAR", dex: "main" } },
  UNI: { hl: { coin: "UNI", dex: "main" } },
  ATOM: { hl: { coin: "ATOM", dex: "main" } },
  XLM: { hl: { coin: "XLM", dex: "main" } },
  ETC: { hl: { coin: "ETC", dex: "main" } },
  FIL: { hl: { coin: "FIL", dex: "main" } },
  ICP: { hl: { coin: "ICP", dex: "main" } },
  HBAR: { hl: { coin: "HBAR", dex: "main" } },
  APT: { hl: { coin: "APT", dex: "main" } },
  ARB: { hl: { coin: "ARB", dex: "main" } },
  OP: { hl: { coin: "OP", dex: "main" } },
  SUI: { hl: { coin: "SUI", dex: "main" } },
  SEI: { hl: { coin: "SEI", dex: "main" } },
  INJ: { hl: { coin: "INJ", dex: "main" } },
  TIA: { hl: { coin: "TIA", dex: "main" } },
  // k-series = 1000×-denominated listings — SAME quote scale as Binance's
  // 1000PEPEUSDT/1000SHIBUSDT (verified live 2026-11-12: kPEPE 0.004486 vs
  // Binance 0.0044842, kSHIB 0.004322 vs 0.004318). No scale factor needed;
  // OKX's spot-scale PEPE/SHIB swaps are NOT mixed in (see BBO notes).
  "1000PEPE": {
    hl: { coin: "kPEPE", dex: "main" },
    note: "HL kPEPE is the 1000×-denominated listing — same quote scale as Binance 1000PEPEUSDT (verified live 2026-11-12)",
  },
  "1000SHIB": {
    hl: { coin: "kSHIB", dex: "main" },
    note: "HL kSHIB is the 1000×-denominated listing (same scale as Binance 1000SHIBUSDT) but thin (~$0.3M/24h) — HL card auto-suppresses below $5M",
  },
  // VET: NO Hyperliquid market — MICRO_UNMAPPED_NOTES (verified absent, both dexes).

  // ─── TRADFI 28 → Hyperliquid xyz HIP-3 perps ────────────────────────────
  // metals (perp-registry assets get their L3 here; Coinglass engine stays untouched)
  XAU: { hl: { coin: "xyz:GOLD" }, lighter: { id: 92, symbol: "XAU" } },
  XAG: { hl: { coin: "xyz:SILVER" }, lighter: { id: 93, symbol: "XAG" } },
  XPT: { hl: { coin: "xyz:PLATINUM" }, note: "xyz platinum is thin (~$1M/day) — HL card auto-suppresses below $5M" },
  // indices
  SPX500: { hl: { coin: "xyz:SP500" }, lighter: { id: 180, symbol: "US500" } },
  SP500: { hl: { coin: "xyz:SP500" }, lighter: { id: 180, symbol: "US500" }, note: "alias of SPX500" },
  NDX100: { hl: { coin: "xyz:XYZ100" }, lighter: { id: 181, symbol: "US100" }, note: "XYZ100 = Nasdaq-100 tracker market" },
  JP225: { hl: { coin: "xyz:JP225" }, note: "xyz JP225 thin (~$1M/day) — HL card auto-suppresses" },
  // energies — CL is the canonical curated key (WTI); USO keeps aliasing it
  CL: { hl: { coin: "xyz:CL" }, lighter: { id: 145, symbol: "WTI" }, note: "WTI crude — canonical curated key (USO/WTI alias here)" },
  USO: { hl: { coin: "xyz:CL" }, lighter: { id: 145, symbol: "WTI" }, note: "WTI crude — alias of CL" },
  UKO: { hl: { coin: "xyz:BRENTOIL" }, lighter: { id: 159, symbol: "BRENTOIL" } },
  NATGAS: { hl: { coin: "xyz:NATGAS" }, lighter: { id: 158, symbol: "NATGAS" }, note: "watchlist — not broker-listed" },
  // US equities (xyz HIP-3 perps; thin ones auto-suppress below $5M vol24h)
  AAPL: { hl: { coin: "xyz:AAPL" } },
  AMZN: { hl: { coin: "xyz:AMZN" } },
  GOOGL: { hl: { coin: "xyz:GOOGL" }, note: "Alphabet Class A — canonical curated key; GOOG (Class C spelling) aliases the same xyz market" },
  GOOG: { hl: { coin: "xyz:GOOGL" }, note: "xyz:GOOGL = Class A proxy for registry GOOG (Class C)" },
  MSFT: { hl: { coin: "xyz:MSFT" } },
  NVDA: { hl: { coin: "xyz:NVDA" } },
  TSLA: { hl: { coin: "xyz:TSLA" } },
  AMD: { hl: { coin: "xyz:AMD" } },
  META: { hl: { coin: "xyz:META" } },
  INTC: { hl: { coin: "xyz:INTC" } },
  MU: { hl: { coin: "xyz:MU" }, lighter: { id: 164, symbol: "MU" } },
  // Curated V2 high-OI TradFi watchlist equities & ETFs (live-verified HL xyz + Lighter IDs)
  SNDK: { hl: { coin: "xyz:SNDK" }, lighter: { id: 139, symbol: "SNDK" } },
  CRCL: { hl: { coin: "xyz:CRCL" }, lighter: { id: 121, symbol: "CRCL" } },
  MSTR: { hl: { coin: "xyz:MSTR" }, lighter: { id: 122, symbol: "MSTR" } },
  NBIS: { hl: { coin: "xyz:NBIS" }, lighter: { id: 189, symbol: "NBIS" } },
  COIN: { hl: { coin: "xyz:COIN" }, lighter: { id: 109, symbol: "COIN" } },
  AVGO: { hl: { coin: "xyz:AVGO" }, lighter: { id: 210, symbol: "AVGO" } },
  TSM: { hl: { coin: "xyz:TSM" }, lighter: { id: 168, symbol: "TSM" } },
  SOXL: { hl: { coin: "xyz:SOXL" }, lighter: { id: 197, symbol: "SOXL" }, note: "3x Semiconductor Bull ETF — signal/macro gauge only" },
  SOXS: { lighter: { id: 222, symbol: "SOXS" }, note: "3x Semiconductor Bear ETF — Lighter L3 signal gauge only" },
  // QB additions (all verified live 2026-11-12 via metaAndAssetCtxs dex=xyz):
  SPCX: { hl: { coin: "xyz:SPCX" }, note: "SpaceX pre-IPO perp (~$164M/24h xyz, verified 2026-11-12) — signal gauge only" },
  SKHY: { hl: { coin: "xyz:SKHY" }, note: "SK Hynix USD-scale market matching Binance SKHYUSDT; xyz also lists xyz:SKHX (KRW-scale ~₩939, verified 2026-11-12) — deliberately not used" },
  NFLX: { hl: { coin: "xyz:NFLX" }, note: "xyz NFLX thin (~$0.8M/24h) — HL card auto-suppresses below $5M" },
  DRAM: { hl: { coin: "xyz:DRAM" }, note: "DRAM memory-price index perp (~$108M/24h xyz, verified 2026-11-12)" },
  KORU: { hl: { coin: "xyz:KORU" }, note: "Koru specialty listing (~$52M/24h xyz, verified 2026-11-12)" },
  // QQQ / ANTHROPIC: NO xyz market (verified absent 2026-11-12; xyz:ANT is a
  // different instrument — $104 mark vs ANTHROPICUSDT $1382) — MICRO_UNMAPPED_NOTES.
  // BABA verified live but <$5M/day — auto-suppress; no entry needed (honest absence).
};

/** Curated members with NO L2/L3 market on any mapped venue — the honest
 *  reason served instead of a card. Every absence below was verified live
 *  2026-11-12 against BOTH Hyperliquid dexes (metaAndAssetCtxs). */
export const MICRO_UNMAPPED_NOTES: Record<string, string> = {
  VET: "no Hyperliquid market for VET (verified live 2026-11-12 via metaAndAssetCtxs: absent from both the 235-coin main dex and the 144-market xyz dex; Lighter ids are registry-pinned with no VET) — multi-venue BBO is still served",
  QQQ: "no xyz:QQQ market (verified live 2026-11-12 via metaAndAssetCtxs dex=xyz) — Binance QQQUSDT + OKX QQQ-USDT-SWAP + Bybit QQQUSDT BBO is served instead",
  ANTHROPIC: "no xyz:ANTHROPIC market (verified live 2026-11-12; the similarly-named xyz:ANT is a different instrument — $104 mark vs Binance ANTHROPICUSDT $1382) — Binance/OKX/Bybit BBO is served instead",
};

/** Which Hyperliquid dex a coin lives on — explicit cfg wins, else the
 *  "xyz:" prefix decides (all xyz HIP-3 coins carry it; main-dex names never do). */
export function hlDexOf(coin: string): "main" | "xyz" {
  return coin.trim().startsWith("xyz:") ? "xyz" : "main";
}

export function microMapOf(sym: string): MicroMapEntry | undefined {
  const up = sym.trim().toUpperCase().replace(/USDT$/, "");
  // 1) exact map key; 2) cg/binance alias spelling (USO→CL, GOOG→GOOGL, UKO→BZ…)
  const direct = MICRO_MAP[up] ?? MICRO_MAP[resolveCgSym(up)];
  if (direct) return direct;
  // 3) curated alias spelling (PEPE→1000PEPE, WTI→CL, GOLD→XAU, BZ→UKO, XBT→BTC,
  //    SP500→SPX500, NDX→NDX100, SKHX→SKHY …) resolved through the curated registry
  const cur = resolveCurated(up);
  return cur ? MICRO_MAP[cur.sym] : undefined;
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

export interface MicroResp {
  ok: boolean;
  sym: string;
  fetchedAt: number;
  hl?: HlCard;
  lighter?: LighterCard;
  bbo?: BboSection;               // multi-venue best-bid/offer (QB)
  error?: string;
  note?: string;
  /** freshness telemetry (QB): dataAt = oldest successful upstream fetch
   *  completion time tracked during assembly (cache hits count at their
   *  original store time); ageMs/stale are derived from it. */
  supported?: boolean;
  dataAt?: number;
  ageMs?: number;
  stale?: boolean;
  source?: string;
  missingVenues?: string[];
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
// Hyperliquid — xyz HIP-3 dex AND the main perp dex (QB)

interface HlCtx { dayNtlVlm?: string; funding?: string; markPx?: string; openInterest?: string; oraclePx?: string }
export type { HlCtx }
interface HlMetaResp { universe?: { name: string }[] }
type HlDexResp = [HlMetaResp, (HlCtx | null)[]];
interface HlBookResp { levels?: { px: string; sz: string; n: number }[][] }

/** shared snapshot of the whole xyz dex (mark/oracle/OI/funding/vol per coin) */
export async function hlXyzSnapshot(): Promise<Record<string, HlCtx>> {
  const [meta, ctxs] = await postJson<HlDexResp>("https://api.hyperliquid.xyz/info", { type: "metaAndAssetCtxs", dex: "xyz" }, 8_000);
  return hlDexToMap(meta, ctxs);
}

/** shared snapshot of the MAIN dex (BTC, ETH, …, kPEPE — verified live
 *  2026-11-12: 235-coin universe; request omits the dex param) */
export async function hlMainSnapshot(): Promise<Record<string, HlCtx>> {
  const [meta, ctxs] = await postJson<HlDexResp>("https://api.hyperliquid.xyz/info", { type: "metaAndAssetCtxs" }, 8_000);
  return hlDexToMap(meta, ctxs);
}

function hlDexToMap(meta: HlMetaResp | undefined, ctxs: (HlCtx | null)[] | undefined): Record<string, HlCtx> {
  const out: Record<string, HlCtx> = {};
  const uni = meta?.universe ?? [];
  uni.forEach((u, i) => {
    const c = ctxs?.[i];
    if (u?.name && c) out[u.name] = c;
  });
  return out;
}

/** l2Book works identically for both dexes — the coin name alone routes it
 *  (verified live 2026-11-12: "BTC", "kPEPE" and "xyz:SPCX" all return levels). */
export async function hlBook(coin: string): Promise<{ bids: HlLevel[]; asks: HlLevel[] }> {
  const j = await postJson<HlBookResp>("https://api.hyperliquid.xyz/info", { type: "l2Book", coin }, 8_000);
  const raw = j.levels ?? [[], []];
  const map = (arr: { px: string; sz: string; n: number }[]): HlLevel[] =>
    arr.map((l) => ({ px: +l.px, sz: +l.sz, n: l.n })).filter((l) => Number.isFinite(l.px));
  return { bids: map(raw[0] ?? []), asks: map(raw[1] ?? []) };
}

export interface HlSnapResult {
  snap: Record<string, HlCtx> | null;
  err: string | null;
  /** fetch completion time of the successful snapshot (cache-store time) —
   *  feeds the response dataAt freshness telemetry; null on failure */
  at: number | null;
}

/** dex-aware snapshot with shared caching — single source of truth for the
 *  micro route AND microLiveQuote (one request covers every coin on the dex;
 *  keys "xyz"/"main" live in the shared __microHlSnap map). */
export async function getHlSnapshot(dex: "main" | "xyz"): Promise<HlSnapResult> {
  const cache = microCache<Record<string, HlCtx>>("__microHlSnap");
  const key = dex === "xyz" ? "xyz" : "main";
  const hit = microCached(cache, key, SNAP_TTL);
  if (hit.hit) return { snap: hit.hit, err: null, at: microCachedAt(cache, key) };
  if (hit.err) return { snap: null, err: hit.err, at: null };
  try {
    const snap = dex === "xyz" ? await hlXyzSnapshot() : await hlMainSnapshot();
    microStore(cache, key, snap);
    return { snap, err: null, at: microCachedAt(cache, key) };
  } catch (e) {
    const err = e instanceof Error ? e.message : `hl ${dex} snapshot failed`;
    microStore(cache, key, null, err);
    return { snap: null, err, at: null };
  }
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
  // venue-health gate (RV-QUANT rule 2) + thin suppression (B3). The gate applies
  // identically to both dexes; only the wording says which one tripped it.
  const dexWord = coin.startsWith("xyz:") ? "xyz" : "HL main-dex";
  const dislocated = card.markVsOraclePct != null && Math.abs(card.markVsOraclePct) > 0.3;
  const hotFunding = card.fundingAprPct != null && Math.abs(card.fundingAprPct) > 200;
  const thin = card.vol24hUsd != null && card.vol24hUsd < 5_000_000;
  if (dislocated || hotFunding) {
    card.ok = false;
    card.suppressed = dislocated
      ? `venue dislocation: mark ${card.markVsOraclePct}% vs oracle (|>0.3%|) — ${dexWord} reads suppressed, venue stress is not market signal`
      : `funding stress: APR ${card.fundingAprPct}% (>200%) — ${dexWord} reads suppressed; 1h rate ${card.funding1hPct}%/h is real but the venue is overheated`;
  } else if (thin) {
    card.ok = false;
    card.suppressed = `thin ${dexWord} market: $${((card.vol24hUsd ?? 0) / 1e6).toFixed(2)}M/24h < $5M — suppressed rather than misread`;
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
// Multi-venue BBO (best-bid/offer) — QB, 2026-11-12.
//
// Venues (all free public REST tickers, verified live 2026-11-12 — evidence:
// scripts/verify-micro-map.mjs):
//   · Binance  GET fapi.binance.com/fapi/v1/ticker/bookTicker?symbol=<PAIR>
//     (through fapiFetch so the shared IP-weight breaker back-pressures us
//     with every other fapi consumer; 5s cache)
//   · OKX      GET www.okx.com/api/v5/market/ticker?instId=<SYM>-USDT-SWAP
//     (ok only when code==="0"; 10s cache). Verified coverage 55/58 curated
//     perps — missing VET, 1000PEPE, 1000SHIB; OKX quotes spot-scale
//     PEPE/SHIB swaps at 1/1000 of the terminal scale (PEPE-USDT-SWAP
//     0.0000044889 vs Binance 1000PEPEUSDT 0.0044842) so they are NOT
//     scaled into the BBO — the venue entry carries a note instead.
//   · Bybit    GET api.bybit.com/v5/market/tickers?category=linear&symbol=<SYM>USDT
//     (ok only when retCode===0; 10s cache). Verified coverage 56/58 —
//     missing 1000SHIB and AMD.
//   · Coinbase GET api.exchange.coinbase.com/products/<SYM>-USD/ticker —
//     spot, mapped ONLY for BTC/ETH/SOL/DOGE/XRP/LINK (verified live).
//
// Honesty rules: a venue that 404s/errors/has no listing is {ok:false, reason}
// — never a throw, never a fabricated quote; bestBbo is the tightest spreadBps
// among live venues only; missingVenues lists every venue that is not ok.

export type BboVenueName = "binance" | "okx" | "bybit" | "coinbase";

export interface BboVenue {
  venue: BboVenueName;
  ok: boolean;
  bid: number | null;
  ask: number | null;
  mid: number | null;
  spreadBps: number | null;
  reason?: string;              // exact upstream failure text — why this venue is not ok
  note?: string;                // scale/coverage context (never a substitute for data)
  at: number;                   // fetch completion (cache-store) time — feeds response dataAt
}

export interface BboBest {
  venue: BboVenueName;
  bid: number;
  ask: number;
  mid: number;
  spreadBps: number;
}

export interface BboSection {
  sym: string;                  // canonical terminal sym the quotes describe
  binancePair: string;
  okxInstId: string;
  bybitSymbol: string;
  coinbaseProduct: string | null;
  venues: BboVenue[];
  best: BboBest | null;         // tightest spreadBps among ok venues
  missingVenues: BboVenueName[];
  at: number;
}

/** Coinbase spot ticker is mapped for the 6 major crypto listings only
 *  (verified live 2026-11-12: BTC/ETH/SOL/DOGE/XRP/LINK -USD all quote). */
export const COINBASE_SPOT_SYMS: readonly string[] = ["BTC", "ETH", "SOL", "DOGE", "XRP", "LINK"];

/** Binance BBO cache (task spec: 5s). */
export const BBO_BINANCE_TTL = 5_000;
/** OKX / Bybit / Coinbase BBO cache (task spec: 10s). */
export const BBO_VENUE_TTL = 10_000;

// OKX quotes these terminals at 1/1000 scale — probing the 1000-name fails and
// scaling spot quotes into a BBO would mix denominations, so the venue entry
// explains instead (verified live 2026-11-12, see section header).
const OKX_SCALE_NOTES: Record<string, string> = {
  "1000PEPE": "OKX lists PEPE-USDT-SWAP at 1/1000 of this terminal's quote scale (spot-scale PEPE) — not probed, not scaled into the BBO",
  "1000SHIB": "OKX lists SHIB-USDT-SWAP at 1/1000 of this terminal's quote scale (spot-scale SHIB) — not probed, not scaled into the BBO",
};

function failedBbo(venue: BboVenueName, reason: string): BboVenue {
  return { venue, ok: false, bid: null, ask: null, mid: null, spreadBps: null, reason, at: Date.now() };
}

function bboVenue(venue: BboVenueName, bid: number | null, ask: number | null): BboVenue {
  const ok =
    bid != null && ask != null && Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask >= bid;
  // toPrecision(10) kills (bid+ask)/2 float noise (0.004478650000000001 → 0.00447865)
  const mid = ok ? +((bid! + ask!) / 2).toPrecision(10) : null;
  const spreadBps = ok && mid ? +(((ask! - bid!) / mid) * 10_000).toFixed(3) : null;
  return {
    venue, ok,
    bid: ok ? bid! : null,
    ask: ok ? ask! : null,
    mid, spreadBps,
    ...(ok ? {} : { reason: "no two-sided book" }),
    at: Date.now(),
  };
}

interface BinBookTicker { bidPrice?: string; askPrice?: string }

async function binanceBbo(pair: string): Promise<BboVenue> {
  const m = microCache<BboVenue>("__microBboBin");
  const hit = microCached(m, pair, BBO_BINANCE_TTL);
  if (hit.hit) return hit.hit;
  if (hit.err) return failedBbo("binance", hit.err);
  try {
    const d = (await fapiFetch(`/fapi/v1/ticker/bookTicker?symbol=${encodeURIComponent(pair)}`, 5_000)) as BinBookTicker;
    const v = bboVenue("binance", d.bidPrice != null ? +d.bidPrice : null, d.askPrice != null ? +d.askPrice : null);
    microStore(m, pair, v);
    return v;
  } catch (e) {
    const reason = e instanceof Error ? e.message : "binance bookTicker failed";
    microStore(m, pair, null, reason);
    return failedBbo("binance", reason);
  }
}

interface OkxTickerResp { code?: string; msg?: string; data?: { bidPx?: string; askPx?: string }[] }

async function okxBbo(instId: string, canonical: string): Promise<BboVenue> {
  const m = microCache<BboVenue>("__microBboOkx");
  const hit = microCached(m, instId, BBO_VENUE_TTL);
  const withNote = (v: BboVenue): BboVenue => (OKX_SCALE_NOTES[canonical] ? { ...v, note: OKX_SCALE_NOTES[canonical] } : v);
  if (hit.hit) return hit.hit;
  if (hit.err) return withNote(failedBbo("okx", hit.err));
  try {
    const j = await getJson<OkxTickerResp>(`https://www.okx.com/api/v5/market/ticker?instId=${encodeURIComponent(instId)}`, 6_000);
    if (j.code !== "0" || !j.data?.length) {
      const reason = `OKX code ${j.code ?? "?"}: ${(j.msg ?? "no data").slice(0, 90)}`;
      microStore(m, instId, null, reason);
      return withNote(failedBbo("okx", reason));
    }
    const bid = j.data[0]?.bidPx != null ? +j.data[0].bidPx : null;
    const ask = j.data[0]?.askPx != null ? +j.data[0].askPx : null;
    const v = bboVenue("okx", bid, ask);
    microStore(m, instId, v);
    return withNote(v);
  } catch (e) {
    const reason = e instanceof Error ? e.message : "okx ticker failed";
    microStore(m, instId, null, reason);
    return withNote(failedBbo("okx", reason));
  }
}

interface BybitTickerResp { retCode?: number; retMsg?: string; result?: { list?: { bid1Price?: string; ask1Price?: string }[] } }

async function bybitBbo(symbol: string): Promise<BboVenue> {
  const m = microCache<BboVenue>("__microBboBybit");
  const hit = microCached(m, symbol, BBO_VENUE_TTL);
  if (hit.hit) return hit.hit;
  if (hit.err) return failedBbo("bybit", hit.err);
  try {
    const j = await getJson<BybitTickerResp>(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${encodeURIComponent(symbol)}`, 6_000);
    if (j.retCode !== 0 || !j.result?.list?.length) {
      const reason = `Bybit ${j.retCode ?? "?"}: ${(j.retMsg ?? "no data").slice(0, 90)}`;
      microStore(m, symbol, null, reason);
      return failedBbo("bybit", reason);
    }
    const bid = j.result.list[0]?.bid1Price != null ? +j.result.list[0].bid1Price : null;
    const ask = j.result.list[0]?.ask1Price != null ? +j.result.list[0].ask1Price : null;
    const v = bboVenue("bybit", bid, ask);
    microStore(m, symbol, v);
    return v;
  } catch (e) {
    const reason = e instanceof Error ? e.message : "bybit tickers failed";
    microStore(m, symbol, null, reason);
    return failedBbo("bybit", reason);
  }
}

interface CbTickerResp { bid?: string; ask?: string }

async function coinbaseBbo(product: string | null): Promise<BboVenue> {
  if (!product) {
    return failedBbo("coinbase", "not applicable — Coinbase spot ticker is mapped for BTC/ETH/SOL/DOGE/XRP/LINK only");
  }
  const m = microCache<BboVenue>("__microBboCb");
  const hit = microCached(m, product, BBO_VENUE_TTL);
  if (hit.hit) return hit.hit;
  if (hit.err) return failedBbo("coinbase", hit.err);
  try {
    const j = await getJson<CbTickerResp>(`https://api.exchange.coinbase.com/products/${encodeURIComponent(product)}/ticker`, 6_000);
    const v = bboVenue("coinbase", j.bid != null ? +j.bid : null, j.ask != null ? +j.ask : null);
    microStore(m, product, v);
    return v;
  } catch (e) {
    const reason = e instanceof Error ? e.message : "coinbase ticker failed";
    microStore(m, product, null, reason);
    return failedBbo("coinbase", reason);
  }
}

/** Canonicalize a terminal spelling to its curated key (PEPE→1000PEPE,
 *  WTI→CL, USO→CL, GOOG→GOOGL, BZ→UKO …) before any venue lookup. */
function canonicalBboSym(rawSym: string): string {
  const up = rawSym.trim().toUpperCase();
  return resolveCurated(up)?.sym ?? resolveCgSym(up);
}

/** Multi-venue BBO for a terminal symbol. Never throws: every venue failure
 *  comes back as {ok:false, reason} and best/missingVenues are derived. */
export async function fetchBboSection(rawSym: string): Promise<BboSection> {
  const canonical = canonicalBboSym(rawSym);
  // UKO→BZ for the Binance-family lookups (Binance lists the Brent perp as BZUSDT)
  const base = resolveBinSym(canonical);
  const binancePair = `${base}USDT`;
  const okxInstId = `${base}-USDT-SWAP`;
  const bybitSymbol = `${base}USDT`;
  const coinbaseProduct = COINBASE_SPOT_SYMS.includes(canonical) ? `${canonical}-USD` : null;
  const venues = await Promise.all([
    binanceBbo(binancePair),
    okxBbo(okxInstId, canonical),
    bybitBbo(bybitSymbol),
    coinbaseBbo(coinbaseProduct),
  ]);
  const live = venues.filter((v) => v.ok && v.spreadBps != null);
  const tightest = live.length
    ? live.reduce((a, b) => ((b.spreadBps ?? Infinity) < (a.spreadBps ?? Infinity) ? b : a))
    : null;
  return {
    sym: canonical,
    binancePair,
    okxInstId,
    bybitSymbol,
    coinbaseProduct,
    venues,
    best: tightest
      ? { venue: tightest.venue, bid: tightest.bid!, ask: tightest.ask!, mid: tightest.mid!, spreadBps: tightest.spreadBps! }
      : null,
    missingVenues: venues.filter((v) => !v.ok).map((v) => v.venue),
    at: Date.now(),
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
/** Response freshness flag: older than this (≈1.5× the longest per-source
 *  cache TTL of 60s, plus fetch slop) marks the assembled body stale=true. */
export const STALE_MS = 90_000;

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

/** fetch-completion time of a SUCCESSFUL cache entry (null for errors/misses)
 *  — the freshness clock behind the response dataAt telemetry. */
export function microCachedAt<T>(m: Map<string, MicroCacheEntry<T>>, key: string): number | null {
  const e = m.get(key);
  return e && !e.err ? e.at : null;
}

// ---------------------------------------------------------------------------
// Live quote anchor — the freshest tradable price for a classic instrument
// (user report 2026-11-11: "many values are stale like forex and other
// indices" — Yahoo cash indices freeze outside their cash session for up to
// 19.5h/day while broker CFDs keep quoting; the R4 micro sources trade 24/7).
//
// Ladder: Hyperliquid perp mark — xyz dex OR main dex depending on the mapped
// coin (one shared snapshot request covers every coin on that dex) → Lighter
// DEX L3 top-of-book mid. `at` is the epoch-ms the quote was computed so
// consumers can age it themselves even when served from a cached body.

export interface LiveQuote {
  ok: boolean;
  sym: string;
  price: number | null;
  source: "hl-xyz" | "hl-main" | "lighter" | null;
  sourceDetail: string | null;
  at: number;
  err?: string;
}

export async function microLiveQuote(sym: string): Promise<LiveQuote> {
  const cfg = microMapOf(sym);
  if (!cfg) {
    return { ok: false, sym, price: null, source: null, sourceDetail: null, at: Date.now(), err: "no micro source mapped" };
  }

  // 1) Hyperliquid mark — the shared dex snapshot covers every coin on its dex
  //    in ONE request, so this is the cheapest 24/7 anchor in the whole system
  if (cfg.hl) {
    const { snap } = await getHlSnapshot(hlDexOf(cfg.hl.coin));
    const mark = snap?.[cfg.hl.coin]?.markPx;
    const m = mark != null ? +mark : NaN;
    if (Number.isFinite(m) && m > 0) {
      return {
        ok: true, sym, price: m,
        source: hlDexOf(cfg.hl.coin) === "xyz" ? "hl-xyz" : "hl-main",
        sourceDetail: `${cfg.hl.coin} perp mark`,
        at: Date.now(),
      };
    }
  }

  // 2) Lighter DEX true-L3 top of book
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
