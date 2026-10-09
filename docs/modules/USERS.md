# USERS Module

**Purpose:** Give a `super_admin` a safe way to see, search, and administer every registered account — role assignment, suspension, and an admin-initiated credential reset. Not a role/permission editor (only two roles exist and neither their keys nor their permission sets are editable through this module). **Phase 6M:** this module is no longer the primary customer-facing admin surface — that's now `/admin/customers` (see `docs/API_CONTRACTS.md` for the endpoint table; no separate module doc was split out, since it's the same `User` table via the same `UsersRepository`, not a new domain — the new `customers:*`-gated routes live in `users.routes.ts`/`users.service.ts` alongside these). `/admin/users` is unlisted from the primary admin navigation and now serves one remaining purpose: role assignment (promoting/demoting `super_admin`), reachable via a link on the Settings page for a caller with `roles:assign`.

**Responsibilities:** Admin user listing (search/status/role filters, paginated), admin user detail (account info + the role's actual currently-effective permissions), role assignment between the two seeded roles, account suspension/reactivation, and an admin-initiated password-reset trigger.

**Main entities:** None owned here. Reads/writes `User` and `UserRole` (both owned by Auth/RBAC's own schema), reads `Role`/`Permission` via `RbacRepository`.

## API boundary

| Method | Path | Auth | Permission | Notes |
|---|---|---|---|---|
| GET | `/admin/users` | `authenticate` | `users:read` | Query: `search?`, `status?`, `role?`, `page?`, `limit?` |
| GET | `/admin/users/:id` | `authenticate` | `users:read` | Includes the role's real inherited permissions |
| PATCH | `/admin/users/:id/status` | `authenticate` | `users:update` | Body `{ status: "ACTIVE" \| "SUSPENDED" }` |
| PATCH | `/admin/users/:id/role` | `authenticate` | `roles:assign` | Body `{ role: "customer" \| "super_admin" }` |
| POST | `/admin/users/:id/reset-password` | `authenticate` | `users:update` | No body; rate-limited per admin |

All five permissions were already seeded (`users:read/create/update/delete`, `roles:create/read/update/delete/assign` — `prisma/seed.ts`'s `permissionMatrix`) and granted only to `super_admin`; no seed change this phase. `users:create`/`users:delete`/`roles:create/read/update/delete` remain unwired — see "Explicit out of scope" below.

## Response shape (allowlisted)

Summary (list rows): `{ id, email, firstName, lastName, status, roleKey, createdAt, lastLoginAt }` — role **key** only, never the role's full permission set (loading every list row's complete permission graph would be pure waste for a list of dozens/hundreds of rows).

Detail: summary fields + `{ phone, emailVerified, role: {key, name} | null, permissions: string[] }`. `permissions` is resolved once, per detail request, via the existing `RbacRepository.loadAuthorizationState(userId)` — the real, currently-effective set the role grants right now, not a static guess from the role's name.

Neither shape ever includes `passwordHash`, session/token data, or reset-token data — proven by an integration test that asserts `passwordHash` is absent from both list and detail responses.

## Role assignment

Only two transitions exist: `customer → super_admin` and `super_admin → customer`. The request body is a two-value zod enum (`"customer" | "super_admin"`) — the enum itself is the anti-injection control; no other string can ever reach the service layer, so an arbitrary/invented role key can never be assigned. Implemented as one transaction (`UsersRepository.replaceRole`: `userRole.deleteMany` + `userRole.create`), since the two roles are mutually exclusive in this system by design (`docs/RBAC.md`).

**Guards, both server-side and unconditional (the frontend hiding a button is never the actual protection):**
- **Self-protection:** `id === actorUserId` → `409 USERS_CANNOT_MODIFY_SELF`, checked before anything else. A super_admin can never demote (or promote — the check is unconditional either direction) their own account through this endpoint.
- **Last-super-admin protection:** demoting a `super_admin` to `customer` calls `RbacService.canRemoveSuperAdmin(targetUserId)` (built in Phase 4D-2, unused until now) — `409 USERS_LAST_SUPER_ADMIN` if the target is the last super_admin assignment in the system.
- Re-assigning the role a user already has is treated as an idempotent no-op (`200`, not an error).

## Account suspension

`UserStatus.SUSPENDED` already existed and was already fully enforced *before* this phase — at login (`AuthService.login`), token refresh (`AuthService.refresh`), and on every single authenticated request (`middleware/authenticate.ts`'s `resolveAuthContext`, which re-reads `User.status` from the database on every call, never trusting the JWT for it). This phase only adds the admin trigger; zero auth-plumbing changes were needed.

Reachable transitions: `ACTIVE → SUSPENDED`, `PENDING_VERIFICATION → SUSPENDED` (e.g. a spam/malicious signup, suspendable before it ever completes email verification), and `SUSPENDED → ACTIVE`. `DEACTIVATED` is never a valid source or target here — no account-deletion/deactivation feature exists anywhere in this codebase, and this phase does not invent one (see "Explicit out of scope"). Any other transition is `422 USERS_INVALID_STATUS_TRANSITION`.

**Guards:**
- **Self-protection:** same `409 USERS_CANNOT_MODIFY_SELF` as role assignment — a super_admin can never suspend their own account through this endpoint.
- **Last-active-super-admin protection:** suspending a `super_admin` calls a new `RbacService.canSuspendUser(targetUserId)` → `RbacRepository.countActiveSuperAdminAssignments(excludingUserId?)`, deliberately scoped to `status NOT IN (SUSPENDED, DEACTIVATED)` rather than `status = ACTIVE` — a `PENDING_VERIFICATION` super_admin still has a fully working session (only `login`/`refresh` treat unverified staff specially; an already-authenticated request does not), so excluding them from the "can still act" count would over-block a scenario that isn't actually a lockout.
- **Immediate effect:** a successful suspend also calls the existing `AuthRepository.revokeAllSessionsForUser(userId, "admin_suspended")` — the user's session is dead on their very next request (`401 AUTH_SESSION_EXPIRED`, since the revoked-session check in `authenticate.ts` runs *before* the `SUSPENDED` status check), not just on their next token refresh.

## Admin-initiated password reset

`POST /admin/users/:id/reset-password` is a thin wrapper (`UsersService.initiatePasswordReset`) around the **already-existing** `AuthService.forgotPassword(email)` — the identical token-generation, hashing, expiry, and email-send flow a self-service "Forgot password?" click triggers. No new token/crypto code was written. The admin never sees, sets, or generates a password; the account holder receives an email and sets their own new password through the existing `resetPassword` flow, completely unchanged. Rate-limited per authenticated admin (`adminResetPasswordLimiter`, 10/hour) so a compromised or malicious admin session can't mass-trigger reset emails.

## Audit logging

Every mutation records an entry via the existing `recordAudit()` helper, the same call pattern every other admin controller uses (`returns.controller.ts`, `payments.controller.ts`, etc.):

| Action | before | after |
|---|---|---|
| `CHANGE_USER_ROLE` | `{ role: previousRoleKey }` | `{ role: newRoleKey }` |
| `SUSPEND_USER` | — | `{ status: "SUSPENDED" }` |
| `REACTIVATE_USER` | — | `{ status: "ACTIVE" }` |
| `ADMIN_INITIATE_PASSWORD_RESET` | — | — (no password/token ever enters an audit row) |

## Deliberate scope decision: no "create user" endpoint

The task considered whether an admin should be able to create a user (and assign `super_admin`) directly from the UI. The smallest-surface answer that fully satisfies the actual need: **a person registers through the existing public registration flow as a `customer` (unchanged, already safe), and a `super_admin` promotes them via the role-assignment endpoint above.** This requires zero new endpoints, no server-generated temporary passwords, no new invite-email flow, and no new attack surface. `POST /admin/users` is therefore not built. The Phase 6I bootstrap script (`npm run db:seed:admin`) remains the only way to create the *very first* super_admin in an empty database; every subsequent one goes through registration + role assignment, both of which are now audited.

## PRD alignment / deviations

The PRD does not specify user-management endpoints in detail beyond implying permission keys like `users:read`/`users:create` exist (see `docs/RBAC.md`'s own notes on the permission matrix predating this phase). This module implements the minimum surface the task actually required — list, detail, role, status, reset — deliberately not `users:create`/`users:delete`/`roles:create/read/update/delete` (no role-editor exists or is invented; only two fixed roles are ever assignable).

## Reused existing infrastructure (nothing reinvented)

`RbacService.canRemoveSuperAdmin` (built Phase 4D-2, first real call site), `RbacRepository.findRoleByKey`, `AuthRepository.revokeAllSessionsForUser`, `AuthService.forgotPassword`, `hashPassword`/`validatePasswordPolicy` (via the reused reset flow, not called directly by this module), `recordAudit`/`requirePermission`/`authenticate` middleware, `paginationQuerySchema`/`toSkipTake`/`toPaginationMeta`, the `limiter()`/`byAuthenticatedUser` rate-limiter factory, `AdminTable`/`AdminSearchInput`/`AdminFilters`/`AdminPagination`/`AdminConfirmDialog`/`AdminFormSection` (frontend).

## Dependencies

Auth (`User`/`Session` schema, `AuthService.forgotPassword`, `AuthRepository.revokeAllSessionsForUser`), RBAC (`Role`/`UserRole`, `RbacRepository`/`RbacService`), Audit (`recordAudit`).

## Explicit out of scope

- **`POST /admin/users`** (admin-authored account creation) — see the scope decision above.
- **A third role, or any role/permission editor** — `roles:create/read/update/delete` remain seeded but unwired; only `roles:assign` (choosing between the two existing roles for one user) is wired.
- **Account deletion or a `DEACTIVATED` lifecycle** — no such feature exists anywhere in this codebase; none is invented here. `DEACTIVATED` is a dead enum value from this module's perspective (present in the schema, unreachable through any endpoint).
- **Bulk actions** (bulk suspend, bulk role change) — one user at a time only.
- **A user activity/audit-trail view on the detail page** — the underlying `AuditLog` table and `audit:read`-gated `GET /admin/audit-logs` list already exist (`docs/modules/AUDITLOG.md`), but this phase does not add an entity-scoped ("show me this user's history") view on top of it.

**Security considerations:** every mutation is permission-gated server-side (`users:update`/`roles:assign`), never inferred from the frontend. Self-modification and last-super-admin removal/suspension are both blocked unconditionally in the service layer — verified by integration tests that call the endpoints directly, not just by hiding the button. Role input is a two-value enum; no arbitrary string reaches the database. No password, token, or session secret is ever returned in a response or written into an audit row.

**Current status:** **COMPLETE for this phase's scope** (Phase 6J) — 5 endpoints, list/detail/role/status/reset-password, self-protection, last-super-admin protection (role removal and suspension both), audit logging on every mutation, `/admin/users` + `/admin/users/[id]` frontend reusing the established admin component library, integration tests covering auth/permission/self-block/last-admin-block/status-transition/sanitization.
