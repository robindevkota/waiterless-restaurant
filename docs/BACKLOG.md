# Waiterless — Backlog

Single source of truth for what's NOT done. Shipped work moves to `ROADMAP.md`'s phase log.
Order within each stage = priority. `[ ]` pending · `[~]` in progress · `[x]` done.

---

## ⏭ NEXT SESSION — in this order
1. [ ] **Floors/zones for tables** (decided 2026-07-05, ~half session) 🏢
      - `zone` field on Table ("Ground floor", "First floor"…); labels stay
        **unique across the restaurant** (G1–G10, F1–F10 — never duplicate
        per-floor numbers: the label travels to KDS/TV/banners/receipts alone).
      - Tables & QR page: zone field + "generate G1–G10" bulk helper.
      - Floor + Payments pages: zone filter tabs (`All | Ground | First`),
        choice persisted per device (localStorage) — one cashier per floor.
        **"All" always shows the combined queue with counts** — filter
        attention, never visibility (break coverage must work).
      - Soft filter only; NO hard cashier→floor assignment or per-floor socket
        rooms until a 3+ floor customer asks.
      - KDS/TV/alert banners show `zone · label`; later: revenue-by-zone in
        reports/AI snapshot. Note: 20 tables = Pro plan (upsell story).
2. [ ] **Menu item photos** (Cloudinary installed, creds empty — or accept image
      URLs like the logo does; biggest perceived-value jump in the guest portal)
3. [ ] **Inventory ROI analytics** (last Royal Suites v2 piece) — COGS vs revenue
      per dish over time, waste cost from stocktake variances.
4. [ ] **Needs the user's accounts**: own Atlas cluster (migrate off the borrowed
      HeloSarkar one via mongodump/mongorestore) + fresh project-owned Groq/Gemini
      keys.
5. [ ] Or: remaining test gaps (auto-86 cycle is now top of TESTING.md list) / CI.

Done 2026-07-05 (late): static payment QR + "I've paid" signal, cashier dismiss,
Payments workspace (pending queue + paid history, side-by-side), live floor bill
(ROADMAP Phase 13) — suite grew to 41/41.

Done 2026-07-05 (see ROADMAP Phases 10–11): git init + initial commit, JWT secrets
rotated (+ SECRETBOX_KEY), test tenants deleted, smart upsell chips + dashboard
stat, tomorrow's prep list (owner tab + KDS drawer), stocktake with variance log,
Excel/CSV paste import.

---

## Stage 1 — Foundation (before any more features)
- [x] `git init` + `.gitignore` + initial commit (2026-07-05)
- [x] Rotate secrets: strong random `JWT_SECRET` / `JWT_REFRESH_SECRET` +
      `SECRETBOX_KEY` (2026-07-05). Still open: fresh project-owned Groq + Gemini
      keys (current ones are borrowed from NewWeb) — needs the user's accounts.
- [ ] Own MongoDB Atlas project + cluster with backups (currently borrowing the
      HeloSarkar cluster — see CLAUDE.md gotchas); migrate via mongodump/mongorestore
- [x] Delete test tenants: `test-bistro`, `himalayan-kitchen` (2026-07-05, via
      `apps/server/src/scripts/delete-tenant.ts <slug>`)

## Stage 2 — Correctness safety net
- [x] Test suite (2026-07-05): Playwright `tests/api` + `tests/e2e`, 33 tests —
      auth/roles, tenant isolation, guest order → inventory deduction → bill,
      upsell, inventory v1+v2, prep forecast, dashboard/portal/KDS UI.
      Coverage map + gaps: **`docs/TESTING.md`**.
- [ ] Remaining test gaps (priority list in TESTING.md): cashier session-close
      bill math, auto-86 cycle, socket e2e, signup, concurrent-order race
- [ ] GitHub Actions CI: `tsc --noEmit` (server + web) + `npm test` on every push
      (needs a seeded Mongo service or mongodb-memory-server adaptation)

## Stage 3 — Deployment
- [ ] Host: web → Vercel, API → Railway/Render (Socket.io needs a long-lived process),
      DB → Atlas
- [ ] Cookie/CORS across domains: either one parent domain (app. + api.) with cookie
      `domain`, or `sameSite:'none'; secure:true`; point the Next `/api` rewrite at the
      API's public URL. Budget an hour — classic trap.
- [ ] Production flags: `NODE_ENV=production`, `CLIENT_URL`, confirm helmet CSP doesn't
      break the guest portal
- [ ] Sentry (both apps) + uptime ping on `/api/health`

## Stage 4 — Business readiness (before charging money)
- [ ] **Payments (Nepal-reality plan, decided 2026-07-05)** — most clients only
      have a *static* merchant QR on a stand; confirmation is manual either way.
      So: NOT building checkout APIs now.
      - [x] v1 **Static QR on the bill screen** ✅ shipped 2026-07-05 (ROADMAP
            Phase 13) — Settings → Payments card, QR + amount on the guest bill.
      - [x] v1.5 **"I've paid" signal** ✅ shipped 2026-07-05 — advisory flag,
            cashier floor banner "claims paid — verify", settle stays cashier-only.
      - [ ] v2 **Dynamic QR adapter** — only when a client has merchant API
            access (FonePay dynamic / eSewa ePay / Khalti KPG). Per-tenant creds
            via the same AES-sealed settings pattern as AI keys.
- [ ] SMTP creds (or Resend/Brevo) so staff invite emails actually send
- [ ] Refresh-token revocation: server-side token store or tokenVersion per user
      (today a stolen refresh token stays valid 7 days)
- [ ] Owner subscription billing flow (manual invoicing OK for first customers;
      in-app upgrade later)
- [ ] Legal: ToS, privacy note that sales data is sent to Groq/Google during AI report
      generation, per-tenant data deletion story

## Next up (planned 2026-07-05)
- [x] **"Talk to your restaurant" — AI chat over sales data** ⭐ ✅ shipped
      2026-07-05 — see ROADMAP Phase 8.
- [x] **Smart upsell in guest portal** 💰 ✅ shipped 2026-07-05 — see ROADMAP
      Phase 10. Co-occurrence chips in cart + "Upsells earned" dashboard tile.
- [x] **Tomorrow's prep list** ✅ shipped 2026-07-05 — see ROADMAP Phase 11.
      Weekday forecast + shortfall shopping list; Inventory tab + KDS drawer.
- [x] **TV mode** ✅ shipped 2026-07-05 — see ROADMAP Phase 9.
- [x] **Rule-based inventory (port from Royal Suites — lighter v1)** ✅ shipped
      2026-07-05 — see ROADMAP Phase 7. v2 also shipped 2026-07-05 (Phase 11):
      Excel/CSV import + stocktake/variance. Only ROI analytics remains open.
      Original plan: (source:
      `Desktop/Projects/Hotel reservation/royal-suites` (spec: `inventory-feature-spec.md`;
      models `Ingredient/Recipe/StockLog`, `inventory.service.ts` — same stack, proven).
      Adaptations required: (1) add `restaurantId` + tenant middleware to every model/route;
      (2) recipes = ingredient lines attached to existing MenuItems (no parallel catalog,
      no manual Sell button) — deduct automatically on guest order; (3) **auto-86**: when
      servings-possible = 0, flip MenuItem `available=false`, restore on restock.
      v1 scope: ingredient CRUD + restock, recipe lines, auto-deduct, servings/bottleneck,
      low/out alerts, stock log, dashboard low-stock card. Defer to v2: Excel import,
      stocktake/variance, ROI analytics. Pure arithmetic — no AI cost.

## Feature backlog (post-launch)
- [ ] Scheduled weekly AI report emailed to owner (needs SMTP; cron or external scheduler)
- [ ] Menu item photos via Cloudinary (dependency already installed, creds empty)
- [ ] Guest order status push notifications / sound in kitchen display
- [ ] i18n — Nepali guest portal
- [ ] Platform-admin analytics across tenants (MRR, active restaurants)
- [ ] Data export (CSV) for reports tables

## Nice-to-have polish
- [ ] Empty/loading skeletons on dashboard cards
- [ ] Mobile layout pass on owner app (top-nav tabs scroll, but cards need audit)
- [x] Dark mode for owner app (2026-07-04 — cashier/kitchen/guest surfaces still light-only)
