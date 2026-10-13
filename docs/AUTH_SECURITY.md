# AUTH_SECURITY.md

Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) first.

**Status: implemented (Phase 4D-2).** This document now describes the actual authentication/security implementation in `backend/src/modules/auth/`, `backend/src/security/`, and `backend/src/middleware/`, not just the architecture. Business modules (catalog, orders, payments, etc.) remain unimplemented.

## JWT Strategy

- **Access token**: JWT, **HS256**, **15 minutes**, HttpOnly cookie only. Claims are limited to `sub` (userId), `sid` (sessionId), `iat`, `exp`, `iss`, `aud` — **no email, name, roles, permissions, or account status**. Authorization state is always re-read from the database on every request (see RBAC below), so a permission/role/suspension change takes effect immediately rather than waiting up to 15 minutes for the token to expire.
- **Refresh token**: **opaque, 256-bit random** (`crypto.randomBytes(32)`, base64url-encoded), **not a JWT** — it needs no signature because the database hash is the source of truth. **30-day sliding** expiry, HttpOnly cookie, `Path=/api/v1/auth` only.
- `iss=vizaura-global-api`, `aud=vizaura-global-web` (`JWT_ISSUER`/`JWT_AUDIENCE`).
- `JWT_ACCESS_SECRET` must be ≥32 bytes in production (enforced at boot by `src/config/env.ts`). An optional `JWT_ACCESS_SECRET_PREVIOUS` is verified against on failure, so the signing secret can be rotated without forcing a mass logout.
- No tokens are ever stored in localStorage/sessionStorage. See `backend/src/security/cookies.ts`.

## Session / Refresh-Token Rotation

Source of truth: the `Session` table (`backend/src/modules/auth/auth.repository.ts`).

- `refreshTokenHash` stores a **SHA-256 hash only** — the raw refresh token is never persisted.
- `familyId` groups a rotation chain. Rotation **keeps** the superseded row (marked `revokedReason="rotated"`) instead of deleting it — that retained row is the reuse tripwire.
- **Rotation** (`POST /auth/refresh`): a conditional `UPDATE ... WHERE id=$1 AND revokedAt IS NULL` revokes the current session; only the request that wins this race creates the replacement (same `familyId`, new hash, fresh 30-day expiry). A losing concurrent request gets `AUTH_REFRESH_RETRY` rather than also minting a session.
- **Reuse of an already-rotated token**:
  - Within a **15-second grace window** of rotation → `AUTH_REFRESH_RETRY`, family left intact (this is the benign case: a legitimate second in-flight request from the same client).
  - Outside the grace window → treated as a genuine security event: the **entire family is revoked** (`revokedReason="reuse_detected"`), cookies are cleared, `AUTH_REFRESH_REUSE_DETECTED` returned.
  - A session revoked for any other reason (`logout`, `logout_all`, `password_change`, `password_reset`, `expired`, `user_suspended`) returns `AUTH_SESSION_EXPIRED`, not reuse detection — those are expected revocations, not attacks.
- **Logout** revokes the one session identified by the refresh cookie (`revokedReason="logout"`); idempotent even with no/unknown cookie.
- **Logout-all** revokes every non-revoked session for the user (`revokedReason="logout_all"`).

## Password-Change / Reset Session Invalidation

- `User.passwordChangedAt` is set on registration, password change, and password reset.
- `middleware/authenticate.ts` rejects an access token whose `iat` (floored to whole seconds, matching JWT precision) is older than `passwordChangedAt` — **even if the token has not expired and its session row was not revoked for some other reason**.
- Both **change-password** and **reset-password** additionally revoke **every** existing session for the user in the same database transaction as the password update, so old refresh tokens fail immediately too, not just the access token.
- Change-password then issues one fresh session for the current device (stay signed in there, signed out everywhere else). Reset-password issues **no** new session — the user must sign in again with the new password.
- Regression-tested end-to-end in `backend/tests/integration/auth.password.test.ts` (old access token rejected, old refresh token rejected, new session works, re-login requires the new password).

## Password Hashing

**Argon2id via `@node-rs/argon2`** (prebuilt binaries, no native build toolchain required). Parameters (OWASP baseline): `memoryCost=19456` KiB, `timeCost=2`, `parallelism=1`, `hashLength=32`, 16-byte random salt (`backend/src/security/password.ts`).

- Policy: **8–128 characters** (lowered from 12 in Phase 6L, a deliberate product decision — NIST 800-63B's own floor is 8), NFKC-normalized, no composition rules (no forced uppercase/number/symbol, per NIST guidance), checked against a bundled common-password blocklist (`backend/src/security/passwordBlocklist.ts`) — entirely local, no external API call. The blocklist was curated against the old 12-character floor, so it's a weaker filter at 8 than it was; see the scope note at the top of that file.
- Login against an unknown email still runs a real Argon2id verification against a fixed, validly-encoded dummy hash (`verifyDummyPassword`), so response timing does not reveal whether an account exists.
- Passwords, hashes, and tokens are never logged or returned in any API response.

## Email Verification

- `EmailVerificationToken`: 32 random bytes, SHA-256 hash stored (`tokenHash`), **24-hour** expiry, single-use (`consumedAt`).
- **Unverified customers may log in** (verification gates ordering/reviews, not authentication); **unverified staff (any non-customer role) are blocked at login** until verified.
- Verifying an already-verified account is idempotent (handles a double-clicked email link).
- Resending verification is **authenticated-only** (no email parameter, so it can't be used to enumerate accounts) and invalidates the previous outstanding token before issuing a new one.

## Password Reset

- `PasswordResetToken`: 32 random bytes, SHA-256 hash stored, **30-minute** expiry, single-use.
- `forgot-password` **always** returns the identical generic response regardless of whether the account exists; only an existing, usable account gets an email.
- `reset-password` consumes the token, updates the password, revokes all sessions, and — because completing a reset proves mailbox ownership — marks the email verified and promotes `PENDING_VERIFICATION → ACTIVE`. **No auto-login.**

## CAPTCHA — Google reCAPTCHA v3

Provider abstraction: `security/captcha/{captcha.types,recaptcha.provider,turnstile.provider,noop.provider,index}.ts`. Business/route code depends only on the `CaptchaVerifier` interface (`verify(token, remoteIp?, { expectedAction? })`), selected by `CAPTCHA_PROVIDER` (`recaptcha` in production; `noop` in development/test only — `env.ts` refuses to boot with `noop` when `NODE_ENV=production`; tests always force `noop` regardless of `.env`, so the suite never makes a real network call to Google). `turnstile` (Cloudflare) remains selectable as a rollback path — the code is kept, just not the active default.

Unlike Turnstile's visible pass/fail challenge, reCAPTCHA v3 is invisible: the frontend calls `grecaptcha.execute(siteKey, {action})` (`frontend/src/lib/recaptcha.ts`) at submit time — never on page load, never reused — and the backend's `RecaptchaVerifier` additionally checks the returned **action name matches the route's expected action**, the **score** is at or above `RECAPTCHA_MIN_SCORE` (default `0.5`, Google's recommended starting point), and the **hostname** matches this app's own `APP_URL`. None of score/action/hostname is ever trusted from the client — all three come back from Google's own `siteverify` response.

- **Required** (action name in parens): register (`register`), forgot-password (`forgot_password`), reset-password (`reset_password`), contact (`contact`), change-password (`change_password`, authenticated-only, defense-in-depth).
- **Conditional**: login (`login`) requires CAPTCHA verification only after **3 failed attempts** for the same email+IP within 15 minutes (`security/loginAttemptTracker.ts`, in-memory) — the frontend always generates and sends a token on every login attempt regardless, since doing so is invisible and cheap; the server decides whether to actually check it.
- **Never required**: `refresh`, or any ordinary authenticated request.
- `RECAPTCHA_SECRET_KEY` is server-only, never in any response or log. The public site key belongs to the frontend as `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`.
- **Fails closed**: a 2.5s timeout with one retry; on provider unavailability the request is rejected with `CAPTCHA_UNAVAILABLE` (503), never silently allowed through. A genuine verification failure (`success:false`, action mismatch, low score, or hostname mismatch) is distinct from an unavailable provider and is not retried.

## Rate Limiting

`express-rate-limit`, in-memory store — no Redis. Current limits (`backend/src/middleware/rateLimiters.ts`):

| Endpoint | Limit |
|---|---|
| login | 10/15min/IP **and** 5/15min/email |
| register | 5/hour/IP |
| forgot-password | 3/hour/IP **and** 3/hour/email |
| reset-password | 5/hour/IP |
| verify-email | 10/hour/IP |
| resend-verification | 3/hour/authenticated user |
| refresh | 60/15min/IP |
| `/api/v1` default | 300/15min/IP |

429 responses carry `AUTH_RATE_LIMITED` and a `Retry-After` header, worded so they never reveal account existence.

**`trust proxy` is set to an explicit hop count (`TRUST_PROXY_HOPS`, default `0`) — never `true`.** Leaving it unbounded lets a client spoof `X-Forwarded-For` and bypass every IP-keyed limit.

**Known limitation (accepted for MVP):** the store is per-process — N horizontally-scaled instances yield roughly N× the intended limit, and every deploy resets all counters. Before scaling beyond one instance, prefer (in order): Cloudflare edge rate limiting (already in the stack for Turnstile, no new infrastructure), a Postgres-backed counter table, then Redis — which stays explicitly out of scope until then.

## Cookies

No `Domain` attribute on either cookie — both are **host-only**, scoped to whichever origin the API is served from, which is what permits the `__Secure-` prefix (production only; unprefixed in development). See `backend/src/security/cookies.ts`.

| Cookie | Prod name | Dev name | Flags |
|---|---|---|---|
| Access | `__Secure-vz_at` | `vz_at` | HttpOnly, Secure (prod), SameSite=Lax, `Path=/`, ~15min |
| Refresh | `__Secure-vz_rt` | `vz_rt` | HttpOnly, Secure (prod), SameSite=Lax, `Path=/api/v1/auth`, ~30d |

The refresh cookie's restricted path means it is never sent on ordinary API calls, shrinking its exposure.

**Supports both same-parent-domain and unrelated-domain deployments, as a configuration change, not a redesign:**

- Same parent domain (e.g. `app.vizaura.com` + `api.vizaura.com`): `COOKIE_SAMESITE=lax` (default) works as-is; `COOKIE_DOMAIN` may optionally be set to share the cookie across subdomains.
- Unrelated registrable domains (e.g. a Vercel frontend + a Render backend, the current production topology): `COOKIE_SAMESITE=none`, `secure` already follows from `NODE_ENV=production`. `COOKIE_DOMAIN` must stay **unset** — a `Domain` attribute can only extend a cookie across subdomains of the *same* registrable domain, it cannot bridge two unrelated domains, so the cookie stays host-only exactly as in the same-domain case. `env.ts` does not require `COOKIE_DOMAIN` when `COOKIE_SAMESITE=none`.

## CORS

Exact allowlist from `FRONTEND_URL` (never `*`, never origin reflection), `credentials: true`, explicit methods and headers (`Content-Type`, the CSRF header, `Idempotency-Key`). See `src/app/app.ts`.

## CSRF

Cookie-based auth needs CSRF protection independent of `HttpOnly`. When `COOKIE_SAMESITE=lax` (same-parent-domain deployments), `SameSite=Lax` already blocks the cookie on cross-site requests (every mutating route in this API is POST/PATCH/DELETE; `Lax` only exempts top-level GET navigations, and no GET here has a side effect). `backend/src/middleware/csrf.ts` adds two stateless checks on every non-GET/HEAD/OPTIONS request, which apply **regardless of `SameSite`** and so remain the primary CSRF defense when `COOKIE_SAMESITE=none` (unrelated-domain deployments, where `SameSite` provides no CSRF protection on its own):

1. `Origin` (falling back to `Referer`) must match an allowed origin exactly (`env.allowedOrigins`) — the browser sets this header and it cannot be spoofed or omitted by a cross-site `fetch`/form submission.
2. A custom request header (`CSRF_HEADER_NAME`, default `x-requested-with`) must be present — a cross-site form post cannot attach a custom header without triggering a CORS preflight this API will refuse, and this check does not depend on cookies or `SameSite` at all.

No CSRF token store (double-submit or otherwise) is needed because both checks are stateless and already independent of `SameSite` — this is why moving to `COOKIE_SAMESITE=none` for an unrelated-domain deployment is a configuration change, not a new CSRF mechanism. Residual risk is XSS on a sibling subdomain of the same registrable domain — host-only cookies (no `Domain` attribute) are the mitigation for that.

### Local development origin — part of the contract, not a preference

Check 1 is an **exact string match** against `FRONTEND_URL`, and the CORS allowlist in `src/app/app.ts` uses the same single value. The frontend dev server must therefore run on exactly the origin `FRONTEND_URL` names (`http://localhost:3000` by default) — port included, since `Origin` carries the port.

If the frontend comes up on any other port (Next silently falls back to `3001` when `3000` is taken), every non-GET request fails with `403 CSRF_VALIDATION_FAILED` and the browser additionally blocks the response because the preflight returns `Access-Control-Allow-Origin: http://localhost:3000`. GET-only catalog browsing keeps working, so the symptom looks like "login and registration are broken" with no code change — this is exactly the Phase 5B-6 regression.

`frontend/package.json` therefore pins `next dev -p 3000` so a port clash fails loudly at startup instead of silently shifting the origin. Do not "fix" a port clash by changing the frontend's port alone; `FRONTEND_URL` (and `APP_URL`) in `backend/.env` must be changed to match it.

## Security Headers

`helmet` (`backend/src/middleware/securityHeaders.ts`): HSTS in production only (`includeSubDomains`), `nosniff`, `X-Powered-By` disabled, `Referrer-Policy: strict-origin-when-cross-origin`. This API only ever returns JSON, so its CSP is minimal and restrictive: `default-src 'none'; frame-ancestors 'none'`. The storefront's own CSP (inline scripts, images, fonts) is a frontend-phase concern, deliberately not specified here.

- `Cache-Control: no-store` on every response from the auth router (`noStore` middleware) — credentials/PII must never be cached.
- `ETag` is disabled globally (`app.disable("etag")`) for the same reason.
- `express.json({ limit: "100kb" })`; an oversized or malformed body is mapped to a clean `413`/`400` (`PAYLOAD_TOO_LARGE`/`MALFORMED_REQUEST`), never a generic 500.
- Every request gets a `X-Request-Id` (`middleware/requestId.ts`), echoed in error responses (`error.details.requestId` on unexpected 500s) and included in server-side logs.

## XSS Prevention

Structurally a frontend concern (this API is JSON-only, never renders HTML). The backend's obligations are: strict JSON responses (no HTML endpoints), the CSP above, and — when CMS/reviews are implemented — sanitizing rich text on write.

## Input Validation

**zod** at the transport boundary (`backend/src/modules/auth/auth.validators.ts`, `middleware/validate.ts`) — one schema yields both runtime validation and static types. See [API_CONTRACTS.md](API_CONTRACTS.md) for the transport/business/database-constraint layering.

## File Upload Validation (not yet applicable — no upload endpoints exist)

Type/size/content validation on any accepted upload; never trust client-supplied MIME type alone. Applies when product/review media endpoints are built.

## Webhook Verification (implemented — Payments module, Phase 4K)

`POST /api/v1/webhooks/payments/:provider` is mounted directly in `app.ts`, before the JSON body parser/cookieParser/CSRF middleware, using `express.raw()` so the raw body can be HMAC-verified against the provider's signature before anything else trusts it. No `authenticate` middleware applies — the provider signature is the authentication. See [modules/PAYMENTS.md](modules/PAYMENTS.md) and `PaymentWebhookEvent` (`@@unique([provider, eventId])`) in [DATABASE.md](DATABASE.md) for the delivery-dedup mechanism.

## Secret Management

All secrets (`DATABASE_URL`, `JWT_ACCESS_SECRET`, `TURNSTILE_SECRET_KEY`, etc.) are read from environment variables only (`backend/src/config/env.ts`), validated at boot, and never logged, returned in a response, or committed. Production booting fails loudly and specifically (naming the missing/invalid variable) if required secrets are absent — see `env.ts`'s `superRefine` production checks.

## Audit Logging (implemented — Phase 4P)

Sensitive actions across Auth, RBAC, Orders, Payments, Shipping, Returns, and Inventory are recorded to the `AuditLog` table (append-only — no update/delete route exists anywhere for it), readable only via `GET /api/v1/admin/audit-logs` (`audit:read`, super_admin only). See [modules/AUDITLOG.md](modules/AUDITLOG.md) for the schema and full write-wiring table.

## Super_admin Bootstrap

`backend/src/security/adminBootstrap.ts` provisions the first `super_admin` account from `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD`. It runs automatically on every backend startup (`src/server.ts`, awaited before `app.listen`) **and** is callable manually (`npm run db:seed:admin`, `prisma/seed-admin.ts`) — both paths share the same function. It is a no-op whenever those two env vars aren't both set, which is why it's safe to leave wired into every startup rather than only invoked ad hoc. Guards (unchanged from the original manual-only script): refuses to run in production unless `SEED_ALLOW_ADMIN_BOOTSTRAP=true`; never creates a second `super_admin` (checked by role membership, not email); never overwrites an existing user's password; requires the `super_admin` role to already exist (`npm run db:seed` first); validates the password against the normal password policy. Never logs the password. This is unrelated to `prisma/seed.ts`, which never creates any user and is exercised by `tests/integration/seed-guard.test.ts` to assert exactly that.

## Admin Security

Every protected route requires both authentication (`authenticate`) and an explicit permission check (`requirePermission`/`requireAllPermissions`/`requireAnyPermission`) — no route relies on obscurity, and there is no `role === "admin"` check anywhere in the codebase. See [RBAC.md](RBAC.md).

## Frontend Authorization (implemented — Phase 6B)

`GET /auth/me` already returns `roles`/`permissions` (re-derived fresh from the DB on every call, never cached beyond the current session/JWT — a permission change takes effect on the user's next `/auth/me` call, not instantly). The frontend uses this to gate its own UI:

- `frontend/src/lib/authorization.ts` — pure `hasPermission`/`hasAnyPermission`/`hasAllPermissions`/`hasAdminAccess` predicates, `Set`-membership checks mirroring the backend's own `requirePermission` shape. `hasAdminAccess` is a **derived permission-set check** (`permissions.length > 0`), not a role-name check — it relies on the backend's own invariant that `customer` is seeded with `permissions: []` and every staff role has ≥1.
- `frontend/src/lib/constants/permissions.ts` — a typed `PERMISSIONS`/`PermissionKey` map, a literal transcription of `backend/prisma/seed.ts`'s `permissionMatrix`. No permission is invented here; a feature needing a permission that isn't seeded yet is documented as a gap (e.g. the admin nav's Settings item — no `settings:*` resource exists).
- `frontend/src/context/AuthContext.tsx` exposes `can`/`canAny`/`canAll`/`hasAdminAccess` alongside the existing `roles`/`permissions` arrays, for client components.
- `frontend/src/app/admin/layout.tsx` — server-side gate: no session → redirect to `/login`; session but `!hasAdminAccess` → an in-page "Access Restricted" state (no sidebar); otherwise the sidebar renders, with `ADMIN_NAV_LINKS` filtered per-item by `permission` (see `lib/constants/admin-nav.ts`).

**These frontend checks are UX/navigation only.** The backend remains the sole authorization boundary — every admin API call is independently re-checked by `authenticate` + `requirePermission` regardless of what the frontend decided to show. This mirrors the exact same "UX guard, not a security boundary" posture `account/layout.tsx` already used pre-Phase-6B.

**Known Next.js rendering nuance** (relevant to every admin page with real data-fetching): a layout's `children` prop is resolved by Next.js as part of building the route tree, so the child page component's Server Component render function executes even when the layout's own JSX doesn't include `{children}` (verified empirically — a forbidden request to `/admin/dashboard` still executes `dashboard/page.tsx`'s render, though its output never reaches the visible DOM). `dashboard/page.tsx` has no real data fetch, so nothing sensitive is at risk there — but any admin page that fetches real data must not assume the layout's permission gate alone prevents that fetch from running.

**Phase 6D put this into practice for the first time**: every admin Products Server Component page (`/admin/products`, `/admin/products/new`, `/admin/products/[id]`) calls `frontend/src/lib/auth/requireAdminPermission.ts` — which redirects to `/login` (no session) or `/admin/dashboard` (missing permission) — **before** any data fetch, never after. `requireAdminPermission` checks a single `PermissionKey`; action-level gating (showing Save/Create/Delete only when the caller can actually perform it) composes `lib/authorization.ts`'s `hasPermission`/`hasAnyPermission`/`hasAllPermissions` directly, or via the new `AdminPermissionGate` client component for conditional rendering inside a Client Component. As always, this is UX/navigation only — the backend independently re-checks every request's permission via `requirePermission`/`requireAllPermissions`/`requireAnyPermission` regardless of what the frontend decided to show or fetch.

Admin Server Component reads that need the caller's session (not just its existence) forward the incoming request's cookies manually — `frontend/src/lib/api/server-fetch.ts`'s `serverApiFetch`/`serverApiFetchWithMeta`, the same technique `auth-server.ts::getServerSession` already used, generalized for Phase 6D's admin data reads. Same documented limitation: no refresh-on-401 (a Server Component render can't write new `Set-Cookie` headers back onto the response), so an expired access token surfaces as a fetch error rather than a silent retry — acceptable here since the very next navigation re-runs `requireAdminPermission`'s own session check.

**Phase 6E — product delete lifecycle is now backend-enforced, not just UI convention.** `DELETE /products/:id` (`products.service.ts::remove()`) now rejects (`409 CATALOG_PRODUCT_NOT_DELETABLE`) any product whose `status` isn't `DRAFT` — an `ACTIVE` or `ARCHIVED` product can no longer be permanently deleted by any caller, regardless of what the frontend shows. Removing a live product from the catalog goes through Archive (`PATCH status: ARCHIVED`) instead, which is reversible and already hides it from the storefront (which already filters non-`ACTIVE` products). Frontend button visibility (`ProductLifecycleActions.tsx` scoping "Delete Draft" to `status === "DRAFT"`) remains UX-only, same posture as every other admin action — the backend guard above is what actually prevents it.

**Phase 6E — RBAC simplified to two roles.** `super_admin` and `customer` are now the only seeded roles (see [RBAC.md](RBAC.md) for the full rationale and the seed's authoritative-deletion behavior). This changes which permission bundles are pre-seeded, not the authorization mechanism — every check above (permission-driven, re-evaluated per request, no role-name comparisons) is unchanged.

## Error Handling

`backend/src/errors/AppError.ts` + `middleware/errorHandler.ts` map every failure onto the documented envelope. A Prisma unique-constraint violation (`P2002`) becomes a clean `409 CONFLICT`; anything unrecognized becomes a generic `500 INTERNAL_SERVER_ERROR` with a `requestId` for support correlation — never a stack trace, SQL text, Prisma internals, password hash, token, or secret. See [API_CONTRACTS.md](API_CONTRACTS.md) for the full error code list.

## Future Enhancements (not MVP)

- Multi-factor authentication (MFA/TOTP).
- Device/session management UI for end users (the `Session` table already has everything needed — `ipAddress`, `userAgent`, `createdAt` — this is a UI/endpoint gap, not a schema gap).
- Anomaly-based login risk scoring.
- Distributed rate limiting (see Rate Limiting above).
