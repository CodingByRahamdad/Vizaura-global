import { apiFetch } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import { withAuthRetry } from "@/lib/api/withAuthRetry";
import type { AdminSearchResults } from "@/lib/types/admin-search";

/** GET /admin/search?q=... — results are already filtered server-side by the caller's own permissions. */
export async function searchAdmin(q: string): Promise<AdminSearchResults> {
  const query = new URLSearchParams({ q }).toString();
  return withAuthRetry(() =>
    apiFetch<AdminSearchResults>(`${ENDPOINTS.admin.search}?${query}`, { cache: "no-store" })
  );
}
