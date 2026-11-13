/**
 * PROBE 2 — liquidationLevels + heatmap key forms for 1000-multiples + VET.
 * Verifies the same venue-renaming across the OTHER aggregate routes.
 * Usage: bun scripts/probe-fp-1000x-liq.ts
 */
import { cgGet } from "../src/lib/cg/client";

console.log("== /api/liquidationLevels/v2 key validation ==");
const liqKeys: { label: string; key: string }[] = [
  { label: "1000SHIB cur  OKX_1000SHIB-USDT-SWAP", key: "OKX_1000SHIB-USDT-SWAP" },
  { label: "1000SHIB fix  OKX_SHIB-USDT-SWAP", key: "OKX_SHIB-USDT-SWAP" },
  { label: "1000SHIB cur  Bybit_1000SHIBUSDT", key: "Bybit_1000SHIBUSDT" },
  { label: "1000SHIB fix  Bybit_SHIB1000USDT", key: "Bybit_SHIB1000USDT" },
  { label: "1000SHIB fix  Hyperliquid_kSHIB-USD", key: "Hyperliquid_kSHIB-USD" },
  { label: "1000SHIB cur  Hyperliquid_1000SHIB-USD", key: "Hyperliquid_1000SHIB-USD" },
  { label: "1000SHIB cur  Bitget_1000SHIBUSDT_UMCBL", key: "Bitget_1000SHIBUSDT_UMCBL" },
  { label: "1000SHIB cand Bitget_SHIB1000USDT_UMCBL", key: "Bitget_SHIB1000USDT_UMCBL" },
  { label: "1000SHIB cur  Gate_1000SHIB_USDT", key: "Gate_1000SHIB_USDT" },
  { label: "1000PEPE cur  OKX_1000PEPE-USDT-SWAP", key: "OKX_1000PEPE-USDT-SWAP" },
  { label: "1000PEPE fix  OKX_PEPE-USDT-SWAP", key: "OKX_PEPE-USDT-SWAP" },
  { label: "1000PEPE fix  Hyperliquid_kPEPE-USD", key: "Hyperliquid_kPEPE-USD" },
  { label: "VET      cur  OKX_VET-USDT-SWAP", key: "OKX_VET-USDT-SWAP" },
  { label: "VET      cur  Hyperliquid_VET-USD", key: "Hyperliquid_VET-USD" },
  { label: "VET      cur  Bitget_VETUSDT_UMCBL", key: "Bitget_VETUSDT_UMCBL" },
];
for (const c of liqKeys) {
  try {
    const r = (await cgGet(
      `/api/liquidationLevels/v2?symbol=${encodeURIComponent(c.key)}&limit=4000&range=3d`,
      15_000
    )) as unknown;
    const rows = Array.isArray(r)
      ? (r as unknown[])
      : Array.isArray((r as { data?: unknown }).data)
        ? ((r as { data: unknown[] }).data as unknown[])
        : null;
    console.log(`  [${rows && rows.length ? "OK " : "EMPTY"}] ${c.label} → rows=${rows ? rows.length : "null"}`);
  } catch (e) {
    console.log(`  [FAIL] ${c.label} → ${e instanceof Error ? e.message : e}`);
  }
}
