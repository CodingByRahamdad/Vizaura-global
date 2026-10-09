# WISHLIST Module

**Purpose:** Let customers save products for later.

**Responsibilities:** Add/remove wishlist items, list a customer's wishlist.

**Data ownership:** `Wishlist`, `WishlistItem` tables.

**Main entities:** `Wishlist` (one per user, `@@unique([userId])`), `WishlistItem` (`@@unique([wishlistId, productId])`).

**API boundary:** `/api/v1/wishlist/*`

**Dependencies:** Catalog (`Product` only — read-only, direct repository read, same "own repository reads another domain's tables directly" precedent Cart/Pricing/Inventory each established; no cross-module service call), Users (owner).

**Design decisions (PRD-grounded, verified against `docs/SHILAJIT _PRD.md` §18, §46, §2B.22, §2C.17 before implementation):**
- **Product-level, not variant-level.** Every PRD schema sketch uses `WishlistItem.productId`; the PRD's own relationship diagram draws `WishlistItem ──► Product`, explicitly contrasted with `CartItem ──► Variant` in the same diagram.
- **Market-independent.** No Wishlist mention in the PRD references a market. No `?market=` query param on any route (unlike every Cart route). Price is never stored here — a saved item's price, when the frontend displays one, is fetched separately through the existing market-aware Pricing read path.
- **One wishlist per user** (`Wishlist.userId` is `UNIQUE`), **unique items** (`@@unique([wishlistId, productId])`, the PRD's own rule). A duplicate add is idempotent (returns the current state, HTTP 200, not an error) — mirrors Cart's own "adding an already-present variant doesn't error" precedent; there's no quantity to increment here, so the race guard is a plain re-fetch-on-collision rather than Cart's raw-SQL atomic increment.
- **Inactive/deleted product behavior** (PRD silent on this specifically): mirrors Cart's "keep it, flag it" rule exactly — a `WishlistItem` is never auto-removed when its product goes DRAFT/inactive/soft-deleted. `GET /wishlist` re-derives `isAvailable` live on every read from the product's current `status`/`deletedAt`.
- **Add-time validation**: a product must exist, not be soft-deleted, and be `ACTIVE` to be added (422 `WISHLIST_PRODUCT_UNAVAILABLE` otherwise, 404 `CATALOG_NOT_FOUND` if it doesn't exist at all — reuses Catalog's own not-found code, same reuse Cart already established for its "Variant not found" case).

## API (verified against source, `backend/src/modules/wishlist/*`)

| Method | Path | Auth | Body | Success | Notes |
|---|---|---|---|---|---|
| GET | `/wishlist` | `authenticate` | — | 200 `WishlistView` | Get-or-create the caller's wishlist. |
| POST | `/wishlist/items` | `authenticate` | `{ productId }` | 200 `WishlistView` | Idempotent on a duplicate add. |
| DELETE | `/wishlist/items/:productId` | `authenticate` | — | 204 | Keyed by `productId` (not a wishlist-item id) — matches PRD §2C.17 exactly. 404 `WISHLIST_ITEM_NOT_FOUND` if not present. |

`WishlistView`: `{ id, items: WishlistItemView[], itemCount, createdAt, updatedAt }`.
`WishlistItemView`: `{ productId, slug, name, imageUrl, isAvailable, defaultVariantId, hasMultipleVariants, createdAt }`. `defaultVariantId`/`hasMultipleVariants` exist so the frontend's "Move to Cart" action can add directly for a single-variant product and otherwise send the customer to the product page to choose one — Wishlist itself never guesses a variant.

**Security considerations:** Ownership-only via `req.auth.userId` (never a client-supplied id) — every query is scoped by it, and item removal is additionally scoped by `(wishlistId, productId)` together, so a guessed `productId` belonging to another user's saved item simply matches zero rows (404), never another user's data. No permissions/RBAC beyond `authenticate` — same posture as Cart (see `docs/RBAC.md`). No admin endpoints exist or are planned for this phase.

**Current status:** COMPLETE (backend + frontend, Phase 5B-2C).

**Future notes:** No admin Wishlist management exists. A real Checkout phase is unaffected by this module (Wishlist never touches Cart's tables directly — "Move to Cart" on the frontend calls Cart's existing `addItem`, not a new mutation path).
