/**
 * Types mirror the backend's actual response shapes verbatim
 * (backend/src/modules/promotions/promotions.mapper.ts). Do not add fields
 * the backend doesn't return.
 */

export type PromotionStatus = "DRAFT" | "SCHEDULED" | "ACTIVE" | "EXPIRED";
export type PromotionTargetType = "PRODUCT" | "CATEGORY";
export type PromotionDisplayLayout = "SINGLE" | "GRID";

/** The shape one rendered card needs — shared by card 1 (top-level fields) and card 2 (`grid2`). */
export interface PublicPromotionCard {
  overline: string | null;
  title: string;
  subtitle: string | null;
  badge: string | null;
  ctaText: string;
  ctaLink: string;
  imageUrl: string | null;
}

export interface PublicPromotionResponse extends PublicPromotionCard {
  id: string;
  displayLayout: PromotionDisplayLayout;
  /** Non-null only when displayLayout is GRID and Grid 2 was actually configured. */
  grid2: PublicPromotionCard | null;
}

export interface HomepagePromotionsResponse {
  layout: PromotionDisplayLayout | null;
  promotions: PublicPromotionResponse[];
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
  targetType: PromotionTargetType | null;
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
  grid2TargetType: PromotionTargetType | null;
  grid2TargetProductId: string | null;
  grid2TargetProductName: string | null;
  grid2TargetCategoryId: string | null;
  grid2TargetCategoryName: string | null;
  displayLayout: PromotionDisplayLayout;
  displayOrder: number;
  isDraft: boolean;
  startAt: string | null;
  endAt: string | null;
  status: PromotionStatus;
  createdAt: string;
  updatedAt: string;
}
