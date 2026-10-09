import { apiFetch } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import { withAuthRetry } from "@/lib/api/withAuthRetry";
import type { AdminUserDetail, RoleKey, UserStatus } from "@/lib/types/admin-users";

/**
 * Client-safe mutations only — the Server Component-only reads live in
 * users-server.ts (next/headers can't be pulled into a Client Component).
 */

/**
 * PATCH /admin/users/:id/status (users:update). Only ACTIVE<->SUSPENDED is a
 * valid target — the backend rejects anything else with
 * 422 USERS_INVALID_STATUS_TRANSITION. Self-modification and suspending the
 * last active super_admin are both rejected with 409, server-side.
 */
export async function updateUserStatus(id: string, status: Extract<UserStatus, "ACTIVE" | "SUSPENDED">): Promise<AdminUserDetail> {
  return withAuthRetry(() =>
    apiFetch<AdminUserDetail>(ENDPOINTS.admin.userStatus(id), {
      method: "PATCH",
      body: JSON.stringify({ status }),
      cache: "no-store",
    })
  );
}

/**
 * PATCH /admin/users/:id/role (roles:assign). Role is one of exactly the two
 * seeded roles; self-modification and demoting the last super_admin are both
 * rejected with 409, server-side.
 */
export async function updateUserRole(id: string, role: RoleKey): Promise<AdminUserDetail> {
  return withAuthRetry(() =>
    apiFetch<AdminUserDetail>(ENDPOINTS.admin.userRole(id), {
      method: "PATCH",
      body: JSON.stringify({ role }),
      cache: "no-store",
    })
  );
}

/**
 * POST /admin/users/:id/reset-password (users:update). Triggers the same
 * password-reset email flow a self-service "Forgot password?" click would —
 * no password is ever generated, seen, or set by the admin.
 */
export async function initiateUserPasswordReset(id: string): Promise<{ initiated: boolean }> {
  return withAuthRetry(() =>
    apiFetch<{ initiated: boolean }>(ENDPOINTS.admin.userResetPassword(id), {
      method: "POST",
      cache: "no-store",
    })
  );
}
