# CG Order-Flow Terminal — Antigravity Agent Entry Point

This file exists so Antigravity agents landing in the repo find the right
door. **The full documentation is [README.md](./README.md)** — this mirror
previously duplicated it byte-for-byte, which is why it is now a pointer.

Agent-relevant facts, 30-second version:

- **Wake-up protocol**: `AGENTS.md` (workspace root) — poll `notifications`
  via MCP → for each `[HIGH]` event call `analyze_setup` → return a trade
  card. The MCP server is `mcp/server.mjs` (`TERMINAL_URL` env, default
  `http://localhost:3000`).
- **MCP cursor**: `data/mcp-cursor.json` persists per-agent read state; each
  scheduled run sees only genuinely new events.
- **Local trust model**: routes are unauthenticated; `npm start` binds
  127.0.0.1 by default; mutating API routes are same-origin only. Do not
  expose the terminal beyond loopback without reading README.md §7.
- **Data honesty**: liquidation levels / whale orders / stops map are model
  estimates; the stops heatmap is BTC-only on the anonymous API; the whole
  client is unofficial and personal-use — README.md §8.

For install steps see [INSTALL-GUIDE.md](./INSTALL-GUIDE.md).
