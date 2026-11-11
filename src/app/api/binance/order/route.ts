import { NextRequest, NextResponse } from "next/server";
import {
  BinanceApiError,
  binanceCreds,
  cancelAllOrdersBoth,
  cancelAlgoOrder,
  cancelOrder,
  isConditionalType,
  placeOrder,
} from "@/lib/binance/signed";
import { binAssetOf, getUniverse } from "@/lib/binance/universe";

export const dynamic = "force-dynamic";

/**
 * POST /api/binance/order — demo order actions (TESTNET GATED).
 *
 * actions: place | cancel | cancelAll
 *
 * Every mutating call funnels through src/lib/binance/signed.ts, which
 * refuses to run unless BINANCE_MODE === "testnet" (a mainnet key can be
 * READ via /api/binance/account but can never trade through this route).
 * Quantities and prices are rounded to the exchange's own step/tick
 * precision from the live universe registry before submission.
 */
interface PlaceBody {
  action: "place";
  symbol: string;
  side: "BUY" | "SELL";
  type: "LIMIT" | "MARKET" | "STOP_MARKET" | "TAKE_PROFIT_MARKET";
  quantity: number;
  price?: number;
  /** trigger price for STOP_MARKET / TAKE_PROFIT_MARKET (algo lane) */
  stopPrice?: number;
  reduceOnly?: boolean;
}
interface CancelBody {
  action: "cancel";
  symbol: string;
  orderId: number;
}
interface CancelAllBody {
  action: "cancelAll";
  symbol: string;
}

function roundTo(v: number, decs: number): number {
  return Number(v.toFixed(decs));
}

export async function POST(req: NextRequest) {
  const creds = binanceCreds();
  if (!creds) {
    return NextResponse.json(
      { ok: false, error: "no BINANCE credentials configured — demo trading unavailable" },
      { status: 400 }
    );
  }
  if (creds.mode !== "testnet") {
    return NextResponse.json(
      { ok: false, error: `order placement DISABLED — BINANCE_MODE="${creds.mode}" ≠ "testnet" (demo gate)` },
      { status: 403 }
    );
  }
  let body: PlaceBody | CancelBody | CancelAllBody;
  try {
    body = (await req.json()) as PlaceBody | CancelBody | CancelAllBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }
  const sym = String(body.symbol ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{2,20}$/.test(sym)) {
    return NextResponse.json({ ok: false, error: `bad symbol shape ${sym}` }, { status: 400 });
  }
  await getUniverse();
  const a = binAssetOf(sym);
  if (!a) {
    return NextResponse.json(
      { ok: false, error: `${sym} is not in the curated universe` },
      { status: 400 }
    );
  }
  // punchable guard: curated pairs exist on the PRODUCTION book but not every
  // one is listed on testnet.binancefuture.com (verified 2026-11-12: 14 of
  // the 58 are not). Live data stays available — only demo execution is
  // refused, with a message the ticket renders verbatim.
  if (!a.punchable) {
    return NextResponse.json(
      { ok: false, error: `${a.pair} is not listed on the Binance futures TESTNET — live data only, demo orders unavailable` },
      { status: 400 }
    );
  }
  try {
    if (body.action === "place") {
      const side = String(body.side ?? "").toUpperCase();
      const type = String(body.type ?? "").toUpperCase();
      if (side !== "BUY" && side !== "SELL") {
        return NextResponse.json({ ok: false, error: `bad side ${side}` }, { status: 400 });
      }
      if (!["LIMIT", "MARKET", "STOP_MARKET", "TAKE_PROFIT_MARKET"].includes(type)) {
        return NextResponse.json({ ok: false, error: `bad type ${type}` }, { status: 400 });
      }
      if (isConditionalType(type)) {
        const sp = Number(body.stopPrice);
        if (!Number.isFinite(sp) || sp <= 0) {
          return NextResponse.json({ ok: false, error: `${type} requires a positive stopPrice (trigger)` }, { status: 400 });
        }
      }
      const qty = Number(body.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        return NextResponse.json(
          { ok: false, error: "quantity must be a positive number (bracket legs carry an explicit reduce-only quantity)" },
          { status: 400 }
        );
      }
      const qtyR = roundTo(qty, a.qtyDecs);
      if (qtyR <= 0) {
        return NextResponse.json(
          { ok: false, error: `quantity ${qty} rounds to 0 at exchange step precision (${a.qtyDecs} decimals)` },
          { status: 400 }
        );
      }
      let priceR: number | undefined;
      if (type === "LIMIT") {
        const px = Number(body.price);
        if (!Number.isFinite(px) || px <= 0) {
          return NextResponse.json({ ok: false, error: "LIMIT order requires a positive price" }, { status: 400 });
        }
        priceR = roundTo(px, a.priceDecs);
      }
      let stopR: number | undefined;
      if (isConditionalType(type)) {
        stopR = roundTo(Number(body.stopPrice), a.priceDecs);
      }
      const result = await placeOrder({
        symbol: a.pair,
        side: side as "BUY" | "SELL",
        type: type as "LIMIT" | "MARKET" | "STOP_MARKET" | "TAKE_PROFIT_MARKET",
        quantity: qtyR,
        price: priceR,
        stopPrice: stopR,
        reduceOnly: body.reduceOnly === true,
      });
      return NextResponse.json({
        ok: true,
        action: "place",
        sent: {
          symbol: a.pair,
          side,
          type,
          quantity: qtyR,
          ...(priceR != null ? { price: priceR } : {}),
          ...(stopR != null ? { stopPrice: stopR, lane: "algo/conditional" } : {}),
          reduceOnly: isConditionalType(type) ? true : body.reduceOnly === true,
        },
        result,
      });
    }
    if (body.action === "cancel") {
      const orderId = Number(body.orderId);
      if (!Number.isInteger(orderId) || orderId <= 0) {
        return NextResponse.json({ ok: false, error: "cancel requires a positive integer orderId" }, { status: 400 });
      }
      try {
        const result = await cancelOrder(a.pair, orderId);
        return NextResponse.json({ ok: true, action: "cancel", lane: "regular", result });
      } catch (err) {
        // algo/conditional legs live on their own lane — fall back to it
        if (err instanceof BinanceApiError && err.code === -2011) {
          const result = await cancelAlgoOrder(a.pair, orderId);
          return NextResponse.json({ ok: true, action: "cancel", lane: "algo", result });
        }
        throw err;
      }
    }
    if (body.action === "cancelAll") {
      const result = await cancelAllOrdersBoth(a.pair);
      return NextResponse.json({ ok: true, action: "cancelAll", result });
    }
    const action = String((body as { action?: string }).action ?? "");
    return NextResponse.json({ ok: false, error: `unknown action ${action}` }, { status: 400 });
  } catch (err) {
    if (err instanceof BinanceApiError) {
      return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: 400 });
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "order action failed" },
      { status: 502 }
    );
  }
}
