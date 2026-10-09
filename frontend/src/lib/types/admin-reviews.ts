/**
 * Types mirror the backend's actual response shape verbatim
 * (backend/src/modules/reviews/reviews.mapper.ts::toAdminReviewResponse).
 * `source`/`userId`/`isPublished`/`isFeatured`/`updatedAt` are admin-only —
 * never present on the public ReviewResponse (lib/types/reviews.ts).
 */
import type { ReviewResponse } from "@/lib/types/reviews";

export type ReviewSource = "CUSTOMER" | "ADMIN" | "SEED";

export interface AdminReviewResponse extends ReviewResponse {
  userId: string | null;
  source: ReviewSource;
  isPublished: boolean;
  isFeatured: boolean;
  updatedAt: string;
}
