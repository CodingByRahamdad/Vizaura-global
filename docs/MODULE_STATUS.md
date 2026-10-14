# MODULE_STATUS.md

Tracks implementation status per module. Update this file when a module's status changes (see [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md), rule 18).

Status values: `NOT STARTED`, `IN PROGRESS`, `COMPLETE`.

| Module | Backend | Frontend | Database | API | Tests | Security | Documentation |
|---|---|---|---|---|---|---|---|
| Auth | COMPLETE (**2026-10-14**: `env.ts`'s `COOKIE_SAMESITE=none` validation no longer requires `COOKIE_DOMAIN` — that requirement was backwards for an unrelated-registrable-domains deployment, where `COOKIE_DOMAIN` must stay unset; new `src/security/adminBootstrap.ts` extracts the super_admin bootstrap logic shared by `prisma/seed-admin.ts` and a new opt-in startup hook in `server.ts`) | COMPLETE (register/login/logout/me/forgot-reset password/verify-email/resend-verification/change-password integrated, route guards for `/account`+`/admin` — see Phase 5B-2A, verify-email added Phase 5B-4, change-password added Phase 5B-5; full flow re-verified end-to-end Phase 5B-6; audited **2026-10-14** against a cross-domain-cookie/admin-bootstrap request and found already correct — no localStorage, credentials already global, permission-based redirect already in place) | COMPLETE | COMPLETE | COMPLETE | COMPLETE (**2026-10-14**: cross-domain cookie fix documented in `docs/AUTH_SECURITY.md`'s Cookies/CSRF sections; admin bootstrap guard rails unchanged) | COMPLETE |
| Users | COMPLETE (**Phase 6J**: `/admin/users` — list/detail/role/status/reset-password, `users:read/update`+`roles:assign`-gated; own-profile self-service via `PATCH /auth/me` (firstName/lastName/phone only, never email/password/status/role) — frontend edit form added **Phase 7A**, previously built but unused) | COMPLETE (**Phase 6J**: real Admin Users module — `/admin/users` list with search/status/role filters/pagination, `/admin/users/[id]` detail with role/status/reset-password actions, self-protection UI; **Phase 7A**: `ProfileView.tsx` gained a real edit form) | COMPLETE | COMPLETE (**Phase 6J**: 5 new admin endpoints) | COMPLETE (**Phase 6J**: `users.test.ts`, 21 tests) | COMPLETE (**Phase 6J**: self-protection + last-super-admin protection both server-side, sanitized responses) | COMPLETE (`docs/modules/USERS.md`) |
| RBAC | COMPLETE (Phase 6E: seeded role set collapsed to exactly `super_admin`/`customer` — 7 operational roles retired, `seedRoles()` now authoritative for role existence, not just permission sets; `permissionMatrix` and every enforcement mechanism unchanged; **Phase 6J**: `RbacService.canRemoveSuperAdmin`/new `canSuspendUser` got their first real call sites via the new Users admin endpoints) | PARTIAL (Phase 6B: `lib/authorization.ts`/`lib/constants/permissions.ts`/`AuthContext`'s `can`/`canAny`/`canAll`/`hasAdminAccess`, permission-aware admin nav + `/admin/*` route protection; Phase 6D: `requireAdminPermission` got its first real callers, `AdminPermissionGate` component added; **Phase 6J**: role *assignment* between the two existing roles is now real (`/admin/users/[id]`) — still no role/permission *editor* (no role can be created/renamed/have its permission set edited through any UI), since only `roles:assign` is wired, not `roles:create/update/delete`) | COMPLETE | N/A (middleware, no dedicated routes) | COMPLETE | COMPLETE | COMPLETE |
| Markets | COMPLETE (**Phase 6K**: new `src/modules/markets/` — `GET /markets` public, `GET /admin/markets` + `PATCH /admin/markets/:id` `markets:read`/`markets:update`-gated (both pre-seeded, previously unwired); no migration, no new permissions) | COMPLETE (**Phase 6K**: root layout now fetches `GET /markets` and filters the switcher's option list to it — an admin-deactivated market disappears from the storefront switcher; `/admin/markets` list + activate/deactivate action; geolocation-based default detection remains a deliberate no-op stub, see `docs/modules/MARKETS.md`) | COMPLETE (no schema change — `Market`/`isActive` already existed) | COMPLETE (**Phase 6K**: 3 endpoints) | COMPLETE (**Phase 6K**: `markets.test.ts`, 9 tests) | COMPLETE (**Phase 6K**: permission-gated admin endpoints, `isActive` the only mutable field, audit-logged) | COMPLETE (`docs/modules/MARKETS.md`) |
| Catalog | COMPLETE (Phase 6C: `GET /products?include=card` batched card contract, `GET /categories?include=count` batched category counts; Phase 6D: `GET /products?include=admin` batched admin-list contract, `products:read`-gated; Phase 6E: `DELETE /products/:id` now enforces DRAFT-only, `409 CATALOG_PRODUCT_NOT_DELETABLE` otherwise; Phase 6G: `GET /categories?include=admin` (all-status `productCount` + `childCount`, `categories:read`-gated), `description`/`imageUrl` clearable via `null`, empty derived slug rejected; **Phase 6M**: `POST /products/:productId/media/upload` — real local-disk file upload, alongside the existing URL-entry endpoint; **2026-10-14**: upload storage for products/categories/promotions moved off local disk onto a `MediaProvider` abstraction (`backend/src/integrations/media/`, local dev/test default + Cloudinary required in production) — local disk doesn't survive a Render redeploy/restart/multi-instance scaling, which was the actual cause of uploaded images 404ing in production; `multer` switched from `diskStorage` to `memoryStorage`; `ProductMedia` gained `mediaPublicId` (migration `add_product_media_public_id`) so an upload-created row can be deleted from whichever provider created it, same contract the old local-disk-only delete had; **Phase 6N**: `POST /categories/upload-image` — standalone local-disk upload returning just `{url}` (no category-id coupling, works for create and edit alike), reuses the Phase 6M multer config factored into a shared helper; **Phase 6O**: `Product` gained `badge`/`features`/`specifications` — migration `product_badge_features_specifications`, wired through validators/repository/service/mapper; **Phase 6P**: no backend schema change — `ProductOptionsPanel`/variant option-value picker are the first admin UI for the already-existing Option/OptionValue CRUD endpoints; **Phase 6U**: `seedDemoCategories()` changed from upsert-with-update to find-then-create-if-missing — re-running `npm run db:seed` no longer resets an admin-edited category's name/description/image back to its demo value) | COMPLETE (Phase 6C: `getProductCards`/`toNormalizedCard` replace the former N+1 `getProductCardData`/`getProductCardsForList`; `getCategoriesWithCounts` now one request; Phase 6D: real Admin Products module — list/create/edit, categories/markets/variants/media management — see `docs/CURRENT_TASK.md`; Phase 6G: real Admin Categories module — list/create/edit, deactivate/activate, guarded delete; **Phase 6M**: `ProductMediaPanel` now has a real file-upload control + reorder, alongside the original URL-entry field; **Phase 6N**: `CategoryForm` now has a real file-upload control + preview, alongside the original URL-entry field; **Phase 6O**: `ProductForm` gained Badge/Features/Specifications fields, `ProductVariantsPanel` gained sale-price inputs, and the storefront Single Product page was rebuilt — gallery, tabs, reviews, key benefits, related products, all real-data-backed; **Phase 6P**: `ProductOptionsPanel` (new) manages Size-style attributes, `ProductVariantsPanel`'s add-variant form picks an option value per axis, storefront price block shows strikethrough+discount%, gallery supports click-to-zoom; **Phase 6Q**: `ProductOptionsPanel` removed again — the generic options UI was more than the business needs; `ProductVariantsPanel`'s add-variant form now has a single Size field that auto-resolves against the same unchanged Option/OptionValue backend, no schema/API change; **Phase 6U**: `CategoryForm` now calls a new `revalidateCategoriesPages()` server action right after a successful save, so the storefront's 60s category cache no longer leaves a just-uploaded image stale for up to a minute) | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE (`docs/modules/CATALOG.md` documents the local-disk upload as dev/small-deployment-appropriate only, not production storage, and the Phase 6U seeding/caching fixes) |

| Pricing | COMPLETE (Phase 6C: `findActivePricesByVariantIds` batch read, reused by Catalog's card contract; Phase 6D: `findPricesByVariantIds` batch read, reused by Catalog's admin-list contract) | COMPLETE (public read: per-variant price, plus card-embedded price — see Phase 6C; Phase 6D: admin per-variant per-market price editing in Products module) | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE |
| Inventory | COMPLETE (Phase 6C: `findByVariantIdsAndMarket` batch read, reused by Catalog's card contract; Phase 6D: `findByVariantIds` batch read, reused by Catalog's admin-list contract; Phase 6E: `GET /admin/inventory` cross-catalog list, `inventory:read`-gated, first Inventory endpoint not scoped to one product+variant; **Phase 6P**: `PublicStockResponse` gained `lowStockQuantity` — null unless in stock and at/below a 10-unit threshold, a narrow confirmed exception to the "no raw quantities" rule, for storefront "Only N left" messaging) | PARTIAL (public read: per-variant stock status, plus card-embedded stock — see Phase 6C; Phase 6D: read-only admin stock display in Products module; Phase 6E: real Admin Inventory module — cross-catalog list + Adjust action, reusing the existing atomic/audited `adjust` endpoint; receive/reserve/release still have no admin UI; **Phase 6P**: Products module's Variants panel gained its own "Set stock" action, reusing the same adjust endpoint plus `createStock` for first-time initialization) | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE |
| Cart | COMPLETE | IN PROGRESS (ProductCard/Product-detail Add-to-Cart, Cart page with quantity/remove/clear, Header count — see Phase 5B-2B; regression re-run Phase 5B-6) | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE |
| Checkout | COMPLETE (**Phase 6V**: `checkoutBodySchema` now takes `billingAddress` (always required) + `shipToDifferentAddress`/`shippingAddress?` (shipping mirrors billing when the checkbox is false); `OrderAddress` is now a typed `BILLING`/`SHIPPING` pair per order, not one row — see Orders row below for the schema/migration detail, owned there) | COMPLETE (checkout page only, Phase 5B-3; **Phase 6V**: `CheckoutView.tsx` gained a "Ship to a different address" checkbox — billing address always collected, shipping block only rendered when checked) | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE |
| Orders | COMPLETE (Phase 6F: staff-only list/detail projections with customer/payments/shipment/returns, `search` + `shipmentStatus` admin filters, audit entry records previous status; Phase 6S: `Order.source` (`ONLINE`/`OFFLINE`), new `orders:create`-gated `POST /admin/orders` for staff-entered offline orders (re-validates lines against live catalog/price/inventory exactly like Checkout, reuses peer-domain repositories — no second order-creation implementation), admin list query now also joins each row's representative Payment/Shipment for inline status actions, order-confirmation email on create (shared `sendOrderConfirmation` helper, called by both Checkout and this new path); **Phase 6T**: `Order.userId` now nullable + new `Order.guestEmail`, DB `CHECK` constraint enforces exactly one of the two — `POST /admin/orders` accepts a `guestEmail` in place of `userId` for a customer with no account, with no fake `User` row ever created; `AdminOrderCustomerView` gained `isGuest`/nullable `id`; **Phase 6V**: `OrderAddress` is now a typed `BILLING`/`SHIPPING` pair (every order has exactly 2 rows, never a nullable one) instead of one row — `createAdminOrder` takes the same `billingAddress`/`shipToDifferentAddress`/`shippingAddress?` shape as Checkout; new `PATCH /admin/orders/:id` (`orders:update`) edits billing/shipping address and line items (adjust quantity/price on an existing line, add a new line, remove a line — duplicate-variant adds rejected since `StockReservation` can't represent two independent quantities under one `(stockId, reference)` key) and new `DELETE /admin/orders/:id` (new `orders:delete` permission) hard-deletes an order; both gated by a shared `assertOrderIsMutable`/`assertOrderIsDeletable` eligibility check (every `Payment` still `PENDING`, `Shipment` still `PENDING` or absent, no `Return` exists — deliberately never checks `Order.status`, since an admin-entered offline order can be `Order.status: PENDING` with `Payment.status: PAID` already) | COMPLETE (history + detail pages, Phase 5B-3; Phase 6F: real Admin Orders module — `/admin/orders` list with server-side search/filters/pagination, `/admin/orders/[id]` detail with status actions; Phase 6S: list-page inline Order/Payment/Shipment status dropdowns (no detail-page round trip needed for a status change), 500ms-debounced search (opt-in prop on the shared `AdminSearchInput`, every other list page unaffected), full-width detail page, Source badge, `/admin/orders/new` Add Order form; **Phase 6T**: Add Order form gained an "Existing customer" / "New / guest customer" toggle — guest mode needs only an email field, reusing the form's existing shipping-address fields as the guest's name/phone; customer-search debounce bumped to 500ms and both customer/inventory search calls now retry once on an expired access token; order detail/list show a "Guest" badge when there's no linked account; **Phase 6V**: `AddOrderForm.tsx` gained the same billing/shipping-checkbox split as Checkout; order detail page gained a "Billing address" field, an "Order actions" section (`OrderAdminActions.tsx`, new) with Edit/Delete buttons gated on permission **and** a client-side mirror of the mutability check (hidden once anything has actually happened — backend remains the sole authority), and a confirm dialog for delete; new `/admin/orders/[id]/edit` page + `EditOrderForm.tsx` (new) for address + line-item editing, including an "Add item" row reusing the same product/variant search `AddOrderForm.tsx` already has) | COMPLETE (`Order`/`OrderItem`/`OrderAddress` owned by Checkout; `OrderStatusHistory` owned here; Phase 6S: `Order.source` column + `OrderSource` enum, `ShippingMethod.isPublic` for the non-customer-facing seeded "Manual" method offline orders attach to; **Phase 6T**: `Order.userId` nullable, `Order.guestEmail` added, migration `add_guest_orders`; **Phase 6V**: new `OrderAddressType` enum (`BILLING`/`SHIPPING`), `OrderAddress.orderId` unique constraint replaced with `@@unique([orderId, type])`, `Order.address OrderAddress?` → `Order.addresses OrderAddress[]` — migration `add_order_address_type` backfills every pre-existing order's single row as `SHIPPING` and synthesizes a matching `BILLING` row) | COMPLETE | COMPLETE (**Phase 6T**: new guest-order create/search/display test cases added to `orders.admin.test.ts`; **Phase 6V**: +18 new cases in `orders.admin.test.ts` covering admin edit (quantity/price/address/add-line/remove-line/duplicate-variant-rejection) and admin delete, each re-checked against all three mutability-gate trip conditions and the new permissions) | COMPLETE (**Phase 6V**: delete is a real hard delete, but only ever reachable while the shared mutability gate passes — same gate blocks edit) | COMPLETE |
| Payments | COMPLETE (**Phase 6S**: `requireCodPayment`'s staff-attested mark-paid/mark-failed/mark-refunded gate now also accepts provider `MANUAL` (admin-entered offline orders), not just `COD` — no new endpoints) | COMPLETE (customer-facing read-only surfaces unchanged — Phase 5B-7; **Phase 6H**: admin Order Detail now exposes mark-paid/mark-failed/mark-refunded (COD) and refund (gateway) staff actions, `payments:update`/`payments:refund`-gated, no new backend endpoints; **Phase 6S**: same actions, plus the Orders list's inline Payment dropdown, now also apply to `MANUAL`-provider payments) | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE |
| Shipping | COMPLETE (**Phase 6U**: `ShipmentStatus` gained `ITEM_RETURNED`/`ITEM_LOST` — migration `add_shipment_item_outcome_statuses` — reachable only from post-dispatch statuses and only once the parent Order is `CANCELLED`; `assertOrderShippable` now takes the target status and carves out exactly this case, every other terminal-order block unchanged; new `SHIPMENT_ITEM_OUTCOME_REQUIRES_CANCELLED_ORDER` error for the inverse) | COMPLETE (method selection in Checkout unchanged; **Phase 6H**: admin Order Detail now exposes shipment status transitions + tracking number/carrier editing, `shipping:update`-gated; **Phase 6U**: `ShipmentActions`/`ShipmentInlineStatusSelect` now take `orderStatus` and only offer `ITEM_RETURNED`/`ITEM_LOST` when the order is cancelled, so a cancelled order's shipment is no longer fully locked — it can record what happened to an already-dispatched item) | COMPLETE (**Phase 6U**: `ShipmentStatus` enum +2 values, same migration above) | COMPLETE | COMPLETE (**Phase 6U**: +4 cases in `shipping.test.ts` covering the new carve-out, its inverse, the invalid-from-PENDING case, and that other terminal statuses stay fully blocked) | COMPLETE | COMPLETE (`docs/modules/SHIPPING.md`) |
| Returns | COMPLETE | COMPLETE (**Phase 6H**: admin Order Detail now exposes approve/reject/receive/refund actions on open returns, `returns:update`-gated — first Returns frontend of any kind) | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE |
| Customers | COMPLETE (Phase 6M: `/admin/customers` — list/detail/create/status, `customers:read/update/create`-gated; same `User` table as Users, hard-scoped server-side to `roleKey="customer"`; batched per-customer order stats via new `OrdersRepository.getStatsByUserIds()`; **Phase 6T**: admin-created customers are now pre-verified (`ACTIVE`+`emailVerifiedAt` set, no verification email — new `AuthRepository.createPreVerifiedCustomer`); new `customers:delete` permission backing `DELETE /admin/customers/:id` (soft delete only — `deletedAt`, sessions revoked, never a real row delete); new `PATCH /admin/customers/:id` for identity/address updates; `User` gained six flat address columns) | COMPLETE (Phase 6M: real Admin Customers module — `/admin/customers` list with search/status filters/pagination/order-count/total-spent, `/admin/customers/[id]` detail with status action, `/admin/customers/new` create form with no role field; now the primary admin nav item, replacing "Users & Roles"; **Phase 6T**: 500ms-debounced live search, full-width Add Customer form, address fields on create/edit, new `/admin/customers/[id]/edit` page, Delete action, status toggle relabeled "Mark active"/"Mark inactive") | N/A (no new table — reuses `User`/`UserRole`; **Phase 6T**: `User` gained `addressLine1`/`addressLine2`/`city`/`region`/`postalCode`/`countryCode`, migration `add_guest_orders` (bundled with the Orders nullable-userId change)) | COMPLETE (Phase 6M: 4 endpoints; **Phase 6T**: +2 — `PATCH`/`DELETE /admin/customers/:id`) | COMPLETE (Phase 6M: `customers.test.ts`, 13 tests; **Phase 6T**: +9 covering pre-verified creation/no-email-sent, address validation, update, soft-delete, self-delete-blocked) | COMPLETE (Phase 6M: role-scoped 404s prevent super_admin exposure/mutation through this surface, admin-create never accepts a role field; **Phase 6T**: delete is soft-only so order-history FKs can never break, self-delete blocked) | COMPLETE (`docs/modules/USERS.md`, `docs/API_CONTRACTS.md`, `docs/RBAC.md`) — **Phase 7A** added a separate, real customer-facing address book (new `Address` model/`addresses` module), unrelated to and not replacing this row's `User` flat address columns |
| Promotions | COMPLETE (**Phase 6X**: new `src/modules/promotions/` — full CRUD (`/admin/promotions*`, `promotions:create/read/update/delete`, already pre-seeded), public `GET /promotions/active` backing the homepage Promotion Section, image upload reusing the existing factored-out multer helper; **2026-10-14**: image upload now goes through the same `MediaProvider` abstraction as Catalog (local dev/test, Cloudinary required in production) — see Catalog row. Status is deliberately computed at read time from `isDraft`+`startAt`/`endAt` — never stored — the first date-range-driven computed-status pattern in this codebase; **Phase 6Y**: Grid layout's second card (`grid2*` field set — overline/title/subtitle/badge/discount/CTA/image/target) is now embedded on the same `Promotion` row instead of requiring a second linked row — migration `add_promotion_grid2`, purely additive; `getActiveForHomepage`'s GRID branch now resolves to one row (its own grid1+grid2 fields are the two cards) instead of pairing two separate rows) | COMPLETE (**Phase 6X**: homepage Promotion Section rebuilt fully dynamic — `PromoBannerSingle.tsx`/`PromoBannerGrid.tsx` presentational components, `PromoBanner.tsx` is now an async Server Component with zero hardcoded copy/image/discount; full admin UI at `/admin/promotions` — list/create/edit, product-typeahead-or-category target picker, image upload, live preview panel; Promotions re-added to the admin nav, previously a disabled placeholder; **Phase 6Y**: `PromotionCardFields.tsx` (new) extracts the card-content UI into a reusable component rendered once for Grid 1 and once for Grid 2 when layout is GRID; `PromoBannerGrid.tsx` now takes a plain `cards` array built from one promotion's grid1+grid2 fields) | COMPLETE (`Promotion` model + migrations `add_promotions`/`add_promotion_notification_type`/`add_promotion_overline`/`add_promotion_grid2`) | COMPLETE (**Phase 6X**: 6 endpoints — 5 admin CRUD + upload-image, 1 public; **Phase 6Y**: same endpoints, request/response shapes extended with grid2 fields) | COMPLETE (**Phase 6X**: `promotions.test.ts`, 20 tests; **Phase 6Y**: suite updated to 27 tests — cross-record-pairing tests replaced with single-row-embedded-grid2 coverage: both-cards-from-one-row, grid1-edit-doesn't-touch-grid2 and vice versa, layout-switch preserves grid2, grid2 target validation) | COMPLETE (**Phase 6X**: permission-gated admin writes, public endpoint exposes only storefront-safe fields, target existence validated server-side against Catalog's own repositories; **Phase 6Y**: grid2 target validated the same way, independently of the primary target) | COMPLETE (`docs/CURRENT_TASK.md`) |
| Reviews | COMPLETE (**Phase 6N**: `Review` gained `source`/`isVerifiedPurchase`; submission (`POST /products/:productId/reviews`, CAPTCHA+rate-limited+upsert-on-resubmit), ownership `PATCH`/`DELETE /reviews/:id`, verified-purchase check against Orders, full admin surface `/admin/reviews*` (`reviews:read/moderate/delete`-gated) — see Phase 5C-1/6C for the pre-existing public-read foundation; **Phase 6W**: new public, paginated, cross-product `GET /reviews` — `listPublished` (repository/service/controller) + `toPublicReviewWithProductResponse` mapper, published-only, includes each review's product name/slug/primary image) | COMPLETE (**Phase 6N**: real "write a review"/"edit your review" form on the Product Detail page replacing the dead `#reviews` anchor, "Verified Purchase" badge, Admin Dashboard "Reviews" module — list/detail/create modeled on Categories — and an About page testimonials section reusing the Homepage's `Testimonials` component; **Phase 6U**: `/admin/reviews/[id]`'s width constraint widened `max-w-2xl` → `max-w-4xl` — the header's action buttons and the review-text field were cramped at 672px; **Phase 6W**: new sitewide `/reviews` page (+ `loading.tsx`) replaces the homepage Testimonials' dead `/about#testimonials` link — paginated, product thumbnail+link per review, reuses `ShopPagination`) | COMPLETE (`Review` model + migrations `add_review_source_and_verified_purchase`/`add_review_source_check_constraint`) | COMPLETE (**Phase 6N**: 8 new endpoints; **Phase 6W**: +1, `GET /reviews`) | COMPLETE (**Phase 6N**: `reviews.test.ts`, 22 tests — submission/upsert, ownership isolation, verified-purchase matrix, admin permission boundaries, moderation-driven rating recalculation, product isolation; **Phase 6W**: no new automated test — verified via `tsc`/lint + manual `curl`, no `reviews.test.ts` extension made) | COMPLETE (**Phase 6N**: CAPTCHA+rate-limit on submission, ownership 404-not-403, permission-gated admin writes, `isVerifiedPurchase` forced false server-side for non-CUSTOMER sources + DB CHECK; **Phase 6W**: new public endpoint exposes only the same public review fields plus product name/slug/image, never moderation fields) | COMPLETE (`docs/modules/REVIEWS.md`) |
| Wishlist | COMPLETE | COMPLETE (ProductCard heart, Product Detail heart, `/account/wishlist` page, Header count — see Phase 5B-2C) | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE |
| Notifications | COMPLETE (`src/modules/notifications/` — `Notification`/`NotificationRead` models, `notifyAdmins` helper, `GET /admin/notifications` (offset-paginated, `limit:20` default/50 max, newest-first), `GET .../unread-count`, `PATCH .../:id/read`, `PATCH .../read-all`, all `notifications:read`/`notifications:update`-gated; dedup via `@@unique([type, entityId])` + upsert. This row was stale as NOT STARTED despite being built incrementally alongside other domains' own `notifyAdmins` call sites — corrected **Phase 6Y**, which also added the missing `ORDER_CANCELLED` event (`orders.controller.ts#updateStatus`, fires only on an actual cancellation) and fixed `NOTIFICATION_PERMISSION_KEYS` missing `"promotions:read"`. **Phase 7A** added a second, ownership-scoped `CustomerNotification` model/router in the same module (`GET /notifications`, `.../unread-count`, `PATCH .../:id/read`, `.../read-all`, no permission gate) — a separate customer-facing feed, not an extension of the admin one above; wired from `orders.controller.ts#updateStatus` (every transition, not just cancellation) and a new `POST /admin/promotions/broadcast`) | COMPLETE (`AdminNotificationBell.tsx` — dropdown, unread badge, 30s poll, mark-read/mark-all-read; **Phase 6Y**: bumped from a hardcoded `limit:10` single fetch to `limit:20` + a "Load more" button appending subsequent pages via the existing `cursor` param; `AdminNotificationType`/`ENTITY_ROUTES` gained `ORDER_CANCELLED`/`PROMOTION_CREATED`/`Promotion`, previously missing. **Phase 7A**: new `NotificationsView.tsx` + real `/account/notifications` page, no bell icon added) | COMPLETE (`Notification`/`NotificationRead` models; **Phase 6Y**: migration `add_order_cancelled_notification_type`; **Phase 7A**: new `CustomerNotification` model + `CustomerNotificationType` enum, migration `add_address_and_customer_notifications`) | COMPLETE (4 endpoints; **Phase 7A**: +4 customer-facing + 1 admin broadcast) | COMPLETE (**Phase 6Y**: new `notifications.test.ts`, 10 tests — order-cancellation create/no-double-fire/no-false-positive, promotion-created visibility before/after the allowlist fix, list ordering/pagination, mark-read/mark-all-read persistence, dedup; **Phase 7A**: extended `orders.admin.test.ts`/`promotions.test.ts` covering the customer feed's fire-once-per-transition and broadcast fan-out) | COMPLETE (permission-gated, domain-allowlist-scoped visibility per caller; **Phase 7A**'s customer feed is ownership-scoped instead, each query filtered by `userId`) | COMPLETE (`docs/CURRENT_TASK.md`) |
| CMS | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED |
| Analytics | PARTIAL (**Phase 6I**: new `src/modules/analytics/` — one aggregation endpoint, `GET /admin/analytics/dashboard`, backing the real admin dashboard; no other analytics/reporting endpoints exist) | COMPLETE (**Phase 6I**: real `/admin` (redirect) + `/admin/dashboard` — KPI cards, per-market sales chart, top products, low stock, recent orders/customers, quick actions, all from real data; matches `design-references/Dashboard.png` with documented, justified deviations — see `docs/modules/ANALYTICS.md`) | N/A (reads existing tables only; no new model) | COMPLETE (one endpoint) | COMPLETE (`analytics.test.ts`: auth, permission, empty-data, invalid param, no-combined-currency assertions) | COMPLETE (`analytics:read`-gated, no sensitive fields returned) | COMPLETE (`docs/modules/ANALYTICS.md`) |
| Audit | COMPLETE | NOT STARTED | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE |
| Contact | COMPLETE (MVP — persist + email, see `docs/modules/CONTACT.md`) | COMPLETE (real `/contact` page: hero, form, info card, FAQ accordion, office/map card — replaces prior placeholder) | COMPLETE (`ContactSubmission` model, migration `add_contact_submissions`) | COMPLETE (one endpoint: `POST /contact`) | NOT STARTED (verified manually via curl/DB query end-to-end — no automated `contact.test.ts` yet) | COMPLETE (CAPTCHA + rate limit + honeypot + server-side recipient resolution + HTML-escaping) | COMPLETE (`docs/modules/CONTACT.md`) |

> Storefront pages and admin dashboard areas (screen-level tracking) will be added to this table once page-level work begins.

**Phase 6L note:** an API-level (not browser) QA pass re-verified Auth/RBAC/Markets/Products/Categories/Inventory/Orders/Payments/Shipping/Cart/Wishlist against the running dev backend — no regressions found. Visual/responsive/design-reference verification for every module above remains unperformed (no browser tool available in this environment); the "no browser/UI verification was performed" caveat already present in several phases' CHANGELOG entries (6H onward) still applies unchanged. See `docs/CURRENT_TASK.md` for the full account.

**Phase 6M note:** fixed the login-routing bug, rebuilt the admin sidebar (Customers replaces "Users & Roles" as the primary nav item), added the Customers module and real product-image upload, and added a Settings page — all verified at the code/test/build level (backend 564/564 tests, frontend lint/typecheck/build all clean). Browser verification remains unperformed for the same reason as 6L. See `docs/CURRENT_TASK.md` for the full account.

**Phase 6W note:** `AdminShell.tsx` (shared by every `/admin/*` page, not owned by one module row above) got mobile/small-screen fixes — search icon + overlay, notification bell + profile menu now visible below `md` (previously hidden with no replacement), brand name visible next to the hamburger when the sidebar is off-canvas, and a thin-scrollbar utility applied to `AdminTable` and `MarketScopedSection`'s market-tab row. Verified via `tsc`/lint only — no browser tool available in this environment, so mobile-breakpoint behavior is unconfirmed visually. See `docs/CURRENT_TASK.md`.

**Phase 6X note:** three Admin Dashboard cards (Recent Orders/Low Stock/Recent Customers, all under Analytics' dashboard row above, not owned by one module row above) had their `AdminTable` columns given a `max-w-*`/`truncate` constraint on the one variable-length column each — the dashboard's own `AdminTable` usage was the only gap, `AdminTable.tsx` itself already handled overflow correctly via its `overflow-x-auto`+`scrollbar-thin` wrapper. See `docs/CURRENT_TASK.md` and the Promotions row above for the Phase 6X Promotions build.

## Technical Foundation (Phase 4B)

Scaffolding only — no business module rows above are affected by this.

| Item | Status |
|---|---|
| Backend app skeleton (Express/TypeScript, health endpoint, error handling) | COMPLETE |
| Frontend app skeleton (Next.js/TypeScript/Tailwind, placeholder root route) | COMPLETE — superseded by Phase 5A foundation below |
| Database/Prisma wiring (PostgreSQL + Prisma 7, client, migration, seed) | COMPLETE |
| Foundational schema: Identity, Users, RBAC, Markets, Catalog, Pricing | COMPLETE |
| Schema for all other domains (Inventory, Cart, Orders, Payments, …) | NOT STARTED |

## Frontend Foundation, Design System & Shared Application Shell (Phase 5A)

Foundation only — no business/page logic. See `docs/CURRENT_TASK.md` for the full account and `design-references/` for the approved visual source.

| Item | Status |
|---|---|
| Design tokens (Tailwind v4 `@theme`: colors, radius, container, fonts) in `globals.css` | COMPLETE |
| Fonts (Inter body/UI, Playfair Display hero/editorial, Geist Mono numerics) wired via `next/font/google` | COMPLETE |
| UI primitives (`Button`, `IconButton`, `Input`, `FormField`, `Select`, `Checkbox`, `SearchField`, `Badge`, `Card`, `Container`, `Section`, `Dropdown`, `Skeleton`, `EmptyState`, `ErrorState`, `SocialIcon`) | COMPLETE |
| Header (utility bar, main bar, category dropdown, mobile nav drawer) — reusable, data-driven category menu | COMPLETE |
| Footer — single reusable component (Home-page canonical version) used on every storefront/auth/account page | COMPLETE |
| Catalog presentational shells (`CategoryTile`, `ProductCard`) — no data fetching | COMPLETE |
| Route skeleton: `(storefront)`, `(auth)`, `account`, `admin` groups — placeholder pages, no business content | COMPLETE |
| API client foundation (`ApiError`, `ApiEnvelope`/`ApiErrorBody` types, `endpoints.ts` path constants, `credentials: "include"`) | COMPLETE — no business calls wired yet |
| Minimal state (`CartWishlistContext`, count-only, zero-initialized) | COMPLETE |
| Full page business logic (Home content, Shop listing/filtering, Product detail, Blog, Cart, Wishlist, Checkout, Account, Admin dashboard data) | NOT STARTED (deliberately deferred to Phase 5B+) |
| Real auth wiring, real category/product data, admin data endpoints | NOT STARTED (deliberately deferred) |

## Catalog Integration + Home / Shop / Category / Product Pages (Phase 5B-1)

Real backend data now powers Home/Shop/Categories/Product-detail. See `docs/CURRENT_TASK.md` for the full account, including confirmed backend-contract gaps.

| Item | Status |
|---|---|
| Catalog API service layer (`lib/api/catalog.ts`: `getCategories`, `getCategoryById`, `getProducts`, `getProductBySlug`, `getVariantPrice`, `getVariantStock`, `getProductCardData(s)`) | COMPLETE — only verified backend endpoints wrapped |
| Catalog types (`lib/types/catalog.ts`) mirroring backend response shapes verbatim | COMPLETE |
| Header category menu / mobile nav — real data via props, no more hardcoded categories | COMPLETE |
| Home — real category grid + "Latest Products" section (Suspense + skeleton) | COMPLETE |
| Shop (`/products`) — real listing, category filter, search, pagination, all via URL query params | COMPLETE |
| Categories (`/categories`) — real grid, links into Shop with a category filter | COMPLETE |
| Product detail (`/products/[slug]`) — real detail, gallery, variant selector with live price/stock re-fetch, 404 handling | COMPLETE |
| Sort UI, strikethrough compare-price | NOT BUILT — no `sort` query param on the backend list endpoint; public pricing never returns the pre-sale original amount (confirmed contract gaps, see CURRENT_TASK.md) |
| Real market selection | NOT BUILT — hardcoded `DEFAULT_MARKET_CODE = "PK"` placeholder; Markets domain API itself is NOT STARTED backend-side |
| Cart/Wishlist mutations, Auth, Checkout, Account, Admin business logic | NOT STARTED (out of this phase's scope) |

## Authentication Foundation & Frontend Integration (Phase 5B-2A)

Frontend now integrates with the backend's real auth system. See `docs/CURRENT_TASK.md` for the full account, including the confirmed contract and a documented Next.js streaming/404-status finding.

| Item | Status |
|---|---|
| Auth API service layer (`lib/api/auth.ts`: `login`, `register`, `logout`, `logoutAll`, `forgotPassword`, `resetPassword`, `getMe`, `getMeWithRefresh`) | COMPLETE — only verified backend endpoints wrapped |
| Server-side session helper (`lib/api/auth-server.ts`: `getServerSession`, forwards cookies for Server Component route guards) | COMPLETE |
| Auth types (`lib/types/auth.ts`) mirroring backend response shapes verbatim | COMPLETE |
| `AuthProvider`/`useAuth` context (status/user/roles/permissions, concurrency-safe session bootstrap with one-shot refresh-and-retry) | COMPLETE |
| CSRF header centralized in `lib/api.ts` for every non-GET request | COMPLETE |
| Real Cloudflare Turnstile widget (`components/auth/Turnstile.tsx`) — never faked/bypassed; local dev uses Cloudflare's public test site key | COMPLETE |
| Login/Register/Forgot-Password/Reset-Password — wired to real backend, preserving Phase 5A visual design | COMPLETE |
| Header/MobileNav auth-aware (login link vs. account menu with logout) | COMPLETE |
| Route guards: `/account/*` and `/admin/*` redirect to `/login` server-side if unauthenticated (UX/navigation guard only — backend remains the real authorization boundary) | COMPLETE |
| Fixed: `lib/api.ts` crashed on 204 No Content responses (e.g. `POST /auth/logout`) — found and fixed this phase | FIXED |
| Fixed: `endpoints.ts` had a wrong/unverified `/users/me` path; corrected to the real `/auth/me` | FIXED |
| Cart/Wishlist/Checkout/Account business pages, Admin RBAC UI | NOT STARTED (out of this phase's scope) |
| `/products/[slug]` HTTP status on `notFound()` | DOCUMENTED, not fixed — Next.js streams this route (via the parent `products/loading.tsx` Suspense boundary), so per Next's own documented behavior the HTTP status stays 200 even though the correct not-found UI renders and Next auto-injects `<meta name="robots" content="noindex">` (verified present). A true 404 status would require dropping the Shop's loading skeleton or adding a proxy/middleware existence pre-check — out of this phase's scope, flagged for a future decision. |

## Cart & Wishlist Frontend Integration (Phase 5B-2B)

Frontend now connects to the real Cart backend. Wishlist has no backend to connect to — confirmed absent via source audit, UI left as an inert placeholder. See `docs/CURRENT_TASK.md` for the full account.

| Item | Status |
|---|---|
| Cart API service layer (`lib/api/cart.ts`: `getCart`, `addCartItem`, `updateCartItem`, `removeCartItem`, `clearCart`) — one 401-retry-once wrapper reusing 5B-2A's `refreshOnce()` | COMPLETE — only verified backend endpoints wrapped |
| Cart types (`lib/types/cart.ts`) mirroring `backend/src/modules/cart/cart.mapper.ts` verbatim | COMPLETE |
| `CartWishlistContext`/`useCartWishlist` — real cart state (`cart`, `cartCount`, loading/error, per-action pending-key tracking), wired to `useAuth()` status transitions (fetch on login, clear on logout — no cross-user leakage) | COMPLETE — `wishlistCount` stays static `0`, no backend exists |
| ProductCard Add to Cart (`components/catalog/AddToCartButton.tsx`) — real add, unauthenticated click redirects to `/login?redirect=<path>` | COMPLETE |
| Product Detail Add to Cart / Buy Now (`VariantSelector.tsx`) — real add with a new `QuantityStepper`; Buy Now is add-to-cart + redirect to `/checkout` (Phase 5B-3 — resolved, no longer interim) | COMPLETE |
| Cart page (`/cart`, `components/cart/CartView.tsx`) — real items, quantity update, remove, clear, subtotal, stale/unavailable-item indication, sign-in prompt when logged out | COMPLETE |
| Header cart count (`MainBar.tsx`) | COMPLETE — no code change needed, now reflects real `cartCount` from the rewritten context |
| Login redirect support (`?redirect=` on `/login`, same-origin-relative-path validated) | COMPLETE |
| Wishlist (ProductCard heart, Header icon/count, `/account/wishlist`) | NOT BUILT — confirmed zero backend implementation (no routes/controller/Prisma model; `docs/modules/WISHLIST.md`/`MODULE_STATUS.md` already said NOT STARTED). Left exactly as today's disabled placeholders, per explicit "don't fake a backend" instruction. |
| Checkout, Orders, Payments, Customer Account business pages, Admin | NOT STARTED (out of this phase's scope) |
| Doc/code discrepancy found: `docs/API_CONTRACTS.md` implies cart validation errors return `CART_VALIDATION_ERROR`; the actual code always returns `AUTH_VALIDATION_ERROR` (the shared `validate()` middleware never calls `cartErrors.validation()`) | DOCUMENTED — frontend error-code handling matches the real code, not the doc |

## Wishlist Backend + Frontend Integration (Phase 5B-2C)

Built the Wishlist backend from scratch (confirmed absent in 5B-2B) and wired it to the frontend. See `docs/CURRENT_TASK.md` for the full PRD-grounded domain-decision account.

| Item | Status |
|---|---|
| Wishlist domain module (`backend/src/modules/wishlist/*`: routes/controller/service/repository/mapper/validators, mirroring Cart's file structure) | COMPLETE |
| `Wishlist`/`WishlistItem` Prisma models (migration `wishlist_foundation`) — product-level, market-independent, one wishlist per user, `@@unique([wishlistId, productId])` | COMPLETE — PRD-grounded (§18, §46, §2B.22, §2C.17), not guessed |
| API: `GET /wishlist`, `POST /wishlist/items` (idempotent duplicate add), `DELETE /wishlist/items/:productId` | COMPLETE — matches PRD §2C.17 exactly |
| `wishlistErrors` (`WISHLIST_PRODUCT_UNAVAILABLE`, `WISHLIST_ITEM_NOT_FOUND`, `WISHLIST_VALIDATION_ERROR`) | COMPLETE |
| Backend tests (`wishlist.test.ts`: auth/ownership, CRUD, idempotent duplicate-add, stale-visibility, concurrency, DB constraints) | COMPLETE — 21 tests, full suite (453 tests) re-run twice with zero regression in Cart or any other domain |
| Frontend: `lib/api/withAuthRetry.ts` (extracted from `lib/api/cart.ts`, both now share it), `lib/api/wishlist.ts`, `lib/types/wishlist.ts` | COMPLETE |
| `CartWishlistContext` extended with real wishlist state (`wishlist`, `wishlistCount`, `wishlistProductIds`, `toggleWishlist`) alongside the existing real cart state — Cart's own behavior unchanged | COMPLETE |
| ProductCard wishlist heart (`components/catalog/WishlistButton.tsx`) — real toggle, unauthenticated click redirects to `/login?redirect=<path>` | COMPLETE |
| Product Detail wishlist button — **new** (none existed pre-5B-2C, confirmed with you before adding), product-level, in `VariantSelector.tsx` next to price | COMPLETE |
| Wishlist page (`/account/wishlist`, `components/wishlist/WishlistView.tsx`) — reuses `ProductCard` directly (no duplicated presentation logic), "Move to Cart" (direct add + remove-from-wishlist for single-variant items, "Select Options" link for multi-variant items — never silently guesses a variant) | COMPLETE |
| Header wishlist count (`MainBar.tsx`) | COMPLETE — no code change needed, now reflects real `wishlistCount` |
| Footer 404 fix: `/shipping-policy`, `/return-policy` (confirmed dead links, no route existed) | COMPLETE — built as minimal static pages mirroring `/about` |
| Checkout, Orders, Payments, Admin, real market selection | NOT STARTED (out of this phase's scope) |

## Checkout Frontend Integration (Phase 5B-3)

Wired the frontend to the existing, already-COMPLETE Checkout/Orders/Shipping backend (zero backend behavior changed — the audit found the implementation fully self-consistent and needing no fixes). See `docs/CURRENT_TASK.md` for the full backend-contract account.

| Item | Status |
|---|---|
| `lib/api/checkout.ts` (`submitCheckout`, `Idempotency-Key` header, wrapped in shared `withAuthRetry`), `lib/api/orders.ts` (`listOrders`, `getOrder`), `lib/api/shipping.ts` (`getShippingMethods`, public no-auth route) | COMPLETE |
| `lib/types/checkout.ts`, `lib/types/orders.ts`, `lib/types/shipping.ts` — mirror backend mapper shapes verbatim; `CHECKOUT_ERROR_MESSAGES`/`ORDERS_ERROR_MESSAGES` maps | COMPLETE |
| `/checkout` page (`components/checkout/CheckoutView.tsx`) — single-page form (address, shipping method radio list, COD-only payment display, live order summary with estimated total), client-generated idempotency key held for the page lifetime, unauthenticated → sign-in CTA, unverified email → inline notice (`AUTH_EMAIL_NOT_VERIFIED` pre-empted client-side), unavailable/out-of-stock cart items blocked pre-submit with a link back to `/cart` | COMPLETE |
| `/account/orders` (`components/orders/OrdersListView.tsx`, rewritten from its placeholder) — order list with status badges and totals | COMPLETE |
| `/account/orders/[id]` (`components/orders/OrderDetailView.tsx`, new) — full order detail (address, items, totals breakdown, status history); `?placed=1` shows a "Order placed!" success banner in place of a separate confirmation page | COMPLETE |
| Buy Now (`VariantSelector.tsx`) — now redirects to `/checkout` instead of `/cart` after adding, since a real checkout destination exists; interim mapping is resolved, no longer deferred | COMPLETE |
| `CartWishlistContext` — no structural change; `refreshCart()` (already exported) called once after a successful checkout to sync the header badge | COMPLETE |
| Live verification: full checkout (address + shipping + COD) → order created → redirected to order detail with success banner → appears in order history; cart empties after checkout; empty-cart checkout blocked; double-submit does not create a duplicate order (client button-disable + server idempotency key, both confirmed); Buy Now → `/checkout`; unauthenticated `/checkout` (client-side CTA) and `/account/orders` (server redirect) both handled correctly; two-user order-history isolation; full Cart/Wishlist regression pass | COMPLETE |
| Payments/Shipment/tracking detail UI, Returns UI, admin order management, real payment-provider integration, coupon UI, saved-address book, market-selection UI | NOT STARTED (out of this phase's scope) |

## Email Verification + Checkout Readiness (Phase 5B-4)

Closed two gaps surfaced during Phase 5B-3 live verification: no frontend `/verify-email` page existed anywhere (blocking any real customer from clearing Checkout's `requireVerifiedEmail` gate), and no repeatable `ShippingMethod` seed existed (Checkout's shipping-method step was unusable on a fresh database). Zero backend behavior changed — both fixes are frontend + dev-seed only, against the existing unmodified backend contract.

| Item | Status |
|---|---|
| `lib/api/auth.ts` — added `verifyEmail(token)` (no auth) and `resendVerification()` (reuses this file's own `refreshOnce()` 401-retry inline, avoiding a circular import with the extracted `withAuthRetry` wrapper); `lib/endpoints.ts` — added `auth.verifyEmail`, `auth.resendVerification` | COMPLETE |
| `/verify-email` page (`components/auth/VerifyEmailPanel.tsx`, new) — auto-verifies on mount, handles missing-token / loading / success (covers both "just verified" and "already verified", since the backend response doesn't distinguish them) / invalid-expired-token (with a "Resend Verification Email" action when authenticated, "Log In" otherwise) / generic-error states; calls `refreshSession()` on success so an already-open session picks up `emailVerified: true` immediately | COMPLETE |
| `backend/prisma/seed.ts` — added `seedShippingMethods()` (one "Standard Shipping" method per market, `PK`/`AE`, values aligned with the storefront header's own existing "Free Shipping above 10,000 PKR / 300 AED" copy), idempotent via find-then-create-or-update keyed on `(marketId, name)` since `ShippingMethod` has no unique constraint beyond `id` — no schema/migration change | COMPLETE — verified via two consecutive `npm run db:seed` runs producing exactly 2 rows both times, no duplicates; the Phase 5B-3 manually-inserted row was picked up and updated in place (same `id`, seed's canonical values) rather than duplicated |
| Live verification: real `/verify-email` link flow (register → dev console-email log → click link → success) replaces the Phase 5B-3 direct-API workaround; re-clicking a consumed link is idempotent-success; invalid token shows resend option; full checkout regression re-run against the freshly-seeded DB (address/shipping/COD/order-creation/idempotency-double-submit/empty-cart/order-redirect/ownership-isolation/Buy-Now/Cart-Wishlist-regression) — all pass | COMPLETE |
| Any other storefront pages, admin functionality, real payment-provider integration, shipment tracking/Returns frontend, market-selection UI, catalog N+1 fix, product-detail 404 status fix, Turnstile production key | NOT STARTED (out of this phase's scope, unchanged carry-forwards) |

## Customer Account Frontend (Phase 5B-5)

Built the complete Account Dashboard matching `design-references/Customer-account page.png`, replacing all four remaining `/account/*` placeholders (Dashboard, Profile, Change Password route, Notifications) with real or deliberately-inert sections — never fabricated ones. A backend audit found no Address-book domain, no profile-edit endpoint, and no Notifications/Support backend at all; each gap was confirmed with the user rather than guessed around. Zero backend code changed.

| Item | Status |
|---|---|
| `lib/api/auth.ts` — added `changePassword({currentPassword, newPassword})` (reuses the file's own inline `refreshOnce()` retry, same pattern as `resendVerification`); `lib/endpoints.ts` — added `auth.changePassword` | COMPLETE |
| `lib/api/orders.ts` — extended `listOrders()` to accept `{page, limit}`; added `listAllOrders()` (loops every page, max 100/backend cap, to return a customer's full order list — no backend aggregate endpoint exists) | COMPLETE |
| `components/account/AccountSidebar.tsx` (new, replaces the plain link list in `app/account/layout.tsx`) — avatar/name/email/verification-badge header, icon nav (`lib/constants/account-nav.ts` extended with icons + Change Password + Notifications), active-state highlight, Logout wired to the existing `useAuth().logout()` | COMPLETE |
| `components/account/AccountDashboard.tsx` (new, `app/account/page.tsx` rewritten) — welcome banner, 3 stat cards (Total Orders via `meta.pagination.total`; Total Spent via `listAllOrders()` summed **per currency**, never mixed across markets; Wishlist Items via the existing `CartWishlistContext`), Recent Orders table (top 5, color-coded status badges, package-icon tile in place of a thumbnail since Orders has zero image data anywhere), Quick Links row, "Need Help?" card linking to the existing `/contact` page | COMPLETE — "Saved Addresses" stat card and "Support" nav item deliberately omitted (confirmed with user: no backend for either) |
| `components/account/ProfileView.tsx` (new, `app/account/profile/page.tsx` rewritten) — read-only display of `firstName`/`lastName`/`email`/`phone`/`emailVerified`/`createdAt` from the existing `useAuth().user`, no new API call; no edit form since no `PATCH` endpoint exists | COMPLETE |
| `components/account/ChangePasswordForm.tsx` (new) + `/account/change-password` (new route) — `currentPassword`/`newPassword`/confirm form calling the new `changePassword()`, clean error for wrong current password, success calls `refreshSession()` (the backend rotates the session on password change) | COMPLETE |
| `/account/notifications` (new) — minimal inert placeholder, same pattern as the pre-existing Addresses/Settings placeholders (confirmed with user: PRD lists Notifications as aspirational, zero backend exists) | COMPLETE (inert, by design) |
| `ORDER_STATUS_BADGE_VARIANT` added to `lib/types/orders.ts`, applied to the new dashboard and retrofitted onto the existing `OrdersListView.tsx`/`OrderDetailView.tsx` (previously always `neutral`) for consistent color-coded status pills across the whole Account section | COMPLETE |
| Live verification: unauthenticated `/account` redirects to login; register → verify → place 2 orders → dashboard shows correct real name/Total Orders/Total Spent/Recent Orders; Profile page shows real read-only data; Change Password rejects a wrong current password and succeeds with the correct one, confirmed via a full re-login with the new password; sidebar Logout clears session and redirects; Addresses/Notifications placeholders load without error; full Cart/Wishlist regression pass; responsive screenshots at 375/768/1280px | COMPLETE |
| Address book CRUD, profile editing, notification delivery, Support/Help center, `/account/settings` content, admin functionality, real payment provider, Shipment-tracking/Returns frontend, market-selection UI | NOT STARTED (out of this phase's scope, unchanged carry-forwards) |

## Customer Account Addresses + Notifications + Profile Edit (Phase 7A)

Closed the three gaps the Phase 5B-5 audit above deliberately left open (address book, profile editing, notification delivery), redesigned the dashboard per `design-references/customer-account page.png`, and fixed an Order Detail completeness bug. User-confirmed scope decisions: Addresses is exactly one Billing + one Shipping row per customer (upsert, never a multi-address book); Promotions got a minimal new admin-triggered broadcast action (no automatic trigger existed).

| Item | Status |
|---|---|
| New `Address` model (`backend/prisma/schema.prisma`) — one row per `(userId, type)`, `AddressType {BILLING, SHIPPING}`, `@@unique([userId, type])`; new `addresses` module (`backend/src/modules/addresses/`, modeled on Wishlist's ownership-only pattern) — `GET /addresses`, `PUT /addresses/billing`, `PUT /addresses/shipping`. Distinct from `User`'s legacy flat address columns (left untouched, still admin-only) and from `OrderAddress` (per-order snapshot, unchanged) | COMPLETE |
| New `CustomerNotification` model — ownership-scoped (`userId` FK, inline `isRead`/`readAt`, no join table), distinct storage/visibility from the existing admin `Notification`/`NotificationRead` pair. Extended `backend/src/modules/notifications/` with a second, customer-facing router (`GET /notifications`, `.../unread-count`, `PATCH .../:id/read`, `PATCH .../read-all`) and a `CustomerNotificationsService`/`notifyCustomer()` helper, reusing the existing module rather than duplicating it | COMPLETE |
| `orders.controller.ts#updateStatus` now also calls `notifyCustomer()` for the order's owning customer on every successful status transition (skipped for guest orders), right alongside the pre-existing admin `notifyAdmins` cancellation hook. Can't double-fire — only reachable after `transitionStatus`'s DB-guarded conditional update has already succeeded | COMPLETE |
| New `POST /admin/promotions/broadcast` (`promotions:update`-gated, no new permission added) — fans out one `PROMOTION` `CustomerNotification` per active customer via a single batched `createMany`; new `UsersRepository.listAllCustomerIds()` | COMPLETE |
| `components/account/ProfileView.tsx` rewritten with a real edit form (first/last name/phone) wired to the pre-existing but previously-unused `updateProfile()` (`PATCH /auth/me`), refreshing via `useAuth().refreshSession()` on save | COMPLETE |
| `components/account/AddressesView.tsx` (new) + real `/account/addresses` page — billing/shipping cards with edit forms, empty-state when unset | COMPLETE |
| `components/account/NotificationsView.tsx` (new) + real `/account/notifications` page — list, unread styling, mark-read/mark-all-read. No header/sidebar bell added — the provided design reference's header doesn't show one | COMPLETE |
| `components/account/AccountDashboard.tsx` — added the 4th "Saved Addresses" stat card (now meaningful) and a second "Stay Updated" side card next to "Need Help?"; stat-card grid now 2x2/4-col responsive | COMPLETE |
| `components/checkout/CheckoutView.tsx` — prefills billing/shipping form state from `GET /addresses` on mount (never blocks checkout on failure/absence); `submitCheckout()` payload and `OrderAddress` snapshot persistence unchanged | COMPLETE |
| `components/orders/OrderDetailView.tsx` — added the missing Billing Address card (backend already returned `billingAddress`, frontend only ever rendered `shippingAddress`) | COMPLETE |
| Backend tests: `addresses.test.ts` (ownership/isolation/upsert-overwrite), extended `orders.admin.test.ts` (notification fires once per transition, not on a failed retry, fires again on a later legal transition), extended `promotions.test.ts` (broadcast auth/permission/fan-out count) | COMPLETE |
| Support ticketing backend, `/account/settings`, real payment provider, Shipment-tracking/Returns frontend, market-selection UI | NOT STARTED (unchanged carry-forwards, out of this phase's scope) |

## Authentication + RBAC + CAPTCHA (Phase 4D-2)

| Item | Status |
|---|---|
| Auth endpoints (register, login, logout, logout-all, refresh, me, verify-email, resend-verification, forgot/reset/change-password) | COMPLETE |
| Refresh-token rotation with reuse detection + grace window | COMPLETE |
| Password-change / password-reset session invalidation | COMPLETE (regression-tested) |
| Argon2id password hashing + common-password blocklist | COMPLETE |
| Permission-based RBAC middleware (`requirePermission`/`requireAllPermissions`/`requireAnyPermission`) | COMPLETE |
| Ownership-based authorization helper (`authorizeOwnerOrPermission`) | COMPLETE (not yet wired to a route — no owned resources exist yet) |
| Cloudflare Turnstile CAPTCHA (provider abstraction, fails closed) | COMPLETE |
| Rate limiting (in-memory, per-endpoint) | COMPLETE |
| CSRF (Origin + custom header), CORS, security headers | COMPLETE |
| Email abstraction (console dev provider) | COMPLETE — real provider deferred |
| Frontend auth UI / global auth state | NOT STARTED |
| Admin user-management endpoints | NOT STARTED |

## Catalog Domain Foundation (Phase 4E-1)

| Item | Status |
|---|---|
| Category CRUD (create/list/get/update/delete) with parent-cycle and in-use-delete guards | COMPLETE |
| Product CRUD (create with default variant, list, get by id/slug, update, soft delete) | COMPLETE |
| Product category association (`PUT /products/:id/categories`) | COMPLETE |
| Product-market availability (`PUT /products/:id/markets/:marketCode`) | COMPLETE |
| Variant CRUD, SKU uniqueness, default-variant invariant (auto-promotion on delete) | COMPLETE |
| Option / option-value CRUD, duplicate-name/value guards, in-use delete guards | COMPLETE |
| Media CRUD, single-primary-per-product invariant | COMPLETE |
| Public vs. admin visibility (status/isActive + per-market `isVisible`) | COMPLETE |
| RBAC reuse of seeded `products:*` / `categories:*` permissions (no new permissions) | COMPLETE |
| Integration tests (categories, products, variants, options, media, markets, RBAC) | COMPLETE |
| Pricing, Inventory, Cart and all downstream domains | NOT STARTED (deferred) |

## Catalog Hardening & Contract Verification (Phase 4E-2)

| Item | Status |
|---|---|
| `GET /products/:productId/variants` visibility gap (was fully public) | FIXED |
| Default-variant / primary-media invariant concurrency (row-locked transactions) | FIXED |
| Duplicate variant option-value combination across variants | FIXED |
| SKU/slug unique-constraint race → generic `CONFLICT` instead of domain code | FIXED |
| `Market.isActive` not checked before product-market association | FIXED |
| Unknown market code on `GET /products?market=` silently returned empty list | FIXED |
| Pagination tiebreaker (`id: asc`) for deterministic paging | FIXED |
| `categories.service` slug-uniqueness-on-update self-exclusion parameter | FIXED |
| Public/private visibility, soft delete, slug stability, SKU scope, category cycle prevention, RBAC wiring, API contract shape | AUDITED — no defect found, documented in `docs/modules/CATALOG.md` |
| New regression tests (visibility, duplicate combination, concurrency, market activeness, category cycles) | COMPLETE |

## Pricing Domain (Phase 4F)

| Item | Status |
|---|---|
| Set/upsert variant price per market (`PUT .../prices/:marketCode`) | COMPLETE |
| Deactivate price (`DELETE .../prices/:marketCode`, sets `isActive:false`) | COMPLETE |
| Get single-market price, list all prices for a variant, public/admin shape split | COMPLETE |
| Currency-matches-market and sale-amount-below-amount invariants | COMPLETE |
| Effective-price resolution (`resolveEffectivePrice`) for future Checkout/Order snapshotting | COMPLETE (resolution logic only — not wired to any other domain) |
| RBAC reuse of seeded `pricing:read`/`pricing:update` permissions (no new permissions) | COMPLETE |
| Read-only Catalog integration (variant/product existence + lifecycle visibility) | COMPLETE — no Catalog file modified |
| Concurrency (atomic `upsert` on the `@@unique([variantId, marketId])` constraint) | COMPLETE |
| Integration tests (set/get/list/deactivate, currency mismatch, invalid sale amount, market isolation, RBAC, Catalog integration, concurrency) | COMPLETE |
| Wiring an effective price into Catalog's product/variant read model, Inventory, Cart, Checkout, Orders | NOT STARTED (deferred) |

## Inventory Domain (Phase 4G)

| Item | Status |
|---|---|
| Stock per variant per market (`VariantStock`, new migration) | COMPLETE |
| Create/setup, get, list (public availability vs admin detail split) | COMPLETE |
| Receive (restock) and adjust (signed correction, audited reason) with `StockMovement` trail | COMPLETE |
| Generic reserve/release reservation primitive (`StockReservation`, idempotent per reference) | COMPLETE |
| Negative-inventory prevention (atomic guarded updates + DB `CHECK` constraints) | COMPLETE |
| Concurrency (guarded single-statement atomic updates, no row lock needed) | COMPLETE, tested under real concurrent load |
| RBAC reuse of seeded `inventory:read`/`inventory:update` permissions (no new permissions) | COMPLETE |
| Read-only Catalog integration (variant/product existence + lifecycle visibility) | COMPLETE — no Catalog file modified |
| Low-stock thresholds, reservation expiry/TTL, warehouse/branch/location model | NOT STARTED (deliberately deferred — undocumented/future-phase concerns, see `docs/modules/INVENTORY.md`) |
| Integration tests (create, get/list, receive, adjust, reserve/release incl. idempotency, negative-stock rejection, market isolation, RBAC incl. inactive role, Catalog integration, concurrency, API contract) | COMPLETE |

## Inventory Architecture Alignment & Hardening (Phase 4G-2)

| Item | Status |
|---|---|
| Market-vs-Warehouse architecture audit against actual project documentation (no PRD found; confirmed with project owner) | COMPLETE — market-scoped `VariantStock` design confirmed correct, no schema change |
| Low-stock deferral made explicit (why deferred, future owner, what's exposed today) | COMPLETE — documented in `docs/modules/INVENTORY.md` |
| Phase 4G Pricing concurrency fix re-verified (5 standalone runs + 2 full-suite runs) | COMPLETE — still holds, not reverted |
| Catalog dormant `isUniqueConstraintViolation` issue re-checked for exposure via Inventory | COMPLETE — confirmed not exposed (Inventory's Catalog touchpoints are read-only) |
| Pricing/Inventory decoupling verified (no import, new response-shape test) | COMPLETE |
| `available = onHand - reserved` invariant given an explicit end-to-end test | COMPLETE |

## Checkout Domain (Phase 4I)

| Item | Status |
|---|---|
| `Order`/`OrderItem`/`OrderAddress` schema (new migration; `order_number_seq` hand-added) | COMPLETE |
| Server-side re-validation of catalog/price/inventory state at checkout time (never trusts Cart's prior checks) | COMPLETE |
| Inventory reservation (never decrement) via Inventory's existing `reserve`/`release` primitive | COMPLETE |
| Cart conversion (`ACTIVE → CONVERTED`, items cleared) atomic with order creation | COMPLETE |
| Cart reuse-after-conversion (`CartRepository.getOrCreateCart` reactivation — the one Cart file touched) | COMPLETE — resolves Phase 4H's flagged uniqueness limitation |
| Idempotency (`Order.idempotencyKey`, simplified from the PRD's fuller model) | COMPLETE |
| Two-phase (saga-style) transaction design — Inventory reservation outside, order-creation inside one Prisma transaction | COMPLETE |
| RBAC: `authenticate` + `requireVerifiedEmail`, ownership-only (no new permissions) | COMPLETE |
| Concurrency defect found and fixed in `InventoryRepository.reserve()` (shared-reference race, surfaced by Checkout's idempotent-retry tests) | COMPLETE — the one Inventory file touched this phase |
| Torn-read guard for Cart's status+items read (`CheckoutRepository.findCartStatus`) | COMPLETE |
| Guest checkout, tax, shipping cost, coupons/promotions, payment-provider integration | NOT STARTED (deliberately deferred — no owning domain exists yet; see `docs/modules/CHECKOUT.md`) |
| Orders' own read/management API | COMPLETE — see Orders Domain (Phase 4J) below |
| Integration tests (auth/ownership, cart preconditions, re-validation failures, request validation, happy path, idempotency, concurrency, data integrity) | COMPLETE — 23 tests |

## Orders Domain (Phase 4J)

| Item | Status |
|---|---|
| `OrderStatusHistory` schema (new, purely additive migration) | COMPLETE |
| `GET /orders`, `GET /orders/:id` (customer, ownership-only) | COMPLETE |
| `GET /admin/orders`, `GET /admin/orders/:id`, `PATCH /admin/orders/:id/status` (staff, `orders:read`/`orders:update`/`orders:cancel`) — first `/admin` URL prefix in this codebase | COMPLETE |
| `RbacService.authorizeOwnerOrPermission` wired for the first time (built in Phase 4H's RBAC work, unused until now) | COMPLETE |
| Status transition state machine (`PENDING → ... → COMPLETED`, cancellation from early/mid states, terminal-state rejection) | COMPLETE |
| Guarded-UPDATE concurrency pattern for status transitions (same "atomic conditional UPDATE" family as Checkout's cart-conversion guard) | COMPLETE |
| Inventory side effects: release reservation on cancellation, release + `onHand` decrement (via existing `InventoryRepository.adjust()`) on completion | COMPLETE — no new Inventory API, reuses the `ADJUSTMENT` movement type |
| Guest orders, tax/shipping/promotions, payment-provider integration/refunds, Shipping's `shipmentStatus`, Returns domain, Warehouse entity | NOT STARTED (deliberately out of scope — see `docs/modules/ORDERS.md`) |
| Integration tests (creation regression, retrieval, listing/filters/pagination, every valid/invalid/terminal transition, permission checks, concurrency, inventory effects) | COMPLETE — 21 tests |
| Full suite re-run twice after this phase | COMPLETE — 346/346, twice, no flakes |

## Payments Domain (Phase 4K)

| Item | Status |
|---|---|
| `Payment`/`PaymentTransaction`/`PaymentWebhookEvent` schema (new migration; hand-added partial unique index) | COMPLETE |
| Provider abstraction (`PaymentProvider` interface, `COD` and `MOCK` implementations) | COMPLETE — `MOCK` is dev/test-only, production-gated at two independent layers |
| Checkout integration: `Payment` row created inside Checkout's own transaction | COMPLETE — the one Checkout file touched this phase |
| Webhook endpoint with HMAC-SHA256 signature verification, raw-body wiring ahead of global JSON/CSRF middleware, and `(provider, eventId)`-keyed idempotency | COMPLETE |
| Staff mark-paid / mark-failed (COD-only) | COMPLETE |
| Refunds (idempotent, over-refund rejected) | COMPLETE |
| `Order.paymentStatus` write path (`OrdersService.updatePaymentStatus`, Payments is the sole writer) | COMPLETE — the one Orders file touched this phase (repository + service passthrough, no route/permission change) |
| Payment-failure → Order/Inventory consequence (PRD gap) | RESOLVED — no auto-cancel, no auto inventory release; staff-driven via the pre-existing Orders cancel endpoint |
| RBAC: `payments:read`/`payments:refund` (already seeded, newly wired) + new `payments:update` | COMPLETE |
| Real provider integration, deferred authorize-then-capture, Returns workflow, Shipping/Notifications interaction | NOT STARTED (deliberately out of scope — see `docs/modules/PAYMENTS.md`) |
| Integration tests (creation regression + concurrency, retrieval, mark-paid/mark-failed, webhook happy path + signature rejection + duplicate delivery + race + mismatch rejections, refund idempotency + over-refund rejection, permission matrix) | COMPLETE — 23 tests |
| Full suite re-run twice after this phase | COMPLETE — 370/370, twice, no flakes |

## Payments Hardening Audit (Phase 4L)

| Item | Status |
|---|---|
| Webhook processing made transactional (event record + status update + transaction insert as one unit); duplicate-catch narrowed to the specific unique violation | COMPLETE |
| Refund concurrency race closed (row-locked transaction, `SELECT ... FOR UPDATE`) | COMPLETE |
| `mark-paid`/`mark-failed` Order-terminal-state guard added (parity with the webhook path) | COMPLETE |
| Documentation correction: `capturePayment()` was never in the PRD's `PaymentProvider` interface | COMPLETE |
| Pending-payment timeout/expiry, generic audit-log system, `Warehouse`/`Inventory.warehouseId` discrepancy | NOT ADDRESSED (deliberately deferred/out of scope — see `docs/CURRENT_TASK.md`) |
| Regression tests for all three fixes | COMPLETE — 3 tests |
| Full suite re-run twice after this phase | COMPLETE — 373/373, twice, no flakes |

## Shipping Domain (Phase 4M)

| Item | Status |
|---|---|
| Re-verified Orders/Inventory cancel-complete concurrency directly against the running code before building on top of it | COMPLETE — design confirmed correct; 2 regression tests added closing a test-coverage gap (no source defect found) |
| `ShippingMethod`/`Shipment` schema (new migration; new `Order.shipmentStatus` column) | COMPLETE — purely additive |
| `ShippingZone` | DEFERRED — PRD names it but never wires it to anything in its own schema; building it would be a purposeless orphan table |
| Provider abstraction (`ShippingProvider` interface, `MANUAL` implementation) | COMPLETE — no webhook, no second/test provider (PRD is silent on carrier webhooks) |
| Checkout reconciliation: real `shippingMethodId` resolution + server-computed `shippingAmount`, `Shipment` row created inside Checkout's own transaction | COMPLETE — breaking change to the checkout request contract (`shippingMethod` string → `shippingMethodId` uuid, now required) |
| Admin `ShippingMethod` CRUD + archive (never hard delete) | COMPLETE |
| Staff shipment status updates: guarded transitions, terminal-order rejection | COMPLETE |
| `Order.shipmentStatus` write path (`OrdersService.updateShipmentStatus`, Shipping is the sole writer) | COMPLETE — the one Orders file touched this phase (repository + service passthrough, no route/permission change) |
| RBAC: `shipping:read`/`shipping:update` | COMPLETE — already pre-seeded and pre-wired to roles ahead of this phase; no `seed.ts` change needed |
| Real carrier integration, carrier webhooks, `ShipmentEvent`/tracking history, partial fulfillment, Returns/Notifications interaction | NOT STARTED (deliberately out of scope — see `docs/modules/SHIPPING.md`) |
| Integration tests (method CRUD/archive/RBAC, checkout cost calculation, Shipment auto-creation, retrieval/ownership, guarded transitions, terminal-order rejection, concurrency) | COMPLETE — 19 tests |
| Full suite re-run twice after this phase | COMPLETE — 394/394, twice, no flakes |

## Returns Domain (Phase 4N)

| Item | Status |
|---|---|
| `Return`/`ReturnItem` schema (new migration; hand-added partial unique index) | COMPLETE — purely additive, no existing table's columns/rows touched |
| Eligibility rule (COMPLETED/RETURNED/REFUNDED, not the PRD's literal DELIVERED) | COMPLETE — confirmed with the requester, documented deviation, see `docs/modules/RETURNS.md` |
| Full customer/staff API (create, list-by-order, get, admin list, approve/reject/receive/refund) | COMPLETE |
| Orders integration (`OrdersService.transitionForReturns`, the sole write path into `Order.status -> RETURNED/REFUNDED`) | COMPLETE — the one Orders file touched this phase; `ORDER_TRANSITIONS` itself unmodified |
| Payments integration (delegates to existing `PaymentsService.refund()`, no second refund implementation) | COMPLETE — surfaced a real, confirmed limitation: COD returns could not complete the refund step (COD's provider always rejects `refundPayment()`) — **closed in Phase 4O**, see below |
| Inventory integration (`InventoryRepository.adjust()` restock on receipt, no new Inventory API) | COMPLETE |
| Shipping integration | NONE, deliberately — avoids a naming collision with the pre-existing `ShipmentStatus.RETURNED` (carrier-side "return to sender", unrelated concept) |
| RBAC: new `returns:read`/`returns:update` permission resource | COMPLETE — genuinely new (unlike Shipping's, which was pre-seeded); `seed.ts` updated, 48 -> 50 permissions |
| Return-shipping/RMA, damaged/non-sellable inventory routing, return window, excluded categories, shipping/tax/discount refund proration | NOT STARTED (deliberately deferred — no PRD support, see `docs/modules/RETURNS.md`) |
| Integration tests (eligibility, full lifecycle, retrieval/RBAC, concurrency) | COMPLETE — 17 tests (Phase 4N) + 2 tests (Phase 4O — COD refund, revert-on-failure) |
| Full suite re-run twice after this phase | COMPLETE — 411/411, twice, no flakes |

## Final Backend Integration + COD Refund + State-Machine Hardening (Phase 4O)

| Item | Status |
|---|---|
| COD refund gap closed: `PaymentsService.markRefunded()` (staff attestation, no provider call, reuses `refundLocked` as-is — not a second refund implementation), `PATCH /admin/payments/:id/mark-refunded` (`payments:refund`-gated) | COMPLETE |
| `ReturnsService.refund()` branches a COD payment to `markRefunded()` instead of the provider-calling `refund()` | COMPLETE |
| Defect found and fixed: `ReturnsService.refund()` claimed the Return's `RECEIVED -> REFUNDED` transition before the Payments call — a failure there left the Return permanently, falsely `REFUNDED` with no retry path. Fixed with a claim/confirm/revert pattern | COMPLETE |
| Return-eligibility documentation contradiction (Phase 4N's `CURRENT_TASK.md` narrated `COMPLETED`-only vs. the actual, correct `{COMPLETED, RETURNED, REFUNDED}` code) | RESOLVED — the code was already correct; only the prose was cleaned up, no code change |
| Order/Shipment/Payment state-machine cross-audit (cancel-vs-mark-paid/mark-failed, cancel-vs-shipment-update, Order-cancel-vs-Return race) | AUDITED — existing terminal-state guards (`assertOrderPayable`/`assertOrderShippable`) already re-fetch fresh Order state before every write; a Return-vs-cancel race is structurally impossible (`CANCELLED` is unreachable from `COMPLETED`, the only Order state a Return can exist against) — no additional guard needed |
| Cart-Checkout-Order, historical price/inventory authority, market/currency, RBAC end-to-end audit | AUDITED — no new defect found, existing Phase 4F-4M coverage confirmed still correct |
| AuditLog | CLASSIFIED **A** (PRD SS38 explicitly requires logging important admin actions) — **not built this phase** per explicit scope instruction; recommended as the next backend phase's first item |
| Payment timeout, `Warehouse`/`Inventory.warehouseId` | RECONFIRMED deferred — no PRD requirement found for the former; the latter is PRD-framed as future-only and additive-compatible with the current schema |
| Frontend/Admin-API readiness audit | COMPLETE — see `docs/CURRENT_TASK.md` for the full walk-through; no blocking contract gap found |
| Regression tests added | COMPLETE — 6 Payments tests (`mark-refunded`), 2 Returns tests (COD refund end-to-end, revert-on-failure) |
| Full suite re-run three times after this phase | COMPLETE — 419/419, three times, no flakes |

## AuditLog Foundation + API Contract Freeze (Phase 4P)

| Item | Status |
|---|---|
| `AuditLog` schema (PRD SS49/SS2B.26 verbatim), migration, repository/service (`create`/`list` only, no update/delete), read API | COMPLETE — purely additive migration |
| `GET /admin/audit-logs`, `audit:read`-gated | COMPLETE — permission was already pre-seeded ahead of this phase (like Shipping's precedent); granted only to `super_admin`, deliberately excluded from `admin` (matches `admin`'s own pre-existing seed.ts description) |
| Write-side wiring (Catalog, Pricing, Inventory, Orders, Payments, Shipping, Returns — PRD SS38's own named actions + two direct-analogy extensions) | COMPLETE — controller-layer only, no service-layer signature changed in any of the seven domains |
| User/Role/Permission-change audit wiring | N/A — no mutation endpoint exists anywhere in this codebase for these actions yet; nothing to wire |
| Refund provenance (Part B): `PaymentTransaction.metadata = { source: "GATEWAY_REFUND"\|"COD_ATTESTATION", returnId }` | COMPLETE — closes a real gap (Return-driven refunds were only informally distinguishable via a string prefix) |
| Distributed-refund-failure risk (Part C, external provider call inside a DB transaction) | DOCUMENTED, not built around — theoretical today (MOCK is synchronous/local, COD calls no provider); a real reconciliation mechanism (webhook-based) exists in skeleton form but is untested for refunds |
| Partial-return/Order-status invariant matrix (Part D) | DOCUMENTED (`docs/modules/RETURNS.md`) + 2 new regression tests (sequential-exhaustion, untouched-second-line) |
| Return/Inventory idempotency (Part E) | RE-VERIFIED, no code change |
| State-machine transition matrix (Part F) | NEW `docs/STATE_MACHINES.md` — consolidates Order/Payment/Shipment/Return tables + a cross-cutting "who writes what" table |
| Cart-Checkout-Order, market/currency audit (Parts G/H) | RE-VERIFIED against current source, no new defect |
| RBAC/ownership matrix (Part I) | NEW consolidated table in `docs/RBAC.md` |
| Admin API matrix (Part J) | See table below |
| Customer API contract freeze (Part K) | `docs/API_CONTRACTS.md` — every row re-verified against the actual mounted route this phase |
| Error/response consistency audit (Part L) | AUDITED, no genuine inconsistency found — every domain already follows the shared `AppError`/`errorCodes.ts` convention |
| Database integrity (Part M) | `prisma validate` clean; new `audit_logs` table's FKs/indexes reviewed |
| Regression tests added | 11 (`auditLog.test.ts`) + 2 (`returns.test.ts` Part D) + assertion-only additions to existing Payments/Returns refund tests (no new test count) |
| Full suite re-run three times after this phase | See `docs/CURRENT_TASK.md` for the exact final count |

### Admin API Matrix (Part J — built directly from every `*.routes.ts` file, not summarized)

| Domain | Endpoint | Method | Permission | Frontend-consumable as-is |
|---|---|---|---|---|
| Catalog | `/categories`, `/categories/:id` | POST/PATCH/DELETE | `categories:create`/`update`/`delete` | Y |
| Catalog | `/products`, `/products/:id`, `/products/:id/categories`, `/products/:id/markets/:marketCode` | POST/PATCH/DELETE/PUT | `products:create`/`update`/`delete` | Y |
| Catalog | `/products/:productId/{variants,options,options/:id/values,media}` (+ `:id` variants) | POST/PATCH/DELETE | `products:update` | Y |
| Pricing | `/products/:productId/variants/:variantId/prices/:marketCode` | PUT/DELETE | `pricing:update` | Y |
| Inventory | `/products/:productId/variants/:variantId/stock` (+ `/receive`,`/adjust`,`/reserve`,`/release`) | POST | `inventory:update` | Y |
| Orders | `/admin/orders`, `/admin/orders/:id` | GET | `orders:read` | Y |
| Orders | `/admin/orders` | POST | `orders:create` | Y |
| Orders | `/admin/orders/:id/status` | PATCH | `orders:update` or `orders:cancel` | Y |
| Payments | `/payments/:id/refund` | POST | `payments:refund` | Y |
| Payments | `/admin/payments`, `/admin/payments/:id/{mark-paid,mark-failed,mark-refunded}` | GET/PATCH | `payments:read`/`payments:update`/`payments:refund` | Y |
| Shipping | `/admin/shipping/methods`, `/admin/shipping/methods/:id` | GET/POST/PATCH/DELETE | `shipping:read`/`shipping:update` | Y |
| Shipping | `/admin/shipments`, `/admin/shipments/:id` | GET/PATCH | `shipping:read`/`shipping:update` | Y |
| Returns | `/admin/returns`, `/admin/returns/:id/{approve,reject,receive,refund}` | GET/PATCH | `returns:read`/`returns:update` | Y |
| Audit | `/admin/audit-logs` | GET | `audit:read` (super_admin only) | Y |

## Admin Orders Overhaul (Phase 6S)

Took the Admin Orders section from a thin, mostly read-only list/detail view to a working operational tool. Cleaned up test data, added inline status management, widened the detail page, and added a staff-facing path to enter orders received outside the website.

| Item | Status |
|---|---|
| Dummy-order cleanup | COMPLETE — the backend had **zero** mock/seed order data (`seed.ts`/`seed-admin.ts` both deliberately create none); the 32 "dummy" rows on the list page were real test rows from prior manual integration testing. Verified via a direct DB read (33 orders, 32 clearly test emails/names, 1 placed by `admin@vizaura.local`/Super Admin), confirmed with the user, then deleted interactively (FK-safe child-row-first deletion + inventory-reservation release) — not a committed script. 1 order remains (`ORD-2026-000033`). |
| `OrderSource` (`ONLINE`/`OFFLINE`) + `ShippingMethod.isPublic` | COMPLETE — migration `add_order_source_and_manual_shipping`, purely additive (`DEFAULT 'ONLINE'`/`DEFAULT true`), zero existing-row impact. A non-public "Manual" `ShippingMethod` is now seeded per market (`isPublic: false`) so an offline order's required `Shipment.shippingMethodId` FK has something to attach to without ever appearing in the customer-facing shipping-methods list (`listActiveByMarket`/`findActiveByIdAndMarket` both now also filter `isPublic: true` — closes a real gap where a customer could otherwise have submitted the Manual method's id directly at checkout). |
| `POST /admin/orders` (new `orders:create` permission) | COMPLETE — staff-entered offline orders (phone/WhatsApp/walk-in) for an existing customer. Lines must reference real catalog products/variants (re-validated against live catalog/price/market-availability/inventory, same rules `CheckoutService#buildAndValidateLines`/`reserveAll` already apply — duplicated once as a peer-domain-repository caller, same established pattern Checkout itself uses, not a new violation of "no duplicate logic"). Payment uses a new `"MANUAL"` provider tag; `payments.service.ts#requireCodPayment` now accepts `MANUAL` alongside `COD` so staff can still mark-paid/failed/refunded afterward. |
| Order-confirmation email | COMPLETE — new `EmailProvider.sendOrderConfirmationEmail` (implemented in `ConsoleEmailProvider` only, matching every other email flow in this codebase), one shared `orders/orderConfirmation.helper.ts#sendOrderConfirmation` call site used by both `checkout.service.ts` (skipped on an idempotent replay) and the new admin create-order path. Never blocks/rolls back order creation — logs and swallows any failure, including a missing/invalid address. |
| Inline list-page status management | COMPLETE — `OrderInlineStatusSelect`/`ShipmentInlineStatusSelect`/`PaymentInlineStatusSelect` (new), reusing the exact same endpoints and display-only transition tables the detail page's button actions already use (no new backend surface for Order/Shipment; Payment reuses the existing mark-paid/mark-failed/mark-refunded trio). Applies immediately; `CANCELLED` gets a compact inline confirm instead of a modal. The admin list query (`listAdmin`) now also joins each row's representative Payment (id/provider/status) and Shipment id — the one deliberate response-shape change to an existing, working endpoint. |
| Full-width order detail page | COMPLETE — removed the page's only width constraint (`max-w-4xl` → `w-full`); `AdminShell`'s `<main>` has none of its own, so no other file needed to change. |
| Backend + frontend pagination | VERIFIED, already correct — `listAdmin` was already paginated (20/page default, sorted `createdAt desc`) with full `{data, pagination}` metadata, and the list page already used the shared `AdminPagination` component; no changes needed beyond confirming it end-to-end. |
| 500ms debounced search | COMPLETE — new `useDebouncedValue` hook; `AdminSearchInput` gained an **opt-in** `debounceMs` prop (unset = byte-for-byte original submit-based behavior) so Products/Users/Customers/Inventory, which all reuse this same component, are untouched. Only the Orders page passes `debounceMs={500}`. |
| Verification | Backend: `tsc --noEmit`/lint clean; full suite re-run, 602/603 passing (the 1 failure, `requireCaptcha.test.ts`'s argument-shape assertion, is the same pre-existing/unrelated failure already noted in the Reviews phase entry above — neither that file nor its code paths were touched here). Frontend: `tsc --noEmit`/lint/`next build` (production, Turbopack) all clean — `/admin/orders/new` resolves correctly as its own route alongside `/admin/orders/[id]`. Migration applied to both dev and test databases; dev DB re-seeded (confirmed `super_admin` gained `orders:create`, `customer` still has none, 4 shipping methods seeded — 2 public + 2 non-public "Manual"). No interactive browser verification performed (no browser tool available in this environment).

Every row is "frontend-consumable as-is" — no admin endpoint this phase found returns a shape that would need backend rework before a UI could bind to it directly. **Deliberately not built**: role/permission-management endpoints (assign/revoke a role, list roles/permissions) — `RbacService.canRemoveSuperAdmin` exists as a guard for exactly this future endpoint (see `docs/RBAC.md`'s "System-Role Protection"), but no route calls it yet. This is the one concrete admin-API gap this phase found, unchanged from every prior phase's own observation — not a Phase 4P regression, and out of this phase's scope to build (would be a new domain).

## Cart Page Visual Redesign

Rebuilt the Cart page to match a provided design spec/reference image (hero banner, two-column Shopping Cart + Order Summary, "You Might Also Like"), entirely on top of the existing Cart/Pricing/Inventory/Shipping/Checkout/Wishlist backend — no new auth/pricing/DB architecture, no coupon system, no PayPal.

| Item | Status |
|---|---|
| Decision (confirmed with user before implementing): coupon/discount-code UI | OMITTED entirely — audit found no coupon/promo-code backend exists (`checkout.service.ts` explicitly throws `couponUnsupported()`); building one was out of scope for a visual redesign task |
| Decision (confirmed with user): cart line original-price/discount-% | Backend extended (not frontend-faked) — `resolveEffectivePrice()` already resolved both internally, just wasn't exposed on `CartItemView` |
| `cart.repository.ts` | Added a `media` (primary image) include under each line's `product`, same ordering convention `products.repository.ts` already uses (`isPrimary desc, position asc`, `take: 1`) |
| `cart.mapper.ts` / `cart.service.ts` | `CartItemView` gained `productId`/`productSlug`/`productName`/`variantTitle`/`imageUrl`/`originalAmount`/`discountPercent` — all derived from data already joined/resolved per line, no new query, no new pricing formula (discount % uses the same rounding `toNormalizedCard()` already applies) |
| `frontend/src/lib/types/cart.ts` | Mirrored verbatim, per the file's own convention |
| `components/cart/CartHero.tsx` + `cartHeroContent.ts` (new) | Full-bleed banner, same static-content-function precedent as `catalog/ShopHero.tsx`/`shopHeroContent.ts` — no CMS/Banner model backs this yet |
| `components/cart/CartView.tsx` (rebuilt) | Two-column layout: Shopping Cart card (thumbnail/name/variant/stock pill/price+compare-at+Save% badge/quantity/line total/remove) + Order Summary card (subtotal, shipping computed the same way `CheckoutView.tsx` already does via `getShippingMethods()`+real `freeShippingThreshold`, total, free-shipping notice, "Proceed to Checkout" → `/checkout` with no payload since Checkout independently reads the same shared `useCartWishlist()` cart, static trust-indicator row). No new state system — same context/hooks as before |
| `components/cart/CartRecommendations.tsx` (new) | No per-cart recommendation endpoint exists in Catalog (confirmed via audit) — reuses the same `getProductCards()` call `RelatedProducts.tsx` makes (without a single-category filter, since a cart spans many), excludes products already in the cart, renders through the existing `ProductCard` grid unchanged (wishlist/rating/Add to Cart all come for free) |
| Verification | Backend: `tsc`/lint clean; `tests/integration/cart.test.ts` re-run, 36/36 passing (no test asserted the old full item shape, so the new fields required no test changes). Frontend: `tsc`/lint clean. Confirmed both dev servers serve the rebuilt page with no server/console error (SSR'd hero text and empty-cart state fetched via `curl`). No browser tool available in this environment — full interactive/visual QA (populated-cart row layout against the reference image, responsive stacking, both markets' real shipping thresholds) not performed; see `docs/CURRENT_TASK.md`.
