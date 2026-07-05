---
name: run-app
description: Launch and verify the Waiterless dev stack (Express API :5000 + Next.js web :3001). Use when asked to run, start, restart, or smoke-test the app.
---

# Run the Waiterless dev stack

## Preconditions
- Ports 5000 and 3001 must be free. Stale `node` processes survive task stops on
  Windows — check and kill first:
  ```powershell
  Get-NetTCPConnection -LocalPort 5000,3001 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }
  ```
- MongoDB is a remote Atlas cluster (see `apps/server/.env`) — no local DB needed.
- If `Cannot find module '@waiterless/types'`: workspace symlinks are stale (repo was
  moved) → `npm install` at the root.

## Launch
From the repo root, run in background:
```bash
npm run dev
```
Ready when the log shows BOTH `Waiterless server running on port 5000` (preceded by
`MongoDB connected`) and `✓ Ready in …`. Takes ~10-20s.

## Smoke test
```bash
curl -s http://localhost:5000/api/health            # {"status":"ok",...}
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/   # 200
```
Then drive it in a browser: log in at http://localhost:3001/login as
`owner@goldenfork.com / Owner@1234` → dashboard should show charts with data.
If charts are empty, reseed: `npm run seed && npm run seed:demo` in `apps/server`.

## Notes
- `ts-node-dev` hot-reloads server changes; Next hot-reloads web. Changing
  `apps/web/.env.local` or `next.config.mjs` requires a full restart.
- Server restarts briefly kill in-flight requests — a bounced login during
  verification is normal; just sign in again.
- Guest portal for testing: get a table's `qrToken` via `GET /api/tables` (cashier
  token) → open `http://localhost:3001/r/golden-fork/table/<qrToken>`.
