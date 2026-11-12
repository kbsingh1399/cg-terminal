"use client";

import { usePolling } from "./use-cg-data";
import { useHlBook } from "@/lib/live/hl-feed";

/**
 * MicrostructurePanel — the L2/L3 layer for classic instruments (R4, 2026-11-11
 * user directive: "continuous fetching live free data … at L2, L3 level too").
 *
 * Two cards from /api/cg/micro + live Hyperliquid xyz L2 WebSocket overlay:
 *   1. Perp L2 · Hyperliquid xyz  — live WS L2 ladder with per-level order count,
 *      spread, mark-vs-oracle, 1h funding (+APR-if-persisted), OI (+Δ24h when
 *      history exists), 20-level notional imbalance.
 *   2. L3 resting orders · Lighter — true order-by-order book clustered by
 *      owner account: directional whales vs quoting/MM accounts (separated),
 *      visible partial fills (censored sample), maker/taker prints with
 *      count+span labels.
 *
 * Standing quant disclaimers rendered with the data (RV-QUANT):
 *   · signal-market microstructure — execution stays at broker MT5;
 *   · crypto-rail venue flow ≠ underlying market flow (xyz gold ≈ 0.1% of
 *     global gold turnover — this reads crypto leverage demand, not LBMA);
 *   · microstructure is CONTEXT, not a placement gate (no scorecard weight).
 */

interface HlLevel { px: number; sz: number; n: number }
interface HlCard {
  ok: boolean; error?: string; coin: string;
  mark: number | null; oracle: number | null; markVsOraclePct: number | null;
  vol24hUsd: number | null; oiBase: number | null; oiNotionalUsd: number | null; oiD24hPct: number | null;
  funding1hPct: number | null; fundingAprPct: number | null; fundingAprNote?: string;
  spreadPct: number | null;
  bids: { levels: HlLevel[]; notionalUsd: number }; asks: { levels: HlLevel[]; notionalUsd: number };
  imbalance20: number | null; suppressed?: string;
}
interface LighterWhale {
  account: string; orders: number; notionalUsd: number; side: "bid" | "ask";
  avgPx: number; pxLo: number; pxHi: number; fillPct: number | null;
}
interface LighterCard {
  ok: boolean; error?: string; marketId: number; symbol: string; kind: string | null;
  bestBid: number | null; bestAsk: number | null; spreadPct: number | null;
  nResting: number; capHint: boolean; bidNotionalUsd: number; askNotionalUsd: number; imbalance: number | null;
  whales: LighterWhale[]; quoting: { account: string; orders: number; notionalUsd: number }[];
  partials: { orderId: string; account: string; px: number; initialSz: number; remainingSz: number; fillPct: number }[];
  prints: { px: number; sz: number; usd: number; isMakerAsk: boolean; ts: number }[];
  printSpanS: number | null; newestPrintAgeS: number | null; takerBuyUsd: number | null; takerSellUsd: number | null;
  suppressed?: string;
}
interface MicroResp {
  ok: boolean; sym?: string; fetchedAt?: number; note?: string;
  hl?: HlCard; lighter?: LighterCard; error?: string;
}

function fmtN(v: number | null | undefined, decs = 2): string {
  if (null == v || !Number.isFinite(v)) return "–";
  return v.toLocaleString("en-US", { minimumFractionDigits: decs, maximumFractionDigits: decs });
}
function fmtUsd(v: number | null | undefined): string {
  if (null == v || !Number.isFinite(v)) return "–";
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}
function fmtAge(s: number | null | undefined): string {
  if (null == s || !Number.isFinite(s) || s < 0) return "–";
  if (s < 90) return `${Math.round(s)}s`;
  if (s < 5400) return `${Math.round(s / 60)}m`;
  if (s < 172800) return `${(s / 3600).toFixed(1)}h`;
  return `${Math.round(s / 86400)}d`;
}
function shortAcc(a: string): string {
  const n = Number(a);
  if (Number.isFinite(n) && n > 281474976000000) return `sys#${a.slice(-6)}`; // omnibus/system-range accounts
  return a.length > 7 ? `#${a.slice(0, 7)}…` : `#${a}`;
}

function LadderRow({ px, sz, n, maxSz, side, decs }: { px: number; sz: number; n: number; maxSz: number; side: "bid" | "ask"; decs: number }) {
  const w = maxSz > 0 ? Math.min(100, (sz / maxSz) * 100) : 0;
  return (
    <div className="relative flex items-center justify-between px-1.5 py-[2px] font-mono text-[10px] tabular-nums">
      <div className={`absolute inset-y-0 ${side === "bid" ? "left-0 bg-emerald-500/10" : "right-0 bg-rose-500/10"}`} style={{ width: `${w}%` }} />
      <span className={`relative z-10 ${side === "bid" ? "text-emerald-300" : "text-rose-300"}`}>{fmtN(px, decs)}</span>
      <span className="relative z-10 text-neutral-400">{fmtN(sz, 3)}</span>
      <span className="relative z-10 w-8 text-right text-neutral-600">{n > 0 ? `×${n}` : ""}</span>
    </div>
  );
}

export default function MicrostructurePanel({ sym }: { sym: string }) {
  const q = usePolling<MicroResp>(`/api/cg/micro?sym=${encodeURIComponent(sym)}&quiet=1`, 15_000);
  const d = q.data && q.data.sym === sym ? q.data : null;
  const hlCoin = d?.ok && d.hl?.ok ? d.hl.coin : null;
  const hlWs = useHlBook(hlCoin);

  if (!d || !d.ok) return null;

  const hl = d.hl;
  const lo = d.lighter;
  const hlLive = hl?.ok;
  const loLive = lo?.ok;
  // suppressed-with-reason still renders its amber box (RV-QA MAJOR-1):
  // XPT/JP225 must show WHY they are thin, not vanish
  const hasAny = hlLive || loLive || hl?.suppressed || lo?.suppressed;
  if (!hasAny) return null;

  const hlWsLive = !!(hlLive && hlWs.book && hlWs.status === "open");
  const liveMid = hlWsLive ? hlWs.book!.mid ?? hl?.mark ?? null : hl?.mark ?? null;
  const liveSpread = hlWsLive ? hlWs.book!.spreadPct ?? hl?.spreadPct ?? null : hl?.spreadPct ?? null;
  const liveBidNotional = hlWsLive ? hlWs.book!.bidNotional : hl?.bids.notionalUsd ?? 0;
  const liveAskNotional = hlWsLive ? hlWs.book!.askNotional : hl?.asks.notionalUsd ?? 0;
  const liveImb = hlWsLive ? hlWs.book!.imbalance20 ?? hl?.imbalance20 ?? null : hl?.imbalance20 ?? null;

  const decs = (v: number | null | undefined) => {
    if (null == v || !Number.isFinite(v)) return 2;
    if (v >= 1000) return 1;
    if (v >= 10) return 2;
    if (v >= 1) return 4;
    return 5;
  };
  const pxDecs = decs(liveMid ?? lo?.bestBid);

  const hlBids = (hlWsLive ? hlWs.book!.bids : hl?.bids.levels ?? []).slice(0, 10);
  const hlAsks = (hlWsLive ? hlWs.book!.asks : hl?.asks.levels ?? []).slice(0, 10);
  const hlMaxSz = Math.max(0, ...hlBids.map((l) => l.sz), ...hlAsks.map((l) => l.sz));

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Microstructure · L2/L3 <span className="text-neutral-600">— free crypto-rail venues, live</span>
        </div>
        <span className={`text-[9px] font-mono ${hlWsLive ? "text-emerald-400" : "text-neutral-600"}`}>
          {hlWsLive ? "HL L2 WS live · Lighter 15s" : "poll 15s · REST"}
        </span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---- 1. Hyperliquid xyz L2 ---- */}
        {hl && (hlLive || hl.suppressed) && (
          <div className="rounded-lg border border-neutral-800 bg-[#11151a] p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <div className="text-xs font-semibold text-neutral-300">
                Perp L2 · <span className="text-sky-400">Hyperliquid {hl.coin}</span>
                {hlWsLive && (
                  <span className="ml-1.5 rounded bg-emerald-500/15 px-1 py-0.5 text-[9px] font-semibold text-emerald-300">
                    WS
                  </span>
                )}
              </div>
              {hl.vol24hUsd != null && <span className="text-[10px] text-neutral-500">{fmtUsd(hl.vol24hUsd)}/24h</span>}
            </div>
            {hlLive ? (
              <>
                <div className="mb-2 grid grid-cols-2 gap-x-3 font-mono text-[10px] tabular-nums text-neutral-400">
                  <div className="flex justify-between">
                    <span className="text-neutral-600">{hlWsLive ? "book mid" : "mark"}</span>
                    <span className="text-neutral-200">{fmtN(liveMid, pxDecs)}</span>
                  </div>
                  <div className="flex justify-between"><span className="text-neutral-600">spread</span><span>{fmtN(liveSpread, 4)}%</span></div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">vs oracle</span>
                    <span className={hl.markVsOraclePct != null && hl.markVsOraclePct > 0 ? "text-emerald-400" : "text-rose-400"}>{hl.markVsOraclePct != null ? `${hl.markVsOraclePct > 0 ? "+" : ""}${fmtN(hl.markVsOraclePct, 3)}%` : "–"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">funding 1h</span>
                    <span className={hl.funding1hPct != null && hl.funding1hPct < 0 ? "text-emerald-400" : "text-rose-400"}>
                      {hl.funding1hPct != null ? `${hl.funding1hPct > 0 ? "+" : ""}${fmtN(hl.funding1hPct, 4)}%` : "–"}
                    </span>
                  </div>
                  <div className="flex justify-between"><span className="text-neutral-600">OI</span><span>{fmtUsd(hl.oiNotionalUsd)}</span></div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">ΔOI 24h</span>
                    <span className={hl.oiD24hPct != null && hl.oiD24hPct !== 0 ? (hl.oiD24hPct > 0 ? "text-emerald-400" : "text-rose-400") : ""}>
                      {hl.oiD24hPct != null ? `${hl.oiD24hPct > 0 ? "+" : ""}${fmtN(hl.oiD24hPct, 1)}%` : <span className="text-neutral-600">history &lt;23h</span>}
                    </span>
                  </div>
                </div>
                {hl.fundingAprPct != null && (
                  <div className="mb-2 flex justify-between font-mono text-[9px] text-neutral-600">
                    <span>APR if current 1h rate persisted</span>
                    <span>{fmtN(hl.fundingAprPct, 1)}%</span>
                  </div>
                )}
                {hl.fundingAprNote && <div className="mb-2 text-[9px] text-amber-500">{hl.fundingAprNote}</div>}
                <div className="rounded border border-neutral-800">
                  {hlAsks.slice().reverse().map((l, i) => <LadderRow key={`a${i}`} {...l} maxSz={hlMaxSz} side="ask" decs={pxDecs} />)}
                  <div className="border-y border-neutral-800 bg-neutral-900/50 px-1.5 py-[3px] text-center font-mono text-[9px] text-neutral-500">
                    {fmtN(liveBidNotional / 1000, 0)}K bid ∣ {fmtN(liveAskNotional / 1000, 0)}K ask (20 lvls)
                  </div>
                  {hlBids.map((l, i) => <LadderRow key={`b${i}`} {...l} maxSz={hlMaxSz} side="bid" decs={pxDecs} />)}
                </div>
                {liveImb != null && (
                  <div className="mt-2">
                    <div className="flex h-2 overflow-hidden rounded bg-neutral-800">
                      <div className="bg-emerald-500/70" style={{ width: `${liveImb * 100}%` }} />
                      <div className="flex-1 bg-rose-500/70" />
                    </div>
                    <div className="mt-1 flex justify-between font-mono text-[9px] text-neutral-600">
                      <span>bid share {(liveImb * 100).toFixed(1)}% {hlWsLive ? "— live WS" : "— single snapshot, noisy"}</span>
                      <span>{hl.coin}</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded border border-dashed border-amber-500/30 bg-amber-500/5 p-3 text-[10px] leading-relaxed text-amber-500/90">{hl.suppressed ?? hl.error}</div>
            )}
          </div>
        )}

        {/* ---- 2. Lighter L3 ---- */}
        {lo && (loLive || lo.suppressed) && (
          <div className="rounded-lg border border-neutral-800 bg-[#11151a] p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <div className="text-xs font-semibold text-neutral-300">
                L3 resting orders · <span className="text-violet-400">Lighter {lo.symbol}</span>
              </div>
              <span className="text-[10px] text-neutral-500">{lo.nResting} orders{lo.capHint ? " (250/side cap)" : ""}</span>
            </div>
            {loLive ? (
              <>
                <div className="mb-2 grid grid-cols-2 gap-x-3 font-mono text-[10px] tabular-nums text-neutral-400">
                  <div className="flex justify-between"><span className="text-neutral-600">best bid</span><span className="text-emerald-300">{fmtN(lo.bestBid, pxDecs)}</span></div>
                  <div className="flex justify-between"><span className="text-neutral-600">spread</span><span>{fmtN(lo.spreadPct, 4)}%</span></div>
                  <div className="flex justify-between"><span className="text-neutral-600">best ask</span><span className="text-rose-300">{fmtN(lo.bestAsk, pxDecs)}</span></div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">book imbalance</span>
                    <span>{lo.imbalance != null ? `${(lo.imbalance * 100).toFixed(1)}% bid` : "–"}</span>
                  </div>
                </div>

                <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-neutral-600">
                  Directional whales (floor {fmtUsd(Math.max(50_000, 0.05 * Math.max(lo.bidNotionalUsd, lo.askNotionalUsd)))} · one-sided ≥80%)
                </div>
                {lo.whales.length ? (
                  <div className="mb-2 space-y-[3px] font-mono text-[10px] tabular-nums">
                    {lo.whales.slice(0, 6).map((w) => (
                      <div key={w.account} className="flex items-center justify-between rounded bg-neutral-900/60 px-1.5 py-[3px]">
                        <span className="text-neutral-500">{shortAcc(w.account)}</span>
                        <span className={`w-9 text-center text-[9px] font-bold ${w.side === "bid" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}>{w.side === "bid" ? "BID" : "ASK"}</span>
                        <span className="text-neutral-300">{fmtUsd(w.notionalUsd)}</span>
                        <span className="text-neutral-600">{w.orders}ord</span>
                        <span className="text-neutral-500">{fmtN(w.avgPx, pxDecs)}</span>
                        <span className="w-10 text-right text-neutral-600">{w.fillPct != null ? `${w.fillPct.toFixed(0)}%fl` : ""}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mb-2 rounded border border-dashed border-neutral-800 px-2 py-1.5 text-[10px] text-neutral-600">
                    no directional account above the floor — book is quoting/MM dominated (honest, not a signal)
                  </div>
                )}
                {lo.quoting.length > 0 && (
                  <div className="mb-2 font-mono text-[9px] text-neutral-600">
                    quoting/MM: {lo.quoting.map((m) => `${shortAcc(m.account)} ${fmtUsd(m.notionalUsd)}/${m.orders}ord`).join(" · ")}
                  </div>
                )}

                {lo.partials.length > 0 && (
                  <div className="mb-2">
                    <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-neutral-600">Visible partial fills (censored — filled orders vanish)</div>
                    <div className="space-y-[2px] font-mono text-[9px] tabular-nums text-neutral-500">
                      {lo.partials.slice(0, 4).map((p) => (
                        <div key={p.orderId} className="flex justify-between">
                          <span>{shortAcc(p.account)} @ {fmtN(p.px, pxDecs)}</span>
                          <span className="text-amber-500">{p.fillPct.toFixed(0)}% filled ({fmtN(p.remainingSz, 3)}/{fmtN(p.initialSz, 3)})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mb-1 flex items-baseline justify-between">
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-neutral-600">Last prints</div>
                  <span className="text-[9px] text-neutral-600">
                    {lo.prints.length} shown · span {fmtAge(lo.printSpanS)} · newest {fmtAge(lo.newestPrintAgeS)} ago
                  </span>
                </div>
                <div className="max-h-28 space-y-[1px] overflow-y-auto font-mono text-[9px] tabular-nums">
                  {lo.prints.slice(0, 8).map((p, i) => (
                    <div key={i} className="flex justify-between text-neutral-500">
                      <span className={p.isMakerAsk ? "text-emerald-400" : "text-rose-400"}>
                        {p.isMakerAsk ? "▲ taker bought" : "▼ taker sold"} {fmtN(p.px, pxDecs)}
                      </span>
                      <span>{fmtN(p.sz, 4)} · {fmtUsd(p.usd)}</span>
                    </div>
                  ))}
                </div>
                {lo.takerBuyUsd != null && lo.takerSellUsd != null && (
                  <div className="mt-1 flex justify-between font-mono text-[9px] text-neutral-600">
                    <span className="text-emerald-500/80">taker buy {fmtUsd(lo.takerBuyUsd)}</span>
                    <span className="text-rose-500/80">taker sell {fmtUsd(lo.takerSellUsd)}</span>
                    <span>(last {lo.prints.length ? "100" : "0"} fetched prints — anecdote on thin markets)</span>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded border border-dashed border-amber-500/30 bg-amber-500/5 p-3 text-[10px] leading-relaxed text-amber-500/90">{lo.suppressed ?? lo.error}</div>
            )}
          </div>
        )}
      </div>

      {/* standing disclaimers (RV-QUANT rules) */}
      <div className="mt-2 rounded-lg border border-neutral-800 bg-[#0e1216] p-3 text-[10px] leading-relaxed text-neutral-500">
        <span className="font-semibold text-neutral-400">Signal-market microstructure — context only:</span> these crypto-rail venues are not
        execution venues; orders execute at broker MT5 (FundedNext). Crypto-rail venue flow ≠ underlying market flow (xyz gold ≈ 0.1% of global
        gold turnover — this layer reads crypto leverage demand). Microstructure carries <span className="text-neutral-400">no scorecard weight</span>;
        L3 imbalance/whales gate nothing until a logged correlation study over ≥30 desk rounds says otherwise.
        {d.note ? <span className="block pt-1 text-neutral-600">note: {d.note}</span> : null}
      </div>
    </div>
  );
}
