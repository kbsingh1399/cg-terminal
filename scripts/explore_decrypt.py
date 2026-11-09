#!/usr/bin/env python3
"""Explore decryption variants for coinglass encrypted response payloads."""
import base64, json, sys, importlib.util
spec = importlib.util.spec_from_file_location('cgt', '/home/z/my-project/scripts/cg_token.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
from Crypto.Cipher import AES
import hashlib

KEY = b"1f68efd73f8d4921acc0dead41dd39bc"

def show(name, data: bytes, limit=120):
    printable = all(32 <= b < 127 or b in (9, 10, 13) for b in data[:limit])
    if printable:
        print(f"[{name}] TEXT: {data[:limit]!r}")
    else:
        print(f"[{name}] HEX: {data[:limit].hex()}")

def variants(b64data: str):
    ct = base64.b64decode(b64data)
    print(f"ciphertext len={len(ct)} head_hex={ct[:32].hex()}")
    print(f"head_ascii={ct[:8]!r}")

    # 1. ECB static key
    try:
        show("ECB static", m.pkcs7_unpad(AES.new(KEY, AES.MODE_ECB).decrypt(ct)))
    except Exception as e:
        print("ECB static fail:", e)

    # 2. CBC with IV = first block
    try:
        show("CBC iv=blk0", m.pkcs7_unpad(AES.new(KEY, AES.MODE_CBC, iv=ct[:16]).decrypt(ct[16:])))
    except Exception as e:
        print("CBC iv=blk0 fail:", e)

    # 3. CBC iv=zeros
    try:
        show("CBC iv=0", m.pkcs7_unpad(AES.new(KEY, AES.MODE_CBC, iv=b"\0"*16).decrypt(ct)))
    except Exception as e:
        print("CBC iv=0 fail:", e)

    # 4. ECB with md5(key) as key (16 bytes -> AES-128)
    for kname, k in [("md5(key)", hashlib.md5(KEY).digest()),
                     ("md5(key) hexdigest utf8", hashlib.md5(KEY).hexdigest().encode()[:16]),
                     ("key[:16]", KEY[:16])]:
        try:
            show(f"ECB {kname}", m.pkcs7_unpad(AES.new(k, AES.MODE_ECB).decrypt(ct)))
        except Exception as e:
            print(f"ECB {kname} fail:", e)

if __name__ == "__main__":
    r = json.load(open('/tmp/kline_resp.json'))
    variants(r['data'])
