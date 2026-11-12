#!/usr/bin/env node
/**
 * Production start wrapper — runs .next/standalone/server.js with a SAFE
 * default bind address.
 *
 * Next.js standalone binds 0.0.0.0 (all interfaces) unless HOSTNAME is set.
 * This terminal serves 21 unauthenticated local routes, so the default must
 * be loopback; anyone who wants LAN access sets HOSTNAME explicitly:
 *
 *   HOSTNAME=0.0.0.0 npm start        # expose on the LAN (know what you do)
 *   HOSTNAME=192.168.1.10 npm start   # bind one interface
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

if (typeof process.loadEnvFile === "function" && existsSync(".env")) {
  try {
    process.loadEnvFile(".env");
  } catch (err) {
    console.warn("⚠️ Could not load .env file:", err.message);
  }
}

const server = join(process.cwd(), ".next", "standalone", "server.js");
if (!existsSync(server)) {
  console.error("✗ .next/standalone/server.js not found — run `npm run build` first");
  process.exit(1);
}

process.env.HOSTNAME ??= "127.0.0.1"; // loopback by default, override for LAN
process.env.NODE_ENV ??= "production";
// PUBLIC PATH GUARD: the platform edge proxy (Caddy on :81, FC_CUSTOM_LISTEN_PORT)
// routes preview traffic to localhost:3000 by default. A server started on any
// other port is unreachable from the public URL (502). Pin the default to 3000
// unless the caller explicitly overrides PORT.
process.env.PORT ??= "3000";

const child = spawn(process.execPath, [server], {
  stdio: "inherit",
  env: process.env,
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
