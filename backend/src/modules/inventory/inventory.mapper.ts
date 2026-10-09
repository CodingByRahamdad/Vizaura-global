import type { Market, VariantStock } from "../../generated/prisma/client.js";
import type { AdminInventoryRow } from "./inventory.repository.js";

export interface AdminStockResponse {
  id: string;
  variantId: string;
  marketCode: string;
  onHand: number;
  reserved: number;
  available: number;
  createdAt: string;
  updatedAt: string;
}

/// Shown to customers only when stock is low enough to be a genuine
/// "hurry" signal — above this, the exact count stays internal (see
/// toPublicStockResponse's comment).
const LOW_STOCK_THRESHOLD = 10;

export interface PublicStockResponse {
  marketCode: string;
  status: "IN_STOCK" | "OUT_OF_STOCK";
  /// Only populated when in stock AND at/below LOW_STOCK_THRESHOLD — a
  /// narrow, deliberate exception to the "no raw quantities" rule below,
  /// for "Only N left" storefront messaging. Null otherwise, including
  /// whenever stock is ample — the exact count is never revealed then.
  lowStockQuantity: number | null;
}

/// Full record — never returned to an unprivileged caller (see
/// docs/modules/INVENTORY.md's public/admin visibility split). `available`
/// is computed here, never persisted.
export function toAdminStockResponse(stock: VariantStock & { market: Market }): AdminStockResponse {
  return {
    id: stock.id,
    variantId: stock.variantId,
    marketCode: stock.market.code,
    onHand: stock.onHand,
    reserved: stock.reserved,
    available: stock.onHand - stock.reserved,
    createdAt: stock.createdAt.toISOString(),
    updatedAt: stock.updatedAt.toISOString(),
  };
}

/// Storefront-safe shape: an availability state only — no raw quantities,
/// movement history, or reasons (section 20 of the phase brief) — except
/// the narrow low-stock exception on lowStockQuantity above.
export function toPublicStockResponse(stock: VariantStock & { market: Market }): PublicStockResponse {
  const available = stock.onHand - stock.reserved;
  const status = available > 0 ? "IN_STOCK" : "OUT_OF_STOCK";
  return {
    marketCode: stock.market.code,
    status,
    lowStockQuantity: status === "IN_STOCK" && available <= LOW_STOCK_THRESHOLD ? available : null,
  };
}

/// Cross-catalog admin list row (Phase 6E, inventory:read only) — the first
/// Inventory response shape that isn't scoped to one product+variant.
export interface AdminInventoryListResponse {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantId: string;
  sku: string;
  variantTitle: string;
  marketCode: string;
  marketName: string;
  onHand: number;
  reserved: number;
  available: number;
  updatedAt: string;
}

export function toAdminInventoryListResponse(row: AdminInventoryRow): AdminInventoryListResponse {
  return {
    id: row.id,
    productId: row.variant.product.id,
    productName: row.variant.product.name,
    productSlug: row.variant.product.slug,
    variantId: row.variant.id,
    sku: row.variant.sku,
    variantTitle: row.variant.title,
    marketCode: row.market.code,
    marketName: row.market.name,
    onHand: row.onHand,
    reserved: row.reserved,
    available: row.onHand - row.reserved,
    updatedAt: row.updatedAt.toISOString(),
  };
}
