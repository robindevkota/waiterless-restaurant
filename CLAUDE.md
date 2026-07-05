# Waiterless — QR-first restaurant OS (SaaS)

Multi-tenant restaurant platform: guests order via table QR codes, kitchen sees a live
queue, cashier settles bills. **Selling point: the AI Business Analyst** — LLM-generated
business reports from each restaurant's sales data (Gemini/Groq, bring-your-own free key).

Shipped work + phase history: **`docs/ROADMAP.md`**. Everything not done (production
checklist, features): **`docs/BACKLOG.md`**. Keep both updated when shipping.

## Monorepo (npm workspaces + turbo)

- `apps/server` — Express + Mongoose API on **:5000**. Routes in `src/routes/*` →
  controllers in `src/controllers/*`. Socket.io in `src/services/socket.service.ts`.
- `apps/web` — Next.js 14 app router on **:3001**. Route groups per role:
  `(owner)` `(cashier)` `(kitchen)` `(platform-admin)` `(auth)`, guest portal at
  `r/[slug]/table/[tableToken]`. Zustand stores in `src/stores/`.
- `packages/types` — shared TS types (`@waiterless/types`). No build step; consumed as source.

## Commands

```bash
npm run dev                # root: starts server + web via turbo
npm run seed               # apps/server: base data (2 restaurants, staff, menus, tables)
npm run seed:demo          # apps/server: 30 days of realistic history for golden-fork
npx tsc --noEmit           # run in apps/server AND apps/web before calling work done
npm test                   # root: Playwright suite (tests/api + tests/e2e) vs seeded dev stack
```

**Before any testing work, read `docs/TESTING.md` first** — it is the coverage map
(what's already automated, what was only verified manually, what's untested, and the
next-tests priority list). Don't re-test or re-write what's already covered; after
running or adding tests, update its matrices and "Last run" line.

Demo logins: `owner@goldenfork.com / Owner@1234` (also cashier@/kitchen@ with
Cashier@1234/Kitchen@1234, same for spicegarden.com, platform admin
`admin@waiterless.app / Admin@1234`).

## Architecture rules

- **Multi-tenancy**: every collection carries `restaurantId`. Staff routes chain
  `authenticate → require<Role> → injectRestaurantId → tenantStatusGuard`; guest routes
  use `authenticateGuest` (JWT carries sessionId+restaurantId, no DB user). Controllers
  must never trust a client-supplied restaurantId.
- **Auth**: short-lived access JWT (Bearer) + httpOnly `refreshToken` cookie.
  Roles: platform_admin, owner, cashier, kitchen (+ guest token type).
- **Sockets**: rooms `kitchen:{rid}`, `cashier:{rid}` (owner joins cashier),
  `table:{sessionId}`. Event names live in `SocketEvents` in `@waiterless/types`.
- **AI analyst**: `apps/server/src/services/ai.service.ts` — plain fetch to Gemini +
  Groq, strict-JSON prompt, failover to the other provider on quota/auth errors.
  Per-tenant keys stored AES-256-GCM-sealed (`utils/secretBox.ts`, `select: false`);
  API responses expose only `hasGeminiKey`/`hasGroqKey` booleans. Env fallback keys
  in `apps/server/.env`. 10 reports/day/tenant cap.
- **Branding/whitelabel**: tenant colors/logo drive the UI. Owner app reads
  `brandingStore` and sets `--primary`/`--brand` CSS vars in `(owner)/layout.tsx`
  (Button + charts pick them up). Guest portal is SSR-themed via public endpoint
  `GET /api/restaurant/public/:slug/branding`. Never hardcode the orange except as
  `var(--brand, #ea580c)` fallbacks.
- **Charts**: hand-rolled SVG in `apps/web/src/components/charts.tsx` — no chart libs.

## Gotchas (each of these has already burned an hour — don't re-learn them)

- Mongoose `aggregate()` does **not** cast string ids: always
  `new mongoose.Types.ObjectId(...)` in `$match` (see `ridOf()` in reports/ai controllers).
- `NEXT_PUBLIC_API_URL` must stay **`/api`** (relative). Next rewrites proxy it to :5000;
  an absolute URL breaks the SameSite refresh cookie and logs users out on reload.
  Server-side (SSR) fetches can't use it — they use `API_INTERNAL_URL` or localhost:5000.
- Date/hour aggregations must pass `timezone` (restaurant setting, default Asia/Kathmandu)
  or buckets shift by UTC+5:45.
- DB is a **shared free Atlas cluster borrowed from the HeloSarkar project** (db name
  `waiterless`). If `querySrv ENOTFOUND`, that cluster is the suspect.
- If `@waiterless/types` can't be resolved after moving the repo: stale workspace
  symlinks → re-run `npm install`.
- Env keys: Groq key works; the Gemini keys rotate through free-tier quota (429s are
  normal, provider failover handles it).

## Working conventions

- Verify in the browser (screenshot), not just typecheck — dashboards/charts especially.
- New tenant-scoped endpoints get a cross-tenant probe (fetch another tenant's id → 404).
- Money is integer NPR; format with `fmtMoney` from `components/charts.tsx`.
- Keep `docs/ROADMAP.md` phase log updated when shipping a feature.
- Not production-ready: no git history, no tests/CI, plaintext secrets, shared DB
  cluster, payments recorded but not processed. See roadmap backlog before promising
  production deployment.
