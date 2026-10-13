# CURRENT_TASK.md

> This file always reflects the single active task. Keep it focused (see [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md), rule 20).

**Task:** Fixed a real cross-domain cookie gap and added an opt-in admin-bootstrap startup hook, after auditing a 5-part pasted change request that assumed several things (no `localStorage`, Bearer-header fallback, single `token` cookie, auto-admin-bootstrap) that either already existed in a more correct form or would have weakened this repo's cookie-only, permission-based auth model.

**Status:** COMPLETE at the code/build/test level.

## Decisions made (confirmed with user before implementing)

1. **Frontend/login-verification changes** = none. Audit found the frontend already has no `localStorage`, already sends `credentials: "include"` globally, and already redirects by permission (`hasAdminAccess`), not role string; login/register already correctly distinguish unverified customers (allowed in) from unverified staff (blocked, 403). Adding `localStorage`/`Authorization: Bearer` was rejected as a regression against the "never localStorage" rule.
2. **Cross-domain cookies** = fix the real gap confirmed with the user (production frontend and backend are on unrelated registrable domains, no shared parent domain) by relaxing `backend/src/config/env.ts`'s validation rather than building a new CSRF mechanism. The existing Origin-header + custom-header checks in `middleware/csrf.ts` are already independent of `SameSite` and remain sufficient defense under `SameSite=None` — confirmed by re-reading `docs/AUTH_SECURITY.md`'s own CSRF rationale.
3. **Admin bootstrap** = user chose an opt-in, guarded startup hook (reusing `prisma/seed-admin.ts`'s exact safety rails) over a one-off ops command, since one-off commands are impractical on their hosting setup.

## What was built

**Backend.**
- New `backend/src/security/adminBootstrap.ts` — `bootstrapSuperAdmin(prisma)`, extracted from `prisma/seed-admin.ts`. No-op unless `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD` are both set; refuses production unless `SEED_ALLOW_ADMIN_BOOTSTRAP=true`; no-op if a `super_admin` already exists (role-membership check, not email); never overwrites an existing user. Returns a status value (`"bootstrapped" | "already_exists" | "not_configured" | "production_guard" | "invalid_password" | "role_missing" | "error"`).
- `backend/src/server.ts` — awaits `bootstrapSuperAdmin(getPrismaClient())` after `createApp()`, before `app.listen`.
- `backend/prisma/seed-admin.ts` — now a thin CLI wrapper around the shared function; sets `process.exitCode = 1` for any non-success status, matching its prior manual-run behavior.
- `backend/src/config/env.ts` — added `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD`/`BOOTSTRAP_ADMIN_FIRST_NAME`/`BOOTSTRAP_ADMIN_LAST_NAME`/`SEED_ALLOW_ADMIN_BOOTSTRAP` to the validated schema (`env.adminBootstrap`); removed the `superRefine` rule that required `COOKIE_DOMAIN` whenever `COOKIE_SAMESITE=none`.
- `backend/.env.example` — updated comments for both the cookie topology choice and the (now dual CLI+startup) admin bootstrap.

**Docs.** `docs/AUTH_SECURITY.md` — Cookies section now describes both same-parent-domain and unrelated-domain topologies; CSRF section clarifies the Origin+custom-header checks are `SameSite`-independent and already cover the unrelated-domain case (no double-submit-token mechanism added); new "Super_admin Bootstrap" section.

**Frontend.** No changes — audited and confirmed already correct.

## Verification performed

Backend: `npm run build` (prisma generate + tsc) clean, `npm run lint` clean. `npx vitest run tests/integration/seed-guard.test.ts` — 2/2 passing (confirms the new startup hook doesn't affect `prisma/seed.ts`'s "fresh production seed creates zero users" invariant — that test never goes through `server.ts`). `npx vitest run tests/integration/auth` — 56/56 passing. Full suite re-run: 4 pre-existing/unrelated failures (`catalog.products.test.ts`, `customers.test.ts`, `catalog.categories.admin.test.ts`, `requireCaptcha.test.ts` — none touch auth, cookies, or env), consistent with flakiness already noted in the 2026-10-08 changelog entry.

Frontend: `npm run build` clean (no frontend files changed by this task).

## Not performed — out of scope for this task

- Actually setting `COOKIE_SAMESITE=none` / `ALLOWED_ORIGINS` / `FRONTEND_URL` / `BOOTSTRAP_ADMIN_EMAIL` etc. in the real production environment (Vercel/Render dashboards) — that's an ops action for the user to perform, not a code change.
