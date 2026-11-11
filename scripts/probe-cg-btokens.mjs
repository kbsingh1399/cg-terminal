#!/usr/bin/env node
/**
 * PROBE — Coinglass coverage for Binance B-token spot stocks (kind B) and
 * plain-name equity/HIP-3 discovery (kind C ANTHROPIC etc).
 *
 * The terminal's cg client (src/lib/cg/client.ts + crypto.ts) decrypts
 * encrypted capi.coinglass.com responses; tsx is NOT in devDependencies, so
 * this is the established self-contained port (same pattern as
 * scripts/audit-cgapi-syms.mjs): obe token, cache-ts-v2, key-A/key-B decrypt.
 *
 * Probes per B-token base (NVDAB, MUB, SOXLB, GOOGLB):
 *   a) /api/select/coins/tickers?type=FUTURES|SPOT&keyword=<BASE>   (cvd route)
 *   b) fapi /api/largeTakerOrder/support/v3?symbol=<BASE>           (lto route)
 *   c) /api/orderFlow?symbol=Binance_<BASE>USDT#order_flow          (fp route)
 *   d) /api/liquidationLevels/v2?symbol=Binance_<BASE>USDT          (liqlevels)
 *   e) plain names without the B suffix (NVDA, MU, SOXL, GOOGL, ANTHROPIC):
 *      which venue keys does discovery return (Hyperliquid / tradeXYZ …)?
 *      + orderFlow / liqlevels on those discovered keys
 *   f) Hyperliquid HIP-3 xyz dex live universe (api.hyperliquid.xyz/info)
 *      — does an ANTHROPIC (or similar) market exist?
 *
 * Usage: node scripts/probe-cg-btokens.mjs
 * Writes /tmp/cg-btokens.json, prints compact report.
 */
import crypto from "crypto";
import zlib from "zlib";
import { writeFileSync } from "fs";

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
  if (res.status !== 200) return { __http: res.status, __body: bodyText.slice(0, 160) };
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const summarize = (x, n = 220) => {
  const s = JSON.stringify(x);
  return s == null ? String(x) : s.length > n ? s.slice(0, n) + `…(+${s.length - n})` : s;
};

const B_BASES = ["NVDAB", "MUB", "SOXLB", "GOOGLB"];
const PLAIN = ["NVDA", "MU", "SOXL", "GOOGL", "ANTHROPIC", "ANTH"];
const out = { btokens: {}, plainNames: {}, hyperliquid_xyz: {}, _meta: { at: new Date().toISOString() } };

// ---------- a-d) B-token symbol probes ----------
for (const base of B_BASES) {
  const rec = { tickers: {}, lto: null, orderflow: null, liqlevels: null, kline: null };
  console.log(`\n===== ${base} =====`);
  for (const type of ["FUTURES", "SPOT"]) {
    const r = await cgGet(`/api/select/coins/tickers?type=${type}&keyword=${encodeURIComponent(base)}`);
    const rows = Array.isArray(r) ? r : r?.data;
    rec.tickers[type] = Array.isArray(rows)
      ? { ok: true, rows: rows.length, venues: rows.map((t) => `${t.instrument?.exName}_${t.instrument?.instrumentId}(type=${t.instrument?.type},base=${t.instrument?.baseAsset})`) }
      : { ok: false, raw: summarize(r) };
    console.log(`  tickers ${type} keyword=${base} → ${rec.tickers[type].ok ? `${rows.length} rows: ${rec.tickers[type].venues.slice(0, 6).join(" | ")}` : `NO — ${summarize(r, 140)}`}`);
    await sleep(300);
  }
  {
    const r = await cgGet(`/api/largeTakerOrder/support/v3?symbol=${encodeURIComponent(base)}`, "https://fapi.coinglass.com");
    const has = r && !r.__http && !r.__code && !r.__decryptError && (Array.isArray(r?.futures) || Array.isArray(r?.spot));
    rec.lto = has
      ? { ok: true, futures: (r.futures ?? []).map((s) => s.exchange), spot: (r.spot ?? []).map((s) => s.exchange) }
      : { ok: false, raw: summarize(r, 160) };
    console.log(`  lto support/v3 symbol=${base} → ${has ? `futures=[${rec.lto.futures}] spot=[${rec.lto.spot}]` : `NO — ${summarize(r, 140)}`}`);
    await sleep(300);
  }
  {
    const key = `Binance_${base}USDT`;
    const r = await cgGet(`/api/orderFlow?symbol=${encodeURIComponent(`${key}#order_flow`)}&interval=m15&minLimit=false&limit=5`);
    const rows = Array.isArray(r) ? r : r?.data;
    rec.orderflow = Array.isArray(rows) && rows.length
      ? { ok: true, bars: rows.length, sampleTs: rows[0]?.[0] }
      : { ok: false, raw: summarize(r, 160) };
    console.log(`  orderFlow ${key}#order_flow m15 → ${rec.orderflow.ok ? `${rows.length} bars (first ts=${rows[0]?.[0]})` : `NO — ${summarize(r, 140)}`}`);
    await sleep(300);
  }
  {
    const key = `Binance_${base}USDT`;
    const r = await cgGet(`/api/liquidationLevels/v2?symbol=${encodeURIComponent(key)}&limit=5&range=3d`);
    const d = r?.data ?? r;
    const ok = d && Array.isArray(d.prices) ? true : Array.isArray(d);
    rec.liqlevels = ok
      ? { ok: true, prices: Array.isArray(d) ? d.length : d.prices.length, dataRows: Array.isArray(d?.data) ? d.data.length : (d?.data?.length ?? null) }
      : { ok: false, raw: summarize(r, 160) };
    console.log(`  liquidationLevels/v2 ${key} → ${ok ? `prices=${rec.liqlevels.prices}` : `NO — ${summarize(r, 140)}`}`);
    await sleep(300);
  }
  {
    const key = `Binance_${base}USDT`;
    const r = await cgGet(`/api/v2/kline?symbol=${encodeURIComponent(`${key}#kline`)}&interval=m15&limit=3&minLimit=false`);
    const rows = Array.isArray(r) ? r : r?.data;
    rec.kline = Array.isArray(rows) && rows.length
      ? { ok: true, rows: rows.length, lastClose: rows[rows.length - 1]?.[4] }
      : { ok: false, raw: summarize(r, 160) };
    console.log(`  kline ${key}#kline m15 → ${rec.kline.ok ? `${rows.length} rows, lastClose=${rec.kline.lastClose}` : `NO — ${summarize(r, 140)}`}`);
    await sleep(300);
  }
  out.btokens[base] = rec;
}

// ---------- e) plain names (no B suffix) ----------
for (const kw of PLAIN) {
  const rec = { FUTURES: null, SPOT: null, orderflow_probes: {}, liqlevels_probes: {} };
  console.log(`\n===== keyword=${kw} (plain name) =====`);
  for (const type of ["FUTURES", "SPOT"]) {
    const r = await cgGet(`/api/select/coins/tickers?type=${type}&keyword=${encodeURIComponent(kw)}`);
    const rows = Array.isArray(r) ? r : r?.data;
    rec[type] = Array.isArray(rows)
      ? {
          ok: true,
          rows: rows.length,
          keys: rows.map((t) => ({ key: `${t.instrument?.exName}_${t.instrument?.instrumentId}`, type: t.instrument?.type, base: t.instrument?.baseAsset, volUsd: t.volUsd })),
        }
      : { ok: false, raw: summarize(r, 160) };
    console.log(`  tickers ${type} keyword=${kw} → ${rec[type].ok ? `${rows.length} rows` : `NO — ${summarize(r, 140)}`}`);
    if (rec[type].ok) {
      for (const k of rec[type].keys.slice(0, 8)) console.log(`      ${k.key}  type=${k.type} base=${k.base} vol24h=${Math.round(k.volUsd ?? 0)}`);
    }
    await sleep(300);
  }
  // probe orderFlow + liqlevels on the top discovered FUTURES instrument keys
  if (rec.FUTURES?.ok) {
    const uniqEx = [...new Set(rec.FUTURES.keys.map((k) => k.key))];
    for (const key of uniqEx.slice(0, 5)) {
      const r = await cgGet(`/api/orderFlow?symbol=${encodeURIComponent(`${key}#order_flow`)}&interval=m15&minLimit=false&limit=3`);
      const rows = Array.isArray(r) ? r : r?.data;
      const ok = Array.isArray(rows) && rows.length > 0;
      rec.orderflow_probes[key] = ok ? { ok: true, bars: rows.length } : { ok: false, raw: summarize(r, 120) };
      console.log(`      orderFlow ${key} → ${ok ? `${rows.length} bars` : `no (${summarize(r, 90)})`}`);
      await sleep(300);
      const r2 = await cgGet(`/api/liquidationLevels/v2?symbol=${encodeURIComponent(key)}&limit=5&range=3d`);
      const d = r2?.data ?? r2;
      const okL = d && (Array.isArray(d?.prices) || Array.isArray(d));
      rec.liqlevels_probes[key] = okL ? { ok: true } : { ok: false, raw: summarize(r2, 120) };
      console.log(`      liqlevels ${key} → ${okL ? "payload" : `no (${summarize(r2, 90)})`}`);
      await sleep(300);
    }
  }
  out.plainNames[kw] = rec;
}

// ---------- f) Hyperliquid HIP-3 xyz dex live universe ----------
console.log(`\n===== Hyperliquid xyz dex (api.hyperliquid.xyz/info) =====`);
try {
  const res = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "metaAndAssetCtxs", dex: "xyz" }),
    signal: AbortSignal.timeout(25_000),
  });
  const body = await res.json();
  // [ { universe: [...] }, [ ctxs ] ]
  const universe = Array.isArray(body) ? body[0]?.universe : body?.universe;
  if (Array.isArray(universe)) {
    out.hyperliquid_xyz = {
      ok: true,
      http: res.status,
      markets: universe.length,
      names: universe.map((u) => u.name),
    };
    console.log(`  http=${res.status} markets=${universe.length}`);
    const anth = universe.filter((u) => /ANTH/i.test(u.name));
    console.log(`  ANTHROPIC-like markets: ${anth.length ? anth.map((u) => u.name).join(", ") : "NONE"}`);
    for (const probe of ["NVDA", "MU", "SOXL", "GOOGL", "SP500", "XYZ100", "GOLD", "SILVER", "CL", "BRENTOIL"]) {
      const m = universe.find((u) => u.name === probe || u.name === `xyz:${probe}`);
      console.log(`  ${probe}: ${m ? "listed (name=" + m.name + ")" : "not in xyz dex"}`);
    }
    // also scan the whole main dex for ANTHROPIC just in case
    const res2 = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "meta", dex: "xyz" }),
      signal: AbortSignal.timeout(25_000),
    }).catch(() => null);
    // main perp dex universe (no dex field)
    const res3 = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "meta" }),
      signal: AbortSignal.timeout(25_000),
    });
    const main = await res3.json();
    const mainNames = (main?.universe ?? []).map((u) => u.name);
    out.hyperliquid_main = { ok: true, http: res3.status, markets: mainNames.length };
    const anthMain = mainNames.filter((n) => /ANTH/i.test(n));
    console.log(`  main dex markets=${mainNames.length}, ANTHROPIC-like: ${anthMain.length ? anthMain.join(", ") : "NONE"}`);
  } else {
    out.hyperliquid_xyz = { ok: false, http: res.status, raw: summarize(body, 200) };
    console.log(`  http=${res.status} unexpected shape: ${summarize(body, 200)}`);
  }
} catch (e) {
  out.hyperliquid_xyz = { ok: false, error: e.message };
  console.log(`  FETCH FAIL: ${e.message}`);
}

writeFileSync("/tmp/cg-btokens.json", JSON.stringify(out, null, 2));
console.log("\nwrote /tmp/cg-btokens.json");
