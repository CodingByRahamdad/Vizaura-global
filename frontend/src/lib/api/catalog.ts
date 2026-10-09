import { apiFetch, apiFetchWithMeta } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import { DEFAULT_MARKET_CODE } from "@/lib/constants/market";
import type {
  CategoryResponse,
  PaginationMeta,
  ProductCardResponse,
  ProductDetailResponse,
  ProductSummaryResponse,
  PublicPriceResponse,
  PublicStockResponse,
} from "@/lib/types/catalog";

/**
 * Catalog content (categories/products) tolerates brief staleness; price and
 * stock must never be served stale, so they use cache: "no-store" instead.
 */
const CATALOG_REVALIDATE_SECONDS = 60;

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function getCategories(): Promise<CategoryResponse[]> {
  return apiFetch<CategoryResponse[]>(ENDPOINTS.categories.list, {
    next: { revalidate: CATALOG_REVALIDATE_SECONDS },
  });
}

export async function getCategoryById(id: string): Promise<CategoryResponse> {
  return apiFetch<CategoryResponse>(ENDPOINTS.categories.detail(id), {
    next: { revalidate: CATALOG_REVALIDATE_SECONDS },
  });
}

export interface CategoryWithCount extends CategoryResponse {
  productCount: number;
}

/**
 * One batched request (GET /categories?include=count&market=...) instead of
 * a limit:1 products query per category — the backend resolves every
 * category's real product count via a single groupBy.
 */
export async function getCategoriesWithCounts(
  marketCode: string = DEFAULT_MARKET_CODE
): Promise<CategoryWithCount[]> {
  const query = buildQuery({ include: "count", market: marketCode });
  return apiFetch<CategoryWithCount[]>(`${ENDPOINTS.categories.list}${query}`, {
    next: { revalidate: CATALOG_REVALIDATE_SECONDS },
  });
}

interface GetProductsParams {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  market?: string;
  badge?: string;
}

export async function getProducts(
  params: GetProductsParams = {}
): Promise<{ items: ProductSummaryResponse[]; pagination: PaginationMeta }> {
  const query = buildQuery({
    page: params.page,
    limit: params.limit,
    category: params.category,
    search: params.search,
    market: params.market ?? DEFAULT_MARKET_CODE,
    badge: params.badge,
  });

  const { data, meta } = await apiFetchWithMeta<ProductSummaryResponse[]>(
    `${ENDPOINTS.products.list}${query}`,
    { next: { revalidate: CATALOG_REVALIDATE_SECONDS } }
  );

  return {
    items: data,
    pagination: meta.pagination as PaginationMeta,
  };
}

/**
 * Card-ready data for a listing page — GET /products?include=card. The
 * backend resolves market-scoped price/stock/rating/image for the whole
 * page in a fixed, small number of batched queries, replacing the former
 * per-product detail+price+rating+stock fetches (getProductCardData /
 * getProductCardsForList, removed).
 */
export async function getProductCards(
  params: GetProductsParams = {},
  init?: RequestInit
): Promise<{ items: ProductCardResponse[]; pagination: PaginationMeta }> {
  const query = buildQuery({
    page: params.page,
    limit: params.limit,
    category: params.category,
    search: params.search,
    market: params.market ?? DEFAULT_MARKET_CODE,
    badge: params.badge,
    include: "card",
  });

  const { data, meta } = await apiFetchWithMeta<ProductCardResponse[]>(
    `${ENDPOINTS.products.list}${query}`,
    { next: { revalidate: CATALOG_REVALIDATE_SECONDS }, ...init }
  );

  return {
    items: data,
    pagination: meta.pagination as PaginationMeta,
  };
}

export async function getProductBySlug(slug: string): Promise<ProductDetailResponse> {
  return apiFetch<ProductDetailResponse>(ENDPOINTS.products.detailBySlug(slug), {
    next: { revalidate: CATALOG_REVALIDATE_SECONDS },
  });
}

// These two calls back the public Product Detail Page's variant switcher.
// GET .../prices/:marketCode and .../stock/:marketCode intentionally widen
// to the full admin shape for any caller holding pricing:read/inventory:read
// (see docs/modules/PRICING.md, docs/modules/INVENTORY.md) — correct for the
// admin UI, but wrong here: a logged-in admin browsing the storefront would
// otherwise get the raw amount/no isOnSale/no status shape on a public page
// that only ever expects the public shape. `credentials: "omit"` keeps this
// storefront read anonymous so it always gets the public response,
// regardless of the viewer's own session.
export async function getVariantPrice(
  productId: string,
  variantId: string,
  marketCode: string = DEFAULT_MARKET_CODE
): Promise<PublicPriceResponse> {
  return apiFetch<PublicPriceResponse>(
    ENDPOINTS.products.price(productId, variantId, marketCode),
    { cache: "no-store", credentials: "omit" }
  );
}

export async function getVariantStock(
  productId: string,
  variantId: string,
  marketCode: string = DEFAULT_MARKET_CODE
): Promise<PublicStockResponse> {
  return apiFetch<PublicStockResponse>(
    ENDPOINTS.products.stock(productId, variantId, marketCode),
    { cache: "no-store", credentials: "omit" }
  );
}

export interface NormalizedProductCard {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  imageUrl: string | null;
  priceLabel: string | null;
  /** Raw minor-unit amount backing priceLabel — for numeric sort/filter (e.g. Shop's price-range slider). */
  priceAmount: number | null;
  compareAtPriceLabel: string | null;
  isOnSale: boolean;
  discountPercent: number | null;
  defaultVariantId: string | null;
  rating: number | null;
  reviewCount: number;
  /** Real per-variant stock in the default market; null if unknown (no price/stock resolved for this card). */
  inStock: boolean | null;
}

/**
 * Formats a backend price amount (integer minor units, e.g. cents) using
 * Intl.NumberFormat. The /100 divisor assumes a 2-decimal-digit currency —
 * both current markets (PKR, AED) use one — this is not generalized further
 * since the backend doesn't expose a currency exponent.
 */
export function formatPrice(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode,
  }).format(amount / 100);
}

/**
 * Presentation-derived shape built from a backend ProductCardResponse (a
 * true backend-mirrored type, in lib/types/catalog.ts). Not itself backend-
 * mirrored — it formats/labels the raw response for direct rendering by
 * ProductCard — so it's co-located here with its only producer rather than
 * in lib/types/catalog.ts.
 */
export function toNormalizedCard(card: ProductCardResponse): NormalizedProductCard {
  return {
    id: card.id,
    slug: card.slug,
    name: card.name,
    shortDescription: card.shortDescription,
    imageUrl: card.imageUrl,
    priceLabel: card.price ? formatPrice(card.price.amount, card.price.currencyCode) : null,
    priceAmount: card.price?.amount ?? null,
    compareAtPriceLabel: card.price?.compareAtAmount
      ? formatPrice(card.price.compareAtAmount, card.price.currencyCode)
      : null,
    isOnSale: card.price?.isOnSale ?? false,
    discountPercent: card.price?.compareAtAmount
      ? Math.round(((card.price.compareAtAmount - card.price.amount) / card.price.compareAtAmount) * 100)
      : null,
    defaultVariantId: card.defaultVariantId,
    rating: card.rating,
    reviewCount: card.reviewCount,
    inStock: card.stock ? card.stock.status === "IN_STOCK" : null,
  };
}
