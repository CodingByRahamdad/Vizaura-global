# STATE_MACHINES.md

Consolidated, single-reference transition matrix for the four state machines built across Orders/Payments/Shipping/Returns (Phases 4J-4O). Each table is sourced directly from the actual current code, not re-derived from memory or prior docs — see the file/line cited under each. This document does not change any state machine; it only makes facts already scattered across `ORDERS.md`/`PAYMENTS.md`/`SHIPPING.md`/`RETURNS.md` easy to compare side by side (built for Phase 4P's Part F audit).

## OrderStatus

Source: `backend/src/modules/orders/orders.service.ts`, `ORDER_TRANSITIONS`/`TERMINAL_STATUSES`.

| From | Allowed To | Permission | Notes |
|---|---|---|---|
| `PENDING` | `CONFIRMED`, `CANCELLED` | `orders:update` / `orders:cancel` | |
| `CONFIRMED` | `PROCESSING`, `CANCELLED` | `orders:update` / `orders:cancel` | |
| `PROCESSING` | `SHIPPED`, `CANCELLED` | `orders:update` / `orders:cancel` | |
| `SHIPPED` | `DELIVERED` | `orders:update` | No `CANCELLED` — PRD requires a return/refund flow past this point, not a cancel |
| `DELIVERED` | `COMPLETED` | `orders:update` | |
| `COMPLETED`, `CANCELLED`, `FAILED`, `REFUNDED`, `RETURNED` | *(none via this table)* | — | Terminal. `RETURNED`/`REFUNDED` are reached only via `OrdersService.transitionForReturns`, which bypasses this table entirely (see Returns section) |

Any `(from, to)` pair not listed is rejected — `422 ORDERS_INVALID_STATUS_TRANSITION`. Guarded via `OrdersRepository.transitionStatus` (`UPDATE ... WHERE status = expected`), `0` rows → `409 ORDERS_STATUS_CONFLICT`.

## Payment.status (`OrderPaymentStatus`, reused — no separate `PaymentStatus` enum)

Source: `backend/src/modules/payments/payments.service.ts`/`payments.repository.ts`.

| From | To | Trigger | Notes |
|---|---|---|---|
| `PENDING` | `PAID` | COD `markPaid` (staff) or MOCK webhook | Requires parent Order non-terminal (`assertOrderPayable`) |
| `PENDING` | `FAILED` | COD `markFailed` (staff) or MOCK webhook | Same guard |
| `PAID` / `PARTIALLY_REFUNDED` | `PARTIALLY_REFUNDED` / `REFUNDED` | `refund()` (gateway) or `markRefunded()` (COD attestation, Phase 4O) | Row-locked (`refundLocked`), remaining-amount-checked; no Order-terminal guard (refunding a payment on a since-cancelled order is the legitimate use case) |
| `REFUNDED` | *(none)* | — | Terminal — `refund()`/`markRefunded()` both short-circuit to a no-op on an already-`REFUNDED` payment, never move it further |

Guarded via `PaymentsRepository.updateStatus`/`refundLocked` (both row-locked or guarded-UPDATE); `0` rows or a failed lock condition → `409 PAYMENTS_STATUS_CONFLICT` / a specific outcome (`already-refunded`/`invalid-status`/`exceeds-captured`).

## ShipmentStatus

Source: `backend/src/modules/shipping/shipments.service.ts`, `SHIPMENT_TRANSITIONS`.

| From | Allowed To |
|---|---|
| `PENDING` | `PROCESSING`, `CANCELLED` |
| `PROCESSING` | `SHIPPED`, `CANCELLED` |
| `SHIPPED` | `IN_TRANSIT` |
| `IN_TRANSIT` | `DELIVERED`, `RETURNED` |
| `DELIVERED` | `RETURNED` |
| `CANCELLED`, `RETURNED` | *(none)* | Terminal |

Requires parent Order non-terminal (`assertOrderShippable`, same `TERMINAL_ORDER_STATUSES` set Payments uses). Guarded via the same UPDATE-WHERE-expected pattern; `0` rows → `409 SHIPMENT_STATUS_CONFLICT`. **`ShipmentStatus.RETURNED` is a carrier-side "delivery failure/return-to-sender" event — unrelated to a customer merchandise return** (the Returns domain, below); this naming collision is deliberate PRD vocabulary, not a design conflict, and Returns never touches `Shipment` at all (see Returns' own "Shipping boundary").

## ReturnStatus

Source: `backend/src/modules/returns/returns.service.ts`/`returns.repository.ts`.

| From | To | Trigger | Side effect |
|---|---|---|---|
| `REQUESTED` | `APPROVED` | staff `approve` | none |
| `REQUESTED` | `REJECTED` | staff `reject` (rejectionReason required) | none |
| `APPROVED` | `RECEIVED` | staff `receive` | Inventory restock (`adjust(+qty)`), `Order.status -> RETURNED` (first time only) |
| `RECEIVED` | `REFUNDED` | staff `refund` | Payments call (gateway `refund()` or COD `markRefunded()`), `Order.status -> REFUNDED` (first time only) |
| `REFUNDED` | `RECEIVED` | **internal only** — Phase 4O's claim/confirm/revert | Fires only when the Payments call inside `refund()` throws; reverts the false claim, never reachable via any route directly |
| `REJECTED`, `REFUNDED` | *(none via a route)* | — | Terminal from the customer-facing action set |

Guarded via `ReturnsRepository.transitionStatus`; `0` rows → `409 RETURNS_STATUS_CONFLICT`.

## Cross-cutting: who writes what

| Field | Sole writer | Never written by |
|---|---|---|
| `Order.status` | `OrdersRepository.transitionStatus`, called by `OrdersService.updateStatus` (staff, permissioned) and `OrdersService.transitionForReturns` (Returns-internal passthrough, bypasses `ORDER_TRANSITIONS`) | Payments, Shipping |
| `Order.paymentStatus` | `OrdersService.updatePaymentStatus`, called only by Payments | Orders' own staff endpoint, Shipping, Returns |
| `Order.shipmentStatus` | `OrdersService.updateShipmentStatus`, called only by Shipping | Payments, Returns |
| `Payment.status` | Payments only (`updateStatus`/`refundLocked`) | Returns (calls into Payments' service, never writes the column directly) |
| `Shipment.status` | Shipping only | Returns (deliberately not integrated — see Returns' "Shipping boundary") |
| `Return.status` | Returns only | — |

This table is the concrete evidence behind every "X never writes Y" claim in the individual module docs — re-verified against current source for Phase 4P's Part F audit, no inconsistency found.
