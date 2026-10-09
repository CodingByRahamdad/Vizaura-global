import type { PromotionWithTargetNames } from "./promotions.repository.js";

export type PromotionStatus = "DRAFT" | "SCHEDULED" | "ACTIVE" | "EXPIRED";

/// Deliberately computed, never stored — see schema.prisma's Promotion
/// doc-comment. isDraft always wins (an admin still editing a promotion
/// never sees it reported as Scheduled/Active/Expired regardless of dates).
export function computeStatus(promotion: PromotionWithTargetNames, now: Date = new Date()): PromotionStatus {
  if (promotion.isDraft) return "DRAFT";
  if (promotion.endAt && promotion.endAt <= now) return "EXPIRED";
  if (promotion.startAt && promotion.startAt > now) return "SCHEDULED";
  return "ACTIVE";
}

export interface AdminPromotionResponse {
  id: string;
  overline: string | null;
  title: string;
  subtitle: string | null;
  badgeText: string | null;
  discountPercent: number | null;
  ctaText: string;
  ctaLink: string | null;
  imageUrl: string | null;
  targetType: string | null;
  targetProductId: string | null;
  targetProductName: string | null;
  targetCategoryId: string | null;
  targetCategoryName: string | null;
  grid2Overline: string | null;
  grid2Title: string | null;
  grid2Subtitle: string | null;
  grid2BadgeText: string | null;
  grid2DiscountPercent: number | null;
  grid2CtaText: string | null;
  grid2CtaLink: string | null;
  grid2ImageUrl: string | null;
  grid2TargetType: string | null;
  grid2TargetProductId: string | null;
  grid2TargetProductName: string | null;
  grid2TargetCategoryId: string | null;
  grid2TargetCategoryName: string | null;
  displayLayout: string;
  displayOrder: number;
  isDraft: boolean;
  startAt: string | null;
  endAt: string | null;
  status: PromotionStatus;
  createdAt: string;
  updatedAt: string;
}

export function toAdminPromotionResponse(promotion: PromotionWithTargetNames): AdminPromotionResponse {
  return {
    id: promotion.id,
    overline: promotion.overline,
    title: promotion.title,
    subtitle: promotion.subtitle,
    badgeText: promotion.badgeText,
    discountPercent: promotion.discountPercent,
    ctaText: promotion.ctaText,
    ctaLink: promotion.ctaLink,
    imageUrl: promotion.imageUrl,
    targetType: promotion.targetType,
    targetProductId: promotion.targetProductId,
    targetProductName: promotion.targetProduct?.name ?? null,
    targetCategoryId: promotion.targetCategoryId,
    targetCategoryName: promotion.targetCategory?.name ?? null,
    grid2Overline: promotion.grid2Overline,
    grid2Title: promotion.grid2Title,
    grid2Subtitle: promotion.grid2Subtitle,
    grid2BadgeText: promotion.grid2BadgeText,
    grid2DiscountPercent: promotion.grid2DiscountPercent,
    grid2CtaText: promotion.grid2CtaText,
    grid2CtaLink: promotion.grid2CtaLink,
    grid2ImageUrl: promotion.grid2ImageUrl,
    grid2TargetType: promotion.grid2TargetType,
    grid2TargetProductId: promotion.grid2TargetProductId,
    grid2TargetProductName: promotion.grid2TargetProduct?.name ?? null,
    grid2TargetCategoryId: promotion.grid2TargetCategoryId,
    grid2TargetCategoryName: promotion.grid2TargetCategory?.name ?? null,
    displayLayout: promotion.displayLayout,
    displayOrder: promotion.displayOrder,
    isDraft: promotion.isDraft,
    startAt: promotion.startAt ? promotion.startAt.toISOString() : null,
    endAt: promotion.endAt ? promotion.endAt.toISOString() : null,
    status: computeStatus(promotion),
    createdAt: promotion.createdAt.toISOString(),
    updatedAt: promotion.updatedAt.toISOString(),
  };
}

export interface PublicPromotionCard {
  title: string;
  subtitle: string | null;
  overline: string | null;
  badge: string | null;
  ctaText: string;
  ctaLink: string;
  imageUrl: string | null;
}

export interface PublicPromotionResponse extends PublicPromotionCard {
  id: string;
  displayLayout: string;
  /// The second grid card — only present (non-null) when displayLayout is
  /// GRID and Grid 2 has actually been configured (a title or image set).
  /// An unconfigured Grid 2 stays null so the frontend renders just one
  /// card instead of a broken/empty second one.
  grid2: PublicPromotionCard | null;
}

/// Storefront-safe shape: no isDraft/dates/target ids — same public/admin
/// split convention as reviews.mapper.ts's toPublicReviewResponse.
export function toPublicPromotionResponse(promotion: PromotionWithTargetNames): PublicPromotionResponse {
  return {
    id: promotion.id,
    overline: promotion.overline,
    title: promotion.title,
    subtitle: promotion.subtitle,
    badge: resolveBadge(promotion.badgeText, promotion.discountPercent),
    ctaText: promotion.ctaText,
    ctaLink: resolveCtaLink(promotion.ctaLink, promotion.targetType, promotion.targetProduct, promotion.targetCategoryId),
    imageUrl: promotion.imageUrl,
    displayLayout: promotion.displayLayout,
    grid2: resolveGrid2(promotion),
  };
}

function resolveGrid2(promotion: PromotionWithTargetNames): PublicPromotionCard | null {
  if (!promotion.grid2Title && !promotion.grid2ImageUrl) return null;
  return {
    overline: promotion.grid2Overline,
    title: promotion.grid2Title ?? "",
    subtitle: promotion.grid2Subtitle,
    badge: resolveBadge(promotion.grid2BadgeText, promotion.grid2DiscountPercent),
    ctaText: promotion.grid2CtaText ?? "Shop Now",
    ctaLink: resolveCtaLink(
      promotion.grid2CtaLink,
      promotion.grid2TargetType,
      promotion.grid2TargetProduct,
      promotion.grid2TargetCategoryId,
    ),
    imageUrl: promotion.grid2ImageUrl,
  };
}

function resolveBadge(badgeText: string | null, discountPercent: number | null): string | null {
  if (badgeText) return badgeText;
  if (discountPercent !== null && discountPercent !== undefined) return `${discountPercent}% OFF`;
  return null;
}

/// Explicit ctaLink wins; otherwise derived from the resolved target — same
/// "/products?category=<id>" shape the previous hardcoded banner used for
/// its honey-category link, or the product's own page by slug. Shared by
/// both the primary and grid-2 target resolution.
function resolveCtaLink(
  ctaLink: string | null,
  targetType: string | null,
  targetProduct: { slug: string } | null,
  targetCategoryId: string | null,
): string {
  if (ctaLink) return ctaLink;
  if (targetType === "PRODUCT" && targetProduct) {
    return `/products/${targetProduct.slug}`;
  }
  if (targetType === "CATEGORY" && targetCategoryId) {
    return `/products?category=${targetCategoryId}`;
  }
  return "/products";
}
