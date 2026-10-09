# CHECKOUT Module

**Purpose:** Convert a customer's active cart into a real, immutable `Order` — server-validated, transactionally, exactly once per idempotency key.

**Responsibilities:** Full re-validation of cart/catalog/price/inventory state at the moment of purchase, inventory reservation (never decrement), order/order-item/order-address creation, cart conversion.

**Data ownership:** `Order`, `OrderItem`, `OrderAddress`. **Checkout owns creation only** — the Orders domain (`docs/modules/ORDERS.md`, Phase 4J, COMPLETE) owns their read/management API (list, detail, status transitions, admin filtering) and the `OrderStatusHistory` audit trail. The checkout response itself remains the customer's immediate confirmation.

**API boundary:** `POST /api/v1/checkout?market=<code>` — a flat top-level domain (not nested under `/products`), matching Cart's own precedent and the PRD's literal `/api/v1/checkout`.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/checkout?market=PK` | `authenticate` + `requireVerifiedEmail` | Header `Idempotency-Key` required. Body: `{ shippingAddress, paymentMethod, shippingMethodId, couponCode? }`. `201` (new order) or `200` (idempotent replay). |

`GET /orders`, `GET /orders/:id`, and the admin order-management endpoints are now implemented — see `docs/modules/ORDERS.md` (Phase 4J). Checkout itself added no permission keys; its own authorization remains ownership-only (the order is always the caller's own, resolved from `req.auth.userId`), the same posture Cart already established and which `docs/RBAC.md` documents as the Customer role's model (zero permissions).

`requireVerifiedEmail` is used here for the first time — it is precisely `docs/RBAC.md`'s own already-documented intended use ("gates actions that need a confirmed email (order placement, review submission — not yet built)").

## PRD alignment

The PRD (`docs/SHILAJIT _PRD.md`) describes Checkout concretely in several places (§17, §11, §16, 2B.30, 2C.10, 2I.3/2I.4, the `CheckoutService` sketch at line ~8251) but leaves real gaps and one internal inconsistency. Every Checkout-relevant requirement was classified before implementation:

| Requirement | Status | Decision |
|---|---|---|
| Server revalidates price/inventory/availability, never trusts cart/client | **Implemented** | Full per-line re-check against current Catalog/Pricing/Inventory state, every request |
| Checkout produces an `Order` transactionally, inside the checkout request (PRD's own `CheckoutService.createOrder()`) | **Implemented** | See "Transaction boundaries" below |
| `Idempotency-Key` prevents duplicate order creation | **Implemented, simplified** | `Order.idempotencyKey` unique column, not the PRD's separate `IdempotencyKey(key, operation, userId, requestHash, response, expiresAt)` table — see "Idempotency" below |
| Inventory reservation during checkout (PRD explicitly says timing is "determined by the checkout/payment strategy") | **Implemented** | Checkout reserves, never decrements, via Inventory's existing `reserve`/`release` primitive |
| Cart status transition on conversion | **Implemented** | `CartStatus.CONVERTED` (declared but unused since Phase 4H) is now set |
| Cart reuse after conversion (Phase 4H's flagged `@@unique([userId, marketId])` limitation) | **Implemented** | `CartRepository.getOrCreateCart` reactivates a non-ACTIVE row in place — see `docs/modules/CART.md` |
| Guest checkout (PRD's only evidence: `Cart.userId` nullable "to support guest carts") | **Deferred** | The PRD's own concrete checkout endpoint spec (its API-doc-template example) requires `Auth: Required`. No anonymous/guest session mechanism exists anywhere in this project's Auth domain (re-confirmed this phase). Checkout is authenticated-only, matching Cart |
| Tax calculation (PRD's only hook: `MarketSettings.defaultTaxRate`) | **Deferred** | No such field exists on the current `Market` model; `docs/DATABASE.md` already defers a `MarketConfiguration` table. `taxAmount` is always `0` |
| Shipping cost calculation | **Reconciled, Phase 4M** | `shippingMethodId` (replacing the earlier informational-only `shippingMethod` string) is resolved against the new market-scoped `ShippingMethod` table; `shippingAmount` is computed server-side (`baseRate`, or `0` past `freeShippingThreshold`) and included in `totalAmount` — see `docs/modules/SHIPPING.md` |
| Coupon/promotion application | **Deferred, explicitly rejected** | No Promotions domain exists. A submitted `couponCode` returns `422 CHECKOUT_COUPON_UNSUPPORTED` — never silently dropped |
| Payment authorization / provider integration | **Implemented in Payments (Phase 4K)** | See `docs/modules/PAYMENTS.md`. Checkout's own role stays minimal: `paymentMethod` is validated against `"COD"` (always) plus `"MOCK"` (non-production only — Payments' own test infrastructure, not a real method), and Checkout's transaction now also creates a `Payment` row (`PENDING`) alongside the `Order`. Checkout still never handles a card/CVV or calls a provider directly — that's entirely Payments' responsibility |
| `shippingAddressId` (FK to a reusable address book) | **Deviation, documented** | No Customers/Address domain exists yet. Checkout accepts an **inline** `shippingAddress` object and snapshots it directly to `OrderAddress` — never a stored, reusable address |
| Order state machine (PENDING → ... → COMPLETED) | **Partial** | `OrderStatus` enum defined per the PRD's own state names for forward-compatibility; Checkout only ever produces `PENDING`. Transitions are Phase 4J |
| Inventory `onHand` decrement on confirmation | **Deferred from Checkout, implemented in Orders (Phase 4J)** | Checkout still only reserves; the decrement now happens on the `DELIVERED → COMPLETED` transition — see `docs/modules/ORDERS.md` |
| PRD's `Inventory.warehouseId` field (its Phase-2 architecture section describes `Inventory(id, warehouseId, variantId, quantity, reservedQuantity, ...)`, conflicting with the current `VariantStock(variantId, marketId)` — no warehouse entity) | **Flagged discrepancy, not acted on** | Out of scope for Checkout, which only consumes Inventory's existing, unmodified primitive. Recorded here for a future audit, same posture as Phase 4G-2's original "no warehouse entity" finding — this is new evidence that finding didn't have, and reopening it is a decision for whoever next touches Inventory, not this phase |

## Cart lifecycle: conversion and reuse

Checkout sets `Cart.status: ACTIVE → CONVERTED` and deletes the cart's `CartItem` rows, both inside the same transaction as order creation — a cart is never left half-converted. The Cart row itself is **not** deleted (financial/audit-adjacent context, and deleting it would orphan nothing useful to reclaim). Because `Cart` still has `@@unique([userId, marketId])` (unchanged from Phase 4H — no migration in this phase), a customer cannot get a second `Cart` row for the same market. Resolved via `CartRepository.getOrCreateCart` (the one Cart-module change this phase): a non-`ACTIVE` row found on next access is reactivated (`status → ACTIVE`) in place rather than erroring — its items are already empty, so this is just a status flip. A customer can shop again in the same market immediately after checkout out of the same underlying `Cart` row.

**Known, accepted limitation** (documented, not silently left): if a future requirement needs Cart history across multiple converted carts per user+market (not currently required anywhere), the schema would need to move from a full unique constraint to a partial one (`WHERE status = 'ACTIVE'`) — deferred until a real requirement exists.

## Server-side re-validation (never trusts Cart's prior checks)

Cart's own validation at add-to-cart time is never treated as a guarantee. For every cart line, at checkout time:
1. Variant exists (`CATALOG_NOT_FOUND` if not — reused, identical lookup failure Catalog/Pricing/Inventory/Cart already produce for the same case).
2. Variant and product are both `ACTIVE`, and the product is available (`ProductMarket.isAvailable`) in the checkout's market (`CART_VARIANT_UNAVAILABLE` if not — reused from Cart's own error family; this is the identical business rule Cart already checks, not a new one).
3. An active `VariantPrice` exists for this variant+market (`CART_PRICE_UNAVAILABLE` if not — reused).
4. Current available stock (`onHand - reserved`) covers the line's quantity — enforced by the reservation attempt itself (`CART_INSUFFICIENT_STOCK` if not — reused).

Only `shippingAddress`, `paymentMethod`, `shippingMethodId` and `couponCode` are ever read from the request body — no client-submitted price, subtotal, tax, discount, shipping cost, or total is read at all; totals (including `shippingAmount`, Phase 4M) are always the server's own computation.

## Transaction boundaries (two-phase, saga-style — not one giant transaction)

Inventory's `reserve`/`release` (Phase 4G) each open their **own** internal `$transaction` and were explicitly designed to be called standalone (`docs/modules/INVENTORY.md`: "a future Checkout service calls `POST .../reserve` with its own... reference... Inventory exposes the primitive; Checkout will own the policy") — they cannot be nested inside another Prisma transaction. Checkout therefore runs in two phases:

- **Phase A — reservation (outside any Checkout transaction).** For each line, resolve its `VariantStock.id` and call `InventoryRepository.reserve(stockId, quantity, reference)` where `reference = "checkout:" + idempotencyKey` (shared across every line of one checkout attempt — safe, since `(stockId, reference)` is unique and each line has a distinct `stockId`). If any line fails (`InsufficientStockError`), every line already reserved in this same attempt is released before the failure propagates as `409 CART_INSUFFICIENT_STOCK` — a failed checkout leaves no partial reservation behind.
- **Phase B — one Prisma `$transaction`.** A guarded, single-statement `UPDATE carts SET status = 'CONVERTED' WHERE id = $1 AND status = 'ACTIVE'` (the same "atomic conditional UPDATE, no row lock needed" pattern Inventory's own guarded updates use) — `0` rows means a concurrent request already converted this cart. Generate the order number (`nextval('order_number_seq')`, a hand-added Postgres sequence — Prisma has no way to express a formatted DB-generated default, the same "hand-edit migration SQL" precedent as Inventory's/Cart's `CHECK` constraints). Create `Order` + `OrderItem[]` + `OrderAddress`. Delete the cart's `CartItem` rows. Commit.

If Phase B's guarded update affects `0` rows, Checkout first re-checks whether an order already exists for this exact idempotency key (see below) before concluding the cart was lost to a genuinely different attempt — only in the latter case are Phase A's reservations released.

## Idempotency (simplified from the PRD's fuller model)

`Order.idempotencyKey` (`String @unique`) replaces the PRD's separate `IdempotencyKey` table. The only thing that must never happen twice is order creation itself (the PRD's own stated goal), and a unique column on the protected row is smaller and needs no cleanup job. Checkout checks for an existing order by this key **before** any validation or reservation work; if found, it verifies ownership and returns it (`200`, not `201`) as a replay. **Documented simplification:** no request-hash comparison — a retry with the same key but a different body silently returns the original order. No TTL/cleanup job (the unique constraint is safe indefinitely, just not self-pruning).

Two genuinely concurrent requests carrying the identical idempotency key share the same reservation `reference`, so neither can double-reserve (Inventory's reservation is idempotent per reference — see "A concurrency defect found and fixed" below). Only one can win Phase B's guarded cart update or the `Order.idempotencyKey` unique constraint; the loser is detected and returns the winner's order as a replay rather than releasing reservations that legitimately back it.

## A concurrency defect found and fixed (Inventory, one method)

Stress-testing Checkout's idempotent-retry path surfaced a genuine, pre-existing gap in `InventoryRepository.reserve()` (Phase 4G): two truly simultaneous calls for the identical `(stockId, reference)` could both pass the "does an ACTIVE reservation already exist" check before either committed — the loser then hit a raw unique-constraint error instead of the idempotent no-op the primitive was documented to provide. This was never caught before because Inventory's own concurrency tests always used **distinct** references per concurrent call (the oversell-prevention scenario); nothing had previously exercised two calls sharing one reference at the same instant, which is exactly what Checkout's idempotency contract introduces.

**Fix** (`inventory.repository.ts`, the one Inventory file touched this phase): the insert is now wrapped in a `SAVEPOINT`; on a unique-constraint collision, the transaction rolls back to that savepoint (required — Postgres aborts an entire transaction on any error until an explicit rollback, so a plain `try/catch` cannot simply continue with a compensating statement afterward) and the call's own guarded `reserved` increment is undone, leaving it the idempotent no-op it was always meant to be. No schema change; no behavior change for the already-tested distinct-reference path. Re-verified: Inventory's own full concurrency suite still green, plus 40 additional stress iterations of the newly-fixed shared-reference path with zero failures.

A second, related race was found and fixed in `checkout.service.ts` itself (not Inventory): `CartRepository.findCartWithItems` reads a cart's `status` and its `items` relation, which is not guaranteed to be one atomic round trip under this project's Prisma 7 + `@prisma/adapter-pg` transport. A concurrent checkout attempt converting and clearing the same cart in the gap between those two reads could produce `status: 'ACTIVE'` (read pre-commit) together with `items: []` (read post-commit) — a torn read. Checkout now re-checks the cart's status via a fresh, single-field read (`CheckoutRepository.findCartStatus`) before concluding a cart is genuinely empty, so this race now correctly surfaces as `409 CHECKOUT_CART_ALREADY_CONVERTED` instead of a misleading `422 CHECKOUT_CART_EMPTY`.

## Dependencies

Cart (source cart, read via `CartRepository`'s existing public methods — no new Cart file beyond the one reactivation fix), Catalog (variant/product/market-availability, read-only, via Cart's own established direct-table-read precedent), Pricing (`PricingRepository.findPrice` + `resolveEffectivePrice`, read-only), Inventory (`InventoryRepository.findByVariantAndMarket`/`reserve`/`release`), Markets (direct `markets` table read, same duplicated pattern as every other domain). Orders (Checkout remains the sole producer of `Order` rows; Orders, Phase 4J, owns their read/management API and status lifecycle — see `docs/modules/ORDERS.md`). Payments (Checkout creates the `Payment` row, Phase 4K — see `docs/modules/PAYMENTS.md`). Shipping (Checkout resolves `shippingMethodId`, computes `shippingAmount`, and creates the `Shipment` row, Phase 4M — see `docs/modules/SHIPPING.md`). Promotions — not integrated; see the table above.

**Security considerations:** No client-submitted price/total/tax/discount/shipping cost is ever read. Order/cart ownership is always resolved from `req.auth.userId`. `requireVerifiedEmail` blocks unverified customers from placing an order. No card number, CVV, or payment credential is ever accepted or stored (COD only, this phase).

**Current status:**
- **DATABASE FOUNDATION COMPLETE** (Phase 4I — new migration: `orders`, `order_items`, `order_addresses`, `order_number_seq`)
- **BUSINESS LOGIC, API, TESTS, DOCUMENTATION COMPLETE** (Phase 4I) — ownership-only authorization (no new permission keys)
- **Phase 4M update:** `shippingMethodId` replaces the earlier informational-only `shippingMethod` string; `shippingAmount`/`totalAmount` now reflect a real computed shipping cost; a `Shipment` row is created alongside `Payment` inside the same transaction. This is a breaking change to the checkout request contract (`shippingMethod` → `shippingMethodId`, now required) — see `docs/modules/SHIPPING.md` for the full rationale.

**Future notes:** Orders (Phase 4J, COMPLETE) built `GET /orders`, `GET /orders/:id`, admin status-transition endpoints, and wired `orders:read`/`orders:update`/`orders:cancel` (`orders:refund` remains unused — no Payments/Returns domain exists yet). Payments (Phase 4K, hardened 4L) added real provider integration and payment confirmation. Shipping (Phase 4M) added real rate calculation. A future Promotions phase defines real coupon validation — Checkout's current `couponCode` rejection is the placeholder to replace, not a design to preserve.
