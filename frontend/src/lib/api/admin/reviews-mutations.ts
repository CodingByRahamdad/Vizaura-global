import { apiFetch } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import { withAuthRetry } from "@/lib/api/withAuthRetry";
import type { AdminReviewResponse } from "@/lib/types/admin-reviews";

/**
 * Client-safe mutations only (browser fetch + withAuthRetry, no next/headers)
 * — the Server Component-only reads live in reviews.ts. Mirrors
 * admin/categories-mutations.ts's split exactly. `source` and
 * `isVerifiedPurchase` are never accepted here — the backend forces
 * source="ADMIN"/isVerifiedPurchase=false on every admin write, and this
 * client never pretends otherwise.
 */
const NO_STORE = { cache: "no-store" as const };

export interface CreateAdminReviewInput {
  productId: string;
  userId?: string;
  rating: number;
  title?: string;
  body: string;
  authorName: string;
  authorLocation?: string;
  avatarUrl?: string;
  isPublished?: boolean;
  isFeatured?: boolean;
}

export interface UpdateAdminReviewInput {
  rating?: number;
  title?: string | null;
  body?: string;
  authorName?: string;
  authorLocation?: string | null;
  avatarUrl?: string | null;
  isPublished?: boolean;
  isFeatured?: boolean;
}

export async function createAdminReview(input: CreateAdminReviewInput): Promise<AdminReviewResponse> {
  return withAuthRetry(() =>
    apiFetch<AdminReviewResponse>(ENDPOINTS.admin.reviews, { method: "POST", body: JSON.stringify(input), ...NO_STORE })
  );
}

export async function updateAdminReview(id: string, input: UpdateAdminReviewInput): Promise<AdminReviewResponse> {
  return withAuthRetry(() =>
    apiFetch<AdminReviewResponse>(ENDPOINTS.admin.review(id), {
      method: "PATCH",
      body: JSON.stringify(input),
      ...NO_STORE,
    })
  );
}

export async function deleteAdminReview(id: string): Promise<void> {
  await withAuthRetry(() =>
    apiFetch<Record<string, never>>(ENDPOINTS.admin.review(id), { method: "DELETE", ...NO_STORE })
  );
}
