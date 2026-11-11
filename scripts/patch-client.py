#!/usr/bin/env python3
"""Surgical patch: cgGet cache gets a BYTE budget (root-cause OOM fix).

Root cause chain (R6 postmortem):
  - cacheSet() capped at 800 ENTRIES but each value is a full upstream
    payload (stopmap 3-6MB, orderflow 1-3MB, liqlevels/largeorder 0.4MB...).
  - Engine writers use ttlMs=0 yet EVERY successful response still lands in
    the cache; backfill pagination adds hundreds of unique URLs per boot.
  - 800 entries of multi-MB payloads = multi-GB heap -> kernel OOM-kill at
    ~1.9GB RSS. Idle RSS plateaus only when no new unique URLs are inserted.

Fix: track raw response bytes per entry + a global byte counter, and evict
oldest-first while the cache exceeds CG_CLIENT_CACHE_BYTES (default 96MB) or
CG_CLIENT_CACHE_MAX entries. Exposes __cgClientCacheBytes for /api/cg/debug/mem.
"""
import os
import subprocess
import sys

PATH = "src/lib/cg/client.ts"

OLD_GC = """const gC = globalThis as unknown as { __cgClientCache?: Map<string, CacheEntry>; __cgClientInflight?: Map<string, Promise<unknown>> };"""
NEW_GC = """const gC = globalThis as unknown as { __cgClientCache?: Map<string, CacheEntry>; __cgClientInflight?: Map<string, Promise<unknown>>; __cgClientCacheBytes?: { n: number } };"""

OLD_ENTRY = """interface CacheEntry {
  at: number;
  data: unknown;
}"""
NEW_ENTRY = """interface CacheEntry {
  at: number;
  data: unknown;
  /** raw response bytes — powers the byte-budget eviction below */
  bytes?: number;
}"""

OLD_BYTES_DECL = """const cache = (gC.__cgClientCache ??= new Map());"""
NEW_BYTES_DECL = """const cache = (gC.__cgClientCache ??= new Map());
/** running total of cached raw bytes — the OOM guard reads this (debug/mem route) */
const cacheBytes = (gC.__cgClientCacheBytes ??= { n: 0 });"""

OLD_MAX = """const CACHE_MAX = Math.max(50, Number(process.env.CG_CLIENT_CACHE_MAX ?? 800) || 800);"""
NEW_MAX = """const CACHE_MAX = Math.max(50, Number(process.env.CG_CLIENT_CACHE_MAX ?? 800) || 800);
/**
 * BYTE budget (R6 OOM fix): an 800-ENTRY cap alone allowed hundreds of
 * multi-MB payloads (stopmap ~3-6MB, orderflow ~1-3MB, liqlevels/largeorder
 * ~0.4MB) to pile up to GBs and get the process kernel-OOM-killed. Entries
 * are now also evicted oldest-first once the cache holds more than this
 * many raw bytes (~96MB default).
 */
const CACHE_MAX_BYTES = Math.max(8_000_000, Number(process.env.CG_CLIENT_CACHE_BYTES ?? 96_000_000) || 96_000_000);"""

OLD_SET = """function cacheSet(url: string, data: unknown) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(url, { at: Date.now(), data });
}"""
NEW_SET = """function cacheSet(url: string, data: unknown, rawBytes = 0) {
  // evict while EITHER cap is exceeded (entries or bytes) — oldest first
  while (cache.size >= CACHE_MAX || (cacheBytes.n + rawBytes > CACHE_MAX_BYTES && cache.size > 0)) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    const evicted = cache.get(oldest);
    cacheBytes.n -= evicted?.bytes ?? 0;
    cache.delete(oldest);
  }
  cacheBytes.n += rawBytes;
  cache.set(url, { at: Date.now(), data, bytes: rawBytes });
}"""

OLD_CACHESET_CALLS = [
    ("    cacheSet(url, body.data);", "    cacheSet(url, body.data, resp.bodyText.length);"),
    ("  cacheSet(url, data);", "  cacheSet(url, data, resp.bodyText.length);"),
]

REPLACEMENTS = [
    (OLD_GC, NEW_GC),
    (OLD_ENTRY, NEW_ENTRY),
    (OLD_BYTES_DECL, NEW_BYTES_DECL),
    (OLD_MAX, NEW_MAX),
    (OLD_SET, NEW_SET),
    *OLD_CACHESET_CALLS,
]

def main() -> int:
    text = open(PATH, encoding="utf-8").read()
    for old, new in REPLACEMENTS:
        n = text.count(old)
        if n != 1:
            print(f"ERR fragment not unique (count={n}): {old[:60]!r}...")
            return 1
        text = text.replace(old, new)
    tmp = "/tmp/client_fixed.ts"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(text)
        f.flush()
        os.fsync(f.fileno())
    # sanity: new fragments present, old gone
    check = open(tmp, encoding="utf-8").read()
    for _, new in REPLACEMENTS:
        if new not in check:
            print("ERR new fragment missing after replace")
            return 1
    for old, _ in REPLACEMENTS:
        # additive replacements legitimately contain the old text as a prefix
        # (new = old + appended lines) — only flag old fragments that survived
        # OUTSIDE the new text
        occurrences_new = 0
        for _, new2 in REPLACEMENTS:
            occurrences_new += new2.count(old)
        if check.count(old) > occurrences_new:
            print(f"ERR old fragment still present outside its replacement: {old[:50]!r}")
            return 1
    os.replace(tmp, PATH)
    subprocess.run(["sync"], check=False)
    back = open(PATH, encoding="utf-8").read()
    ok = all(new in back for _, new in REPLACEMENTS)
    for old, _ in REPLACEMENTS:
        occ = 0
        for _, new2 in REPLACEMENTS:
            occ += new2.count(old)
        if back.count(old) > occ:
            ok = False
            print(f"post-verify: old fragment outside replacement: {old[:50]!r}")
    print("PATCH", "OK" if ok else "FAILED-VERIFY")
    return 0 if ok else 1

if __name__ == "__main__":
    sys.exit(main())
