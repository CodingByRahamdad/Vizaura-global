import { z } from "zod";
import { paginationQuerySchema } from "../catalog/pagination.js";

// Transport-layer validation only (shape, type, length, format). Business
// rules (target existence, cross-field consistency) live in
// promotions.service.ts. See docs/modules/PROMOTIONS.md.

const targetType = z.enum(["PRODUCT", "CATEGORY"]);
const displayLayout = z.enum(["SINGLE", "GRID"]);

const overline = z.string().trim().max(100).optional();
const title = z.string().trim().min(1).max(200);
const subtitle = z.string().trim().max(500).optional();
const badgeText = z.string().trim().max(50).optional();
const discountPercent = z.coerce.number().int().min(0).max(100).optional();
const ctaText = z.string().trim().min(1).max(50).optional();
const ctaLink = z.string().trim().max(2048).optional();
const imageUrl = z.url().max(2048).optional();
const displayOrder = z.coerce.number().int().min(0).optional();
const startAt = z.coerce.date().optional();
const endAt = z.coerce.date().optional();

// Grid 2 — same shapes as their grid-1 counterparts above (title required
// for grid-1 since every promotion needs one; optional here since an
// unconfigured Grid 2 is the normal, graceful case — see
// promotions.mapper.ts#toPublicPromotionResponse).
const grid2Overline = z.string().trim().max(100).optional();
const grid2Title = z.string().trim().max(200).optional();
const grid2Subtitle = z.string().trim().max(500).optional();
const grid2BadgeText = z.string().trim().max(50).optional();
const grid2DiscountPercent = z.coerce.number().int().min(0).max(100).optional();
const grid2CtaText = z.string().trim().min(1).max(50).optional();
const grid2CtaLink = z.string().trim().max(2048).optional();
const grid2ImageUrl = z.url().max(2048).optional();

/// Shared by both the primary target and the grid-2 target — exactly one of
/// productId/categoryId must be set when a type is given, and neither when
/// it isn't.
function targetFieldsConsistent(
  type: "PRODUCT" | "CATEGORY" | null | undefined,
  productId: string | null | undefined,
  categoryId: string | null | undefined,
): boolean {
  if (type === "PRODUCT") return !!productId && !categoryId;
  if (type === "CATEGORY") return !!categoryId && !productId;
  return !productId && !categoryId;
}

export const createPromotionSchema = z
  .object({
    overline,
    title,
    subtitle,
    badgeText,
    discountPercent,
    ctaText,
    ctaLink,
    imageUrl,
    targetType: targetType.optional(),
    targetProductId: z.uuid().optional(),
    targetCategoryId: z.uuid().optional(),
    grid2Overline,
    grid2Title,
    grid2Subtitle,
    grid2BadgeText,
    grid2DiscountPercent,
    grid2CtaText,
    grid2CtaLink,
    grid2ImageUrl,
    grid2TargetType: targetType.optional(),
    grid2TargetProductId: z.uuid().optional(),
    grid2TargetCategoryId: z.uuid().optional(),
    displayLayout: displayLayout.optional(),
    displayOrder,
    isDraft: z.boolean().optional(),
    startAt,
    endAt,
  })
  .refine((data) => targetFieldsConsistent(data.targetType, data.targetProductId, data.targetCategoryId), {
    message: "targetProductId/targetCategoryId must match targetType.",
    path: ["targetType"],
  })
  .refine(
    (data) => targetFieldsConsistent(data.grid2TargetType, data.grid2TargetProductId, data.grid2TargetCategoryId),
    { message: "grid2TargetProductId/grid2TargetCategoryId must match grid2TargetType.", path: ["grid2TargetType"] },
  )
  .refine((data) => !data.startAt || !data.endAt || data.startAt < data.endAt, {
    message: "startAt must be before endAt.",
    path: ["endAt"],
  });

export const updatePromotionSchema = z
  .object({
    overline: overline.nullable(),
    title: title.optional(),
    // null clears an optional field (an admin must be able to remove a
    // subtitle/badge/image, not just replace it) — mirrors
    // categories.validators.ts's updateCategorySchema exactly.
    subtitle: subtitle.nullable(),
    badgeText: badgeText.nullable(),
    discountPercent: discountPercent.nullable(),
    ctaText,
    ctaLink: ctaLink.nullable(),
    imageUrl: imageUrl.nullable(),
    targetType: targetType.nullable().optional(),
    targetProductId: z.uuid().nullable().optional(),
    targetCategoryId: z.uuid().nullable().optional(),
    grid2Overline: grid2Overline.nullable(),
    grid2Title: grid2Title.nullable(),
    grid2Subtitle: grid2Subtitle.nullable(),
    grid2BadgeText: grid2BadgeText.nullable(),
    grid2DiscountPercent: grid2DiscountPercent.nullable(),
    grid2CtaText: grid2CtaText.nullable(),
    grid2CtaLink: grid2CtaLink.nullable(),
    grid2ImageUrl: grid2ImageUrl.nullable(),
    grid2TargetType: targetType.nullable().optional(),
    grid2TargetProductId: z.uuid().nullable().optional(),
    grid2TargetCategoryId: z.uuid().nullable().optional(),
    displayLayout: displayLayout.optional(),
    displayOrder,
    isDraft: z.boolean().optional(),
    startAt: startAt.nullable(),
    endAt: endAt.nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided." })
  .refine(
    (data) => {
      // Only validated when the caller is actually changing the target this
      // request — a partial update that touches neither field is always
      // fine, consistency with whatever the row already has is the
      // service's job (it re-reads the existing row first).
      if (data.targetType === undefined && data.targetProductId === undefined && data.targetCategoryId === undefined) {
        return true;
      }
      return targetFieldsConsistent(data.targetType, data.targetProductId, data.targetCategoryId);
    },
    { message: "targetProductId/targetCategoryId must match targetType.", path: ["targetType"] },
  )
  .refine(
    (data) => {
      if (
        data.grid2TargetType === undefined &&
        data.grid2TargetProductId === undefined &&
        data.grid2TargetCategoryId === undefined
      ) {
        return true;
      }
      return targetFieldsConsistent(data.grid2TargetType, data.grid2TargetProductId, data.grid2TargetCategoryId);
    },
    { message: "grid2TargetProductId/grid2TargetCategoryId must match grid2TargetType.", path: ["grid2TargetType"] },
  )
  .refine((data) => !data.startAt || !data.endAt || data.startAt < data.endAt, {
    message: "startAt must be before endAt.",
    path: ["endAt"],
  });

export const promotionIdParamsSchema = z.object({
  id: z.uuid(),
});

export const listAdminPromotionsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["draft", "scheduled", "active", "expired"]).optional(),
  displayLayout: displayLayout.optional(),
});

// Minimal admin-triggered broadcast — one CustomerNotification per customer.
// Field widths match CustomerNotification.title/message column widths.
export const broadcastPromotionSchema = z.object({
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(500),
});

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>;
export type PromotionIdParams = z.infer<typeof promotionIdParamsSchema>;
export type ListAdminPromotionsQuery = z.infer<typeof listAdminPromotionsQuerySchema>;
export type BroadcastPromotionInput = z.infer<typeof broadcastPromotionSchema>;
