/**
 * Types mirror the backend's admin user-management response shapes verbatim
 * (backend/src/modules/users/users.mapper.ts — AdminUserSummary/
 * AdminUserDetail). Deliberately distinct from PublicUser in lib/types/auth.ts,
 * which models the CALLER's own account (/auth/me), not another user being
 * administered. Never includes passwordHash or any token/session field.
 */

export type UserStatus = "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
export type RoleKey = "customer" | "super_admin";

export interface AdminUserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  roleKey: RoleKey | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminUserDetail extends AdminUserSummary {
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  countryCode: string | null;
  emailVerified: boolean;
  role: { key: RoleKey; name: string } | null;
  permissions: string[];
}

export const USER_STATUS_VALUES: UserStatus[] = ["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED", "DEACTIVATED"];

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  PENDING_VERIFICATION: "Pending verification",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  DEACTIVATED: "Deactivated",
};

export const USER_STATUS_BADGE_VARIANT: Record<UserStatus, "success" | "warning" | "error" | "neutral"> = {
  PENDING_VERIFICATION: "warning",
  ACTIVE: "success",
  SUSPENDED: "error",
  DEACTIVATED: "neutral",
};

export const ROLE_KEY_VALUES: RoleKey[] = ["customer", "super_admin"];

export const ROLE_KEY_LABELS: Record<RoleKey, string> = {
  customer: "Customer",
  super_admin: "Super Admin",
};

export const ADMIN_USERS_ERROR_MESSAGES: Partial<Record<string, string>> = {
  USERS_NOT_FOUND: "That user could not be found.",
  USERS_CANNOT_MODIFY_SELF: "You cannot change your own role or account status.",
  USERS_LAST_SUPER_ADMIN: "This is the last active super_admin — this action would leave the store with no administrators.",
  USERS_INVALID_STATUS_TRANSITION: "That status change isn't allowed from the account's current status.",
  USERS_VALIDATION_ERROR: "Please check the values entered and try again.",
};
