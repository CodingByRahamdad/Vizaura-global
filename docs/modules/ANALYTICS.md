# ANALYTICS Module

**Purpose:** Back the admin dashboard (`/admin/dashboard`) with real, aggregated figures. Nothing more — this is not a general-purpose analytics/reporting system.

**Responsibilities:** One read-only aggregation endpoint, built entirely from `groupBy`/`aggregate`/`count` Prisma queries (plus one parameterized raw SQL day-bucketing query, since Prisma has no groupBy-by-date-truncation) — never a full-table load into application memory.

**Main entities:** None owned here — every query reads `Order`, `OrderItem`, `VariantStock`, `User`/`Role`/`UserRole`, `Product`, and `Return`, all owned by their respective modules (Orders, Inventory, RBAC, Catalog, Returns).

## API boundary

| Method | Path | Auth | Permission | Query params |
|---|---|---|---|---|
| GET | `/api/v1/admin/analytics/dashboard` | `authenticate` | `requirePermission("analytics:read")` | `days` (optional, 1-90, default 30) |

`analytics:read` was seeded (Phase 4H's RBAC work) but had no backend route behind it until this phase — the same "seeded but unwired" pattern `orders:refund` was in before Payments/Returns wired their own refund permissions. Only `super_admin` holds it (the seed's `allPermissions: true` expansion); `customer` holds nothing.

## Response shape (allowlisted, no sensitive fields)

```
{
  days: number,
  markets: [{
    marketCode, currencyCode,
    revenue, orderCount, averageOrderValue,
    revenueTrendPct: number | null,   // null when the previous period had 0 orders — never a fabricated percentage
    salesOverTime: [{ day, revenue }],
    topProducts: [{ productId, productName, quantitySold, revenue }],
  }],
  orderStatusBreakdown: [{ status, count }],
  lowStock: [{ variantId, productName, sku, marketCode, onHand }],
  totalReturnedItems: number,   // sum of ReturnItem.quantity across RECEIVED/REFUNDED returns
  productCount: number,
  customerCount: number,
  recentCustomers: [{ id, name, email, orderCount, createdAt }],
}
```

No password hashes, tokens, refresh-session data, or payment provider secrets are anywhere near this response — it never touches those tables.

## Money / currency — the non-negotiable rule

**Revenue, order count, and average order value are always scoped to ONE market's own stored currency.** `markets` is an array, one entry per active market (`PK`/`PKR`, `AE`/`AED`) — there is no combined/global revenue field anywhere in this response, and there never will be without an explicit, PRD-approved FX/reporting strategy (none exists today — confirmed by grepping the whole repo for `exchangeRate`/`fxRate`: zero matches).

The frontend (`MarketScopedSection.tsx`) reflects this directly: it's a local tab toggle over the `markets` array already returned in one request, never a second request per market and never a client-side sum of two currencies. `MarketSplitPanel.tsx`'s "market performance" comparison bar uses each market's **order-count share** (currency-agnostic), not a revenue percentage-of-a-combined-total, for the same reason.

## Known gaps (documented, not silently faked)

- **No "conversion rate" metric.** The reference design (`design-references/Dashboard.png`) includes one, but it needs visit/session/traffic data, and no such analytics exists anywhere in this codebase (no page-view tracking, no session funnel). The dashboard's 6th KPI card is **Pending Returns** instead (`Return.status IN (REQUESTED, APPROVED)`) — real, already queryable, operationally useful.
- **No revenue trend for a market with zero orders in the previous window.** `revenueTrendPct` is `null` in that case, rendered as "—", never a divide-by-zero or a fabricated percentage.
- **Quick Actions only link to routes that exist today** (Add Product, Orders, Inventory, Categories). The reference's "Create Order" (no admin order-creation flow exists), "Manage Coupons"/"Add Customer"/"View Reports" (Promotions/Customers/Reporting are all `NOT STARTED`) are not built as dead or fake buttons.
- **The promo banner is purely decorative** — its CTA is disabled/"coming later" styling, matching the nav's own existing placeholder convention, since Promotions is `NOT STARTED`.

## Reused existing infrastructure

`RbacRepository`'s role-by-key lookup pattern (mirrored for the customer-role join in `customerCount()`/`recentCustomers()`), `OrderItem`'s immutable `productName` snapshot (top-products avoids a join/N+1 and stays correct for since-deleted products), the same "guarded raw SQL, no string-interpolated input" convention already used in `inventory.repository.ts`/`payments.repository.ts` for the one day-bucketing query, `successResponse`/`errorResponse`, `requirePermission` middleware, `validate` middleware + zod.

## Dependencies

Orders (revenue/order-count/status-breakdown/top-products source), Inventory (low-stock source), RBAC (customer-role join, `analytics:read` permission), Catalog (product count), Returns (pending-returns count). No writes — this module never mutates anything.

## Explicit out of scope

- Any metric requiring traffic/session/visit data (conversion rate, funnel analysis, bounce rate).
- Cross-currency combined totals of any kind.
- Historical data beyond a 90-day window (`days` is capped there — keeps every query cheap and bounded).
- A general analytics/reporting suite, export functionality, or scheduled reports.

## Super_admin bootstrap (dev/ops, not part of the analytics endpoint itself)

To exercise this endpoint (or any admin page) in a fresh dev database, run `npm run db:seed` (creates the `super_admin` role) then `npm run db:seed:admin` (`backend/prisma/seed-admin.ts`) with `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD` set — a separate, dev/ops-only script, never wired into `db:seed`/`db:migrate:deploy`/any install hook, so it cannot affect `tests/integration/seed-guard.test.ts`'s production-seed invariant (`expect(await prisma.user.count()).toBe(0)`). It refuses to run in `NODE_ENV=production` unless `SEED_ALLOW_ADMIN_BOOTSTRAP=true` is set explicitly, mirroring `src/config/env.ts`'s own fail-closed production-safety pattern. It never hardcodes a password, never logs one, and uses the existing `hashPassword()`/`validatePasswordPolicy()` (Argon2id) — no bespoke hashing. It assigns the existing, already-seeded `super_admin` role by key; it creates no new role. Safe to re-run (upserts).

**Current status:** **COMPLETE for this phase's scope** (Phase 6I) — one endpoint, one integration test file (auth/permission/empty-data/invalid-param/no-combined-currency assertions), the real admin dashboard consuming it, and the dev bootstrap script. Verified end-to-end against the real dev database and running backend (see `docs/CURRENT_TASK.md`) — actual seeded demo data and prior phases' leftover test orders produced correctly-shaped, correctly-scoped (never combined) figures.
