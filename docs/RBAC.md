# RBAC.md

Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) first.

**Status: implemented (Phase 4D-2).** `backend/src/modules/rbac/` and `backend/src/middleware/{authenticate,requirePermission,requireVerifiedEmail}.ts`.

**Phase 6E business decision — only two roles exist for now:** `super_admin` (every currently defined permission) and `customer` (none — ownership-based access only). The 7 operational roles seeded through Phase 6D (`admin`, `store_manager`, `product_manager`, `inventory_manager`, `order_manager`, `marketing_manager`, `customer_support`) were deliberately removed — `backend/prisma/seed.ts::seedRoles()` deletes any `Role` row whose key isn't `super_admin`/`customer`, so the seed is authoritative for role *existence*, not just each kept role's permission set. This is a product-scope decision, not an architecture regression: `permissionMatrix` (the resource:action definitions) is untouched, and every mechanism below — permission-driven authorization, no role-name checks, `isActive`/`isSystem` — is exactly as it was. A future operational role is reintroduced later, deliberately, with only the permissions it actually needs — the sections below that narrate the 7 retired roles' historical permission rationale are kept as an audit trail of *why* those permission boundaries existed, not as a description of the live system.

## Model

Authorization is **permission-driven**. There is no `role === "admin"` (or any role-string equality) check anywhere in this codebase.

- **Permission**: a `resource:action` string (e.g. `products:create`, `orders:read`). Stored with `resource`/`action` split out too, so the future admin UI can group by resource without parsing strings; a `@@unique([resource, action])` constraint keeps the two representations from diverging.
- **Role**: a named bundle of permissions. `isSystem=true` marks roles that must not be deleted or re-keyed (`super_admin`, `customer`). `isActive=false` means the role grants **nothing**, immediately — see below.
- **User**: assigned one or more roles via `UserRole`.

Seeded roles (`backend/prisma/seed.ts`) — **as of Phase 6E, exactly two**: Super Admin (all permissions, the only administrative role for now) and Customer (no permissions — customer authorization is ownership-based, not permission-based). Through Phase 6D this list also included Admin, Store Manager, Product Manager, Inventory Manager, Order Manager, and Marketing Manager, Customer Support — retired per the Phase 6E business decision above; the sections immediately below describe those roles' historical permission rationale and are kept for that context, not as a description of what's currently seeded.

`pricing:read`/`pricing:update` (seeded since Phase 4C) are wired to routes as of Phase 4F (see [modules/PRICING.md](modules/PRICING.md)) — no new permission keys were added; the same `requirePermission`/`optionalAuthenticate` widening pattern Catalog established is reused as-is.

`inventory:read`/`inventory:update` (also seeded since Phase 4C) are wired to routes as of Phase 4G (see [modules/INVENTORY.md](modules/INVENTORY.md)) — likewise no new permission keys.

`shipping:read`/`shipping:update` (also seeded ahead of their owning phase — the same "pre-declare, wire later" posture as Pricing/Inventory above) are wired to routes as of Phase 4M (see [modules/SHIPPING.md](modules/SHIPPING.md)) — likewise no new permission keys or `seed.ts` change.

`returns:read`/`returns:update` are a genuinely **new** permission resource, added to `seed.ts`'s `permissionMatrix` for Phase 4N (see [modules/RETURNS.md](modules/RETURNS.md)) — unlike Shipping's, these were not pre-declared ahead of time (48 → 50 permissions). `admin`/`order_manager` hold both (`order_manager`'s PRD-documented responsibilities literally include "Returns/refunds"); `store_manager`/`customer_support` hold `returns:read` only.

Phase 4O added `PATCH /admin/payments/:id/mark-refunded` (the COD-refund-attestation endpoint closing the gap `RETURNS.md` had flagged) reusing the existing `payments:refund` key — no new permission was seeded. It's gated by `payments:refund` rather than `payments:update` deliberately: `mark-paid`/`mark-failed` settle a still-`PENDING` payment, while `mark-refunded` moves money-equivalent state after capture, warranting the same, stricter permission the provider-calling `refund()` already requires.

`audit:read` (Phase 4P, `GET /admin/audit-logs`, `docs/modules/AUDITLOG.md`) was already pre-seeded ahead of this phase — the same "pre-declare, wire later" posture as Pricing/Inventory/Shipping above — no new permission was seeded either. It is granted **only** via `super_admin`'s `allPermissions: true`; deliberately **not** granted to `admin` (whose own pre-existing `seed.ts` description literally reads "excluding role management and audit," confirming this exclusion predates this phase) or any other role. This makes `audit:read` the single most restrictive permission in this codebase — every other `:read` key is held by at least `admin` and usually `order_manager`/`store_manager` as well.

## Endpoint Authorization Matrix (Phase 4P, Part I)

One row per route group (individual routes are enumerated in [API_CONTRACTS.md](API_CONTRACTS.md)), built directly from every `*.routes.ts` file in `backend/src/modules/`, not from memory.

### Admin/staff routes

| Domain | Auth | Permission | Ownership | Market scope | Unauthorized error |
|---|---|---|---|---|---|
| Catalog (categories/products/variants/options/media) | `authenticate` | `categories:*`/`products:*` | none (global catalog) | none (catalog is market-agnostic; per-market visibility is a separate field) | `403 AUTH_FORBIDDEN` |
| Pricing | `authenticate` | `pricing:update` | none | market-scoped by `marketCode` param | `403 AUTH_FORBIDDEN` |
| Inventory (per-variant reads/writes, nested under `/products`) | `authenticate` | `inventory:update` | none | market-scoped by `marketCode` param | `403 AUTH_FORBIDDEN` |
| Inventory (`GET /admin/inventory`, cross-catalog list, Phase 6E) | `authenticate` | `inventory:read` (401 if unauthenticated, 403 if authenticated without it — no public/storefront widening, unlike Catalog's `include=admin`) | none | none (both markets always returned; `?market=` is a display filter, not an authorization scope) | `401`/`403 AUTH_FORBIDDEN` |
| Orders (admin) | `authenticate` | `orders:read` (list/get), `orders:update`/`orders:cancel` (status) | none — any order reachable | implicit via the order's own `marketId` | `403 AUTH_FORBIDDEN` |
| Payments (refund + admin) | `authenticate` | `payments:refund` (refund, mark-refunded) / `payments:update` (mark-paid, mark-failed) / `payments:read` (list) | none | implicit via parent Order | `403 AUTH_FORBIDDEN` |
| Shipping (methods + shipments, admin) | `authenticate` | `shipping:read` (list/get) / `shipping:update` (mutate) | none | methods scoped by `marketId`; shipments implicit via parent Order | `403 AUTH_FORBIDDEN` |
| Returns (admin) | `authenticate` | `returns:read` (list) / `returns:update` (approve/reject/receive/refund) | none | implicit via parent Order | `403 AUTH_FORBIDDEN` |
| Audit Logs (admin) | `authenticate` | `audit:read` (super_admin only) | none | none (cross-market by design — an audit trail must not be scopable away) | `403 AUTH_FORBIDDEN` |

### Customer-facing / public routes

| Domain | Auth | Verified email | Ownership | Market scope | Unauthorized error |
|---|---|---|---|---|---|
| Auth | none (register/login/refresh) or `authenticate` (logout-all/me/resend-verification/change-password) | not required to browse/authenticate | self only | none | `401 AUTH_UNAUTHORIZED` |
| Catalog browse / Pricing / Inventory reads | `optionalAuthenticate` | no | n/a (public) | market filter is optional query param | n/a (public) |
| Cart | `authenticate` | no | resolved via `req.auth.userId`, no permission path | cart is market-scoped (`?market=`) | `401 AUTH_UNAUTHORIZED` |
| Wishlist | `authenticate` | no | resolved via `req.auth.userId`, no permission path | none — market-independent by design (PRD never scopes Wishlist to a market) | `401 AUTH_UNAUTHORIZED` |
| Checkout | `authenticate` | **yes** (`requireVerifiedEmail`) | resolved via `req.auth.userId` | `?market=` | `401`/`403 AUTH_EMAIL_NOT_VERIFIED` |
| Orders (self-service) | `authenticate` | no | resolved via `req.auth.userId` inside the service | implicit via the order's own `marketId` | `401 AUTH_UNAUTHORIZED`, `404 ORDERS_NOT_FOUND` for another customer's order |
| Payments (self-service `GET /payments/:id`) | `authenticate` | no | `authorizeOwnerOrPermission` via parent Order | implicit | `404 PAYMENTS_NOT_FOUND` for another customer's payment (never `403` — "never distinguish not-yours from doesn't-exist") |
| Shipping (`GET /shipping/methods`, `GET /orders/:orderId/shipment`) | none / `authenticate` | no | `authorizeOwnerOrPermission` via parent Order (shipment read) | methods filtered by `?market=` | `404 SHIPMENT_NOT_FOUND` for another customer's shipment |
| Returns (self-service) | `authenticate` | **yes** on create (`requireVerifiedEmail`) | `authorizeOwnerOrPermission` via parent Order | implicit | `404 RETURNS_NOT_FOUND` for another customer's return |
| Webhook (`POST /webhooks/payments/:provider`) | none (HMAC signature instead) | n/a | n/a | n/a | `400 PAYMENTS_WEBHOOK_SIGNATURE_INVALID` |

**Cross-customer isolation** (customer A cannot reach customer B's cart/wishlist/order/payment/shipment/return) is enforced by ownership resolution against `req.auth.userId` at the service layer for every row above marked "resolved via `req.auth.userId`" or `authorizeOwnerOrPermission` — re-verified against the existing, passing "hides another customer's ..." tests in `orders.test.ts`/`payments.test.ts`/`returns.test.ts`/`cart.test.ts`/`wishlist.test.ts`.

## How a Request Is Authorized

1. **`authenticate`** (`middleware/authenticate.ts`) verifies the access JWT (signature, issuer, audience, expiry), then loads the user and session **fresh from the database** — rejecting a deleted user, a suspended/deactivated user, a revoked or expired session, or a token issued before the last password change. It then loads the caller's current authorization state via `RbacService.getAuthorizationState()` and attaches it as `req.auth = { userId, sessionId, emailVerified, roleKeys, permissions: Set<string> }`.
2. **`RbacRepository.loadAuthorizationState()`** joins `user_roles → roles → role_permissions → permissions` and **filters out roles where `isActive=false`** — deactivating a role takes effect on the very next request, with no caching and no token to wait out.
3. **`requirePermission(...keys)`** / **`requireAllPermissions([...])`** / **`requireAnyPermission([...])`** (`middleware/requirePermission.ts`) run after `authenticate` and do a plain `Set.has()` check against `req.auth.permissions`. A miss returns `403 AUTH_FORBIDDEN` with the required/missing keys in `error.details`.
4. **`requireVerifiedEmail`** (`middleware/requireVerifiedEmail.ts`) gates actions that need a confirmed email (order placement, review submission — not yet built) without blocking login/browsing for unverified customers.

This is all re-evaluated on **every request** — nothing about authorization is cached in the JWT or anywhere else. See [AUTH_SECURITY.md](AUTH_SECURITY.md) for why (immediate revocation).

## Resource-Level / Ownership Authorization

Not middleware — it needs the loaded resource, which middleware doesn't have. `RbacService.authorizeOwnerOrPermission({ resourceOwnerId, requesterId, state, overridePermission })` returns `true` if the requester owns the resource **or** holds the override permission, so e.g. a customer reaches their own order while an Order Manager reaches any order via `orders:read`. Services call this directly. **Wired for the first time in Phase 4J** (`docs/modules/ORDERS.md`) — `GET /orders/:id` and `GET /admin/orders/:id` both call it, using `overridePermission: "orders:read"`.

## System-Role Protection

`RbacService.canRemoveSuperAdmin(userId)` (`rbac.service.ts` + `rbac.repository.ts`) checks whether at least one **other** `super_admin` assignment exists before permitting removal of a given user's — preventing an org from locking itself out. Not yet wired into a route (no role-management endpoints exist yet); the guard exists so that endpoint can be built safely later. `Role.isSystem` further prevents `super_admin`/`customer` from being deleted or re-keyed once role-management endpoints exist.

## Frontend Permission-Aware UI

`GET /auth/me` returns the caller's current `roles` and `permissions` **specifically because it is database-backed, current authorization state** — this is the one place they are returned to a client. The frontend may use them to show/hide UI elements. **This is UX convenience only.** No frontend auth UI exists yet (deferred); when built, every permission/ownership check it reflects is independently re-verified by the backend on every request — the frontend check is never a security boundary.

**Phase 6I:** `analytics:read` (pre-seeded, same "pre-declare, wire later" posture as Pricing/Inventory/Shipping/Audit above) is now wired — `GET /admin/analytics/dashboard`, see [modules/ANALYTICS.md](modules/ANALYTICS.md). No new permission key. `/admin/dashboard`'s own permission check is deliberately **not** `requireAdminPermission` (the shared helper's "missing permission" fallback redirects to `/admin/dashboard` — using it on that same page would loop); it checks `hasPermission` directly and renders an inline "Access Restricted" state instead, the way `admin/layout.tsx`'s own top-level gate already does.

## Dev super_admin bootstrap

`prisma/seed.ts` deliberately creates zero users (see its own header comment, and `tests/integration/seed-guard.test.ts`'s production-seed assertion that `user.count()` is `0`). To get a real `super_admin` session in a fresh dev database without hand-editing it: run `npm run db:seed` once (creates the `super_admin` role), then `npm run db:seed:admin` (`backend/prisma/seed-admin.ts`) with `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD` set in the environment (see `.env.example`). It's a separate script — never wired into `db:seed`, `db:migrate:deploy`, or any install hook — that upserts one user and one `UserRole` row assigning the existing `super_admin` role by key (no new role), hashes the password with the same `hashPassword()` (Argon2id) every real signup uses, and refuses to run at all in `NODE_ENV=production` unless `SEED_ALLOW_ADMIN_BOOTSTRAP=true` is set explicitly — mirroring `src/config/env.ts`'s own fail-closed production-safety pattern. It never logs the password and is safe to re-run (idempotent upsert, never overwrites an existing admin's credentials).

**Phase 6J — this bootstrap script remains the only way to create the very first super_admin in an empty database; every subsequent one is created without it.** `/admin/users`/`/admin/users/[id]` (`docs/modules/USERS.md`) now expose real admin user management: search/filter/paginate every account, view a detail page (account info, assigned role, and the role's actual *inherited* permissions via `RbacRepository.loadAuthorizationState`), change role (`customer`<->`super_admin`), suspend/reactivate, and trigger an admin-initiated password reset. **Deliberate scope decision: there is no "create user" admin endpoint.** A person registers through the existing public flow as a `customer` (unchanged), and a `super_admin` promotes them via the new role endpoint — this needed zero new endpoints, no server-generated passwords, and no new invite-email flow, while still fully answering "can the app create a super_admin through the UI" (yes, in two existing-safe steps).

**`RbacService.canRemoveSuperAdmin(userId)` and the new `RbacService.canSuspendUser(userId)` (`rbac.service.ts`) now have real call sites** — `UsersService.updateRole`/`updateStatus` (`src/modules/users/users.service.ts`) — closing the gap this doc previously noted ("not yet wired into a route"). `canSuspendUser` is backed by a new `RbacRepository.countActiveSuperAdminAssignments(excludingUserId?)`, deliberately scoped to `status NOT IN (SUSPENDED, DEACTIVATED)` rather than `status = ACTIVE` — a `PENDING_VERIFICATION` super_admin still has a fully working authenticated session (see `middleware/authenticate.ts`; only `login`/`refresh` treat unverified *staff* specially, not an already-issued session), so excluding them from the "can still act" count would over-block.

**Self-protection (server-side, unconditional):** a super_admin can never change their own role or suspend their own account through `/admin/users/:id/role` or `/admin/users/:id/status` — both reject with `409 USERS_CANNOT_MODIFY_SELF` before any other check runs. The frontend additionally hides these controls entirely on the caller's own detail page (not merely disables them), but the backend rejection is what actually matters — verified by an integration test that calls the endpoint directly, bypassing the UI. Suspending a user also calls the existing `AuthRepository.revokeAllSessionsForUser(id, "admin_suspended")`, so the session dies immediately (the very next request gets `401 AUTH_SESSION_EXPIRED` from the revoked-session check in `authenticate.ts`, which runs before the `SUSPENDED` status check ever would) rather than only on the user's next token refresh.

**Admin-initiated password reset** (`POST /admin/users/:id/reset-password`, `users:update`) is a five-line wrapper around the existing `AuthService.forgotPassword(email)` — the exact same token-generation/hashing/email flow a self-service "Forgot password?" click triggers. No password is ever generated, seen, or set by the admin. Rate-limited per-admin (`adminResetPasswordLimiter`, `middleware/rateLimiters.ts`) to prevent one compromised/malicious admin account from mass-triggering reset emails.

**Phase 6M — Customers module, and the reversal of the "no admin-create" decision above.** `customers:read`/`customers:update` (pre-seeded, unwired — same posture as Markets/Analytics before their own phases) are now wired to a dedicated `/admin/customers` surface (`docs/API_CONTRACTS.md`) — the same `User` table as `/admin/users`, hard-scoped server-side to `roleKey="customer"` (never a client-suppliable filter), so a super_admin account is unreachable through it (`404`, indistinguishable from a nonexistent id). A genuinely new permission, `customers:create`, was added (additive `seed.ts` change, the same pattern Returns used in Phase 4N) backing `POST /admin/customers` — admin-created customer accounts, explicitly requested by the project owner this phase, reversing Phase 6J's "no create-user endpoint" decision **for customers only**: the request body has no `role` field at all, so this endpoint can never create a `super_admin`, and the original decision's rationale (no server-generated passwords, no new invite flow) still holds — it reuses the exact same `AuthService` account-creation/verification-email path a self-registration does. The primary admin navigation now surfaces "Customers," not "Users & Roles" — role assignment (the one remaining `super_admin`-creation path) stays reachable at `/admin/users`, linked from the Settings page as an internal/secondary capability, not a standalone module.

**Admin Orders/Customers fixes phase — `customers:delete` added** (additive `seed.ts` change, same pattern as `customers:create`). Backs `DELETE /admin/customers/:id`, which is a **soft delete** (`deletedAt`, revoked sessions) — never a real row delete, since `Order.userId`'s `onDelete: Restrict` would block that for any customer with real orders anyway. `customers:update` was also extended to cover a new `PATCH /admin/customers/:id` (field update, including the six new address columns) alongside the existing status-only PATCH. Admin-created customers (`POST /admin/customers`) now create **pre-verified** (`ACTIVE` + `emailVerifiedAt` set, no verification email) instead of going through the same pending-verification flow as a public signup — the project owner's rationale: a staff-created account doesn't need to prove inbox ownership.
