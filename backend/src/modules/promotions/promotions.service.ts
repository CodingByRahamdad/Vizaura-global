import {
  PromotionsRepository,
  type AdminPromotionFilters,
  type PromotionWithTargetNames,
} from "./promotions.repository.js";
import { ProductsRepository } from "../catalog/products.repository.js";
import { CategoriesRepository } from "../catalog/categories.repository.js";
import { promotionsErrors } from "../../errors/AppError.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { CreatePromotionInput, ListAdminPromotionsQuery, UpdatePromotionInput } from "./promotions.validators.js";

export interface ListResult<T> {
  promotions: T[];
  total: number;
}

export interface HomepagePromotions {
  layout: "SINGLE" | "GRID" | null;
  promotions: PromotionWithTargetNames[];
}

/// Mirrors Categories' "resolve, then validate, then write" service shape.
/// Target existence is checked via Catalog's own repositories (Products/
/// Categories), never a cross-domain Prisma query — same convention
/// reviews.service.ts already established for assertProductExists.
export class PromotionsService {
  constructor(
    private readonly promotionsRepository: PromotionsRepository = new PromotionsRepository(),
    private readonly productsRepository: ProductsRepository = new ProductsRepository(),
    private readonly categoriesRepository: CategoriesRepository = new CategoriesRepository(),
  ) {}

  async create(input: CreatePromotionInput): Promise<PromotionWithTargetNames> {
    await this.assertTargetExists(input.targetType, input.targetProductId, input.targetCategoryId);
    await this.assertTargetExists(input.grid2TargetType, input.grid2TargetProductId, input.grid2TargetCategoryId);

    return this.promotionsRepository.create({
      overline: input.overline ?? null,
      title: input.title,
      subtitle: input.subtitle ?? null,
      badgeText: input.badgeText ?? null,
      discountPercent: input.discountPercent ?? null,
      ...(input.ctaText !== undefined ? { ctaText: input.ctaText } : {}),
      ctaLink: input.ctaLink ?? null,
      imageUrl: input.imageUrl ?? null,
      targetType: input.targetType ?? null,
      targetProductId: input.targetProductId ?? null,
      targetCategoryId: input.targetCategoryId ?? null,
      grid2Overline: input.grid2Overline ?? null,
      grid2Title: input.grid2Title ?? null,
      grid2Subtitle: input.grid2Subtitle ?? null,
      grid2BadgeText: input.grid2BadgeText ?? null,
      grid2DiscountPercent: input.grid2DiscountPercent ?? null,
      grid2CtaText: input.grid2CtaText ?? null,
      grid2CtaLink: input.grid2CtaLink ?? null,
      grid2ImageUrl: input.grid2ImageUrl ?? null,
      grid2TargetType: input.grid2TargetType ?? null,
      grid2TargetProductId: input.grid2TargetProductId ?? null,
      grid2TargetCategoryId: input.grid2TargetCategoryId ?? null,
      ...(input.displayLayout !== undefined ? { displayLayout: input.displayLayout } : {}),
      ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
      ...(input.isDraft !== undefined ? { isDraft: input.isDraft } : {}),
      startAt: input.startAt ?? null,
      endAt: input.endAt ?? null,
    });
  }

  async get(id: string): Promise<PromotionWithTargetNames> {
    return this.getExistingOrThrow(id);
  }

  async list(
    query: ListAdminPromotionsQuery,
    skip: number,
    take: number,
  ): Promise<ListResult<PromotionWithTargetNames>> {
    const filters: AdminPromotionFilters = {
      displayLayout: query.displayLayout,
      statusWhere: this.statusToWhere(query.status),
    };
    const result = await this.promotionsRepository.list(filters, skip, take);
    return { promotions: result.promotions, total: result.total };
  }

  async update(id: string, input: UpdatePromotionInput): Promise<PromotionWithTargetNames> {
    const existing = await this.getExistingOrThrow(id);

    // Only re-validate the target when this request actually touches it —
    // otherwise re-check the row's own existing values (e.g. an edit that
    // changes the title only must not spuriously fail if the previously
    // valid target was since soft-deleted elsewhere).
    const touchesTarget =
      input.targetType !== undefined || input.targetProductId !== undefined || input.targetCategoryId !== undefined;
    if (touchesTarget) {
      const targetType = input.targetType !== undefined ? input.targetType : existing.targetType;
      const targetProductId = input.targetProductId !== undefined ? input.targetProductId : existing.targetProductId;
      const targetCategoryId =
        input.targetCategoryId !== undefined ? input.targetCategoryId : existing.targetCategoryId;
      await this.assertTargetExists(targetType, targetProductId, targetCategoryId);
    }

    const touchesGrid2Target =
      input.grid2TargetType !== undefined ||
      input.grid2TargetProductId !== undefined ||
      input.grid2TargetCategoryId !== undefined;
    if (touchesGrid2Target) {
      const grid2TargetType = input.grid2TargetType !== undefined ? input.grid2TargetType : existing.grid2TargetType;
      const grid2TargetProductId =
        input.grid2TargetProductId !== undefined ? input.grid2TargetProductId : existing.grid2TargetProductId;
      const grid2TargetCategoryId =
        input.grid2TargetCategoryId !== undefined ? input.grid2TargetCategoryId : existing.grid2TargetCategoryId;
      await this.assertTargetExists(grid2TargetType, grid2TargetProductId, grid2TargetCategoryId);
    }

    return this.promotionsRepository.update(id, {
      ...(input.overline !== undefined ? { overline: input.overline } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.subtitle !== undefined ? { subtitle: input.subtitle } : {}),
      ...(input.badgeText !== undefined ? { badgeText: input.badgeText } : {}),
      ...(input.discountPercent !== undefined ? { discountPercent: input.discountPercent } : {}),
      ...(input.ctaText !== undefined ? { ctaText: input.ctaText } : {}),
      ...(input.ctaLink !== undefined ? { ctaLink: input.ctaLink } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      ...(input.targetType !== undefined ? { targetType: input.targetType } : {}),
      ...(input.targetProductId !== undefined ? { targetProductId: input.targetProductId } : {}),
      ...(input.targetCategoryId !== undefined ? { targetCategoryId: input.targetCategoryId } : {}),
      ...(input.grid2Overline !== undefined ? { grid2Overline: input.grid2Overline } : {}),
      ...(input.grid2Title !== undefined ? { grid2Title: input.grid2Title } : {}),
      ...(input.grid2Subtitle !== undefined ? { grid2Subtitle: input.grid2Subtitle } : {}),
      ...(input.grid2BadgeText !== undefined ? { grid2BadgeText: input.grid2BadgeText } : {}),
      ...(input.grid2DiscountPercent !== undefined ? { grid2DiscountPercent: input.grid2DiscountPercent } : {}),
      ...(input.grid2CtaText !== undefined ? { grid2CtaText: input.grid2CtaText } : {}),
      ...(input.grid2CtaLink !== undefined ? { grid2CtaLink: input.grid2CtaLink } : {}),
      ...(input.grid2ImageUrl !== undefined ? { grid2ImageUrl: input.grid2ImageUrl } : {}),
      ...(input.grid2TargetType !== undefined ? { grid2TargetType: input.grid2TargetType } : {}),
      ...(input.grid2TargetProductId !== undefined ? { grid2TargetProductId: input.grid2TargetProductId } : {}),
      ...(input.grid2TargetCategoryId !== undefined ? { grid2TargetCategoryId: input.grid2TargetCategoryId } : {}),
      ...(input.displayLayout !== undefined ? { displayLayout: input.displayLayout } : {}),
      ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
      ...(input.isDraft !== undefined ? { isDraft: input.isDraft } : {}),
      ...(input.startAt !== undefined ? { startAt: input.startAt } : {}),
      ...(input.endAt !== undefined ? { endAt: input.endAt } : {}),
    });
  }

  async remove(id: string): Promise<void> {
    await this.getExistingOrThrow(id);
    await this.promotionsRepository.delete(id);
  }

  /// Resolves "which promotion, in which layout" the homepage should render,
  /// from whatever's eligible right now. SINGLE-tagged eligible promotions
  /// take precedence (lowest displayOrder wins, GRID-tagged ones are ignored
  /// for that render); otherwise the single lowest-displayOrder GRID-tagged
  /// eligible promotion is used — its own grid1 + grid2 fields ARE the two
  /// cards (see promotions.mapper.ts#toPublicPromotionResponse), not paired
  /// with a second row; otherwise nothing is shown.
  async getActiveForHomepage(): Promise<HomepagePromotions> {
    const eligible = await this.promotionsRepository.findEligibleForPublic();

    const single = eligible.find((p) => p.displayLayout === "SINGLE");
    if (single) return { layout: "SINGLE", promotions: [single] };

    const grid = eligible.find((p) => p.displayLayout === "GRID");
    if (grid) return { layout: "GRID", promotions: [grid] };

    return { layout: null, promotions: [] };
  }

  private async getExistingOrThrow(id: string): Promise<PromotionWithTargetNames> {
    const promotion = await this.promotionsRepository.findById(id);
    if (!promotion) throw promotionsErrors.notFound();
    return promotion;
  }

  private async assertTargetExists(
    targetType: "PRODUCT" | "CATEGORY" | null | undefined,
    targetProductId: string | null | undefined,
    targetCategoryId: string | null | undefined,
  ): Promise<void> {
    if (targetType === "PRODUCT") {
      if (!targetProductId) throw promotionsErrors.invalidTarget();
      const product = await this.productsRepository.findById(targetProductId);
      if (!product) throw promotionsErrors.invalidTarget();
      return;
    }
    if (targetType === "CATEGORY") {
      if (!targetCategoryId) throw promotionsErrors.invalidTarget();
      const category = await this.categoriesRepository.findById(targetCategoryId);
      if (!category) throw promotionsErrors.invalidTarget();
      return;
    }
    if (targetProductId || targetCategoryId) throw promotionsErrors.invalidTarget();
  }

  /// Status is never stored (see promotions.mapper.ts#computeStatus) — an
  /// admin list filter by status is translated here into the equivalent
  /// isDraft/startAt/endAt where-fragment instead.
  private statusToWhere(status: ListAdminPromotionsQuery["status"]): Prisma.PromotionWhereInput | undefined {
    if (!status) return undefined;
    const now = new Date();
    switch (status) {
      case "draft":
        return { isDraft: true };
      case "scheduled":
        return { isDraft: false, startAt: { gt: now } };
      case "expired":
        return { isDraft: false, endAt: { lte: now } };
      case "active":
        return {
          isDraft: false,
          OR: [{ startAt: null }, { startAt: { lte: now } }],
          AND: [{ OR: [{ endAt: null }, { endAt: { gt: now } }] }],
        };
    }
  }
}
