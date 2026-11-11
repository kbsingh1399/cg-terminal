// probe 2: spot B-token bs_usd + keyword discovery shapes for curated crypto syms
import { cgGet } from "../src/lib/cg/client";

const insts = [
  "Binance_SPOT_NVDABUSDT", "Binance_SPOT_MUBUSDT", "Binance_SPOT_XAUTUSDT",
  "Bybit_1000PEPEUSDT", "Bitget_1000PEPEUSDT_UMCBL", "Hyperliquid_1000PEPE-USD",
  "OKX_PEPE-USDT-SWAP",
];
for (const inst of insts) {
  try {
    const r = (await cgGet(`/api/v2/kline?symbol=${encodeURIComponent(inst + "#bs_usd")}&interval=m15&limit=3&minLimit=false`, 0)) as { data?: unknown[] } | unknown[];
    const rows = Array.isArray(r) ? r : (r.data ?? []);
    console.log("flows", inst.padEnd(26), "rows:", rows.length);
  } catch (e) {
    console.log("flows", inst.padEnd(26), "ERR", String((e as Error).message).slice(0, 90));
  }
  await new Promise((r) => setTimeout(r, 250));
}

// keyword discovery for a few curated crypto syms (what the cvd route does today)
for (const kw of ["1000PEPE", "1000SHIB", "VET", "TIA", "SEI", "INJ", "APT", "HBAR", "ICP", "ETC", "FIL", "NEAR", "UNI", "ATOM", "DOT", "TRX"]) {
  try {
    const raw = (await cgGet(`/api/select/coins/tickers?type=FUTURES&keyword=${encodeURIComponent(kw)}`, 0)) as unknown;
    const rows = Array.isArray(raw) ? (raw as { instrument?: { baseAsset?: string; exName?: string; instrumentId?: string; type?: number } }[]) : [];
    const mine = rows.filter((t) => t.instrument?.baseAsset === kw && Number(t.instrument?.type) === 1);
    console.log("kw", kw.padEnd(9), "rows:", rows.length, "perpMine:", mine.length, mine.slice(0, 6).map((t) => `${t.instrument?.exName}_${t.instrument?.instrumentId}`).join(","));
  } catch (e) {
    console.log("kw", kw.padEnd(9), "ERR", String((e as Error).message).slice(0, 90));
  }
  await new Promise((r) => setTimeout(r, 300));
}
