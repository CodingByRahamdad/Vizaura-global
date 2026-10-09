# PRICING Module

**Purpose:** Own independently configured commercial pricing per market.

**Responsibilities:** Regular and sale price per variant per market, sale windows, active/inactive price state, effective-price resolution.

**Data ownership:** `variant_prices`, keyed by variant + market.

**Main entities:** `VariantPrice` (`variantId`, `marketId`, `currencyCode`, `amount`, `saleAmount?`, `saleStartsAt?`, `saleEndsAt?`, `isActive`).

**Persistence notes:**
- **Money is `Int` in the currency's minor unit.** PKR 4,999 → `499900` paisa; AED 149 → `14900` fils. Never floating point.
- `@@unique([variantId, marketId])` — one current price row per variant per market (model **A**: exactly one current row, no history table — confirmed against the schema when this module was built).
- **Prices are never FX-derived.** Pakistan and UAE amounts are independent commercial decisions; no conversion logic exists anywhere in the schema or code.
- A sale applies when `saleAmount` is set and `now()` falls inside the optional window (an unset bound is open-ended) — computed by `PricingService.resolveEffectivePrice`.
- Prices attach to the variant, never the product — consistent with Catalog.
- Regular-price history/versioning is deferred; orders will snapshot the price at purchase time, which is what history is needed for.
- `DELETE` deactivates (`isActive: false`) rather than hard-deleting — cheap history-lite, and re-enabling a market's price is just another `PUT`.
- The upsert is **not** `prisma.variantPrice.upsert(...)`. Under this project's Prisma 7 + `@prisma/adapter-pg` transport, `upsert` is emulated client-side (try create, fall back to update) rather than a single atomic `INSERT ... ON CONFLICT`, so two genuinely concurrent `PUT`s could each attempt "create" and one would surface a raw conflict instead of succeeding — reproduced against the real test database and fixed in Phase 4G (discovered incidentally via that phase's full-suite regression run). `PricingRepository.upsertPrice` now explicitly tries create and falls back to update on a unique-constraint collision.

**Service-layer invariants:** `currencyCode` must equal the market's `currencyCode` (`PRICING_CURRENCY_MISMATCH` if not); `saleAmount`, when set, must be below `amount` (`PRICING_INVALID_SALE_AMOUNT`); the target market must exist and be active (an inactive market behaves as "not found", identical to Catalog's rule — `CATALOG_NOT_FOUND`); the target variant must exist (also `CATALOG_NOT_FOUND` — Pricing reuses Catalog's own not-found code for this since it's the identical failure Catalog would produce for the same lookup, not a new business rule).

**API boundary:** `/api/v1/products/:productId/variants/:variantId/prices[/:marketCode]`. **Deviates from an earlier draft of this document, which described admin writes under `/api/v1/admin/*`** — no `/admin` router exists anywhere in this codebase; Catalog's own admin writes (variant/option/media/market CRUD) live on the same nested `/products/:productId/...` routes, permission-gated, not a separate prefix. Pricing follows that established precedent instead (`DEVELOPMENT_RULES.md` #6, "follow existing architecture"). Routes are their own router/file (`pricing.routes.ts`, mounted at the same `/products` base path as `productsRouter`) rather than appended into `catalog/products.routes.ts`, so no Catalog file needed editing.

| Method | Path | Auth | Notes |
|---|---|---|---|
| PUT | `/products/:productId/variants/:variantId/prices/:marketCode` | `pricing:update` | Upsert — same pattern as `PUT /products/:id/markets/:marketCode`. |
| DELETE | `/products/:productId/variants/:variantId/prices/:marketCode` | `pricing:update` | Deactivates (`isActive:false`); idempotent. |
| GET | `/products/:productId/variants/:variantId/prices` | – (`pricing:read` widens) | Public: active prices only, effective-price shape. Admin: every row, full fields. |
| GET | `/products/:productId/variants/:variantId/prices/:marketCode` | – (`pricing:read` widens) | Same public/admin split, one market. |

Product/variant visibility mirrors Catalog's own rule exactly (`products:read` widens which product statuses are visible) — a non-`ACTIVE` product's variant prices 404 for an unprivileged caller, same as `GET /products/:productId/variants`.

**Public response shape** (`toPublicPriceResponse`): `{ marketCode, currencyCode, amount (effective, sale already applied), isOnSale, saleEndsAt }` — no `id`, no `isActive`, no raw `saleAmount`/`saleStartsAt`/administrative timestamps.

**Admin response shape** (`toAdminPriceResponse`, requires `pricing:read`): the full row, market-code-resolved.

**Dependencies:** Markets (currency/market scope — Pricing reads the `markets` table directly, the same pattern Catalog's own repository uses, not a Markets service indirection since none exists yet), Catalog (variant/product identity and lifecycle — read-only imports of `VariantsRepository.findVariantByProductAndId` and `ProductsRepository.findById`; no Catalog file was modified), Orders (will snapshot price at purchase time, later — not built this phase).

**Price resolution / future integration boundary:** `PricingService.resolveEffectivePrice(price, now?)` is the single reusable "what does this variant cost in this market right now" computation. A future Checkout/Order service should call `PricingService.getPrice`/`listPrices` (or a thin wrapper) and snapshot the returned `effectiveAmount`/`currencyCode` onto the order line at the moment of sale — Pricing itself does no snapshotting or order awareness in this phase.

**Security considerations:** Prices are never accepted from the client for cart or order calculations — always re-read server-side (not yet applicable — no cart/checkout exists). Administrative fields (`id`, `isActive`, raw `saleAmount` outside an active sale window, timestamps) never appear in the public response shape.

**Current status:**
- **DATABASE FOUNDATION COMPLETE** (Phase 4C)
- **BUSINESS LOGIC, API, RBAC, TESTS COMPLETE** (Phase 4F)

**Future notes:** Exchange rates may be stored separately for reporting only — never used to derive a selling price. Wiring an effective price into Catalog's own product/variant read model (`GET /products/*`) is a deliberate deferral, not an oversight — it would require editing Catalog files, which this phase's brief reserved for genuine dependency defects only.
