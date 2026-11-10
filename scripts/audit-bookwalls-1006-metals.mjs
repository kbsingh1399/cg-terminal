#!/usr/bin/env node
/**
 * AUDIT script 4 — metals venue check on the aggregate stream (OKX? Bybit?)
 * and a spot-market sanity check for XRP (the app also exposes market=spot).
 *
 * Usage: node scripts/audit-bookwalls-1006-metals.mjs
 */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const STREAM_URL =
  "https://capi.coinglass.com/liquidity-heatmap/api/liquidity/heatmap/aggregate/stream";

async function probeOnce({ coin, exchanges, market = "futures", interval = "m15", limit = 30 }, timeoutMs = 90_000) {
  const q = new URLSearchParams({
    coin, exchanges: exchanges.join(","), market, interval,
    limit: String(limit), batchSize: "10",
    endTime: String(Math.floor(Date.now() / 1000)),
  });
  const ctrl = new AbortController();
  const kill = setTimeout(() => ctrl.abort(), timeoutMs);
  let rows = 0, verdict = null;
  try {
    const res = await fetch(STREAM_URL + "?" + q.toString(), {
      headers: { "User-Agent": UA, Origin: "https://www.coinglass.com", Referer: "https://www.coinglass.com/", Accept: "*/*", language: "en" },
      signal: ctrl.signal, cache: "no-store",
    });
    if (!/ndjson/.test(res.headers.get("content-type") || "")) {
      const t = await res.text().catch(() => "");
      return { code: `HTTP ${res.status}`, msg: t.slice(0, 100), rows: 0 };
    }
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
    const handle = (line) => {
      if (!line) return;
      let f; try { f = JSON.parse(line); } catch { return; }
      if (f.type === "meta") verdict = { code: String(f.code), msg: f.msg ?? "" };
      else if (f.type === "batch" || f.type === "data") rows += f.type === "batch" ? (f.data ?? []).length : 1;
      else if (f.type === "error") verdict = verdict?.code === "0" ? verdict : { code: String(f.code), msg: f.msg ?? "" };
    };
    for (;;) {
      const { done, value } = await reader.read();
      buf += dec.decode(value ?? new Uint8Array(), { stream: !done });
      let nl; while ((nl = buf.indexOf("\n")) >= 0) { handle(buf.slice(0, nl)); buf = buf.slice(nl + 1); }
      if (done) break;
    }
    handle(buf.trim());
    return { ...(verdict ?? { code: "?", msg: "" }), rows };
  } catch (e) {
    return { code: "throw", msg: e?.message ?? String(e), rows };
  } finally { clearTimeout(kill); }
}

const CASES = [
  { id: "XAU  OKX only        (futures)", args: { coin: "XAU", exchanges: ["OKX"] } },
  { id: "XAU  Bybit only      (futures)", args: { coin: "XAU", exchanges: ["Bybit"] } },
  { id: "XAU  Binance+OKX     (futures)", args: { coin: "XAU", exchanges: ["Binance", "OKX"] } },
  { id: "XRP  AGG spot list   (spot)   ", args: { coin: "XRP", exchanges: ["Binance", "Coinbase", "OKX", "Bitget", "Gate", "Kraken", "Bitfinex"], market: "spot" } },
  { id: "XRP  Binance only    (spot)   ", args: { coin: "XRP", exchanges: ["Binance"], market: "spot" } },
  { id: "XAU  Binance only    (spot)   ", args: { coin: "XAU", exchanges: ["Binance"], market: "spot" } },
];

for (const c of CASES) {
  const r = await probeOnce({ ...c.args, limit: 30 });
  console.log(`${c.id} → code=${String(r.code).padEnd(6)} rows=${String(r.rows).padEnd(4)} msg=${JSON.stringify(r.msg).slice(0, 80)}`);
}
