// probe 3: liquidationLevels on pinned TradFi keys + lto support/v3 shape
import { cgGet, FAPI } from "../src/lib/cg/client";

const liqKeys = [
  "Binance_NVDAUSDT", "OKX_NVDA-USDT-SWAP", "Bybit_NVDAUSDT", "Bitget_NVDAUSDT_UMCBL", "Gate_NVDA_USDT",
  "Binance_SOXLUSDT", "Binance_SPCXUSDT", "Binance_KORUUSDT", "Binance_DRAMUSDT",
  "Binance_MUUSDT", "OKX_MU-USDT-SWAP", "Bybit_MUUSDT", "Gate_MU_USDT", "Bitget_MUUSDT_UMCBL",
  "Binance_XAUUSDT", "OKX_XAU-USDT-SWAP", "Bybit_XAUUSDT", "Bitget_XAUUSDT_UMCBL",
  "Binance_1000PEPEUSDT", "Bitget_1000PEPEUSDT_UMCBL", "Hyperliquid_1000PEPE-USD",
];
for (const k of liqKeys) {
  try {
    const r = (await cgGet(`/api/liquidationLevels/v2?symbol=${encodeURIComponent(k)}&limit=200&range=7d`, 0)) as { data?: unknown[] } | { prices?: unknown[] } | null;
    const n = Array.isArray((r as { data?: unknown[] })?.data) ? (r as { data: unknown[] }).data.length : Array.isArray((r as { prices?: unknown[] })?.prices) ? (r as { prices: unknown[] }).prices.length : -1;
    console.log("liq", k.padEnd(28), "rows:", n);
  } catch (e) {
    console.log("liq", k.padEnd(28), "ERR", String((e as Error).message).slice(0, 80));
  }
  await new Promise((r) => setTimeout(r, 250));
}

for (const s of ["NVDA", "SOXL", "XAU", "CL", "1000PEPE", "VET", "TIA", "MU"]) {
  try {
    const sup = (await cgGet(`/api/largeTakerOrder/support/v3?symbol=${encodeURIComponent(s)}`, 0, FAPI)) as { futures?: { exchange: string }[]; spot?: { exchange: string }[] } | null;
    console.log("lto-support", s.padEnd(9), "futures:", (sup?.futures ?? []).map((x) => x.exchange).join(","), "| spot:", (sup?.spot ?? []).map((x) => x.exchange).join(","));
  } catch (e) {
    console.log("lto-support", s.padEnd(9), "ERR", String((e as Error).message).slice(0, 90));
  }
  await new Promise((r) => setTimeout(r, 300));
}
