# CART Module

**Purpose:** Hold a customer's in-progress selection of items prior to checkout.

**Responsibilities:** Get-or-create the caller's active cart per market, add/update/remove cart items, cart totals recalculation, cart-to-checkout handoff (future).

**Data ownership:** `carts`, `cart_items`.

**Main entities:**
- `Cart` (`userId`, `marketId`, `status`, `expiresAt?`) — one row per `(userId, marketId)`, enforced by `@@unique([userId, marketId])`.
- `CartItem` (`cartId`, `variantId`, `quantity`) — one row per `(cartId, variantId)`, enforced by `@@unique([cartId, variantId])`; adding an already-present variant increments its quantity rather than creating a second row.

**API boundary:** `/api/v1/cart[/items[/:itemId]]` — a flat top-level domain (unlike Pricing/Inventory, which nest under `/products`), matching the PRD's own `/api/v1/cart`, `/api/v1/cart/items` shape. Every route requires `?market=<code>` and resolves against the caller's own cart for that market — a cart is never addressed by its own id in the customer-facing API.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/cart?market=PK` | `authenticate` | Get-or-create the caller's active cart for this market (creates an empty one on first access). |
| POST | `/cart/items?market=PK` | `authenticate` | `{ variantId, quantity }` — increments if the variant is already in the cart. |
| PATCH | `/cart/items/:itemId?market=PK` | `authenticate` | `{ quantity }` — sets an absolute quantity (not additive). |
| DELETE | `/cart/items/:itemId?market=PK` | `authenticate` | 204; ownership-scoped (404 if the item isn't in the caller's cart for this market). |
| DELETE | `/cart?market=PK` | `authenticate` | Clears every item; keeps the cart row. Idempotent 204 if no cart exists yet. |

No `/admin` cart endpoints exist — undocumented, so none were built. No route accepts a cart id or another user's id; every operation resolves against `req.auth.userId`.

**Dependencies:** Catalog (variant/product existence, status, per-market `ProductMarket.isAvailable` — read via direct, read-only Prisma queries in `cart.repository.ts`, the same "own repository reads the shared tables directly" precedent Pricing/Inventory already established; no Catalog file modified), Pricing (`PricingRepository.findPrice` + `resolveEffectivePrice`, read-only import — no Pricing file modified), Inventory (`InventoryRepository.findByVariantAndMarket`, read-only import, availability/stock check only — **no reservation, no decrement**; no Inventory file modified), Markets (direct `markets` table read, same duplicated pattern as Pricing/Inventory), Customers/Identity (owner is `req.auth.userId` from `authenticate`).

## Market scoping and isolation

A cart belongs to exactly one market (`Cart.marketId`), enforced by `@@unique([userId, marketId])` — a customer with both a Pakistan and a UAE cart has two separate `Cart` rows, never one cart mixing both. Every cart item's price and stock are read from that same market; a `?market=` query parameter is required on every route (no session/cookie-based market persistence exists anywhere in this project yet, so the caller states it explicitly per request — the same explicit-market convention Catalog's own `?market=` product-list filter already uses). An unknown or deactivated market code 404s (`CATALOG_NOT_FOUND`), identical to Pricing/Inventory's rule.

## Catalog / Pricing / Inventory validation (add/update)

Adding or updating a cart item server-side verifies, in order:
1. The variant exists and is not soft-deleted (`CATALOG_NOT_FOUND` otherwise — reuses Catalog's own not-found code, the same "identical lookup failure" reasoning Pricing/Inventory already apply).
2. The variant's own status and its product's status are both `ACTIVE`, and the product has a `ProductMarket` row for this market with `isAvailable: true` (`CART_VARIANT_UNAVAILABLE` otherwise — a new code, since "exists but isn't purchasable" is a distinct business rule from "not found").
3. An active `VariantPrice` exists for this variant+market (`CART_PRICE_UNAVAILABLE` otherwise).
4. The requested total quantity (existing cart quantity + the increment, for `POST`; the absolute new value, for `PATCH`) does not exceed current `available` (`onHand - reserved`) stock for this variant+market (`CART_INSUFFICIENT_STOCK` otherwise).

None of these are cached on the cart row — they are re-checked on every mutating request, and price/availability are also re-derived on every **read** (see below). This is a check only, never a reservation: Cart does not call `/reserve` and never decrements `onHand`. Final, authoritative revalidation (including any reservation) is a future Checkout responsibility — see `docs/modules/INVENTORY.md`'s reservation-ownership note, which already named Cart/Checkout as the future caller of that primitive without specifying which one owns it; this phase deliberately leaves it to Checkout.

## Non-destructive staleness handling

Once an item is in the cart, later catalog/price/stock changes never silently delete it. Each read (`GET /cart`, and the refreshed cart returned by every mutation) re-derives, per item:
- `isAvailable` — false if the variant/product is no longer `ACTIVE`, the product is no longer market-available, or no active price exists.
- `isInStock` — false if current `available` stock is now below the item's quantity.
- `unitAmount`/`lineTotal` — `null` when `isAvailable` is false (never a stale/last-known price).

`subtotalAmount` only sums `lineTotal` for currently-available, currently-priced items. This lets a customer see and remove a now-invalid line before checkout rather than having it vanish or checkout silently on stale data — consistent with the PRD's "server must revalidate before order creation" rule, applied here as "never let the client see a stale price," not as a Checkout implementation.

## Never trust the client

Only `variantId` and `quantity` are ever read from a mutating request body. Any other field the client sends (a price, a currency, a product name) is ignored — the response always reflects the server-computed price. This is `cart.controller.ts` structurally only destructuring `{ variantId, quantity }` / `{ quantity }`, not a runtime filter.

## Concurrency

- **Concurrent cart creation** — `Cart.getOrCreateCart` tries an insert and, on a `(userId, marketId)` unique-constraint collision, falls back to reading the row the other request just created. Exactly the same shape as `PricingRepository.upsertPrice`'s try-create/catch-update fix (Phase 4G), applied here to "get or create" instead of "upsert."
- **Concurrent add of the same variant** — `CartRepository.addOrIncrementItem` tries an insert and, on a `(cartId, variantId)` unique-constraint collision, falls back to an atomic `UPDATE ... SET quantity = quantity + $delta` so neither concurrent request's quantity is lost.
- **Concurrent quantity updates (`PATCH`)** — last-write-wins on the single row; no additional guard, since this is a "set to this exact value" operation with no accumulation to protect (matching ordinary REST semantics, not a documented requirement for anything stronger).

## Ownership

Every route requires `authenticate` (never `optionalAuthenticate`) and resolves the cart from `req.auth.userId` — never from a client-supplied user id, and never from a cart id in the URL. `DELETE`/`PATCH .../items/:itemId` additionally scope the underlying query by `(id, cartId)` together, so ownership is enforced by the query shape itself, not merely a pre-check that could be raced or bypassed. The Customer role holds zero permissions (`docs/RBAC.md`) — Cart authorization is ownership-only, matching the project's documented model for customer-owned resources, and no `requirePermission` call appears anywhere in `cart.routes.ts`.

## Deferred / explicitly out of scope this phase

- **Guest carts.** The PRD's conceptual `Cart` schema marks `userId` nullable to support a guest cart. This project has **no anonymous/guest session identity mechanism anywhere in its Auth domain** (`docs/AUTH_SECURITY.md` — JWT access + refresh cookies are only issued to a registered account). Building one would be inventing authentication infrastructure outside Cart's scope, not implementing a documented Cart requirement. `Cart.userId` is therefore `NOT NULL` in this phase. **This is a recorded PRD/implementation discrepancy**, not a silent drop: this module's original "Future notes" already deferred "guest cart merge into customer cart on login" for the identical reason (no guest identity exists to merge from). Building guest-cart support is a future phase's job once (and if) an anonymous-session mechanism is designed.
- **`expiresAt`.** Present on the schema (PRD-documented field) but never populated or enforced — no TTL/expiry sweep logic exists, the same kind of deferral Inventory already made for `StockReservation` expiry (`docs/modules/INVENTORY.md`).
- **Cart abandonment processing, recently-viewed, and any cart-adjacent marketing feature** mentioned in the PRD's broader sections are explicitly Notifications/Analytics/CMS-phase concerns, not Cart's.

## Cart status transitions and reuse after conversion (Phase 4I update)

`CartStatus` (`ACTIVE`/`CONVERTED`/`ABANDONED`) was declared in Phase 4H but never set. **Phase 4I's Checkout domain now sets it**: a successful checkout transitions the customer's cart `ACTIVE → CONVERTED` and clears its items, atomically with order creation (see `docs/modules/CHECKOUT.md`). `ABANDONED` remains unset — still reserved for a future TTL sweep or Notifications-driven flow.

Phase 4H flagged a known limitation here: `@@unique([userId, marketId])` allows at most one `Cart` row ever per user+market, so once a cart converts there's no way to create a second row for that user's next shopping trip in the same market. **This is now resolved, without a schema change:** `CartRepository.getOrCreateCart` (the one Cart-module file Checkout's phase touched) reactivates a non-`ACTIVE` row in place — `status → ACTIVE` — instead of returning it as-is or erroring, the next time the customer accesses their cart in that market. Reactivation is safe because the row's items are already empty (Checkout clears them as part of conversion). A customer can shop again immediately after checkout, out of the same underlying `Cart` row.

**Still-open, explicitly recorded limitation:** because the constraint is a full unique index (not partial on `status = 'ACTIVE'`), there is still only ever one physical `Cart` row per user+market — no history of distinct converted carts is retained at the Cart level (Orders is where that history actually lives, via the `Order` rows themselves). If a future requirement needs multiple *concurrent* non-ACTIVE cart rows per user+market, the constraint would need to become a partial unique index — not needed by anything today.

**Security considerations:** Cart totals, prices, and availability are always recalculated server-side from current Pricing/Inventory/Catalog state on every read and mutation — never trusted from the client, never cached on the `CartItem` row. Cart never performs payment authorization, final inventory consumption, or order creation — see `docs/modules/CHECKOUT.md` (Phase 4I, complete) and `docs/modules/ORDERS.md` (`NOT STARTED`) for those boundaries.

**Current status:**
- **DATABASE FOUNDATION COMPLETE** (Phase 4H — new migration)
- **BUSINESS LOGIC, API, RBAC (ownership-only), TESTS, DOCUMENTATION COMPLETE** (Phase 4H; cart-conversion/reactivation behavior added by Checkout, Phase 4I)

**Future notes:** A future Orders phase (4J) builds `GET /orders`/`GET /orders/:id`/status-transition endpoints against the `Order` rows Checkout now creates. Guest-cart support remains explicitly deferred, see above.
