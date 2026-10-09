import { apiFetch } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import { withAuthRetry } from "@/lib/api/withAuthRetry";
import type {
  AdminCustomerDetail,
  AdminCustomerSummary,
  CreateCustomerInput,
  UpdateCustomerInput,
} from "@/lib/types/admin-customers";
import type { UserStatus } from "@/lib/types/admin-users";

/**
 * Client-safe mutations (and the one client-safe read, searchAdminCustomers)
 * — the Server Component-only reads live in customers-server.ts. Same split
 * pattern as lib/api/admin/users.ts.
 */

/**
 * GET /admin/customers?search=... (customers:read) — used by the Add Order
 * form's customer typeahead (a "use client" component, so it can't pull in
 * customers-server.ts's next/headers-dependent reads). Capped to a handful
 * of matches; the form shows them as pick-one suggestions, not a full list.
 */
export async function searchAdminCustomers(search: string): Promise<AdminCustomerSummary[]> {
  if (!search.trim()) return [];
  const query = new URLSearchParams({ search: search.trim(), limit: "8" }).toString();
  return withAuthRetry(() =>
    apiFetch<AdminCustomerSummary[]>(`${ENDPOINTS.admin.customers}?${query}`, { cache: "no-store" })
  );
}

/** POST /admin/customers (customers:create). Always assigns the customer role — there is no role field to send. */
export async function createCustomer(input: CreateCustomerInput): Promise<{ id: string; email: string }> {
  return withAuthRetry(() =>
    apiFetch<{ id: string; email: string }>(ENDPOINTS.admin.customers, {
      method: "POST",
      body: JSON.stringify(input),
      cache: "no-store",
    })
  );
}

/** PATCH /admin/customers/:id (customers:update). Partial update of identity/address fields — never status/role. */
export async function updateCustomer(id: string, input: UpdateCustomerInput): Promise<AdminCustomerDetail> {
  return withAuthRetry(() =>
    apiFetch<AdminCustomerDetail>(ENDPOINTS.admin.customer(id), {
      method: "PATCH",
      body: JSON.stringify(input),
      cache: "no-store",
    })
  );
}

/**
 * DELETE /admin/customers/:id (customers:delete). Hard-deletes the row if
 * the customer has zero orders; otherwise soft-deletes (sets deletedAt) to
 * preserve order-history attribution.
 */
export async function deleteCustomer(id: string): Promise<{ deleted: boolean; hardDeleted: boolean }> {
  return withAuthRetry(() =>
    apiFetch<{ deleted: boolean; hardDeleted: boolean }>(ENDPOINTS.admin.customer(id), {
      method: "DELETE",
      cache: "no-store",
    })
  );
}

/** PATCH /admin/customers/:id/status (customers:update). Only ACTIVE<->SUSPENDED is a valid target. */
export async function updateCustomerStatus(
  id: string,
  status: Extract<UserStatus, "ACTIVE" | "SUSPENDED">
): Promise<AdminCustomerDetail> {
  return withAuthRetry(() =>
    apiFetch<AdminCustomerDetail>(ENDPOINTS.admin.customerStatus(id), {
      method: "PATCH",
      body: JSON.stringify({ status }),
      cache: "no-store",
    })
  );
}
