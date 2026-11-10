#!/usr/bin/env node
/**
 * AUDIT script 6 — symbol-coverage check of the encrypted Coinglass web API
 * endpoints the app's other routes use (self-contained port of
 * src/lib/cg/client.ts + crypto.ts: obe header, cache-ts-v2, response decrypt).
 *
 * Probes, with tiny limits:
 *   /api/index/v2/liqHeatMap        (stopmap route) — XRP / XAU / XAG
 *   /api/v2/kline #kline            (market/ticker lead) — Binance_XAUUSDT / XAG
 *   /api/select/coins/tickers       (cvd route) — keyword XAU / XRP
 *   /api/largeTakerOrder/support/v3 (lto route) — symbol XRP / XAU
 *   /api/liquidationLevels/v2       (liqlevels route) — Binance_XRPUSDT / XAU
 *   /api/orderFlow                  (fp route) — Binance_XRPUSDT
 *
 * Usage: node scripts/audit-cgapi-syms.mjs
 */
import crypto from "crypto";
import zlib from "zlib";

const STATIC_KEY = Buffer.from("1f68efd73f8d4921acc0dead41dd39bc", "utf8");
const TOTP_SECRET_B32 = "I65VU7K5ZQL7WB4E";
const KEY_A_CONSTS = { "55": "170b070da9654622", "66": "d6537d845a964081", "77": "863f08689c97435b" };

function base32Decode(s) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0;
  const out = [];
  for (const ch of s.toUpperCase().replace(/=+$/, "")) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}
function totp(secretB32, t) {
  const key = base32Decode(secretB32);
  const counter = Buffer.alloc(8);
  counter.writeUInt32BE(Math.floor(t / 30), 4);
  const digest = crypto.createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, "0");
}
function makeObeToken(nowMs) {
  const secs = Math.floor(nowMs / 1000);
  const plain = Buffer.from(`${secs},${totp(TOTP_SECRET_B32, secs)}`, "utf8");
  const cipher = crypto.createCipheriv("aes-256-ecb", STATIC_KEY, null);
  return Buffer.concat([cipher.update(plain), cipher.final()]).toString("base64");
}
function aesEcbDecryptB64(b64, key) {
  const algo = key.length === 16 ? "aes-128-ecb" : key.length === 24 ? "aes-192-ecb" : "aes-256-ecb";
  const decipher = crypto.createDecipheriv(algo, key, null);
  decipher.setAutoPadding(true);
  return Buffer.concat([decipher.update(Buffer.from(b64, "base64")), decipher.final()]);
}
function tryInflate(buf) {
  for (const fn of [zlib.inflateSync, zlib.inflateRawSync, zlib.gunzipSync]) {
    try { return fn(buf); } catch {}
  }
  return buf;
}
function stripQuotes(s) {
  let out = s;
  if (out.startsWith('"')) out = out.slice(1);
  if (out.endsWith('"')) out = out.slice(0, -1);
  return out;
}
function mangleUrl(url) {
  const idx = url.indexOf("/api");
  if (idx === -1) return url;
  const q = url.indexOf("?");
  return q === -1 ? url.slice(idx) : url.slice(idx, q);
}
function deriveKeyA(v, cacheTs, timeHeader, url) {
  let src;
  if (v === "0") src = cacheTs;
  else if (v === "2") src = timeHeader ?? "";
  else if (v === "1") src = mangleUrl(url);
  else src = KEY_A_CONSTS[v] ?? "";
  return Buffer.from(Buffer.from(src, "utf8").toString("base64").slice(0, 16), "utf8");
}
function decryptCgResponse(resp, cacheTs, url) {
  const body = JSON.parse(resp.bodyText);
  if (body.code !== "0") throw new Error(`upstream code ${body.code}: ${body.msg ?? "unknown"}`);
  const data = body.data;
  if (typeof data !== "string") return data;
  const userBlob = resp.headers["user"] ?? "";
  const v = String(resp.headers["v"] ?? "0");
  const keyA = deriveKeyA(v, cacheTs, resp.headers["time"] ?? null, url);
  const keyBRaw = stripQuotes(tryInflate(aesEcbDecryptB64(userBlob, keyA)).toString("utf8"));
  const payloadRaw = stripQuotes(tryInflate(aesEcbDecryptB64(data, Buffer.from(keyBRaw, "utf8"))).toString("utf8"));
  try { return JSON.parse(payloadRaw); } catch { return payloadRaw; }
}

async function cgGet(pathAndQuery, host = "https://capi.coinglass.com") {
  const url = `${host}${pathAndQuery}`;
  const cacheTs = String(Date.now());
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Origin: "https://www.coinglass.com",
      Referer: "https://www.coinglass.com/",
      Accept: "application/json",
      encryption: "true",
      "cache-ts-v2": cacheTs,
      language: "en",
      obe: makeObeToken(Number(cacheTs)),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  const headers = {};
  res.headers.forEach((v, k) => { headers[k] = v; });
  const bodyText = await res.text();
  if (res.status !== 200) return { __http: res.status, body: bodyText.slice(0, 120) };
  const parsed = JSON.parse(bodyText);
  if (parsed && typeof parsed === "object" && "data" in parsed && typeof parsed.data !== "string") {
    if (parsed.code !== "0" && Number(parsed.code) !== 0) return { __code: parsed.code, __msg: parsed.msg };
    return parsed.data;
  }
  try {
    return decryptCgResponse({ status: res.status, headers, bodyText }, cacheTs, url);
  } catch (e) {
    return { __decryptError: e.message, __rawCode: parsed?.code, __rawMsg: parsed?.msg };
  }
}

function summarize(x, n = 200) {
  const s = JSON.stringify(x);
  if (s == null) return String(x);
  return s.length > n ? s.slice(0, n) + `…(+${s.length - n})` : s;
}

const CASES = [
  // stopmap route: liqHeatMap per symbol
  { id: "liqHeatMap Binance_XRPUSDT", fn: async () => {
    const q = new URLSearchParams({ merge: "true", symbol: "Binance_XRPUSDT", interval: "5", limit: "288", data: makeObeToken(Date.now()) });
    const r = await cgGet(`/api/index/v2/liqHeatMap?${q.toString()}`);
    return r?.liq ? `OK — liq rows=${r.liq.length}, instrument=${r.instrument?.exName}_${r.instrument?.instrumentId}, prices=${r.prices?.length}` : summarize(r);
  } },
  { id: "liqHeatMap Binance_XAUUSDT", fn: async () => {
    const q = new URLSearchParams({ merge: "true", symbol: "Binance_XAUUSDT", interval: "5", limit: "288", data: makeObeToken(Date.now()) });
    const r = await cgGet(`/api/index/v2/liqHeatMap?${q.toString()}`);
    return r?.liq ? `OK — liq rows=${r.liq.length}, instrument=${r.instrument?.exName}_${r.instrument?.instrumentId}` : summarize(r);
  } },
  { id: "liqHeatMap Binance_XAGUSDT", fn: async () => {
    const q = new URLSearchParams({ merge: "true", symbol: "Binance_XAGUSDT", interval: "5", limit: "288", data: makeObeToken(Date.now()) });
    const r = await cgGet(`/api/index/v2/liqHeatMap?${q.toString()}`);
    return r?.liq ? `OK — liq rows=${r.liq.length}` : summarize(r);
  } },
  // market/ticker lead kline for metals
  { id: "kline Binance_XAUUSDT#kline m15", fn: async () => {
    const r = await cgGet(`/api/v2/kline?symbol=${encodeURIComponent("Binance_XAUUSDT#kline")}&interval=m15&limit=3&minLimit=false`);
    const rows = Array.isArray(r) ? r : r?.data;
    return Array.isArray(rows) && rows.length ? `OK — ${rows.length} rows, last close=${rows[rows.length - 1]?.[4]}` : summarize(r);
  } },
  { id: "kline Binance_XAGUSDT#kline m15", fn: async () => {
    const r = await cgGet(`/api/v2/kline?symbol=${encodeURIComponent("Binance_XAGUSDT#kline")}&interval=m15&limit=3&minLimit=false`);
    const rows = Array.isArray(r) ? r : r?.data;
    return Array.isArray(rows) && rows.length ? `OK — ${rows.length} rows, last close=${rows[rows.length - 1]?.[4]}` : summarize(r);
  } },
  // cvd route: instrument discovery
  { id: "tickers FUTURES keyword=XAU", fn: async () => {
    const r = await cgGet(`/api/select/coins/tickers?type=FUTURES&keyword=XAU`);
    const rows = Array.isArray(r) ? r : r?.data;
    return Array.isArray(rows) ? `OK — ${rows.length} rows: ${rows.slice(0, 4).map((t) => `${t.instrument?.exName}_${t.instrument?.instrumentId}`).join(", ")}` : summarize(r);
  } },
  { id: "tickers FUTURES keyword=XRP", fn: async () => {
    const r = await cgGet(`/api/select/coins/tickers?type=FUTURES&keyword=XRP`);
    const rows = Array.isArray(r) ? r : r?.data;
    return Array.isArray(rows) ? `OK — ${rows.length} rows, first: ${rows.slice(0, 4).map((t) => `${t.instrument?.exName}_${t.instrument?.instrumentId}(type=${t.instrument?.type})`).join(", ")}` : summarize(r);
  } },
  // lto route: support
  { id: "lto support symbol=XRP", fn: async () => {
    const r = await cgGet(`/api/largeTakerOrder/support/v3?symbol=XRP`, "https://fapi.coinglass.com");
    return `futures=[${(r?.futures ?? []).map((s) => s.exchange).join(",")}] spot=[${(r?.spot ?? []).map((s) => s.exchange).join(",")}]`;
  } },
  { id: "lto support symbol=XAU", fn: async () => {
    const r = await cgGet(`/api/largeTakerOrder/support/v3?symbol=XAU`, "https://fapi.coinglass.com");
    return `futures=[${(r?.futures ?? []).map((s) => s.exchange).join(",")}] spot=[${(r?.spot ?? []).map((s) => s.exchange).join(",")}]`;
  } },
  // liqlevels route
  { id: "liqlevels Binance_XRPUSDT", fn: async () => {
    const r = await cgGet(`/api/liquidationLevels/v2?symbol=Binance_XRPUSDT&limit=5&range=3d`);
    const d = r?.data ?? r;
    return Array.isArray(d) ? `OK — ${d.length} levels, first=${JSON.stringify(d[0])?.slice(0, 100)}` : summarize(r);
  } },
  { id: "liqlevels Binance_XAUUSDT", fn: async () => {
    const r = await cgGet(`/api/liquidationLevels/v2?symbol=Binance_XAUUSDT&limit=5&range=3d`);
    const d = r?.data ?? r;
    return Array.isArray(d) ? `OK — ${d.length} levels` : summarize(r);
  } },
  // fp route: orderFlow
  { id: "orderFlow Binance_XRPUSDT m15", fn: async () => {
    const r = await cgGet(`/api/orderFlow?symbol=${encodeURIComponent("Binance_XRPUSDT#order_flow")}&interval=m15&minLimit=false&limit=3`);
    const rows = Array.isArray(r) ? r : r?.data;
    return Array.isArray(rows) && rows.length ? `OK — ${rows.length} bars, first ts=${rows[0]?.[0]}` : summarize(r);
  } },
];

for (const c of CASES) {
  try {
    const out = await c.fn();
    console.log(`${c.id.padEnd(34)} → ${typeof out === "string" ? out : summarize(out)}`);
  } catch (e) {
    console.log(`${c.id.padEnd(34)} → THROW: ${e.message}`);
  }
}
