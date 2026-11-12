import { isAsset } from "./assets";
import { isClassic } from "./classic";
import { resolveCgSym } from "../binance/aliases";
import { getUniverse, isBinanceSym } from "../binance/universe";

/**
 * Shared server-side symbol gate — the ONE chokepoint every cg route uses to
 * accept a terminal symbol.
 *
 * Accepted:
 *   - knownSym(): Tier-1 perp registry + Binance top-liquidity universe
 *     (resolved through `resolveCgSym`, so aliases like USO->CL / UKO->BZ /
 *     GOOG->GOOGL match their canonical Binance/Coinglass symbol).
 *   - anyTerminalSym(): also admits Tier-3 classic indices/equities/commodities
 *     so unified terminal tabs always return structured payloads instead of HTTP 400.
 */
export async function knownSym(sym: string): Promise<boolean> {
  const raw = sym.trim().toUpperCase();
  const s = resolveCgSym(raw);
  if (isAsset(s) || isAsset(raw)) return true;
  await getUniverse();
  return isBinanceSym(s) || isBinanceSym(raw);
}

export async function anyTerminalSym(sym: string): Promise<boolean> {
  if (await knownSym(sym)) return true;
  return isClassic(sym.trim().toUpperCase());
}
