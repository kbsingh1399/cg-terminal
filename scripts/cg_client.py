#!/usr/bin/env python3
"""Full Coinglass encrypted-response chain verification.
Flow (reverse-engineered for interoperability):
 1. Request carries headers: obe (TOTP token), encryption: true, cache-ts-v2: <ms>, Accept: application/json
 2. Response headers include: user=<encrypted key blob>, encryption=1, v=<key-derivation version>
 3. key A = base64( source(v) )[:16]
      v==0  -> source = request cache-ts-v2 (string ms)
      v==2  -> source = response header `time`
      v==1  -> source = mangled request URL
      v==55 -> "170b070da9654622"; v==66 -> "d6537d845a964081"; v==77 -> "863f08689c97435b"
 4. key B = inflate( AES-256-ECB-decrypt(b64decode(user_header), keyA_utf8) )   (quotes stripped)
 5. payload = inflate( AES-256-ECB-decrypt(b64decode(resp.data), keyB_utf8) )   (quotes stripped) -> JSON
"""
import base64, json, sys, time, zlib, importlib.util
import urllib.request

from pathlib import Path
spec = importlib.util.spec_from_file_location('cgt', str(Path(__file__).parent / 'cg_token.py'))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
from Crypto.Cipher import AES

KEY_A_CONSTS = {"55": "170b070da9654622", "66": "d6537d845a964081", "77": "863f08689c97435b"}


def cg_get(url: str, extra_headers: dict = None, timeout: int = 25):
    """GET a capi.coinglass.com URL with the web-client auth headers. Returns (status, headers, body_json_or_text)."""
    now_ms = int(time.time() * 1000)
    token = m.make_obe_token(now_ms)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Origin": "https://www.coinglass.com",
        "Referer": "https://www.coinglass.com/",
        "Accept": "application/json",
        "encryption": "true",
        "cache-ts-v2": str(now_ms),
        "language": "en",
        "obe": token,
    }
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, dict(resp.headers), resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode("utf-8", "replace")


def aes_ecb_decrypt(b64_cipher: str, key: bytes) -> bytes:
    cipher = AES.new(key, AES.MODE_ECB)
    return m.pkcs7_unpad(cipher.decrypt(base64.b64decode(b64_cipher)))


def try_inflate(data: bytes) -> bytes:
    """pako.inflate handles raw deflate and zlib; try zlib then raw."""
    for wbits in (15, -15, 31):
        try:
            return zlib.decompress(data, wbits)
        except zlib.error:
            continue
    return data  # maybe not compressed at all


def strip_quotes(s: str) -> str:
    if s.startswith('"'):
        s = s[1:]
    if s.endswith('"'):
        s = s[:-1]
    return s


def mangle_url(url: str) -> str:
    """Replicates the client's eo() URL mangler: path from '/api' up to '?' (or end)."""
    idx = url.find("/api")
    if idx == -1:
        return url
    q = url.find("?")
    return url[idx:] if q == -1 else url[idx:q]


def derive_key_a(v: str, cache_ts: str, time_hdr: str, url: str) -> bytes:
    if v == "0":
        src = cache_ts
    elif v == "2":
        src = time_hdr or ""
    elif v == "1":
        src = mangle_url(url)
    else:
        src = KEY_A_CONSTS.get(v, "")
    return base64.b64encode(src.encode())[:16]


def decrypt_response(headers: dict, body_text: str, cache_ts: str, url: str):
    """Returns decrypted payload (parsed JSON if possible)."""
    body = json.loads(body_text)
    data = body.get("data")
    if not isinstance(data, str):
        return body  # plain response
    user_blob = headers.get("user") or headers.get("User") or ""
    v = str(headers.get("v", "0"))
    key_a = derive_key_a(v, cache_ts, headers.get("time"), url)
    key_b_raw = try_inflate(aes_ecb_decrypt(user_blob, key_a))
    key_b = strip_quotes(key_b_raw.decode("utf-8", "replace"))
    payload_raw = try_inflate(aes_ecb_decrypt(data, key_b.encode()))
    payload = strip_quotes(payload_raw.decode("utf-8", "replace"))
    try:
        return json.loads(payload)
    except json.JSONDecodeError:
        return payload


def fetch_decrypted(url: str):
    cache_ts = str(int(time.time() * 1000))
    status, headers, body = cg_get(url)
    if status != 200:
        return {"http_status": status, "body": body[:300]}
    try:
        return decrypt_response(headers, body, cache_ts, url)
    except Exception as e:
        return {"error": repr(e), "headers": {k: headers[k] for k in ("user", "v", "encryption", "time") if k in headers}, "body_head": body[:200]}


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "https://capi.coinglass.com/api/v2/kline?symbol=Binance_BTCUSDT%23kline&interval=m15&minLimit=false&limit=3"
    out = fetch_decrypted(url)
    print(json.dumps(out))
