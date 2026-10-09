# VIZAURA GLOBAL — Backend

REST API backend for VIZAURA GLOBAL, built with Node.js, Express, TypeScript, Prisma, and PostgreSQL. Authentication, RBAC, and CAPTCHA are implemented; business modules (catalog, cart, orders, payments, etc.) are not yet. See [../docs/PROJECT_CONTEXT.md](../docs/PROJECT_CONTEXT.md), [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md), [../docs/AUTH_SECURITY.md](../docs/AUTH_SECURITY.md), [../docs/RBAC.md](../docs/RBAC.md), and [../docs/API_CONTRACTS.md](../docs/API_CONTRACTS.md) before adding code.

## Setup

```
npm install
cp .env.example .env
```

Fill in `DATABASE_URL` (and `DATABASE_URL_TEST` for running tests) with your local PostgreSQL credentials, then:

```
npm run db:migrate
npm run db:seed
```

In production, `JWT_ACCESS_SECRET` must be a real random ≥32-byte value and `CAPTCHA_PROVIDER=turnstile` with a real `TURNSTILE_SECRET_KEY` — the app refuses to boot without them (see `src/config/env.ts`).

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Run the server in watch mode |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled server (`dist/server.js`) |
| `npm run lint` | Lint `src/`, `tests/`, and the Prisma config |
| `npm test` | Run the test suite (requires `DATABASE_URL_TEST`) |
| `npm run db:migrate` | Apply Prisma migrations (development) |
| `npm run db:seed` | Seed markets + RBAC reference data |
| `npm run db:studio` | Open Prisma Studio |

## Current State

- `GET /api/v1/health` — liveness check.
- `POST /api/v1/auth/{register,login,logout,logout-all,refresh,verify-email,resend-verification,forgot-password,reset-password,change-password}`, `GET /api/v1/auth/me` — see [../docs/API_CONTRACTS.md](../docs/API_CONTRACTS.md).
- JWT access tokens (15min) + opaque rotating refresh tokens (30d, HttpOnly cookies only), Argon2id password hashing, permission-based RBAC, Cloudflare Turnstile CAPTCHA (fails closed), in-memory rate limiting, CSRF/CORS/security headers.
- Feature-first structure: `src/modules/{auth,users,rbac,health}/`, shared security utilities in `src/security/`, the single Prisma client in `src/db/prismaClient.ts`.
- 168 tests (`tests/unit/`, `tests/integration/`) — integration tests run against a real PostgreSQL database, not mocks.
- No business modules (catalog, cart, orders, payments, etc.) yet.

This application never depends on frontend code and owns all data access, business logic, and secrets.
