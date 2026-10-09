/**
 * Mirrors the backend's Customers module response shapes verbatim
 * (backend/src/modules/users/users.mapper.ts — AdminCustomerSummary/
 * AdminCustomerDetail). Same underlying User table as admin-users.ts, a
 * different admin-facing lens hard-scoped to roleKey="customer" server-side
 * — never includes passwordHash or any token/session field.
 */

import type { AdminUserDetail, AdminUserSummary, UserStatus } from "@/lib/types/admin-users";

export interface CustomerMoneyByCurrency {
  currencyCode: string;
  amount: number;
}

export interface AdminCustomerSummary extends AdminUserSummary {
  orderCount: number;
  totalSpent: CustomerMoneyByCurrency[];
}

export interface AdminCustomerDetail extends AdminUserDetail {
  orderCount: number;
  totalSpent: CustomerMoneyByCurrency[];
}

export interface CustomerAddressInput {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  countryCode?: string;
}

export interface CreateCustomerInput extends CustomerAddressInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
}

export interface UpdateCustomerInput extends CustomerAddressInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export const ADMIN_CUSTOMERS_ERROR_MESSAGES: Partial<Record<string, string>> = {
  USERS_NOT_FOUND: "That customer could not be found.",
  USERS_EMAIL_ALREADY_EXISTS: "An account with this email already exists.",
  USERS_CANNOT_MODIFY_SELF: "You cannot modify or delete your own account through this page.",
  USERS_INVALID_STATUS_TRANSITION: "That status change isn't allowed from the account's current status.",
  USERS_VALIDATION_ERROR: "Please check the values entered and try again.",
  AUTH_VALIDATION_ERROR: "Please check the values entered and try again.",
};

export type { UserStatus };
