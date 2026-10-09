# ORDERS Module

**Purpose:** Give customers and staff a safe way to read and progress the `Order` rows Checkout already creates — retrieval, listing, and a real, auditable status lifecycle.

**Responsibilities:** Order retrieval (own, or any order for staff with `orders:read`), order listing with filters/pagination, order status transitions with permission-per-transition enforcement, an append-only status-transition audit trail, and the inventory side effects (release on cancellation, decrement on completion) that a transition implies.

**Data ownership:** `OrderStatusHistory` (new this phase). `Order`, `OrderItem`, `OrderAddress` remain **owned by Checkout** (creation only) — Orders reads and transitions them but does not create them. This corrects this doc's own previous stub text, which implied Orders owned `Order`/`OrderItem` outright; `docs/modules/CHECKOUT.md` and `prisma/schema.prisma`'s own header comment are the authority on that boundary.

**Main entities:** `Order`, `OrderItem`, `OrderAddress` (read-only from here), `OrderStatusHistory` (owned here).

**API boundary:**

| Method | Path | Auth | Ownership/Permission | Filters |
|---|---|---|---|---|
| GET | `/api/v1/orders` | `authenticate` | forced to the caller's own `userId`, no override | `status`, `dateFrom`, `dateTo` (on `placedAt`) + pagination |
| GET | `/api/v1/orders/:id` | `authenticate` | `RbacService.authorizeOwnerOrPermission(orders:read)`; a failed check is `404`, never `403` | — |
| GET | `/api/v1/admin/orders` | `authenticate` + `requirePermission("orders:read")` | route-level | `status`, `paymentStatus`, `shipmentStatus`, `market`, `dateFrom`, `dateTo`, `customer` (a `userId`), `orderNumber` (exact), `search` (order #/customer email/name substring) + pagination |
| GET | `/api/v1/admin/orders/:id` | `authenticate` + `requirePermission("orders:read")` | route-level, re-checked in `OrdersService.getAdminOrderById` (Phase 6F; no longer shares `getOrderById` with the customer route — staff shape adds customer/payments/shipment/returns) | — |
| PATCH | `/api/v1/admin/orders/:id/status` | `authenticate` + `requireAnyPermission(["orders:update","orders:cancel"])` | fine-grained per-transition in the service (see below) | body: `{ status, reason? }` |

`/api/v1/admin/orders` is the **first** use of a dedicated `/admin` URL prefix in this codebase — Pricing/Inventory instead gate admin-only routes inline on the same router as public ones (`/products/...`, `requirePermission` per-route). This phase deliberately matches the PRD's literal endpoint spec (`docs/SHILAJIT _PRD.md` §2C.11) instead of that precedent, since the PRD names `/api/v1/admin/orders` explicitly. Both `GET .../:id` routes call one shared `OrdersService.getOrderById` rather than duplicating the ownership-or-permission logic.

The PRD's filter list also includes `market` and (for the customer route) no `customer` filter, matching the table above. **Phase 6F:** `shipmentStatus` is now a real, server-enforced admin filter (the column exists since Phase 4M), and `search` was added for the admin UI.

## Admin Orders UI (Phase 6F)

`/admin/orders` (list) and `/admin/orders/[id]` (detail + status actions), gated by `orders:read` before any fetch; status buttons are gated per transition on `orders:update` / `orders:cancel`. The backend was extended additively: staff-only mappers (`toAdminOrderSummary`/`toAdminOrderDetail`) and `OrdersRepository.findAdminDetailById`; the customer views/endpoints are untouched. Status changes still go through `OrdersService.updateStatus` (guarded UPDATE + `OrderStatusHistory`); the `UPDATE_ORDER_STATUS` audit entry now also records `before: { status }`. The frontend keeps a **display-only** copy of the transition table (`ORDER_NEXT_TRANSITIONS`) to choose which buttons to render; the backend re-validates everything.

Known limitations: `customer` shown is the live `User` record (no identity snapshot on `Order`); no index on `placedAt`/`paymentStatus` (no migration this phase); `search` is a substring scan on order number/email/name; the audit write and inventory side effects remain separate commits from the status change (existing behavior — see `docs/modules/PAYMENTS.md`/`RETURNS.md` for the equivalent trade-off on their own admin mutations).

**Phase 6H:** the previously-read-only Payment, Shipment, and Returns sections of `/admin/orders/[id]` now render operational controls — `PaymentActions`, `ShipmentActions`, `ReturnActions` (`frontend/src/components/admin/orders/`) — wired against the admin payment/shipment/return endpoints those modules already exposed (`docs/modules/PAYMENTS.md`, `SHIPPING.md`, `RETURNS.md`). No backend code changed: no new endpoints, permissions, or schema. New frontend-only files: `lib/api/admin/{payments,shipments,returns}.ts`, plus display-only `SHIPMENT_NEXT_TRANSITIONS`/error-message dictionaries added to `lib/types/admin-orders.ts` alongside the existing `ORDER_NEXT_TRANSITIONS`. Each component follows `OrderStatusActions`'s established pattern exactly (confirm dialog, `isSubmitting`, `router.refresh()` on success or on a 409/422 conflict).

## Status transition state machine

| From | To | Required permission | Inventory side effect |
|---|---|---|---|
| PENDING | CONFIRMED | `orders:update` | none |
| PENDING | CANCELLED | `orders:cancel` | release reservation |
| CONFIRMED | PROCESSING | `orders:update` | none |
| CONFIRMED | CANCELLED | `orders:cancel` | release reservation |
| PROCESSING | SHIPPED | `orders:update` | none |
| PROCESSING | CANCELLED | `orders:cancel` | release reservation |
| SHIPPED | DELIVERED | `orders:update` | none |
| DELIVERED | COMPLETED | `orders:update` | release reservation + decrement `onHand` |

Not buildable this phase, deliberately: `SHIPPED → CANCELLED` (goods have already left; a returns-flow concern, not built), `DELIVERED → CANCELLED` (the PRD requires a return/refund flow instead of a direct cancellation past delivery — no Returns domain exists), any transition touching `FAILED`/`REFUNDED`/`RETURNED` (payment/returns-domain-driven, never a PATCH target this phase — excluded from the request schema entirely, not merely rejected), and any transition out of a terminal state (`COMPLETED`, `CANCELLED`, `FAILED`, `REFUNDED`, `RETURNED`). Any `(from, to)` pair outside the table returns `422 ORDERS_INVALID_STATUS_TRANSITION`, or `422 ORDERS_TERMINAL_STATE` specifically when leaving a terminal state.

`Order.status`, `Order.paymentStatus`, and (as of Phase 4M) `Order.shipmentStatus` remain three independent fields, per the PRD's own recommendation (§54, illustrated with all three fields co-occurring independently: `status = PROCESSING, paymentStatus = PAID, shipmentStatus = PREPARING`) — Orders only ever transitions `status`. **Phase 4K update:** `paymentStatus` is no longer read-only — it is now written exclusively by the Payments module, via `OrdersService.updatePaymentStatus` (an internal, intentionally unpermissioned passthrough — the permission check happens in Payments before this is ever called). Orders' own `transitionStatus` never touches `paymentStatus`, and Payments never touches `status`; a payment failure deliberately does not auto-cancel an order (see `docs/modules/PAYMENTS.md`'s "Failure/retry behavior" section) — staff still make that call explicitly via this module's own `PATCH .../status` endpoint. **Phase 4L correction:** Payments' `mark-paid`/`mark-failed` staff actions now read `Order.status` (via `OrdersRepository.findById`, read-only) to reject when the order is terminal, closing a gap where a COD payment left `PENDING` on a since-cancelled order could still be marked paid — see `docs/modules/PAYMENTS.md`'s Payment lifecycle section. This is a read-only check; Orders' own `transitionStatus` remains the sole writer of `status`. **Phase 4M:** `shipmentStatus` (a new column — unlike `paymentStatus`, it was never pre-declared on `Order`) is written exclusively by the Shipping module via the exact same shape, `OrdersService.updateShipmentStatus`; Shipping never advances `Order.status` and applies the identical terminal-order-rejection guard Payments established in Phase 4L before writing. See `docs/modules/SHIPPING.md`.

### Concurrency and the inventory-decrement ordering decision

Every transition runs through `OrdersRepository.transitionStatus`: one `$transaction` containing a guarded, single-statement `UPDATE orders SET status = $new WHERE id = $id AND status = $currentlyExpected` (the same "atomic conditional UPDATE, no row lock" pattern Checkout's own cart-conversion guard and Inventory's guarded updates use), followed by the `OrderStatusHistory` insert. `0` rows updated means a concurrent request already moved this order — the caller gets `409 ORDERS_STATUS_CONFLICT` ("refetch and retry"); no inventory side effect has run yet at that point, so nothing needs compensating.

The DB-guarded step deliberately runs **before** any inventory call, and only the winner ever calls Inventory. This matters specifically for the `onHand` decrement on `COMPLETED`: `InventoryRepository.release()` (used on cancellation) is idempotent per `(stockId, reference)`, but `InventoryRepository.adjust()` (used for the decrement) is **not** — it has no reference/dedup guard, confirmed by reading the actual repository code. Settling who "wins" the transition first, then gating the non-idempotent `adjust()` call on being that winner, guarantees it is called exactly once. **Accepted trade-off:** a crash between the status commit and the `adjust()` call leaves a small window where the order reads `COMPLETED` but stock hasn't yet decremented — judged strictly better than a double decrement, and the same class of trade-off Checkout's own two-phase saga already accepts (see `docs/modules/CHECKOUT.md`).

Order items whose `variantId` is `null` (the source catalog row was deleted since checkout) are skipped during the inventory side effect — there is no stock row left to resolve. This is the same known, accepted limitation `OrderItem`'s own snapshot design already carries.

**Phase 4M audit:** before building Shipping on top of this design, it was re-verified directly against the running code (not assumed from this doc's own prior claims). The design held — `adjust()`'s non-idempotency is real, but the guarded UPDATE genuinely runs before it and settles the race first, so it can only ever be reached once per real transition. What was missing was empirical test coverage of exactly that: the one existing concurrency test (below) races `CONFIRMED`, a transition with zero inventory involvement. Two regression tests were added racing two `DELIVERED -> COMPLETED` requests and two `CANCELLED` requests against the same order — both pass, confirming exactly one accepted transition and exactly one inventory side effect under real concurrent requests. No code changed; this closed a test-coverage gap, not a correctness defect.

## PRD alignment

| Requirement | Status | Decision |
|---|---|---|
| `GET /orders`, `GET /orders/:id` (customer), `GET/PATCH /admin/orders...` (staff) (§2C.11) | **Implemented** | See API boundary table above |
| Order status lifecycle (multiple, slightly inconsistent versions across §22/§55/§2B.2/§2I.5) | **Implemented, reconciled** | One state-machine table built from the most formal version (§2I.5) plus its own cancellation-path caveats; see table above |
| `OrderStatusHistory` / audit trail of transitions (named in this doc's own prior stub, and implied by the PRD's general audit/history requirements) | **Implemented** | New `OrderStatusHistory` model — append-only, one row per transition, records previous/new status, actor, optional reason, timestamp |
| Independent Order/Payment/Shipment status fields (§54) | **Already true, unchanged** | `Order.status` and `Order.paymentStatus` were already separate columns (Phase 4I); this phase only ever writes `status` |
| Returns/refunds modeled separately from simple cancellation (§56) | **Implemented, Phase 4N** | `DELIVERED → CANCELLED` is still not built (a returns-flow concern, correctly). `REFUNDED`/`RETURNED` are now reachable — but only via `OrdersService.transitionForReturns`, called by Returns after its own `returns:update` check, never via this module's own `ORDER_TRANSITIONS`/`PATCH .../status` endpoint, which is unmodified. See `docs/modules/RETURNS.md` |
| Inventory decrement on order confirmation/completion (flagged across `docs/modules/INVENTORY.md`/`CHECKOUT.md` as "a future Orders phase responsibility," not previously designed) | **Implemented** | `DELIVERED → COMPLETED` releases the reservation then calls the existing `InventoryRepository.adjust()` — no new Inventory API, no new movement type; reuses `ADJUSTMENT` |
| Admin filtering (`status`, `paymentStatus`, `shipmentStatus`, `market`, `dateFrom`, `dateTo`, `customer`, `orderNumber`) | **Implemented** | `shipmentStatus` became a real filter in Phase 6F (the column exists since Phase 4M); `search` (order #/customer email/name) was added for the admin UI |
| `orders:read`/`orders:update`/`orders:cancel`/`orders:refund` permissions (seeded since Phase 4H's RBAC work, unwired until now) | **Wired: `read`, `update`, `cancel`.** `refund` remains unused | No refund transition/endpoint is built this phase — refunds are a Payments-domain concern (see below) |
| `RbacService.authorizeOwnerOrPermission` (built in Phase 4H's RBAC work, documented as intended for exactly this use, never called until now) | **Wired** | Used by the single shared `getOrderById` for both the customer and admin detail routes |
| Guest orders (PRD's own conceptual schema shows `Order.userId` nullable) | **Not implemented, unchanged** | `Order.userId` stays `NOT NULL`/`onDelete: Restrict` (Phase 4I decision); this phase reads/transitions existing rows only, doesn't touch the column |
| `Inventory.warehouseId` (PRD's Phase-2 `Warehouse`/`Inventory(warehouseId, ...)` sketch) | **Untouched, still an open discrepancy** | Not this phase's job — `VariantStock(variantId, marketId)` is unchanged; see `docs/modules/INVENTORY.md`/`CHECKOUT.md` for the existing record of this discrepancy |
| `OrderAddress` inline snapshot vs. PRD's `shippingAddressId` | **Untouched, already resolved in Phase 4I** | No Address/Customers domain is introduced by this phase; the snapshot design is unchanged |

## Reused existing infrastructure (nothing reinvented)

`RbacService.authorizeOwnerOrPermission` (ownership/permission check), `requirePermission`/`requireAnyPermission` middleware (route-level admin gating), `paginationQuerySchema`/`toSkipTake`/`toPaginationMeta` (Catalog's pagination helpers), `successResponse`/`errorResponse` (the shared response envelope), `InventoryRepository.reserve`/`release`/`adjust` (no new Inventory API), and `checkout.mapper.ts`'s `OrderItemView`/`OrderAddressView` types (identical shape, imported rather than duplicated). `checkout.mapper.ts`'s own `OrderView`/`toOrderView` are **not** reused directly — that type's doc comment states it is deliberately the customer-only shape Checkout returns; Orders needs one shape usable for both the customer and staff views, plus a status-history list neither Checkout nor that type carries.

## Dependencies

Checkout (creates every `Order`/`OrderItem`/`OrderAddress` row this module reads), Inventory (`release`/`adjust` on transition), RBAC (`authorizeOwnerOrPermission`, permission checks). Payments (`updatePaymentStatus` passthrough), Shipping (`updateShipmentStatus` passthrough), Returns (`transitionForReturns` — the sole write path into `status → RETURNED/REFUNDED`, Phase 4N) — the only three modules that write to `Order` outside this one. Notifications — not integrated.

## Explicit out of scope

- **Payments** — implemented in Phase 4K as its own module; see `docs/modules/PAYMENTS.md`. `orders:refund` remains seeded but unwired (Payments refunds are authorized by the separate `payments:refund` permission instead; Returns' own staff actions are authorized by `returns:update`, not `orders:refund` either).
- **Notifications** — no order-status-change notification hooks.
- **`DELIVERED → CANCELLED`** — still intentionally not built even after Returns (Phase 4N); a genuine cancellation past delivery remains out of scope, distinct from the Returns flow Phase 4N does implement (`COMPLETED → RETURNED → REFUNDED`).
- **Guest orders** — `Order.userId` stays required.
- **Warehouse entity / `Inventory.warehouseId`** — untouched; stays on `VariantStock(variantId, marketId)`.
- **Request-hash idempotency for Checkout** — unchanged; Orders' own PATCH endpoint gets its concurrency safety from the guarded UPDATE (above), not a parallel idempotency-key system.
- **Tax calculation** — `discountAmount`/`taxAmount` remain always-`0`, unchanged from Checkout. `shippingAmount` is now real (Phase 4M — see `docs/modules/SHIPPING.md`), but Orders itself never computes or rewrites it; it's set once at Checkout time and stays immutable.
- **Customers/Address domain** — `OrderAddress` stays an inline snapshot, not a FK to a reusable address book.

**Security considerations:** Customers reach only their own orders (ownership check, never a client-supplied `userId`). Staff reach any order or transition via the exact seeded `orders:read`/`orders:update`/`orders:cancel` permissions — no bare role-string checks anywhere. A customer requesting another customer's order gets `404`, never `403` (existence is never leaked). Order-time price/product/address data remains immutable once snapshotted by Checkout; Orders never rewrites it, only appends `OrderStatusHistory` rows and updates `Order.status`.

**Current status:** **COMPLETE** (Phase 4J, `updatePaymentStatus` added 4K/hardened 4L, `updateShipmentStatus` added 4M, `transitionForReturns` added 4N) — `OrderStatusHistory` migration, full read/list/status-transition API, inventory release/decrement side effects, RBAC wiring, integration tests (creation regression, retrieval, listing/filters/pagination, every valid/invalid/terminal transition, permission checks, concurrency incl. Phase 4M's `COMPLETED`/`CANCELLED` inventory-race regression tests, inventory effects).

**Future notes:** A future Returns-adjacent phase might define the `DELIVERED → CANCELLED` path via a proper cancellation-past-delivery flow, distinct from the `COMPLETED → RETURNED → REFUNDED` path Phase 4N already built. `orders:refund` remains seeded but unwired — Returns' own staff actions use `returns:update` instead (see `docs/modules/RETURNS.md`).
