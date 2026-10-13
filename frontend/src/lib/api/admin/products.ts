import { apiFetch, ApiError } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import { withAuthRetry } from "@/lib/api/withAuthRetry";
import type { ApiEnvelope } from "@/lib/types/api";
import type {
  MediaItem,
  ProductBadge,
  ProductDetailResponse,
  ProductSpecification,
  ProductSummaryResponse,
} from "@/lib/types/catalog";

/**
 * Client-safe mutations only (browser fetch + withAuthRetry, no
 * next/headers) — Server Component-only reads live in products-server.ts,
 * split out so a "use client" component (e.g. ProductForm) importing this
 * file never transitively pulls in next/headers.
 */

export type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface CreateProductInput {
  name: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  status?: ProductStatus;
  badge?: ProductBadge | null;
  features?: string[];
  specifications?: ProductSpecification[];
  benefits?: string[];
  ingredients?: string[];
  certifications?: string[];
  storageInstructions?: string;
  shelfLife?: string;
  categoryIds?: string[];
  markets?: { marketCode: string; isAvailable?: boolean; isVisible?: boolean }[];
  defaultVariant?: { sku: string; title: string };
}

export interface UpdateProductInput {
  name?: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  status?: ProductStatus;
  isActive?: boolean;
  badge?: ProductBadge | null;
  features?: string[];
  specifications?: ProductSpecification[];
  benefits?: string[];
  ingredients?: string[];
  certifications?: string[];
  storageInstructions?: string;
  shelfLife?: string;
}

/**
 * GET /products?include=admin&search=...&limit=... (products:read) — used by
 * the Promotion form's product-target typeahead. Reuses the existing
 * batched admin-list contract as-is rather than adding a separate
 * product-search endpoint, same reuse posture as searchAdminInventory.
 */
export async function searchAdminProducts(search: string): Promise<ProductSummaryResponse[]> {
  if (!search.trim()) return [];
  const query = new URLSearchParams({ include: "admin", search: search.trim(), limit: "8" }).toString();
  return withAuthRetry(() => apiFetch<ProductSummaryResponse[]>(`${ENDPOINTS.products.list}?${query}`, { cache: "no-store" }));
}

export async function createProduct(input: CreateProductInput): Promise<ProductDetailResponse> {
  return withAuthRetry(() =>
    apiFetch<ProductDetailResponse>(ENDPOINTS.products.list, {
      method: "POST",
      body: JSON.stringify(input),
      cache: "no-store",
    })
  );
}

export async function updateProduct(id: string, input: UpdateProductInput): Promise<ProductDetailResponse> {
  return withAuthRetry(() =>
    apiFetch<ProductDetailResponse>(ENDPOINTS.products.detail(id), {
      method: "PATCH",
      body: JSON.stringify(input),
      cache: "no-store",
    })
  );
}

/** "Remove from catalog" — reversible, hides from the storefront immediately (see docs/CURRENT_TASK.md). */
export async function archiveProduct(id: string): Promise<ProductDetailResponse> {
  return updateProduct(id, { status: "ARCHIVED" });
}

/** Independent of `status` — toggles whether the product is active without affecting its lifecycle status. */
export async function setProductActive(id: string, isActive: boolean): Promise<ProductDetailResponse> {
  return updateProduct(id, { isActive });
}

/**
 * Hard delete — irreversible. The backend only permits this for a DRAFT
 * product (soft-deleted) or an ARCHIVED product (permanently deleted); an
 * ACTIVE product must be archived first. See products.service.ts::remove.
 */
export async function deleteProduct(id: string): Promise<void> {
  await withAuthRetry(() =>
    apiFetch<Record<string, never>>(ENDPOINTS.products.detail(id), { method: "DELETE", cache: "no-store" })
  );
}

export async function replaceCategories(id: string, categoryIds: string[]): Promise<ProductDetailResponse> {
  return withAuthRetry(() =>
    apiFetch<ProductDetailResponse>(ENDPOINTS.products.categories(id), {
      method: "PUT",
      body: JSON.stringify({ categoryIds }),
      cache: "no-store",
    })
  );
}

export async function upsertMarket(
  id: string,
  marketCode: string,
  data: { isAvailable?: boolean; isVisible?: boolean }
): Promise<ProductDetailResponse> {
  return withAuthRetry(() =>
    apiFetch<ProductDetailResponse>(ENDPOINTS.products.market(id, marketCode), {
      method: "PUT",
      body: JSON.stringify(data),
      cache: "no-store",
    })
  );
}

export interface CreateVariantInput {
  sku: string;
  title: string;
  status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  position?: number;
  isDefault?: boolean;
  optionValueIds?: string[];
}

/** Bare shape the backend actually returns for variant create/update — no nested options/media (see variants.mapper.ts::toVariantResponse). */
export interface VariantResponse {
  id: string;
  productId: string;
  sku: string;
  title: string;
  status: string;
  position: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function createVariant(productId: string, input: CreateVariantInput): Promise<VariantResponse> {
  return withAuthRetry(() =>
    apiFetch<VariantResponse>(ENDPOINTS.products.variants(productId), {
      method: "POST",
      body: JSON.stringify(input),
      cache: "no-store",
    })
  );
}

export async function updateVariant(
  productId: string,
  variantId: string,
  input: Partial<CreateVariantInput>
): Promise<VariantResponse> {
  return withAuthRetry(() =>
    apiFetch<VariantResponse>(ENDPOINTS.products.variant(productId, variantId), {
      method: "PATCH",
      body: JSON.stringify(input),
      cache: "no-store",
    })
  );
}

export async function deleteVariant(productId: string, variantId: string): Promise<void> {
  await withAuthRetry(() =>
    apiFetch<Record<string, never>>(ENDPOINTS.products.variant(productId, variantId), {
      method: "DELETE",
      cache: "no-store",
    })
  );
}

export interface CreateOptionInput {
  name: string;
  position?: number;
  values: string[];
}

/** Bare shapes the backend actually returns — not nested under a product (see variants.mapper.ts). */
export interface OptionValueResponse {
  id: string;
  optionId: string;
  value: string;
  position: number;
}

export interface OptionResponse {
  id: string;
  productId: string;
  name: string;
  position: number;
  values: OptionValueResponse[];
}

export async function createOption(productId: string, input: CreateOptionInput): Promise<OptionResponse> {
  return withAuthRetry(() =>
    apiFetch<OptionResponse>(ENDPOINTS.products.options(productId), {
      method: "POST",
      body: JSON.stringify(input),
      cache: "no-store",
    })
  );
}

export async function updateOption(
  productId: string,
  optionId: string,
  input: { name?: string; position?: number }
): Promise<OptionResponse> {
  return withAuthRetry(() =>
    apiFetch<OptionResponse>(ENDPOINTS.products.option(productId, optionId), {
      method: "PATCH",
      body: JSON.stringify(input),
      cache: "no-store",
    })
  );
}

export async function deleteOption(productId: string, optionId: string): Promise<void> {
  await withAuthRetry(() =>
    apiFetch<Record<string, never>>(ENDPOINTS.products.option(productId, optionId), {
      method: "DELETE",
      cache: "no-store",
    })
  );
}

export async function addOptionValue(
  productId: string,
  optionId: string,
  input: { value: string; position?: number }
): Promise<OptionValueResponse> {
  return withAuthRetry(() =>
    apiFetch<OptionValueResponse>(ENDPOINTS.products.optionValues(productId, optionId), {
      method: "POST",
      body: JSON.stringify(input),
      cache: "no-store",
    })
  );
}

export async function deleteOptionValue(productId: string, optionId: string, valueId: string): Promise<void> {
  await withAuthRetry(() =>
    apiFetch<Record<string, never>>(ENDPOINTS.products.optionValue(productId, optionId, valueId), {
      method: "DELETE",
      cache: "no-store",
    })
  );
}

export interface CreateMediaInput {
  type?: "IMAGE" | "VIDEO";
  url: string;
  altText?: string;
  variantId?: string;
  position?: number;
  isPrimary?: boolean;
}

export async function createMedia(productId: string, input: CreateMediaInput): Promise<ProductDetailResponse> {
  return withAuthRetry(() =>
    apiFetch<ProductDetailResponse>(ENDPOINTS.products.media(productId), {
      method: "POST",
      body: JSON.stringify(input),
      cache: "no-store",
    })
  );
}

export async function updateMedia(
  productId: string,
  mediaId: string,
  input: Partial<CreateMediaInput>
): Promise<ProductDetailResponse> {
  return withAuthRetry(() =>
    apiFetch<ProductDetailResponse>(ENDPOINTS.products.mediaItem(productId, mediaId), {
      method: "PATCH",
      body: JSON.stringify(input),
      cache: "no-store",
    })
  );
}

export async function deleteMedia(productId: string, mediaId: string): Promise<void> {
  await withAuthRetry(() =>
    apiFetch<Record<string, never>>(ENDPOINTS.products.mediaItem(productId, mediaId), {
      method: "DELETE",
      cache: "no-store",
    })
  );
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://vizaura-backend.onrender.com/api/v1";
const CSRF_HEADER_NAME = "x-requested-with";
const CSRF_HEADER_VALUE = "XMLHttpRequest";
const UPLOAD_TIMEOUT_MS = 30000;

/**
 * Multipart upload (Phase 6M) — deliberately bypasses apiFetch, which always
 * forces `Content-Type: application/json`. A FormData body needs the
 * browser to set its own `multipart/form-data; boundary=...` header, so this
 * builds the request by hand (same CSRF header + credentials convention as
 * lib/api.ts) rather than teaching apiFetch a body-type branch just for
 * this one caller. The URL-entry path (createMedia above) is unaffected and
 * remains fully supported alongside this.
 */
export async function uploadProductMedia(
  productId: string,
  file: File,
  options: { altText?: string; isPrimary?: boolean } = {}
): Promise<MediaItem> {
  return withAuthRetry(async () => {
    const form = new FormData();
    form.set("file", file);
    if (options.altText) form.set("altText", options.altText);
    if (options.isPrimary) form.set("isPrimary", "true");

    const res = await fetch(`${API_BASE_URL}${ENDPOINTS.admin.productMediaUpload(productId)}`, {
      method: "POST",
      credentials: "include",
      headers: { [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE },
      body: form,
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });

    const raw = await res.text();
    const body: ApiEnvelope<MediaItem> = raw ? JSON.parse(raw) : { success: res.ok };
    if (!res.ok || body.success === false) {
      throw new ApiError(body?.error?.message ?? "Upload failed", res.status, body?.error?.code, body?.error?.details);
    }
    return body.data as MediaItem;
  });
}
