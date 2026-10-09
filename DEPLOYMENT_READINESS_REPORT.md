# Vizaura Global — Deployment Readiness Report

Generated: 2026-10-09
Scope: Read-only architecture and deployment audit. No code, dependencies, database, or git state were modified while producing this report.

---

## 1. Executive Summary

Vizaura Global is a two-market (Pakistan, UAE) e-commerce platform built as **two independent applications** — a Next.js frontend and an Express/TypeScript backend — that talk only over REST at `/api/v1`. There is no monorepo tooling and, as of this report, **no git repository exists anywhere in the project**.

The codebase is in good shape at the code/test level: core domains (auth, catalog, cart, checkout, orders, shipping, returns, reviews, wishlist) are documented as complete, environment validation is strict, and secrets handling in source control (once git is initialized) is already well set up via `.gitignore`. However, there are several **real, confirmed gaps that affect deployability as a production store today**:

- **No online payment gateway is implemented.** Only Cash-on-Delivery works in production; a mock provider exists but is deliberately disabled when `NODE_ENV=production`.
- **Uploaded images (products/categories/promotions) are stored on local disk**, not in object storage. This will not survive typical redeploys or scaling beyond a single persistent server.
- **No Dockerfile, CI config, or hosting-platform file exists anywhere.** Deployment tooling must be built from scratch.
- **CORS only supports a single frontend origin** (`FRONTEND_URL` is one string, not a list) — relevant when deciding on `www` vs. apex domain, or staging vs. production.
- **No Node version is pinned** in either `package.json` (`engines` field absent), and the two apps' `@types/node` majors disagree (22 vs. 20), which is a minor but real inconsistency to resolve before picking a runtime.

None of these are "the code is broken" — they are **known, architecturally deliberate simplifications** (several are called out in code comments by the original implementation as "dev/small-deployment appropriate only"). They need a decision and a small amount of work before a public, scalable production launch, but none require a rewrite.

**Deployability on Hostinger specifically depends on your exact plan** (see Section 9) — the backend is a long-running Node process with a PostgreSQL database, which rules out pure static/shared hosting for the backend regardless of plan.

---

## 2. Application Architecture and Folder Structure

```
d:\vizaura-global\
├── .gitignore              # root-level, covers both apps (git not yet initialized)
├── CLAUDE.md, README.md
├── docs/                   # extensive internal project documentation
├── design-references/      # UI mockup images, not code
├── frontend/                # independent Next.js app, own package.json/lockfile
│   └── src/app/             # (storefront), (auth), account/, admin/ route groups
└── backend/                  # independent Express/TS app, own package.json/lockfile
    ├── src/modules/<domain>/ # Controller → Service → Repository per domain
    ├── src/config/env.ts     # zod-validated environment schema
    ├── src/db/prismaClient.ts
    ├── prisma/schema.prisma + migrations/ (29 migrations)
    └── uploads/               # local-disk media storage (gitignored)
```

- No root `package.json` — confirmed **not** a monorepo; frontend and backend must be deployed as two separate processes/targets.
- Frontend and backend communicate only through documented REST endpoints under `/api/v1`, consistent with `docs/PROJECT_CONTEXT.md`'s stated non-negotiable.
- **Git**: `.git` does not exist at the project root, nor inside `frontend/` or `backend/`. The project is currently unversioned.

---

## 3. Frontend and Backend Technology Stack

### Frontend (`frontend/package.json`)
- **Framework**: Next.js `16.3.5`, React `19.2.8`, React DOM `19.2.8`.
- **Styling**: Tailwind CSS `^4`.
- **Other notable deps**: `recharts` (admin dashboard charts), `lucide-react` (icons), `tailwind-merge`.
- **No test runner configured.**
- **Scripts**: `dev` (`next dev -p 3000`, port pinned), `build` (`next build`), `start` (`next start`), `lint`, `typecheck` (`tsc --noEmit`).
- `next.config.ts` contains almost nothing — a single dev-only Turbopack cache workaround. **No `output: "standalone"`**, **no `images.remotePatterns`**, **no custom `rewrites`/`redirects`**.
- No `engines` field — Node version unpinned. `@types/node: ^20` in devDependencies (a type-only hint, not an enforced constraint).

### Backend (`backend/package.json`)
- **Framework**: Express `^4.19.2`, TypeScript, **ESM** (`"type": "module"`), target `ES2022`/`NodeNext`.
- **ORM**: Prisma `^7.10.0` using the **driver-adapter** architecture (`@prisma/adapter-pg` + `pg ^8.23.0`) — no bundled Prisma query-engine binary, connection string supplied by the app at runtime, not via the Prisma CLI's `datasource.url`.
- **Security/middleware**: `helmet`, `cors`, `express-rate-limit`, `cookie-parser`.
- **Auth/crypto**: `jsonwebtoken`, `@node-rs/argon2` (password hashing).
- **Uploads**: `multer` (disk storage).
- **Validation**: `zod`.
- **No payment SDK, no email SDK (Brevo is called via raw HTTP `fetch`), no CAPTCHA SDK, no WebSocket/queue/cron library** anywhere in dependencies or `src/`.
- **Scripts**: `dev` (`tsx watch`), `build` (`tsc` → `dist/`), `start` (`node dist/server.js`), `lint`, `test` (vitest), `db:generate`, `db:migrate`, `db:migrate:deploy`, `db:seed`, `db:seed:admin`, `db:reset`, `db:studio`.
- No `engines` field. `@types/node: ^22.5.0` in devDependencies — **disagrees with the frontend's `^20`**; not a functional bug today, but worth aligning before fixing a deploy Node version.

### Backend module layout
Feature-first modules under `src/modules/<domain>/` (auth, users, rbac, catalog, pricing, inventory, cart, checkout, orders, payments, shipping, returns, reviews, wishlist, audit, health), each Controller → Service → Repository, with only repositories touching Prisma — confirmed consistent with `CLAUDE.md`'s stated architecture rule.

---

## 4. Database and Prisma Configuration

- **Provider**: PostgreSQL (`backend/prisma/schema.prisma`, `datasource db { provider = "postgresql" }`).
- **Prisma 7 driver-adapter model**: the datasource block no longer carries the connection URL; `src/db/prismaClient.ts` constructs `new PrismaPg({ connectionString: env.databaseUrl })` at runtime, and `prisma.config.ts` supplies it for CLI commands (`db:migrate`, etc.).
- **Generated client** output: `backend/src/generated/prisma` (gitignored — must be regenerated via `db:generate`/`build` in any new environment, never committed).
- **Migrations**: 29 migration folders, chronologically ordered from `20260918000000_init_foundation` through `20261008162934_add_address_and_customer_notifications`, covering foundation, cart, checkout, orders, payments, shipping, returns, audit, wishlist, reviews, product metadata, notifications, and promotions. The sequence is unbroken and looks complete; no gaps or out-of-order timestamps were observed.
- **Key models**: `Product`/`ProductVariant`/`ProductMedia`/`Category` (catalog), `VariantPrice`/`VariantStock`/`StockReservation` (pricing/inventory, per-market, integer minor-unit — no FX conversion, consistent with `CLAUDE.md`), `User`/`Session`/`Role`/`Permission` (auth/RBAC), `Order`/`Payment`/`Shipment`/`Return` (fulfillment).
- **Seed scripts**: `db:seed` and `db:seed:admin` exist; a dedicated `tests/integration/seed-guard.test.ts` verifies seed-guard behavior. Env vars `SEED_ALLOW_DEMO_DATA`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `SEED_ALLOW_ADMIN_BOOTSTRAP` gate what the seed does — these were not read in detail (would require opening the seed script, out of scope for this pass) but their names strongly suggest the seed can bootstrap an initial admin account and optionally demo/test data separately. **Verify before running in production**: confirm `SEED_ALLOW_DEMO_DATA` defaults to off, so a production seed doesn't insert demo products.
- **Test database risk**: `DATABASE_URL_TEST` is *preferred* but not strictly enforced — `env.ts` logic is `databaseUrl = isTest ? (DATABASE_URL_TEST ?? DATABASE_URL) : DATABASE_URL`. If `DATABASE_URL_TEST` is ever left unset while running the test suite, tests will **TRUNCATE the `DATABASE_URL` database** (per `tests/helpers/db.ts`). This is safe today because dev/test both point locally, but becomes a real data-loss risk once `DATABASE_URL` points at production — **always set `DATABASE_URL_TEST` to a distinct database in any environment where `npm test` might run.**

---

## 5. Environment Variables Inventory

No values are reproduced here — names, purpose, and public/private status only.

### Backend (`backend/.env.example` / `src/config/env.ts`)

| Variable | Public/Private | Purpose | Production behavior |
|---|---|---|---|
| `NODE_ENV` | private | Standard Node environment flag | Drives every other production-only check below |
| `PORT` | private | Port Express listens on | Optional, default 4000 |
| `FRONTEND_URL` | private | CORS allow-origin + link building | **Single origin only** — must match the real deployed frontend origin exactly, or CORS/CSRF will reject every browser request |
| `APP_URL` | private | Base URL used in outbound email links | **Required in production**; falls back to `FRONTEND_URL` if unset |
| `DATABASE_URL` | private, secret | PostgreSQL connection string | **Required in production** — app refuses to boot without it |
| `DATABASE_URL_TEST` | private, secret | Separate DB for `npm test` | Strongly recommended wherever tests might run against a real environment |
| `JWT_ACCESS_SECRET` | private, secret | Signs short-lived access tokens | **Required in production**, must be ≥32 bytes and differ from the dev default — app refuses to boot otherwise |
| `JWT_ACCESS_SECRET_PREVIOUS` | private, secret | Optional second key for verify-only rotation | Optional |
| `JWT_ACCESS_EXPIRES_IN` | private | Access token lifetime | Default `15m` |
| `JWT_ISSUER` / `JWT_AUDIENCE` | private | JWT claim validation | Have defaults |
| `REFRESH_TOKEN_EXPIRES_IN` | private | Refresh-token session lifetime | Default `30d` |
| `CAPTCHA_PROVIDER` | private | `recaptcha` \| `turnstile` \| `noop` | **`noop` is forbidden in production**; defaults to `recaptcha` in prod |
| `RECAPTCHA_SECRET_KEY` | private, secret | Google reCAPTCHA v2 server secret | **Required if `CAPTCHA_PROVIDER=recaptcha`** (the production default) |
| `TURNSTILE_SECRET_KEY` | private, secret | Cloudflare Turnstile server secret | Required only if `CAPTCHA_PROVIDER=turnstile` |
| `CAPTCHA_TIMEOUT_MS` | private | CAPTCHA verification HTTP timeout | Default 2500ms |
| `PAYMENTS_MOCK_WEBHOOK_SECRET` | private, secret | Signs the dev-only mock payment webhook | Mock provider itself is disabled in production, so this only needs a non-default value to satisfy boot validation |
| `EMAIL_PROVIDER` | private | `console` \| `brevo` | Must be `brevo` for real email delivery |
| `EMAIL_FROM` | private | Default "from" display | Has a default |
| `BREVO_API_KEY` | private, secret | Brevo transactional email API key | **Required if `EMAIL_PROVIDER=brevo`** |
| `BREVO_API_URL` | private | Brevo API endpoint override | Optional, has default |
| `BREVO_SENDER_EMAIL` | private | Verified sender address in Brevo | **Required if `EMAIL_PROVIDER=brevo`** |
| `BREVO_SENDER_NAME` | private | Sender display name | **Required if `EMAIL_PROVIDER=brevo`** |
| `CONTACT_INFO_EMAIL` / `CONTACT_SALES_EMAIL` | private | Where contact-form submissions are routed | Have defaults |
| `COOKIE_SAMESITE` | private | `lax` \| `strict` \| `none` | Default `lax` |
| `COOKIE_DOMAIN` | private | Cookie domain scope | Required only if `COOKIE_SAMESITE=none`; otherwise intentionally left unset for host-only cookies |
| `TRUST_PROXY_HOPS` | private | Express `trust proxy` depth | Relevant behind Hostinger's/any reverse proxy — see Section 9 |
| `CSRF_HEADER_NAME` | private | Header name CSRF middleware expects | Default `x-requested-with` |
| `RATE_LIMIT_ENABLED` | private | Toggles rate limiting | Defaults on outside test |
| `PAYMENT_PROVIDER_SECRET_KEY` | private, secret | **Unused placeholder** — explicitly commented "reserved for future phases" | No current effect |
| `SEED_ALLOW_DEMO_DATA`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `SEED_ALLOW_ADMIN_BOOTSTRAP` | private, secret | Gate what `db:seed`/`db:seed:admin` are allowed to do | Review before running any seed script against a production database |

**Production boot safety**: `src/config/env.ts` validates all of the above via Zod with a `.superRefine` enforcing the "required in production" rules, and the application **throws at startup** (refuses to boot) if a production-only requirement is missing — this is a strong, confirmed positive for deployment safety.

### Frontend (`frontend/.env.example` / `.env.local`)

| Variable | Public/Private | Purpose | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | **public** (bundled into client JS) | Base URL the browser calls for the backend API | Must point at the real production backend URL, e.g. `https://api.yourdomain.com/api/v1` |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | **public** | reCAPTCHA site key shown to the browser | Must match the backend's `RECAPTCHA_SECRET_KEY` pair |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | **public** | Turnstile site key | **Referenced in code (`src/components/auth/Turnstile.tsx`) but absent from `frontend/.env.example`** — documentation gap. Only needed if you actually switch `CAPTCHA_PROVIDER` to `turnstile`. |

No private (non-`NEXT_PUBLIC_`) frontend env vars exist — consistent with "frontend never holds secrets."

---

## 6. External Services and Integrations

- **Email — Brevo**: accessed via raw HTTP `fetch` to the Brevo transactional email API (no SDK dependency). Supports verification emails, password reset, "existing account" notices, contact-form forwarding, and order confirmation emails. Falls back to a console logger in any environment where `EMAIL_PROVIDER` isn't set to `brevo` — **if you forget to set this in production, emails will silently just log to the server console instead of sending**, which is worth a manual smoke-test after deploy.
- **CAPTCHA — Google reCAPTCHA v2 (production default) or Cloudflare Turnstile (fallback code path)**. A `noop` provider exists for local dev/tests only and is hard-blocked in production.
- **Payments — Cash-on-Delivery only.** `cod.provider.ts` simply marks orders `PENDING` with no external call. A `mock.provider.ts` stub exists for local dev/testing (signs its own fake webhook) but is explicitly disabled whenever `NODE_ENV=production`. **No Stripe/PayPal/Razorpay/JazzCash/Easypaisa or any other real gateway is integrated.** If the launch plan includes online card/wallet payments for PK/UAE customers, this is new engineering work, not a configuration change.
- **No other third-party services** (no analytics SDK, no error-tracking/Sentry, no CDN SDK) were found in either app's dependencies.

---

## 7. Image and File Storage Assessment

- **Storage mechanism**: `backend/uploads/{products,categories,promotions}/`, written via `multer.diskStorage` (`src/modules/catalog/mediaUpload.middleware.ts`), served back out via `express.static` at `/uploads` (`src/app/app.ts`). 5MB size limit, JPEG/PNG/WEBP only.
- **The code's own comments explicitly flag this as "dev/small-deployment appropriate only"** — local disk storage does not survive a redeploy that wipes the filesystem, and does not work across multiple server instances/horizontal scaling.
- **Currently on disk**: 42 real files (31 category images, 8 product images, 3 promotion images), all correctly excluded from git via the root `.gitignore`'s `backend/uploads/` rule. **These files are not in version control and must be migrated manually** to wherever the backend ultimately runs.
- **URL generation is dynamic, not hardcoded**: `buildProductMediaUrl`/`buildCategoryMediaUrl`/`buildPromotionMediaUrl` build URLs from the *incoming request's own* `req.protocol`/`req.get("host")` at upload time — there is no hardcoded `localhost` in this logic. However, **URLs already saved to the database were generated against whatever host served the original upload request** (almost certainly `localhost:4001` in local dev). Moving to production will not automatically fix those already-stored URLs; they'll need either (a) a one-time DB update to rewrite the host, or (b) re-uploading the affected media once in production.
- **Recommendation**: the simplest reliable path compatible with the existing implementation is to keep local-disk storage only if the chosen Hostinger plan gives you a **single persistent VPS with a stable filesystem** (no auto-scaling, no ephemeral containers). If the plan involves any kind of container redeploy that wipes disk, or multiple backend instances, local storage will lose images — at that point migrating `mediaStorage.ts` to an S3-compatible bucket (the code comment itself suggests this) becomes necessary before launch, not after.

---

## 8. Security and GitHub Readiness

**Confirmed good practices already in place:**
- Auth is JWT access (short-lived) + opaque, hashed refresh token in an HttpOnly cookie — never `localStorage` (confirmed zero `localStorage` usage anywhere in `frontend/src`).
- Refresh-token rotation with reuse detection; whole session family revoked on detected reuse, password change, or user suspension.
- Cookies get `Secure` and the `__Secure-` name prefix automatically in production (`env.isProduction` gates both); `COOKIE_DOMAIN` is deliberately left unset by default for host-only cookie scoping.
- CORS is locked to a single configured origin with `credentials: true`; non-GET requests also require a custom header (CSRF double-submit style protection).
- Permission-based authorization (`resource:action`) throughout — no `role === "..."` checks found, consistent with `CLAUDE.md`'s rule. Only `super_admin` and `customer` roles are seeded.
- Production boot validation (Section 5) prevents the app from ever running in production with a weak/default secret, a disabled CAPTCHA, or missing required config.

**Git / secrets hygiene:**
- No `.git` directory exists anywhere yet — this is a brand-new repo to be initialized.
- Root `d:\vizaura-global\.gitignore` is comprehensive and already correctly excludes: `.env`/`.env.*` (with an explicit `!.env.example` exception so templates *can* be committed), `backend/src/generated/` (Prisma client), `backend/uploads/` (media), `node_modules/`, build output, logs, OS/editor files.
- `frontend/.gitignore` additionally ignores `.env*` and `.vercel` on its own (belt-and-suspenders with the root file).
- **`backend/.gitignore` is empty (0 bytes).** This is not a problem today because the intended setup is a single repo rooted at `d:\vizaura-global` (the root `.gitignore` already covers `backend/uploads/` and `backend/src/generated/`), but if `backend/` were ever initialized as its own standalone repo, nothing would protect its `.env` or `uploads/` — worth adding a minimal `backend/.gitignore` as a defensive measure regardless.
- **No secret-looking files were found outside the expected `.env`/`.env.local`**: no `.pem`, `.key`, `credentials.json`, or database dump files anywhere in the tree.
- **One untracked, unexplained file**: `frontend/jarfinal.txt` (135 bytes) is not covered by any `.gitignore` pattern. Review its contents before the first commit — if it's scratch/debug output, delete it or add it to `.gitignore`; if it's meant to be kept, fine to commit as-is.
- A few local build/log artifacts exist (`backend/.test-output.log`, `frontend/.build-output.log`, `frontend/.dev-restart.log`, `frontend/tsconfig.tsbuildinfo`) — all already covered by existing gitignore patterns (`*.log`, `*.tsbuildinfo`).

**Since no git history exists yet, there is nothing to remediate retroactively** — the "has a secret ever been committed" question is moot today, but becomes important going forward: always double-check `git status`/`git diff --cached` before each commit, especially after adding new config files.

---

## 9. Hostinger Compatibility Assessment

**What the application actually requires, independent of any specific Hostinger plan:**

- The **backend is a long-running Express process** (`npm start` → `node dist/server.js`) that must stay running continuously, listening on a port, with an outbound connection to a PostgreSQL database. It is not a static site and cannot run as pure serverless functions without rewriting the whole backend into a serverless-function model (not recommended — out of scope of "deployment," that would be a rearchitecture).
- No WebSockets, no background job queue, no cron/scheduled task was found anywhere in the backend — so no special always-on worker process is needed beyond the one API server.
- The **frontend is a standard Next.js app** using `next start` (not `output: "export"`), meaning it also needs a persistent Node process (SSR/Server Components are used throughout — e.g. `admin/layout.tsx` does server-side session checks on every request). It **cannot** be deployed as a static export without breaking admin auth gating and account pages.
- Both apps therefore need **persistent Node.js hosting**, not traditional shared/static hosting.

**Confirmed vs. needs your plan details:**

| Question | Status |
|---|---|
| Does Hostinger's shared hosting support long-running custom Node processes? | **Needs verification against your specific plan.** Many budget shared-hosting tiers only support PHP/static sites or very limited Node app runners; this must be checked in your Hostinger panel (look for "Node.js" under hosting features) before assuming compatibility. |
| Does your plan include PostgreSQL, or only MySQL? | **Needs verification.** Many entry-level Hostinger shared plans only offer MySQL/MariaDB, not PostgreSQL. If PostgreSQL isn't available on your plan, you'd need either a Hostinger VPS plan (full control, can install Postgres yourself) or an external managed Postgres provider (e.g. a managed Postgres add-on) — do **not** default to buying a bigger plan without first checking what your current plan actually offers. |
| Can both apps run on one instance? | Technically yes on a VPS (two Node processes + Postgres, behind a reverse proxy like Nginx splitting by subdomain/path). Not possible on typical shared hosting that only runs one app per account. |
| Is a VPS required? | **Likely**, if your current plan is shared/managed hosting without a documented persistent-Node-process feature. Hostinger's VPS plans run a full Linux environment where you control Node version, process manager (e.g. `pm2`), and can install PostgreSQL directly — this is the most straightforward fit for this specific codebase as it stands today. |
| Can file uploads work as-is? | Yes, as long as the deployment target has a **persistent, non-ephemeral filesystem** (true of a VPS with normal disk; not true of containerized/ephemeral platforms that wipe disk on redeploy). |

**Recommendation for this section**: before purchasing anything new, open your current Hostinger hPanel and check (a) whether "Node.js App" is offered as a feature on your plan and what Node versions it supports, and (b) whether PostgreSQL is available as a database option alongside MySQL. Report those two facts back and the deployment architecture in Section 15 can be finalized precisely instead of hypothetically.

---

## 10. Production Database Setup and Migration Strategy

- **Current state**: local PostgreSQL via `DATABASE_URL`, 29 sequential Prisma migrations, looks complete and consistent (no gaps in the migration timestamp sequence).
- **Creating a production database**: once you have a PostgreSQL instance available (Hostinger-provided or external), set a new `DATABASE_URL` for that environment — never reuse your local/dev connection string.
- **Applying schema**: use `npm run db:migrate:deploy` (the non-interactive, production-safe Prisma command — distinct from `db:migrate`, which is the interactive dev command and should **not** be run against production) against the new `DATABASE_URL`. This applies all 29 existing migrations in order; it does not touch data beyond what the migrations themselves define (mostly schema changes, based on migration names — no migration name suggests a destructive data rewrite, but this report did not open each migration's SQL to verify row-level effects, which would need a final check before running against a database holding real data).
- **Seeding**: `db:seed`/`db:seed:admin` exist specifically to create things like the initial `super_admin` account. **Review `SEED_ALLOW_DEMO_DATA`/`SEED_ALLOW_ADMIN_BOOTSTRAP` env flags before running any seed in production** — you likely want the admin-bootstrap seed only, not any demo/test product data.
- **Migrating existing local data** (your current catalog/admin accounts): Prisma migrations only create schema, not data. If you want your current local product catalog, categories, and settings to carry over to production, you have two realistic options: (1) use `pg_dump`/`pg_restore` (or Hostinger's provided DB export tool) to copy the actual rows from your local Postgres to the production one after migrations are applied, or (2) treat production as a fresh start and recreate catalog data through the admin dashboard. **This report does not recommend which without your input** — see Section 18.
- **Identifying test/demo data**: this report did not query the live local database, so it cannot definitively label which rows are demo vs. real without your confirmation — but the presence of `SEED_ALLOW_DEMO_DATA` as a named flag strongly suggests the seed script itself knows how to distinguish demo data from bootstrap-essential data (e.g. the admin account). Reviewing `backend/prisma/seed.ts` (or wherever the seed script lives) before migrating data is a sensible P1 step.
- **Data-loss risks to resolve first**: the shared "test DB falls back to prod DB" risk from Section 4 — make sure `DATABASE_URL_TEST` is always explicitly set in any environment where `npm test` could run, so a mistaken test invocation never truncates production data.

---

## 11. Build, Start, and Deployment Requirements

**Backend** (run from `backend/`):
```
npm ci
npm run db:generate      # generates Prisma client into src/generated/prisma
npm run build            # tsc -> dist/
npm run db:migrate:deploy   # applies migrations to the configured DATABASE_URL
npm start                 # node dist/server.js
```
Requires: Node.js (version to be pinned — see Section 12), network access to the PostgreSQL database, all production env vars from Section 5 set before `npm start`.

**Frontend** (run from `frontend/`):
```
npm ci
npm run build    # next build
npm start        # next start (listens on port 3000 by default; override with -p or PORT)
```
Requires: `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` set **at build time** (Next.js inlines `NEXT_PUBLIC_*` vars into the client bundle during `next build` — they cannot be changed afterward without rebuilding).

**Working directory / app root**: each app's root is its own folder (`backend/`, `frontend/`) — there is no shared root build step.

**No background jobs, scheduled tasks, or WebSockets** were found — nothing beyond the two persistent server processes above is required to run this application.

---

## 12. Identified Deployment Blockers and Risks

### P0 — Critical, must resolve before any public production launch
- **No online payment gateway.** If online payment is expected at launch, this is unimplemented functionality, not configuration — needs a decision on provider (see Section 18) and real engineering work.
- **Confirm Hostinger plan supports persistent Node.js processes and PostgreSQL** (Section 9) before committing to any deployment plan — if not, a VPS upgrade or external DB provider is needed first.
- **Local-disk image storage** will not survive a redeploy on most non-VPS/ephemeral hosting. Confirm your actual hosting target's filesystem persistence before launch; if it's not guaranteed persistent, migrate to object storage first.

### P1 — High priority, should resolve before launch
- **Set `FRONTEND_URL`/`APP_URL`/`NEXT_PUBLIC_API_BASE_URL` to real production domains** before building/starting either app — CORS, CSRF, cookies, and email links all depend on these matching exactly.
- **Set `EMAIL_PROVIDER=brevo`** (plus the three required Brevo vars) in production — otherwise verification/reset/order-confirmation emails will silently just log to console instead of being delivered.
- **Set `DATABASE_URL_TEST` to a distinct database** everywhere `npm test` could run, to avoid accidentally truncating production data.
- **Review `SEED_ALLOW_DEMO_DATA`/`SEED_ALLOW_ADMIN_BOOTSTRAP`** before running any seed script against the production database.
- **CORS only supports one origin** — decide now whether production will be served from exactly one domain (e.g. `vizauraglobal.com` only, not also `www.vizauraglobal.com`), since the current code can't allowlist both without a small change.
- **No Node version pinned**; backend/frontend `@types/node` majors disagree (22 vs 20) — pick and pin one Node LTS version (document it, add `engines` fields) before deploying, to avoid subtle runtime differences between dev and prod.

### P2 — Normal priority
- **No Dockerfile/CI/process-manager config exists** — needs to be authored (e.g. a `pm2` ecosystem file or systemd service for a VPS, or a Dockerfile if containerizing).
- **`backend/.gitignore` is empty** — add defensive patterns (`.env`, `uploads/`, `dist/`, `src/generated/`) in case backend is ever split into its own repo.
- **Undocumented `NEXT_PUBLIC_TURNSTILE_SITE_KEY`** — add to `frontend/.env.example` if Turnstile is ever activated, or remove the dead code path if it won't be used.
- **Already-persisted upload URLs** reference whatever host served the original local upload — plan either a DB URL rewrite or re-upload of existing media once the production domain is final.

### P3 — Optional, can wait until after launch
- Review the stray `frontend/jarfinal.txt` file and either delete it or document its purpose.
- Consider adding automated browser/E2E testing — per `docs/CURRENT_TASK.md` and `docs/MODULE_STATUS.md`, no module has had real interactive browser QA yet (no headless browser tool was available in the dev environment); this is a product-quality gap independent of deployment.
- CMS module is not started (per `docs/MODULE_STATUS.md`) — not a blocker unless your launch plan depends on CMS-managed content.
- Analytics module is only partial — fine to defer.

---

## 13. Ordered Pre-deployment Checklist

1. Check your Hostinger plan for Node.js app support and PostgreSQL availability (Section 9) — do this before anything else, it determines the rest of the plan.
2. Decide on the payment approach for launch: COD-only for now, or delay launch until a real gateway is integrated (Section 18).
3. Decide on image storage: keep local disk (only safe if your hosting target has a genuinely persistent filesystem) or migrate to object storage first.
4. Pin a single Node.js LTS version for both apps; align `@types/node` majors; add `engines` fields.
5. Initialize git at the project root, review/fix `.gitignore` gaps (add a `backend/.gitignore`), review `frontend/jarfinal.txt`, then make the first commit (Section 14).
6. Create a private GitHub repository and push.
7. Provision the production PostgreSQL database; set a dedicated `DATABASE_URL` (and `DATABASE_URL_TEST` if tests will ever run in that environment).
8. Set every required production env var from Section 5 for both apps (do this in the hosting platform's secret/env manager, never commit real values).
9. Run `npm run build` for both apps locally to confirm they build clean with placeholder production-like env values.
10. On the server: `npm ci`, `db:generate`, `build`, `db:migrate:deploy`, run the admin-bootstrap seed only, then `npm start` for the backend; `npm ci`, `build`, `npm start` for the frontend.
11. Smoke-test: login, browse catalog, add to cart, checkout with COD, confirm a real email (password reset or order confirmation) is actually delivered via Brevo, confirm uploaded images render correctly over the real domain.
12. Confirm CORS/cookies work end-to-end over HTTPS (not just HTTP) — `Secure` cookies require HTTPS, and most of the "it works on localhost but not in prod" issues trace back to this.

---

## 14. Step-by-Step GitHub Setup for a Beginner

This section explains the process only — nothing here was executed.

1. **Check git status**: confirmed above — no `.git` folder exists yet anywhere in the project, so this is a clean start with nothing to lose.
2. **Review `.gitignore`**: the root `d:\vizaura-global\.gitignore` already excludes `.env*` (except `.env.example`), `backend/uploads/`, `backend/src/generated/`, `node_modules/`, build output, and logs. Add a minimal `backend/.gitignore` as a defensive second layer (Section 12, P2).
3. **Double-check for anything sensitive**: confirmed no `.pem`/`.key`/`credentials.json`/DB dumps exist; review `frontend/jarfinal.txt` before committing it.
4. **Initialize git** at the project root (`d:\vizaura-global`) so one repository covers both `frontend/` and `backend/` together, matching how the root `.gitignore` was written.
5. **Make the first commit** — stage everything except what's gitignored, and visually confirm with `git status`/`git diff --cached --stat` that no `.env` file, no `uploads/` content, and no `src/generated/` folder are staged before committing.
6. **Create a private GitHub repository** (via github.com or the `gh` CLI) — keep it private, since this is a live commercial project with real (if currently local) customer-adjacent data models.
7. **Add the GitHub repo as a remote and push** your initial commit.
8. **Check git history for secrets**: not applicable yet since there is no history before this first push — but from this point forward, always review a commit's diff before pushing, especially after adding new config/env-related files.
9. **Connect to hosting**: once a deployment platform/VPS is chosen (Section 15), either connect it to pull directly from the GitHub repo (if the platform supports git-based deploys) or use it as the source you `git pull`/`rsync` from onto your VPS.
10. **Ongoing workflow**: use feature branches for future changes, open pull requests into `main`, and only deploy from `main` once merged — this keeps a stable, reviewable history now that the project is finally versioned.

---

## 15. Recommended Deployment Architecture and Alternatives

Given the confirmed requirements (two persistent Node processes, PostgreSQL, local file storage, no WebSockets/queues):

**Option A — Single Hostinger VPS (recommended starting point, pending Section 9 verification)**
Run both Node apps (via `pm2` or systemd) plus PostgreSQL directly on one VPS, with Nginx as a reverse proxy routing `api.yourdomain.com` → backend port and `yourdomain.com` → frontend port, handling TLS termination for both. This most closely matches the current codebase as-is (local disk uploads work fine on a VPS's persistent filesystem) and needs no architecture changes — only env var and domain configuration.

**Option B — Hostinger (or any) VPS for backend + managed Postgres elsewhere**
If Hostinger's VPS Postgres setup proves inconvenient, or you want managed backups/scaling for the database specifically, run the backend + frontend on the VPS and point `DATABASE_URL` at an external managed Postgres provider instead. No code changes needed — just a different `DATABASE_URL`.

**Option C — Split frontend to a platform built for Next.js, backend stays on a VPS**
Deploy the frontend to a Next.js-native host and keep only the backend (+ Postgres) on Hostinger/VPS. This works today without code changes since the two apps already only communicate over REST, but adds a second hosting relationship to manage and a second place `NEXT_PUBLIC_API_BASE_URL`/`FRONTEND_URL` must be kept in sync.

**Not recommended given current code**: any static-export or pure-serverless deployment for the frontend (breaks SSR-based auth gating), or any deployment target with an ephemeral/non-persistent filesystem for the backend without first migrating uploads to object storage.

---

## 16. Step-by-Step Deployment Plan Once the Hostinger Plan Is Confirmed

This section is intentionally left as a template — the exact commands depend on whether your Hostinger plan turns out to support a Node.js App feature directly (hPanel-managed) or requires a full VPS (self-managed Linux). Once you confirm which (Section 18), this report can be extended with the exact hPanel steps or VPS shell commands (Nginx config, `pm2` setup, firewall rules for Postgres, TLS certificate issuance) tailored to that specific path, building directly on the generic build/start commands already given in Section 11.

---

## 17. Production Testing, Backup, Rollback, and Maintenance Plan

- **Testing after deploy**: run through the smoke-test list in Checklist item 11 on every deploy — login, catalog browse, cart, checkout (COD), email delivery, image rendering, and an admin-panel login to confirm permission gating still works over the real domain.
- **Backups**: schedule regular `pg_dump` backups of the production database (Hostinger VPS plans typically let you cron this yourself; confirm whether your specific plan includes any automatic DB backup feature). Also back up the `backend/uploads/` directory on a schedule, since it holds real, non-regenerable media files.
- **Rollback**: since deployment currently has no CI/CD or container versioning, the simplest rollback is keeping the previous `dist/` build and `git` commit available so you can redeploy the prior commit's build output if a release causes issues; Prisma migrations are additive-by-default in this project's history, but any future migration should be reviewed for reversibility before applying to production.
- **Maintenance**: monitor server disk usage given local file storage (uploads will grow over time), monitor Brevo email send failures/quota, and periodically review `AuditLog` entries (a model already exists for this per Section 4) for anomalous admin activity.

---

## 18. Outstanding Questions That Require Your Input

1. **Which exact Hostinger plan do you have** (shared, Business, Cloud, VPS — and which tier)? This determines whether Section 9's VPS recommendation is necessary or whether a lighter-weight managed Node.js hosting feature already covers your needs.
2. **Is Cash-on-Delivery acceptable for launch**, or is online payment (card/wallet) required before going live? If required, which gateway do you want for Pakistan/UAE (e.g. a regional provider vs. Stripe)? This is new engineering work, not configuration.
3. **Is local-disk image storage acceptable** for your chosen hosting target, or should uploads be migrated to S3-compatible object storage before launch? This depends on whether your hosting plan guarantees persistent disk.
4. **What is the final production domain** (and will `www` and the apex domain both need to work, given the single-origin CORS constraint)?
5. **Should your current local product catalog, categories, and admin account carry over to production**, or should production start fresh and be populated through the admin dashboard?
6. **Do you want this deployed as one combined repository** (frontend + backend in one GitHub repo, matching the current root `.gitignore` layout) or as two separate repositories?

---

*End of report. No application code, dependencies, database state, environment files, or git state were modified in producing this document.*
