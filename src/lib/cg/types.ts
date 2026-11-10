/** Shared types for Coinglass web-API payloads (factual market data). */

/** [ts, open, high, low, close, volumeUsd] — numbers may arrive as strings */
export type KlineRow = [number, string | number, string | number, string | number, string | number, string | number];

/** [ts, open, high, low, close] for open-interest series */
export type OiKlineRow = [number, string | number, string | number, string | number, string | number];

/** [priceLow, priceHigh, buyBaseVol, sellBaseVol, buyUsd, sellUsd, buyUsd2, sellUsd2, buyCount, sellCount] */
export type OrderFlowBucket = [
  number, number, number, number, number, number, number, number, number, number
];

export interface OrderFlowBar {
  ts: number;
  buckets: OrderFlowBucket[];
}

export interface LargeOrderItem {
  id: number;
  exchangeName: string;
  name: string;
  symbol: string;
  price: number;
  side: 1 | 2; // 1 = ask (sell wall), 2 = bid (buy wall)
  baseVol: number;
  quoteVol: number; // initial USD value
  volUsd: number; // remaining USD value
  createTime: number;
  turnoverTime?: number;
  turnoverNumber?: number; // fill count
  tradeId?: string;
}

export interface LargeOrderGroup {
  instrument: {
    exName: string;
    instrumentId: string;
    contractType?: string;
    type?: number; // 1 = futures, 10 = spot
    pricePrecision?: number;
    [k: string]: unknown;
  };
  list: LargeOrderItem[];
}

export interface LiquidationLevel {
  beginDate: number; // unix seconds the batch was opened
  level: number; // tier group
  level2: "h1" | "h2" | "h3" | string; // leverage sub-tier
  price: number;
  side: 1 | 2; // 1 = long liquidations (below price), 2 = short liquidations (above)
  size: number; // estimated size (base units)
  x: number; // bar index where the line starts
}

export interface LiquidationLevelsResponse {
  data: LiquidationLevel[];
}

/** Large taker order (fapi largeTakerOrder/v3) — resting whale orders per venue. */
export interface LtoOrder {
  id: number;
  name: string;
  price: number;
  side: 1 | 2; // 1 = ask (sell), 2 = bid (buy)
  startAmount: number; // initial base size
  startUsd: number; // initial USD value
  currentAmount: number; // remaining base size
  currentUsd: number; // remaining USD value
  vol: number; // filled base size
  volUsd: number; // filled USD value
  count: number; // number of fills
  state: number; // 1 = open
  startTime: number; // ms
  currentTime: number; // ms
  endTime?: number; // ms (finished orders)
}

export interface LtoInstrument {
  exName: string;
  instrumentId: string;
  name?: string;
  type: number; // 1 = futures/perp, 10 = spot
  baseAsset?: string;
  quoteAsset?: string;
  contractType?: string;
  pricePrecision?: number;
  priceTick?: number;
  [k: string]: unknown;
}

export interface LtoGroup {
  instrument: LtoInstrument;
  list: LtoOrder[];
}

export interface LtoSupportSection {
  exchange: string;
  instruments: LtoInstrument[];
}

export interface LtoSupport {
  spot: LtoSupportSection[];
  futures: LtoSupportSection[];
}
