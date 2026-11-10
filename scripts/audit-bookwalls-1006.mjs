#!/usr/bin/env node
/**
 * AUDIT script — reproduce the "stream error 1006: No supported future
 * timeframe pair" failure on the Coinglass aggregate liquidity-heatmap stream.
 *
 * Calls the endpoint EXACTLY like src/lib/cg/book-walls.ts fetchAggregateStream:
 *   URL      https://capi.coinglass.com/liquidity-heatmap/api/liquidity/heatmap/aggregate/stream
 *   headers  User-Agent Chrome, Origin + Referer www.coinglass.com,
 *            Accept wildcard, language: en
 *   params   coin, exchanges, market, interval, limit, batchSize=10, endTime=now
 * Reads the NDJSON frames (meta / batch / data / end / error), prints the
 * first ~3 non-empty frames (truncated) and a final verdict (code + msg).
 *
 * Usage: node scripts/audit-bookwalls-1006.mjs
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const STREAM_URL =
  "https://capi.coinglass.com/liquidity-heatmap/api/liquidity/heatmap/aggregate/stream";

function trunc(s, n = 220) {
  return s.length > n ? s.slice(0, n) + `… (+${s.length - n} chars)` : s;
}

async function probeOnce({ coin, exchanges, market = "futures", interval = "m15", limit = 30 }, timeoutMs = 90_000) {
  const q = new URLSearchParams({
    coin,
    exchanges: exchanges.join(","),
    market,
    interval,
    limit: String(limit),
    batchSize: "10",
    endTime: String(Math.floor(Date.now() / 1000)),
  });
  const url = `${STREAM_URL}?${q.toString()}`;
  const ctrl = new AbortController();
  const kill = setTimeout(() => ctrl.abort(), timeoutMs);
  const frames = []; // first non-empty lines
  let rows = 0;
  let verdict = null; // {code, msg} from meta or error frame
  let ended = false;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Origin: "https://www.coinglass.com",
        Referer: "https://www.coinglass.com/",
        Accept: "*/*",
        language: "en",
      },
      signal: ctrl.signal,
      cache: "no-store",
    });
    const ct = res.headers.get("content-type") ?? "";
    if (!res.ok) {
      return { http: res.status, ct, frames: [trunc(await res.text().catch(() => ""))], rows, verdict: { code: `HTTP ${res.status}`, msg: "" }, ended };
    }
    if (!/ndjson/.test(ct)) {
      const text = await res.text();
      let code = "";
      let msg = "";
      try {
        const j = JSON.parse(text);
        code = String(j.code ?? "");
        msg = j.msg ?? "";
      } catch {}
      return { http: res.status, ct, frames: [trunc(text)], rows, verdict: { code: code || `not-ndjson`, msg }, ended };
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    const handle = (line) => {
      if (!line) return;
      let f;
      try {
        f = JSON.parse(line);
      } catch {
        if (frames.length < 3) frames.push(trunc(line));
        return;
      }
      if (frames.length < 3) {
        // summarize: meta/batch frames shortened, error frames kept in full
        if (f.type === "batch" || f.type === "data") {
          const n = Array.isArray(f.data) ? f.data.length : 1;
          frames.push(trunc(`{"type":"${f.type}", rows:${n}, firstRowSample:${JSON.stringify((Array.isArray(f.data) ? f.data[0] : f.data) ?? null)?.slice(0, 120)}}`));
        } else {
          frames.push(trunc(JSON.stringify(f)));
        }
      }
      if (f.type === "meta") {
        verdict = { code: String(f.code), msg: f.msg ?? "", size: f.size, max: f.max };
      } else if (f.type === "batch" || f.type === "data") {
        rows += f.type === "batch" ? (Array.isArray(f.data) ? f.data.length : 0) : 1;
      } else if (f.type === "end") {
        ended = true;
      } else if (f.type === "error") {
        verdict = verdict?.code === "0" ? verdict : { code: String(f.code), msg: f.msg ?? "" };
        if (!ended) ended = "error"; // stream terminated with an error frame
      }
    };
    for (;;) {
      const { done, value } = await reader.read();
      buf += dec.decode(value ?? new Uint8Array(), { stream: !done });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        handle(buf.slice(0, nl));
        buf = buf.slice(nl + 1);
      }
      if (done) break;
    }
    handle(buf.trim());
    if (!verdict) verdict = { code: ended ? "0-no-meta" : "no-verdict", msg: ended ? "ended without meta frame" : "stream ended early" };
    return { http: res.status, ct, frames, rows, verdict, ended: ended === true, errored: ended === "error" };
  } catch (e) {
    return { http: 0, ct: "", frames: [`fetch threw: ${e?.name === "AbortError" ? "TIMEOUT/ABORT" : e?.message}`], rows, verdict: { code: e?.name ?? "throw", msg: e?.message ?? "" }, ended };
  } finally {
    clearTimeout(kill);
  }
}

const SET_A = ["Binance", "OKX", "Gate", "Bitget", "Hyperliquid"]; // AGG_VENUES.futures (current code)

const CASES = [
  { id: "a) XRP + A(AGG_VENUES.futures)", args: { coin: "XRP", exchanges: SET_A, interval: "m15" } },
  { id: "b) XRP + Binance only", args: { coin: "XRP", exchanges: ["Binance"], interval: "m15" } },
  { id: "c) XRP + Binance,OKX", args: { coin: "XRP", exchanges: ["Binance", "OKX"], interval: "m15" } },
  { id: "d) XRP + Binance,OKX,Gate,Bitget (no HL)", args: { coin: "XRP", exchanges: ["Binance", "OKX", "Gate", "Bitget"], interval: "m15" } },
  { id: "e) XRP + Binance,OKX,Bybit,Gate,Bitget", args: { coin: "XRP", exchanges: ["Binance", "OKX", "Bybit", "Gate", "Bitget"], interval: "m15" } },
  { id: "f) BTC + A (control)", args: { coin: "BTC", exchanges: SET_A, interval: "m15" } },
  { id: "g) XRP + A, interval=h1", args: { coin: "XRP", exchanges: SET_A, interval: "h1" } },
  { id: "h1) XAU + A", args: { coin: "XAU", exchanges: SET_A, interval: "m15" } },
  { id: "h2) XAG + A", args: { coin: "XAG", exchanges: SET_A, interval: "m15" } },
  { id: "i1) ADA + A", args: { coin: "ADA", exchanges: SET_A, interval: "m15" } },
  { id: "i2) LTC + A", args: { coin: "LTC", exchanges: SET_A, interval: "m15" } },
];

const results = [];
for (const c of CASES) {
  const t0 = Date.now();
  const r = await probeOnce({ ...c.args, market: "futures", limit: 30 });
  const ms = Date.now() - t0;
  results.push({ id: c.id, ...c.args, r, ms });
  console.log(`\n=== ${c.id}  (coin=${c.args.coin}, interval=${c.args.interval}, exchanges=${c.args.exchanges.join(",")}) — ${ms}ms ===`);
  console.log(`  HTTP ${r.http}  content-type: ${r.ct || "-"}`);
  r.frames.forEach((f, i) => console.log(`  line[${i + 1}]: ${f}`));
  console.log(`  rows: ${r.rows}  ended: ${r.ended}${r.errored ? " (via ERROR frame)" : ""}`);
  console.log(`  VERDICT: code=${r.verdict.code} msg=${JSON.stringify(r.verdict.msg ?? "")}${r.verdict.size != null ? ` size=${r.verdict.size} max=${r.verdict.max}` : ""}`);
}

console.log("\n\n================ SUMMARY TABLE ================");
console.log("combination".padEnd(52), "code   ", "rows ", "msg");
for (const x of results) {
  console.log(
    x.id.padEnd(52),
    String(x.r.verdict.code).padEnd(7),
    String(x.r.rows).padEnd(5),
    (x.r.verdict.msg ?? "").slice(0, 60)
  );
}
