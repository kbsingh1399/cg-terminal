#!/usr/bin/env node
/**
 * One-time migration (2026-11-12): the standalone production server was
 * writing continuity series into .next/standalone/data/cg-series (wiped on
 * every rebuild). store.ts now escapes the standalone cwd, so move every
 * stranded JSONL back into the project data/cg-series, line-deduped against
 * what already exists there.
 */
import fs from "fs";
import path from "path";

const SRC = path.join(process.cwd(), ".next", "standalone", "data", "cg-series");
const DST = path.join(process.cwd(), "data", "cg-series");

if (!fs.existsSync(SRC)) {
  console.log("no stranded standalone data — nothing to migrate");
  process.exit(0);
}
fs.mkdirSync(DST, { recursive: true });

const files = fs.readdirSync(SRC).filter((f) => f.endsWith(".jsonl"));
let movedFiles = 0;
let movedLines = 0;
for (const f of files) {
  const src = path.join(SRC, f);
  const dst = path.join(DST, f);
  const srcLines = fs.readFileSync(src, "utf8").split("\n").filter((l) => l.trim());
  if (!srcLines.length) continue;
  let existing = new Set();
  if (fs.existsSync(dst)) {
    existing = new Set(fs.readFileSync(dst, "utf8").split("\n").filter((l) => l.trim()));
  }
  const fresh = srcLines.filter((l) => !existing.has(l));
  if (fresh.length) {
    fs.appendFileSync(dst, fresh.join("\n") + "\n", "utf8");
    movedFiles++;
    movedLines += fresh.length;
    console.log(`  ${f}: +${fresh.length} rows (of ${srcLines.length})`);
  } else {
    console.log(`  ${f}: fully duplicated, skipped`);
  }
}
console.log(`migrated ${movedLines} rows across ${movedFiles} files -> ${DST}`);
// remove the stranded dir so no stale copy can shadow the real one
fs.rmSync(SRC, { recursive: true, force: true });
console.log("removed stranded standalone data dir");
