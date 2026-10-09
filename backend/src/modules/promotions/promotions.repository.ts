import type { Prisma, PrismaClient, Promotion } from "../../generated/prisma/client.js";
import { getPrismaClient } from "../../db/prismaClient.js";

export type PromotionWithTargetNames = Promotion & {
  targetProduct: { name: string; slug: string } | null;
  targetCategory: { name: string } | null;
  grid2TargetProduct: { name: string; slug: string } | null;
  grid2TargetCategory: { name: string } | null;
};

export interface CreatePromotionData {
  overline?: string | null;
  title: string;
  subtitle?: string | null;
  badgeText?: string | null;
  discountPercent?: number | null;
  ctaText?: string;
  ctaLink?: string | null;
  imageUrl?: string | null;
  targetType?: "PRODUCT" | "CATEGORY" | null;
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
  grid2TargetType?: "PRODUCT" | "CATEGORY" | null;
  grid2TargetProductId?: string | null;
  grid2TargetCategoryId?: string | null;
  displayLayout?: "SINGLE" | "GRID";
  displayOrder?: number;
  isDraft?: boolean;
  startAt?: Date | null;
  endAt?: Date | null;
}

export type UpdatePromotionData = Partial<CreatePromotionData>;

export interface AdminPromotionFilters {
  displayLayout?: "SINGLE" | "GRID";
  /// Translated from the query's `status` string into a date-range `where`
  /// fragment by the service layer (status is never stored — see
  /// promotions.mapper.ts#computeStatus) before reaching this repository.
  statusWhere?: Prisma.PromotionWhereInput;
}

const targetInclude = {
  targetProduct: { select: { name: true, slug: true } },
  targetCategory: { select: { name: true } },
  grid2TargetProduct: { select: { name: true, slug: true } },
  grid2TargetCategory: { select: { name: true } },
} as const;

export class PromotionsRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async create(data: CreatePromotionData): Promise<PromotionWithTargetNames> {
    return this.prisma.promotion.create({ data, include: targetInclude });
  }

  async findById(id: string): Promise<PromotionWithTargetNames | null> {
    return this.prisma.promotion.findUnique({ where: { id }, include: targetInclude });
  }

  async update(id: string, data: UpdatePromotionData): Promise<PromotionWithTargetNames> {
    return this.prisma.promotion.update({ where: { id }, data, include: targetInclude });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.promotion.delete({ where: { id } });
  }

  async list(
    filter: AdminPromotionFilters,
    skip: number,
    take: number,
  ): Promise<{ promotions: PromotionWithTargetNames[]; total: number }> {
    const where: Prisma.PromotionWhereInput = {
      ...(filter.displayLayout ? { displayLayout: filter.displayLayout } : {}),
      ...(filter.statusWhere ?? {}),
    };

    const [promotions, total] = await Promise.all([
      this.prisma.promotion.findMany({
        where,
        include: targetInclude,
        orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }, { id: "asc" }],
        skip,
        take,
      }),
      this.prisma.promotion.count({ where }),
    ]);
    return { promotions, total };
  }

  /// Published + currently within its date window — the exact set eligible
  /// to appear on the homepage. Ordered by displayOrder so the service layer
  /// can just take the first 1 (SINGLE) or first 2 (GRID) per bucket.
  async findEligibleForPublic(): Promise<PromotionWithTargetNames[]> {
    const now = new Date();
    return this.prisma.promotion.findMany({
      where: {
        isDraft: false,
        OR: [{ startAt: null }, { startAt: { lte: now } }],
        AND: [{ OR: [{ endAt: null }, { endAt: { gt: now } }] }],
      },
      include: targetInclude,
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
  }
}
