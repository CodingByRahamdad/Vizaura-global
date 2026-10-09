# PAYMENTS Module

**Purpose:** Record and reconcile payment attempts against `Order` rows Checkout creates — payment initiation (at checkout time), provider-driven confirmation via signature-verified webhooks, staff-driven COD confirmation, and refunds.

**Responsibilities:** `Payment` creation (inside Checkout's own transaction, never standalone), payment retrieval, staff mark-paid/mark-failed for COD, refunds, inbound webhook signature verification + idempotent processing, `Order.paymentStatus` updates (the sole writer).

**Data ownership:** `Payment`, `PaymentTransaction`, `PaymentWebhookEvent`. `Order`/`OrderItem`/`OrderAddress` remain owned by Checkout; `Order.status` remains owned by Orders (`OrdersRepository.transitionStatus`) — Payments writes only `Order.paymentStatus`, via the new `OrdersService.updatePaymentStatus` passthrough.

**Main entities:** `Payment` (one row per payment attempt against an Order), `PaymentTransaction` (append-only event history: authorization/capture/refund/void), `PaymentWebhookEvent` (idempotency ledger for inbound webhook deliveries, keyed on `(provider, eventId)`).

**API boundary:**

| Method | Path | Auth | Ownership/Permission | Notes |
|---|---|---|---|---|
| GET | `/api/v1/payments/:id` | `authenticate` | `RbacService.authorizeOwnerOrPermission(payments:read)`, ownership resolved through the payment's parent Order | Failed check is `404`, never `403` — same posture as Orders |
| POST | `/api/v1/payments/:id/refund` | `authenticate` + `requirePermission("payments:refund")` | route-level | Body `{ amount? }`; omitted = full remaining captured amount. Idempotent — repeat call against an already-`REFUNDED` payment is a no-op |
| GET | `/api/v1/admin/payments` | `authenticate` + `requirePermission("payments:read")` | route-level | Filters: `status`, `provider`, `orderId` + pagination |
| PATCH | `/api/v1/admin/payments/:id/mark-paid` | `authenticate` + `requirePermission("payments:update")` | route-level | COD-only; `422 PAYMENTS_STAFF_ACTION_UNSUPPORTED` for any other provider |
| PATCH | `/api/v1/admin/payments/:id/mark-failed` | `authenticate` + `requirePermission("payments:update")` | route-level | Body `{ reason }`; COD-only, same rejection |
| PATCH | `/api/v1/admin/payments/:id/mark-refunded` | `authenticate` + `requirePermission("payments:refund")` | route-level | **Phase 4O.** Body `{ amount?, reference? }`; COD-only staff refund attestation — no provider call, reuses `refundLocked`'s row lock/remaining-amount check as-is. `422 PAYMENTS_STAFF_ACTION_UNSUPPORTED` for any other provider |
| POST | `/api/v1/webhooks/payments/:provider` | HMAC signature only — no `authenticate`, no CSRF | none | Raw body; mounted directly in `app.ts`, **outside** `apiV1Router` |

Endpoints are flat under `/payments/:id` rather than nested under `/orders/:id/payment` — refund/mark-paid/mark-failed all address the *payment*, and every `Payment` already carries `orderId` for cross-reference.

## Payment model

One `Payment` row is created per payment **attempt**, inside Checkout's own `convertCartAndCreateOrder` transaction (`checkout.repository.ts`), immediately after `Order` creation. `amount`/`currencyCode` are always copied from the same authoritative, server-computed Order totals Checkout itself just wrote — never client-supplied, and never re-derived later. `Payment.idempotencyKey` is derived as `` payment:${checkoutIdempotencyKey} ``, which makes it replay-safe for free: one checkout attempt (one idempotency key) produces exactly one `Payment` row, with no separate idempotency mechanism needed for payment creation itself.

`Payment.status` reuses the existing `OrderPaymentStatus` enum (`PENDING, AUTHORIZED, PAID, FAILED, CANCELLED, REFUNDED, PARTIALLY_REFUNDED`) rather than declaring a duplicate, PRD-shaped `PaymentStatus` enum. That enum was already exactly this value set — pre-declared on `Order.paymentStatus` back in Phase 4I "for a future Payments phase." A byte-identical second enum would only raise "which one is authoritative" confusion; reusing it also makes the `Payment.status → Order.paymentStatus` handoff a same-type assignment, not a translation layer.

A hand-added **partial unique index** (Prisma has no native partial-index syntax — same precedent as `CartItem`'s hand-added CHECK constraint and the `order_number_seq` sequence) enforces that only one `Payment` per `Order` may be `AUTHORIZED` or `PAID` at a time:

```sql
CREATE UNIQUE INDEX "payments_orderId_active_unique" ON "payments" ("orderId") WHERE "status" IN ('AUTHORIZED', 'PAID');
```

Failed/cancelled/pending attempts are unconstrained, so a genuine retry (a second checkout of the same cart after a first payment attempt failed) stays possible without hitting a false unique-constraint failure.

`PaymentTransaction` is an append-only log, one row per authorization/capture/refund/void event — mirrors the PRD's own "history, not overwrite" design, and is the audit trail a single mutable `Payment.status` column can't provide by itself.

## Payment lifecycle

```
PENDING → PAID            (COD: staff mark-paid, or MOCK: webhook)
PENDING → FAILED          (COD: staff mark-failed, or MOCK: webhook)
PAID → PARTIALLY_REFUNDED (refund, amount < remaining captured)
PAID → REFUNDED           (refund, amount == remaining captured)
PARTIALLY_REFUNDED → PARTIALLY_REFUNDED / REFUNDED (further partial/final refund)
```

Every transition is written through `PaymentsRepository.updateStatus`, a guarded, single-statement `UPDATE payments SET status = $new WHERE id = $id AND status = $currentlyExpected` — the same optimistic-concurrency pattern Orders' `transitionStatus` and Checkout's cart-conversion guard already use. `0` rows updated (a concurrent writer already moved this payment) surfaces as `409 PAYMENTS_STATUS_CONFLICT`, except inside webhook processing, where a lost race is resolved specially (see Webhook security, below) rather than surfaced as an HTTP error, since there is no client waiting on that response.

**Phase 4L hardening:** `markPaid`/`markFailed` (the COD staff actions) now additionally require the parent Order to be non-terminal (`assertOrderPayable`, same `CANCELLED|COMPLETED|FAILED|REFUNDED|RETURNED` set the webhook path already checked) before touching `Payment.status`, rejecting with `422 PAYMENTS_ORDER_NOT_PAYABLE` otherwise. Previously only the webhook path had this guard — a COD payment left `PENDING` on an order a staff member separately cancelled could still be marked paid/failed by another staff member, producing an inconsistent `Order.status = CANCELLED` + `Order.paymentStatus = PAID`. `refund()` intentionally has no equivalent guard (see PRD alignment table).

**Auth-vs-capture decision:** neither provider defers capture. Both `createPayment` (at checkout time) and webhook/staff confirmation resolve directly toward `PAID` — there is no intermediate `AUTHORIZED` state actually reached by either COD or MOCK. `AUTHORIZED` remains a legal enum value (reused from `OrderPaymentStatus`) for a future real provider that does split authorize/capture; a `CAPTURE`-typed `PaymentTransaction` row is still written on confirmation for audit-trail parity with the PRD's intent, even though no separate authorization step preceded it. Documented as an explicit simplification, not an oversight — see PRD deviations below.

## Payment ↔ Order relationship

- `Payment.orderId → Order.id`, `onDelete: Restrict` — matches Order's own posture toward its financial child records (mirrors how `Order` itself restricts deletion via `userId`/`marketId`); an `Order` with any `Payment` row can no longer be hard-deleted.
- Payments writes **only** `Order.paymentStatus`, via `OrdersService.updatePaymentStatus(orderId, newPaymentStatus)` — a thin, intentionally **unpermissioned** passthrough down to `OrdersRepository.updatePaymentStatus`. It's an internal cross-module call, not an HTTP action; the permission check already happened at the Payments layer (`payments:update`/`payments:refund`/webhook signature verification) before this is ever called.
- `OrdersRepository.updatePaymentStatus` has **no `expectedCurrentStatus` guard**, unlike `transitionStatus`. Unlike `Order.status`, `paymentStatus` has no PRD-defined transition table, and Payments is its sole writer (`OrdersService.updateStatus` never touches it) — the race that actually matters (which `Payment` attempt "wins") is already resolved upstream by `Payment.status`'s own guarded update and the partial unique index, so a second guard here would be redundant, not protective.
- Payments **never** calls `OrdersService.updateStatus`. `Order.status` advancement (`PENDING → CONFIRMED → ...`) stays exclusively a staff action through the existing `PATCH /admin/orders/:id/status` endpoint — see "Payment failure → Order/Inventory" below for the full rationale.

## Payment methods

Only PRD-documented/environment-appropriate methods are accepted, enforced at **two** independent layers:

1. `checkout.service.ts`: `ALLOWED_PAYMENT_METHODS = env.isProduction ? ["COD"] : ["COD", "MOCK"]` — rejects anything else at checkout validation time (`checkoutErrors.paymentMethodUnsupported`).
2. `providers/index.ts`'s `resolveProvider(key)`: excludes `"MOCK"` whenever `env.isProduction`, independent of what Checkout already filtered. **This is the actual enforcement point** — no code path (staff action, webhook, or a future direct-call bug) can construct or process a live MOCK payment in production, even if layer 1 were ever bypassed.

`COD` (Cash on Delivery) is the only real payment method — it has no gateway; its terminal states are reached exclusively via staff `mark-paid`/`mark-failed`. `MOCK` is dev/test-only infrastructure whose sole purpose is to let the PRD's webhook-security requirements be genuinely built and exercised (signature verification, idempotency, duplicate/out-of-order handling) rather than stubbed — it is not itself a PRD-named payment method.

## Provider abstraction

`backend/src/modules/payments/providers/`:

```ts
interface PaymentProvider {
  readonly key: string; // "COD" | "MOCK"
  createPayment(params): Promise<{ status: OrderPaymentStatus; providerPaymentId?: string }>;
  refundPayment(params): Promise<{ status: OrderPaymentStatus; providerReference?: string }>;
  handleWebhook(rawBody: Buffer, signatureHeader: string | undefined): WebhookEvent; // sync verify + parse, no DB access
}
```

- `cod.provider.ts` — `createPayment` returns `{ status: "PENDING" }` synchronously, no network call. `refundPayment`/`handleWebhook` both throw `paymentsErrors.providerOperationUnsupported("COD", ...)` — COD has no gateway to call.
- `mock.provider.ts` — `createPayment` also returns `{ status: "PENDING" }`. `refundPayment` synchronously flips status and returns a synthetic `providerReference`. `handleWebhook` computes `HMAC-SHA256(rawBody, env.payments.mockWebhookSecret)` and compares it against the `X-Webhook-Signature` header via a length-checked `crypto.timingSafeEqual`, then parses the JSON body into a `WebhookEvent`.
- `providers/index.ts` — `resolveProvider(key)` maps `{COD, MOCK}` to their implementations, production-gates `MOCK` (above), and throws `paymentsErrors.unsupportedProvider(key)` for anything else.

No `verifyPayment()` — the interface omits it, the one genuine drop from the PRD's own `PaymentProvider` sketch (§2C.12: `createPayment/verifyPayment/refundPayment/handleWebhook`). Neither COD nor MOCK has a poll-based-verify gateway to justify it; the webhook is the sole confirmation path, matching the PRD's own "a frontend redirect is never proof of payment" principle — there is nothing to poll here. (**Phase 4L correction:** an earlier draft of this doc additionally claimed `capturePayment()` was dropped from the PRD's interface — it was never there. The PRD's `PaymentProvider` sketch only names the four methods above; `CAPTURE` appears solely as a `PaymentTransaction.type` enum value, not an interface method. `capturePayment()` is not a deviation because it was never a requirement.) The interface is left extensible: a future real provider can add a `capturePayment()` method without breaking these call sites.

There is no `mock-confirm` HTTP endpoint or loopback network call. A webhook always originates from the provider's own servers in reality, so MOCK's tests simulate exactly that: construct a correctly-signed payload with the known test secret and `POST /api/v1/webhooks/payments/mock`, the same shape a real provider callback would arrive in.

## Idempotency

Three independent, non-overlapping mechanisms — no generic `IdempotencyKey` table exists or is added (consistent with Checkout's own unique-column approach, not a shared table):

1. **Payment creation** — `Payment.idempotencyKey` (unique), derived from Checkout's own idempotency key. A retried/duplicate checkout call produces zero additional `Payment` rows.
2. **Webhook delivery** — `PaymentWebhookEvent`'s `@@unique([provider, eventId])`. The insert relies on the DB constraint itself as the idempotency check: a caught unique-violation *is* the "duplicate delivery" signal, handled with a silent, normal 200 response — no separate pre-check query, no race between check and insert. **Phase 4L hardening:** the catch is now narrowed to the specific P2002 violation on `eventId` (`isUniqueConstraintViolation`, previously a bare `catch {}` that would have silently swallowed any DB error — a connection blip, an unrelated constraint failure — and misreported it as "already processed"). Anything else now propagates as a genuine 500, matching every other module's `isUniqueConstraintViolation` usage.
3. **Refunds** — a repeat refund request against an already-`REFUNDED` payment is a service-level no-op (`refund()` returns the current payment unchanged rather than calling the provider or writing a second `REFUND` transaction).

## Webhook security

`POST /api/v1/webhooks/payments/:provider` is mounted **before** the global `express.json()`/`cookieParser()`/`csrfProtection` chain in `app.ts`, scoped only to that path prefix with its own `express.raw({ type: "application/json", limit: "100kb" })`:

```ts
app.use("/api/v1/webhooks/payments", express.raw({ type: "application/json", limit: "100kb" }), paymentsWebhookRouter);
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use(csrfProtection);
app.use("/api/v1", apiV1Router);
```

Express never routes a request past a matched earlier `app.use`, so `csrfProtection` genuinely never runs for this path — no internal changes to CSRF middleware were needed. The handler never reads `req.auth`; authentication here *is* the HMAC signature over the exact raw bytes received, not a session or bearer token.

`PaymentsService.processWebhook` sequence — every outcome after a valid signature responds normally (200), so a legitimate provider is never told to retry something a retry can't fix; only a **bad/missing signature** propagates as an error (400):

1. `resolveProvider(providerKey)` — unknown provider → 400.
2. `provider.handleWebhook(rawBody, signatureHeader)` — verifies HMAC-SHA256 via `timingSafeEqual`, parses the body. Bad/missing signature → `webhookSignatureInvalid` (400).
3. `findByProviderPaymentId` — no matching `Payment` → the event is recorded standalone (`recordWebhookEventStandalone`, idempotent, narrowed-catch — see Idempotency), logged (`console.warn`), silent return, 200 (an internal lookup miss should never make an external provider retry forever).
4. Validate the order isn't in a terminal status and `event.amount === payment.amount && event.currencyCode === payment.currencyCode` — mismatch → event recorded standalone, logged, silent return, 200. A provider retry of the same event is a guaranteed no-op once recorded; a mismatch is a provider-side data bug to investigate out-of-band, not something a retry fixes.
5. `applyWebhookEvent(...)` — **Phase 4L hardening:** the webhook-event insert, the guarded `Payment.status` UPDATE, and the `PaymentTransaction` insert now run inside **one Prisma transaction**, not three independent statements. Previously the event record committed on its own before the status update ran; a crash in between would leave the event durably marked "received" with its status change never applied, and — because a resend of that exact `eventId` now permanently short-circuits as a duplicate — with no way to ever retry it. Wrapping the three together means either all three commit or none do, so a genuine retry is always still possible after a crash.
   - Unique-violation on `(provider, eventId)` inside the transaction = **duplicate delivery** → the whole transaction aborts (nothing else could have applied either), silent return, 200. Covers exact-retry, retry-after-timeout, and a re-sent event with the same id.
   - `0` rows from the guarded status UPDATE = **lost race** (a concurrent event already moved this payment, e.g. a success and a failure arriving close together) — the transaction still commits (the event row is kept), and the service re-fetches the payment: if its current status already equals what this event wanted, that's treated as a no-op success (duplicate/out-of-order delivery); otherwise it's logged and dropped. **No last-writer-wins** — only the guarded winner's state is ever kept.
   - Otherwise: applied — `Payment.status` updated, `PaymentTransaction` written.
6. `ordersService.updatePaymentStatus(payment.orderId, event.status)` — only reached once step 5 actually applied a status change.

No client-supplied "I paid" signal is ever trusted — Checkout only ever creates `Payment` rows as `PENDING`; the only paths to `PAID` are a signature-verified webhook or an explicit staff action gated by `payments:update`.

## Failure/retry behavior — Payment failure → Order/Inventory (PRD gap, resolved)

The PRD never specifies what should happen to `Order`/inventory when a payment fails. Resolved as: **payment failure never auto-cancels the order or touches inventory.** A `FAILED` payment updates only `Payment.status` and `Order.paymentStatus`; `Order.status` is left exactly where it was, and Payments makes zero calls into Inventory (no new inventory code exists anywhere in this module).

Rationale: Orders' own documentation already describes `FAILED`/`REFUNDED`/`RETURNED` as "payment/returns-domain-driven" gaps left for staff to fill manually, not automatic triggers. Auto-cancelling on payment failure would release the inventory reservation out from under an order the customer might still retry payment on, and the PRD specifies no retry-window/timeout that would tell an automatic process when a failure should be treated as final versus retryable. Staff make that call explicitly, using the existing `PATCH /admin/orders/:id/status → CANCELLED` (which already releases the reservation) once a failed payment is judged unrecoverable — no new endpoint was needed.

The same logic applies to `PAID`: it does **not** auto-advance `Order.status`. Only `Order.paymentStatus → PAID` is written; status advancement (`PENDING → CONFIRMED → ...`) stays a staff action via the existing endpoint. This is a literal reading of the PRD's own illustrative example (`status: PROCESSING, paymentStatus: PAID` shown as independently co-occurring fields), and it preserves `OrdersRepository.transitionStatus` as the sole writer of `Order.status`.

## Refund behavior

`PaymentsService.refund(paymentId, amountOverride?)`:

- No-op if already fully `REFUNDED` (idempotent, returns the current payment unchanged).
- Requires `PAID` or `PARTIALLY_REFUNDED`; any other status → `422 PAYMENTS_INVALID_STATUS_TRANSITION`.
- Computes `remaining = payment.amount - sum(REFUND-type transaction amounts so far)`. A requested amount exceeding `remaining` → `422 PAYMENTS_REFUND_EXCEEDS_CAPTURED`. Omitted amount defaults to the full `remaining`.
- Delegates to `resolveProvider(payment.provider).refundPayment(...)` — COD throws `providerOperationUnsupported` (no gateway to refund through; a COD refund is an out-of-band real-world cash return, not a system action), MOCK synchronously succeeds.
- New status is `REFUNDED` if the refund fully covers what's left captured, else `PARTIALLY_REFUNDED`; written in the same transaction as the `REFUND`-typed `PaymentTransaction`, then `ordersService.updatePaymentStatus`.
- Gated by `payments:refund` at the route level. Refund ownership/authorization is therefore **staff-only** by permission, not resolved by order ownership — a customer can never self-serve a refund through this endpoint (no such PRD requirement exists; `orders:refund`-equivalent self-service was never in scope).
- **Phase 4N:** `refund()` itself has no permission check baked in (only the HTTP route does) — this is exactly what let Returns call it directly, service-to-service, as an internal cross-module call gated by its own `returns:update` permission instead, the same "permission already checked by the caller" posture `updatePaymentStatus`/`updateShipmentStatus` already established. No second refund implementation was written for Returns.
- **Phase 4O — `markRefunded(paymentId, actorUserId, amountOverride?, reference?)`:** closes the COD-refund gap flagged in Phase 4N. COD has no provider to call, so the provider-calling `refund()` above always threw `providerOperationUnsupported` for it. `markRefunded` is COD's staff-attested complement — precedent-matched to `markPaid`/`markFailed` (`requireCodPayment` guard, rejects any other provider with `422 PAYMENTS_STAFF_ACTION_UNSUPPORTED`) — and is **not a second refund implementation**: it calls the exact same `PaymentsRepository.refundLocked` as `refund()`, passing a synthetic `callProvider` callback that records the staff-supplied `reference` (or a `staff:${actorUserId}` fallback) as the transaction's `providerReference` instead of calling out to a gateway. Same row lock, same remaining-amount/over-refund check, same `PaymentTransaction`/`Order.paymentStatus` write path. `ReturnsService.refund()` now branches to this for a COD payment instead of the provider-calling `refund()` — see `docs/modules/RETURNS.md`'s "Payment/refund boundary."
- **Phase 4P — refund provenance.** Both `refund(paymentId, amountOverride?, returnId?)` and `markRefunded(paymentId, actorUserId, amountOverride?, reference?, returnId?)` gained an optional trailing `returnId` parameter. `refundLocked` (below) now accepts an optional `metadata` argument, written onto the resulting `PaymentTransaction` row: `{ source: "GATEWAY_REFUND" | "COD_ATTESTATION", returnId: string | null }`. Before this, a Return-driven refund was only informally distinguishable from a standalone staff refund by parsing a `providerReference` string prefix — not a structured, queryable field, and the audited gap this phase closes. `ReturnsService.refund()` now passes its own `returnId` through to whichever Payments method it calls; the standalone `POST /payments/:id/refund` and `PATCH /admin/payments/:id/mark-refunded` routes never pass one (`returnId: null` in their resulting metadata), since neither is Return-driven.

**Phase 4L hardening — concurrent-refund race:** the remaining-amount computation, over-refund check, provider call, and write now all happen inside one `PaymentsRepository.refundLocked` transaction that takes a Postgres row lock (`SELECT ... FOR UPDATE`) on the target `Payment` before reading it. Previously these steps ran as a plain read followed by a guarded-but-independent status UPDATE: two concurrent partial-refund requests could both read the same `remaining`, both pass the over-refund check, and both call `provider.refundPayment` before either write landed — only one `REFUND` transaction/status write would ultimately land (the loser got `409`), but the provider itself could have been invoked twice. The row lock now serializes concurrent requests against the same payment; the second request blocks until the first commits, then re-reads the now-reduced `remaining` before deciding whether to proceed, so at most one accepted refund (and one provider call) can happen per available amount. Regression-tested with two concurrent partial-refund requests whose combined amount exceeds the captured total (`payments.test.ts`, "serializes concurrent partial-refund requests").

**Phase 4P — distributed-refund failure, documented not built around.** `refundLocked` calls `callProvider(...)` *inside* its own DB transaction (see the implementation below). A crash between a successful external provider call and the local transaction's commit cannot be made atomic by any local transaction — this is a known limitation of calling an external API from inside a DB transaction, true of any such design, not specific to this codebase. **Not exercised today**: `mockProvider.refundPayment` is synchronous/local (no real external HTTP call), and `markRefunded` never calls a provider at all — there is no real gateway yet for this risk to actually manifest against. If/when a real gateway is integrated, the natural reconciliation path already exists in skeleton form: `PaymentTransactionType`/`WebhookEvent` already include `REFUND` as a legal type, and `applyWebhookEvent` is generic over event type — but **this path is not currently tested for refunds**, only for `CAPTURE`/`PAID`. There is **no current operator/admin manual-reconciliation action** for a payment left `PAID`/`PARTIALLY_REFUNDED` locally while a real gateway believes it already refunded. Left as a named, deferred item for a future real-provider integration phase.

## Inventory interaction

None, directly. Payments does not import or call `InventoryRepository` anywhere. Any inventory consequence of a payment outcome flows exclusively through the pre-existing Orders transition path (`DELIVERED → COMPLETED` decrements, any `→ CANCELLED` releases) — see "Failure/retry behavior" above for why payment failure does not itself trigger that path automatically.

## Order status interaction

Payments writes `Order.paymentStatus` only, via `OrdersService.updatePaymentStatus`. It never calls `OrdersService.updateStatus` and never touches `Order.status` under any circumstance (success, failure, or refund). See "Payment ↔ Order relationship" and "Failure/retry behavior" above.

## RBAC / ownership

- `GET /payments/:id`: `RbacService.authorizeOwnerOrPermission({resourceOwnerId: order.userId, requesterId, state, overridePermission: "payments:read"})` — ownership is resolved through the payment's **parent Order** (a `Payment` carries no `userId` of its own). A failed check is `404`, matching Orders' "never distinguish not-yours from doesn't-exist" posture.
- `POST /payments/:id/refund`: route-level `payments:refund`.
- `GET /admin/payments`, `PATCH /admin/payments/:id/mark-paid`, `PATCH /admin/payments/:id/mark-failed`: route-level `payments:read`/`payments:update`/`payments:update` respectively.
- `PATCH /admin/payments/:id/mark-refunded` (Phase 4O): route-level `payments:refund` — the stricter permission (not `payments:update`), since this writes a refund-equivalent record after capture, not merely settling a still-`PENDING` payment.
- Webhook: no RBAC at all — authorization is the HMAC signature (see Webhook security).
- Permission seeding: `payments: ["read", "refund", "update"]` in `seed.ts` — unchanged this phase, no new permission key was needed (`markRefunded` reuses `payments:refund`). `expand("payments")` grants all three to `admin`/`order_manager`; `store_manager`/`customer_support` keep only their pre-existing literal `payments:read`.

## Database / migrations

Migration `payments_foundation` — purely additive: `CREATE TYPE "PaymentTransactionType"`, three new tables (`payments`, `payment_transactions`, `payment_webhook_events`), the hand-added partial unique index (above), and two FKs (`payments.orderId → orders.id` Restrict, `payment_transactions.paymentId → payments.id` Cascade). No existing table's schema changed; no existing row touched. Applied to both `vizaura_global_dev` and `vizaura_global_test` (via `migrate dev` then `DATABASE_URL=<test> migrate deploy`, per the two-database split documented in `docs/DATABASE.md`), with `seed.ts` re-run on both afterward for the new `payments:update` permission.

## PRD alignment / deviations

| Requirement | Status | Decision |
|---|---|---|
| `Payment`/`PaymentTransaction` model | **Implemented** | `Payment` reuses `OrderPaymentStatus` rather than a duplicate `PaymentStatus` enum (see Payment model, above) |
| Provider abstraction, no hard-coded provider | **Implemented** | `PaymentProvider` interface + `COD`/`MOCK`; PRD's own "Stripe" mention is explicitly an anti-pattern example, not a chosen provider |
| Full 4-method interface (`createPayment/verifyPayment/refundPayment/handleWebhook`) | **Deviation (B — intentional)** | Only `verifyPayment` is actually dropped — no provider here has a poll-based-verify gateway to justify it; see Provider abstraction. (`capturePayment()` was never in the PRD's interface — see the Phase 4L correction there.) |
| Webhook signature verification, idempotency, no client-trusted success | **Implemented** | HMAC-SHA256 + `timingSafeEqual`, `(provider, eventId)` unique constraint, `Payment` only ever starts `PENDING` |
| Generic `IdempotencyKey` table | **Deviation (D — PRD ambiguous)** | Three separate unique-column mechanisms instead (see Idempotency) — consistent with Checkout's own precedent, not a shared table. The PRD's first mention (§62) hedges "a future model can be"; its second (§2B.27) is more prescriptive. Not retrofitted onto Checkout for this phase — documented rather than redesigning a completed domain. |
| Payments-specific permission keys (`payments:read/update/refund`) | **Deviation (D — PRD ambiguous)** | The PRD never defines a payments permission domain in any of its 5 example permission lists — only `orders:refund` exists there. The implemented `payments:*` taxonomy is a necessary extension the PRD's own authorization model requires but never named. |
| Order-state gating for payment creation/success/failure/refund | **PRD ambiguous, explicitly deferred by the PRD itself** ("exact state machine rules should be finalized during implementation architecture") | **Phase 4L correction:** `mark-paid`/`mark-failed` now reject with `422 PAYMENTS_ORDER_NOT_PAYABLE` if the parent Order is in a terminal status (`CANCELLED\|COMPLETED\|FAILED\|REFUNDED\|RETURNED`), matching the guard the webhook path already had. `refund()` deliberately has no such guard — refunding a payment on an order that was cancelled *after* being paid is the legitimate case this endpoint exists for. |
| Deferred authorize-then-capture | **Deviation, documented simplification** | Both providers resolve directly to `PAID`; `AUTHORIZED` stays a legal but currently-unreached enum value |
| Payment failure → Order/Inventory consequence | **PRD gap, resolved** | No auto-cancel, no auto inventory release; staff-driven via the existing Orders cancel endpoint — see Failure/retry behavior |
| Currency matches Order's historical currency | **Implemented** | `Payment.currencyCode` copied from Order at creation, never re-derived |
| Payment amount authority | **Implemented** | Always copied from server-computed Order totals inside Checkout's transaction; never accepted from the client at any layer |
| Raw card/CVV storage | **Not applicable / never built** | Only COD and MOCK exist; neither has card fields anywhere in the schema or request bodies |
| Refund ownership | **Staff-only via `payments:refund`** | No customer self-service refund path exists (not a PRD requirement) |
| Webhook path naming (`provider-a` in some PRD examples) | **Deviation** | Generalized to `:provider` route param, matching the two real providers built here |
| COD refund mechanism | **Deviation (D — PRD silent, resolved Phase 4O)** | No PRD text anywhere mentions "COD refund," "cash refund," "refund attestation," or "manual refund." `markRefunded` — a staff-attested, no-provider-call action precedent-matched to `markPaid`/`markFailed` — closes the gap as the safest minimal MVP contract; see Refund behavior above and `docs/modules/RETURNS.md` |

## Reused existing infrastructure (nothing reinvented)

`RbacService.authorizeOwnerOrPermission`, `requirePermission` middleware, `paginationQuerySchema`/`toSkipTake`/`toPaginationMeta`, `successResponse`/`errorResponse`, the guarded-UPDATE optimistic-concurrency pattern (from Orders/Checkout), and `checkout/prismaErrors.ts`'s `isUniqueConstraintViolation` helper (copied per this codebase's established per-module-copy precedent, not imported cross-module).

## Dependencies

Checkout (creates every `Payment` row, inside its own transaction), Orders (`OrdersService.updatePaymentStatus`, the sole write path into `Order.paymentStatus`), RBAC (`authorizeOwnerOrPermission`, permission checks). Shipping (Phase 4M, COMPLETE) and Payments remain fully independent of each other by design — neither reads nor writes the other's state; see `docs/modules/SHIPPING.md`'s "Payment ↔ Shipment boundary." Returns (Phase 4N, COMPLETE) calls `PaymentsService.refund()` directly as a consumer — the one place another module calls *into* Payments' service layer rather than Payments calling out; see `docs/modules/RETURNS.md`. Notifications — not integrated.

## Explicit out of scope

- **Real provider integration** — no real payment gateway is named or chosen anywhere in the PRD; none is integrated here.
- **Shipping** — no shipment step in the webhook sequence, confirmed still true now that Shipping (Phase 4M) exists: `PATCH /admin/shipments/:id` does not check `Payment.status`, and Payments does not check `Shipment.status`.
- **Full Returns workflow** — refunds stop at `PaymentTransaction`/`OrderPaymentStatus`; no return-merchandise/inspection flow. **Update, Phase 4N:** the return-merchandise/inspection flow now exists in `docs/modules/RETURNS.md` and calls this module's own `refund()` — Payments itself required no change to support it.
- **FX / multi-currency settlement** — `currencyCode` is recorded and matched, never converted.
- **Raw card/CVV storage** — never touched; no card fields exist anywhere in this module.
- **Redis or distributed idempotency/locking** — Postgres unique constraints and guarded updates only, per the "no overengineering" constraint on this phase.
- **`orders:refund`** — stays seeded-but-unwired (unchanged from Phase 4J); refunds here are authorized by `payments:refund`, a separate permission.
- **True deferred authorize-then-capture** — interface left extensible, not built (see PRD alignment table).

**Security considerations:** All inbound provider webhooks are signature-verified (HMAC-SHA256, `timingSafeEqual`) before any state is trusted; no payment amount is ever accepted from the client at creation or webhook time — only server-computed Order totals (creation) or a signature-verified, amount-matched webhook event (confirmation) are authoritative. `MOCK` is unreachable in production at two independent layers (Checkout's allow-list and `resolveProvider` itself). Customers reach only payments on their own orders (ownership resolved through the parent Order, never a client-supplied `userId`); a customer requesting another customer's payment gets `404`, never `403`.

**Phase 6H:** `/admin/orders/[id]` now exposes mark-paid/mark-failed/mark-refunded (COD) and refund (gateway) as staff actions (`frontend/src/components/admin/orders/PaymentActions.tsx`). No backend change — the endpoints, permissions, and state machine documented above were already complete; this only wired the existing frontend permission keys (`payments:update`/`payments:refund`) to real controls. The frontend chooses mark-* vs. refund purely by `provider === "COD"`, matching this module's own COD-vs-gateway split.

**Current status:** **COMPLETE** (Phase 4K, hardened Phase 4L, COD-refund gap closed Phase 4O, refund provenance/audit wiring Phase 4P) — `Payment`/`PaymentTransaction`/`PaymentWebhookEvent` migration, provider abstraction (`COD`, `MOCK`), webhook endpoint with signature verification and idempotent, transactional processing, Checkout integration (Payment row creation), Orders integration (`updatePaymentStatus` passthrough), staff mark-paid/mark-failed/mark-refunded (all order-state-guarded or COD-guarded as appropriate, all AuditLog-wired), refunds (lock-serialized, provenance-tagged), RBAC wiring, 34 integration tests (creation regression/concurrency, retrieval, mark-paid/mark-failed incl. order-terminal-state rejection, webhook happy path + signature rejection + duplicate delivery + race + mismatch rejections, refund idempotency + over-refund rejection + concurrent-refund serialization + provenance tagging, permission matrix, mark-refunded COD-only guard + amount/permission rejection + concurrency + provenance tagging).

**Phase 4L — hardening audit (this phase):** Read against `docs/SHILAJIT _PRD.md` (exact filename, confirmed). Three defects found and fixed with regression tests: (1) webhook event-record + status-update + transaction-create were three independent statements, not one transaction, and the duplicate-delivery catch was unscoped — both fixed (see Webhook security); (2) refund had a concurrency window permitting a double provider-refund call under concurrent requests — fixed with a row-locked transaction (see Refund behavior); (3) `mark-paid`/`mark-failed` had no Order-terminal-state guard, unlike the webhook path — fixed (see Payment lifecycle). One documentation error corrected: `capturePayment()` was never in the PRD's `PaymentProvider` interface (only `CAPTURE` as a `PaymentTransaction.type` value) — only `verifyPayment()` is an actual PRD deviation (see Provider abstraction). Deferred, not implemented this phase: pending-payment timeout/expiry (no PRD requirement — no `Payment.expiresAt` anywhere in the PRD, unlike Session/Cart/IdempotencyKey), and a generic audit-log system (no `AuditLog` model exists anywhere in this codebase, for any domain — building one is beyond a Payments-only hardening phase). The `Inventory.warehouseId`/`Warehouse` discrepancy flagged in earlier phases remains open and untouched — Payments makes zero Inventory calls, so it has no bearing on this phase.

**Phase 4N:** Returns (COMPLETE) now calls this module's existing `refund()` directly, exactly as anticipated above — no change was needed to Payments itself to support it. It also surfaced a real, confirmed limitation worth recording here: COD's `refundPayment()` always throws `providerOperationUnsupported`, so a Return against a COD order could not complete a refund through this mechanism — resolved in Phase 4O, see below.

**Phase 4O — COD-refund gap closed:** Added `markRefunded(paymentId, actorUserId, amountOverride?, reference?)`, a COD-only staff attestation precedent-matched to `markPaid`/`markFailed` and reusing `refundLocked` as-is (see Refund behavior above) — not a second refund implementation. Exposed at `PATCH /admin/payments/:id/mark-refunded` (`payments:refund`-gated). `ReturnsService.refund()` now branches a COD payment to this method instead of the provider-calling `refund()`, closing the gap `docs/modules/RETURNS.md` previously documented as unresolved. This phase also found and fixed a genuine, separate defect in `ReturnsService.refund()` itself (not a Payments change): it claimed the Return's `RECEIVED → REFUNDED` transition *before* calling into Payments, and a failure there (COD's old unconditional throw, or any other Payments-layer rejection) left the Return permanently, falsely reporting `REFUNDED` with no actual refund applied and no retry path. Fixed with a claim/confirm/revert pattern in Returns — see `docs/modules/RETURNS.md`'s "Payment/refund boundary."

**Phase 4P:** Closed the refund-provenance gap (`refund()`/`markRefunded()` now tag `PaymentTransaction.metadata` with `{ source, returnId }` — see Refund behavior) and documented, without building around, the distributed-refund-failure risk that only a real gateway integration could actually trigger (see above). Wired `AuditLog` recording (Phase 4P's new foundation, `docs/modules/AUDITLOG.md`) onto `refund`/`markPaid`/`markFailed`/`markRefunded` at the controller layer — no service-layer change.

**Future notes:** A future real-provider phase adds a concrete gateway behind the existing `PaymentProvider` interface (likely adding a `capturePayment()` method) without changing any call site, and would need to address the distributed-refund-failure gap documented above (webhook-based reconciliation for refunds is not yet tested). A future Shipping-adjacent phase remains fully independent of Payments.
