# CATALOG Module

**Purpose:** Own product and category data shown in the storefront and managed in the admin.

**Responsibilities:** Products, variants, variant options, categories, media, and per-market availability/visibility flags.

**Data ownership:** `products`, `categories`, `product_categories`, `product_options`, `product_option_values`, `product_variants`, `variant_option_values`, `product_media`.

**Main entities (implemented):** `Product`, `Category`, `ProductCategory`, `ProductOption`, `ProductOptionValue`, `ProductVariant`, `VariantOptionValue`, `ProductMedia`.

**Persistence notes:**
- **Variants are the unit of sale.** SKU, pricing and (later) inventory attach to `ProductVariant`, never to `Product`. Simple products carry exactly one variant flagged `isDefault`.
- Variant structure is fully relational: `ProductOption` ("Size") → `ProductOptionValue` ("50g") → `VariantOptionValue`. No JSON, and no option type is hardcoded. A DB unique constraint prevents a variant holding two values of the same option.
- Categories nest via self-referencing `parentId` (adjacency list), with `onDelete: Restrict` so subtrees are never orphaned. `position` orders siblings.
- `ProductMedia` stores a URL/path reference — the URL itself is a plain string, agnostic to where it points. Supports `type`, `altText`, `position`, `isPrimary`, and an optional `variantId` for variant-specific imagery. Phase 6M added a real upload path (`POST /products/:productId/media/upload`, multipart, `multer` + local disk under `backend/uploads/products/`, served via `express.static`) alongside the original URL-entry endpoint — both remain supported. **Local disk is dev/small-deployment appropriate only**: it doesn't survive a redeploy or scale across instances, so a real production deployment needs to swap in object storage (S3-compatible) behind the same `ProductMedia.url` contract — no code assumes local disk beyond the upload/delete handlers themselves.
- `Product` deliberately holds **no** price, stock, rating or market flag — those belong to Pricing, Inventory, Reviews and Markets.
- Unique slugs on products and categories; unique SKU on variants. Soft deletion via `deletedAt` on products and variants.

**Service-layer invariants:** every product has ≥1 variant with exactly one default (enforced on creation, update and deletion — deleting the last variant is rejected, deleting the default variant promotes another); at most one primary media row per product; an option value assigned to a variant must belong to an option of that same product, and a variant can hold at most one value per option axis.

**API boundary:** `/api/v1/products/*`, `/api/v1/categories/*`. Variants, options, option values and media are nested under `/api/v1/products/:productId/*` (no separate top-level prefix). Market availability is set via `PUT /api/v1/products/:id/markets/:marketCode`.

**Dependencies:** Pricing (price per variant per market), Markets (availability/visibility — Catalog reads the `markets` table by `code` to resolve a `ProductMarket` row; it never writes to `Market` itself), Inventory (stock per variant, later).

**Security considerations:** Write operations are permission-gated on `products:*` / `categories:*` (existing seeded permissions — variants, options and media are treated as sub-resources of `Product` and gated by `products:update`, since no dedicated permission keys exist for them). Public read endpoints (unauthenticated) return only `ACTIVE` products / active categories, and for products additionally only rows with a matching `ProductMarket.isVisible=true` when a `market` code is requested. A caller holding `products:read` / `categories:read` may see draft/archived products and inactive categories via the same endpoints.

## Resolved rules (Phase 4E-2 hardening)

These were audited explicitly and are the intended, documented behavior — not incidental:

- **Public vs. authenticated visibility.** Every read endpoint (`GET /categories`,
  `/categories/:id`, `/products`, `/products/:id`, `/products/slug/:slug`,
  `/products/:productId/variants`) resolves visibility the same way: an unauthenticated or
  unprivileged caller sees only `ACTIVE` products / active categories; a caller holding
  `products:read` / `categories:read` sees everything on the identical endpoint (no separate
  admin routes). No admin-only field (e.g. `deletedAt`) is ever present in a mapped response.
- **Market filtering.** `isVisible` gates public read visibility; `isAvailable` is
  intentionally *not* filtered on reads — a browsable-but-currently-unavailable product still
  lists (matches the schema's own doc comment: `isVisible` = appears in listings, `isAvailable`
  = may be sold). A product with no `ProductMarket` row for the requested market, or one with
  `isVisible=false`, never appears in that market's results. Requesting an unknown or
  deactivated (`Market.isActive=false`) market code is rejected (`CATALOG_NOT_FOUND`) on both
  the read path (`GET /products?market=`) and the write path (`PUT /products/:id/markets/:code`)
  — a deactivated market behaves identically to a nonexistent one, so it isn't distinguishable/
  enumerable from the outside.
- **Soft delete.** Every product read and every mutation guard filters `deletedAt: null`; a
  soft-deleted product 404s everywhere (direct fetch, slug lookup, category/market listing,
  and all nested variant/option/media writes). A soft-deleted product's `slug` is not
  reusable by a new product — the database's unique index has no soft-delete exception, so a
  slug is retired along with its product.
- **Slug lifecycle.** A slug is set once (explicitly, or derived from `name` at creation) and
  never changes automatically on a later `name` update — stable identifiers for stored
  links/bookmarks. Uniqueness is checked excluding the record's own current slug on update, in
  both `categories` and `products`.
- **SKU uniqueness scope.** Global across all variants of all products (matches the schema's
  plain `@unique` on `ProductVariant.sku`), case-sensitive, never per-product.
- **Default-variant invariant.** Exactly one `isDefault=true` variant per product, always.
  Enforced entirely in application logic (no partial-unique-index equivalent exists in Prisma)
  — every mutation that can change it (`createVariant`, `updateVariant`, variant removal +
  promotion) takes a `SELECT ... FOR UPDATE` row lock on the parent `Product` row inside the
  same transaction, serializing concurrent changes so two concurrent requests can never both
  leave their target variant `isDefault=true`.
- **Media primary invariant.** Same pattern as the default-variant invariant: `createMedia`/
  `updateMedia` lock the parent product row before flipping `isPrimary`, closing the same class
  of concurrent-request race.
- **Variant option-value-combination uniqueness.** Two variants of the same product may never
  share the exact same set of option values (e.g. two "Size=M, Color=Black" variants) — checked
  inside the same product-row-locked transaction as the invariants above, on both create and
  update. A variant with no option values assigned never collides with anything.

**Current status:**
- **DATABASE FOUNDATION COMPLETE** (Phase 4C)
- **BUSINESS LOGIC COMPLETE** (Phase 4E-1) — categories, products, variants, options, option values, media and per-market availability are all implemented with full CRUD, RBAC and integration test coverage.
- **HARDENED** (Phase 4E-2) — audited for visibility, concurrency and market-integrity gaps; see "Resolved rules" above and `docs/CURRENT_TASK.md` for what was found and fixed. See `docs/API_CONTRACTS.md` for the endpoint list.

## Categories admin (Phase 6G)

`/admin/categories` (list), `/admin/categories/new`, `/admin/categories/[id]` — gated by `categories:read` / `categories:create` / `categories:update` / `categories:delete` (all held by `super_admin`; permission checked before any fetch). Backend additions were small and additive: `GET /categories?include=admin` (all-status `productCount` + `childCount`, `categories:read` required), `description`/`imageUrl` nullable on update, and rejection of an empty derived slug. Categories are **global** — not market-specific (`docs/RBAC.md`, PRD has no per-market category); which products show in which market stays in `ProductMarket`.

- **Delete vs archive:** `isActive:false` (Deactivate/Activate in the UI) is the archive path — hidden from the storefront, every product link kept, reversible (PRD §53/§59). Hard delete stays guarded in `CategoriesService.remove` (409 `CATALOG_CATEGORY_IN_USE` if any subcategory or any `ProductCategory` link, incl. draft/archived/soft-deleted products); the UI offers Delete only when both counts are 0. The `ProductCategory` FK cascade is therefore unreachable via the API — products are never silently detached.
- **Product relationships** are id-based: renaming a category or changing its slug never affects product links, `GET /products?category=<id>`, or the product detail's `categories` list. `PUT /products/:id/categories` is unchanged.
- **Known limitations / PRD gaps (not built):** no `seoTitle`/`seoDescription`, no `status` enum (`isActive` boolean instead), `position` instead of the PRD's `sortOrder`; no `GET /categories/:slug`; `GET /products?category=` takes a UUID only and does not include descendants; `PUT /products/:id/categories` does not check `isActive`; names are not unique (only slugs are); no search/tree endpoint (the admin list is flat, ordered by `position`); the category detail page reads counts from the first 100 categories (larger catalogs would hide Delete, never bypass the backend guard).
- **Category image upload:** `POST /categories/upload-image` (multipart, `multer` + local disk under `backend/uploads/categories/`, served via `express.static`) stores the file and returns its URL; the admin form then persists that URL onto the category via the normal `PATCH`/`POST` — the same two-step upload-then-save shape `ProductMedia` uses. Plain URL entry remains supported alongside upload. Same local-disk caveat as `ProductMedia` (dev/small-deployment only, see above).
- **Seeding is never allowed to clobber an admin-edited category:** `seedDemoCategories()` (`backend/prisma/seed.ts`) only *creates* the 6 demo-slugged categories if they don't already exist — re-running `npm run db:seed` never resets an existing category's `name`/`description`/`imageUrl`/`position` back to its seed values. (An earlier upsert-with-update version of this did, and was the cause of admin-uploaded category images appearing to "revert.")
- **Homepage cache:** the storefront reads categories with a 60s `revalidate` window (`frontend/src/lib/api/catalog.ts`). The admin category form calls a `revalidateCategoriesPages()` server action (`frontend/src/lib/actions/revalidateCategories.ts`) right after a successful create/update so a new image/name shows immediately instead of waiting out that window.

**Future notes:** Pricing (variant prices per market) and Inventory (stock per variant) remain separate, not-yet-implemented domains; Catalog's variant model already carries the FK targets they will attach to.
