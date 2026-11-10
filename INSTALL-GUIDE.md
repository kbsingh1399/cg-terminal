# Quick Install — CG Order-Flow Terminal

Short version. Full documentation (features, architecture, data-continuity
model, security notes, troubleshooting) lives in **[README.md](./README.md)**.

## 1. Requirements

- **Node.js 20+** (`node -v`) — https://nodejs.org
- ~500 MB free disk · internet access to `capi.coinglass.com` / `fapi.coinglass.com`

## 2. Install (any OS)

```bash
cd cg-terminal
npm install                 # 2-4 min
cp .env.example .env        # Windows PowerShell: copy .env.example .env
npm run dev                 # dev mode on http://localhost:3000
```

First boot backfills ~3 days of m15 klines for all 12 assets + the BTC
continuity set (2-5 min; the header engine chip shows the progress).

Production mode (recommended for always-on use):

```bash
npm run build               # works fully offline — fonts are self-hosted
npm start                   # binds 127.0.0.1 by default (HOSTNAME to override)
```

## 3. Plug it into Antigravity (MCP)

1. Start the terminal first.
2. Antigravity → **Settings → MCP → Add custom server**:

   ```json
   {
     "mcpServers": {
       "cg-terminal": {
         "command": "node",
         "args": ["/ABSOLUTE/PATH/TO/cg-terminal/mcp/server.mjs"],
         "env": { "TERMINAL_URL": "http://localhost:3000" }
       }
     }
   }
   ```

3. Keep `AGENTS.md` in the workspace root — it holds the wake-up protocol
   (poll → analyze `[HIGH]` events → formulate). Test with
   *"check the terminal feed"*.

## 4. Common issues

| Symptom | Fix |
| --- | --- |
| `EADDRINUSE :3000` | `npm run dev -- -p 3100` + `TERMINAL_URL=http://localhost:3100` |
| tabs empty >2 min | anonymous rate-limit — reload, engine retries (429-aware) |
| stopmap `code 40000` | needs a Coinglass login upstream (anonymous = 24h view) |
| MCP `fetch failed` | terminal not running — start it first |

Everything else — including the honest data notes (model estimates, BTC-only
stops map, unofficial-client caveats) — is in **README.md §8**.
