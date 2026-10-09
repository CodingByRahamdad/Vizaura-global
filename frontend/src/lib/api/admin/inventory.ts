import { apiFetch } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import { withAuthRetry } from "@/lib/api/withAuthRetry";
import type { AdminInventoryListResponse, AdminStockResponse } from "@/lib/types/admin-catalog";

/**
 * Client-safe mutation only — the Server Component-only reads
 * (getStockForVariantServer, getAdminInventoryServer) live in
 * inventory-server.ts, split out so a "use client" component (e.g.
 * StockAdjustDialog) importing this file never transitively pulls in
 * next/headers.
 */

export interface AdjustStockInput {
  delta: number;
  reason: string;
}

export interface CreateStockInput {
  marketCode: string;
  onHand?: number;
}

/**
 * Initializes a variant's stock row for a market (one-time; the row must
 * exist before adjustStock can apply a delta to it). Used by the Product
 * page's new "Set stock" control only when no stock row exists yet for
 * that market — otherwise adjustStock (delta-based) is used, same as
 * Inventory admin's own StockAdjustDialog.
 */
export async function createStock(
  productId: string,
  variantId: string,
  input: CreateStockInput
): Promise<AdminStockResponse> {
  return withAuthRetry(() =>
    apiFetch<AdminStockResponse>(ENDPOINTS.products.stockList(productId, variantId), {
      method: "POST",
      body: JSON.stringify(input),
      cache: "no-store",
    })
  );
}

/**
 * The only inventory write action exposed by the admin UI this phase
 * (foundation, not the full system) — reuses the existing, already-atomic,
 * already-audited backend endpoint (`POST .../stock/:marketCode/adjust`,
 * inventory:update). Prefer adjusting onHand via delta+reason over exposing
 * "set available" — available is always derived, never itself writable.
 */
/**
 * GET /admin/inventory?search=...&market=... (inventory:read) — used by the
 * Add Order form's product/variant typeahead (a "use client" component).
 * Reuses the existing cross-catalog inventory list as-is, scoped to the
 * order's chosen market, rather than adding a separate product-search
 * endpoint.
 */
export async function searchAdminInventory(search: string, marketCode: string): Promise<AdminInventoryListResponse[]> {
  if (!search.trim()) return [];
  const query = new URLSearchParams({ search: search.trim(), market: marketCode, limit: "8" }).toString();
  return withAuthRetry(() =>
    apiFetch<AdminInventoryListResponse[]>(`${ENDPOINTS.admin.inventory}?${query}`, { cache: "no-store" })
  );
}

export async function adjustStock(
  productId: string,
  variantId: string,
  marketCode: string,
  input: AdjustStockInput
): Promise<AdminStockResponse> {
  return withAuthRetry(() =>
    apiFetch<AdminStockResponse>(ENDPOINTS.products.stockAdjust(productId, variantId, marketCode), {
      method: "POST",
      body: JSON.stringify(input),
      cache: "no-store",
    })
  );
}
