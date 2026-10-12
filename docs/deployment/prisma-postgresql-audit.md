# Prisma / PostgreSQL Deployment Audit

Generated: 2026-10-12
Scope: Read-only audit of the backend's existing Prisma ORM + PostgreSQL implementation, in preparation for deploying the database to **Neon PostgreSQL** and the backend to **Render**. No code, environment files, migrations, or the database itself were modified while producing this document. No secret values are reproduced anywhere below — only variable names and placeholders.

---

## 1. Executive Summary

The backend (`backend/`) is a feature-first Express/TypeScript app using **Prisma ORM 7.10.0** with the newer **driver-adapter architecture** (`@prisma/adapter-pg` over `pg`), not Prisma's bundled query-engine binary. This matters for deployment: there is no native engine binary to target a specific OS/libc combination for, so standard Node-on-Render concerns (binary compatibility, `binaryTargets`) don't apply here.

The schema is substantial (34 models, 20 enums) and its 30 migrations are internally consistent with the current `schema.prisma` — no evidence of drift was found. Only one migration performs a real data backfill (duplicating rows), and no migration contains `DROP TABLE`, `TRUNCATE`, or `DELETE`. The schema/migration history itself presents **no confirmed destructive risk**.

What's missing is deployment *tooling*, not schema safety: there is no Dockerfile, no `render.yaml`, no pinned Node version, no CI, and the current build script doesn't run `prisma generate`. There's also no existing guidance distinguishing Neon's pooled vs. direct connection string, and the backend has no connection-pool sizing or graceful-shutdown handling configured — both relevant once it's talking to a managed, connection-limited Postgres instance instead of local Postgres.

**Bottom line:** the data layer is safe to migrate as-is. The deployment *process* around it needs a handful of concrete additions before a production cutover — listed in Section 10.

---

## 2. Relevant Files and Responsibilities

| File / directory | Responsibility |
|---|---|
| `backend/prisma/schema.prisma` | Single source of truth for all models, enums, relations, indexes. Prisma 7 `prisma-client` generator (ESM output to `src/generated/prisma`, gitignored, rebuilt by `db:generate`). |
| `backend/prisma.config.ts` | Prisma CLI configuration (replaces the old `datasource.url`). Reads `DATABASE_URL` via Prisma's `env()` helper for all `prisma migrate`/`generate`/`studio` commands. |
| `backend/prisma/migrations/` | 30 timestamped migration folders, the authoritative schema history. |
| `backend/prisma/migration_lock.toml` | Locks the migration provider to `postgresql` — matches `schema.prisma`. |
| `backend/prisma/seed.ts` | Idempotent bootstrap data (markets, permissions, roles, shipping methods) run via `prisma db seed`; demo catalog/review data is gated out of production unless explicitly opted in. |
| `backend/prisma/seed-admin.ts` | Standalone, never auto-wired, creates/upserts one super_admin login; requires explicit opt-in and credentials via env vars in production. |
| `backend/src/db/prismaClient.ts` | The **only** place `PrismaClient`/`PrismaPg` are constructed. Lazily builds a singleton client wrapping a `pg`-based driver adapter around `DATABASE_URL`. |
| `backend/src/config/env.ts` | Zod-validated environment schema; sole `process.env` access point; enforces production requirements (real secrets, `DATABASE_URL` present, etc.). |
| `backend/src/middleware/errorHandler.ts` | Translates Prisma error code `P2002` (unique violation) to HTTP 409; all other errors fall through to a generic 500 without leaking internals. |
| `backend/src/errors/AppError.ts`, `errorCodes.ts` | Domain-level error types/codes used by services for expected business conflicts (e.g. optimistic-concurrency conflicts detected via guarded SQL, not via catching a DB error code). |
| `backend/src/modules/<domain>/*.repository.ts` (23 files across addresses, analytics, audit, auth, cart, catalog (×3), checkout, contact, inventory, markets, notifications, orders, payments, pricing, promotions, rbac, returns, reviews, shipping (×2), users, wishlist) | The only layer permitted to call Prisma, per the project's architecture rule. All transactions and raw SQL live here. |
| `docs/DATABASE.md` | Existing internal documentation of the DB stack and migration workflow (confirmed current, see gaps noted in Section 6). |

---

## 3. Database Connection, Query, Transaction, and Error Flow

**Connection:** On first use, `getPrismaClient()` ([backend/src/db/prismaClient.ts](../../backend/src/db/prismaClient.ts)) lazily constructs a `PrismaPg` adapter from `env.databaseUrl` and wraps it in a single `PrismaClient` instance, cached for the process lifetime. There is no explicit `$connect()` call anywhere — the adapter connects implicitly on first query. There is no connection-pool sizing passed to `PrismaPg` (only `connectionString`), so it runs on `pg`'s own pool defaults.

**Query execution:** Per the project's architecture rule, only repository files call Prisma. Services call repositories; repositories call `this.prisma.<model>.<method>()` or, where Prisma's query builder can't express the operation, raw SQL.

**Transactions:** 17 repository files use `$transaction`, almost all in the interactive-callback form (not just the sequential-array form), for multi-step invariants — e.g. `catalog/variants.repository.ts`, `checkout/checkout.repository.ts`, `inventory/inventory.repository.ts`, `orders/orders.repository.ts`, `payments/payments.repository.ts`, `returns/returns.repository.ts`, `auth/auth.repository.ts`, `catalog/products.repository.ts`, `users/users.repository.ts`.

**Raw SQL:** 10 `$queryRaw` and 6 `$executeRaw` call sites, all inside repositories, all using parameterized tagged templates (no `$queryRawUnsafe`/`$executeRawUnsafe` anywhere — no evidence of raw-SQL injection risk). Patterns observed:
- `SELECT ... FOR UPDATE` row locks (e.g. `catalog/variants.repository.ts`) to serialize per-product single-flag invariants.
- Guarded, atomic `UPDATE ... WHERE <optimistic-concurrency condition> RETURNING ...` statements (e.g. `checkout.repository.ts` converting a cart from ACTIVE to CONVERTED; `orders.repository.ts`, `payments.repository.ts`), used instead of a separate read-then-write to avoid races.
- One Postgres sequence read (`orders/orderNumber.ts`: `SELECT nextval('order_number_seq')`).
- `SAVEPOINT`/`ROLLBACK TO SAVEPOINT` inside a transaction in `inventory/inventory.repository.ts`, for sub-transaction rollback during stock reservation flows.

**Error handling:** `errorHandler.ts` explicitly checks for `Prisma.PrismaClientKnownRequestError` with code `P2002` and maps it to HTTP 409 with a generic "already exists" message. No other Prisma error code (P2003 foreign-key violation, P2025 not-found, P2034 transaction conflict, etc.) is explicitly handled — those fall through to a generic 500, logged server-side only. The codebase largely routes around this by using guarded SQL + explicit `AppError` throws (e.g. a 0-rows-affected guarded update becomes a specific domain error) rather than depending on catching Postgres error codes for business-rule conflicts.

**Shutdown:** `disconnectPrisma()` is defined but has exactly one reference in the codebase — its own definition. There is no `SIGTERM`/`SIGINT` handler anywhere in `backend/src`. On container stop (Render redeploy, scale-down, etc.), the process relies on OS-level socket teardown rather than an application-level graceful drain or explicit `$disconnect()`.

---

## 4. Model and Relationship Overview

**34 models, 20 enums**, all using `id String @id @default(uuid(7)) @db.Uuid` as primary key unless noted. Grouped by domain:

| Domain | Models |
|---|---|
| Identity/Auth | `User`, `Session`, `EmailVerificationToken`, `PasswordResetToken` |
| RBAC | `Role`, `Permission`, `UserRole` (composite PK), `RolePermission` (composite PK) |
| Markets | `Market` |
| Catalog | `Category` (self-referential tree), `Product`, `ProductCategory` (join), `ProductOption`, `ProductOptionValue`, `ProductVariant`, `VariantOptionValue` (join), `ProductMedia`, `ProductMarket` (join) |
| Pricing | `VariantPrice` |
| Inventory | `VariantStock`, `StockMovement`, `StockReservation` |
| Cart | `Cart`, `CartItem` |
| Wishlist | `Wishlist`, `WishlistItem` |
| Checkout/Orders | `Order`, `OrderItem`, `OrderAddress`, `Address`, `OrderStatusHistory` |
| Payments | `Payment`, `PaymentTransaction`, `PaymentWebhookEvent` |
| Shipping | `ShippingMethod`, `Shipment` |
| Returns | `Return`, `ReturnItem` |
| Audit | `AuditLog` |
| Notifications | `Notification`, `NotificationRead`, `CustomerNotification` |
| Contact | `ContactSubmission` |
| Promotions | `Promotion` |

**Enums** include `UserStatus`, `ProductStatus`, `VariantStatus`, `MediaType`, `ProductBadge`, `StockMovementType`, `StockReservationStatus`, `CartStatus`, `OrderStatus`, `OrderPaymentStatus`, `OrderSource`, `OrderAddressType`, `AddressType`, `PaymentTransactionType`, `ShipmentStatus`, `ReturnStatus`, `ReviewSource`, `NotificationType`, `CustomerNotificationType`, `PromotionTargetType`, `PromotionDisplayLayout`.

**Cardinality:** No implicit Prisma many-to-many syntax is used anywhere — every M:N relationship (roles↔permissions, products↔categories, variants↔option values, products↔markets) is modeled as an explicit join table with a composite primary key. Two true 1:1 relations exist: `Order ↔ Shipment` and `User ↔ Wishlist` (both enforced via a `@unique` foreign key).

**`onDelete` behavior inventory** (deliberate, not incidental):
- **Cascade** is the default for dependent/child rows: sessions, tokens, cart items, order items' *history* records, join tables, etc.
- **Restrict** is used specifically on financial/audit-adjacent foreign keys: `Order.user`, `Order.market`, `Payment.order`, `Shipment.order`, `Shipment.shippingMethod`, `ShippingMethod.market`, `Return.order`, `Return.requestedByUser`, `ReturnItem.orderItem`, and `Category.parent` — i.e., you cannot delete a user/market/category/order that still has orders/returns/subcategories pointing at it.
- **SetNull** is used for optional, snapshot-preserving links: `OrderItem.product`/`variant` (so historical orders survive product deletion), `ProductMedia.variant`, `Review.user`, `AuditLog.user`, `OrderStatusHistory.changedByUser`, `StockMovement.createdByUser`, `Return.reviewedByUser`, and `Promotion`'s four target foreign keys.

This pattern is itself a strong signal that historical/financial integrity was a deliberate design goal — relevant to call out before any production migration, since it means orders/payments/returns data is structurally protected against cascading deletes from upstream entities.

---

## 5. Migration Status and Risks

**30 migrations**, from `20260918000000_init_foundation` to `20261008162934_add_address_and_customer_notifications`. `migration_lock.toml` provider (`postgresql`) matches `schema.prisma`'s datasource provider — no provider drift.

**Drift check:** every model/field/enum present in the current `schema.prisma` traces to an identifiable migration in the history (spot-checked across all domains: User's flat address fields, Order's guest-checkout fields, Review's source/verified-purchase fields, Product's marketing fields, Promotion's grid2 fields, the Address/CustomerNotification models added last). No field or model was found without an apparent originating migration. This is an **informal check, not a cryptographic diff** — before the first real Neon deploy, run `npx prisma migrate diff` (or `migrate status`) against the actual target database to get a tool-verified confirmation, since this audit did not connect to any live database.

**Non-standard migrations** (Prisma can't express these in `schema.prisma` syntax, so they're hand-written raw SQL inside otherwise-generated migration files — they replay correctly under `migrate deploy`, they just won't show up if someone tries to re-derive the schema from a diff tool alone):
- `20260918191626_cart_quantity_check` — `CHECK (quantity > 0)` on `cart_items`.
- `20260919115413_payments_foundation` — partial unique index ensuring only one active (`AUTHORIZED`/`PAID`) payment per order.
- `20260919184332_returns_open_unique_index` — partial unique index ensuring only one open return per order.
- `20261004151453_add_review_source_check_constraint` — `CHECK` ensuring verified-purchase reviews only come from the `CUSTOMER` source.
- `20261005214235_add_guest_orders` — `CHECK` ensuring an order has exactly one of `userId`/`guestEmail` set.

**The one data-affecting migration:** `20261006175017_add_order_address_type`. This migration adds a `type` column to `order_addresses`, backfills all existing rows to `SHIPPING`, then **inserts a cloned `BILLING` row for every existing row** before enforcing a new `(orderId, type)` uniqueness constraint. This is the single migration in the entire history that reads and writes substantial existing data rather than being purely structural (no `DROP`/`TRUNCATE`/`DELETE` statements exist anywhere in the 30 migrations). It already ran successfully against current data; flagged here only so it's understood (not re-run, not reversed) when the schema history is replayed fresh against a new Neon database via `migrate deploy` — replaying it on an **empty** database is a no-op backfill (0 existing rows to clone), which is the expected, safe path for a fresh Neon database. The *risk* case is specifically if anyone tried to manually re-apply or hand-edit this migration against an already-migrated production dataset — not applicable to the "set up a new Neon DB and replay all migrations" scenario this audit is for.

**Recommended production command:** `npm run db:migrate:deploy` (→ `prisma migrate deploy`), which applies the existing migration history as-is. Never `prisma migrate dev` (creates/modifies migrations interactively) or `prisma db push` (schema-only, no migration history, not used anywhere in this project's scripts) in a production context.

---

## 6. Environment Variables for Deployment

All variables are defined and validated in [backend/src/config/env.ts](../../backend/src/config/env.ts); this is the sole `process.env` access point in the backend (confirmed — no other file reads `process.env` directly). Placeholder values only, no real secrets below.

| Variable | Required in production? | Placeholder / example | Notes |
|---|---|---|---|
| `NODE_ENV` | Yes (must be `production`) | `production` | |
| `PORT` | No (defaults 4000) | `4001` | Render injects its own port; don't hardcode. |
| `DATABASE_URL` | **Yes** | `postgresql://USER:PASSWORD@HOST/db?sslmode=require` | Point this at Neon. See pooled-vs-direct note below. |
| `DATABASE_URL_TEST` | No — test-only, never read in production | — | Not relevant to the Render deploy. |
| `FRONTEND_URL` | Yes (used for CORS + CSRF origin check, exact match) | `https://your-frontend-domain` | Single string, not a list — must be the exact production frontend origin. |
| `APP_URL` | Yes | `https://your-frontend-domain` | Used to build links in outbound email. |
| `JWT_ACCESS_SECRET` | **Yes**, ≥32 bytes, must not equal the dev fallback | `<random 32+ byte secret>` | App refuses to boot without this. |
| `JWT_ACCESS_SECRET_PREVIOUS` | No | — | Optional, for secret rotation without forcing re-login. |
| `JWT_ACCESS_EXPIRES_IN`, `JWT_ISSUER`, `JWT_AUDIENCE`, `REFRESH_TOKEN_EXPIRES_IN` | No (sane defaults) | defaults fine | |
| `CAPTCHA_PROVIDER` | Effectively yes (`noop` is refused in production) | `recaptcha` or `turnstile` | |
| `RECAPTCHA_SECRET_KEY` / `TURNSTILE_SECRET_KEY` | Required if matching provider chosen | `<secret>` | |
| `PAYMENTS_MOCK_WEBHOOK_SECRET` | Must not equal dev fallback in production | `<random secret>` | MOCK payment provider can't actually run in production regardless. |
| `EMAIL_PROVIDER` | No (defaults `console`) | `brevo` | Set to `brevo` for real production email. |
| `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` | Required together if `EMAIL_PROVIDER=brevo` | `<key>` / `<verified sender>` / `VIZAURA GLOBAL` | |
| `CONTACT_INFO_EMAIL`, `CONTACT_SALES_EMAIL` | No (defaults fine) | | |
| `COOKIE_SAMESITE` | No (default `lax`) | `lax` or `none` | `none` requires `COOKIE_DOMAIN` to be set (enforced). Use `lax` if frontend/backend end up on the same registrable root domain; `none` if they're on genuinely different domains (e.g. separate Vercel/Render domains). |
| `COOKIE_DOMAIN` | Conditionally required (see above) | `.yourdomain.com` | Leave unset for host-only cookies unless cross-site cookies are required. |
| `TRUST_PROXY_HOPS` | No (default 0) | `1` | Render sits behind one reverse proxy — set to `1`, never to a blanket "trust all" value. |
| `CSRF_HEADER_NAME`, `RATE_LIMIT_ENABLED` | No | defaults fine | |
| `SEED_ALLOW_DEMO_DATA`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `SEED_ALLOW_ADMIN_BOOTSTRAP` | No — only used when manually running seed scripts | — | Not part of normal app boot; see Section 9. |

**Neon pooled vs. direct connection string:** Neon provides two connection strings per database branch — a direct one and a PgBouncer-pooled one. Nothing in this codebase currently distinguishes the two (no pool-size configuration anywhere in `src/db/prismaClient.ts`, confirmed). **Recommendation** (not an existing pattern — a new decision to make): since Render runs this backend as a single long-lived process (not per-request serverless), connection exhaustion is less severe than in a serverless deployment, but it's still safest to use Neon's **pooled** connection string for `DATABASE_URL` and reserve the direct string for one-off CLI operations (`migrate deploy`, `studio`) where a direct connection is sometimes preferred for DDL. Confirm this against Neon's current documentation at deploy time, since the two strings are interchangeable for most Prisma operations but Neon's own pooler has limitations on certain session-level features.

---

## 7. Recommended Build, Generate, Migrate, and Start Commands

Based on the actual scripts in [backend/package.json](../../backend/package.json):

| Step | Command | Note |
|---|---|---|
| Install | `npm ci` | |
| **Generate Prisma client** | `npm run db:generate` (→ `prisma generate`) | **Not currently part of the `build` script** — the gitignored output at `backend/src/generated/prisma` will not exist on a fresh Render build unless this step runs explicitly first. Add it to the Render build command, e.g. `npm ci && npm run db:generate && npm run build`. |
| Build | `npm run build` (→ `tsc -p tsconfig.json`) | Compiles to `dist/`. |
| **Apply migrations** | `npm run db:migrate:deploy` (→ `prisma migrate deploy`) | Run as a release/pre-deploy step against Neon, not on every container boot (avoids concurrent migration attempts if Render ever scales to multiple instances). |
| Start | `npm start` (→ `node dist/server.js`) | |

**Node version:** not pinned anywhere in this repo (no `engines` field in `backend/package.json`, no `.nvmrc`, no Dockerfile). `@types/node: ^22.5.0` is the closest signal of the intended runtime. **Recommendation:** add `"engines": { "node": "22.x" }` to `backend/package.json` before deploying, so Render's Node-version auto-detection doesn't drift from local dev.

---

## 8. Step-by-Step Neon Migration Recommendations

1. Create a Neon project and a database branch (e.g. `production`). Note both the **pooled** and **direct** connection strings Neon provides.
2. In Render's service environment settings, set `DATABASE_URL` to the Neon **pooled** connection string (see Section 6's caveat), plus every other required variable from the table in Section 6.
3. Before first traffic, run `npm run db:migrate:deploy` **once**, from a one-off Render shell/job or a local machine, using the **direct** Neon connection string (safer for DDL than going through the pooler). This replays all 30 migrations against a fresh, empty database — including the backfill migration from Section 5, which is a safe no-op on an empty table.
4. Confirm `prisma/migration_lock.toml`'s `postgresql` provider matches Neon (it does — Neon is PostgreSQL-compatible).
5. Deploy the backend service to Render using the build/start commands in Section 7.
6. Smoke-test `GET /api/v1/health` against the deployed Render URL before pointing the frontend at it.
7. Only after the health check and a basic read/write smoke test (e.g. register a test user, confirm a row appears) succeed, cut over the frontend's `NEXT_PUBLIC_API_BASE_URL` to the new Render URL.
8. Do **not** run `npm run db:seed` against this Neon database unless you specifically intend to (re-)apply the bootstrap Role/Permission/Market reference data — see the destructive-seed caveat in Section 9.

---

## 9. Backup, Restore, and Data-Integrity Verification

- **Before running migrations against any database with real data:** use Neon's branching feature to create a snapshot/branch of the target database first. Neon branches are cheap, instant, and give a trivial rollback path if a migration step misbehaves — this is the practical equivalent of a backup for this workflow.
- **Point-in-time restore:** Neon retains point-in-time recovery for a window depending on plan tier; confirm the retention window on your specific Neon plan before relying on it as a safety net for the initial cutover.
- **Post-migration spot check:** after running `migrate deploy` against a database that already has real `order_addresses` rows (i.e., anything other than a brand-new empty Neon database), verify row counts before/after — the one backfill migration (Section 5) is expected to **double** the `order_addresses` row count (one BILLING clone per existing SHIPPING row). An unexpected count (not roughly double, or a huge unexplained jump) would indicate the migration ran against unexpected data and warrants investigation before proceeding.
- **Role-table caveat:** `prisma/seed.ts`'s `seedRoles()` step unconditionally **deletes any `Role` row whose `key` is not `super_admin` or `customer`**, every time it runs, including in production. If this seed script is ever run against a Neon database that has accumulated custom roles, confirm intent first — this is explicitly by design in the current codebase (see the code comment in `seed.ts` about retiring prior operational roles), not a bug, but it is a real deletion path that a future operator could trigger by accident if `npm run db:seed` is run casually against production.
- **Admin bootstrap caveat:** `prisma/seed-admin.ts` is non-destructive and idempotent (no-ops if any user already holds `super_admin`), and requires `SEED_ALLOW_ADMIN_BOOTSTRAP=true` plus real credentials to run in production — low risk, but confirm the `super_admin` Role exists (via `seed.ts`'s bootstrap step) before running it.

---

## 10. Prioritized Pre-Production Issue List

1. **Add `prisma generate` to the Render build command.** Without it, the gitignored generated Prisma client won't exist and the build/start will fail outright. (Blocking.)
2. **Pin the Node version** (`engines.node` in `backend/package.json`) to avoid drift between local dev and Render's build environment.
3. **Decide and document pooled-vs-direct `DATABASE_URL` usage** for Neon (Section 6) — currently no guidance exists anywhere in the codebase or `docs/DATABASE.md`.
4. **Add a graceful-shutdown handler** (`SIGTERM`/`SIGINT` → call `disconnectPrisma()` before exit) — currently absent entirely; relevant once Render starts rolling deploys/restarts regularly.
5. **Decide on production image/upload storage.** `backend/src/app/app.ts` serves product/category/promotion media from local disk (`backend/uploads/`), explicitly marked "dev/small-deployment appropriate only" in the codebase. Render's filesystem is ephemeral across deploys — this will lose uploaded files on redeploy unless moved to object storage or a persistent disk is attached. (Flagged for completeness; outside this audit's Prisma/PostgreSQL scope, but it's a real production blocker for the app as a whole.)
6. **Consider widening Prisma error-code handling** beyond `P2002` (e.g. explicit handling for P2003/foreign-key, P2025/not-found) if clearer API error messages are desired — currently functional but generic for anything besides unique-constraint violations.
7. **Add minimal CI** to validate migrations (e.g. `prisma migrate diff` / a dry-run against a disposable database) before merging schema changes — no CI configuration exists in the repository today.

None of the above are schema-correctness or data-safety defects — they are deployment-process gaps that should be closed before the first production cutover.

---

## 11. Deployment Readiness Assessment: **Ready with Issues**

The Prisma schema, migration history, and database access layer are internally consistent, free of confirmed drift, and contain no destructive operations beyond one already-applied, well-understood backfill migration. The data model's `onDelete` choices show deliberate protection of financial/order history. `prisma migrate deploy` is the correct and safe command to replay this history onto a new Neon database.

What is **not** ready is the surrounding deployment tooling: no Node version pin, no build step that runs `prisma generate`, no documented Neon pooling strategy, no graceful shutdown, and no CI. These are all concrete, addressable gaps (Section 10) rather than open-ended risks, and none require touching the schema or migration history itself. Once the build-command and Node-pinning issues are closed (items 1–2, the only two that would actually block a successful deploy), this backend is safe to point at a fresh Neon database and deploy to Render.
