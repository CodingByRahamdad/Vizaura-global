# REVIEWS Module

**Purpose:** Own customer product reviews and ratings.

**Responsibilities:** Review submission (CAPTCHA-protected), ownership-based edit/delete, verified-purchase detection, admin moderation (publish/unpublish, feature, edit, delete, manual create), rating aggregation display on Catalog.

**Data ownership:** Review table.

**Main entities:** Review (`source: CUSTOMER | ADMIN | SEED`, `isVerifiedPurchase`).

**API boundary:** `/api/v1/reviews/*` (featured list, own-review PATCH/DELETE) plus `/api/v1/products/:productId/reviews*` (nested, own router mounted on the Catalog products prefix, same pattern as Pricing/Inventory — see `backend/src/modules/reviews/productReviews.routes.ts`) plus `/api/v1/admin/reviews/*` (own admin sub-router, same split pattern as Returns — see `backend/src/modules/reviews/admin.reviews.routes.ts`).

**Dependencies:** Catalog (product being reviewed), Users (author), Orders (verified-purchase check — built).

**Security considerations:** Review submission is CAPTCHA-protected (`requireCaptcha({ action: "review_submit" })`) and rate-limited (`reviewSubmitLimiter`, keyed by authenticated user); a customer may only edit/delete their own review (ownership resolved via `req.auth.userId`, never a client-supplied id; a mismatch 404s, never 403s — same "don't leak existence" posture as Returns); admin create/update/delete/list are permission-gated (`reviews:read`/`reviews:moderate`/`reviews:delete`).

**Current status:** COMPLETE (Phase 6N) — submission, ownership edit/delete, verified purchase, admin moderation, and demo seed coverage for every product.

Built:
- `Review` model gained `source: ReviewSource` (`CUSTOMER | ADMIN | SEED`, default `CUSTOMER`) and `isVerifiedPurchase: Boolean` (default `false`), plus a DB-level `CHECK (NOT "isVerifiedPurchase" OR "source" = 'CUSTOMER')` as defense in depth. `userId` is now **nullable** (`onDelete: SetNull`, was `NOT NULL`/`Cascade`) — an ADMIN-sourced review (a quoted testimonial, no backing account) isn't required to reference a real `User`. Postgres treats multiple `NULL`s in the `(productId, userId)` unique index as non-colliding, so this never weakens the "one genuine `CUSTOMER` review per product per user" guarantee.
- **Why `isVerifiedPurchase` is persisted, not live-computed** (unlike `averageRating`/`reviewCount`, which stay live-aggregated — that convention is unchanged): it's a historical fact about one event ("had this person completed a purchase of this product at submission time"), not a mutable aggregate. It's stamped once in `ReviewsService.submit()` and frozen — the same treatment `authorName`/`authorLocation`/`avatarUrl` already get (snapshotted at write time). A later return/cancellation never retroactively flips it.
- Verified-purchase query (`ReviewsRepository.hasCompletedOrderForProduct`): an `OrderItem` for the product exists on an `Order` owned by the user with `status IN (COMPLETED, RETURNED, REFUNDED)` — the exact eligible-status set Returns already established.
- Customer submission: `POST /products/:productId/reviews` (`reviewSubmitLimiter` → `authenticate` → `requireVerifiedEmail` → transport validation → `requireCaptcha` → service). Upserts on `(productId, userId)` — a resubmission edits the existing row rather than erroring. Always `source: CUSTOMER`.
- Customer edit/delete: `PATCH`/`DELETE /reviews/:id`, ownership-checked, no permission gate (mirrors Wishlist). `isVerifiedPurchase` is never recomputed on edit.
- Admin surface (`reviews:read`/`reviews:moderate`/`reviews:delete`): `GET /admin/reviews` (filter by product/status/source/featured, paginated), `GET /admin/reviews/:id`, `POST /admin/reviews` (always `source: ADMIN`, `isVerifiedPurchase: false` — hard-coded server-side regardless of request body), `PATCH /admin/reviews/:id`, `DELETE /admin/reviews/:id`.
- `source`/`userId`/`isPublished`/`isFeatured`/`updatedAt` are admin-only fields (`toAdminReviewResponse`) — never present on the public shape (`toPublicReviewResponse`, which does include `isVerifiedPurchase` — safe/intended for the "Verified Purchase" badge).
- Seed data: every one of the 13 demo products now has 2-4 realistic, category-specific reviews (previously 4/13 had any). Every seeded row is explicitly `source: SEED`, `isVerifiedPurchase: false` — demo content is never represented as a real verified customer.
- Frontend: a real "Write a review"/"Edit your review" form on the Product Detail page (replacing the previously dead `#reviews` anchor), a "Verified Purchase" badge on public reviews, a full Admin Dashboard "Reviews" section (list/detail/create, modeled on Categories' list/detail/create pattern), and a testimonials section on the About page (reusing the Homepage's `Testimonials` component and its `getFeaturedReviews` call — no duplicated review data).
- `backend/tests/integration/reviews.test.ts` (new) covers submission/upsert, ownership edit/delete isolation, the verified-purchase status matrix, admin permission boundaries, admin-created reviews always being `source: ADMIN`/unverified, moderation-driven rating recalculation, and product isolation.

**Future notes:** No further planned increment at this time.
