import type { PrismaClient, Review, ReviewSource } from "../../generated/prisma/client.js";
import { getPrismaClient } from "../../db/prismaClient.js";

export interface RatingAggregate {
  averageRating: number | null;
  reviewCount: number;
}

export interface AdminReviewFilters {
  productId?: string;
  isPublished?: boolean;
  source?: ReviewSource;
  isFeatured?: boolean;
}

export interface CreateReviewData {
  productId: string;
  userId: string | null;
  rating: number;
  title?: string | null;
  body: string;
  authorName: string;
  authorLocation?: string | null;
  avatarUrl?: string | null;
  source: ReviewSource;
  isVerifiedPurchase: boolean;
  isPublished?: boolean;
  isFeatured?: boolean;
}

export interface ReviewWithProduct extends Review {
  product: {
    name: string;
    slug: string;
    media: { url: string; altText: string | null }[];
  };
}

export interface UpdateReviewData {
  rating?: number;
  title?: string | null;
  body?: string;
  authorName?: string;
  authorLocation?: string | null;
  avatarUrl?: string | null;
  isPublished?: boolean;
  isFeatured?: boolean;
}

const listOrderBy = [{ createdAt: "desc" as const }, { id: "desc" as const }];

export class ReviewsRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async findPublishedByProduct(productId: string): Promise<Review[]> {
    return this.prisma.review.findMany({
      where: { productId, isPublished: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async aggregateForProduct(productId: string): Promise<RatingAggregate> {
    const result = await this.prisma.review.aggregate({
      where: { productId, isPublished: true },
      _avg: { rating: true },
      _count: true,
    });
    return { averageRating: result._avg.rating, reviewCount: result._count };
  }

  /// Batched analog of aggregateForProduct, for a page of product cards
  /// (products.service.ts::listWithCards) — one groupBy for every product on
  /// the page instead of one aggregate query per product. Same isPublished
  /// filter and null-handling as the single-product method.
  async aggregateForProducts(productIds: string[]): Promise<Map<string, RatingAggregate>> {
    if (productIds.length === 0) return new Map();
    const rows = await this.prisma.review.groupBy({
      by: ["productId"],
      where: { productId: { in: productIds }, isPublished: true },
      _avg: { rating: true },
      _count: true,
    });
    return new Map(rows.map((row) => [row.productId, { averageRating: row._avg.rating, reviewCount: row._count }]));
  }

  async findFeatured(limit: number): Promise<Review[]> {
    return this.prisma.review.findMany({
      where: { isPublished: true, isFeatured: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async findById(id: string): Promise<Review | null> {
    return this.prisma.review.findUnique({ where: { id } });
  }

  /// userId is never null here — this is only ever called for a CUSTOMER
  /// submission, where userId always comes from req.auth, not the client.
  async findByProductAndUser(productId: string, userId: string): Promise<Review | null> {
    return this.prisma.review.findUnique({ where: { productId_userId: { productId, userId } } });
  }

  async create(data: CreateReviewData): Promise<Review> {
    return this.prisma.review.create({
      data: {
        productId: data.productId,
        userId: data.userId,
        rating: data.rating,
        title: data.title ?? null,
        body: data.body,
        authorName: data.authorName,
        authorLocation: data.authorLocation ?? null,
        avatarUrl: data.avatarUrl ?? null,
        source: data.source,
        isVerifiedPurchase: data.isVerifiedPurchase,
        ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
        ...(data.isFeatured !== undefined ? { isFeatured: data.isFeatured } : {}),
      },
    });
  }

  /// Upserts a CUSTOMER submission on the (productId, userId) unique key —
  /// a resubmission edits the existing row rather than erroring. Never used
  /// for ADMIN/SEED rows (those always go through create(), since userId
  /// may be null and the unique key doesn't apply the same way).
  async upsertCustomerReview(
    productId: string,
    userId: string,
    data: Omit<CreateReviewData, "productId" | "userId" | "source">,
  ): Promise<Review> {
    return this.prisma.review.upsert({
      where: { productId_userId: { productId, userId } },
      create: {
        productId,
        userId,
        rating: data.rating,
        title: data.title ?? null,
        body: data.body,
        authorName: data.authorName,
        authorLocation: data.authorLocation ?? null,
        avatarUrl: data.avatarUrl ?? null,
        source: "CUSTOMER",
        isVerifiedPurchase: data.isVerifiedPurchase,
      },
      update: {
        rating: data.rating,
        title: data.title ?? null,
        body: data.body,
        authorName: data.authorName,
        authorLocation: data.authorLocation ?? null,
        avatarUrl: data.avatarUrl ?? null,
      },
    });
  }

  async update(id: string, data: UpdateReviewData): Promise<Review> {
    return this.prisma.review.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.review.delete({ where: { id } });
  }

  /// Public, cross-product counterpart to listAdmin — always isPublished:true,
  /// no moderation filters, and includes the product's display fields (name,
  /// slug, primary image) since a sitewide listing needs to say which product
  /// each review belongs to, unlike the single-product reads above.
  async listPublished(skip: number, take: number): Promise<{ reviews: ReviewWithProduct[]; total: number }> {
    const where = { isPublished: true };
    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: listOrderBy,
        skip,
        take,
        include: {
          product: {
            select: {
              name: true,
              slug: true,
              media: { where: { isPrimary: true }, take: 1, select: { url: true, altText: true } },
            },
          },
        },
      }),
      this.prisma.review.count({ where }),
    ]);
    return { reviews, total };
  }

  async listAdmin(filters: AdminReviewFilters, skip: number, take: number): Promise<{ reviews: Review[]; total: number }> {
    const where = {
      ...(filters.productId ? { productId: filters.productId } : {}),
      ...(filters.isPublished !== undefined ? { isPublished: filters.isPublished } : {}),
      ...(filters.source ? { source: filters.source } : {}),
      ...(filters.isFeatured !== undefined ? { isFeatured: filters.isFeatured } : {}),
    };

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({ where, orderBy: listOrderBy, skip, take }),
      this.prisma.review.count({ where }),
    ]);
    return { reviews, total };
  }

  /// Verified-purchase check: has this user completed (or had
  /// returned/refunded post-fulfillment) an order containing this product?
  /// Reuses the exact "eligible" status set Returns already established
  /// (returns.service.ts's ELIGIBLE_ORDER_STATUSES) — by COMPLETED the
  /// purchase genuinely happened, and a later return/refund doesn't retract
  /// that fact.
  async hasCompletedOrderForProduct(userId: string, productId: string): Promise<boolean> {
    const count = await this.prisma.orderItem.count({
      where: {
        productId,
        order: { userId, status: { in: ["COMPLETED", "RETURNED", "REFUNDED"] } },
      },
    });
    return count > 0;
  }
}
