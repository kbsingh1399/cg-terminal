import { isAsset } from "./assets";
import { getUniverse, isBinanceSym } from "../binance/universe";

/**
 * Shared server-side symbol gate — the ONE chokepoint every cg route uses to
 * accept a terminal symbol.
 *
 * Accepted: the 15-asset Tier-1 perp registry (src/lib/cg/assets.ts) AND the
 * Tier-2 Binance top-liquidity universe (src/lib/binance/universe.ts — the
 * top-200 USDT-M perpetuals by 24h quote volume, refreshed every 4h).
 *
 * Tier-2 membership needs the universe map, so the first call for an unknown
 * symbol awaits getUniverse() (cached after boot — a no-return map lookup in
 * the steady state). Anything else 400s honestly.
 */
export async function knownSym(sym: string): Promise<boolean> {
  const s = sym.toUpperCase();
  if (isAsset(s)) return true;
  await getUniverse();
  return isBinanceSym(s);
}
