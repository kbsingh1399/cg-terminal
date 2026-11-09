import crypto from "crypto";
import zlib from "zlib";

/**
 * Coinglass web-API client crypto layer.
 *
 * Interoperability notes (reverse-engineered from the public web client):
 * - Requests carry an `obe` header: base64( AES-256-ECB-PKCS7( "<unix_secs>,<TOTP6>" ) )
 *   with a static 32-byte key, TOTP secret base32, 30 s step, HMAC-SHA1.
 * - Requests also carry `encryption: true` and `cache-ts-v2: <ms>`.
 * - For protected endpoints the server responds with:
 *     headers: user=<b64 blob>, v=<derivation version>
 *     body:    { code:"0", data:"<b64 ciphertext>" }
 * - keyA = base64( sourceByV )[:16]  (v=="1" -> the mangled request path e.g. "/api/v2/kline")
 * - keyB = inflate( AES-decrypt(user blob, keyA) )   (quotes stripped)
 * - payload = inflate( AES-decrypt(data, keyB) )     (quotes stripped) -> JSON
 */

const STATIC_KEY = Buffer.from("1f68efd73f8d4921acc0dead41dd39bc", "utf8"); // 32 bytes -> AES-256
const TOTP_SECRET_B32 = "I65VU7K5ZQL7WB4E";

const KEY_A_CONSTS: Record<string, string> = {
  "55": "170b070da9654622",
  "66": "d6537d845a964081",
  "77": "863f08689c97435b",
};

function base32Decode(s: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of s.toUpperCase().replace(/=+$/, "")) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Standard RFC 6238 TOTP, 30 s step, 6 digits, HMAC-SHA1. */
export function totp(secretB32: string, t: number): string {
  const key = base32Decode(secretB32);
  const counter = Buffer.alloc(8);
  counter.writeUInt32BE(Math.floor(t / 30), 4);
  const digest = crypto.createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return String(code).padStart(6, "0");
}

/** Build the `obe` request header value. */
export function makeObeToken(nowMs?: number): string {
  const secs = Math.floor((nowMs ?? Date.now()) / 1000);
  const plain = Buffer.from(`${secs},${totp(TOTP_SECRET_B32, secs)}`, "utf8");
  const cipher = crypto.createCipheriv("aes-256-ecb", STATIC_KEY, null);
  return Buffer.concat([cipher.update(plain), cipher.final()]).toString("base64");
}

function aesEcbDecryptB64(b64: string, key: Buffer): Buffer {
  const algo = key.length === 16 ? "aes-128-ecb" : key.length === 24 ? "aes-192-ecb" : "aes-256-ecb";
  const decipher = crypto.createDecipheriv(algo, key, null);
  decipher.setAutoPadding(true);
  return Buffer.concat([decipher.update(Buffer.from(b64, "base64")), decipher.final()]);
}

function tryInflate(buf: Buffer): Buffer {
  for (const fn of [zlib.inflateSync, zlib.inflateRawSync, zlib.gunzipSync]) {
    try {
      return fn(buf);
    } catch {
      /* try next */
    }
  }
  return buf;
}

function stripQuotes(s: string): string {
  let out = s;
  if (out.startsWith('"')) out = out.slice(1);
  if (out.endsWith('"')) out = out.slice(0, -1);
  return out;
}

/** Replicates the web client URL mangler: path segment from "/api" up to "?" (or end). */
export function mangleUrl(url: string): string {
  const idx = url.indexOf("/api");
  if (idx === -1) return url;
  const q = url.indexOf("?");
  return q === -1 ? url.slice(idx) : url.slice(idx, q);
}

function deriveKeyA(v: string, cacheTs: string, timeHeader: string | null, url: string): Buffer {
  let src: string;
  if (v === "0") src = cacheTs;
  else if (v === "2") src = timeHeader ?? "";
  else if (v === "1") src = mangleUrl(url);
  else src = KEY_A_CONSTS[v] ?? "";
  // the web client uses the first 16 chars of the base64 string as raw key bytes (AES-128)
  return Buffer.from(Buffer.from(src, "utf8").toString("base64").slice(0, 16), "utf8");
}

export interface CgResponse {
  status: number;
  headers: Record<string, string>;
  bodyText: string;
}

/** Decrypt an encrypted capi response body into the plain payload. */
export function decryptCgResponse(resp: CgResponse, cacheTs: string, url: string): unknown {
  const body = JSON.parse(resp.bodyText) as { code?: string; msg?: string; data?: unknown };
  if (body.code !== "0") {
    throw new Error(`upstream code ${body.code}: ${body.msg ?? "unknown"}`);
  }
  const data = body.data;
  if (typeof data !== "string") return data; // plain response
  const userBlob = resp.headers["user"] ?? resp.headers["User"] ?? "";
  const v = String(resp.headers["v"] ?? "0");
  const keyA = deriveKeyA(v, cacheTs, resp.headers["time"] ?? null, url);
  const keyBRaw = stripQuotes(tryInflate(aesEcbDecryptB64(userBlob, keyA)).toString("utf8"));
  const payloadRaw = stripQuotes(
    tryInflate(aesEcbDecryptB64(data, Buffer.from(keyBRaw, "utf8"))).toString("utf8")
  );
  try {
    return JSON.parse(payloadRaw);
  } catch {
    return payloadRaw;
  }
}

/** Build the standard header set the web client sends. */
export function cgHeaders(cacheTs: string): Record<string, string> {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Origin: "https://www.coinglass.com",
    Referer: "https://www.coinglass.com/",
    Accept: "application/json",
    encryption: "true",
    "cache-ts-v2": cacheTs,
    language: "en",
    obe: makeObeToken(Number(cacheTs)),
  };
}
