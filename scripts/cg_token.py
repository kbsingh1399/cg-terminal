#!/usr/bin/env python3
"""Coinglass web-API token generator + encrypted-response decryptor.
Scheme (reverse-engineered from the coinglass web bundle for interoperability):
  request header `obe` = base64( AES-256-ECB-PKCS7( utf8("<unix_seconds>,<TOTP6>") ) )
    key = utf8 bytes of "1f68efd73f8d4921acc0dead41dd39bc" (32 bytes)
    TOTP secret (base32) = "I65VU7K5ZQL7WB4E", HMAC-SHA1, 6 digits, 30 s step
  requests must also carry: encryption: true, cache-ts-v2: <ms>
  response `data` (when a string) = AES-256-ECB-PKCS7 ciphertext in base64, same key.
"""
import base64, hashlib, hmac, struct, time, json, sys

KEY = b"1f68efd73f8d4921acc0dead41dd39bc"          # 32 bytes -> AES-256
TOTP_SECRET = "I65VU7K5ZQL7WB4E"

try:
    from Crypto.Cipher import AES  # pycryptodome
except ImportError:
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "pycryptodome"], check=True)
    from Crypto.Cipher import AES


def totp(secret_b32: str, t: int, step: int = 30, digits: int = 6) -> str:
    # base32 decode (tolerate missing padding)
    pad = "=" * (-len(secret_b32) % 8)
    key = base32_b32decode(secret_b32)
    counter = struct.pack(">Q", int(t) // step)
    digest = hmac.new(key, counter, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = (struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF) % (10 ** digits)
    return str(code).zfill(digits)


def base32_b32decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 8)
    return base64.b32decode(s.upper() + pad)


def pkcs7_pad(data: bytes, block: int = 16) -> bytes:
    n = block - (len(data) % block)
    return data + bytes([n]) * n


def pkcs7_unpad(data: bytes) -> bytes:
    return data[: -data[-1]]


def make_obe_token(now_ms: int = None) -> str:
    secs = int((now_ms or time.time() * 1000) / 1000)
    plain = f"{secs},{totp(TOTP_SECRET, secs)}".encode()
    cipher = AES.new(KEY, AES.MODE_ECB)
    return base64.b64encode(cipher.encrypt(pkcs7_pad(plain))).decode()


def decrypt_payload(b64data: str):
    cipher = AES.new(KEY, AES.MODE_ECB)
    raw = pkcs7_unpad(cipher.decrypt(base64.b64decode(b64data)))
    return json.loads(raw.decode("utf-8"))


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "token"
    if mode == "token":
        print(make_obe_token())
    elif mode == "decrypt":
        blob = sys.argv[2] if len(sys.argv) > 2 else sys.stdin.read().strip()
        print(json.dumps(decrypt_payload(blob))[:2000])
