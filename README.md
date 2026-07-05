# Waiterless Restaurant Platform

Multi-tenant SaaS — QR-code-driven table ordering. Customers scan, order, track, and pay without a waiter.

## Credentials (after seed)

| Role | Email | Password |
|---|---|---|
| Platform Admin | admin@waiterless.app | Admin@1234 |
| Golden Fork — Owner | owner@goldenfork.com | Owner@1234 |
| Golden Fork — Cashier | cashier@goldenfork.com | Cashier@1234 |
| Golden Fork — Kitchen | kitchen@goldenfork.com | Kitchen@1234 |
| Spice Garden — Owner | owner@spicegarden.com | Owner@1234 |
| Spice Garden — Cashier | cashier@spicegarden.com | Cashier@1234 |
| Spice Garden — Kitchen | kitchen@spicegarden.com | Kitchen@1234 |

## Setup

```bash
# 1. Start MongoDB (local or Atlas)

# 2. Copy and fill env files
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.local.example apps/web/.env.local

# 3. Install all dependencies
npm install

# 4. Seed database
cd apps/server && npm run seed && cd ../..

# 5. Start everything
npm run dev
```

- Backend:  http://localhost:5000
- Frontend: http://localhost:3000
- Health:   http://localhost:5000/api/health

## Guest ordering flow

1. Log in as cashier → go to **Floor** → open a session on a table
2. Click **Show QR** on the table (or owner → Tables & QR)
3. Scan or open the QR URL in a browser
4. Browse menu → add to cart → place order
5. Kitchen sees the order on KDS → marks items preparing / ready / served
6. Cashier sees live order status → selects payment method → **Confirm Payment & End Session**
7. Owner sees revenue in Reports

## Portals by role

| Role | URL after login |
|---|---|
| Platform Admin | `/dashboard` (all restaurants) + `/restaurants` |
| Owner | `/dashboard`, `/menu`, `/tables`, `/staff`, `/branding`, `/reports` |
| Cashier | `/floor` |
| Kitchen | `/kds` |
| Guest | `/r/[slug]/table/[tableToken]` (from QR) |

## Tech stack

- **Backend**: Node.js · Express · MongoDB/Mongoose · JWT · Socket.io
- **Frontend**: Next.js 14 App Router · Zustand · Tailwind CSS
- **Multi-tenancy**: shared DB, `restaurantId` on every document, middleware-enforced
- **Payments**: cash / eSewa / Khalti / mobile banking — cashier selects + enters optional reference
- **Blocking**: platform admin flips `subscription.status` → all roles denied instantly

## Project structure

```
waiterless-restaurant/
├── apps/
│   ├── server/src/
│   │   ├── models/          Restaurant, User, Table, TableSession, MenuItem, Order, Bill
│   │   ├── controllers/     auth, platform, restaurant, menu, table, session, order, billing, reports, staff
│   │   ├── routes/          one file per domain
│   │   ├── middleware/       authenticate, authorize, tenantGuard, tenantStatusGuard, errorHandler
│   │   ├── services/        socket.service.ts
│   │   ├── utils/           jwt.ts, planLimits.ts
│   │   └── seed.ts
│   └── web/src/
│       ├── app/
│       │   ├── (auth)/login
│       │   ├── (platform-admin)/dashboard, restaurants
│       │   ├── (owner)/dashboard, menu, tables, staff, branding, reports
│       │   ├── (cashier)/floor
│       │   ├── (kitchen)/kds
│       │   └── r/[slug]/table/[tableToken]   ← guest portal
│       ├── stores/          authStore, cartStore
│       ├── lib/             api.ts, socket.ts
│       └── components/      AuthGuard, ui/Button, Input, Badge
└── packages/types/          shared TypeScript types
```
