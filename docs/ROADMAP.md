# Waiterless — SaaS Roadmap

> Vision: a QR-first, waiterless restaurant OS. **Selling point: every restaurant gets an
> AI business analyst** — plain-language reports that tell owners what to fix, what to
> promote, and where money is leaking. Built for solo owners, not data teams.

Status legend: `[ ]` pending · `[~]` in progress · `[x]` done & verified

---

## Phase 1 — SaaS front door ✅ (2026-07-03)
- [x] `POST /api/auth/signup` — self-serve: owner + restaurant (unique slug from name),
      14-day trial, auto-login. Validates email/password/restaurant name.
- [x] Marketing landing page at `/` — hero with product mock, how-it-works, features
      grid, AI-analyst spotlight, NPR pricing, CTAs. Auth-aware header.
- [x] `/signup` page — verified in browser: signup → lands in own empty dashboard.

## Phase 2 — Modern dashboard ✅ (2026-07-03)
- [x] `GET /api/reports/overview` — one call: KPIs + deltas, 30-day series (zero-filled),
      top items, peak hours (restaurant-timezone), payment mix, tables, guest rating.
- [x] KPI stat tiles with WoW deltas + 14-day sparklines; 30-day revenue area chart
      with hover tooltip; top-items bars; peak-hours columns; payment-mix stacked bar
      (validated categorical palette); tables meter + guest rating. Hand-rolled SVG.
- [x] **Bug fixed**: all report aggregations matched `restaurantId` as a string —
      `aggregate()` doesn't cast to ObjectId, so every report returned zeros. Also
      fixed UTC hour buckets → restaurant timezone.
- [x] `seed:demo` script: 30 days of realistic history (278 sessions, ~NPR 910K,
      lunch/dinner peaks, weighted item popularity, upward trend).

## Phase 3 — AI Business Analyst ⭐ ✅ (2026-07-03)
- [x] `ai.service.ts`: Gemini (`gemini-2.0-flash`) + Groq (`llama-3.3-70b-versatile`)
      via plain fetch; JSON-mode; per-restaurant keys → env fallback; automatic
      failover to the other provider on quota/auth errors. Default provider: groq.
- [x] Snapshot aggregator: weekly trend, daily revenue, full menu item stats,
      peak hours, payment mix, session duration/guests, cancellation rate,
      guest ratings + recent comments.
- [x] `AiReport` model + `POST/GET /api/ai/reports[/:id]`, 10 reports/day cap.
- [x] Strict-JSON prompt → health score/label, executive summary, 4-6 insights,
      menu engineering quadrants, 3-5 actions with impact + effort, forecast.
- [x] Report UI: health dial, insight cards, quadrant grid, action list, forecast
      band, history sidebar. Verified with real Groq generations (~3s).
- [x] Settings page: general + provider picker + write-only masked keys
      (**AES-256-GCM encrypted at rest**, only `hasKey` booleans ever returned).

## Phase 4 — Guest experience ✅ (2026-07-03)
- [x] Waiter call: guest button (60s client debounce) → `POST /sessions/my/call-waiter`
      → table `needs_attention` + one-shot socket alert to floor → cashier "On it"
      acknowledges via `POST /sessions/:id/attend`. Verified live in two tabs.
- [x] Feedback: rating stars + comment on session-closed screen →
      `POST /sessions/my/feedback` (1-5 int + ≤500 chars) → stored on session,
      shown on dashboard, fed into AI snapshot. Verified end-to-end.
- [x] Fixed socket CORS (dev reflects any origin; prod pinned to CLIENT_URL).

## Phase 5 — Hardening ✅ (2026-07-03)
- [x] `tsc --noEmit` clean on server and web.
- [x] Security probes passed: no key material in any API response (flags only);
      cross-tenant AI report fetch → 404; tenant report lists isolated; cashier on
      owner-only endpoints → 403; waiter-call socket spam suppressed server-side;
      signup covered by auth rate limiter; settings inputs validated.
- [x] **Fixed session-auth bug**: `NEXT_PUBLIC_API_URL` pointed at the LAN IP while
      the app was served from localhost → cross-site fetch dropped the SameSite=Lax
      refresh cookie → every full page load logged users out. Now `/api` (relative,
      proxied by the Next rewrite) so cookies are always first-party.

---

## Phase 6 — Whitelabel branding + modern shell ✅ (2026-07-04)
- [x] Public `GET /api/restaurant/public/:slug/branding` (no auth, 404 when blocked).
- [x] Guest portal actually themed: SSR fetch by slug → CSS vars, logo + restaurant
      name + tagline in header, favicon + page title. (The old code had a stub that
      never fetched anything.)
- [x] Owner app is brand-aware: `brandingStore` + `--primary`/`--brand` CSS vars on
      the layout root — every Button, chart, sparkline, meter and active-nav accent
      picks up the tenant's primary color. Branding editor syncs the app chrome
      live on save.
- [x] Sidebar removed → modern sticky top navbar (logo/monogram, name + tagline,
      horizontal tabs with brand underline, user chip, sign out).
- [x] Dashboard beautified: greeting header with date, softer cards (shadow-sm),
      brand-colored charts.
- [x] Branding page: Logo URL + Favicon URL fields, logo in live preview.

## Phase 7 — 2026 dashboard + dark mode ✅ (2026-07-04)
- [x] Theme system: `themeStore` (persisted, respects `prefers-color-scheme`),
      Tailwind `darkMode: 'class'`, sun/moon toggle in the owner nav.
- [x] Dashboard redesign: hero "Today's revenue" figure with brand radial glow,
      icon KPI tiles (inline SVG icons, tinted squircles, delta pills), revenue
      chart + live floor/rating side stack, AI analyst teaser card showing the
      latest health score and next action.
- [x] Charts theme-aware: light/dark ink tokens + dark categorical palette steps
      (from the validated reference palette).
- [x] Dark variants across all owner pages + shared UI (Button/Input/Badge/
      Pagination); branding page's guest-portal preview intentionally stays light.

## Phase 7 — Rule-based inventory ✅ (2026-07-05)
Ported (lighter v1) from the Royal Suites spec; pure arithmetic, no AI.
- [x] Models: `Ingredient` (tenant-scoped, unit/stock/costPrice/threshold),
      `StockLog` (restock/sale/adjustment/seed), recipe lines + `autoUnavailable`
      flag on `MenuItem`.
- [x] `inventory.service.ts`: servings = floor(stock ÷ qtyPerServing) with
      bottleneck ingredient; order placement pre-checks stock (guest-friendly 409
      naming the dish), deducts with atomic per-ingredient guards + rollback, logs
      every movement. **Auto-86**: servings 0 → item hidden from guest menu;
      restock → auto-restored (manual owner toggles never overridden).
- [x] API `/api/inventory/*`: overview, ingredient CRUD + restock, recipe editor
      per menu item, paginated logs. Owner-only, tenant-guarded (cross-tenant → 404,
      verified).
- [x] UI: Inventory page (Dishes/Ingredients/Stock log tabs, count chips, modals
      for ingredient/restock/recipe), nav entry, dashboard low-stock alert banner.
- [x] Guest menu now hides unavailable items (staff still see everything).
- [x] `npm run seed:inventory`: Nepali market ratios + prices for golden-fork
      (23 ingredients, 13 recipes — e.g. momo = 0.2kg keema + 0.15kg maida) and
      spice-garden (18 ingredients, 10 recipes), with demo LOW/OUT scenarios.
- [x] AI snapshot now includes inventory (low/out ingredients, auto-86'd dishes,
      lowest-serving dishes) — verified: generated report flagged the out-of-stock
      gulab jamun mix on its own.
- Verified end-to-end: order → keema 8→7.6kg, mutton curry auto-86'd mid-order →
  hidden from guest menu → restock +3kg → auto-restored → visible again.

## Phase 8 — "Talk to your restaurant" AI chat ✅ (2026-07-05)
- [x] `chatWithAnalyst` in `ai.service.ts`: plain-text Q&A grounded in the live
      business snapshot (sales + inventory), Groq/Gemini with failover, answers
      capped at 400 tokens, "answer only from the snapshot" system prompt.
- [x] `POST /api/ai/chat`: owner-only, history bounded to last 10 messages,
      1000-char message limit, 60 msgs/day/tenant cap (in-memory; Redis for prod).
- [x] `AnalystChat` component on the AI Analyst page: suggestion chips, brand
      bubbles, typing dots, error rollback (question restored to input on failure).
- Verified in browser: asked about momo stock + weekend restocking — answer cited
  live inventory (soda water low, gulab jamun mix out, 4 lime sodas left).

## Phase 9 — TV mode ✅ (2026-07-05)
- [x] `/tv` full-screen wall dashboard (owner login): always-dark, huge type,
      cursor hidden, live clock. Panels: today's revenue + guest rating, floor
      occupancy meter with open-table list, kitchen queue with order ages.
      Polls every 20s; waiter calls flash a full-width red banner live via
      socket (auto-clears after 3 min). Verified in browser with live orders.

## Backlog
Moved to **`BACKLOG.md`** (single source of truth for pending work, including the
production-readiness checklist). This file keeps only shipped phases + decisions.

## Decisions log
- **2026-07-03** AI providers: Gemini + Groq only (free tiers), REST via fetch — no SDK
  lock-in, keys per-tenant later, env fallback now.
- **2026-07-03** Charts: hand-rolled SVG over a chart library — dashboard stays light,
  full design control, no bundle cost.
- **2026-07-03** AI keys stored on `Restaurant.settings.ai` with `select: false`;
  API never echoes keys back; UI shows masked placeholder only.
