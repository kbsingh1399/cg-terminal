#!/usr/bin/env python3
"""Durable repair via git plumbing from /tmp (tmpfs = the only reliable view).

The rootfs overlay (volatile) serves alternating stale/fresh file views to
different readers, so `git add` cannot be trusted. Instead:
  1. build the fully-fixed sources in /tmp (stable),
  2. `git hash-object -w` them (blob written from /tmp bytes),
  3. verify the blob via `git cat-file` repeatedly,
  4. `git update-index --cacheinfo` + `git commit-tree`-style commit,
  5. verify HEAD moved and its blobs are clean across 3 spaced reads,
  6. push and report the new SHA.
"""
import os
import subprocess
import sys
import time

FILES = ["src/lib/cg/micro.ts", "src/lib/cg/memwatch.ts"]
FIXES = [
    ("now - h.length - 1].t", "now - h[h.length - 1].t"),
    ("`ealth] rss=", "`[cg-memwatch] rss="),
]
MSG = ("fix: restore 2 lines mangled in R5 commit — micro recordOi stale-guard "
       "(h[h.length-1].t) and memwatch log prefix; blob built from /tmp via plumbing")

def sh(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(args, capture_output=True, text=True)

def build_fixed(rel: str) -> str:
    src = open(rel, encoding="utf-8").read()
    fixed = src
    for bad, good in FIXES:
        fixed = fixed.replace(bad, good)
    return fixed

def main() -> int:
    # 1) fixed bytes into /tmp
    tmps = {}
    for rel in FILES:
        fixed = build_fixed(rel)
        tmp = f"/tmp/fixed_{os.path.basename(rel)}"
        with open(tmp, "w", encoding="utf-8") as f:
            f.write(fixed)
            f.flush()
            os.fsync(f.fileno())
        back = open(tmp, encoding="utf-8").read()
        if back != fixed:
            print(f"FAIL /tmp write for {rel}")
            return 1
        tmps[rel] = tmp
        print(f"tmp ok: {tmp} ({len(fixed)} bytes)")

    # 2) blobs from /tmp bytes
    blobs = {}
    for rel, tmp in tmps.items():
        r = sh("git", "hash-object", "-w", tmp)
        if r.returncode != 0:
            print("hash-object failed:", r.stderr)
            return 1
        blob = r.stdout.strip()
        # 3) verify blob 3x
        for i in range(3):
            c = sh("git", "cat-file", "blob", blob)
            joined = c.stdout
            if any(bad in joined for bad, _ in FIXES) or joined != open(tmp, encoding="utf-8").read():
                print(f"blob {blob[:10]} for {rel} read DIRTY at check {i+1}")
                return 1
            time.sleep(0.3)
        blobs[rel] = blob
        print(f"blob verified: {blob[:12]} for {rel}")

    # 4) stage blobs + commit
    for rel, blob in blobs.items():
        mode = "100644"
        r = sh("git", "update-index", "--cacheinfo", f"{mode},{blob},{rel}")
        if r.returncode != 0:
            print("update-index failed:", r.stderr)
            return 1
    staged = sh("git", "diff", "--cached", "--stat")
    print("staged:", staged.stdout.strip() or "(index == parent view — forcing commit anyway)")
    base = sh("git", "rev-parse", "HEAD").stdout.strip()
    tree = sh("git", "write-tree")
    if tree.returncode != 0:
        print("write-tree failed:", tree.stderr)
        return 1
    commit = sh("git", "commit-tree", tree.stdout.strip(), "-p", base, "-m", MSG)
    if commit.returncode != 0:
        print("commit-tree failed:", commit.stderr)
        return 1
    new_sha = commit.stdout.strip()
    r = sh("git", "update-ref", "refs/heads/main", new_sha, base)
    if r.returncode != 0:
        print("update-ref failed:", r.stderr)
        return 1
    print(f"commit created: {new_sha[:12]} (was {base[:12]})")

    # 5) verify HEAD blobs 3x spaced
    for i in range(3):
        for rel in FILES:
            c = sh("git", "show", f"HEAD:{rel}")
            if any(bad in c.stdout for bad, _ in FIXES):
                print(f"HEAD:{rel} read DIRTY at spaced check {i+1}")
                return 1
        time.sleep(1.5)
    print("HEAD blobs verified clean x3")

    # 6) push
    push = sh("git", "push", "origin", "main")
    out = (push.stdout + push.stderr).strip()
    print("push:", out[:300])
    remote = sh("git", "ls-remote", "origin", "refs/heads/main")
    print("remote main:", remote.stdout.strip()[:60])
    if remote.stdout.strip().startswith(new_sha):
        print("REMOTE CONFIRMED AT NEW SHA")
        return 0
    return 1

if __name__ == "__main__":
    sys.exit(main())
