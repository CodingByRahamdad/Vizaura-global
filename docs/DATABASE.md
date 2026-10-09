# DATABASE.md

Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) first.

Status: the **database foundation is implemented** (Phase 4C) for Identity, Users, RBAC, Markets, Catalog and Pricing, plus **Inventory** (Phase 4G), **Cart** (Phase 4H), **Checkout's output — Order/OrderItem/OrderAddress** (Phase 4I), **Orders' status-history audit trail — OrderStatusHistory** (Phase 4J), **Payments — Payment/PaymentTransaction/PaymentWebhookEvent** (Phase 4K), **Shipping — ShippingMethod/Shipment, plus a new `Order.shipmentStatus` column** (Phase 4M), **Returns — Return/ReturnItem** (Phase 4N), and **Audit — AuditLog** (Phase 4P), each its own migration — see below. Business logic is implemented for Catalog, Pricing, Inventory, Cart, Checkout, Orders, Payments, Shipping, Returns and Audit; Identity/RBAC/Markets have business logic for Auth/RBAC but Markets itself has no dedicated service yet. All other domains are not modelled yet.

## Technology

- PostgreSQL (validated against 18.6)
- Prisma ORM **7.10.0** (`prisma` CLI + `@prisma/client`), pinned to an exact stable minor
- `@prisma/adapter-pg` + `pg` — Prisma 7 connects through a driver adapter rather than a bundled query engine

### Prisma 7 layout (differs from older Prisma guides)

- `backend/prisma/schema.prisma` — models. The `datasource` block holds **no `url`**; Prisma 7 rejects it.
- `backend/prisma.config.ts` — CLI configuration: schema path, `datasource.url` from `DATABASE_URL`, migrations path, seed command.
- Generated client output: `backend/src/generated/prisma` (ESM, `.js` import extensions to satisfy the backend's `NodeNext` module resolution). It is gitignored and rebuilt with `npm run db:generate`.
- `backend/src/db/prismaClient.ts` — the single place `PrismaClient` is constructed, using `PrismaPg`. Only repository modules (`backend/src/modules/*/*.repository.ts`) import from here — Prisma itself is never touched from a controller or service. Moved here from `src/repositories/` in Phase 4D-2 once the backend adopted the feature-first `src/modules/<domain>/` structure documented in [ARCHITECTURE.md](ARCHITECTURE.md).

## Domain Ownership

Implemented: **Identity** (users, credentials, sessions, verification/reset tokens) · **RBAC** (roles, permissions, and their joins) · **Markets** · **Catalog** (categories, products, options, variants, media) · **Product availability per market** · **Pricing** · **Inventory** (stock, movements, reservations — Phase 4G) · **Cart** (carts, cart items — Phase 4H) · **Checkout's output** (orders, order items, order addresses — Phase 4I; Checkout owns creation only, see [modules/CHECKOUT.md](modules/CHECKOUT.md)) · **Payments** (Phase 4K) · **Shipping** (shipping methods, shipments — Phase 4M) · **Returns** (returns, return items — Phase 4N) · **Audit** (audit logs — Phase 4P).

Not yet modelled: Customers, Promotions, Notifications, CMS, Analytics. Each arrives with its own phase. (Reviews and Wishlist were modelled in Phases 5C-1 and 4P-adjacent respectively — see [modules/REVIEWS.md](modules/REVIEWS.md) and [modules/WISHLIST.md](modules/WISHLIST.md) — and are no longer in this "not yet modelled" set.)

## Entities (35 tables)

| Domain | Tables |
|---|---|
| Identity | `users`, `sessions`, `email_verification_tokens`, `password_reset_tokens` |
| RBAC | `roles`, `permissions`, `user_roles`, `role_permissions` |
| Markets | `markets` |
| Catalog | `categories`, `products`, `product_categories`, `product_options`, `product_option_values`, `product_variants`, `variant_option_values`, `product_media` |
| Availability | `product_markets` |
| Pricing | `variant_prices` |
| Inventory | `variant_stocks`, `stock_movements`, `stock_reservations` |
| Cart | `carts`, `cart_items` |
| Checkout's output | `orders`, `order_items`, `order_addresses` |
| Orders | `order_status_histories` |
| Payments | `payments`, `payment_transactions`, `payment_webhook_events` |
| Shipping | `shipping_methods`, `shipments` |
| Returns | `returns`, `return_items` |
| Audit | `audit_logs` |

Prisma models use PascalCase; tables are snake_case via `@@map`.

## Key Relationships

- `User` –< `UserRole` >– `Role` –< `RolePermission` >– `Permission` (many-to-many both hops; permissions are reusable across roles).
- `User` –< `Session` — one row per refresh-token session.
- `Category` self-references via `parentId` (adjacency list) for nested categories. No closure table — unjustified complexity at this catalog size.
- `Product` –< `ProductVariant` –< `VariantPrice` >– `Market`.
- `Product` –< `ProductMarket` >– `Market` — per-market availability.
- `ProductVariant` –< `VariantOptionValue` >– `ProductOptionValue` –< `ProductOption` — normalized variant options.
- `ProductVariant` –< `VariantStock` >– `Market` — stock per variant per market (Phase 4G), the same shape as `VariantPrice`. `VariantStock` –< `StockMovement` (audit trail) and –< `StockReservation` (generic hold, keyed by an opaque caller reference).
- `User` –< `Cart` >– `Market` — one cart per user per market (Phase 4H), `@@unique([userId, marketId])`. `Cart` –< `CartItem` >– `ProductVariant`, `@@unique([cartId, variantId])`. No price is stored on `CartItem` — see [modules/CART.md](modules/CART.md).
- `User` –< `Order` >– `Market` — Checkout's output (Phase 4I), `onDelete: Restrict` on both FKs (a financial record must not vanish because a user or market row is removed, unlike Cart's disposable working state). `Order` –< `OrderItem` (Cascade) with nullable, `SetNull`-on-delete `productId`/`variantId` — snapshotted fields (name, SKU, unit price) mean history survives even if the source row is later removed. `Order` –< `OrderAddress?` (one-to-one, Cascade) — an inline shipping-destination snapshot, not a FK to a reusable address book (no Customers/Address domain exists yet). See [modules/CHECKOUT.md](modules/CHECKOUT.md).
- `Order` –< `Payment` (Phase 4K), `onDelete: Restrict` — same financial-record posture as `Order`'s own `userId`/`marketId` FKs; an order with any payment attempt can no longer be hard-deleted. `Payment` –< `PaymentTransaction` (Cascade) — the append-only per-payment event history. `PaymentWebhookEvent` has no FK to any other table — keyed only on `(provider, eventId)`, kept independently for webhook-idempotency auditing even after its related `Payment` would otherwise be gone. See [modules/PAYMENTS.md](modules/PAYMENTS.md).
- `Order` –< `Shipment?` (Phase 4M, one-to-one, `orderId @unique`), `onDelete: Restrict` — same fulfillment-record posture as `Payment.orderId`. `Shipment` >– `ShippingMethod` (`onDelete: Restrict`) — a market-scoped rate/method row, `ShippingMethod` –< `Market`. No `ShipmentItem`/history table exists — see [modules/SHIPPING.md](modules/SHIPPING.md).
- `Order` –< `Return[]` (Phase 4N, one-to-many — unlike `Payment`/`Shipment`, an order can have several sequential returns over time), `onDelete: Restrict`. `Return` –< `ReturnItem` (Cascade) >– `OrderItem` (`onDelete: Restrict` — a return line must not silently vanish if its source order line is somehow removed). `Return` also references `User` twice (`requestedByUserId` Restrict, `reviewedByUserId?` SetNull) — see [modules/RETURNS.md](modules/RETURNS.md).

### Variants are the unit of sale

Price, SKU and inventory attach to **`ProductVariant`, never to `Product`** — including for simple products, which carry exactly one variant flagged `isDefault`. Future cart and order lines reference a variant. This avoids per-entity fallback logic leaking through the cart, checkout and order code.

## Money Representation

- Monetary amounts are **`Int` in the currency's minor unit**. PKR 4,999 is stored as `499900` paisa; AED 149 as `14900` fils. Never floating point, never `Decimal`.
- `Market.currencyMinorUnits` records the exponent (2 for both PKR and AED) and is used for **formatting only** — never for conversion.
- Every monetary row carries its own `currencyCode` alongside its market reference.
- Ceiling per value is int4 (~PKR 21.4M), far above this catalog. `BigInt` is the escape hatch if that ever changes.

## Market & Pricing Model

- Markets are **business configuration boundaries, not tenants**. There is no `tenantId` anywhere and there must never be one.
- `VariantPrice` is unique per `(variantId, marketId)` — one current price row per variant per market.
- **Pakistan and UAE prices are independent commercial decisions.** No FX conversion exists anywhere in the schema or code. Exchange rates, if ever introduced, are for reporting only.
- Sale pricing uses `saleAmount` plus an optional `saleStartsAt`/`saleEndsAt` window (an unset bound is open-ended).
- Regular-price history/versioning is deliberately deferred: orders will snapshot prices at purchase time, which is what history is actually needed for.
- A product differs by market through `ProductMarket` (`isAvailable` = may be sold, `isVisible` = appears in listings). Products are **never duplicated** per market.

## Inventory Model (Phase 4G, re-audited Phase 4G-2)

- `VariantStock` is unique per `(variantId, marketId)` — scoped identically to `VariantPrice`. No separate warehouse/branch/location entity exists anywhere in this project; `Market` is the only defined location-like boundary. Phase 4G-2 re-verified this by searching the entire repository for "Warehouse"/"InventoryMovement" — no PRD or other document defining such entities exists; confirmed with the project owner. See [modules/INVENTORY.md](modules/INVENTORY.md)'s "Market vs. Warehouse" section for the full audit trail. **No schema change resulted.**
- `onHand` and `reserved` are stored as plain `Int`; `available` (`onHand - reserved`) is deliberately **never persisted** — derived at read time.
- **Negative inventory is prohibited**, enforced at two layers: guarded atomic `UPDATE`s in the service layer (see [modules/INVENTORY.md](modules/INVENTORY.md)), and hand-added `CHECK` constraints on `variant_stocks` (`"onHand" >= 0`, `0 <= "reserved" <= "onHand"`) — Prisma's schema language has no native `CHECK` syntax, so these were appended directly to the migration SQL, the same kind of judgment call as the partial-unique-index trade-off noted below, but taken the other way since a numeric `CHECK` is simple and low-maintenance.
- `StockMovement` records every `onHand` change (`RECEIPT`, `ADJUSTMENT`) in the same transaction as the change it explains — no schema-level way for a stock row to drift from its audit trail, only an application-transaction guarantee.
- `StockReservation` is generic and owner-agnostic: `reference` is an opaque caller-supplied string (a future Cart/Order id), unique per `(stockId, reference)` for idempotent reserve/release. No expiry/TTL column exists — that is a future Checkout-phase concern once real session semantics exist to design it against.

## Cart Model (Phase 4H)

- `Cart` is unique per `(userId, marketId)` — one cart per customer per market, enforced at the database level (the same guarantee that resolves the "concurrent cart creation" race — see [modules/CART.md](modules/CART.md)). `userId` is `NOT NULL`: the PRD's conceptual schema marks it nullable for guest-cart support, but no guest/anonymous session identity mechanism exists anywhere in this project's Auth domain — recorded as a deliberate, documented discrepancy in `modules/CART.md` rather than built or silently dropped.
- `CartStatus` (`ACTIVE`/`CONVERTED`/`ABANDONED`) and `expiresAt` exist per the PRD's documented `Cart` entity. **Phase 4I update:** `CONVERTED` is now set by Checkout on a successful order; `ABANDONED` and `expiresAt` remain unused/unenforced, reserved for a future Notifications-driven flow.
- **Known limitation, resolved without a schema change (Phase 4I):** the plain (non-partial) `@@unique([userId, marketId])` permits at most one `Cart` row ever per user+market, even after conversion. Rather than change the constraint, `CartRepository.getOrCreateCart` reactivates a non-`ACTIVE` row in place (`status → ACTIVE`) the next time the customer accesses their cart in that market — safe because Checkout already cleared its items as part of conversion. See [modules/CART.md](modules/CART.md) and [modules/CHECKOUT.md](modules/CHECKOUT.md).
- `CartItem` is unique per `(cartId, variantId)` — the PRD's own documented uniqueness rule. Adding an already-present variant increments its quantity instead of creating a second row.
- `CartItem.quantity` has a hand-added `CHECK ("quantity" > 0)` constraint (Prisma has no native `CHECK` syntax) — the same judgment call already documented above for `variant_stocks`, applied here as defense-in-depth alongside the service-layer quantity validation.
- **No price is ever persisted on `CartItem`.** Unit price and line totals are computed at read time from Pricing's current effective price and are never stored — the PRD's "never trust cart prices" rule implemented literally as "never even write a cart price," not just "don't trust a submitted one."
- Cart never reserves or decrements `VariantStock` — it only reads `available` (`onHand - reserved`) via `InventoryRepository.findByVariantAndMarket` as an availability check. Reservation ownership remains Checkout's, per Inventory's own already-documented deferral.

## Order Model (Phase 4I — Checkout's output)

- `Order.userId`/`marketId` use `onDelete: Restrict`, not `Cascade` — deliberately different from Cart's disposable working state, since an order is a financial/commercial record that must not silently vanish if a user or market row is ever removed.
- `Order.idempotencyKey` (`@unique`) is the entire idempotency mechanism — no separate `IdempotencyKey` table exists. The PRD's fuller conceptual model (`key, operation, userId, requestHash, response, expiresAt`) was deliberately simplified: the only operation that ever needs idempotency here is order creation itself, so a unique column on the protected row is smaller and needs no cleanup job. No request-hash comparison is implemented (a retry with the same key but a different body silently returns the original order) and no TTL/cleanup job exists — the unique constraint is safe indefinitely on its own, just not self-pruning. See [modules/CHECKOUT.md](modules/CHECKOUT.md).
- `Order.orderNumber` (`@unique`) is generated from a hand-added Postgres `SEQUENCE` (`order_number_seq`), formatted at insert time as `ORD-{year}-{6-digit nextval}` — Prisma's schema language has no way to express a formatted, DB-generated default. Sequences are non-transactional by design in Postgres (a rolled-back checkout attempt can leave a numbering gap); acceptable, since order numbers only need to be unique, not gapless.
- `Order.paymentMethod` is a plain `String`, not a Prisma enum — the PRD explicitly leaves the eventual provider list open; Checkout validates it against `"COD"` (always) plus `"MOCK"` (non-production only, Phase 4K). `Order.paymentStatus` (`OrderPaymentStatus` enum) is now actively written by Payments (Phase 4K) via `OrdersService.updatePaymentStatus` — no longer just pre-declared. `Order.status` (`OrderStatus` enum) remains written exclusively by Orders' `OrdersRepository.transitionStatus`; Payments never touches it. `Order.shipmentStatus` (`ShipmentStatus` enum, Phase 4M — a genuinely new column, unlike `paymentStatus` it was never pre-declared) is written exclusively by Shipping via `OrdersService.updateShipmentStatus`, the identical unpermissioned-passthrough shape.
- `OrderItem` snapshots `sku`/`productName`/`variantName`/`unitAmount`/`currencyCode` at checkout time — never re-derived from `Product`/`ProductVariant` later, so a subsequent catalog or price edit can never change a placed order's history. `productId`/`variantId` are nullable with `onDelete: SetNull`, the same "preserve the snapshot even if the source row later disappears" pattern already used for `product_media.variantId`.
- `OrderAddress` is a one-to-one inline snapshot (`orderId @unique`), not a FK to a reusable address book — no Customers/Address domain exists yet. This is a **documented deviation** from the PRD's literal `shippingAddressId: uuid` checkout-request field.
- `discountAmount`/`taxAmount` are always `0` this phase — no Promotions or tax-configuration domain exists yet to compute them (`taxAmount` in particular has no PRD-documented mechanism beyond an unbuilt `MarketSettings.defaultTaxRate`, consistent with this file's own already-stated `MarketConfiguration` deferral above). `shippingAmount` is now real as of Phase 4M — computed by Checkout from the resolved `ShippingMethod` (see the Shipping Model section below) — but Orders itself still never rewrites it once set.
- Checkout reserves inventory (via Inventory's existing primitive) but never decrements `VariantStock.onHand` on creation — decrement now happens on the `DELIVERED → COMPLETED` transition (see below), via the Orders module, not at checkout time.

## Order Status History (Phase 4J — Orders)

- `OrderStatusHistory` is an append-only audit trail: one row per Orders-driven `Order.status` transition (`orderId`, `previousStatus`, `newStatus`, nullable `changedByUserId`, optional `reason`, `createdAt`), `@@index([orderId])`. `order` uses `onDelete: Cascade` (history has no independent meaning once its order is gone); `changedByUser` uses `onDelete: SetNull` — the same nullable-actor pattern already used for `StockMovement.createdByUserId`.
- Checkout's own `PENDING` creation is **not** recorded here — nothing "transitioned" at that point, the row simply didn't exist before. History starts at the first Orders-driven transition (`PATCH /api/v1/admin/orders/:id/status`).
- Purely additive migration (`20260919105026_orders_status_history`) — no existing `Order`/`OrderItem`/`OrderAddress` columns or rows were touched.
- Inventory side effects of a transition (release on cancellation, decrement-via-`adjust()` on completion) are **not** part of the same DB transaction as the guarded status UPDATE — they run afterward, gated on that UPDATE's winner, for the same reason Checkout's own reservation can't be nested in its order-creation transaction (Inventory's primitives open their own internal transactions). See [modules/ORDERS.md](modules/ORDERS.md) for the concurrency-safety rationale and the accepted crash-window trade-off.

## Payment Model (Phase 4K — Payments)

- `Payment` is one row per payment **attempt** against an `Order`, created inside Checkout's own transaction (`checkout.repository.ts`), not standalone. `amount`/`currencyCode` are always copied from the same authoritative Order totals Checkout just computed — never re-derived or client-supplied. `Payment.status` reuses `OrderPaymentStatus` rather than a duplicate PRD-shaped enum (see [modules/PAYMENTS.md](modules/PAYMENTS.md) for the full rationale).
- `Payment.idempotencyKey` (`@unique`) is derived from Checkout's own idempotency key (`` payment:${checkoutIdempotencyKey} ``) — a retried checkout produces zero additional `Payment` rows, with no separate idempotency mechanism needed for creation itself.
- A hand-added **partial unique index** (Prisma has no native partial-index syntax, same precedent as `CartItem`'s `CHECK` constraint and `order_number_seq`) enforces at most one `AUTHORIZED`/`PAID` `Payment` per `Order` at a time, while leaving failed/cancelled/pending attempts unconstrained so a genuine retry stays possible:
  ```sql
  CREATE UNIQUE INDEX "payments_orderId_active_unique" ON "payments" ("orderId") WHERE "status" IN ('AUTHORIZED', 'PAID');
  ```
- `PaymentTransaction` is an append-only log (one row per authorization/capture/refund/void event) — the actual audit trail; `Payment.status` alone is a mutable summary, not a history.
- `PaymentWebhookEvent` records every inbound webhook delivery, `@@unique([provider, eventId])` — the unique constraint **is** the idempotency mechanism; a caught unique-violation on insert is read directly as "duplicate delivery," with no separate pre-check query.
- Purely additive migration (`20260919115413_payments_foundation`) — no existing `Order`/`OrderItem`/`OrderAddress`/`OrderStatusHistory` column or row was touched. `payments.orderId → orders.id` uses `onDelete: Restrict` (matches `Order`'s own financial-record posture); `payment_transactions.paymentId → payments.id` uses `onDelete: Cascade`.

## Shipping Model (Phase 4M — Shipping)

- `ShippingMethod` is market-scoped (`marketId`) admin-managed rate/method configuration: `name`, `description?`, `baseRate` (Int minor units), `freeShippingThreshold?`, `estimatedMinDays?`, `estimatedMaxDays?`, `isActive`. `isActive` is the soft-delete flag — `DELETE /admin/shipping/methods/:id` archives, never hard-deletes. **No `ShippingZone` table exists** — the PRD names it but its own `ShippingMethod` schema sketch never gives it a `zoneId` FK, so building an unwired orphan table was deliberately skipped; see [modules/SHIPPING.md](modules/SHIPPING.md).
- `Shipment` is one row per `Order` (`orderId @unique` — no `ShipmentItem`/partial-fulfillment concept exists in the PRD), created inside Checkout's own transaction alongside `Payment`, not standalone (the PRD names no `POST /shipments` route). Fields: `shippingMethodId` (FK, required), `trackingNumber?`, `carrier?`, `status` (`ShipmentStatus` enum, default `PENDING`), `shippedAt?`, `deliveredAt?`. `shipments.orderId → orders.id` uses `onDelete: Restrict`, matching `Payment.orderId`'s own posture.
- `ShipmentStatus` also backs `Order.shipmentStatus` (Phase 4M) — reused rather than duplicated, the same "one shared enum, not a per-table duplicate" precedent `OrderPaymentStatus` already established for `Payment`/`Order.paymentStatus`. Reconciles two internally-inconsistent value lists in the PRD by adopting its later, formal enum pass: `PENDING, PROCESSING, SHIPPED, IN_TRANSIT, DELIVERED, RETURNED, CANCELLED`.
- **No `ShipmentEvent`/history table** — unlike `PaymentTransaction`, the PRD proposes no append-only event log for shipments; `Shipment.status` is a mutable summary, with `shippedAt`/`deliveredAt` as the only historical breadcrumbs.
- Purely additive migration (`20260919174320_shipping_foundation`) — new enum `ShipmentStatus`, new `Order.shipmentStatus` column (default `PENDING`), two new tables. No existing `Order`/`Payment`/`OrderItem`/`OrderAddress` column or row was touched beyond the new column addition. `shipping_methods.marketId → markets.id` and `shipments.shippingMethodId → shipping_methods.id` both use `onDelete: Restrict`.
- Checkout's `shippingMethod` free-text string (Phase 4I, informational-only) is **replaced**, not kept alongside, by `shippingMethodId` — see [modules/CHECKOUT.md](modules/CHECKOUT.md)'s reconciliation note and [modules/SHIPPING.md](modules/SHIPPING.md).

## Returns Model (Phase 4N — Returns)

- `Return` is one row per return **request** (not one per order — an order can have several sequential returns over time, unlike `Payment`/`Shipment`). Fields: `status` (`ReturnStatus` enum: `REQUESTED, APPROVED, REJECTED, RECEIVED, REFUNDED`), `reason?`, `rejectionReason?` (required at `REJECTED`), `refundAmount?` (populated once `REFUNDED`), `requestedByUserId`/`reviewedByUserId?`, `reviewedAt?`/`receivedAt?`/`refundedAt?`. `returns.orderId → orders.id` uses `onDelete: Restrict`, the same fulfillment-record posture as `Payment.orderId`/`Shipment.orderId`.
- `ReturnItem` is one row per returned `OrderItem` line, with the returned `quantity`. `@@unique([returnId, orderItemId])`. `return_items.orderItemId → order_items.id` uses `onDelete: Restrict` — a return line must not silently vanish if its source order line is somehow removed. Refund amount is always computed from `OrderItem.unitAmount` at read time, never persisted redundantly on `ReturnItem` itself (the immutable `OrderItem` snapshot is already the single source of truth).
- A hand-added **partial unique index** (Prisma has no native partial-index syntax, same precedent as `Payment`'s `payments_orderId_active_unique`) enforces at most one **open** (`REQUESTED`/`APPROVED`/`RECEIVED`) `Return` per `Order` at a time, leaving terminal ones (`REJECTED`/`REFUNDED`) unconstrained:
  ```sql
  CREATE UNIQUE INDEX "returns_orderId_open_unique" ON "returns" ("orderId") WHERE "status" IN ('REQUESTED', 'APPROVED', 'RECEIVED');
  ```
- Purely additive migrations (`20260919184301_returns_foundation` + `20260919184332_returns_open_unique_index`, the latter hand-edited for the partial index above, same "generate empty, hand-add the SQL Prisma can't express, apply" workflow Payments/Cart/Checkout each already used) — new enum `ReturnStatus`, two new tables, one hand-added index. No existing `Order`/`OrderItem`/`Payment`/`Shipment` column or row was touched.
- No `Order.status` column change was needed — `RETURNED`/`REFUNDED` were already pre-declared `OrderStatus` enum values (since Phase 4I, unreachable until this phase); Returns is simply the first phase to actually transition into them, via a new `OrdersService.transitionForReturns` method (`orders.service.ts`, the only Orders file touched) rather than a schema change.
- Eligibility deliberately does not gate on the PRD's literal `DELIVERED` example — see [modules/RETURNS.md](modules/RETURNS.md) for the full rationale (avoids needing a partial-release capability in Inventory's `reserve`/`release` primitives, which are all-or-nothing per reference).

## AuditLog Model (Phase 4P — Audit)

- One table, `audit_logs`: `id, userId? (SetNull), action (VarChar(100)), entityType (VarChar(50)), entityId (VarChar(64)), before? (Json), after? (Json), ipAddress? (VarChar(45)), userAgent? (VarChar(512)), createdAt`. Field list is the PRD's own §49/§2B.26 schema, implemented verbatim — see [modules/AUDITLOG.md](modules/AUDITLOG.md).
- Indexes: `[entityType, entityId]` (the primary lookup pattern — "show me this entity's history"), `[userId]`, `[action]`, `[createdAt]` (supports the PRD's own `dateFrom`/`dateTo` filter pair).
- No `updatedAt` — rows are never updated. Immutability is enforced architecturally (no `update`/`delete` method exists in `AuditLogRepository`), not via a DB trigger or `REVOKE`.
- Purely additive migration (`20260919213812_audit_log_foundation`) — new table, new `User.auditLogs` back-relation only. No existing table's column or row was touched.
- `audit_logs.userId → users.id` uses `onDelete: SetNull`, not `Restrict`/`Cascade` — matches the PRD's own delete-rules table (§58/§59/line 6766), which groups `AuditLog` with `Orders`/`Payments`/`InventoryMovement` as data that must survive user deletion.

## Authentication Persistence

Schema only — no auth code exists yet.

- **Raw refresh tokens are never stored.** `sessions.refreshTokenHash` holds a SHA-256 hash (`CHAR(64)`), uniquely indexed for lookup by hash.
- `sessions.familyId` groups a rotation chain, so replay of an already-rotated token can revoke the whole family in one statement. Chosen over a `replacedBySessionId` self-relation for equivalent semantics with less schema complexity.
- `revokedAt`/`revokedReason` support logout, password-change invalidation and administrative revocation.
- `users.passwordChangedAt` lets the auth phase reject access JWTs issued before a password change, not merely revoke refresh sessions.
- Email-verification and password-reset tokens are separate tables (no polymorphic token table), also **hashed**, single-use via `consumedAt`, and time-limited via `expiresAt`.

## RBAC Notes

- `Permission` stores the documented `key` (`products:create`) **and** `resource` + `action`. `key` is derivable; both are kept so middleware can look up by key while the admin UI groups by resource without string parsing. `@@unique([resource, action])` prevents the two representations diverging.
- `Role.isSystem` marks roles that must not be deleted or renamed (e.g. `super_admin`, `customer`) — the admin-protection requirement in [RBAC.md](RBAC.md).
- `Role.isActive` provides the role lifecycle state.

## Indexing Strategy

Indexes are deliberate, not blanket. Present: every unique/natural key (`users.email`, `roles.key`, `permissions.key`, `markets.code`, `products.slug`, `categories.slug`, `product_variants.sku`, `sessions.refreshTokenHash`, all token hashes); the non-leading side of each join table (`user_roles.roleId`, `role_permissions.permissionId`, `product_categories.categoryId`, `product_markets.marketId`, `variant_prices.marketId`, `variant_stocks.marketId`, `carts.marketId`, `cart_items.variantId`); foreign keys used for lookup (`sessions.userId`, `categories.parentId`, `product_variants.productId`, `product_media.productId`/`variantId`, `stock_movements.stockId`, `stock_reservations.stockId`); status filters expected on list screens (`users.status`, `products.status`); and `sessions.expiresAt` for expiry sweeps. Columns already covered by a unique constraint get no duplicate index.

## Deletion & Cascade Strategy

- **Cascade** (29 FKs): child rows that cannot outlive their parent — sessions and tokens under a user; variants, options, option values, media, category links, market availability, prices and stock under a product/variant; movements and reservations under a stock row; join-table rows under either side; carts under a user or market, cart items under a cart or variant; order items and the order address under an order; `PaymentTransaction` under its `Payment`; `ReturnItem` under its `Return`.
- **Restrict** (10 FKs): `categories.parentId` — a category with children must be re-parented before it can be removed, so subtrees are never orphaned; `orders.userId`/`orders.marketId` — a placed order must not silently vanish because a user or market row is removed (financial-record integrity, unlike Cart's disposable working state); `payments.orderId` (Phase 4K) — the same financial-record posture extended to `Payment`, an order with any payment attempt can no longer be hard-deleted; `shipments.orderId`, `shipments.shippingMethodId`, `shipping_methods.marketId` (Phase 4M) — the same posture extended to `Shipment`/`ShippingMethod`; `returns.orderId`, `returns.requestedByUserId`, `return_items.orderItemId` (Phase 4N) — the same posture extended to `Return`/`ReturnItem`.
- **Set null** (6 FKs): `product_media.variantId` — deleting a variant leaves product-level media intact; `stock_movements.createdByUserId` — deleting a user preserves the movement history without needing the actor to still exist; `order_items.productId`/`order_items.variantId` — an order line's snapshot (name, SKU, price) survives even if its source catalog row is later removed; `returns.reviewedByUserId` (Phase 4N) — same nullable-actor pattern as `stock_movements.createdByUserId`; `audit_logs.userId` (Phase 4P) — same nullable-actor pattern; matches the PRD's own delete-rules table (audit logs must survive user deletion).
- **Soft deletion** via `deletedAt` on `users`, `products` and `product_variants`, where history and referential integrity for future orders matter. Application queries must filter these. Note `users.email` remains uniquely constrained, so re-registering a soft-deleted email is an application-level decision. Cart rows are hard-deleted via cascade (from their user or market) — a cart is disposable working state, not commercial history; `Order` rows (Phase 4I) are the actual immutable commercial record, protected by `Restrict` rather than soft-deleted (no delete/archive operation on an order exists yet).

## Invariants Enforced in the Service Layer

The database cannot practically express these; the owning service must:

1. Every product has at least one variant, and exactly one is `isDefault`.
2. At most one `ProductMedia` per product has `isPrimary = true`.
3. `VariantPrice.currencyCode` equals its market's `currencyCode`.
4. `saleAmount`, when set, is below `amount`.
5. `VariantStock` creation is idempotent-checked (409 on a duplicate variant+market) rather than upserted, so on-hand can never be silently overwritten outside the audited `/receive`/`/adjust` operations.
6. A cart item's price is never persisted — it is computed from Pricing at read time on every request (`CartService.buildItemView`).

Postgres partial unique indexes could enforce (1) and (2) but would require hand-edited migration SQL; not worth the migration fragility at this stage. Inventory's non-negativity invariant and Cart's quantity-positivity invariant *were* judged worth hand-edited `CHECK` constraints (see Inventory Model / Cart Model above) — a plain numeric bound is far simpler and lower-risk to maintain by hand than a partial unique index.

## Migrations

- Migration files live in `backend/prisma/migrations/`. The initial migration is `20260918000000_init_foundation` (426 lines, 19 tables, 4 enums). `20260918165939_inventory_foundation` (Phase 4G) adds 3 tables, 2 enums, and 2 hand-added `CHECK` constraints on `variant_stocks`. Phase 4G-2 (architecture re-audit) added **no migration**. `20260918191604_cart_foundation` (Phase 4H) adds 2 tables (`carts`, `cart_items`) and 1 enum (`CartStatus`); `20260918191626_cart_quantity_check` (Phase 4H) adds a hand-added `CHECK ("quantity" > 0)` constraint on `cart_items`. `20260918195530_checkout_foundation` (Phase 4I) adds 3 tables (`orders`, `order_items`, `order_addresses`), 2 enums (`OrderStatus`, `OrderPaymentStatus`), and one hand-added `CREATE SEQUENCE order_number_seq` statement (backs `Order.orderNumber` generation — Prisma has no way to express a formatted DB-generated default) — the same "created via `migrate dev --create-only`, hand-edited" workflow as Inventory's/Cart's `CHECK` constraints, since Prisma's schema language can express neither. `20260919105026_orders_status_history` (Phase 4J) adds 1 table (`order_status_histories`), purely additive. `20260919115413_payments_foundation` (Phase 4K) adds 3 tables (`payments`, `payment_transactions`, `payment_webhook_events`), 1 enum (`PaymentTransactionType`), and one hand-added partial unique index (`payments_orderId_active_unique`, see Payment Model above) — same hand-edit workflow, since Prisma has no partial-index syntax either. `20260919174320_shipping_foundation` (Phase 4M) adds 2 tables (`shipping_methods`, `shipments`), 1 enum (`ShipmentStatus`), and 1 new column (`orders.shipmentStatus`) — purely additive, no hand-edited SQL needed. `20260919184301_returns_foundation` + `20260919184332_returns_open_unique_index` (Phase 4N) add 2 tables (`returns`, `return_items`), 1 enum (`ReturnStatus`), and one hand-added partial unique index (`returns_orderId_open_unique`, see Returns Model above) — same hand-edit workflow as Payments'.
- Workflow: `npm run db:migrate` (creates/applies in development), `npm run db:migrate:deploy` (applies existing migrations, for CI/production), `npm run db:reset` (drops, re-applies, re-seeds — development only).
- Every schema change ships as a reviewed migration. Never edit a production database by hand.

## Seed

`backend/prisma/seed.ts`, run with `npm run db:seed`. Fully idempotent (upserts throughout; re-running changes no row counts).

Seeds foundational reference data **only**: the 2 markets (Pakistan/PKR, UAE/AED) and the RBAC baseline — 50 `resource:action` permissions (47 through Phase 4J, `payments:update` added in Phase 4K, `returns:read`/`returns:update` added in Phase 4N) and the 9 documented roles with their initial permission sets. `shipping:read`/`shipping:update` were already part of the 48-permission count going into Phase 4M, pre-declared and pre-wired to roles ahead of the Shipping module actually existing — the same "declare ahead of the owning phase" posture `OrderStatus`'s unused enum values carried before Orders existed. `returns:*` (Phase 4N) is the first case since Payments where a genuinely **new** permission resource had to be added rather than merely wired — `admin`/`order_manager` get both; `store_manager`/`customer_support` get `returns:read` only. The role→permission mapping is a starting point to be refined when the RBAC module is built.

It deliberately creates **no** products, customers, orders, payments or inventory, and **no** admin user — bootstrapping an admin requires a password and belongs to the authentication phase.

## Development Database Setup

```
cd backend
cp .env.example .env          # then set DATABASE_URL to your local credentials
createdb vizaura_global_dev   # or: CREATE DATABASE vizaura_global_dev;
npm run db:migrate
npm run db:seed
```

`DATABASE_URL` is the only required database variable. `.env` is gitignored; credentials are never committed.

## Future Scaling

- Read replicas for reporting/analytics if load requires it.
- Partitioning for high-volume tables (orders, audit log) if needed at scale.
- A dedicated search index only if Postgres filtering/full-text becomes insufficient — not part of MVP.
- A `MarketConfiguration` table (referenced in [modules/MARKETS.md](modules/MARKETS.md)) is **deliberately deferred**: intrinsic market attributes (`currencyCode`, `currencyMinorUnits`, `timezone`) live on `Market`, and a configuration table will be introduced by the phases that actually add tax, shipping and payment-method configuration rather than shipping a near-empty table now.
