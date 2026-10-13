import { apiFetch, ApiError } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import { withAuthRetry } from "@/lib/api/withAuthRetry";
import type { ApiEnvelope } from "@/lib/types/api";
import type { CategoryResponse } from "@/lib/types/catalog";

/**
 * Client-safe mutations only (browser fetch + withAuthRetry, no next/headers)
 * — the Server Component-only reads live in categories.ts. The backend
 * (categories:create/update/delete) is the sole authority on slug
 * uniqueness, parent-cycle prevention and the delete in-use guard.
 */

export interface CreateCategoryInput {
  name: string;
  slug?: string;
  parentId?: string;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
  position?: number;
}

/** null clears description/imageUrl; parentId null moves the category to top level. */
export interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  parentId?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
  position?: number;
}

export async function createCategory(input: CreateCategoryInput): Promise<CategoryResponse> {
  return withAuthRetry(() =>
    apiFetch<CategoryResponse>(ENDPOINTS.categories.list, {
      method: "POST",
      body: JSON.stringify(input),
      cache: "no-store",
    })
  );
}

export async function updateCategory(id: string, input: UpdateCategoryInput): Promise<CategoryResponse> {
  return withAuthRetry(() =>
    apiFetch<CategoryResponse>(ENDPOINTS.categories.detail(id), {
      method: "PATCH",
      body: JSON.stringify(input),
      cache: "no-store",
    })
  );
}

/** Hard delete — the backend refuses (409 CATALOG_CATEGORY_IN_USE) while the category has subcategories or any product links. */
export async function deleteCategory(id: string): Promise<void> {
  await withAuthRetry(() =>
    apiFetch<Record<string, never>>(ENDPOINTS.categories.detail(id), { method: "DELETE", cache: "no-store" })
  );
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://vizaura-backend.onrender.com/api/v1";
const CSRF_HEADER_NAME = "x-requested-with";
const CSRF_HEADER_VALUE = "XMLHttpRequest";
const UPLOAD_TIMEOUT_MS = 30000;

/**
 * Multipart upload — deliberately bypasses apiFetch, which always forces
 * `Content-Type: application/json`. A FormData body needs the browser to set
 * its own `multipart/form-data; boundary=...` header, so this builds the
 * request by hand (same CSRF header + credentials convention as lib/api.ts),
 * mirroring uploadProductMedia in lib/api/admin/products.ts. Returns just the
 * uploaded file's URL — the caller plugs it into imageUrl and saves the
 * category via createCategory/updateCategory as usual.
 */
export async function uploadCategoryImage(file: File): Promise<{ url: string }> {
  return withAuthRetry(async () => {
    const form = new FormData();
    form.set("file", file);

    const res = await fetch(`${API_BASE_URL}${ENDPOINTS.categories.uploadImage}`, {
      method: "POST",
      credentials: "include",
      headers: { [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE },
      body: form,
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });

    const raw = await res.text();
    const body: ApiEnvelope<{ url: string }> = raw ? JSON.parse(raw) : { success: res.ok };
    if (!res.ok || body.success === false) {
      throw new ApiError(body?.error?.message ?? "Upload failed", res.status, body?.error?.code, body?.error?.details);
    }
    return body.data as { url: string };
  });
}
