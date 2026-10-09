import type { User } from "../../generated/prisma/client.js";
import type { AdminUserDetailRow, AdminUserListRow } from "./users.repository.js";

/// The only fields ever returned to a client. Never includes passwordHash or
/// any token/session field.
export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: string;
  emailVerified: boolean;
  createdAt: string;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    status: user.status,
    emailVerified: user.emailVerifiedAt !== null,
    createdAt: user.createdAt.toISOString(),
  };
}

/// Admin list-row shape (Phase 6J) — role KEY only, never the role's full
/// permission set (see AdminUserListRow's own doc comment). Never includes
/// passwordHash or any token/session field, same posture as PublicUser.
export interface AdminUserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  roleKey: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export function toAdminUserSummary(user: AdminUserListRow): AdminUserSummary {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    roleKey: user.roles[0]?.role.key ?? null,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
  };
}

/// Admin detail shape (Phase 6J). `permissions` is resolved separately by
/// the service via RbacRepository.loadAuthorizationState — the real,
/// currently-effective permission set the role grants, not a static guess.
export interface AdminUserDetail extends AdminUserSummary {
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  countryCode: string | null;
  emailVerified: boolean;
  role: { key: string; name: string } | null;
  permissions: string[];
}

export function toAdminUserDetail(user: AdminUserDetailRow, permissions: string[]): AdminUserDetail {
  const role = user.roles[0]?.role ?? null;
  return {
    ...toAdminUserSummary(user),
    phone: user.phone,
    addressLine1: user.addressLine1,
    addressLine2: user.addressLine2,
    city: user.city,
    region: user.region,
    postalCode: user.postalCode,
    countryCode: user.countryCode,
    emailVerified: user.emailVerifiedAt !== null,
    role: role ? { key: role.key, name: role.name } : null,
    permissions,
  };
}

/// Customers module (Phase 6M) — same underlying User row, a different
/// admin-facing lens. `totalSpent` is an array, never a single number: a
/// customer's spend is never summed across PK/AE currencies.
export interface CustomerOrderStats {
  orderCount: number;
  totalSpent: { currencyCode: string; amount: number }[];
}

export interface AdminCustomerSummary extends AdminUserSummary {
  orderCount: number;
  totalSpent: { currencyCode: string; amount: number }[];
}

export function toAdminCustomerSummary(
  user: AdminUserListRow,
  stats: CustomerOrderStats | undefined,
): AdminCustomerSummary {
  return {
    ...toAdminUserSummary(user),
    orderCount: stats?.orderCount ?? 0,
    totalSpent: stats?.totalSpent ?? [],
  };
}

export interface AdminCustomerDetail extends AdminUserDetail {
  orderCount: number;
  totalSpent: { currencyCode: string; amount: number }[];
}

export function toAdminCustomerDetail(
  user: AdminUserDetailRow,
  permissions: string[],
  stats: CustomerOrderStats | undefined,
): AdminCustomerDetail {
  return {
    ...toAdminUserDetail(user, permissions),
    orderCount: stats?.orderCount ?? 0,
    totalSpent: stats?.totalSpent ?? [],
  };
}
