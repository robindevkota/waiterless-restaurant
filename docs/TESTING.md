# Testing — coverage map & how to run

**Single source of truth for what is tested vs what still needs testing.**
Update the "Last run" line and the matrices whenever the suite or coverage changes.

## Last run

| Date | Command | Result |
|------|---------|--------|
| 2026-07-05 (late) | `npm test` | **38 / 38 passed** (31 api + 7 e2e, ~46s) |
| 2026-07-05 | `npm test` | 33 / 33 passed (27 api + 6 e2e, ~33s) |

## How to run

```bash
# prereqs (once): seeded dev DB
cd apps/server && npm run seed && npm run seed:demo && npm run seed:inventory

# from repo root — starts the dev stack itself if :3001 isn't already up
npm test              # everything
npm run test:api      # request-level API tests only (fast, no browser)
npm run test:e2e      # headless Chromium UI tests only
npm run test:report   # open the HTML report of the last run
```

- Config: `playwright.config.ts` (root). Tests live in `tests/api/*` and `tests/e2e/*`,
  shared login/QR helpers in `tests/helpers.ts`.
- Runs against the **live seeded dev DB** — one worker, deterministic order. The suite
  creates throwaway data (a `__test_ingredient_*`, one 1×-Momo order per run) and cleans
  up what it can; seeded ratios are never modified.
- Failure artifacts (screenshots, traces, `last-run.json`) land in `test-results/`
  (gitignored). Durable results belong in this file.

## ✅ Automated coverage (38 tests)

| Area | Spec | What's asserted |
|------|------|-----------------|
| Login & token safety | `tests/api/auth.spec.ts` | Owner login shape; wrong password 401; no `passwordHash`/API-key material in any auth or settings response |
| Role guards | `tests/api/auth.spec.ts` | Kitchen blocked from owner inventory (403) but allowed on `/inventory/prep`; cashier blocked from AI reports; unauthenticated 401 |
| Tenant isolation | `tests/api/tenancy.spec.ts` | Foreign-tenant ingredient restock/stocktake, recipe write, availability toggle all → **404**; report data differs per tenant |
| Guest order flow 💰 | `tests/api/guest-flow.spec.ts` | QR → guest JWT → menu (unavailable items hidden from guests only) → order → **keema stock −0.2 kg** → running bill ≥ item price; unknown item 422; guest token rejected on staff endpoints |
| Smart upsell | `tests/api/guest-flow.spec.ts` | Suggestions non-empty from seeded co-occurrence, ≤3, never the cart item itself, pairCount ≥ 2; empty cart → empty |
| Inventory v1+v2 | `tests/api/inventory.spec.ts` | Ingredient CRUD, invalid unit 400, restock, stocktake variance (+ negative count 400), stock-log entries, CSV import (upsert + row-level errors), soft delete |
| Prep forecast | `tests/api/inventory.spec.ts` | Date/weekday shape, plates > 0 from seeded history, daysSeen ≤ window, shortfalls ≥ 0 |
| Payments (static QR + paid claim) | `tests/api/payments.spec.ts` | Settings roundtrip + public branding exposure, garbage URL 400, guest claim flags the session (amount ≥ 0) **without touching bill status**, claim idempotent, guests cannot close sessions |
| Guest bill payment UI | `tests/e2e/payments.spec.ts` | QR + "Pay from your table" render on the bill; "I've paid" → "Cashier notified" |
| Owner dashboard | `tests/e2e/owner.spec.ts` | UI login; KPI tiles incl. "Upsells earned"; revenue trend not zeros (ObjectId-cast regression guard); floor card |
| Inventory page | `tests/e2e/owner.spec.ts` | All four tabs render real data (dishes, ingredients, tomorrow's prep + shopping list, stock log) |
| Branding page | `tests/e2e/owner.spec.ts` | Guest portal preview renders |
| Guest portal UI | `tests/e2e/guest-portal.spec.ts` | Themed portal by QR token; add-to-cart; **upsell chips appear and clicking one adds the item** |
| KDS | `tests/e2e/kds.spec.ts` | Kitchen login lands on `/kds`; tomorrow's-prep drawer opens with plate counts |

## 🖐 Verified manually only (works, but no automated guard)

| Area | Last verified | Notes for automating |
|------|--------------|----------------------|
| AI report generation (Groq live call) | 2026-07-05 | Costs quota — automate with a mocked provider, not live |
| AI analyst chat | 2026-07-05 | Same; verified it cites live inventory |
| Auto-86 full cycle (order → dish hidden → restock → auto-restored) | 2026-07-05 | Deduction is automated; the flip/restore cycle isn't — good next test |
| Socket real-time (waiter call banner, KDS new-order push, bill updates, `payment:claimed` push) | 2026-07-05 | Needs two contexts in one e2e test |
| Cashier floor paid-claim banner + "Verify & settle" | 2026-07-05 | Banner render verified visually (derives from session state); button click → side panel not automated |
| TV mode (`/tv`) incl. cursor wake/exit button | 2026-07-05 | Simple e2e: login → /tv → panels render |
| Report PDF download (print flow) | 2026-07-04 | Hard to assert; low priority |
| Dark/light theme toggle | 2026-07-04 | Assert `dark` class + a token color |
| Branding save → live CSS vars + guest portal SSR theme | 2026-07-04 | e2e: change color, assert `--primary` |
| Signup → empty dashboard | 2026-07-03 | Creates tenants — needs cleanup step (use `scripts/delete-tenant.ts`) |
| Cashier floor: session open/close, bill settle, attend | 2026-07-03 | **Biggest gap — it's the money-collection path** |
| Platform admin: list/block restaurants | 2026-04-11 | Oldest verification — re-verify when touched |

## ❌ Not tested at all (and mostly not implemented)

- Payment capture (eSewa/Khalti) — recorded only, no processing exists
- Staff invite emails (SMTP creds empty)
- Refresh-token expiry/rotation edge cases; auth rate-limiter thresholds
- Plan limits enforcement
- Load/concurrency (parallel orders racing on the same ingredient — the rollback
  path in `deductForOrder` has never been exercised)

## Next tests to add (priority order)

1. Cashier flow API: open session → orders → close session → bill totals + VAT math
2. Auto-86 cycle: drain an ingredient → dish 404s for guests → restock → back
3. Socket e2e: waiter call appears on a second (cashier) page
4. Signup happy path + tenant cleanup
5. Concurrency: two parallel orders for the last serving — exactly one succeeds

---
*History: `docs/test-status.md` (manual matrix from 2026-04-11) was superseded by
this file when the automated suite landed on 2026-07-05.*
