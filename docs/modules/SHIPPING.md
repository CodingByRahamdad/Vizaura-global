# SHIPPING Module

**Purpose:** Own the post-order fulfillment lifecycle — market-scoped shipping methods/rates, a per-order `Shipment` record, and the staff-driven tracking/status workflow from dispatch through delivery.

**Responsibilities:** `ShippingMethod` CRUD (admin) and public listing (customer-facing rate/method picker), `Shipment` creation (inside Checkout's own transaction, never standalone), staff-driven shipment status updates (tracking number, carrier, lifecycle transitions), `Order.shipmentStatus` updates (the sole writer). Checkout's own shipping-cost calculation is reconciled here too (Phase 4M) — see "Checkout reconciliation" below.

**Data ownership:** `ShippingMethod`, `Shipment`. `Order`/`OrderItem`/`OrderAddress` remain owned by Checkout; `Order.status` remains owned by Orders — Shipping writes only `Order.shipmentStatus`, via a new `OrdersService.updateShipmentStatus` passthrough (the exact same shape as Payments' `updatePaymentStatus`).

**Main entities:** `ShippingMethod` (market-scoped rate/method, admin-managed, archived not deleted), `Shipment` (one row per Order — no partial fulfillment/`ShipmentItem` concept, the PRD has none).

**API boundary:**

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/v1/shipping/methods?market=PK` | none (public) | Active methods for one market — the checkout-selection list. PRD's own literal "Customer: GET /api/v1/shipping/methods" with no auth requirement |
| GET | `/api/v1/admin/shipping/methods` | `authenticate` + `requirePermission("shipping:read")` | All methods (active + archived), filterable by `market`/`isActive`, paginated |
| POST | `/api/v1/admin/shipping/methods` | `authenticate` + `requirePermission("shipping:update")` | Body: `{ marketCode, name, description?, baseRate, freeShippingThreshold?, estimatedMinDays?, estimatedMaxDays?, isActive? }` |
| GET | `/api/v1/admin/shipping/methods/:id` | `authenticate` + `requirePermission("shipping:read")` | Not in the PRD's literal route list — a minimal, justified addition matching every other admin domain's getById (Orders/Payments) |
| PATCH | `/api/v1/admin/shipping/methods/:id` | `authenticate` + `requirePermission("shipping:update")` | Partial update |
| DELETE | `/api/v1/admin/shipping/methods/:id` | `authenticate` + `requirePermission("shipping:update")` | Archives (`isActive = false`), never a hard delete — see "ShippingMethod model" below |
| GET | `/api/v1/orders/:orderId/shipment` | `authenticate` | Ownership-or-`shipping:read`, ownership resolved through the parent Order. PRD's own literal nested route (§2C.14) |
| GET | `/api/v1/admin/shipments` | `authenticate` + `requirePermission("shipping:read")` | Filters: `status`, `orderId` + pagination. Not in the PRD's literal route list — a minimal, justified addition (every other fulfillment-adjacent admin domain has one) |
| PATCH | `/api/v1/admin/shipments/:id` | `authenticate` + `requirePermission("shipping:update")` | Body: `{ status, trackingNumber?, carrier? }`. PRD's own literal route (§2C.14) |

Routes are split across two "own router, shared mount prefix" pairs, both reusing an established precedent from this codebase: `shippingMethodsRouter`/`adminShippingMethodsRouter` mount at `/shipping/methods`/`/admin/shipping/methods` (new prefixes); `shipmentsRouter` mounts at `/orders` alongside `ordersRouter` (the exact pattern Pricing/Inventory already use under `/products`, so `orders.routes.ts` needed no edit), and `adminShipmentsRouter` at `/admin/shipments` (the same split-router pattern Orders/Payments established).

## ShippingMethod model

Market-scoped (`marketId`), fields per the PRD's own schema sketch (§40/§41, §2B.20): `name`, `description?`, `baseRate` (Int minor units), `freeShippingThreshold?`, `estimatedMinDays?`, `estimatedMaxDays?`, `isActive`. `isActive` doubles as the soft-delete flag — `DELETE /admin/shipping/methods/:id` archives, it never hard-deletes, matching the PRD's own "safe to archive" classification for shipping methods (§2B.29 Delete Strategy) and Catalog's existing archive-not-delete convention.

**`ShippingZone` is deliberately not modelled.** The PRD names it (§2B.20) but never actually wires it to anything: `ShippingMethod`'s own schema sketch has no `zoneId` field, and the PRD's rate-calculation formula (`Market + Address + Order Value + Shipping Method -> Shipping Cost`, §42) never mentions Zone either. Building an orphan table with no linking mechanism the PRD itself never specifies would violate this project's "every model must have a documented purpose" rule — deferred (classified **C**), documented rather than guessed at.

## Shipment model

One row per Order (`orderId @unique` — the PRD has no `ShipmentItem`/partial-fulfillment concept, so this is a single-shipment-per-order model), created inside Checkout's own transaction (`checkout.repository.ts`) immediately after the `Payment` row — the same "no standalone creation endpoint, implicit at order-creation time" precedent, since the PRD names no `POST /shipments` route anywhere. Fields per the PRD's own schema sketch: `shippingMethodId` (FK, required), `trackingNumber?`, `carrier?`, `status`, `shippedAt?`, `deliveredAt?`. `Shipment.orderId` uses `onDelete: Restrict`, mirroring `Payment.orderId`'s own posture — a fulfillment record shouldn't be silently orphaned by a hard-delete.

**No `ShipmentEvent`/history table.** The PRD gives Payments a dedicated `PaymentTransaction` history entity ("this gives us a history rather than overwriting payment state") but proposes no equivalent for Shipment — only `shippedAt`/`deliveredAt` timestamps exist. This is a genuine PRD asymmetry (classified **D**), documented rather than invented: `Shipment.status` is a mutable summary, same as `Order.status`, not an append-only log.

## Shipment lifecycle

```
PENDING -> PROCESSING -> SHIPPED -> IN_TRANSIT -> DELIVERED
PENDING -> CANCELLED           (before dispatch)
PROCESSING -> CANCELLED        (before dispatch)
IN_TRANSIT -> RETURNED         (delivery failure / return-to-sender)
DELIVERED -> RETURNED          (delivery failure / return-to-sender)
SHIPPED -> ITEM_RETURNED / ITEM_LOST       (order cancelled after dispatch)
IN_TRANSIT -> ITEM_RETURNED / ITEM_LOST    (order cancelled after dispatch)
DELIVERED -> ITEM_RETURNED                 (order cancelled after delivery, item sent back)
RETURNED -> ITEM_RETURNED                  (warehouse confirms receipt of a carrier return-to-sender)
```

**PRD reconciliation (classified D):** the PRD gives two internally-inconsistent `Shipment`/`ShipmentStatus` value lists — an earlier conceptual pass (§39) includes `OUT_FOR_DELIVERY`/`FAILED`; a later, formal enum-reference pass drops both and adds `CANCELLED`. Per this project's established precedent (Payments preferred the later, formalized pass over the earlier conceptual one for its own `PaymentStatus`), the formal enum is adopted: `PENDING, PROCESSING, SHIPPED, IN_TRANSIT, DELIVERED, RETURNED, CANCELLED`. "FAILED" delivery is folded into `RETURNED` rather than kept as a separate value.

**Post-cancellation outcomes (`ITEM_RETURNED`/`ITEM_LOST`):** added so staff can record what actually happened to a shipment that had already left the warehouse before its order was cancelled — previously a cancelled order fully locked the shipment, with no way to track a physical item that still came back or went missing. Reachable only from post-dispatch statuses (`SHIPPED`/`IN_TRANSIT`/`DELIVERED`/`RETURNED` — nothing to lose or return before dispatch, which plain `CANCELLED` already covers) and only once the parent Order is actually `CANCELLED` (see "Terminal-order guard" below).

Every transition is written through `ShipmentsRepository.transitionStatus`, a guarded, single-statement `UPDATE shipments SET status = $new WHERE id = $id AND status = $currentlyExpected` — the identical optimistic-concurrency pattern Orders'/Payments' own guarded updates use. `0` rows updated (a concurrent writer already moved this shipment) surfaces as `409 SHIPMENT_STATUS_CONFLICT`. Unlike `Payment`/`Order`, there is no related history-row insert to keep atomic with the status write (no `ShipmentEvent` table — see above), so this is a single statement, not a `$transaction`.

## Order ↔ Shipment relationship

- `Shipment.orderId -> Order.id`, `onDelete: Restrict` (see above).
- Shipping writes **only** `Order.shipmentStatus`, via `OrdersService.updateShipmentStatus(orderId, newShipmentStatus)` — an internal, intentionally **unpermissioned** passthrough, the exact same shape as Payments' `updatePaymentStatus`. The permission check already happened at the Shipping layer (`shipping:update`) before this is ever called.
- `OrdersRepository.updateShipmentStatus` has no `expectedCurrentStatus` guard, for the same reason `updatePaymentStatus` doesn't: `OrdersService.updateStatus` never touches `shipmentStatus`, so there's no cross-domain race to guard against, and `Shipment` is one-to-one with `Order` (`orderId @unique`), so there's no multi-shipment race either — the race that matters (which shipment-status write "wins") is already resolved by `Shipment.status`'s own guarded update.
- Shipping **never** calls `OrdersService.updateStatus` and never advances `Order.status` on a `SHIPPED`/`DELIVERED` milestone. This mirrors Payments' own established precedent exactly ("`Order.status` advancement stays exclusively a staff action") and satisfies the audit brief's "do not duplicate Order state-machine logic inside Shipping" / "do not allow Shipping to arbitrarily mutate `Order.status`." Classified **B** (intentional, precedent-consistent) — `Order.status` already has its own `SHIPPED`/`DELIVERED` values in its state machine (Phase 4J), and the PRD's own diagram (§54/§35, `status = PROCESSING, paymentStatus = PAID, shipmentStatus = PREPARING` shown co-occurring independently) treats the three fields as genuinely independent, not one driving another automatically.

## Payment ↔ Shipment boundary

`PATCH /admin/shipments/:id` does **not** require `Order.paymentStatus === PAID`. The PRD gives no "paid before ship" rule anywhere, and COD's own "collect on delivery" semantics already imply shipment happens *before* payment is collected — requiring `PAID` first would make COD unshippable by construction. The only precondition is that the parent Order be non-terminal (see below). Classified **D** (PRD silent, decided rather than invented arbitrarily — consistent with COD's existing semantics). Shipping never writes `Payment.status`; Payments never writes `Shipment.status`.

**Terminal-order guard:** `updateStatus` rejects with `422 SHIPMENT_ORDER_NOT_SHIPPABLE` if the parent Order is in a terminal status (`CANCELLED|COMPLETED|FAILED|REFUNDED|RETURNED`) — mirroring Payments' Phase 4L `PAYMENTS_ORDER_NOT_PAYABLE` fix exactly, so a cancelled/completed order's shipment can't still be walked forward merely because a caller holds `shipping:update`.

**Narrow carve-out for `CANCELLED` orders:** a `CANCELLED` order is the one terminal status that still allows a shipment update — but only into `ITEM_RETURNED`/`ITEM_LOST`, never a normal forward-fulfillment status. `COMPLETED`/`FAILED`/`REFUNDED`/`RETURNED` orders remain fully locked for every target status, exactly as before this carve-out existed. The inverse case — trying to set `ITEM_RETURNED`/`ITEM_LOST` on an order that is *not* cancelled — is rejected with a new `422 SHIPMENT_ITEM_OUTCOME_REQUIRES_CANCELLED_ORDER`, since those statuses only make sense as a record of what happened after cancellation.

## Inventory ↔ Shipment boundary

None, directly. Shipping does not import or call `InventoryRepository` anywhere. Orders already owns reserve/release/decrement exclusively (Checkout reserves at order creation; Orders' `CANCELLED`/`COMPLETED` transitions release/decrement — Phase 4J). Introducing a second Inventory-mutating path from Shipping would risk double-decrementing the exact scenario Phase 4J's own concurrency design was built to prevent — this phase's own audit re-verified that design (see "Order/Inventory concurrency audit" below) specifically so Shipping could be built on top of it without reopening it.

## Checkout reconciliation (Phase 4M)

Checkout previously accepted `shippingMethod` as a free-text, informational-only string and hard-coded `Order.shippingAmount = 0` (documented in `docs/modules/CHECKOUT.md` as explicitly deferred pending a Shipping domain). That blocking condition is now resolved:

- `checkoutBodySchema`'s `shippingMethod: string, optional` is replaced by `shippingMethodId: string (uuid), required` — a genuine breaking change to the checkout request contract, not an additive one.
- `CheckoutService.checkout` resolves `shippingMethodId` against the new `ShippingMethod` table, scoped to the checkout's own market and requiring `isActive` (`shippingErrors.methodUnsupported` — `422 SHIPPING_METHOD_UNSUPPORTED` — for a method from another market, an archived one, or an unknown id).
- `shippingAmount` is computed server-side: `0` once the order's `subtotalAmount` reaches the method's `freeShippingThreshold` (if set), else the method's flat `baseRate`. This directly implements the PRD's own shipping-cost formula (`Market + Address + Order Value + Shipping Method -> Shipping Cost`, §42) for the MVP — address doesn't affect the amount, since no zone-based rate table exists (see the `ShippingZone` deferral above).
- `totalAmount = subtotalAmount + shippingAmount` (discount/tax remain always `0` — no Promotions/tax-configuration domain exists yet, unchanged from Phase 4I).
- A `Shipment` row (`PENDING`) is created in the same transaction as `Order`/`Payment`, referencing the resolved `shippingMethodId`.

No second, disconnected total-calculation path was introduced — this is a direct edit to Checkout's own existing transaction, not a post-order adjustment. Historical `Order` totals remain immutable after creation, exactly as before.

## Provider abstraction

`backend/src/modules/shipping/providers/`:

```ts
interface ShippingProvider {
  readonly key: string;
  dispatch(params: { shipmentId: string; trackingNumber: string | null; carrier: string | null }): Promise<void>;
}
```

The PRD explicitly asks for the "same principle" as `PaymentProvider` (§2O.2 Shipping Adapter: `ShippingService -> ShippingProvider -> Provider implementation`, "this makes providers replaceable") and explicitly wants "configurable internal shipping methods" supported "even when no external courier API exists" (§15 Shipping Architecture). `manualProvider` (key `"MANUAL"`) is that baseline — `dispatch()` is a no-op hook (no external call, no gateway), invoked once on the `->SHIPPED` transition, so a future real-carrier provider can be added behind `ShippingProvider` without changing any call site. `resolveProvider()` is the single choke point every caller resolves a provider through, the same shape as Payments' `resolveProvider`, kept as the established extension point even though only one provider exists today.

**No webhook, no second/test provider.** The PRD is entirely silent on carrier delivery-status webhooks (searched exhaustively — every detailed webhook-security flow in the PRD is written exclusively for Payments; the only textual link between a payment webhook and shipment state is "update inventory/shipment where applicable," never elaborated). There is no security surface here (no signature verification, no external callback) to justify a MOCK provider the way Payments' MOCK existed specifically to exercise webhook signature verification. Classified **C** (deferred — no PRD requirement, no real carrier to receive a webhook from).

## Idempotency

The PRD is silent on shipment-specific idempotency — it names no `POST /shipments` route to need one (Shipment creation rides inside Checkout's own already-idempotent transaction, keyed on `Order.idempotencyKey`). `PATCH /admin/shipments/:id` uses the same guarded-UPDATE optimistic-concurrency pattern as Orders/Payments, not a separate idempotency-key mechanism — no generic `IdempotencyKey` table, consistent with the established precedent (Payments' own documented rationale applies identically here).

## RBAC / ownership

- `shipping: ["read", "update"]` — **already present in `seed.ts`'s permission matrix and already wired into role definitions** (`admin`, `store_manager`, `order_manager` via `expand("shipping")`; `customer_support` holds `shipping:read` only) before this phase began, exactly the same "pre-declared ahead of the owning phase" posture `OrderStatus`'s unused values and `Order.paymentStatus` carried before Payments existed. No `seed.ts` change was needed — permission count stays 48. Classified **D** (the PRD never names a payments-or-shipping permission domain in any of its 5 example RBAC lists; this taxonomy is a necessary extension the PRD's own authorization model requires but never named — see `docs/modules/PAYMENTS.md`'s identical finding for `payments:*`).
- `GET /orders/:orderId/shipment`: `RbacService.authorizeOwnerOrPermission({resourceOwnerId: order.userId, requesterId, state, overridePermission: "shipping:read"})` — ownership resolved through the parent Order (a `Shipment` carries no `userId` of its own). A failed check is `404`, matching Payments'/Orders' "never distinguish not-yours from doesn't-exist" posture.
- Public `GET /shipping/methods`: no auth at all — matches the PRD's literal spec.
- All other routes: route-level `shipping:read`/`shipping:update`.

## Market / business boundary

`ShippingMethod.marketId` scopes methods per-market, per the PRD's own per-market shipping configuration requirement (Pakistan/UAE each configure their own methods/rates/thresholds independently — no FX-derived shipping cost, same principle Pricing already established). No multi-tenant architecture; no `Warehouse` entity introduced — Shipping has zero Inventory dependency, so the pre-existing `Inventory.warehouseId`/`Warehouse` discrepancy (flagged in earlier phases) has no bearing here and remains untouched.

## Order/Inventory concurrency audit (Phase 4M, before any Shipping code was written)

Before building on top of Orders' `DELIVERED -> COMPLETED`/`-> CANCELLED` inventory accounting (Phase 4J), this phase re-verified it directly against the running code rather than trusting the prior phases' own reports. Confirmed: `InventoryRepository.adjust()` (used on `->COMPLETED`) is genuinely non-idempotent (no reference/dedup guard, only a bounds `CHECK`), but `OrdersRepository.transitionStatus`'s guarded `UPDATE ... WHERE status = expectedCurrentStatus` is an atomic DB-level compare-and-swap that runs strictly before any Inventory call — so `adjust()` can structurally only be reached once per real transition, race or not. This was true by code inspection but had never been exercised by an actual concurrent-request test: the one existing concurrency test (`orders.test.ts`) raced two identical `PENDING -> CONFIRMED` transitions, a transition with zero inventory involvement. Two regression tests were added (`orders.test.ts`, "Order status concurrency") that race two `DELIVERED -> COMPLETED` requests and two `CANCELLED` requests against the same order under the real Postgres test database — both confirm exactly one accepted transition, exactly one `ADJUSTMENT`/release side effect, and the correct final `onHand`/`reserved`. No source-code defect was found; this closed a test-coverage gap, not a correctness gap.

## Reused existing infrastructure (nothing reinvented)

`RbacService.authorizeOwnerOrPermission`, `requirePermission` middleware, `paginationQuerySchema`/`toSkipTake`/`toPaginationMeta`, `successResponse`/`errorResponse`, the guarded-UPDATE optimistic-concurrency pattern (from Orders/Payments), the "own router, shared mount prefix" pattern (from Pricing/Inventory under `/products`), and `shipping/prismaErrors.ts`'s `isUniqueConstraintViolation` helper (copied per this codebase's established per-module-copy precedent).

## Dependencies

Checkout (creates every `Shipment` row, inside its own transaction; also the caller of `ShippingMethodsRepository` for cost calculation), Orders (`OrdersService.updateShipmentStatus`, the sole write path into `Order.shipmentStatus`), RBAC (`authorizeOwnerOrPermission`, permission checks). Payments, Inventory — not integrated (see the boundary sections above). Returns (Phase 4N, COMPLETE) deliberately does **not** integrate with Shipping either — see "Naming collision with Returns" below. Notifications — not integrated.

### Naming collision with Returns (Phase 4N) — confirmed non-issue

`ShipmentStatus.RETURNED` (used by both `Shipment.status` and `Order.shipmentStatus`) predates the Returns module and means "delivery failure / return-to-sender" — a carrier-side event reached from `IN_TRANSIT`/`DELIVERED` via the staff-driven `PATCH /admin/shipments/:id` endpoint. The Returns domain (Phase 4N) has its own, entirely separate `Return.status` enum (`REQUESTED/APPROVED/REJECTED/RECEIVED/REFUNDED`) for a customer-initiated merchandise return, and — to avoid conflating the two — Returns deliberately never reads or writes `Shipment`/`Order.shipmentStatus` at all, deriving its own eligibility from `Order.status` only. See `docs/modules/RETURNS.md`'s "Shipping boundary" for the full rationale. No code or schema change was needed here to accommodate this; the two `RETURNED` values simply coexist on different fields with different meanings, and neither module reads the other's.

## Explicit out of scope

- **Real carrier integration** — no real courier API is named or chosen anywhere in the PRD; none is integrated here. The `ShippingProvider` interface exists specifically so one can be added later without touching call sites.
- **`ShippingZone`** — PRD-named but never wired to anything in the PRD's own design; deferred (see "ShippingMethod model").
- **`ShipmentEvent`/tracking history log** — the PRD proposes no equivalent to `PaymentTransaction` for shipments; deferred (see "Shipment model").
- **Carrier webhooks** — PRD is entirely silent on shipment/delivery-status webhooks; deferred (see "Provider abstraction").
- **Partial fulfillment / multi-package shipments** — no `ShipmentItem` concept exists in the PRD; one `Shipment` per `Order`.
- **Redis or distributed idempotency/locking** — Postgres guarded updates only, per the "no overengineering" constraint on this phase.
- **A dedicated Address/customer-address domain** — the existing `OrderAddress` snapshot is reused as-is for the shipment destination; Shipping never writes to it.
- **Generic audit-log system** — no `AuditLog` model exists anywhere in this codebase, for any domain; building one here would be new infra beyond a Shipping-only phase's boundary (same conclusion Payments' Phase 4L reached).

**Security considerations:** No shipping cost is ever accepted from the client — always computed server-side from the resolved `ShippingMethod`. Customers reach only their own order's shipment (ownership resolved through the parent Order, never a client-supplied `userId`); a customer requesting another customer's shipment gets `404`, never `403`. All staff mutations are permission-gated (`shipping:update`); the public method-listing route intentionally has no auth (matches the PRD).

**Phase 6H:** `/admin/orders/[id]` now exposes shipment status transitions plus tracking number/carrier editing as staff actions (`frontend/src/components/admin/orders/ShipmentActions.tsx`), gated on `shipping:update`. No backend change — this was the module's first frontend of any kind; the display-only `SHIPMENT_NEXT_TRANSITIONS` map in `frontend/src/lib/types/admin-orders.ts` mirrors this doc's `SHIPMENT_TRANSITIONS` table.

**Current status:** **COMPLETE** (Phase 4M) — `ShippingMethod`/`Shipment` migration (additive, `Order.shipmentStatus` column + two new tables), `ShippingProvider` abstraction (`MANUAL`), Checkout integration (real shipping-cost calculation, `Shipment` row creation), Orders integration (`updateShipmentStatus` passthrough), admin `ShippingMethod` CRUD + archive, staff shipment status updates with guarded transitions and terminal-order rejection, RBAC wiring (permissions were already pre-seeded), 19 new integration tests plus 2 new Orders concurrency regression tests.

**Future notes:** A future real-carrier phase adds a concrete gateway behind the existing `ShippingProvider` interface without changing any call site. A future Notifications phase could hook shipment status changes (e.g. `sendShippingUpdate()`, named in the PRD's own `EmailService` sketch) without Shipping itself needing to change. Returns (Phase 4N) is now COMPLETE and, per its own design, does not call into this module — a future return-shipment/RMA flow (if the PRD or product direction ever specifies one) remains a genuinely open future extension, not something Phase 4N already builds toward.
