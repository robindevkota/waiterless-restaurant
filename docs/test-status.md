# Waiterless Restaurant — Manual Test Status

Last updated: 2026-04-11 (session 2)

---

## Areas Covered in Session 2026-04-11

### 1. Authentication & Role Routing
| Test | Result |
|------|--------|
| Owner login → redirects to `/dashboard` | PASS |
| Platform admin login → redirects to `/admin` (no route conflict) | PASS |
| Cashier login → redirects to `/floor` | PASS |
| Kitchen login → redirects to `/kds` | PASS |
| Page refresh (hydrate via refresh token cookie) → stays on correct page | PASS |
| Auth rate limiter resets on server restart | PASS |

### 2. Platform Admin Portal (`/admin`, `/restaurants`)
| Test | Result |
|------|--------|
| `/admin` dashboard loads both seeded restaurants | PASS |
| Restaurant rows show plan (Basic / Pro) and status (active) | PASS |
| `/restaurants` page shows owner name, email, plan, status, Block button | PASS |
| Navigating between Dashboard and Restaurants via sidebar | PASS |

### 3. Owner Portal
| Test | Result |
|------|--------|
| `/dashboard` — revenue and session stats render | PASS |
| `/menu` — 13 items listed across 4 categories (Starters, Mains, Desserts, Drinks) | PASS |
| `/tables` — 5 tables shown with Show QR and Delete buttons | PASS |

### 4. Cashier Floor (`/floor`)
| Test | Result |
|------|--------|
| Table grid loads 5 tables, all available on fresh seed | PASS |
| Clicking a table opens side panel with "Open Session" | PASS |
| Opening a session changes table badge to "occupied" with open time | PASS |
| Side panel shows Orders, Bill (subtotal/VAT/total), payment method dropdown | PASS |
| Payment method dropdown includes Cash, eSewa, Khalti, Mobile Banking, Split | PASS |
| "Confirm Payment & End Session" button visible when session is open | PASS |

### 5. Kitchen Display (`/kds`)
| Test | Result |
|------|--------|
| Dark-theme KDS loads with "Active Orders (0)" on fresh state | PASS |
| Refresh button present | PASS |

### 6. Guest Portal (`/r/[slug]/table/[tableToken]`)
| Test | Result |
|------|--------|
| QR URL authenticates guest and loads menu | PASS |
| Category tabs render (Starters, Mains, Desserts, Drinks) | PASS |
| Menu items show name, description, tags (spicy/vegan), price | PASS |
| `+` button adds item to cart; cart count increments | PASS |
| Cart view shows items, qty controls, cart total, VAT note | PASS |
| "Place Order" submits order and switches to Orders tab | PASS |
| Orders tab shows placed items with "Pending" status | PASS |
| Cart resets to 0 after order placed | PASS |
| QR scan from real phone → guest portal loads | PASS |

---

## Known Issues / Deferred
| Issue | Notes |
|-------|-------|
| Playwright `browser_click` fires before React hydration | Workaround: use `browser_evaluate` to click; not a production bug |
| `currentSessionId` comes back as populated object from API | Fixed — floor page now extracts `._id` via helper |
| Guest token blocked on `/menu` routes | Fixed — added `authenticateAny` middleware |
| Auth rate limiter (20/15min) too low for dev testing | Fixed — raised to 100k/15min in development |
| No logout button on cashier/kitchen/platform-admin layouts | Fixed — added Sign out button to all three layouts |
| QR codes scan to `localhost` URL — unreachable from phone | Fixed — see Mobile Testing section below |

---

---

## Mobile / Phone Testing

### Setup required to test QR scanning from a phone
Three things must be configured before QR codes work on a real device:

**1. `apps/server/.env` — set `CLIENT_URL` to your PC's LAN IP**
```
CLIENT_URL=http://<YOUR_PC_IP>:3001
```
This is what gets baked into the QR code image. If it says `localhost`, the phone can't reach it.

**2. `apps/web/.env.local` — point the frontend at the same LAN IP for API calls**
```
NEXT_PUBLIC_API_URL=http://<YOUR_PC_IP>:5000/api
```

**3. `apps/server/src/app.ts` — add the LAN IP to CORS `allowedOrigins`**
```ts
'http://<YOUR_PC_IP>:3001',
```

**4. Restart both servers** after any `.env` change (nodemon does NOT pick up `.env` changes automatically).

**5. Windows Firewall** — run once to allow phone through:
```
netsh advfirewall firewall add rule name="Waiterless Dev" dir=in action=allow protocol=TCP localport=3001,5000
```

**6. After restart** — go to Owner → Tables & QR → Show QR to get a **fresh QR image** with the correct IP baked in. Old QR images cached in the browser still show `localhost`.

### What was tested on phone (2026-04-11)
| Test | Result |
|------|--------|
| Guest portal loads via QR scan on mobile browser | PASS |
| Menu items visible on phone | PASS |

---

## Not Yet Tested
| Area | Notes |
|------|-------|
| Kitchen item status updates (pending → preparing → ready → served) | Needs active order in KDS |
| Cashier sees live orders after guest places order (socket) | Needs full E2E session |
| Payment confirmation & session close updates table to available | Needs order first |
| Platform admin block restaurant → all roles denied instantly | Edge case |
| Owner branding page saves changes | Not tested |
| Owner staff page invite / suspend / remove | Not tested |
| Owner reports page date range | Not tested |
| Split payment reference field | Not tested |
| Guest portal "session closed" screen after cashier ends session | Not tested |
| Spice Garden restaurant (second tenant) isolation | Not tested |
