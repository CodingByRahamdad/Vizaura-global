# RETURNS Module

**Purpose:** Own the post-completion merchandise-return lifecycle — a customer-initiated return request against a completed order, staff review (approve/reject), physical receipt with inventory restock, and the resulting refund, reusing Payments' own hardened refund mechanism rather than reimplementing it.

**Responsibilities:** `Return`/`ReturnItem` creation (customer, ownership), staff approve/reject/receive/refund actions, inventory restock on receipt, delegating the actual refund to `PaymentsService.refund()`, advancing `Order.status` into `RETURNED`/`REFUNDED` through the existing guarded `OrdersRepository.transitionStatus` primitive.

**Data ownership:** `Return`, `ReturnItem`. `Order`/`OrderItem` remain owned by Checkout/Orders; `Payment`/`PaymentTransaction` remain owned by Payments; `Shipment` remains owned by Shipping and is **not touched at all** by this module (see "Shipping boundary" below).

**PRD coverage — exceptionally thin.** The PRD gives a single 20-line conceptual note (§56 "Return & Refund Architecture"): `Return Request → Review → Approved/Rejected → Return Received → Refund`, never given a second, formalized pass the way Payments (§2B.19/§2C.12) and Shipping (§2B.20/§2C.14) each were. No `Return`/`ReturnItem` schema, no eligibility rule beyond one transition label (`DELIVERED → RETURN REQUESTED`), no partial-return mechanics, no refund-composition rule, no permission keys, no API routes, no return-shipping rule. Nearly everything below is a **D** (PRD-silent, documented decision) or **B** (intentional, precedent-consistent) choice — classified explicitly throughout, the same rigor Payments/Shipping applied to their own PRD gaps.

**API boundary:**

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/v1/orders/:orderId/returns` | `authenticate` + `requireVerifiedEmail` | Ownership. Body: `{ reason?, items: [{ orderItemId, quantity }] }`. `422 RETURNS_ORDER_NOT_RETURNABLE` / `422 RETURNS_QUANTITY_EXCEEDS_AVAILABLE` / `409 RETURNS_ALREADY_OPEN` |
| GET | `/api/v1/orders/:orderId/returns` | `authenticate` | Ownership-or-`returns:read` — lists an order's returns (can be more than one over time) |
| GET | `/api/v1/returns/:id` | `authenticate` | Ownership-or-`returns:read`, resolved through the parent Order. `404` (not `403`) if neither |
| GET | `/api/v1/admin/returns` | `authenticate` + `returns:read` | Filters: `status?`, `orderId?` + pagination |
| PATCH | `/api/v1/admin/returns/:id/approve` | `authenticate` + `returns:update` | `REQUESTED → APPROVED` |
| PATCH | `/api/v1/admin/returns/:id/reject` | `authenticate` + `returns:update` | `REQUESTED → REJECTED`. Body: `{ rejectionReason }` (required) |
| PATCH | `/api/v1/admin/returns/:id/receive` | `authenticate` + `returns:update` | `APPROVED → RECEIVED`. Restocks inventory, advances `Order.status → RETURNED` (first time only) |
| PATCH | `/api/v1/admin/returns/:id/refund` | `authenticate` + `returns:update` | `RECEIVED → REFUNDED`. Calls `PaymentsService.refund()`, advances `Order.status → REFUNDED` (first time only) |

`GET/POST /orders/:orderId/returns` is mounted at `/orders`, the exact "own router, shared mount prefix" pattern Shipping already established for `GET /orders/:orderId/shipment` — no `orders.routes.ts` edit needed. `GET /returns/:id` is flat, matching Payments' own `/payments/:id`. Separate action endpoints (not one generic `PATCH .../status`) mirror Payments' `mark-paid`/`mark-failed`/`refund` split, since each transition here has a distinct, non-interchangeable side effect.

## Return / ReturnItem model

`Return`: one row per return request. `status` (`ReturnStatus`), `reason?` (customer-supplied, free text — no PRD reason enum), `rejectionReason?` (required at `REJECTED`, mirrors Payments' `mark-failed`), `refundAmount?` (populated once `REFUNDED`, for audit clarity), `requestedByUserId`/`reviewedByUserId?` (actor references), `reviewedAt?`/`receivedAt?`/`refundedAt?` timestamps.

`ReturnItem`: one row per returned `OrderItem` line, with the quantity being returned. References `orderItemId` (the immutable checkout-time snapshot) — refund calculation always reads `OrderItem.unitAmount`, never current Catalog/Pricing.

A hand-added **partial unique index** (Prisma has no native partial-index syntax — same precedent as `Payment`'s active-payment-per-order index) enforces **at most one open Return per Order at a time**:
```sql
CREATE UNIQUE INDEX "returns_orderId_open_unique" ON "returns" ("orderId") WHERE "status" IN ('REQUESTED', 'APPROVED', 'RECEIVED');
```
Terminal returns (`REJECTED`/`REFUNDED`) are left unconstrained, so a later, separate partial return against the same order stays possible. This single constraint is also the primary concurrency defense for return *creation* — it structurally prevents two overlapping partial-return flows against the same order, so over-return prevention across *sequential* returns only needs a plain read-time sum check (`sumReturnedQuantities`), not per-item row locking. Classified **B** — a deliberate simplification consistent with Payment's own precedent for the same kind of constraint.

## Return lifecycle

```
REQUESTED -> APPROVED   (staff, returns:update)
REQUESTED -> REJECTED   (staff, returns:update, rejectionReason required)
APPROVED  -> RECEIVED   (staff, returns:update) — restocks inventory, Order -> RETURNED (first time only)
RECEIVED  -> REFUNDED   (staff, returns:update) — calls PaymentsService.refund(), Order -> REFUNDED (first time only)
```
No `CANCELLED`/withdraw-by-customer state — the PRD names none; deferred (**C**). Every transition is written through `ReturnsRepository.transitionStatus`, the identical guarded `UPDATE ... WHERE status = expectedCurrentStatus` template Orders/Payments/Shipping all use; `0` rows → `409 RETURNS_STATUS_CONFLICT`.

## Eligibility (classified D — confirmed with the requester, deviates from the PRD's literal example)

Eligible once `Order.status` has reached `COMPLETED`, `RETURNED`, or `REFUNDED` — **not** the PRD's literal `DELIVERED` example. Rationale: Inventory's `reserve`/`release` primitives are all-or-nothing per order reference, with no partial-release capability. A return filed while an order is only `DELIVERED` (reservation not yet released, `onHand` not yet decremented) cannot be partially unwound without adding new partial-release logic to Inventory — forbidden scope for this phase. By `COMPLETED`, Orders' own `DELIVERED → COMPLETED` step has already fully released the reservation and decremented `onHand`, so a return's inventory action is always a simple, always-correct `adjust(+quantity)` restock, with no branching or partial-release invention needed.

`RETURNED`/`REFUNDED` are included in the eligible set alongside `COMPLETED` for a subtle but important reason found during implementation (see "A design gap found and fixed" below): `Order.status` advances to `RETURNED`/`REFUNDED` the moment *any* return against the order is received/refunded, but per-item remaining-quantity is what should actually gate a *specific* return request, not a single coarse Order-level status. Restricting eligibility to `COMPLETED` only would make a second, legitimate partial return against a different (or the same, remaining-quantity) line impossible after the first return finished processing.

The exact PRD literal is `DELIVERED → RETURN REQUESTED` (§55/§56) — `COMPLETED`-eligibility is a documented deviation, not a PRD-literal implementation, made explicitly to keep partial-item returns correct without redesigning Inventory.

## Partial-return / Order-status invariant matrix (Phase 4P, Part D)

States what's already true in code (re-verified, not changed) as one explicit table, closing a documentation gap — not a code gap:

| `Order.status` | Meaning | Can a new Return be created? |
|---|---|---|
| `COMPLETED` | No return yet processed against this order | Yes |
| `RETURNED` | At least one return has reached `RECEIVED` | Yes, if remaining quantity exists on any line |
| `REFUNDED` | At least one return has reached `REFUNDED` | Yes, if remaining quantity exists on any line |
| anything else | Not yet eligible, or terminal without ever having had a return (`CANCELLED`/`FAILED`) | No — `422 RETURNS_ORDER_NOT_RETURNABLE` |

**`Order.status ∈ {RETURNED, REFUNDED}` is never "the whole order is returned/refunded."** It means, exactly and only, "at least one return has happened against this order" — a coarse signal, not a quantity. The authoritative per-item truth is always `ordered - Σ(non-REJECTED returned quantities)`, computed fresh on every return-creation attempt by `ReturnsRepository.sumReturnedQuantities` against `ReturnItem`/`OrderItem` — entirely independent of `Order.status`. A partial return against one `OrderItem` line has zero effect on a second, untouched line's returnability; both are gated purely by their own quantity math. Regression-tested (`returns.test.ts`): sequential partial returns that together exactly exhaust one line's quantity (a further attempt correctly gets `RETURNS_QUANTITY_EXCEEDS_AVAILABLE`), and a partial return on one line leaving an untouched second line's full original quantity still returnable.

## A design gap found and fixed (during this phase's own implementation, not a prior-phase carry-forward)

The first working implementation advanced `Order.status` to `RETURNED` unconditionally at every `receive()` and to `REFUNDED` unconditionally at every `refund()`, using a hardcoded `expectedCurrentStatus`. Testing a second, sequential partial return against the same order (a different remaining quantity of the same line, after the first return had fully processed) surfaced a genuine defect: since eligibility originally required `Order.status === "COMPLETED"` exactly, and the first return's `refund()` had already advanced `Order.status` to `REFUNDED`, the second — entirely legitimate — return request was rejected with `422 RETURNS_ORDER_NOT_RETURNABLE`, even though the order still had returnable quantity remaining on that line.

**Fix:** (1) eligibility now accepts `COMPLETED`/`RETURNED`/`REFUNDED` (see above); (2) the `Order.status` advancement in `receive()`/`refund()` is now conditional and best-effort — it only fires the first time (`if (order.status === "COMPLETED")` / `if (order.status === "RETURNED")`), and a subsequent return's advancement attempt is simply skipped (the order already reflects "has had a return," which remains true). `Order.status` therefore signals *that* a return has happened, not a precise per-item accounting — that precision lives on `ReturnItem`/`OrderItem` via `sumReturnedQuantities`, exactly where it belongs. Regression-tested (`returns.test.ts`, "allows a second, later partial return against the same order once the first is REFUNDED").

## Order boundary

`OrdersService` gained one new method, `transitionForReturns(orderId, actorUserId, expectedCurrentStatus, newStatus: "RETURNED" | "REFUNDED", reason?)` — the only Orders file touched this phase. It mirrors the exact `updatePaymentStatus`/`updateShipmentStatus` internal-passthrough posture ("permission already checked by the caller, before reaching here") but, unlike those two (which write a separate, unguarded column), reuses `OrdersRepository.transitionStatus` itself — since `Order.status` is the field being advanced here, the guarded-UPDATE concurrency and the `OrderStatusHistory` audit-trail insert both still apply. It deliberately bypasses `ORDER_TRANSITIONS`/`TERMINAL_STATUSES` (the staff-facing `PATCH .../status` endpoint's own gate, which already excluded every transition into `RETURNED`/`REFUNDED` with the comment "payment/returns-domain-driven, not built here") — `ORDER_TRANSITIONS` itself is **not modified**, so the public staff endpoint's behavior is completely unaffected by this phase. Returns never writes `Order.status` any other way.

## Payment/refund boundary

`ReturnsService.refund()` calls `PaymentsService.refund(paymentId, amountOverride)` directly (service-to-service, no HTTP hop) — **not** a second refund implementation. `refund()`'s existing `refundLocked` (row-locked transaction, remaining-amount check, provider call, idempotent no-op on repeat — Phase 4L hardening) is reused as-is.

**Concurrency note:** the guarded `RECEIVED → REFUNDED` Return-status transition is deliberately performed *before* calling into Payments, not after. Payments' own idempotency only protects a *repeated* call with the same amount from over-refunding the *payment* — it does not protect against two concurrent callers each having enough remaining headroom to legitimately succeed once, which would double-refund the same Return. Because the Return's own guarded transition settles the race first, the Payments call is only ever invoked once per Return, regardless of concurrent requests. Regression-tested (`returns.test.ts`, "survives two concurrent refund() requests").

**Phase 4O defect fix — claim/confirm/revert.** Claiming `REFUNDED` before the Payments call succeeds means a failure there (a provider error, an amount that no longer fits the captured total, etc.) could previously leave the Return permanently reporting `REFUNDED` while no money had actually moved — a false financial record, with the guard itself blocking any retry (`RECEIVED → REFUNDED` no longer matches). Fixed: the Payments call is now wrapped in a try/catch; on failure, a second guarded transition reverts the claim (`REFUNDED → RECEIVED`) before the original error is rethrown. This makes a failed refund attempt retryable — the Return returns to its true state (`RECEIVED`) rather than lying about being refunded. A failure to write the revert itself (e.g. the database becomes unreachable mid-request) is a residual, infrastructure-level risk that still surfaces the original error rather than being silently swallowed. Regression-tested (`returns.test.ts`, "reverts the Return to RECEIVED... when the underlying Payments call fails").

**Refund amount (classified D — PRD silent):** `sum(orderItem.unitAmount * returnedQuantity)` over the Return's items — item cost only. `discountAmount`/`shippingAmount`/`taxAmount` proration onto a partial return is **not implemented** — no PRD rule, no precedent anywhere in this codebase for splitting these across a partial quantity. Deferred as an open question for a future phase if promotions/tax/shipping-refund policy is ever specified. The amount is always computed from the immutable `OrderItem` snapshot, never current Catalog/Pricing.

**COD refund — resolved in Phase 4O.** `PaymentsService.refund()` delegates to `resolveProvider(payment.provider).refundPayment(...)`, and COD's provider always throws `providerOperationUnsupported` — by Payments' own documented design, "a COD refund is an out-of-band real-world cash return, not a system action." Since COD is the PRD's primary payment method for both markets, a Return against a COD order previously could reach `RECEIVED` but never `REFUNDED`. **Fixed:** `ReturnsService.refund()` now branches on `payment.provider` — a COD payment goes through the new `PaymentsService.markRefunded()` (a staff-attested, no-provider-call action, precedent-matched to `markPaid`/`markFailed`; see `docs/modules/PAYMENTS.md`) instead of the provider-calling `refund()`. This is **not a second refund implementation** — `markRefunded()` reuses `refundLocked`'s exact row-locked, remaining-amount-checked mechanism, only swapping the provider call for a staff-supplied reference. The PRD itself has no rule for COD refunds at all (no "COD refund"/"cash refund"/"refund attestation"/"manual refund" text anywhere) — this is a documented **D** decision (safest minimal MVP contract, precedent-consistent), not a PRD-literal requirement. Regression-tested (`returns.test.ts`, "completes REQUESTED -> ... -> REFUNDED for a COD order via staff refund attestation").

**Refund provenance (Phase 4P, Part B).** Both `PaymentsService.refund()` and `markRefunded()` now accept an optional `returnId`, threaded through by `ReturnsService.refund()`, and stamp the resulting `PaymentTransaction.metadata` with `{ source: "GATEWAY_REFUND" | "COD_ATTESTATION", returnId }`. Before this, a Return-driven refund was only informally distinguishable from a standalone staff refund via a `providerReference` string prefix — not a structured, queryable field. `providerReference` now carries only the actual provider reference or the staff's own free-text reference, never a smuggled return id. Regression-tested (`returns.test.ts`/`payments.test.ts`): a Return-driven COD refund tags `COD_ATTESTATION` with `returnId` set; a Return-driven gateway (MOCK) refund tags `GATEWAY_REFUND` with `returnId` set; a standalone (non-Return) refund of either kind tags the same `source` with `returnId: null`.

**Distributed-refund failure (Phase 4P, Part C — documented, not built around).** `refundLocked` calls the provider *inside* its own DB transaction; a crash between a successful external provider call and the local commit cannot be made atomic by any local transaction — a known limitation of any external-API-inside-a-DB-transaction design, not specific to this codebase. **Not exercised today**: MOCK's `refundPayment` is synchronous/local (no real external call), and COD's `markRefunded` never calls a provider at all — there is no real gateway yet for this risk to actually manifest against. If a real gateway is integrated later, the reconciliation mechanism already exists in skeleton form — `PaymentTransactionType`/`WebhookEvent` already include `REFUND` as a legal type, and `applyWebhookEvent` is generic over event type — but this path is **not currently tested for refunds**, only for `CAPTURE`/`PAID`. There is **no current operator/admin manual-reconciliation action** for a payment stuck `PAID`/`PARTIALLY_REFUNDED` locally while a real gateway believes it refunded. Left as a named, deferred item for a future real-provider integration phase — not built here, since no real provider exists yet to test a fix against.

## Inventory boundary

On `APPROVED → RECEIVED`, for each `ReturnItem` with a non-null `orderItem.variantId` (skip if null — the "source catalog row was deleted since checkout" limitation Orders already established for its own `COMPLETED` decrement), the stock row is resolved (`variantId` + `order.marketId`) and `InventoryRepository.adjust(stockId, +quantity, reason: "return:${returnId}", actorUserId)` is called — reusing the existing `ADJUSTMENT` movement type, no new type invented, the exact precedent Orders already set for its own `COMPLETED` decrement (a negative `adjust()`). `adjust()` is non-idempotent, so the same "guarded transition settles the winner before any inventory call" pattern Orders/Payments/Shipping all use applies here too: the guarded `APPROVED → RECEIVED` transition must win first; only the winner calls `adjust()`, exactly once per item, per return. No `Warehouse` introduced. `available = onHand - reserved` is preserved by construction — restocking only ever increases `onHand`; `reserved` is untouched, since the original reservation was already fully released at `COMPLETED` (before this domain's `COMPLETED`-only eligibility rule even allows a return to be filed).

## Shipping boundary

None. Returns does not read or write `Shipment` at all this phase. This is deliberate: `ShipmentStatus.RETURNED` already exists and means "delivery failure / return-to-sender" — a carrier-side event Shipping's own state machine reaches from `IN_TRANSIT`/`DELIVERED`, entirely distinct from a customer-initiated merchandise return. Reusing or overloading that enum value for this domain's concept would create a genuine naming collision; Returns avoids it entirely by deriving eligibility from `Order.status` only (sufficient given the `COMPLETED`-only decision above). Return-shipment/tracking/RMA-label concepts: the PRD is silent — deferred (**C**).

## RBAC

`returns: ["read", "update"]` — a genuinely new permission resource (unlike Shipping's, which turned out to already be pre-seeded ahead of its own phase). Added to `seed.ts`'s `permissionMatrix` (48 → 50 permissions). Grants: `admin`/`order_manager` get `expand("returns")` — the PRD's own §6.7 Order Manager description literally lists "Returns/refunds" as a responsibility, the strongest RBAC-relevant signal the PRD gives anywhere for this domain; `store_manager`/`customer_support` get `returns:read` only, mirroring their existing `payments:read`/`shipping:read`-only posture. Customer: no permission — ownership-based, resolved through the parent Order exactly like Payments/Shipping (`RbacService.authorizeOwnerOrPermission`, override permission `returns:read`; a failed check is `404`, never `403`).

`Order.status → RETURNED/REFUNDED` transitions do not introduce or require a separate permission of their own — they're reached only via `transitionForReturns`, called after `ReturnsService`'s own `returns:update` check has already gated the action; there is no public, directly-permissioned route to that method. `orders:refund` remains seeded-but-unwired (unchanged — this phase deliberately did not wire it, since `returns:update` already covers the relevant staff actions and adding a second permission check to the same action would be redundant, not protective).

## Market / business boundary

No multi-tenant architecture; no `Warehouse` entity introduced. Returns has no market-specific behavior of its own — eligibility and refund amount are computed entirely from the historical `Order`/`OrderItem`/`Payment` snapshots, which already carry their own `marketId`/`currencyCode`.

## Idempotency / concurrency

- Return creation: the open-return partial unique index is the sole guard (no generic `IdempotencyKey` table).
- approve/reject/receive/refund: guarded status transitions, `0` rows → `409 RETURNS_STATUS_CONFLICT`.
- Inventory restock: gated on the guarded `RECEIVED` transition's winner, exactly once — same Orders precedent.
- Refund: gated on the guarded `REFUNDED` transition's winner, exactly once, before `PaymentsService.refund()` is ever called (see "Payment/refund boundary" above) — fully delegated to Payments' already-hardened `refundLocked` for the actual money-movement idempotency.
- Regression-tested against the real Postgres test database: concurrent duplicate return-creation attempts (one `201`, one `409`), concurrent `receive()` requests (exactly one `ADJUSTMENT` movement), concurrent `refund()` requests (exactly one `REFUND` `PaymentTransaction`).

## Audit logging

**Phase 4P:** `AuditLog` now exists (`docs/modules/AUDITLOG.md`). Returns' own staff actions (`approve`/`reject`/`receive`/`refund`) are wired — each writes an `AuditLog` row (`APPROVE_RETURN`/`REJECT_RETURN`/`RECEIVE_RETURN`/`REFUND_RETURN`) at the controller layer, no service-layer change. Customer-initiated `create` is **not** wired — the PRD's own audit-action list (§38) names only staff/administrative actions, not customer self-service ones.

## Reused existing infrastructure (nothing reinvented)

`RbacService.authorizeOwnerOrPermission`, `requirePermission`/`requireVerifiedEmail` middleware, `paginationQuerySchema`/`toSkipTake`/`toPaginationMeta`, `successResponse`/`errorResponse`, the guarded-UPDATE optimistic-concurrency pattern (from Orders/Payments/Shipping), the "own router, shared mount prefix" pattern (from Shipping, itself from Pricing/Inventory), `PaymentsService.refund()`/`refundLocked` (no second refund implementation), `InventoryRepository.adjust()` (no new Inventory API), and `returns/prismaErrors.ts`'s `isUniqueConstraintViolation` helper (copied per this codebase's established per-module-copy precedent — also the mechanism that catches the hand-added `returns_orderId_open_unique` partial-index violation, since that index isn't declared in `schema.prisma` and is only visible via the `driverAdapterError` fallback path).

## Dependencies

Orders (`transitionForReturns`, the sole write path into `Order.status → RETURNED/REFUNDED`; direct read of `Order`/`OrderItem` for eligibility/refund-amount computation), Payments (`PaymentsService.refund()`, the sole refund mechanism), Inventory (`InventoryRepository.adjust()`, restock), RBAC (`authorizeOwnerOrPermission`, permission checks). Shipping — deliberately not integrated (see "Shipping boundary"). Notifications — not integrated.

## Explicit out of scope

- **Return-shipment/tracking/RMA** — PRD is silent; deferred.
- **Damaged/non-sellable/quarantine inventory routing** — the PRD only names a bare "Return" inventory-movement-type label with no policy detail; every returned item is restocked as sellable via `adjust()`, with no branch for damaged goods. Deferred — no PRD support for a quarantine concept, and Inventory has no non-sellable state to route into.
- **Return window / time limit** — PRD gives no day-count or expiry rule; none enforced.
- **Excluded products/categories from returns** — PRD gives no such rule; every item is returnable subject to quantity limits only.
- **`CANCELLED`/customer-withdraw return state** — PRD names none.
- **Shipping-cost/discount/tax proration on partial refunds** — see "Refund amount" above.
- **Redis or distributed idempotency/locking** — Postgres guarded updates and the partial unique index only, per the "no overengineering" constraint on this phase.

**Security considerations:** Refund amount is never accepted from the client — always computed server-side from the immutable `OrderItem` snapshot. Customers reach only their own order's returns (ownership resolved through the parent Order, never a client-supplied `userId`); a failed check returns `404`, never `403`. All staff mutations are permission-gated (`returns:update`); read access is split from write access (`returns:read` alone cannot approve/reject/receive/refund — regression-tested).

**Phase 6H:** `/admin/orders/[id]` now exposes approve/reject/receive/refund as staff actions on open returns (`frontend/src/components/admin/orders/ReturnActions.tsx`), gated on `returns:update` — this module's first frontend of any kind. No backend change; the four actions and their transitions are exactly as documented above.

**Current status:** **COMPLETE** (Phase 4N, hardened in Phase 4O, provenance-tagged/documented in Phase 4P) — `Return`/`ReturnItem` migration (additive, one hand-added partial unique index), full customer/staff API, Orders integration (`transitionForReturns`), Payments integration (delegated `refund()`/`markRefunded()`, now provenance-tagged), Inventory integration (`adjust()` restock), RBAC wiring (`returns:read`/`returns:update`, newly seeded), AuditLog wiring on all four staff actions, 21 integration tests (eligibility incl. the Part D invariant matrix, lifecycle, retrieval/RBAC, concurrency, COD refund attestation, refund-failure revert).

**Future notes:** A future phase could add a return-shipping/RMA flow (once/if the PRD or product direction ever specifies one), shipping/tax/discount proration rules for partial refunds, or a real-provider-integration phase that would need to address the distributed-refund-failure gap documented above.
