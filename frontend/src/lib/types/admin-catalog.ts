/**
 * Types mirror the backend's actual admin response shapes verbatim
 * (backend/src/modules/catalog/products.mapper.ts, pricing.mapper.ts,
 * inventory.mapper.ts). Never returned to an unprivileged caller — only
 * fetched from admin pages already gated by requireAdminPermission. Do not
 * add fields the backend doesn't return.
 */
import type { CategoryResponse, ProductSummaryResponse } from "@/lib/types/catalog";

/**
 * GET /categories?include=admin&includeInactive=true (categories:read).
 * productCount counts EVERY product link (draft/archived/soft-deleted too) —
 * exactly what the backend's delete guard checks — unlike the public
 * include=count, which counts only ACTIVE, visible products.
 */
export interface AdminCategoryResponse extends CategoryResponse {
  productCount: number;
  childCount: number;
}

export interface AdminPriceResponse {
  id: string;
  variantId: string;
  marketCode: string;
  currencyCode: string;
  amount: number;
  saleAmount: number | null;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

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

export interface ProductAdminMarketRow {
  code: string;
  name: string;
  isAvailable: boolean;
  isVisible: boolean;
  price: AdminPriceResponse | null;
  stock: AdminStockResponse | null;
}

/** GET /products?include=admin (products:read only) — one row per product. */
export interface ProductAdminListResponse extends ProductSummaryResponse {
  imageUrl: string | null;
  variantCount: number;
  categories: { id: string; name: string }[];
  markets: ProductAdminMarketRow[];
}

/** GET /admin/inventory (inventory:read only) — one row per (variant, market). */
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
