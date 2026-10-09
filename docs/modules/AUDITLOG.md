# AUDITLOG Module

**Purpose:** Record who did what, to which entity, and when, for the administrative/financial mutations the PRD explicitly names — a PRD-required foundation (§38 "Audit Logging", §49/§2B.26 schema, §2C.21 read API), not a speculative addition.

**Responsibilities:** `AuditLog` row creation (write-side, controller-triggered, never client-supplied), admin-only read access with filtering/pagination. Nothing else — there is no update or delete capability anywhere in this module.

**Data ownership:** `AuditLog` only.

## Schema

PRD §49/§2B.26 give the identical field list twice: `id, userId?, action, entityType, entityId, before?, after?, ipAddress?, userAgent?, createdAt`. Implemented verbatim:

```prisma
model AuditLog {
  id         String   @id @default(uuid(7)) @db.Uuid
  userId     String?  @db.Uuid
  action     String   @db.VarChar(100)
  entityType String   @db.VarChar(50)
  entityId   String   @db.VarChar(64)
  before     Json?
  after      Json?
  ipAddress  String?  @db.VarChar(45)
  userAgent  String?  @db.VarChar(512)
  createdAt  DateTime @default(now())

  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)
}
```

`userId` is nullable and `onDelete: SetNull` — matches the PRD's own delete-rules table (§58/§59/line 6766), which groups `AuditLog` with `Orders`/`Payments`/`InventoryMovement` as data that must survive user deletion and remain historically available.

**Immutability is architectural, not a DB constraint.** The PRD implies immutability by grouping `AuditLog` with never-delete data, but never states it as a database-level rule (no trigger, no `REVOKE UPDATE`). `AuditLogRepository` exposes only `create`/`list` — there is no `update`/`delete` method anywhere in this module, so there is structurally no code path to mutate a row once written. This matches the same posture Payments' `PaymentTransaction` already established for its own append-only history.

## API boundary

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/v1/admin/audit-logs` | `authenticate` + `requirePermission("audit:read")` | Filters: `userId?`, `action?`, `entityType?`, `entityId?`, `dateFrom?`, `dateTo?` — the exact PRD filter list (§2C.21) — plus pagination |

No write route exists — audit rows are created only by `AuditLogService.record()`, called from a controller after its own primary mutation succeeds. There is no `POST`/`PATCH`/`DELETE` under `/admin/audit-logs`.

## RBAC (classified D — PRD says "usually admin-only" but names no permission key)

`audit: ["read"]` was already pre-seeded in `seed.ts`'s `permissionMatrix` ahead of this phase (the same "pre-declare, wire later" posture Shipping/Pricing/Inventory established) — **no `seed.ts` change was needed**. Granted only via `super_admin`'s `allPermissions: true`. **Deliberately not granted to `admin`** — the `admin` role's own pre-existing description literally reads "Broad administrative access excluding role management and audit," confirming this was already the intended design before this phase existed. No other role (`store_manager`/`order_manager`/`customer_support`/etc.) holds it either. This is narrower than every other `:read` permission in this codebase, matching the PRD's "usually admin-only" phrasing and the fact that audit rows can contain every other domain's before/after data (including, transitively, anything another domain chose to log).

## Write-side wiring — controller layer, not service layer

Each wired controller action calls `recordAudit(req, { action, entityType, entityId, before?, after? })` (`src/modules/audit/auditLog.helper.ts`) **after** its own service call has already succeeded, immediately before sending the HTTP response. This is deliberate:

- **No existing service signature changes.** Every one of the seven already-complete domains this phase touches keeps its service layer completely untouched — only the controller's response-shaping code gained one line.
- **`recordAudit`/`AuditLogService.record()` never throws.** A caught internal failure is `console.warn`ed and swallowed — an audit-write failure can never block or fail the business operation it's auditing.
- **`before` is best-effort**, included only where a prior-state read was already cheap/available (e.g. price update fetches the existing price row first; delete actions fetch the entity before removing it, since that data would otherwise be lost forever). It is omitted, not faked, when not trivially available — consistent with the PRD's own twice-repeated caution to "avoid leaking sensitive information" in before/after, which favors capturing less by default.

**Wired** (the PRD's own §38 example list, plus its two worked flow diagrams for Pricing/Inventory, plus two direct-analogy extensions — Payments/Returns share "Refunds," the PRD's own named example; Shipping/Orders are the same class of privileged staff mutation):

| Domain | Action(s) | entityType |
|---|---|---|
| Catalog | `CREATE_PRODUCT`/`UPDATE_PRODUCT`/`DELETE_PRODUCT`, `CREATE_CATEGORY`/`UPDATE_CATEGORY`/`DELETE_CATEGORY` | `Product`, `Category` |
| Pricing | `UPDATE_PRODUCT_PRICE` (PRD's own literal example — §49), `DELETE_PRODUCT_PRICE` | `MarketPrice` |
| Inventory | `RECEIVE_INVENTORY`, `ADJUST_INVENTORY`, `RESERVE_INVENTORY`, `RELEASE_INVENTORY` | `VariantStock` |
| Orders | `UPDATE_ORDER_STATUS` | `Order` |
| Payments | `REFUND_PAYMENT`, `MARK_PAYMENT_PAID`, `MARK_PAYMENT_FAILED`, `MARK_PAYMENT_REFUNDED` | `Payment` |
| Shipping | `CREATE_SHIPPING_METHOD`/`UPDATE_SHIPPING_METHOD`/`ARCHIVE_SHIPPING_METHOD`, `UPDATE_SHIPMENT_STATUS` | `ShippingMethod`, `Shipment` |
| Returns | `APPROVE_RETURN`, `REJECT_RETURN`, `RECEIVE_RETURN`, `REFUND_RETURN` | `Return` |

**Not wired, explicitly, and why:**
- Catalog option/option-value/media mutations — the PRD's §38 list names only product/category-level actions, not their sub-resources; extending to every sub-resource mutation was judged scope creep beyond what the PRD actually names.
- Checkout, Cart — customer self-service actions, not "administrative actions" in the PRD's sense.
- Auth (login/register/password reset/etc.) — the PRD never ties these to `AuditLog`; a dedicated PRD research pass for this phase found no login/session-revocation audit requirement anywhere, and the PRD's own `Session` model note ("additional security metadata may be introduced later") explicitly defers this as a separate, unspecified future concern, not the same mechanism as `AuditLog`.
- **User/Role/Permission changes** — the PRD's §38 list names these explicitly, but **no mutation endpoint exists anywhere in this codebase to audit**: there is no `users.routes.ts`, no role-management route, confirmed by a full route inventory of every `*.routes.ts` file. This is **N/A, not a gap** — there is nothing to wire because nothing to audit yet. Building role-management endpoints is out of scope for this phase; when a future phase builds them, wiring their audit calls is a one-line addition per action, following the exact pattern established here.
- Promotions — the domain doesn't exist yet (confirmed `NOT STARTED` in `MODULE_STATUS.md`).

## Reused existing infrastructure (nothing reinvented)

`requirePermission` middleware, `paginationQuerySchema`/`toSkipTake`/`toPaginationMeta`, `successResponse`, the module-file layout convention (`{name}.{repository,service,validators,mapper,controller,routes}.ts`) every other domain already follows.

## Explicit out of scope

- **A generic request-correlation/trace-id field** — the PRD's schema doesn't name one; not invented.
- **Retention/archival policy or a purge job** — the PRD gives no retention period; not built.
- **Security-event logging** (login failures, session revocation) — a separate, PRD-unspecified concern; not folded into this table.
- **User/Role/Permission audit wiring** — no endpoint exists yet to wire (see above).

**Security considerations:** `before`/`after` snapshots are raw entity data as returned by the wired service call — no field-level redaction is applied. This is an accepted minimal-foundation trade-off: the PRD's own caution ("avoid leaking sensitive information") is honored by *not capturing* `before` where it isn't already cheaply available, rather than by redacting captured fields, since no entity wired this phase carries a secret field (passwords/tokens are never returned by any of the seven wired domains' service calls in the first place). `audit:read` is the most restrictive permission in this codebase — `super_admin` only.

**Current status:** **COMPLETE** (Phase 4P) — `AuditLog` migration (additive), write-side wiring across seven domains' targeted staff-mutation actions, admin-only read API, 11 integration tests (write-side wiring, RBAC on the read endpoint, filtering/pagination, no-write-route confirmation).

**Future notes:** When User/Role/Permission-management endpoints are eventually built, wire their mutations the same way (one `recordAudit` call per controller action). A dedicated security-event log (login failures, session revocation) is a distinct, PRD-unspecified future concern, not an extension of this table.
