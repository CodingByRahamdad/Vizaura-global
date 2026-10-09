# AUTH Module

**Purpose:** Authenticate users (customers and staff) and manage their sessions securely.

**Responsibilities:** Registration, login, logout (single + all sessions), refresh-token rotation, email verification (+ resend), password reset, password change, CAPTCHA verification on abuse-prone endpoints.

**Data ownership:** `Session`, `EmailVerificationToken`, `PasswordResetToken`; plus `User.passwordHash` / `User.passwordChangedAt` / `User.emailVerifiedAt` / `User.lastLoginAt` owned jointly with [USERS.md](USERS.md).

**Main entities:** `Session`, `EmailVerificationToken`, `PasswordResetToken`.

**Persistence notes:** Raw refresh/verification/reset tokens are never stored — only SHA-256 hashes. `Session.familyId` groups a rotation chain so token reuse can revoke the whole family. `User.passwordChangedAt` invalidates outstanding access tokens and sessions on password change/reset. Full detail in [AUTH_SECURITY.md](../AUTH_SECURITY.md).

**API boundary:** `/api/v1/auth/*` — see [API_CONTRACTS.md](../API_CONTRACTS.md) for the endpoint table.

**Dependencies:** Users (base identity), RBAC (permission loading on every authenticated request), Notifications (verification/reset emails, currently a console-logging dev provider), CAPTCHA provider abstraction (Cloudflare Turnstile).

**Security considerations:** See [AUTH_SECURITY.md](../AUTH_SECURITY.md) in full — JWT access/refresh via HttpOnly cookies, rotation with reuse detection, password-change/reset session invalidation, Argon2id hashing, Turnstile CAPTCHA (fails closed), rate limiting, CSRF, security headers.

**Current status:** **IMPLEMENTED** (Phase 4D-2, backend). Code: `backend/src/modules/auth/`, `backend/src/security/`, `backend/src/middleware/{authenticate,requireCaptcha,requireVerifiedEmail,rateLimiters,csrf}.ts`. 168 automated tests (unit + integration against a real PostgreSQL instance), including a mandatory regression test proving old sessions/tokens die on password change and reset. Frontend auth UI (login/register/forgot-password/reset-password/verify-email pages, Turnstile widget, `AuthContext`) is also implemented as of Phase 5B-2A — see [MODULE_STATUS.md](../MODULE_STATUS.md) for current frontend status.

**Future notes:** MFA is a future enhancement, not MVP. No admin user is seeded; bootstrapping one is a manual `prisma studio`/SQL step until a user-management admin UI exists. Real email provider integration and admin/support endpoints for session management are deferred.
