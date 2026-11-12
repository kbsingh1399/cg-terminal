"use client";

import { useEffect, useState } from "react";
import { usePolling } from "@/components/cg/use-cg-data";

/**
 * DemoAccountPanel — the Binance TESTNET trading panel.
 *
 * Account snapshot via /api/binance/account (signed, 5s server cache) and
 * the order ticket via /api/binance/order. Safety is layered: the server
 * route refuses every order unless BINANCE_MODE=testnet, and this panel
 * additionally hides the ticket for any non-testnet/unconfigured account.
 * Testnet funds are fake — this is the rehearsal venue before any real
 * Binance trading.
 */

interface AcctResp {
  ok: boolean;
  mode?: string;
  error?: string;
  canTrade?: boolean;
  totalWalletBalance?: number;
  totalAvailableBalance?: number;
  totalUnrealizedProfit?: number;
  assets?: { asset: string; walletBalance: number; availableBalance: number }[];
  positions?: {
    symbol: string;
    positionAmt: number;
    entryPrice: number;
    markPrice: number;
    unRealizedProfit: number;
    leverage: string;
  }[];
  openOrders?: {
    orderId: number;
    symbol: string;
    side: string;
    type: string;
    price: number;
    origQty: number;
    status: string;
    algo?: boolean;
    triggerPrice?: number;
  }[];
}

type TicketType = "LIMIT" | "MARKET" | "STOP_MARKET" | "TAKE_PROFIT_MARKET";

function OrderTicket({
  sym,
  qtyDecs,
  priceDecs,
  mid,
  punchable,
  onDone,
}: {
  sym: string;
  qtyDecs: number;
  priceDecs: number;
  mid: number | null;
  punchable: boolean;
  onDone: () => void;
}) {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [type, setType] = useState<TicketType>("LIMIT");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [trigger, setTrigger] = useState("");
  const [reduceOnly, setReduceOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [staged, setStaged] = useState<{ stop: number | null; direction: string } | null>(null);

  // NarrativeCard "Stage Setup into Ticket" — fills the form from the M1/M2
  // verdict (entry price + risk-sized qty) so execution is one click away.
  useEffect(() => {
    const onStage = (e: Event) => {
      const d = (e as CustomEvent<{ sym: string; side: "BUY" | "SELL"; price: number; qty: number; stop: number; direction: string }>).detail;
      if (d.sym !== sym) return;
      setSide(d.side);
      setType("LIMIT");
      setPrice(String(d.price));
      setQty(String(d.qty));
      setStaged({ stop: d.stop ?? null, direction: d.direction });
    };
    window.addEventListener("cg-stage-setup", onStage);
    return () => window.removeEventListener("cg-stage-setup", onStage);
  }, [sym]);

  const step = Math.pow(10, -qtyDecs);
  const px = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: priceDecs, maximumFractionDigits: priceDecs });
  const isTrigger = type === "STOP_MARKET" || type === "TAKE_PROFIT_MARKET";

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/binance/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as {
        ok: boolean;
        error?: string;
        result?: { orderId?: number; algoId?: number; status?: string; algoStatus?: string; msg?: string };
      };
      if (j.ok) {
        const id = j.result?.orderId ?? j.result?.algoId;
        setResult({
          ok: true,
          msg:
            body.action === "cancelAll"
              ? `all open orders cancelled${j.result?.msg ? ` — ${j.result.msg}` : ""}`
              : body.action === "cancel"
                ? `cancelled · orderId ${id ?? "?"}`
                : `accepted · id ${id ?? "?"} · ${j.result?.status ?? j.result?.algoStatus ?? "NEW"}`,
        });
      } else {
        setResult({ ok: false, msg: j.error ?? "rejected" });
      }
      onDone();
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : "network error" });
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    const q = Number(qty);
    if (!Number.isFinite(q) || q <= 0) {
      setResult({ ok: false, msg: "enter a positive quantity" });
      return;
    }
    if (type === "LIMIT" && !(Number(price) > 0)) {
      setResult({ ok: false, msg: "enter a positive limit price" });
      return;
    }
    if (isTrigger && !(Number(trigger) > 0)) {
      setResult({ ok: false, msg: "enter a positive trigger price (mark-price trigger)" });
      return;
    }
    void act({
      action: "place",
      symbol: sym,
      side,
      type,
      quantity: q,
      ...(type === "LIMIT" ? { price: Number(price) } : {}),
      ...(isTrigger ? { stopPrice: Number(trigger) } : {}),
      reduceOnly,
    });
  };

  return (
    <div className="mt-3 border-t border-neutral-800 pt-3">
      {staged && (
        <div className="mb-2 rounded border border-emerald-800/50 bg-emerald-950/30 px-2 py-1.5 text-[10px] leading-relaxed text-emerald-300">
          Staged from the M1/M2 narrative — {staged.direction} entry sized to your risk budget. Narrative stop:{" "}
          <span className="font-mono">{staged.stop != null ? staged.stop.toLocaleString("en-US") : "n/a"}</span>. Place the
          limit, then add the stop-market protective order yourself (or re-stage with a stop type).
        </div>
      )}
      {!punchable && (
        <div className="mb-2 rounded border border-amber-800/50 bg-amber-950/30 px-2 py-1.5 text-[10px] leading-relaxed text-amber-300">
          {sym}USDT is NOT listed on the futures testnet — live data only, demo order execution unavailable for this
          symbol (the server refuses it too).
        </div>
      )}
      <div className="mb-2 flex items-center gap-1.5">
        <button
          onClick={() => setSide("BUY")}
          className={`rounded px-3 py-1 text-[11px] font-bold ${side === "BUY" ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40" : "bg-neutral-800 text-neutral-400"}`}
        >
          BUY / LONG
        </button>
        <button
          onClick={() => setSide("SELL")}
          className={`rounded px-3 py-1 text-[11px] font-bold ${side === "SELL" ? "bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40" : "bg-neutral-800 text-neutral-400"}`}
        >
          SELL / SHORT
        </button>
        <span className="ml-2 text-[10px] text-neutral-600">
          qty step {step.toPrecision(2)} · tick {priceDecs} decs
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {(["LIMIT", "MARKET", "STOP_MARKET", "TAKE_PROFIT_MARKET"] as TicketType[]).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded px-2.5 py-1 text-[10px] font-semibold ${type === t ? "bg-neutral-700 text-neutral-100" : "bg-neutral-900 text-neutral-500"}`}
            title={
              t === "STOP_MARKET"
                ? "conditional stop (algo lane) — reduce-only, triggers on mark price"
                : t === "TAKE_PROFIT_MARKET"
                  ? "conditional take-profit (algo lane) — reduce-only, triggers on mark price"
                  : t
            }
          >
            {t === "STOP_MARKET" ? "SL STOP" : t === "TAKE_PROFIT_MARKET" ? "TP STOP" : t}
          </button>
        ))}
        <input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          inputMode="decimal"
          placeholder="qty"
          className="w-24 rounded border border-neutral-700 bg-[#0b0e11] px-2 py-1 font-mono text-[11px] text-neutral-100 focus:border-emerald-600 focus:outline-none"
        />
        {type === "LIMIT" ? (
          <>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              placeholder="price"
              className="w-28 rounded border border-neutral-700 bg-[#0b0e11] px-2 py-1 font-mono text-[11px] text-neutral-100 focus:border-emerald-600 focus:outline-none"
            />
            <button
              onClick={() => mid != null && setPrice(mid.toFixed(priceDecs))}
              title="fill with the live mid price"
              className="rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-300 hover:bg-neutral-700"
            >
              mid {mid != null ? px(mid) : "–"}
            </button>
          </>
        ) : null}
        {isTrigger ? (
          <>
            <input
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              inputMode="decimal"
              placeholder="trigger price"
              className="w-28 rounded border border-amber-800 bg-[#0b0e11] px-2 py-1 font-mono text-[11px] text-amber-200 focus:border-amber-500 focus:outline-none"
            />
            <span className="text-[9px] text-neutral-600">mark-price trigger · algo/conditional lane</span>
          </>
        ) : null}
        <label className="flex items-center gap-1 text-[10px] text-neutral-500">
          <input type="checkbox" checked={reduceOnly} onChange={(e) => setReduceOnly(e.target.checked)} className="accent-neutral-500" />
          reduce-only
        </label>
        <button
          onClick={submit}
          disabled={busy || !punchable}
          title={punchable ? undefined : "not on the Binance futures testnet — live data only"}
          className={`rounded px-3 py-1 text-[11px] font-bold text-black disabled:opacity-50 ${
            side === "BUY" ? "bg-emerald-500 hover:bg-emerald-400" : "bg-rose-500 hover:bg-rose-400"
          }`}
        >
          {busy ? "sending…" : `PLACE ${side} ${sym}USDT`}
        </button>
        <button
          onClick={() => void act({ action: "cancelAll", symbol: sym })}
          disabled={busy || !punchable}
          className="rounded border border-neutral-700 px-2.5 py-1 text-[10px] text-neutral-400 hover:bg-neutral-800 disabled:opacity-50"
          title={punchable ? "cancel every open order on this pair (testnet)" : "not on the futures testnet"}
        >
          cancel all {sym}USDT
        </button>
      </div>
      {result && (
        <div className={`mt-2 rounded px-2 py-1 font-mono text-[10px] ${result.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}`}>
          {result.ok ? "✓ " : "✕ "}
          {result.msg}
        </div>
      )}
      <div className="mt-1.5 text-[9px] text-neutral-600">
        Binance USDT-M futures TESTNET (demo) — fake funds, real matching engine. Order actions are server-gated to
        BINANCE_MODE=testnet and can never touch a mainnet account.
      </div>
    </div>
  );
}

export default function DemoAccountPanel({
  sym,
  qtyDecs,
  priceDecs,
  mid,
  punchable = true,
}: {
  sym: string;
  qtyDecs: number;
  priceDecs: number;
  mid: number | null;
  punchable?: boolean;
}) {
  const q = usePolling<AcctResp>("/api/binance/account", 15_000);
  const d = q.data;
  const usd = (v: number | undefined) => (v == null ? "–" : `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

  return (
    <div className="rounded-lg border border-neutral-800 bg-[#11151a] p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Binance demo account</span>
        {d?.ok ? (
          <span
            className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
              d.mode === "testnet" ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40" : "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40"
            }`}
            title={d.mode === "testnet" ? "testnet.binancefuture.com — fake funds" : "MAINNET key detected — orders disabled by the demo gate"}
          >
            {d.mode === "testnet" ? "testnet · live" : `${d.mode} · read-only`}
          </span>
        ) : (
          <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-neutral-400">
            not configured
          </span>
        )}
      </div>

      {!d && q.loading && <div className="py-4 text-[11px] text-neutral-600">loading account…</div>}

      {d && !d.ok && (
        <div className="rounded border border-dashed border-neutral-800 p-3 text-[11px] leading-relaxed text-neutral-500">
          {d.error ?? "account unavailable"}. Market data for the curated universe works without keys; add
          futures-testnet keys in
          <span className="font-mono text-neutral-400"> .env </span>
          (BINANCE_API_KEY / BINANCE_API_SECRET / BINANCE_MODE=testnet — from https://testnet.binancefuture.com) to enable
          demo trading.
        </div>
      )}

      {d?.ok && (
        <>
          <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] tabular-nums">
            <span className="text-neutral-500">
              wallet <span className="font-semibold text-neutral-100">{usd(d.totalWalletBalance)}</span>
            </span>
            <span className="text-neutral-500">
              available <span className="font-semibold text-neutral-100">{usd(d.totalAvailableBalance)}</span>
            </span>
            <span className="text-neutral-500">
              unrealized{" "}
              <span className={`font-semibold ${(d.totalUnrealizedProfit ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {usd(d.totalUnrealizedProfit)}
              </span>
            </span>
            <span className="text-neutral-500">
              open orders <span className="font-semibold text-neutral-100">{d.openOrders?.length ?? 0}</span>
            </span>
            {!d.canTrade && <span className="text-amber-400">canTrade=false — enable trading on the testnet key</span>}
          </div>

          {(d.positions?.length ?? 0) > 0 && (
            <div className="mt-2 space-y-0.5 font-mono text-[10px] tabular-nums">
              {d.positions!.map((p) => (
                <div key={p.symbol} className="flex justify-between text-neutral-400">
                  <span>
                    <span className={p.positionAmt > 0 ? "text-emerald-400" : "text-rose-400"}>{p.positionAmt > 0 ? "LONG" : "SHORT"}</span>{" "}
                    {p.symbol} ×{p.leverage} @ {p.entryPrice}
                  </span>
                  <span className={p.unRealizedProfit >= 0 ? "text-emerald-400" : "text-rose-400"}>
                    {p.unRealizedProfit >= 0 ? "+" : ""}
                    {p.unRealizedProfit.toFixed(2)} USDT
                  </span>
                </div>
              ))}
            </div>
          )}

          {(d.openOrders?.length ?? 0) > 0 && (
            <div className="mt-2 space-y-0.5 font-mono text-[10px] tabular-nums text-neutral-400">
              {d.openOrders!.map((o) => (
                <div key={`${o.algo ? "algo" : "reg"}-${o.orderId}`} className="flex justify-between">
                  <span>
                    #{o.orderId} {o.side} {o.type} {o.origQty}
                    {o.algo ? (
                      <span className="text-amber-300"> ⇄ {o.triggerPrice ?? "?"} </span>
                    ) : (
                      <span> @ {o.price} </span>
                    )}
                    {o.symbol}
                  </span>
                  <span className="text-neutral-600">{o.status}</span>
                </div>
              ))}
            </div>
          )}

          {d.mode === "testnet" && d.canTrade && (
            <OrderTicket sym={sym} qtyDecs={qtyDecs} priceDecs={priceDecs} mid={mid} punchable={punchable} onDone={q.refresh} />
          )}
          {d.mode !== "testnet" && (
            <div className="mt-3 rounded border border-amber-800/50 bg-amber-950/30 p-2 text-[10px] text-amber-300">
              MAINNET key detected — the account stays readable but the order ticket is hidden and the server refuses
              every order (demo gate). Point BINANCE_MODE at a testnet key set to trade the demo.
            </div>
          )}
        </>
      )}
    </div>
  );
}
