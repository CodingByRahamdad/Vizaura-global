# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

VIZAURA GLOBAL: e-commerce platform for natural/wellness products, one business operating in two markets (Pakistan, UAE) — not multi-tenant. `frontend/` and `backend/` are two independent npm projects (no monorepo tooling, no root `package.json`) that talk only over REST at `/api/v1`. The directory is not a git repo.

**Before any task, read `docs/PROJECT_CONTEXT.md`, then only the relevant `docs/*.md` / `docs/modules/<DOMAIN>.md`.** Do not scan the whole repo (`docs/DEVELOPMENT_RULES.md`). After meaningful work, update `docs/MODULE_STATUS.md`, `docs/CURRENT_TASK.md`, and `docs/CHANGELOG.md`.

## Commands

Backend (`cd backend`; Express + TypeScript + Prisma 7 + PostgreSQL, ESM):
- `npm run dev` — `tsx watch`, serves on http://localhost:4001 (`GET /api/v1/health`)
- `npm run build` / `npm start` — `tsc` to `dist/`, run `dist/server.js`
- `npm run lint`
- `npm test` — vitest; **requires `DATABASE_URL_TEST`**. Integration tests hit a real PostgreSQL DB, not mocks.
- Single test: `npx vitest run tests/integration/cart.test.ts` (add `-t "name"` to filter)
- `npm run db:migrate` | `db:seed` | `db:generate` | `db:reset` | `db:studio`
- Setup: `cp .env.example .env`, fill `DATABASE_URL`/`DATABASE_URL_TEST`, then migrate + seed. Prisma client is generated into `src/generated/prisma`.

Frontend (`cd frontend`; Next.js 16, React 19, Tailwind 4):
- `npm run dev` (pinned to port 3000), `npm run build`, `npm run lint`, `npm run typecheck`. No test runner is configured.
- `frontend/AGENTS.md` (imported by `frontend/CLAUDE.md`) warns this Next.js version has breaking changes: read the relevant guide in `frontend/node_modules/next/dist/docs/` before writing Next code.

**Port/origin coupling:** the frontend must run on exactly the origin in backend `FRONTEND_URL` (`http://localhost:3000`). CORS and the CSRF `Origin` check use exact string match; a different port makes every non-GET request fail with `403 CSRF_VALIDATION_FAILED`. Change the port and `FRONTEND_URL`/`APP_URL` together.

## Backend architecture

- Feature-first modules in `backend/src/modules/<domain>/` (auth, users, rbac, catalog, pricing, inventory, cart, checkout, orders, payments, shipping, returns, reviews, wishlist, audit, health), each layered Controller → Service → Repository. **Only repositories may call Prisma**; cross-domain access goes through service calls, not another domain's repository.
- Shared pieces: `src/security/` (incl. `captcha/` provider abstraction), `src/integrations/` (email), `src/db/prismaClient.ts` (the single Prisma client), `src/config/env.ts` (validates env; refuses to boot in production without a real `JWT_ACCESS_SECRET` and Turnstile config), `src/errors/`, `src/middleware/`, `src/routes/`.
- External providers (payments, shipping, CAPTCHA, email) sit behind small interfaces in the service layer (`modules/payments/providers`, `modules/shipping/providers`).
- Tests: `tests/unit`, `tests/integration`, shared helpers in `tests/helpers` (`asRole`, `asPermissions`/`createAdHocRole` for partial-permission boundary tests, `resetTestData`, factories, fake email provider).

## Frontend architecture

- App Router route groups in `frontend/src/app/`: `(storefront)` (SEO pages, SSR), `(auth)`, `account/*`, `admin/*`. Components are grouped by domain under `src/components/`; API clients in `src/lib/api/` (admin in `src/lib/api/admin`); auth/permission helpers in `src/lib/auth` and `lib/authorization.ts`.
- The frontend never imports backend code, Prisma, or secrets. Admin pages gate on permissions (`hasAdminAccess`/`hasAnyPermission`, `requireAdminPermission.ts`) before fetching; this is UX only.
- UI direction: teal-green, premium/natural; see `docs/UI_DESIGN_SYSTEM.md` and reference images in `design-references/`.

## Non-negotiable rules

- Auth: short-lived JWT access token + rotating opaque refresh token in HttpOnly cookies; **never localStorage**. Don't change auth architecture without approval.
- Authorization is permission-based (`resource:action`), **never `role === "..."` checks**. Only two roles are seeded: `super_admin` (all permissions) and `customer` (none); the seed deletes any role not listed. Backend is the final authority.
- Never trust client-supplied price, total, role, permissions, inventory, or sensitive IDs. Validate input (zod) at API boundaries.
- Market prices are set independently per market, never FX-converted.
- No Redis/Elasticsearch/microservices/K8s; don't add dependencies without justification; don't change DB architecture casually.
- Never run broad/destructive commands (e.g. `taskkill /F /IM node.exe`, DB reset/drop, recursive deletes, uninstalls) without asking first. Stop only the specific PID you started. If the user must run a command, say exactly what and wait.
