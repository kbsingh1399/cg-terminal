import { createHmac } from "node:crypto";

/**
 * Binance USDT-M futures SIGNED client — the demo-trading lane.
 *
 * Credentials live ONLY in .env (gitignored by design, see SESSION-STATE
 * handoff protocol): BINANCE_API_KEY / BINANCE_API_SECRET / BINANCE_MODE.
 * The provided key set is a futures TESTNET key (verified 2026-11-11:
 * testnet.binancefuture.com /fapi/v2/account → 200, canTrade, ~4096 USDT
 * of fake funds).
 *
 * HARD SAFETY GATE: every mutating call (placeOrder/cancelOrder/cancelAll)
 * throws unless BINANCE_MODE is exactly "testnet". If a MAINNET key ever
 * lands in .env, the account snapshot stays readable but orders are
 * refused — the terminal cannot move real money by configuration mistake.
 *
 * Read path (accountSnapshot) is cached 5s and shared by every consumer.
 */

const TESTNET_BASE = "https://testnet.binancefuture.com";
const MAINNET_BASE = "https://fapi.binance.com";
const RECV_WINDOW = "5000";
const ACCOUNT_TTL_MS = 5_000;

export class BinanceApiError extends Error {
  code: number;
  constructor(msg: string, code: number) {
    super(msg);
    this.name = "BinanceApiError";
    this.code = code;
  }
}

export interface BinanceCreds {
  key: string;
  secret: string;
  mode: string;
}

export function binanceCreds(): BinanceCreds | null {
  const key = process.env.BINANCE_API_KEY;
  const secret = process.env.BINANCE_API_SECRET;
  if (!key || !secret) return null;
  return { key, secret, mode: (process.env.BINANCE_MODE ?? "testnet").trim().toLowerCase() };
}

export function isTestnet(): boolean {
  return binanceCreds()?.mode === "testnet";
}

function baseUrl(creds: BinanceCreds): string {
  return creds.mode === "testnet" ? TESTNET_BASE : MAINNET_BASE;
}

async function signed<T = unknown>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  params: Record<string, string | number | boolean>,
  timeoutMs = 8_000
): Promise<T> {
  const c = binanceCreds();
  if (!c) throw new BinanceApiError("no BINANCE_API_KEY/SECRET configured in .env", -1);
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) q.set(k, String(v));
  q.set("recvWindow", RECV_WINDOW);
  q.set("timestamp", String(Date.now()));
  const sig = createHmac("sha256", c.secret).update(q.toString()).digest("hex");
  q.set("signature", sig);
  const res = await fetch(`${baseUrl(c)}${path}?${q.toString()}`, {
    method,
    headers: { "X-MBX-APIKEY": c.key, accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const b = body as { msg?: string; code?: number };
    throw new BinanceApiError(b?.msg ?? `HTTP ${res.status}`, b?.code ?? res.status);
  }
  return body as T;
}

// ---------------------------------------------------------------------------
// Account snapshot (read-only, shared 5s cache)
// ---------------------------------------------------------------------------

export interface BinanceAccount {
  ok: true;
  mode: string;
  at: number;
  canTrade: boolean;
  totalWalletBalance: number;
  totalAvailableBalance: number;
  totalMarginBalance: number;
  totalUnrealizedProfit: number;
  assets: { asset: string; walletBalance: number; availableBalance: number }[];
  positions: {
    symbol: string;
    positionAmt: number;
    entryPrice: number;
    markPrice: number;
    unRealizedProfit: number;
    leverage: string;
  }[];
  openOrders: {
    orderId: number;
    symbol: string;
    side: string;
    type: string;
    price: number;
    origQty: number;
    status: string;
    time: number;
    reduceOnly: boolean;
    /** true = CONDITIONAL bracket leg (algoId, triggerPrice) */
    algo?: boolean;
    triggerPrice?: number;
  }[];
}

interface SnapshotCache {
  at: number;
  inflight: Promise<{ ok: false; error: string } | BinanceAccount> | null;
  value: { ok: false; error: string } | BinanceAccount | null;
}

const g = globalThis as unknown as { __binAccount?: SnapshotCache };
const cache = (g.__binAccount ??= { at: 0, inflight: null, value: null });

export async function accountSnapshot(): Promise<{ ok: false; error: string } | BinanceAccount> {
  const creds = binanceCreds();
  if (!creds) {
    return {
      ok: false,
      error: "no BINANCE_API_KEY/SECRET in .env — demo trading not configured (market data needs no key)",
    };
  }
  if (cache.value && cache.value.ok && Date.now() - cache.at < ACCOUNT_TTL_MS) return cache.value;
  if (cache.inflight) return cache.inflight;
  cache.inflight = (async () => {
    try {
      const [acct, orders, algoOrders] = await Promise.all([
        signed<{
          canTrade: boolean;
          totalWalletBalance: string;
          totalAvailableBalance: string;
          totalMarginBalance: string;
          totalUnrealizedProfit: string;
          assets: { asset: string; walletBalance: string; availableBalance: string }[];
          positions: {
            symbol: string;
            positionAmt: string;
            entryPrice: string;
            markPrice: string;
            unRealizedProfit: string;
            leverage: string;
          }[];
        }>("GET", "/fapi/v2/account", {}),
        signed<
          {
            orderId: number;
            symbol: string;
            side: string;
            type: string;
            price: string;
            origQty: string;
            status: string;
            time: number;
            reduceOnly?: boolean;
          }[]
        >("GET", "/fapi/v1/openOrders", {}),
        signed<
          {
            algoId: number;
            symbol: string;
            side: string;
            orderType: string;
            algoStatus: string;
            triggerPrice: string;
            quantity: string;
            bookTime?: number;
            algoType?: string;
          }[]
        >("GET", "/fapi/v1/openAlgoOrders", {}).catch(
          () =>
            [] as {
              algoId: number;
              symbol: string;
              side: string;
              orderType: string;
              algoStatus: string;
              triggerPrice: string;
              quantity: string;
              bookTime?: number;
              algoType?: string;
            }[]
        ),
      ]);
      const snap: BinanceAccount = {
        ok: true,
        mode: creds.mode,
        at: Date.now(),
        canTrade: !!acct.canTrade,
        totalWalletBalance: Number(acct.totalWalletBalance) || 0,
        totalAvailableBalance: Number(acct.totalAvailableBalance) || 0,
        totalMarginBalance: Number(acct.totalMarginBalance) || 0,
        totalUnrealizedProfit: Number(acct.totalUnrealizedProfit) || 0,
        assets: (acct.assets ?? [])
          .map((a) => ({
            asset: a.asset,
            walletBalance: Number(a.walletBalance) || 0,
            availableBalance: Number(a.availableBalance) || 0,
          }))
          .filter((a) => a.walletBalance !== 0 || a.availableBalance !== 0)
          .sort((a, b) => b.walletBalance - a.walletBalance)
          .slice(0, 12),
        positions: (acct.positions ?? [])
          .map((p) => ({
            symbol: p.symbol,
            positionAmt: Number(p.positionAmt) || 0,
            entryPrice: Number(p.entryPrice) || 0,
            markPrice: Number(p.markPrice) || 0,
            unRealizedProfit: Number(p.unRealizedProfit) || 0,
            leverage: p.leverage,
          }))
          .filter((p) => p.positionAmt !== 0),
        openOrders: [
          ...(orders ?? []).map((o) => ({
            orderId: o.orderId,
            symbol: o.symbol,
            side: o.side,
            type: o.type,
            price: Number(o.price) || 0,
            origQty: Number(o.origQty) || 0,
            status: o.status,
            time: o.time,
            reduceOnly: !!o.reduceOnly,
          })),
          ...(algoOrders ?? []).map((o) => ({
            orderId: o.algoId,
            symbol: o.symbol,
            side: o.side,
            type: o.orderType,
            price: 0,
            origQty: Number(o.quantity) || 0,
            status: o.algoStatus ?? "NEW",
            time: o.bookTime ?? 0,
            reduceOnly: true,
            algo: true,
            triggerPrice: Number(o.triggerPrice) || 0,
          })),
        ],
      };
      cache.value = snap;
      cache.at = Date.now();
      return snap;
    } catch (err) {
      const e = err instanceof BinanceApiError ? `${err.message} (code ${err.code})` : err instanceof Error ? err.message : "account fetch failed";
      // cache errors only briefly so config fixes surface fast
      cache.at = Date.now();
      cache.value = { ok: false, error: e };
      return cache.value;
    } finally {
      cache.inflight = null;
    }
  })();
  return cache.inflight;
}

// ---------------------------------------------------------------------------
// Orders — TESTNET GATED
// ---------------------------------------------------------------------------

/** Bust the 5s account-snapshot cache (after a successful order mutation the
 *  next /api/binance/account read must see the new state immediately). */
function invalidateAccountCache(): void {
  cache.at = 0;
  cache.value = null;
}

function gateOrders(): void {
  const c = binanceCreds();
  if (!c) throw new BinanceApiError("no BINANCE credentials configured", -1);
  if (c.mode !== "testnet") {
    throw new BinanceApiError(`order placement DISABLED — BINANCE_MODE="${c.mode}" ≠ "testnet" (demo gate)`, -2);
  }
}

export type OrderType = "LIMIT" | "MARKET" | "STOP_MARKET" | "TAKE_PROFIT_MARKET";

export interface PlaceOrderReq {
  symbol: string; // full pair, e.g. "BTCUSDT"
  side: "BUY" | "SELL";
  type: OrderType;
  quantity: number;
  price?: number;
  /** trigger price for STOP_MARKET / TAKE_PROFIT_MARKET */
  stopPrice?: number;
  reduceOnly?: boolean;
}

/** Since 2025-12-09 Binance rejects conditional types on /fapi/v1/order
 *  (-4120 "use the Algo Order API endpoints") — STOP_MARKET and
 *  TAKE_PROFIT_MARKET go through POST /fapi/v1/algoOrder with
 *  algoType=CONDITIONAL, triggerPrice (NOT stopPrice — the old name is
 *  silently accepted but never fires) and an EXPLICIT quantity with
 *  reduceOnly (closePosition was removed from the wire). */
export function isConditionalType(t: string): boolean {
  return t === "STOP_MARKET" || t === "TAKE_PROFIT_MARKET";
}

export async function placeOrder(o: PlaceOrderReq): Promise<Record<string, unknown>> {
  gateOrders();
  if (isConditionalType(o.type)) {
    if (o.stopPrice == null || !Number.isFinite(o.stopPrice) || o.stopPrice <= 0) {
      throw new BinanceApiError(`${o.type} requires a positive stopPrice`, -4);
    }
    const params: Record<string, string | number | boolean> = {
      symbol: o.symbol,
      side: o.side,
      algoType: "CONDITIONAL",
      type: o.type,
      triggerPrice: o.stopPrice,
      quantity: o.quantity, // brackets always reduce — explicit qty required
      reduceOnly: true,
      workingType: "MARK_PRICE", // liquidation-grade triggers
    };
    const r = await signed<Record<string, unknown>>("POST", "/fapi/v1/algoOrder", params, 10_000);
    invalidateAccountCache();
    return r;
  }
  const params: Record<string, string | number | boolean> = {
    symbol: o.symbol,
    side: o.side,
    type: o.type,
    quantity: o.quantity,
  };
  if (o.type === "LIMIT") {
    if (o.price == null || !Number.isFinite(o.price) || o.price <= 0) {
      throw new BinanceApiError("LIMIT order requires a positive price", -3);
    }
    params.timeInForce = "GTC";
    params.price = o.price;
  }
  if (o.reduceOnly) params.reduceOnly = true;
  const r = await signed<Record<string, unknown>>("POST", "/fapi/v1/order", params, 10_000);
  invalidateAccountCache();
  return r;
}

export async function cancelOrder(symbol: string, orderId: number): Promise<Record<string, unknown>> {
  gateOrders();
  const r = await signed<Record<string, unknown>>("DELETE", "/fapi/v1/order", { symbol, orderId }, 10_000);
  invalidateAccountCache();
  return r;
}

/** Cancel a CONDITIONAL (algo) order — DELETE /fapi/v1/algoOrder by algoId. */
export async function cancelAlgoOrder(symbol: string, algoId: number): Promise<Record<string, unknown>> {
  gateOrders();
  const r = await signed<Record<string, unknown>>("DELETE", "/fapi/v1/algoOrder", { symbol, algoId }, 10_000);
  invalidateAccountCache();
  return r;
}

export async function cancelAllOpen(symbol: string): Promise<Record<string, unknown>> {
  gateOrders();
  const r = await signed<Record<string, unknown>>("DELETE", "/fapi/v1/allOpenOrders", { symbol }, 10_000);
  invalidateAccountCache();
  return r;
}

/** Cancel ALL open orders on a symbol — regular + conditional (algo) lanes. */
export async function cancelAllOrdersBoth(symbol: string): Promise<Record<string, unknown>> {
  gateOrders();
  const out: Record<string, unknown> = {};
  try {
    out.regular = await signed<Record<string, unknown>>("DELETE", "/fapi/v1/allOpenOrders", { symbol }, 10_000);
  } catch (err) {
    out.regular = err instanceof Error ? err.message : "cancel failed";
  }
  try {
    // no verified bulk algo endpoint on testnet — cancel per algoId
    const open = await signed<{ algoId?: number }[]>("GET", "/fapi/v1/openAlgoOrders", { symbol }, 10_000);
    const ids = (Array.isArray(open) ? open : []).map((o) => o.algoId).filter((x): x is number => typeof x === "number");
    out.algoCancelled = ids.length;
    out.algo = [];
    for (const id of ids) {
      try {
        const c = await signed<Record<string, unknown>>("DELETE", "/fapi/v1/algoOrder", { symbol, algoId: id }, 10_000);
        (out.algo as Record<string, unknown>[]).push(c);
      } catch {
        /* already gone — best effort */
      }
    }
  } catch (err) {
    out.algo = err instanceof Error ? err.message : "algo cancel failed";
  }
  invalidateAccountCache();
  return out;
}
