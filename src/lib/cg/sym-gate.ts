import { isAsset } from "./assets";
import { isCuratedPerp } from "./assets";
import { CURATED_BY_SYM } from "@/lib/universe/curated";
import { isClassic } from "./classic";
import { resolveCgSym } from "../binance/aliases";
import { isBinanceSym } from "../binance/universe";

/**
 * Shared server-side symbol gate — the ONE chokepoint every cg route uses to
 * accept a terminal perp symbol.
 *
 * Accepted (the CURATED universe, 2026-11-12 "no gaps" directive):
 *   - the 58 curated perps from src/lib/universe/curated.ts (30 crypto
 *     PERPETUAL + 28 TradFi TRADIFI_PERPETUAL plain names like NVDAUSDT /
 *     XAUUSDT / CLUSDT) — plus the legacy Tier-1 registry (src/lib/cg/
 *     assets.ts) so XPT and any other legacy member keep working in Tier-1
 *     code paths even though they left the main palette.
 *   - Aliases resolve first through `resolveCgSym` (USO->CL / GOOG->GOOGL /
 *     UKO->BZ), so watchlist spellings match their canonical Binance /
 *     Coinglass symbol.
 *
 * Curated perp membership is STATIC (the universe module builds it from the
 * canonical list at load), so no refresh await is needed — a cold gate
 * answers instantly and an fapi outage cannot 400 curated symbols.
 *
 * Curated CLASSIC instruments (SPX500 / UKO / NDX100) are intentionally NOT
 * knownSyms: they have no perp data anywhere — the classic routes gate them
 * via isClassic() and the perp routes reject them honestly (see gateReject).
 */
export async function knownSym(sym: string): Promise<boolean> {
  const raw = sym.trim().toUpperCase();
  const s = resolveCgSym(raw);
  if (isAsset(s) || isAsset(raw)) return true;
  if (isCuratedPerp(s) || isCuratedPerp(raw)) return true;
  return isBinanceSym(s) || isBinanceSym(raw);
}

/** Unified-terminal gate: perp registry OR classic instruments — used by
 * tabs that can render a graceful classic fallback instead of HTTP 400. */
export async function anyTerminalSym(sym: string): Promise<boolean> {
  if (await knownSym(sym)) return true;
  return isClassic(sym.trim().toUpperCase());
}

/** Honest 400 message for a symbol the perp routes cannot serve. */
export function gateReject(sym: string): string {
  const s = sym.toUpperCase();
  const c = CURATED_BY_SYM.get(s);
  if (c && c.kind === "classic") {
    return `unknown perp asset ${s} — classic instrument (no perp data; use /api/cg/classic?sym=${s})`;
  }
  return `unknown asset ${s}`;
}
