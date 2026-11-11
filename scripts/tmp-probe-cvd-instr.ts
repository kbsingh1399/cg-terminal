// probe: which pinned perp instruments serve #bs_usd for TradFi plain names?
import { cgGet } from "../src/lib/cg/client";

const insts = [
  "Binance_NVDAUSDT", "OKX_NVDA-USDT-SWAP", "Bybit_NVDAUSDT", "Gate_NVDA_USDT", "Bitget_NVDAUSDT_UMCBL",
  "Binance_XAUUSDT", "OKX_XAU-USDT-SWAP", "Bybit_XAUUSDT",
  "Binance_ANTHROPICUSDT", "OKX_ANTHROPIC-USDT-SWAP", "Bybit_ANTHROPICUSDT",
  "Binance_CLUSDT", "OKX_CL-USDT-SWAP", "Bybit_CLUSDT",
  "Binance_SPCXUSDT", "Binance_KORUUSDT", "Binance_DRAMUSDT",
  "Binance_1000PEPEUSDT", "OKX_1000PEPE-USDT-SWAP",
];
for (const inst of insts) {
  try {
    const r = (await cgGet(`/api/v2/kline?symbol=${encodeURIComponent(inst + "#bs_usd")}&interval=m15&limit=5&minLimit=false`, 0)) as { data?: unknown[] } | unknown[];
    const rows = Array.isArray(r) ? r : (r.data ?? []);
    console.log(inst.padEnd(26), "rows:", rows.length, rows.length ? `sample: ${JSON.stringify(rows[0]).slice(0, 80)}` : "");
  } catch (e) {
    console.log(inst.padEnd(26), "ERR", String((e as Error).message).slice(0, 110));
  }
  await new Promise((r) => setTimeout(r, 250));
}
