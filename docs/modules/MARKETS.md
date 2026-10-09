# MARKETS Module

**Purpose:** Give the storefront and admin a real, backend-driven view of the two commercial markets (Pakistan, UAE) this business operates in, and let a `super_admin` enable/disable a market. Not a market-creation tool (the business operates exactly two fixed markets today) and not a currency/tax/business-config editor.

**Responsibilities:** Public read of active markets (backs the storefront switcher), admin read of all markets including inactive ones, and an admin toggle for `Market.isActive`.

**Main entities:** `Market` (`id, code, name, currencyCode, currencyMinorUnits, timezone, isActive`) — already existed as the FK target of `ProductMarket`/`VariantPrice`/`VariantStock` before this phase; this module is the first thing to expose it through its own API.

## Phase 6K — why this module exists now

Phase 6K was a PRD-gap audit (see `docs/CURRENT_TASK.md` for the full classification table). It found the Markets domain at 0% backend implementation despite being provisioned everywhere else:

- `markets:read`/`markets:update` permissions were already seeded (`backend/prisma/seed.ts`) and granted to `super_admin`, unused.
- The frontend's `PERMISSIONS` constant already defined `marketsRead`/`marketsUpdate`, unused.
- The frontend's market switcher (`MarketContext`/`MarketSwitcher`, Phase 6A) worked entirely off a hardcoded `MARKETS` constant — `Market.isActive` (already checked by Catalog's product-market association, Phase 4E-2) had **zero effect on the storefront switcher**. An admin could deactivate a market via direct DB access and the switcher would keep offering it.

This is the exact "provisioned-but-unwired primitive" pattern Phase 6J closed for Users — not invented scope. It directly serves the PRD's repeated "Critical Market Architecture Requirement" (independent per-market configuration) and MVP Acceptance Criterion #1 ("Customers can select Pakistan or UAE").

## API boundary

| Method | Path | Auth | Permission | Notes |
|---|---|---|---|---|
| GET | `/markets` | none (public) | — | Active markets only: `id`, `code`, `name`, `currencyCode`, `currencyMinorUnits`. |
| GET | `/admin/markets` | `authenticate` | `markets:read` | All markets, including inactive, plus `isActive`/`timezone`/timestamps. |
| PATCH | `/admin/markets/:id` | `authenticate` | `markets:update` | Body `{ isActive: boolean }` — the only editable field. |

## Response shape (allowlisted)

Public: `{ id, code, name, currencyCode, currencyMinorUnits }`.

Admin: public fields + `{ timezone, isActive, createdAt, updatedAt }`.

## Deliberately not built this phase

- **Create/delete a market** — the business operates exactly two fixed markets (PK, AE); a third market is a real business/legal/payment-integration decision, not a casual admin action, and nothing in the current PRD or codebase calls for one today.
- **Editing `code`/`currencyCode`/`currencyMinorUnits`/`timezone`** — these are foreign-key/formatting-critical fields referenced by `ProductMarket`/`VariantPrice`/`VariantStock`/`ShippingMethod`; changing them casually through a UI risks silently corrupting pricing/stock/shipping data for every product. Only `isActive` is exposed as an admin toggle.
- **IP/geolocation-based market auto-detection** — `frontend/src/lib/market.ts`'s `resolveGeoMarket()` remains a deliberate no-op stub (documented there since Phase 6A). Adding real geo-detection means a new third-party dependency with no justification today; the existing cookie-based manual switcher already satisfies the PRD's actual acceptance criterion ("customers can select Pakistan or UAE"). PRD §6.2 frames auto-detection as a nice-to-have "defaults from," not a hard requirement.

## Frontend wiring

`app/layout.tsx` fetches `GET /markets` once per request and filters the existing hardcoded `MARKET_OPTIONS` (label text unchanged, e.g. "Pakistan (PKR)") down to the codes the backend actually returns, before passing the result into `MarketProvider` as `marketOptions`. `MarketSwitcher` now reads `marketOptions` from `useMarket()` instead of importing the static constant directly. If the fetch fails, the layout falls back to the full hardcoded option list (never a silently empty switcher) — the same "no fabricated/missing data" policy already applied to Catalog/Orders.

`MarketCode`/`isValidMarketCode` (`lib/constants/market.ts`) are unchanged — still exactly `"PK" | "AE"` — since this phase doesn't add market creation. The hardcoded `MARKETS` constant remains the build-time TypeScript type source and the resilience fallback.

`/admin/markets` (new) — `super_admin`-only list (via `markets:read`), one row per market with a Deactivate/Activate action gated on `markets:update`, reusing the existing `AdminTable`/`AdminConfirmDialog`/`Badge` components (no design-system deviation).

## Audit logging

`UPDATE_MARKET_STATUS` recorded via the existing `recordAudit()` helper on every toggle, with `before`/`after` `{ isActive }`.

## Reused existing infrastructure

`Market` Prisma model (unchanged, no migration), `markets:read`/`markets:update` permissions (already seeded), `PERMISSIONS.marketsRead`/`marketsUpdate` (already defined frontend-side), `requireAdminPermission`/`hasPermission`, `recordAudit`, `AdminTable`/`AdminConfirmDialog`/`AdminPageHeader`/`Badge`.

## Dependencies

None new. Catalog/Pricing/Inventory already depend on `Market` via foreign keys; this module only adds a read/toggle API on top of the existing table.

## Explicit out of scope

See "Deliberately not built this phase" above. Also: shipping-zone configuration per market (`ShippingZone` was already deferred in Phase 4M as an orphan PRD table with no wiring), tax configuration (no tax feature exists anywhere in this codebase), and payment-method-per-market configuration (Payments' provider list is not market-scoped today).

**Security considerations:** the public endpoint returns only non-sensitive display fields; the admin endpoints are permission-gated server-side. `isActive` is the only input the PATCH endpoint accepts (`z.object({ isActive: z.boolean() })`), so no other field can be reached through this route regardless of what a client sends.

**Current status:** **COMPLETE for this phase's scope** (Phase 6K) — 3 endpoints (1 public, 2 admin), real market list wired into the storefront switcher, `/admin/markets` frontend, audit logging, integration tests covering auth/permission/public-vs-admin visibility/toggle/validation/404.
