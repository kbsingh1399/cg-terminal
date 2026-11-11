/**
 * CURATED UNIVERSE — 61 assets, the terminal's complete and ONLY universe.
 *
 * User directive 2026-11-12: "Pick top 30 crypto of all times and 30 tradifi
 * assets I shared and if anything is missing, then add that too. Ensure those
 * assets have each and every data point available on all tabs. No gaps."
 *
 * Composition (terminal rank order = palette/grid order):
 *   - 30 crypto  : USDT-M PERPETUAL on Binance, "of all times" = proven
 *                  large-cap / high-liquidity veterans (VET takes TON's slot:
 *                  TONUSDT perp entered SETTLING on 2026-11-12 and cannot be
 *                  traded or quoted).
 *   - 28 TradFi  : USDT-M TRADIFI_PERPETUAL on Binance under the PLAIN name
 *                  (NVDAUSDT, SOXLUSDT, XAUUSDT, CLUSDT, ANTHROPICUSDT...).
 *                  24 of them also have a Binance SPOT "B-token" leg
 *                  (NVDABUSDT) and XAU has XAUTUSDT (tokenized gold).
 *                  Verified 2026-11-12: all 28 TRADING with full Coinglass
 *                  surface (kline / orderFlow / liqlevels / bs_usd / lto).
 *   - 3 classic  : indices/oil with NO Binance perp — S&P 500 (SPX500),
 *                  Brent (UKO), Nasdaq-100 (NDX100). Yahoo classic feed +
 *                  tradeXYZ/Bitget perp venues via perpmap/micro; tabs beyond
 *                  Overview show an honest explainer, never fake data.
 *
 * METHODOLOGY (single- vs multi-exchange — final decision):
 *   Overview + Footprint = SINGLE EXCHANGE (Binance, the execution venue —
 *     demo orders are punched on Binance futures testnet, so the auction,
 *     EMA/RSI/VWAP and per-price order-flow must be the venue's own truth).
 *   Large Orders / Liq Levels / Book Walls / CVD = MULTI EXCHANGE
 *     (aggregates with per-venue breakdown; Binance is always the lead).
 *   Alerts = all venues, scanner iterates every Binance-feed asset.
 *
 * SYMBOL RESOLUTION RULES (hard):
 *   - Terminal syms for perps are the Binance perp BASE (NVDA, not NVDAB;
 *     SKHY, not SKHYNIX; 1000PEPE, not PEPE). Aliases exist for search only.
 *   - Never resolve curated TradFi syms via Coinglass keyword discovery:
 *     keyword=MUB returns the MUBARAK memecoin (verified). Instrument keys
 *     are always constructed explicitly (Binance_MUBUSDT etc.) or pinned.
 *
 * `punchable` = symbol is TRADING on testnet.binancefuture.com (demo order
 * execution). Verified 2026-11-12 — re-verify after testnet resets.
 */

export type CuratedKind = "crypto-perp" | "tradfi-perp" | "classic";

export interface CuratedAsset {
  /** Terminal symbol — perp base (BTC, NVDA, 1000PEPE) or classic key (SPX500). */
  sym: string;
  /** Binance USD-M futures pair (SYM + "USDT"). Undefined for classic. */
  pair?: string;
  /** Binance SPOT pair — B-token leg (NVDABUSDT) or XAUTUSDT for gold. */
  spotPair?: string;
  kind: CuratedKind;
  category: "Crypto" | "TradFi";
  name: string;
  /** Sub-category label shown in the palette. */
  sub: string;
  /** Alternate names from the user's table / common usage (search only). */
  aliases?: string[];
  /** Demo-punchable on Binance futures TESTNET. */
  punchable: boolean;
  /** "user" = in the user's shared list; "fill" = added to complete 30+30. */
  origin: "user" | "fill";
}

export const CURATED: readonly CuratedAsset[] = [
  // ─── CRYPTO 30 (Binance USDT-M PERPETUAL) ─────────────────────────────
  { sym: "BTC", pair: "BTCUSDT", kind: "crypto-perp", category: "Crypto", name: "Bitcoin", sub: "Store of Value", aliases: ["XBT"], punchable: true, origin: "user" },
  { sym: "ETH", pair: "ETHUSDT", kind: "crypto-perp", category: "Crypto", name: "Ethereum", sub: "Smart Contract L1", punchable: true, origin: "user" },
  { sym: "BNB", pair: "BNBUSDT", kind: "crypto-perp", category: "Crypto", name: "BNB", sub: "Exchange Token", punchable: true, origin: "user" },
  { sym: "SOL", pair: "SOLUSDT", kind: "crypto-perp", category: "Crypto", name: "Solana", sub: "Smart Contract L1", punchable: true, origin: "user" },
  { sym: "XRP", pair: "XRPUSDT", kind: "crypto-perp", category: "Crypto", name: "XRP", sub: "Payments", punchable: true, origin: "user" },
  { sym: "ADA", pair: "ADAUSDT", kind: "crypto-perp", category: "Crypto", name: "Cardano", sub: "Smart Contract L1", punchable: true, origin: "user" },
  { sym: "DOGE", pair: "DOGEUSDT", kind: "crypto-perp", category: "Crypto", name: "Dogecoin", sub: "Meme", punchable: true, origin: "user" },
  { sym: "TRX", pair: "TRXUSDT", kind: "crypto-perp", category: "Crypto", name: "TRON", sub: "Smart Contract L1", punchable: true, origin: "user" },
  { sym: "LINK", pair: "LINKUSDT", kind: "crypto-perp", category: "Crypto", name: "Chainlink", sub: "Oracle", punchable: true, origin: "user" },
  { sym: "LTC", pair: "LTCUSDT", kind: "crypto-perp", category: "Crypto", name: "Litecoin", sub: "Payments", punchable: true, origin: "user" },
  { sym: "AVAX", pair: "AVAXUSDT", kind: "crypto-perp", category: "Crypto", name: "Avalanche", sub: "Smart Contract L1", punchable: true, origin: "user" },
  { sym: "DOT", pair: "DOTUSDT", kind: "crypto-perp", category: "Crypto", name: "Polkadot", sub: "Interoperability", punchable: true, origin: "user" },
  { sym: "NEAR", pair: "NEARUSDT", kind: "crypto-perp", category: "Crypto", name: "NEAR Protocol", sub: "Smart Contract L1", punchable: true, origin: "user" },
  { sym: "UNI", pair: "UNIUSDT", kind: "crypto-perp", category: "Crypto", name: "Uniswap", sub: "DeFi DEX", punchable: true, origin: "user" },
  { sym: "ATOM", pair: "ATOMUSDT", kind: "crypto-perp", category: "Crypto", name: "Cosmos", sub: "Interoperability", punchable: true, origin: "user" },
  { sym: "XLM", pair: "XLMUSDT", kind: "crypto-perp", category: "Crypto", name: "Stellar", sub: "Payments", punchable: true, origin: "user" },
  { sym: "ETC", pair: "ETCUSDT", kind: "crypto-perp", category: "Crypto", name: "Ethereum Classic", sub: "Smart Contract L1", punchable: true, origin: "user" },
  { sym: "FIL", pair: "FILUSDT", kind: "crypto-perp", category: "Crypto", name: "Filecoin", sub: "Storage", punchable: true, origin: "user" },
  { sym: "ICP", pair: "ICPUSDT", kind: "crypto-perp", category: "Crypto", name: "Internet Computer", sub: "Smart Contract L1", punchable: false, origin: "user" },
  { sym: "HBAR", pair: "HBARUSDT", kind: "crypto-perp", category: "Crypto", name: "Hedera", sub: "Enterprise L1", punchable: true, origin: "user" },
  { sym: "APT", pair: "APTUSDT", kind: "crypto-perp", category: "Crypto", name: "Aptos", sub: "Smart Contract L1", punchable: true, origin: "user" },
  { sym: "ARB", pair: "ARBUSDT", kind: "crypto-perp", category: "Crypto", name: "Arbitrum", sub: "Ethereum L2", punchable: true, origin: "user" },
  { sym: "OP", pair: "OPUSDT", kind: "crypto-perp", category: "Crypto", name: "Optimism", sub: "Ethereum L2", punchable: true, origin: "user" },
  { sym: "SUI", pair: "SUIUSDT", kind: "crypto-perp", category: "Crypto", name: "Sui", sub: "Smart Contract L1", punchable: true, origin: "user" },
  { sym: "SEI", pair: "SEIUSDT", kind: "crypto-perp", category: "Crypto", name: "Sei", sub: "Smart Contract L1", punchable: true, origin: "user" },
  { sym: "INJ", pair: "INJUSDT", kind: "crypto-perp", category: "Crypto", name: "Injective", sub: "DeFi L1", punchable: true, origin: "user" },
  { sym: "TIA", pair: "TIAUSDT", kind: "crypto-perp", category: "Crypto", name: "Celestia", sub: "Modular DA", punchable: true, origin: "user" },
  { sym: "VET", pair: "VETUSDT", kind: "crypto-perp", category: "Crypto", name: "VeChain", sub: "Supply Chain", punchable: true, origin: "fill" },
  { sym: "1000PEPE", pair: "1000PEPEUSDT", kind: "crypto-perp", category: "Crypto", name: "Pepe (1000x perp)", sub: "Meme", aliases: ["PEPE"], punchable: true, origin: "user" },
  { sym: "1000SHIB", pair: "1000SHIBUSDT", kind: "crypto-perp", category: "Crypto", name: "Shiba Inu (1000x perp)", sub: "Meme", aliases: ["SHIB"], punchable: true, origin: "user" },

  // ─── TRADFI 28 (Binance USDT-M TRADIFI_PERPETUAL, plain names) ────────
  { sym: "XAU", pair: "XAUUSDT", spotPair: "XAUTUSDT", kind: "tradfi-perp", category: "TradFi", name: "Gold", sub: "Metal", aliases: ["GOLD", "XAUT", "PAXG"], punchable: true, origin: "user" },
  { sym: "NVDA", pair: "NVDAUSDT", spotPair: "NVDABUSDT", kind: "tradfi-perp", category: "TradFi", name: "NVIDIA", sub: "Semiconductors", punchable: true, origin: "user" },
  { sym: "SNDK", pair: "SNDKUSDT", spotPair: "SNDKBUSDT", kind: "tradfi-perp", category: "TradFi", name: "SanDisk", sub: "Semiconductors", punchable: false, origin: "user" },
  { sym: "SOXL", pair: "SOXLUSDT", spotPair: "SOXLBUSDT", kind: "tradfi-perp", category: "TradFi", name: "Direxion Semis 3x", sub: "Leveraged ETF", punchable: true, origin: "user" },
  { sym: "SPCX", pair: "SPCXUSDT", spotPair: "SPCXBUSDT", kind: "tradfi-perp", category: "TradFi", name: "SpaceX (pre-IPO)", sub: "Pre-IPO", punchable: true, origin: "user" },
  { sym: "GOOGL", pair: "GOOGLUSDT", spotPair: "GOOGLBUSDT", kind: "tradfi-perp", category: "TradFi", name: "Alphabet", sub: "Internet", aliases: ["GOOG"], punchable: true, origin: "user" },
  { sym: "MU", pair: "MUUSDT", spotPair: "MUBUSDT", kind: "tradfi-perp", category: "TradFi", name: "Micron", sub: "Semiconductors", punchable: false, origin: "user" },
  { sym: "SKHY", pair: "SKHYUSDT", spotPair: "SKHYBUSDT", kind: "tradfi-perp", category: "TradFi", name: "SK Hynix", sub: "Semiconductors", aliases: ["SKHYNIX", "SKHX"], punchable: false, origin: "user" },
  { sym: "XAG", pair: "XAGUSDT", kind: "tradfi-perp", category: "TradFi", name: "Silver", sub: "Metal", aliases: ["SILVER"], punchable: true, origin: "user" },
  { sym: "CL", pair: "CLUSDT", kind: "tradfi-perp", category: "TradFi", name: "Crude Oil WTI", sub: "Energy", aliases: ["WTI", "USO"], punchable: false, origin: "user" },
  { sym: "INTC", pair: "INTCUSDT", spotPair: "INTCBUSDT", kind: "tradfi-perp", category: "TradFi", name: "Intel", sub: "Semiconductors", punchable: true, origin: "user" },
  { sym: "CRCL", pair: "CRCLUSDT", spotPair: "CRCLBUSDT", kind: "tradfi-perp", category: "TradFi", name: "Circle", sub: "FinTech", punchable: true, origin: "user" },
  { sym: "MSTR", pair: "MSTRUSDT", spotPair: "MSTRBUSDT", kind: "tradfi-perp", category: "TradFi", name: "Strategy (MicroStrategy)", sub: "Bitcoin Proxy", punchable: true, origin: "user" },
  { sym: "QQQ", pair: "QQQUSDT", spotPair: "QQQBUSDT", kind: "tradfi-perp", category: "TradFi", name: "Invesco QQQ Trust", sub: "Index ETF", punchable: true, origin: "user" },
  { sym: "ANTHROPIC", pair: "ANTHROPICUSDT", kind: "tradfi-perp", category: "TradFi", name: "Anthropic (pre-IPO)", sub: "Pre-IPO", punchable: false, origin: "user" },
  { sym: "AAPL", pair: "AAPLUSDT", spotPair: "AAPLBUSDT", kind: "tradfi-perp", category: "TradFi", name: "Apple", sub: "Hardware", punchable: false, origin: "user" },
  { sym: "TSLA", pair: "TSLAUSDT", spotPair: "TSLABUSDT", kind: "tradfi-perp", category: "TradFi", name: "Tesla", sub: "EV / Auto", punchable: true, origin: "user" },
  { sym: "DRAM", pair: "DRAMUSDT", spotPair: "DRAMBUSDT", kind: "tradfi-perp", category: "TradFi", name: "DRAM Index", sub: "Semiconductors", punchable: false, origin: "user" },
  { sym: "KORU", pair: "KORUUSDT", spotPair: "KORUBUSDT", kind: "tradfi-perp", category: "TradFi", name: "Koru", sub: "Specialty", punchable: true, origin: "user" },
  { sym: "META", pair: "METAUSDT", spotPair: "METABUSDT", kind: "tradfi-perp", category: "TradFi", name: "Meta Platforms", sub: "Internet", punchable: true, origin: "user" },
  { sym: "NBIS", pair: "NBISUSDT", spotPair: "NBISBUSDT", kind: "tradfi-perp", category: "TradFi", name: "Nebius", sub: "AI Infra", punchable: false, origin: "user" },
  { sym: "MSFT", pair: "MSFTUSDT", spotPair: "MSFTBUSDT", kind: "tradfi-perp", category: "TradFi", name: "Microsoft", sub: "Software", punchable: false, origin: "fill" },
  { sym: "AMZN", pair: "AMZNUSDT", spotPair: "AMZNBUSDT", kind: "tradfi-perp", category: "TradFi", name: "Amazon", sub: "E-Commerce", punchable: true, origin: "fill" },
  { sym: "AMD", pair: "AMDUSDT", spotPair: "AMDBUSDT", kind: "tradfi-perp", category: "TradFi", name: "AMD", sub: "Semiconductors", punchable: false, origin: "fill" },
  { sym: "COIN", pair: "COINUSDT", spotPair: "COINBUSDT", kind: "tradfi-perp", category: "TradFi", name: "Coinbase", sub: "Crypto Exchange", punchable: true, origin: "fill" },
  { sym: "NFLX", pair: "NFLXUSDT", spotPair: "NFLXBUSDT", kind: "tradfi-perp", category: "TradFi", name: "Netflix", sub: "Media", punchable: false, origin: "fill" },
  { sym: "AVGO", pair: "AVGOUSDT", spotPair: "AVGOBUSDT", kind: "tradfi-perp", category: "TradFi", name: "Broadcom", sub: "Semiconductors", punchable: false, origin: "fill" },
  { sym: "TSM", pair: "TSMUSDT", spotPair: "TSMBUSDT", kind: "tradfi-perp", category: "TradFi", name: "TSMC", sub: "Semiconductors", punchable: false, origin: "fill" },

  // ─── CLASSIC 3 (no Binance perp — Yahoo/tradeXYZ venues) ──────────────
  { sym: "SPX500", kind: "classic", category: "TradFi", name: "S&P 500", sub: "Index", aliases: ["SP500", "SPY", "GSPC"], punchable: false, origin: "user" },
  { sym: "UKO", kind: "classic", category: "TradFi", name: "Brent Oil", sub: "Energy", aliases: ["BRENTOIL", "BZ", "BRENT"], punchable: false, origin: "user" },
  { sym: "NDX100", kind: "classic", category: "TradFi", name: "Nasdaq-100", sub: "Index", aliases: ["XYZ100", "NDX"], punchable: false, origin: "user" },
] as const;

export const CURATED_BY_SYM: ReadonlyMap<string, CuratedAsset> = new Map(
  CURATED.map((a) => [a.sym.toUpperCase(), a]),
);

/** Resolve a user-typed name (alias included) to a curated asset. */
export function resolveCurated(input: string): CuratedAsset | undefined {
  const q = input.trim().toUpperCase();
  const direct = CURATED_BY_SYM.get(q);
  if (direct) return direct;
  return CURATED.find(
    (a) =>
      a.aliases?.some((x) => x.toUpperCase() === q) ||
      a.pair?.toUpperCase() === q ||
      a.spotPair?.toUpperCase() === q ||
      a.name.toUpperCase() === q,
  );
}

/** A curated perp — like CuratedAsset but the Binance USD-M pair is guaranteed. */
export interface CuratedPerp extends CuratedAsset {
  pair: string;
}

/** Perp-kind assets (58): everything with a Binance USD-M pair. */
export function curatedPerps(): CuratedPerp[] {
  return CURATED.filter((a): a is CuratedPerp => a.kind !== "classic" && typeof a.pair === "string");
}

/** Classic-kind assets (3). */
export function curatedClassic(): CuratedAsset[] {
  return CURATED.filter((a) => a.kind === "classic");
}

export const CURATED_TOTAL = CURATED.length; // 61
