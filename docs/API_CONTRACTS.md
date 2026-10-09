# API_CONTRACTS.md

Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) first.

## Base Path

`/api/v1`

## Domains

```
/auth
/users
/markets
/products
/categories
/cart
/checkout
/orders
/payments
/shipping
/customers
/reviews
/wishlist
/addresses
/promotions
/inventory
/admin
/admin/audit-logs
/analytics
/notifications
```

## Request Validation

All input validated at the API boundary (body, query, params) before reaching service logic. Invalid input is rejected with a `400`-class error before any business logic runs.

## Authentication

Enforced per-route via middleware reading the JWT access token from an HttpOnly cookie. See [AUTH_SECURITY.md](AUTH_SECURITY.md).

## Authorization

Enforced per-route via permission checks (see [RBAC.md](RBAC.md)), plus resource-ownership checks where applicable (e.g. a customer may only read their own orders).

## Standard Response Format

**Success:**
```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "...",
    "message": "...",
    "details": {}
  }
}
```

`error.details` is **optional** — present only for errors that carry structured extra context (e.g. field-level validation failures, the missing permission keys on a `403`). It never contains a password, hash, token, or secret. Added in Phase 4D-2 alongside the auth implementation; existing consumers that only read `code`/`message` are unaffected.

Never expose stack traces, SQL errors, Prisma internals, or secrets in any response.

## HTTP Status Conventions

- `200` success (read/update), `201` created, `204` no content (delete)
- `400` validation error, `401` unauthenticated, `403` unauthorized, `404` not found, `409` conflict
- `422` semantically invalid (e.g. business rule violation)
- `429` rate limited
- `500` unexpected server error (generic message only)

## Pagination

Cursor or offset-based pagination via query params (`page`/`limit` or `cursor`/`limit`), returned in `meta` (e.g. `meta.pagination`).

## Filtering & Sorting

Documented per-endpoint query params (e.g. `?market=PK&status=active&sort=-createdAt`). No arbitrary raw query passthrough.

## Idempotency

Mutating endpoints with financial/order side effects (payment capture, order creation) accept an `Idempotency-Key` header to prevent duplicate processing on retry. **Implemented for `POST /checkout`** (Phase 4I): the header is required; a retry with the same key returns the original order (`200`) rather than creating a second one. See `modules/CHECKOUT.md` for the exact mechanism (`Order.idempotencyKey`, a simplified single-column implementation rather than a generic system) and its documented limitation (no request-hash comparison, no TTL). **Payments (Phase 4K)** extends this rather than duplicating it: `Payment.idempotencyKey` is derived directly from the same checkout idempotency key, and inbound webhook deliveries get their own independent idempotency via `PaymentWebhookEvent`'s `(provider, eventId)` unique constraint — see `modules/PAYMENTS.md`.

## API Versioning

Breaking changes ship under a new version prefix (`/api/v2`); `/api/v1` remains stable for existing clients until deprecated.

## Ownership Checks

Any endpoint returning or mutating a customer-owned resource (order, address, review, wishlist) verifies the authenticated user owns that resource, independent of role/permission checks. **Implemented for `GET /orders/:id` and `GET /admin/orders/:id`** (Phase 4J) via `RbacService.authorizeOwnerOrPermission` — a customer reaches only their own order, staff reach any order via `orders:read`. A failed check returns `404`, never `403` (existence of another customer's order is never leaked).

## Non-Negotiables

- Never trust client-provided price, total, role, permissions, inventory count, or ID ownership — always re-derive/verify server-side.
- Never leak internal error detail to the client.

## Implemented Endpoints (Phase 4E-1)

`GET /api/v1/health` — unauthenticated liveness check.

`/api/v1/auth/*` — see [AUTH_SECURITY.md](AUTH_SECURITY.md) for the security behavior behind each:

| Method | Path | Auth | CAPTCHA | Notes |
|---|---|---|---|---|
| POST | `/auth/register` | – | required | Auto-login; identical response for an existing email (no enumeration) |
| POST | `/auth/login` | – | after 3 failures | |
| POST | `/auth/logout` | refresh cookie | – | Idempotent; 204 |
| POST | `/auth/logout-all` | access | – | Revokes every session; 204 |
| POST | `/auth/refresh` | refresh cookie | – | Rotates the refresh token |
| GET | `/auth/me` | access | – | Only endpoint returning roles/permissions (DB-backed, current) |
| POST | `/auth/verify-email` | – | – | Idempotent on an already-verified account |
| POST | `/auth/resend-verification` | access | – | 202; no email param (enumeration-safe) |
| POST | `/auth/forgot-password` | – | required | Always the identical generic response |
| POST | `/auth/reset-password` | – | required | No auto-login |
| POST | `/auth/change-password` | access | – | Revokes other sessions; reissues cookies |

`/api/v1/categories/*` — see [modules/CATALOG.md](modules/CATALOG.md). "Auth" column: `–` means public/unauthenticated (`optionalAuthenticate` — a caller who happens to hold the noted permission gets the admin view on the same endpoint).

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/categories` | `categories:create` | `slug` is optional (derived from `name`); a name that yields no slug and no explicit `slug` → `400 CATALOG_VALIDATION_ERROR` (`details.slug`), never an empty slug (Phase 6G). |
| GET | `/categories` | – (`categories:read` widens) | `?page&limit&parentId&includeInactive` — public view is always active-only. `?include=count&market=` (Phase 6C) resolves each category's real product count via one batched query, returning `CategoryWithCountResponse[]` (`CategoryResponse` + `productCount`) instead of `CategoryResponse[]`; `market` scopes which products count (a category itself is not market-scoped). **`?include=admin` (Phase 6G)** — requires `categories:read` (`401`/`403`, not a silent widen) and returns `AdminCategoryResponse[]` (`CategoryResponse` + `productCount` + `childCount`); unlike `include=count`, `productCount` counts **every** `ProductCategory` link (draft/archived/soft-deleted products too) — exactly what `DELETE`'s in-use guard checks — via batched `groupBy`s, no per-row queries. Default `include=summary` keeps the original shape. |
| GET | `/categories/:id` | – (`categories:read` widens) | 404 for an inactive category without `categories:read` |
| PATCH | `/categories/:id` | `categories:update` | All fields optional (at least one). Since Phase 6G `description` and `imageUrl` accept `null` to clear them; `parentId: null` moves a category to top level; `isActive:false` is the archive path. Parent cycles → `422 CATALOG_INVALID_CATEGORY_PARENT`; slug taken by another category → `409 CATALOG_SLUG_CONFLICT`. |
| DELETE | `/categories/:id` | `categories:delete` | Hard delete, guarded: 409 `CATALOG_CATEGORY_IN_USE` if it has children or **any** product link. Never detaches products. |

`/api/v1/products/*` — see [modules/CATALOG.md](modules/CATALOG.md). Variants/options/media are nested under a product; there is no separate top-level prefix for them.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/products` | `products:create` | Body includes `defaultVariant: {sku, title}` (required — every product needs ≥1 variant) and optional `categoryIds`/`markets` |
| GET | `/products` | – (`products:read` widens) | `?page&limit&market&category&status&search` — public view is always `status=ACTIVE`; `market` (a `Market.code`, e.g. `PK`) additionally requires `ProductMarket.isVisible=true`. An unknown or deactivated market code returns `404 CATALOG_NOT_FOUND` rather than an empty list. `?include=card` (Phase 6C, requires `market`) returns `ProductCardResponse[]` — `ProductSummaryResponse` + `imageUrl`, `defaultVariantId`, `price: PublicPriceResponse\|null`, `stock: PublicStockResponse\|null`, `rating: number\|null`, `reviewCount` — resolved server-side via a fixed number of batched queries (not one query per product), replacing the frontend's former per-product enrichment fetches. Default `include=summary` keeps the original `ProductSummaryResponse[]` shape unchanged, so no existing caller's response shape changes unless it opts in. `?include=admin` (Phase 6D) **requires `products:read`** — 401 unauthenticated, 403 without the permission (unlike `card`/`summary`, which just widen for a privileged caller rather than rejecting an unprivileged one) — and returns `ProductAdminListResponse[]`: `ProductSummaryResponse` + `imageUrl`, `variantCount`, `categories: {id,name}[]`, and `markets: [{code, name, isAvailable, isVisible, price: AdminPriceResponse\|null, stock: AdminStockResponse\|null}]` for **every** market at once (both PK and AE, regardless of any `market` param, which is accepted but ignored for this include value — admin management is never scoped to one market). `price`/`stock` are the full admin shapes (raw amount/onHand/reserved, inactive rows included), resolved via the same batched-query pattern as `card`. |
| GET | `/products/slug/:slug` | – (`products:read` widens) | Deliberately does not accept `include=card` and never gains embedded price/stock — see the note below the table. |
| GET | `/products/:id` | – (`products:read` widens) | 404 for a non-`ACTIVE` product without `products:read` |
| PATCH | `/products/:id` | `products:update` | Core fields + `status` only — variants/categories/markets have their own endpoints |
| DELETE | `/products/:id` | `products:delete` | Soft delete (`deletedAt`). **Phase 6E: only a `DRAFT` product may be deleted** — `409 CATALOG_PRODUCT_NOT_DELETABLE` for `ACTIVE`/`ARCHIVED` (archive via `PATCH status: ARCHIVED` instead; reversible, already hides it from the storefront). |
| PUT | `/products/:id/categories` | `products:update` | Replaces the full category association set |
| PUT | `/products/:id/markets/:marketCode` | `products:update` | Upserts `ProductMarket.{isAvailable,isVisible}`; 404 `CATALOG_NOT_FOUND` for an unknown or deactivated (`Market.isActive=false`) market code |
| POST | `/products/:productId/variants` | `products:update` | 409 `CATALOG_DUPLICATE_VARIANT_COMBINATION` if another active variant already has the identical option-value set |
| GET | `/products/:productId/variants` | – (`products:read` widens) | 404 for a non-`ACTIVE` product without `products:read`, same rule as `GET /products/:id` |
| PATCH / DELETE | `/products/:productId/variants/:variantId` | `products:update` | Update: 409 `CATALOG_DUPLICATE_VARIANT_COMBINATION` on an option-value-set collision. Delete: 422 `CATALOG_LAST_VARIANT` if it's the only one; deleting the default variant promotes the next remaining one |
| POST | `/products/:productId/options` | `products:update` | Body includes initial `values: string[]` |
| PATCH / DELETE | `/products/:productId/options/:optionId` | `products:update` | Delete: 409 `CATALOG_OPTION_IN_USE` if any value is assigned to a variant |
| POST | `/products/:productId/options/:optionId/values` | `products:update` | |
| DELETE | `/products/:productId/options/:optionId/values/:valueId` | `products:update` | 409 `CATALOG_OPTION_VALUE_IN_USE` if assigned to a variant |
| POST | `/products/:productId/media` | `products:update` | `isPrimary: true` unsets any existing primary on the same product |
| PATCH / DELETE | `/products/:productId/media/:mediaId` | `products:update` | |

**Product detail's price/stock contract is intentionally unchanged (Phase 6C, reviewed decision, not an oversight):** detail (`GET /products/:id`/`:slug`) stays price/stock-free; a caller resolves the current variant's price/stock via the two endpoints below in parallel (`Promise.all`), same as today. Folding price/stock into detail would force the whole detail response to `cache: "no-store"`, losing the cache hit rate detail otherwise gets for pure content edits — the list/card contract above solves the actual N+1 problem (a page of products), which detail (a single product) never had.

`/api/v1/products/:productId/variants/:variantId/prices/*` — see [modules/PRICING.md](modules/PRICING.md). Nested under products/variants, not a separate `/admin` prefix (no `/admin` router exists in this codebase). "Auth" column: `–` means public/unauthenticated (`optionalAuthenticate` — a caller holding `pricing:read` gets the full admin record on the same endpoint; `products:read` additionally widens which product statuses are visible, identical to the Catalog rule).

| Method | Path | Auth | Notes |
|---|---|---|---|
| PUT | `/products/:productId/variants/:variantId/prices/:marketCode` | `pricing:update` | Upsert — one row per variant+market (`@@unique([variantId, marketId])`). `currencyCode` optional (defaults to the market's); rejected if it doesn't match. |
| DELETE | `/products/:productId/variants/:variantId/prices/:marketCode` | `pricing:update` | Deactivates (`isActive:false`); idempotent; 204. |
| GET | `/products/:productId/variants/:variantId/prices` | – (`pricing:read` widens) | Public: active prices only, effective-price shape (`marketCode, currencyCode, amount, isOnSale, saleEndsAt`). Admin: every row incl. inactive, full fields. |
| GET | `/products/:productId/variants/:variantId/prices/:marketCode` | – (`pricing:read` widens) | Same split, one market. 404 `PRICING_NOT_FOUND` if missing or (for a public caller) inactive. |

`/api/v1/products/:productId/variants/:variantId/stock/*` — see [modules/INVENTORY.md](modules/INVENTORY.md). Same nesting/visibility pattern as Pricing's `/prices`.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/products/:productId/variants/:variantId/stock` | `inventory:update` | Create/setup only — `{ marketCode, onHand? = 0 }`. 409 `INVENTORY_ALREADY_EXISTS` if already set up for that market. |
| GET | `/products/:productId/variants/:variantId/stock` | – (`inventory:read` widens) | List across markets. Public: `{ marketCode, status: IN_STOCK\|OUT_OF_STOCK }[]`. Admin: full rows incl. `onHand`/`reserved`/`available`. |
| GET | `/products/:productId/variants/:variantId/stock/:marketCode` | – (`inventory:read` widens) | Same split, one market. 404 `INVENTORY_NOT_FOUND`. |
| POST | `/products/:productId/variants/:variantId/stock/:marketCode/receive` | `inventory:update` | `{ quantity: positive int, reason?: string }` → `RECEIPT` movement. |
| POST | `/products/:productId/variants/:variantId/stock/:marketCode/adjust` | `inventory:update` | `{ delta: nonzero int, reason: string (required) }` → `ADJUSTMENT` movement; 409 `INVENTORY_INSUFFICIENT_STOCK` if it would go negative or below reserved. |
| POST | `/products/:productId/variants/:variantId/stock/:marketCode/reserve` | `inventory:update` | `{ quantity: positive int, reference: string }`; idempotent per `(stockId, reference)`; 409 `INVENTORY_INSUFFICIENT_STOCK` if unavailable. |
| POST | `/products/:productId/variants/:variantId/stock/:marketCode/release` | `inventory:update` | `{ reference: string }`; idempotent no-op (204) if nothing active for that reference. |

`/api/v1/admin/inventory` (Phase 6E) — see [modules/INVENTORY.md](modules/INVENTORY.md). The first Inventory endpoint that lists across the whole catalog rather than one product+variant; follows the dedicated `/admin` prefix pattern `/admin/orders` established (not the same-router-widening pattern the nested stock routes above use), since there's no public/storefront equivalent of a cross-catalog stock list.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/admin/inventory` | `inventory:read` (strictly gated — `401` unauthenticated, `403` without the permission, no widening) | `?page&limit&search&market` — `search` matches product name or variant SKU; `market` filters to one market's rows, omitted returns both. Returns `AdminInventoryListResponse[]`: `{ id, productId, productName, productSlug, variantId, sku, variantTitle, marketCode, marketName, onHand, reserved, available, updatedAt }`, one row per (variant, market) that has a `VariantStock` row. No low-stock/threshold field — that concept doesn't exist anywhere in the schema, not fabricated here. |

`/api/v1/cart/*` — see [modules/CART.md](modules/CART.md). A **flat** top-level domain (not nested under `/products`, unlike Pricing/Inventory). Every route requires `authenticate` (never `optionalAuthenticate` — Cart has no public/anonymous view) and a `?market=<code>` query param; there is no `requirePermission` anywhere in this router — authorization is ownership-only (the cart is always the authenticated caller's own, resolved from `req.auth.userId`, never a client-supplied id).

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/cart?market=PK` | `authenticate` | Get-or-create the caller's active cart for this market. |
| POST | `/cart/items?market=PK` | `authenticate` | `{ variantId, quantity }`. Increments if the variant is already in the cart (409/422 on catalog/price/stock failure — see below). |
| PATCH | `/cart/items/:itemId?market=PK` | `authenticate` | `{ quantity }` — absolute, not additive. 404 `CART_ITEM_NOT_FOUND` if the item isn't in the caller's own cart. |
| DELETE | `/cart/items/:itemId?market=PK` | `authenticate` | 204; 404 `CART_ITEM_NOT_FOUND` if not owned/found. |
| DELETE | `/cart?market=PK` | `authenticate` | Clears every item, keeps the cart. Idempotent 204 if no cart exists yet. |

Cart response shape (`GET`/`POST`/`PATCH` all return the full cart): `{ id, marketCode, currencyCode, status, items: [{ id, variantId, sku, title, quantity, unitAmount, lineTotal, isAvailable, isInStock }], itemCount, subtotalAmount, createdAt, updatedAt }`. `unitAmount`/`lineTotal` are `null` and `isAvailable` is `false` for an item whose price/availability has changed since it was added — the item is kept, never silently dropped.

`/api/v1/wishlist/*` — see [modules/WISHLIST.md](modules/WISHLIST.md). A **flat** top-level domain, same posture as Cart, but **market-independent** (no `?market=` query param anywhere — the PRD never scopes Wishlist to a market). Every route requires `authenticate`; no `requirePermission` anywhere in this router — ownership-only, resolved from `req.auth.userId`.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/wishlist` | `authenticate` | Get-or-create the caller's wishlist. |
| POST | `/wishlist/items` | `authenticate` | `{ productId }`. Idempotent if the product is already saved (200, not an error). 422 `WISHLIST_PRODUCT_UNAVAILABLE` if not `ACTIVE`; 404 `CATALOG_NOT_FOUND` if it doesn't exist. |
| DELETE | `/wishlist/items/:productId` | `authenticate` | Keyed by `productId`, not a wishlist-item id (matches PRD §2C.17). 204; 404 `WISHLIST_ITEM_NOT_FOUND` if not owned/found. |

Wishlist response shape (`GET`/`POST` both return the full wishlist): `{ id, items: [{ productId, slug, name, imageUrl, isAvailable, defaultVariantId, hasMultipleVariants, createdAt }], itemCount, createdAt, updatedAt }`. No price/currency field — product-level and market-independent by design; a price, if the frontend shows one, is fetched separately through the existing Pricing read path. `isAvailable` is `false` (item kept, never dropped) once the saved product goes non-`ACTIVE` or is soft-deleted.

`/api/v1/addresses/*` — a customer's own standing billing/shipping address book, exactly one row per type (never a multi-address book). Flat top-level domain, same ownership-only posture as Wishlist — every route requires `authenticate` only, no `requirePermission`. Distinct from `User`'s legacy flat address columns (admin-only, via `PATCH /admin/customers/:id`) and from `OrderAddress` (the per-order snapshot Checkout writes) — this domain is never read from or written to by either of those.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/addresses` | `authenticate` | `{ billing: AddressView \| null, shipping: AddressView \| null }`. |
| PUT | `/addresses/billing` | `authenticate` | Upserts the caller's one billing address row. |
| PUT | `/addresses/shipping` | `authenticate` | Upserts the caller's one shipping address row. |

`AddressView`: `{ fullName, phone, line1, line2, city, region, postalCode, countryCode, updatedAt }` — field names match `OrderAddress`/checkout's address shape exactly, so a saved address can be copied straight into the checkout form.

`/api/v1/checkout` — see [modules/CHECKOUT.md](modules/CHECKOUT.md). A flat top-level domain, same posture as Cart. `authenticate` + `requireVerifiedEmail` (no permission checks — ownership-only). Requires an `Idempotency-Key` header on every request.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/checkout?market=PK` | `authenticate` + `requireVerifiedEmail` | Header `Idempotency-Key` required. Body: `{ shippingAddress: {fullName, phone, line1, line2?, city, region?, postalCode?, countryCode}, paymentMethod, shippingMethodId, couponCode? }`. `paymentMethod` must be `"COD"` (production) or `"COD"`/`"MOCK"` (non-production, Phase 4K — `MOCK` exists solely to exercise Payments' webhook security, never a real payment method); `shippingMethodId` (Phase 4M — replaces the earlier informational-only `shippingMethod` string) must resolve to an active `ShippingMethod` in the requested market, or `422 SHIPPING_METHOD_UNSUPPORTED`; a submitted `couponCode` is rejected, not ignored (no Promotions domain exists). `201` for a new order, `200` for an idempotent replay (identical `Idempotency-Key`). Creates a `Payment` row (`PENDING`) and a `Shipment` row (`PENDING`) in the same transaction — see `modules/PAYMENTS.md`/`modules/SHIPPING.md`. |

Response shape: `{ id, orderNumber, marketCode, currencyCode, status, paymentMethod, paymentStatus, shipmentStatus, items: [{ id, variantId, productId, sku, productName, variantName, unitAmount, quantity, lineTotal, currencyCode }], shippingAddress, subtotalAmount, discountAmount, shippingAmount, taxAmount, totalAmount, placedAt, createdAt }`. `discountAmount`/`taxAmount` are always `0` this phase (Promotions/tax configuration don't exist yet). `shippingAmount` (Phase 4M) is computed from the resolved `ShippingMethod`'s `baseRate`, or `0` once `subtotalAmount` reaches its `freeShippingThreshold`.

`/api/v1/orders` and `/api/v1/admin/orders` — see [modules/ORDERS.md](modules/ORDERS.md) for the full state machine, concurrency design and PRD alignment. `/admin/orders` is the first dedicated `/admin` URL prefix in this codebase (Pricing's and Inventory's per-variant routes instead gate admin access inline on their public router; Inventory's `/admin/inventory` cross-catalog list, added Phase 6E, is the second use of the dedicated-prefix pattern — see above).

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/orders` | `authenticate` | Own orders only. Query: `status?`, `dateFrom?`, `dateTo?`, `page?`, `limit?`. |
| GET | `/orders/:id` | `authenticate` | Ownership-or-`orders:read`. `404` (not `403`) if neither. |
| GET | `/admin/orders` | `authenticate` + `orders:read` | Query: `status?`, `paymentStatus?`, `shipmentStatus?` (Phase 6F), `market?`, `dateFrom?`, `dateTo?` (a date-only `dateTo` such as `2026-09-25` is inclusive of that whole day, UTC), `search?` (Phase 6F — case-insensitive substring of order number, customer email, or customer first/last name), `customer?` (a `userId`), `orderNumber?` (exact), `page?`, `limit?`. Invalid values → `400`. |
| GET | `/admin/orders/:id` | `authenticate` + `orders:read` | Staff-only projection (Phase 6F) — **not** the customer shape: adds `customer`, `shipmentStatus`, `payments`, `shipment`, `returns`. The customer route `GET /orders/:id` is unchanged. `404` for an unknown id. |
| PATCH | `/admin/orders/:id/status` | `authenticate` + (`orders:update` or `orders:cancel`) | Body: `{ status, reason? }`. `status` must be one of `CONFIRMED, PROCESSING, SHIPPED, DELIVERED, COMPLETED, CANCELLED` and a valid transition from the order's current status — see the state-machine table in `modules/ORDERS.md`. `orders:cancel` is required specifically for a `→ CANCELLED` transition; every other transition needs `orders:update`. |
| POST | `/admin/orders` | `authenticate` + `orders:create` | Admin-entered offline order (phone/WhatsApp/walk-in). Body: `{ userId?, guestEmail?, market, paymentMethod, paymentStatus?, shippingAddress, lines }` — **exactly one** of `userId` (existing customer) or `guestEmail` (no-account order) must be present. A guest order creates no `User` row at all; its displayed identity is `shippingAddress.fullName`/`guestEmail` (as of the Admin Orders/Customers fixes phase; `Order.userId` is nullable, `Order.guestEmail` added, DB CHECK constraint enforces exactly-one). |

List response shape (customer `GET /orders`): `{ id, orderNumber, marketCode, currencyCode, status, paymentStatus, totalAmount, placedAt, createdAt }` per item, with the standard pagination `meta`. Detail/PATCH response shape extends the checkout response shape with `statusHistory: [{ previousStatus, newStatus, changedByUserId, reason, createdAt }]`.

Staff shapes (Phase 6F, `GET /admin/orders[/:id]` only): list items add `shipmentStatus` and `customer: { id, name, email, isGuest }`; detail adds the same plus `payments: [{ id, provider, method, status, amount, currencyCode, providerPaymentId, paidAt, createdAt }]`, `shipment: { id, status, shippingMethodName, carrier, trackingNumber, shippedAt, deliveredAt } | null`, and `returns: [{ id, status, reason, rejectionReason, refundAmount, createdAt, reviewedAt, receivedAt, refundedAt }]`. These are allowlist projections — never `idempotencyKey`, `PaymentTransaction.metadata`, password hashes, or tokens. `customer` is the customer's **current** account record (`Order` stores no customer-identity snapshot) — **except** for a guest order (`isGuest: true`), where `id` is `null` and `name`/`email` come from the order's own `OrderAddress.fullName`/`Order.guestEmail` snapshot instead, since there is no account to look up.

`/api/v1/shipping/methods`, `/api/v1/admin/shipping/methods`, `/api/v1/orders/:orderId/shipment`, and `/api/v1/admin/shipments` — see [modules/SHIPPING.md](modules/SHIPPING.md) for the full lifecycle, provider abstraction, and PRD alignment.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/shipping/methods?market=PK` | none | Public — active methods for one market. Response: `[{ id, marketId, name, description, baseRate, freeShippingThreshold, estimatedMinDays, estimatedMaxDays, isActive, createdAt, updatedAt }]`. |
| GET | `/admin/shipping/methods` | `authenticate` + `shipping:read` | Query: `market?`, `isActive?`, `page?`, `limit?`. All methods incl. archived. |
| POST | `/admin/shipping/methods` | `authenticate` + `shipping:update` | Body: `{ marketCode, name, description?, baseRate, freeShippingThreshold?, estimatedMinDays?, estimatedMaxDays?, isActive? }`. |
| GET | `/admin/shipping/methods/:id` | `authenticate` + `shipping:read` | 404 `SHIPPING_METHOD_NOT_FOUND`. |
| PATCH | `/admin/shipping/methods/:id` | `authenticate` + `shipping:update` | Partial update, same body shape as POST minus `marketCode`. |
| DELETE | `/admin/shipping/methods/:id` | `authenticate` + `shipping:update` | Archives (`isActive:false`); never a hard delete; idempotent; 204. |
| GET | `/orders/:orderId/shipment` | `authenticate` | Ownership-or-`shipping:read`, ownership resolved through the parent Order. `404` (not `403`) if neither. |
| GET | `/admin/shipments` | `authenticate` + `shipping:read` | Query: `status?`, `orderId?`, `page?`, `limit?`. |
| PATCH | `/admin/shipments/:id` | `authenticate` + `shipping:update` | Body: `{ status, trackingNumber?, carrier? }`. `status` must be a valid transition from the shipment's current status — see the state-machine table in `modules/SHIPPING.md`. `422 SHIPMENT_ORDER_NOT_SHIPPABLE` if the parent order is terminal. Does **not** require `Order.paymentStatus === PAID` (COD ships before payment is collected, by design). |

Shipment response shape: `{ id, orderId, shippingMethodId, trackingNumber, carrier, status, shippedAt, deliveredAt, createdAt, updatedAt }`.

`/api/v1/orders/:orderId/returns`, `/api/v1/returns/:id`, and `/api/v1/admin/returns` — see [modules/RETURNS.md](modules/RETURNS.md) for the full lifecycle, eligibility rule, and PRD alignment (the PRD gives this domain only a single conceptual note, §56).

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/orders/:orderId/returns` | `authenticate` + `requireVerifiedEmail` | Ownership. Body: `{ reason?, items: [{ orderItemId, quantity }] }`. `422 RETURNS_ORDER_NOT_RETURNABLE` unless the order has reached `COMPLETED`/`RETURNED`/`REFUNDED`; `422 RETURNS_QUANTITY_EXCEEDS_AVAILABLE`; `409 RETURNS_ALREADY_OPEN` if the order already has an open return. |
| GET | `/orders/:orderId/returns` | `authenticate` | Ownership-or-`returns:read` — lists an order's returns (there can be more than one over time). |
| GET | `/returns/:id` | `authenticate` | Ownership-or-`returns:read`, ownership resolved through the parent Order. `404` (not `403`) if neither. |
| GET | `/admin/returns` | `authenticate` + `returns:read` | Query: `status?`, `orderId?`, `page?`, `limit?`. |
| PATCH | `/admin/returns/:id/approve` | `authenticate` + `returns:update` | `REQUESTED → APPROVED`. |
| PATCH | `/admin/returns/:id/reject` | `authenticate` + `returns:update` | Body: `{ rejectionReason }` (required). `REQUESTED → REJECTED`. |
| PATCH | `/admin/returns/:id/receive` | `authenticate` + `returns:update` | `APPROVED → RECEIVED`. Restocks inventory via `InventoryRepository.adjust()`; advances `Order.status → RETURNED` the first time only. |
| PATCH | `/admin/returns/:id/refund` | `authenticate` + `returns:update` | `RECEIVED → REFUNDED`. Calls `PaymentsService.refund()` (gateway) or `markRefunded()` (COD, Phase 4O); advances `Order.status → REFUNDED` the first time only. A failed Payments call reverts the claim back to `RECEIVED` (Phase 4O's claim/confirm/revert fix) — see `modules/RETURNS.md`. |

Return response shape: `{ id, orderId, status, reason, rejectionReason, refundAmount, requestedByUserId, reviewedByUserId, reviewedAt, receivedAt, refundedAt, items: [{ id, orderItemId, quantity }], createdAt, updatedAt }`.

`/api/v1/products/:productId/reviews*`, `/api/v1/reviews/:id`, `/api/v1/reviews/featured`, and `/api/v1/admin/reviews*` — see [modules/REVIEWS.md](modules/REVIEWS.md) (Phase 6N). Submission, ownership edit/delete, verified-purchase, and full admin moderation are all built.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/products/:productId/reviews` | – (`optionalAuthenticate`) | Published reviews for one product. |
| GET | `/products/:productId/reviews/summary` | – (`optionalAuthenticate`) | Aggregate rating (average + count) for one product, computed live, never persisted. |
| GET | `/products/:productId/reviews/mine` | `authenticate` | The caller's own review for this product, or `null`. |
| POST | `/products/:productId/reviews` | `authenticate` + verified email + CAPTCHA (`action: "review_submit"`) + `reviewSubmitLimiter` | Body: `{ rating, title?, body, captchaToken }`. Upserts on `(productId, userId)` — a resubmission edits rather than erroring. `source` is always `CUSTOMER`; `isVerifiedPurchase` is computed once here (a completed/returned/refunded order containing the product) and frozen thereafter. |
| PATCH | `/reviews/:id` | `authenticate` (ownership) | Body: `{ rating?, title?, body? }`. 404 (never 403) if the review isn't the caller's own. |
| DELETE | `/reviews/:id` | `authenticate` (ownership) | Same 404-not-403 posture. |
| GET | `/reviews/featured` | – (`optionalAuthenticate`) | Cross-product featured/published reviews (`isFeatured:true`), used by the Homepage/About testimonials sections. |
| GET | `/admin/reviews` | `authenticate` + `reviews:read` | `?page&limit&productId&status=published\|unpublished&source=CUSTOMER\|ADMIN\|SEED&featured`. |
| GET | `/admin/reviews/:id` | `authenticate` + `reviews:read` | Full admin shape, incl. `source`/`userId`/`isPublished`/`isFeatured`. |
| POST | `/admin/reviews` | `authenticate` + `reviews:moderate` | Body: `{ productId, userId?, rating, title?, body, authorName, authorLocation?, avatarUrl?, isPublished?, isFeatured? }`. `userId` is optional (nullable on the row) — a testimonial with no backing account. Always `source: ADMIN`, `isVerifiedPurchase: false`, regardless of request body. |
| PATCH | `/admin/reviews/:id` | `authenticate` + `reviews:moderate` | Same editable fields as create, plus toggling `isPublished`/`isFeatured`. `source`/`isVerifiedPurchase` are never accepted. |
| DELETE | `/admin/reviews/:id` | `authenticate` + `reviews:delete` | Permanent; the product's rating/count recompute on the next read (never persisted). |

Public review shape: `{ id, productId, rating, title, body, authorName, authorLocation, avatarUrl, isVerifiedPurchase, createdAt }`. Admin shape adds `userId, source, isPublished, isFeatured, updatedAt`. `authorName`/`authorLocation`/`avatarUrl` are snapshotted at submission time, not live-joined to the reviewing user.

`/api/v1/admin/audit-logs` — see [modules/AUDITLOG.md](modules/AUDITLOG.md) (Phase 4P). Read-only; no write route exists anywhere in this codebase for this resource.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/admin/audit-logs` | `authenticate` + `audit:read` (super_admin only) | Query: `userId?`, `action?`, `entityType?`, `entityId?`, `dateFrom?`, `dateTo?`, `page?`, `limit?` — the exact filter list PRD §2C.21 names. |

Audit log response shape: `{ id, userId, action, entityType, entityId, before, after, ipAddress, userAgent, createdAt }` per item, with the standard pagination `meta`.

`/api/v1/admin/analytics/dashboard` — see [modules/ANALYTICS.md](modules/ANALYTICS.md) (Phase 6I). Read-only aggregation backing the admin dashboard; no write route exists for this resource.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/admin/analytics/dashboard` | `authenticate` + `analytics:read` (super_admin only) | Query: `days?` (1-90, default 30). Response is per-market (never a combined-currency figure) — see ANALYTICS.md. |

`/api/v1/admin/users` — see [modules/USERS.md](modules/USERS.md) (Phase 6J). Admin user management: list/detail/role/status/reset-password.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/admin/users` | `authenticate` + `users:read` | Query: `search?`, `status?`, `role?`, `page?`, `limit?`. |
| GET | `/admin/users/:id` | `authenticate` + `users:read` | Includes the role's real inherited permissions. |
| PATCH | `/admin/users/:id/status` | `authenticate` + `users:update` | Body `{ status: "ACTIVE" \| "SUSPENDED" }`. Self-modification and suspending the last active super_admin both `409`. |
| PATCH | `/admin/users/:id/role` | `authenticate` + `roles:assign` | Body `{ role: "customer" \| "super_admin" }`. Self-modification and demoting the last super_admin both `409`. |
| POST | `/admin/users/:id/reset-password` | `authenticate` + `users:update` | No body. Triggers the existing forgotPassword email flow; rate-limited per admin. |

`/api/v1/markets` + `/api/v1/admin/markets` — see [modules/MARKETS.md](modules/MARKETS.md) (Phase 6K). Backend-driven market list, replacing a hardcoded frontend constant; admin enable/disable toggle only (no create/delete/rename).

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/markets` | none (public) | Active markets only — `id`, `code`, `name`, `currencyCode`, `currencyMinorUnits`. Used by the storefront market switcher. |
| GET | `/admin/markets` | `authenticate` + `markets:read` | All markets, including inactive, plus `isActive`/`timezone`/timestamps. |
| PATCH | `/admin/markets/:id` | `authenticate` + `markets:update` | Body `{ isActive: boolean }`. Only field editable through this endpoint. |

`/api/v1/admin/customers` — Phase 6M (extended: Admin Orders/Customers fixes phase). Same `User` table as `/admin/users`, a customer-only admin lens: every route here is hard-scoped server-side to `roleKey="customer"` (never a client-suppliable filter) — a super_admin id 404s through this surface exactly like a nonexistent id. `customers:create` was added in Phase 6M; `customers:delete` is new this phase (additive `seed.ts` change). `User` also gained six optional flat address columns this phase (`addressLine1`/`addressLine2`/`city`/`region`/`postalCode`/`countryCode` — naming/widths mirror `OrderAddress`), returned on every detail response and acceptable on create/update.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/admin/customers` | `authenticate` + `customers:read` | Query: `search?`, `status?`, `page?`, `limit?` (no `role` — always customer-scoped). Each row includes `orderCount`/`totalSpent` (array, one entry per currency — never combined across PK/AE), via one batched aggregate query, not per-row. |
| GET | `/admin/customers/:id` | `authenticate` + `customers:read` | `404` if the id resolves to a non-customer account. |
| POST | `/admin/customers` | `authenticate` + `customers:create` | Body `{ firstName, lastName, email, password, phone?, addressLine1?, addressLine2?, city?, region?, postalCode?, countryCode? }` (address is all-or-nothing on `addressLine1`/`city`/`countryCode` when any part is given) — no `role` field exists on the schema. As of this phase, creates **pre-verified** (`status: "ACTIVE"`, `emailVerifiedAt` set immediately) with **no verification email sent** — a staff-created account doesn't need to prove inbox ownership the way a public signup does. `409 USERS_EMAIL_ALREADY_EXISTS` on a duplicate email (this admin-facing form does not use the public endpoint's anti-enumeration masking). |
| PATCH | `/admin/customers/:id/status` | `authenticate` + `customers:update` | Body `{ status: "ACTIVE" \| "SUSPENDED" }`. `404` if the target isn't a customer account. |
| PATCH | `/admin/customers/:id` | `authenticate` + `customers:update` | New this phase. Partial update of `firstName`/`lastName`/`email`/`phone`/the six address fields (never `status`/`role` — those stay on their own endpoints). `409 USERS_EMAIL_ALREADY_EXISTS` on a duplicate email. |
| DELETE | `/admin/customers/:id` | `authenticate` + `customers:delete` | New this phase. **Soft delete** — sets `deletedAt`, revokes all sessions; never a real row delete (`Order.userId`'s `onDelete: Restrict` would block that anyway for a customer with real orders, but the row is preserved regardless so order-history attribution survives). `409 USERS_CANNOT_MODIFY_SELF` if the caller targets their own id. |

`POST /api/v1/products/:productId/media/upload` — Phase 6M, local-disk product media upload (see `docs/modules/CATALOG.md` for the storage-architecture note). Alongside, not instead of, the existing URL-entry `POST /products/:productId/media`.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/products/:productId/media/upload` | `authenticate` + `products:update` | `multipart/form-data`, field `file` (JPEG/PNG/WEBP, ≤5MB) + optional `altText`/`isPrimary`/`variantId` fields. Saves to `backend/uploads/products/`, served publicly at `/uploads/products/:filename`; reuses the same `ProductsService` media-creation path as the URL-entry endpoint. `DELETE /products/:productId/media/:mediaId` also unlinks the on-disk file, but only when the media's URL is one this server generated — an externally-pasted URL is left untouched. |

## Customer API Contract Freeze (Phase 4P, Part K)

The tables above, taken together, are the frozen customer-facing contract for frontend integration — every row was re-verified against the actual mounted route this phase, not assumed. The full customer journey (register → verify email → login → browse catalog → product detail → market selection → cart → checkout → order → payment → order history → shipment tracking → return request → refund status) is fully covered:

| Step | Endpoint(s) |
|---|---|
| Register/verify/login | `POST /auth/register`, `POST /auth/verify-email`, `POST /auth/login` |
| Browse catalog / product detail | `GET /categories`, `GET /products`, `GET /products/:id`\|`/slug/:slug` |
| Market selection | `?market=` query param, present on every market-scoped read/write |
| Cart | `GET/POST/PATCH/DELETE /cart*` |
| Wishlist (save-for-later, independent of the purchase flow) | `GET/POST/DELETE /wishlist*` |
| Saved billing/shipping address (Phase 7A — one row per type, used to prefill checkout) | `GET /addresses`, `PUT /addresses/billing`\|`/shipping` |
| Checkout | `POST /checkout` |
| Order placed / history | `GET /orders`, `GET /orders/:id` |
| In-app notifications (Phase 7A — order-status updates + admin-broadcast promotions, ownership-scoped) | `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`\|`/read-all` |
| Payment status | `GET /payments/:id` |
| Shipment/tracking | `GET /orders/:orderId/shipment` |
| Return request | `POST/GET /orders/:orderId/returns`, `GET /returns/:id` |
| Refund status | Reflected on the Return's own `status`/`refundAmount` fields (no separate refund-status endpoint — a Return **is** the refund's status) |

No endpoint listed anywhere in this document was invented for this freeze — every row traces to a route file this phase actually read (`backend/src/modules/*/*.routes.ts`).

`/api/v1/payments`, `/api/v1/admin/payments`, and `/api/v1/webhooks/payments/:provider` — see [modules/PAYMENTS.md](modules/PAYMENTS.md) for the full lifecycle, provider abstraction and webhook-security design. The webhook route is mounted directly in `app.ts`, **outside** `apiV1Router` and ahead of the global JSON/CSRF middleware (raw body required for signature verification).

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/payments/:id` | `authenticate` | Ownership-or-`payments:read`, ownership resolved through the payment's parent Order. `404` (not `403`) if neither. |
| POST | `/payments/:id/refund` | `authenticate` + `payments:refund` | Body: `{ amount? }` — omitted means the full remaining captured amount. Idempotent (a repeat call on an already-`REFUNDED` payment is a no-op). |
| GET | `/admin/payments` | `authenticate` + `payments:read` | Query: `status?`, `provider?`, `orderId?`, `page?`, `limit?`. |
| PATCH | `/admin/payments/:id/mark-paid` | `authenticate` + `payments:update` | COD-only; `422 PAYMENTS_STAFF_ACTION_UNSUPPORTED` for any other provider. `422 PAYMENTS_ORDER_NOT_PAYABLE` if the parent order is terminal (Phase 4L). |
| PATCH | `/admin/payments/:id/mark-failed` | `authenticate` + `payments:update` | Body: `{ reason }`; COD-only, same rejection. Same terminal-order rejection as mark-paid (Phase 4L). |
| PATCH | `/admin/payments/:id/mark-refunded` | `authenticate` + `payments:refund` | **Phase 4O.** Body: `{ amount?, reference? }`; COD-only staff refund attestation, no provider call. `422 PAYMENTS_STAFF_ACTION_UNSUPPORTED` for any other provider; `422 PAYMENTS_REFUND_EXCEEDS_CAPTURED` if amount exceeds what remains captured. |
| POST | `/webhooks/payments/:provider` | HMAC signature (`X-Webhook-Signature` header) — no `authenticate`, no CSRF | Raw JSON body. Always responds `200` after a valid signature, even for a duplicate/mismatched/lost-race event (see `modules/PAYMENTS.md`); only a bad/missing signature returns `400`. |

## Error Codes (implemented)

| Code | Meaning |
|---|---|
| `AUTH_INVALID_CREDENTIALS` | Login failed (wrong password or unknown email — always the same code) |
| `AUTH_UNAUTHORIZED` | Missing or invalid access token |
| `AUTH_FORBIDDEN` | Authenticated but lacks the required permission |
| `AUTH_SESSION_EXPIRED` | Access token expired, or session revoked/expired/password-changed |
| `AUTH_INVALID_REFRESH_TOKEN` | Refresh cookie missing or matches no session |
| `AUTH_REFRESH_REUSE_DETECTED` | A rotated refresh token was replayed outside the grace window; its family was revoked |
| `AUTH_REFRESH_RETRY` | A just-rotated token was replayed within the 15s grace window; retry with the latest token |
| `AUTH_EMAIL_NOT_VERIFIED` | A non-customer (staff) account tried to log in before verifying |
| `AUTH_INVALID_VERIFICATION_TOKEN` | Verification token invalid, expired, or already consumed |
| `AUTH_INVALID_RESET_TOKEN` | Reset token invalid, expired, or already consumed |
| `AUTH_VALIDATION_ERROR` | Transport or business-rule input validation failed |
| `AUTH_RATE_LIMITED` | Too many requests; `Retry-After` header set |
| `AUTH_ACCOUNT_SUSPENDED` | Correct password, but the account is suspended/deactivated |
| `AUTH_PASSWORD_REUSED` | New password equals the current one |
| `AUTH_CAPTCHA_REQUIRED` / `AUTH_CAPTCHA_FAILED` | CAPTCHA missing or failed verification |
| `CAPTCHA_UNAVAILABLE` | The CAPTCHA provider could not be reached (fails closed — request rejected, not allowed through) |
| `CSRF_VALIDATION_FAILED` | Origin/Referer mismatch or missing required header on a mutating request |
| `CONFLICT` | Unique-constraint violation (e.g. duplicate resource) |
| `PAYLOAD_TOO_LARGE` / `MALFORMED_REQUEST` | Request body exceeded the size limit or failed to parse |
| `NOT_FOUND` | No route matched |
| `INTERNAL_SERVER_ERROR` | Unexpected failure; `error.details.requestId` correlates it to server logs |
| `CATALOG_NOT_FOUND` | Product/category/variant/option/option-value/media/market not found (or not visible to this caller) |
| `CATALOG_SLUG_CONFLICT` | Product or category slug already in use |
| `CATALOG_SKU_CONFLICT` | Variant SKU already in use |
| `CATALOG_DUPLICATE_OPTION_NAME` | Product already has an option with this name |
| `CATALOG_DUPLICATE_OPTION_VALUE` | Option already has this value |
| `CATALOG_INVALID_OPTION_VALUE` | An option value is unknown, belongs to a different product, or two values share the same option axis |
| `CATALOG_LAST_VARIANT` | Attempted to delete a product's only remaining variant |
| `CATALOG_OPTION_VALUE_IN_USE` | Attempted to delete an option value assigned to a variant |
| `CATALOG_OPTION_IN_USE` | Attempted to delete an option with a value assigned to a variant |
| `CATALOG_CATEGORY_IN_USE` | Attempted to delete a category with children or product associations |
| `CATALOG_INVALID_CATEGORY_PARENT` | Attempted to make a category its own ancestor (directly or via an indirect cycle) |
| `CATALOG_DUPLICATE_VARIANT_COMBINATION` | Another active variant of the same product already has this exact set of option values |
| `CATALOG_PRODUCT_NOT_DELETABLE` | (Phase 6E) `DELETE /products/:id` was called on a non-`DRAFT` product — archive it instead |
| `CATALOG_VALIDATION_ERROR` | Catalog-specific business validation failed (reserved; transport-level validation still uses `AUTH_VALIDATION_ERROR` via the shared `validate` middleware) |
| `PRICING_NOT_FOUND` | No price row for this variant+market, or hidden from a public (non-`pricing:read`) caller |
| `PRICING_CURRENCY_MISMATCH` | Submitted `currencyCode` doesn't match the target market's configured currency |
| `PRICING_INVALID_SALE_AMOUNT` | `saleAmount` is not below `amount` |
| `PRICING_VALIDATION_ERROR` | Pricing-specific business validation failed (reserved, mirrors `CATALOG_VALIDATION_ERROR`) |
| `INVENTORY_NOT_FOUND` | No stock record for this variant+market |
| `INVENTORY_ALREADY_EXISTS` | A stock record already exists for this variant+market (on a create/setup call) |
| `INVENTORY_INSUFFICIENT_STOCK` | The requested adjustment/reservation would leave stock in an invalid state (negative, or reserved exceeding on-hand) |
| `INVENTORY_VALIDATION_ERROR` | Inventory-specific business validation failed (reserved, mirrors `CATALOG_VALIDATION_ERROR`) |
| `CART_ITEM_NOT_FOUND` | The referenced cart item doesn't exist, or doesn't belong to the caller's own cart for this market |
| `CART_VARIANT_UNAVAILABLE` | The variant/product is not `ACTIVE`, or the product is not marked available in the requested market |
| `CART_PRICE_UNAVAILABLE` | No active price is configured for this variant in this market |
| `CART_INSUFFICIENT_STOCK` | The requested (or resulting) quantity exceeds current available stock for this variant in this market |
| `CART_VALIDATION_ERROR` | Cart-specific business validation failed (reserved; transport-level validation still uses `AUTH_VALIDATION_ERROR` via the shared `validate` middleware — confirmed via source in Phase 5B-2B) |
| `WISHLIST_PRODUCT_UNAVAILABLE` | The product exists but is not `ACTIVE` (cannot be added to a wishlist) |
| `WISHLIST_ITEM_NOT_FOUND` | The referenced product isn't in the caller's own wishlist |
| `WISHLIST_VALIDATION_ERROR` | Wishlist-specific business validation failed (reserved; transport-level validation still uses `AUTH_VALIDATION_ERROR` via the shared `validate` middleware, same as every other domain) |
| `CHECKOUT_CART_NOT_FOUND` | No cart exists for this market (nothing to check out) |
| `CHECKOUT_CART_EMPTY` | The cart exists but has no items |
| `CHECKOUT_CART_ALREADY_CONVERTED` | This cart was already converted by another checkout attempt (including a concurrent race, and the torn-read-guarded case — see `modules/CHECKOUT.md`) |
| `CHECKOUT_COUPON_UNSUPPORTED` | A `couponCode` was submitted, but no Promotions domain exists yet — rejected, never silently ignored |
| `CHECKOUT_PAYMENT_METHOD_UNSUPPORTED` | `paymentMethod` was not `"COD"` — no other payment method is supported yet (no Payments domain) |
| `CHECKOUT_VALIDATION_ERROR` | Checkout-specific business validation failed, incl. a missing/empty `Idempotency-Key` header, or an idempotency key already used by a different caller |
| `ORDERS_NOT_FOUND` | The order doesn't exist, or exists but the caller neither owns it nor holds `orders:read` (never distinguished — see Ownership Checks above) |
| `ORDERS_INVALID_STATUS_TRANSITION` | The requested `(from, to)` status pair is not in the allowed transition table (see `modules/ORDERS.md`) |
| `ORDERS_TERMINAL_STATE` | The order is already in a terminal state (`COMPLETED`/`CANCELLED`/`FAILED`/`REFUNDED`/`RETURNED`) and cannot be transitioned further |
| `ORDERS_STATUS_CONFLICT` | A concurrent request already transitioned this order away from the status this request expected — refetch and retry |
| `ORDERS_VALIDATION_ERROR` | Orders-specific business validation failed |
| `PAYMENTS_NOT_FOUND` | The payment doesn't exist, or exists but the caller neither owns its parent order nor holds `payments:read` |
| `PAYMENTS_INVALID_STATUS_TRANSITION` | The requested status change isn't valid from the payment's current status |
| `PAYMENTS_STATUS_CONFLICT` | A concurrent update already moved this payment away from the status this request expected |
| `PAYMENTS_ORDER_NOT_PAYABLE` | The parent order is not in a state that accepts a payment update |
| `PAYMENTS_WEBHOOK_SIGNATURE_INVALID` | A webhook request's HMAC signature was missing or did not match |
| `PAYMENTS_WEBHOOK_AMOUNT_MISMATCH` | A webhook event's amount/currency did not match the payment it referenced |
| `PAYMENTS_WEBHOOK_ORDER_MISMATCH` | A webhook event referenced a payment whose order is already in a terminal state |
| `PAYMENTS_REFUND_EXCEEDS_CAPTURED` | The requested refund amount exceeds what remains captured on the payment |
| `PAYMENTS_UNSUPPORTED_PROVIDER` | The `:provider` route/body value does not match a known payment provider |
| `PAYMENTS_PROVIDER_OPERATION_UNSUPPORTED` | The requested operation (e.g. refund, webhook) is not supported by this payment's provider (e.g. COD) |
| `PAYMENTS_STAFF_ACTION_UNSUPPORTED` | A staff mark-paid/mark-failed/mark-refunded action was attempted against a non-COD payment |
| `PAYMENTS_VALIDATION_ERROR` | Payments-specific business validation failed |
| `SHIPPING_METHOD_NOT_FOUND` | The shipping method doesn't exist (admin lookup by id) |
| `SHIPPING_METHOD_UNSUPPORTED` | Checkout's submitted `shippingMethodId` isn't an active method in the requested market |
| `SHIPMENT_NOT_FOUND` | The shipment doesn't exist, or exists but the caller neither owns its parent order nor holds `shipping:read` |
| `SHIPMENT_INVALID_STATUS_TRANSITION` | The requested status change isn't valid from the shipment's current status |
| `SHIPMENT_STATUS_CONFLICT` | A concurrent update already moved this shipment away from the status this request expected |
| `SHIPMENT_ORDER_NOT_SHIPPABLE` | The parent order is not in a state that accepts a shipment update |
| `SHIPPING_VALIDATION_ERROR` | Shipping-specific business validation failed |
| `RETURNS_NOT_FOUND` | The return doesn't exist, or exists but the caller neither owns its parent order nor holds `returns:read` |
| `RETURNS_ORDER_NOT_RETURNABLE` | The parent order has not reached a state that accepts a return request |
| `RETURNS_QUANTITY_EXCEEDS_AVAILABLE` | Requested return quantity exceeds what remains returnable for that order item |
| `RETURNS_ALREADY_OPEN` | The order already has an open (non-terminal) return request |
| `RETURNS_INVALID_STATUS_TRANSITION` | The requested status change isn't valid from the return's current status |
| `RETURNS_STATUS_CONFLICT` | A concurrent update already moved this return away from the status this request expected |
| `RETURNS_PAYMENT_NOT_FOUND` | No refundable payment exists for the return's parent order |
| `RETURNS_VALIDATION_ERROR` | Returns-specific business validation failed |

## CSRF (mutating requests)

Every non-`GET`/`HEAD`/`OPTIONS` request must include a matching `Origin` (or `Referer`) header and a custom header (`x-requested-with` by default, configurable via `CSRF_HEADER_NAME`) — see [AUTH_SECURITY.md](AUTH_SECURITY.md) for the full rationale. Omitting either returns `403 CSRF_VALIDATION_FAILED`.
