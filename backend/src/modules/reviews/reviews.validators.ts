import { z } from "zod";
import { paginationQuerySchema } from "../catalog/pagination.js";

// Transport-layer validation only. Business rules (product visibility,
// review ownership, verified-purchase computation) live in
// reviews.service.ts. See docs/modules/REVIEWS.md.

const reviewSourceValues = ["CUSTOMER", "ADMIN", "SEED"] as const;

export const productReviewParamsSchema = z.object({
  productId: z.uuid(),
});

export const reviewIdParamsSchema = z.object({
  id: z.uuid(),
});

export const featuredReviewsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

// Customer self-service submission (upserted on productId+userId — see
// ReviewsService.submit). captchaToken is required here and verified by
// requireCaptcha; it never reaches the service/repository layer.
export const createReviewBodySchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(150).optional(),
  body: z.string().trim().min(10).max(2000),
  captchaToken: z.string().min(1),
});

// Customer self-service edit of their own review. No source/isVerifiedPurchase —
// those are system-owned and never client-editable.
export const updateReviewBodySchema = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  title: z.string().trim().max(150).nullable().optional(),
  body: z.string().trim().min(10).max(2000).optional(),
});

// Public sitewide "All Reviews" listing — plain pagination, no moderation
// filters (those are admin-only; see listAdminReviewsQuerySchema below).
export const listPublicReviewsQuerySchema = paginationQuerySchema;

export const listAdminReviewsQuerySchema = paginationQuerySchema.extend({
  productId: z.uuid().optional(),
  status: z.enum(["published", "unpublished"]).optional(),
  source: z.enum(reviewSourceValues).optional(),
  featured: z.coerce.boolean().optional(),
});

// Admin-authored review. userId is optional — when omitted, the review has
// no backing account (e.g. a quoted testimonial); author fields are always
// required since there's no User row to fall back on. source is always
// forced to "ADMIN" and isVerifiedPurchase to false server-side — neither
// is accepted here.
export const adminCreateReviewBodySchema = z.object({
  productId: z.uuid(),
  userId: z.uuid().optional(),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(150).optional(),
  body: z.string().trim().min(1).max(2000),
  authorName: z.string().trim().min(1).max(150),
  authorLocation: z.string().trim().max(120).optional(),
  avatarUrl: z.url().max(2048).optional(),
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

export const adminUpdateReviewBodySchema = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  title: z.string().trim().max(150).nullable().optional(),
  body: z.string().trim().min(1).max(2000).optional(),
  authorName: z.string().trim().min(1).max(150).optional(),
  authorLocation: z.string().trim().max(120).nullable().optional(),
  avatarUrl: z.url().max(2048).nullable().optional(),
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

export type ProductReviewParams = z.infer<typeof productReviewParamsSchema>;
export type ReviewIdParams = z.infer<typeof reviewIdParamsSchema>;
export type FeaturedReviewsQuery = z.infer<typeof featuredReviewsQuerySchema>;
export type CreateReviewInput = z.infer<typeof createReviewBodySchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewBodySchema>;
export type ListPublicReviewsQuery = z.infer<typeof listPublicReviewsQuerySchema>;
export type ListAdminReviewsQuery = z.infer<typeof listAdminReviewsQuerySchema>;
export type AdminCreateReviewInput = z.infer<typeof adminCreateReviewBodySchema>;
export type AdminUpdateReviewInput = z.infer<typeof adminUpdateReviewBodySchema>;
