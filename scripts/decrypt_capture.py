#!/usr/bin/env python3
"""Decrypt a captured encrypted Coinglass response (offline)."""
import json, base64, zlib, sys
from Crypto.Cipher import AES

def unpad(b: bytes) -> bytes:
    return b[:-b[-1]] if b and 0 < b[-1] <= 16 else b

def try_inflate(d: bytes) -> bytes:
    for w in (15, -15, 31):
        try:
            return zlib.decompress(d, w)
        except zlib.error:
            continue
    return d

raw = open('/tmp/capbody.txt').read().strip()
if raw.startswith('"'):
    raw = json.loads(raw)
wrapper = json.loads(raw)
data_b64 = wrapper['data']

hdrs_raw = open('/tmp/caphdrs.json').read().strip()
if hdrs_raw.startswith('"'):
    hdrs_raw = json.loads(hdrs_raw)
hdrs = json.loads(hdrs_raw)
user_b64 = hdrs['user']
v = str(hdrs.get('v', '0'))
cache_ts = json.load(open('/tmp/capmeta.json'))['cacheTs'] if False else None

# key A by version
KEY_A_CONSTS = {"55": "170b070da9654622", "66": "d6537d845a964081", "77": "863f08689c97435b"}
if v == '0':
    src = cache_ts or ''
elif v == '2':
    src = hdrs.get('time') or ''
elif v == '1':
    src = '/api/largeTakerOrder/v3'  # mangled url: from '/api' up to '?'
else:
    src = KEY_A_CONSTS.get(v, '')
key_a = base64.b64encode(src.encode())[:16]

cipher = AES.new(key_a, AES.MODE_ECB)
key_b_raw = try_inflate(unpad(cipher.decrypt(base64.b64decode(user_b64))))
key_b = key_b_raw.decode('utf-8', 'replace').strip('"')
print('v =', v, '| key_b len =', len(key_b))

cipher2 = AES.new(key_b.encode(), AES.MODE_ECB)
payload = try_inflate(unpad(cipher2.decrypt(base64.b64decode(data_b64))))
txt = payload.decode('utf-8', 'replace').strip('"')
print('payload bytes:', len(payload))

d = json.loads(txt)
groups = d if isinstance(d, list) else d.get('data', [])
n = sum(len(g.get('list', [])) for g in groups)
print('groups:', len(groups), '| total orders:', n)
for g in groups:
    inst = g.get('instrument', {})
    bids = [it for it in g.get('list', []) if it.get('side') == 2]
    bid_ge1m = sum(it.get('currentUsd', 0) for it in bids if it.get('currentUsd', 0) >= 1e6)
    print(f"  {inst.get('exName','?'):8s} {inst.get('instrumentId','?'):16s} type={inst.get('type')} orders={len(g.get('list', [])):3d} bid>=1M: ${bid_ge1m/1e6:.1f}M")

open('/tmp/page-response-decrypted.json', 'w').write(txt)
