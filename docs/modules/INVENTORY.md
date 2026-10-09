# INVENTORY Module

**Purpose:** Track stock levels and availability per variant, per market.

**Responsibilities:** On-hand/reserved stock per variant per market, an auditable movement trail for every on-hand change, a generic (owner-agnostic) reservation primitive, and a public availability state.

**Data ownership:** `variant_stocks` (keyed by variant + market), `stock_movements`, `stock_reservations`.

**Main entities:** `VariantStock`, `StockMovement`, `StockReservation`.

## Inventory boundary

Stock is scoped by **`(variantId, marketId)`** — never a separate warehouse/branch/location entity. `INVENTORY.md`'s original placeholder text mentioned "market/location if applicable," but no location/warehouse entity exists anywhere in this project's schema or documentation; `Market` is the only location-like boundary VIZAURA has ever defined, and Pricing already scopes `VariantPrice` identically. Inventing a warehouse model here would have been the "generic e-commerce architecture" the Phase 4G brief explicitly prohibited.

### Market vs. Warehouse — re-audited and confirmed (Phase 4G-2)

Phase 4G-2 was asked to re-verify this boundary against "the original PRD," which was described as explicitly defining `Warehouse`, `Inventory` and `InventoryMovement` as entities distinct from Markets. **A repository-wide, case-insensitive search for "Warehouse" and "InventoryMovement" across every doc, the Prisma schema, the backend source tree, and the root README found no such PRD anywhere in this project.** The only matches are this project's own Phase 4G text stating the opposite — that no warehouse/location entity exists. `docs/PROJECT_CONTEXT.md`'s "Major Domains" list and `docs/DATABASE.md`'s domain-ownership table both name `Markets` and `Inventory` as separate domains but never a `Warehouse` domain. Confirmed directly with the project owner: no such PRD exists to supply; `docs/` is authoritative.

Audited against what *is* actually documented:
- **Market** = a business-configuration boundary (currency, pricing, product availability/visibility, and later shipping/tax/payment config) — explicitly "not a tenant... not a physical location" (`docs/modules/MARKETS.md`).
- **Warehouse / inventory location** = undefined; not a requirement anywhere, now or as documented future scope.
- **Stock ownership boundary** = `VariantStock(variantId, marketId)` — variants are already "the unit of sale" (`docs/modules/CATALOG.md`), and this is the identical shape Pricing already shipped for `VariantPrice`.
- **Multiple physical locations per variant?** Not documented as a requirement. The current model supports multiple *markets* per variant, the only multiplicity this project's docs establish (tested: PK and AE stock coexist for one variant).
- **Would adding Warehouse now block a future redesign?** No — `VariantStock` could gain a nullable `warehouseId` or a join table later without breaking today's contract, if a real requirement ever appears. Building it now, against no requirement, would itself have been the unjustified architecture this and the original Phase 4G brief both warn against.

**Conclusion: the market-scoped design is correct as built. No schema change.** This section exists so a future phase doesn't need to redo this search without new evidence — if a real warehouse requirement is ever documented, it changes this conclusion; nothing has changed it so far.

## Quantity semantics

- **`onHand`** — physical stock count for a variant in a market.
- **`reserved`** — quantity held by `ACTIVE` `StockReservation` rows, maintained as a running total on `VariantStock`, kept consistent with the reservation table only by the same transaction that changes either (the same "denormalized total defended by atomicity" pattern Catalog used for `isDefault`/`isPrimary`).
- **`available`** = `onHand - reserved`, **derived, never persisted** — trivially computable, so storing it would only risk drift.
- **Negative inventory is prohibited.** Enforced at both layers: the service layer via atomic guarded `UPDATE`s (below), and the database layer via `CHECK` constraints on `variant_stocks` (`onHand >= 0`, `0 <= reserved <= onHand`) — hand-added to the migration SQL (Prisma has no native `CHECK` syntax), the same "simple DB constraint is worth it" judgment call `docs/DATABASE.md` already documents for other invariants.
- **Low-stock thresholds are not implemented — explicitly, not ambiguously.** Re-confirmed in Phase 4G-2: no threshold, alert, or low-stock concept is mentioned anywhere in `docs/modules/INVENTORY.md`'s original text or any other project doc (and no PRD exists that defines one — see "Market vs. Warehouse" above). A threshold field would have been invented, not derived from a requirement.
  - **Why deferred:** undocumented — nothing in this project specifies a threshold value, a per-variant vs. per-market scope for it, or an alerting channel.
  - **Which future phase owns it:** Notifications (`docs/modules/NOTIFICATIONS.md`, currently `NOT STARTED`) — the natural owner of "alert someone when X," not Inventory.
  - **What Inventory exposes today for that future feature:** the admin stock read (`GET .../stock[/:marketCode]`, `inventory:read`) already returns `available` per variant per market. A future low-stock feature computes its own threshold and compares it against this existing field — **no Inventory schema or API change is needed** to build it.

## Movement model

Every change to `onHand` is recorded in `StockMovement` in the **same transaction** as the change — a stock row can never end up in a state its audit trail doesn't explain. Two types only, both grounded directly in the original module doc's own wording:
- **`RECEIPT`** — a restock (`POST .../stock/:marketCode/receive`), always a positive quantity.
- **`ADJUSTMENT`** — a signed correction (`POST .../stock/:marketCode/adjust`), **reason required**. This is also how a stock *decrease* happens, including the Orders-driven decrement on order completion (Phase 4J, `docs/modules/ORDERS.md`) — Orders calls `InventoryRepository.adjust()` directly rather than through this HTTP route; no new movement type was introduced for it. **Phase 4N:** Returns reuses the exact same call for the opposite direction — a positive `adjust(+quantity, reason: "return:<returnId>")` restocks merchandise on receipt, the same "call the primitive directly, no new movement type" precedent — see `docs/modules/RETURNS.md`'s "Inventory boundary."

No `TRANSFER`/`WASTE`/`PURCHASE`/`SALE`/`RETURN` movement types — none are documented anywhere in this project (despite the PRD naming a bare "Return" inventory-movement label with no policy detail); a waste write-off, and now a Returns restock, are both simply an `ADJUSTMENT` with a descriptive reason.

## Reservation model

`StockReservation` is a **generic, owner-agnostic primitive**: the caller supplies an opaque `reference` string (a future Cart/Checkout/Order id) and a quantity. `(stockId, reference)` is unique, so reserving twice under the same reference is idempotent (no double-reservation), and releasing an unknown/already-released reference is idempotent too (204 no-op).

**Concurrency fix (Phase 4I):** two genuinely simultaneous `reserve()` calls for the identical `(stockId, reference)` could both pass the "does an ACTIVE reservation already exist" check before either committed, and the loser then hit a raw unique-constraint error instead of the documented idempotent no-op. This was never exercised by Inventory's own Phase 4G concurrency tests, which always used **distinct** references per concurrent call (the oversell-prevention scenario) — nothing previously tested two calls sharing one reference at the same instant, which is exactly what Checkout's idempotency contract (`docs/modules/CHECKOUT.md`) introduces. Fixed with a `SAVEPOINT` around the insert attempt: on a unique-constraint collision, the transaction rolls back to that savepoint (required, since Postgres aborts an entire transaction on any error until an explicit rollback) and the call's own guarded `reserved` increment is undone, leaving it the no-op it was always meant to be. No schema change; the already-tested distinct-reference path is unaffected (re-verified: full Inventory concurrency suite still green, plus 40 stress iterations of the newly-fixed path with zero failures).

**Deliberately not implemented:** reservation expiry/TTL, and any concept of a reservation "owner" beyond the opaque reference. Both require session/cart semantics that only a future Checkout phase actually defines — inventing them here would have been exactly the kind of unrequested design the phase brief warned against. **Integration boundary:** a future Checkout service calls `POST .../reserve` with its own cart/session-derived reference when the customer proceeds to checkout, and `POST .../release` (or lets the reservation persist through to a future explicit-consume operation, not yet designed) if the checkout is abandoned. Inventory exposes the primitive; Checkout will own the policy.

## Concurrency strategy

Every invariant here is single-row (unlike Catalog's multi-row default-variant/primary-media invariants, which needed a parent-row lock). Each stock-changing operation is a single **atomic conditional `UPDATE`**, guarded in its `WHERE` clause and run inside the same transaction as its movement/reservation row, via a parameterized `tx.$queryRaw`/`tx.$executeRaw` (never `...Unsafe`):

```sql
-- adjust: guarded against going below 0 or below reserved
UPDATE variant_stocks SET "onHand" = "onHand" + $delta, "updatedAt" = now()
WHERE id = $1 AND "onHand" + $delta >= "reserved" AND "onHand" + $delta >= 0;

-- reserve: guarded against exceeding available
UPDATE variant_stocks SET "reserved" = "reserved" + $qty, "updatedAt" = now()
WHERE id = $1 AND "onHand" - "reserved" >= $qty;
```

A 0-row result means the guard failed → `409 INVENTORY_INSUFFICIENT_STOCK`. This needs no explicit row lock (`SELECT ... FOR UPDATE`) — a single guarded `UPDATE` is atomic under Postgres MVCC on its own, with no lock-wait/deadlock surface. Verified under real concurrent load: two simultaneous reservations (or adjustments) for more than the available stock combined — exactly one succeeds, the other gets `INVENTORY_INSUFFICIENT_STOCK`, and the resulting row is always valid (`tests/integration/inventory.test.ts`, "Concurrency" suite).

## Permissions

Reuses the already-seeded `inventory:read`/`inventory:update` permissions (`backend/prisma/seed.ts`) — no new permission keys. Already granted to `admin`, `store_manager`, `inventory_manager` (full), and `product_manager`/`order_manager` (`inventory:read` only).

## API boundary

`/api/v1/products/:productId/variants/:variantId/stock[...]` — nested like Pricing's `/prices`, in its own `inventory.routes.ts` mounted at the same `/products` base path (`routes/index.ts`), so no Catalog or Pricing file needed editing.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/stock` | `inventory:update` | Create/setup — `{ marketCode, onHand? = 0 }`. 409 `INVENTORY_ALREADY_EXISTS` if a stock row already exists for that variant+market — the only "creation" case; use `/receive`/`/adjust` for every later change, so no on-hand mutation ever bypasses the audit trail. |
| GET | `/stock` | – (`inventory:read` widens) | List across markets. Public: `{ marketCode, status }[]`. Admin: full rows incl. `onHand`/`reserved`/`available`. |
| GET | `/stock/:marketCode` | – (`inventory:read` widens) | Same split, one market. |
| POST | `/stock/:marketCode/receive` | `inventory:update` | `{ quantity: positive int, reason?: string }` → `RECEIPT`. |
| POST | `/stock/:marketCode/adjust` | `inventory:update` | `{ delta: nonzero int, reason: string (required) }` → `ADJUSTMENT`; 409 if it would violate the non-negative/below-reserved invariant. |
| POST | `/stock/:marketCode/reserve` | `inventory:update` | `{ quantity: positive int, reference: string }`; idempotent per reference; 409 `INVENTORY_INSUFFICIENT_STOCK` if unavailable. |
| POST | `/stock/:marketCode/release` | `inventory:update` | `{ reference: string }`; idempotent no-op if nothing active for that reference. |

Visibility (product must be `ACTIVE` unless the caller holds `products:read`) mirrors Pricing's identical rule.

## Public vs admin visibility

Public reads return only `{ marketCode, status: "IN_STOCK" | "OUT_OF_STOCK" }` — never raw `onHand`/`reserved`, movement history, adjustment reasons, or reservation references. Admin (`inventory:read`) sees the full row.

**Pricing/Catalog non-duplication:** Inventory never reads `VariantPrice`, computes money, or calls `PricingService` — it answers "how much stock exists," not "what does it cost." Variant/product existence and lifecycle visibility are read via Catalog's existing `VariantsRepository`/`ProductsRepository` (read-only import, no Catalog file modified). Re-verified in Phase 4G-2: `grep` confirms zero Inventory imports from the `pricing` module, and an integration test now asserts no Inventory response shape (public or admin) ever carries a price/currency field. Inventory's only Catalog touchpoints (`findVariantByProductAndId`, `findById`) are read-only lookups, never a `create`/`update` — so Inventory cannot trigger Catalog's dormant `isUniqueConstraintViolation` P2002-shape issue (see `docs/modules/PRICING.md` and `docs/CURRENT_TASK.md` for that issue's origin); confirmed by code inspection, not just by absence of a failing test.

**Dependencies:** Catalog (variant identity, lifecycle visibility), Markets (the scoping boundary), Checkout (reservation on checkout, Phase 4I), Orders (release on cancellation, release + decrement on completion via the existing `adjust()` primitive, Phase 4J), Returns (restock on receipt via the same `adjust()` primitive, Phase 4N — no new Inventory API).

**Security considerations:** Stock counts are never trusted from a client; every quantity-changing operation is server-side, atomic, and RBAC-gated (`inventory:update`).

**Current status:**
- **DATABASE FOUNDATION COMPLETE** (Phase 4G — new migration, see `docs/DATABASE.md`)
- **BUSINESS LOGIC, API, RBAC, TESTS COMPLETE** (Phase 4G)
- **ARCHITECTURE AUDITED AND CONFIRMED** (Phase 4G-2) — market-scoped boundary re-verified against actual project documentation (no PRD defining a warehouse model exists); no schema change; hardening only (documentation, 2 additional tests, Pricing/Catalog dormant-issue re-verification). **Note:** the PRD supplied for Phase 4H/4I does describe a `warehouseId` field in its own conceptual `Inventory` entity — new evidence this audit didn't have. Flagged in `docs/modules/CHECKOUT.md`'s PRD-alignment table as an open discrepancy, not acted on since no current phase requires it.
- **CONCURRENCY FIX** (Phase 4I) — `reserve()`'s shared-reference race fixed (see "Reservation model" above); no schema change, no API change, no behavior change to the already-tested distinct-reference path.

**Future notes:** A future Checkout phase defines reservation ownership/expiry policy and calls `/reserve`/`/release` — **done, Phase 4I** (`docs/modules/CHECKOUT.md`): Checkout reserves per line at checkout time, keyed by an idempotency-key-derived reference, and releases on failure; it does not decrement `onHand`. A future Orders phase defines the actual decrement-on-confirmation operation — **done, Phase 4J** (`docs/modules/ORDERS.md`): the `DELIVERED → COMPLETED` transition releases the reservation and decrements `onHand` via the existing `adjust()` primitive (reusing `ADJUSTMENT`, no new movement type or Inventory API). A future Notifications phase can compute its own low-stock threshold against `available` without any Inventory schema change.
