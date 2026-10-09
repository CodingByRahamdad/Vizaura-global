import { z } from "zod";
import { paginationQuerySchema } from "../catalog/pagination.js";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "../../security/password.js";

// Transport-layer validation only. Business rules (self-modification,
// last-super-admin protection) live in users.service.ts. See docs/modules/USERS.md.

const userStatusValues = ["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED", "DEACTIVATED"] as const;
// Only these two roles exist (docs/RBAC.md) — the enum itself is the
// anti-injection control; no arbitrary role key can ever reach the service.
const roleKeyValues = ["customer", "super_admin"] as const;

export const userIdParamsSchema = z.object({
  id: z.uuid(),
});

export const listAdminUsersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(255).optional(),
  status: z.enum(userStatusValues).optional(),
  role: z.enum(roleKeyValues).optional(),
});

// Customers module (Phase 6M) — same shape as listAdminUsersQuerySchema minus
// `role`: the customer-only scope is hardcoded server-side in the service,
// never a client-suppliable filter (see users.service.ts::listCustomers).
export const listAdminCustomersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(255).optional(),
  status: z.enum(userStatusValues).optional(),
});

// A single standing address, same flat-column shape as User's schema fields
// (mirrors OrderAddress's naming). Every field is independently optional —
// a customer record isn't required to have an address at all — but a
// partial address (e.g. just a city) isn't useful, so the group is
// all-or-nothing when any part of it is given; see the .refine() below on
// each schema that uses it.
const addressFieldsSchema = {
  addressLine1: z.string().trim().min(1).max(255).optional(),
  addressLine2: z.string().trim().max(255).optional(),
  city: z.string().trim().min(1).max(100).optional(),
  region: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
  countryCode: z.string().trim().toUpperCase().length(2).optional(),
};

function hasPartialAddress(body: { addressLine1?: string; city?: string; countryCode?: string }): boolean {
  const required = [body.addressLine1, body.city, body.countryCode];
  const given = required.filter(Boolean).length;
  return given > 0 && given < required.length;
}

// Mirrors auth.validators.ts's registerSchema field-for-field (same identity
// data, same policy) minus captchaToken (a staff action, not a public form)
// and with no `role` field at all — createCustomer always assigns "customer"
// unconditionally, so there is no way to request "super_admin" through this
// body even if a caller added the field by hand.
export const createCustomerBodySchema = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().trim().toLowerCase().pipe(z.email().max(255)),
    password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
    phone: z.string().trim().min(3).max(32).optional(),
    ...addressFieldsSchema,
  })
  .refine((body) => !hasPartialAddress(body), {
    message: "addressLine1, city, and countryCode are required together when providing an address.",
    path: ["addressLine1"],
  });

// Partial update — every field independently optional (a PATCH only sends
// what's changing), same address-group all-or-nothing rule as create.
export const updateCustomerBodySchema = z
  .object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    email: z.string().trim().toLowerCase().pipe(z.email().max(255)).optional(),
    phone: z.string().trim().min(3).max(32).optional(),
    ...addressFieldsSchema,
  })
  .refine((body) => !hasPartialAddress(body), {
    message: "addressLine1, city, and countryCode are required together when providing an address.",
    path: ["addressLine1"],
  });

// Only ACTIVE<->SUSPENDED is a valid target via this endpoint — see
// users.service.ts for why PENDING_VERIFICATION/DEACTIVATED are excluded.
export const updateUserStatusBodySchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

export const updateUserRoleBodySchema = z.object({
  role: z.enum(roleKeyValues),
});

export type UserIdParams = z.infer<typeof userIdParamsSchema>;
export type ListAdminUsersQuery = z.infer<typeof listAdminUsersQuerySchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusBodySchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleBodySchema>;
export type ListAdminCustomersQuery = z.infer<typeof listAdminCustomersQuerySchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerBodySchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerBodySchema>;
