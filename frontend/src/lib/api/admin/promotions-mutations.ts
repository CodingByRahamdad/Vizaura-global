import { apiFetch, ApiError } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import { withAuthRetry } from "@/lib/api/withAuthRetry";
import type { ApiEnvelope } from "@/lib/types/api";
import type { AdminPromotionResponse, PromotionDisplayLayout, PromotionTargetType } from "@/lib/types/promotions";

/**
 * Client-safe mutations only (browser fetch + withAuthRetry, no next/headers)
 * — the Server Component-only reads live in promotions-server.ts. The
 * backend (promotions:create/update/delete) is the sole authority on target
 * existence and date-range validity.
 */

export interface CreatePromotionInput {
  overline?: string;
  title: string;
  subtitle?: string;
  badgeText?: string;
  discountPercent?: number;
  ctaText?: string;
  ctaLink?: string;
  imageUrl?: string;
  targetType?: PromotionTargetType;
  targetProductId?: string;
  targetCategoryId?: string;
  grid2Overline?: string;
  grid2Title?: string;
  grid2Subtitle?: string;
  grid2BadgeText?: string;
  grid2DiscountPercent?: number;
  grid2CtaText?: string;
  grid2CtaLink?: string;
  grid2ImageUrl?: string;
  grid2TargetType?: PromotionTargetType;
  grid2TargetProductId?: string;
  grid2TargetCategoryId?: string;
  displayLayout?: PromotionDisplayLayout;
  displayOrder?: number;
  isDraft?: boolean;
  startAt?: string;
  endAt?: string;
}

/** null clears an optional field; targetType:null clears both target ids. */
export interface UpdatePromotionInput {
  overline?: string | null;
  title?: string;
  subtitle?: string | null;
  badgeText?: string | null;
  discountPercent?: number | null;
  ctaText?: string;
  ctaLink?: string | null;
  imageUrl?: string | null;
  targetType?: PromotionTargetType | null;
  targetProductId?: string | null;
  targetCategoryId?: string | null;
  grid2Overline?: string | null;
  grid2Title?: string | null;
  grid2Subtitle?: string | null;
  grid2BadgeText?: string | null;
  grid2DiscountPercent?: number | null;
  grid2CtaText?: string | null;
  grid2CtaLink?: string | null;
  grid2ImageUrl?: string | null;
  grid2TargetType?: PromotionTargetType | null;
  grid2TargetProductId?: string | null;
  grid2TargetCategoryId?: string | null;
  displayLayout?: PromotionDisplayLayout;
  displayOrder?: number;
  isDraft?: boolean;
  startAt?: string | null;
  endAt?: string | null;
}

export async function createPromotion(input: CreatePromotionInput): Promise<AdminPromotionResponse> {
  return withAuthRetry(() =>
    apiFetch<AdminPromotionResponse>(ENDPOINTS.admin.promotions, {
      method: "POST",
      body: JSON.stringify(input),
      cache: "no-store",
    })
  );
}

export async function updatePromotion(id: string, input: UpdatePromotionInput): Promise<AdminPromotionResponse> {
  return withAuthRetry(() =>
    apiFetch<AdminPromotionResponse>(ENDPOINTS.admin.promotion(id), {
      method: "PATCH",
      body: JSON.stringify(input),
      cache: "no-store",
    })
  );
}

/** Hard delete. */
export async function deletePromotion(id: string): Promise<void> {
  await withAuthRetry(() =>
    apiFetch<Record<string, never>>(ENDPOINTS.admin.promotion(id), { method: "DELETE", cache: "no-store" })
  );
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://vizaura-backend.onrender.com/api/v1";
const CSRF_HEADER_NAME = "x-requested-with";
const CSRF_HEADER_VALUE = "XMLHttpRequest";
const UPLOAD_TIMEOUT_MS = 30000;

/**
 * Multipart upload — deliberately bypasses apiFetch, which always forces
 * `Content-Type: application/json`. Mirrors uploadCategoryImage in
 * lib/api/admin/categories-mutations.ts exactly. Returns just the uploaded
 * file's URL — the caller plugs it into imageUrl and saves the promotion via
 * createPromotion/updatePromotion as usual.
 */
export async function uploadPromotionImage(file: File): Promise<{ url: string }> {
  return withAuthRetry(async () => {
    const form = new FormData();
    form.set("file", file);

    const res = await fetch(`${API_BASE_URL}${ENDPOINTS.admin.promotionUploadImage}`, {
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
