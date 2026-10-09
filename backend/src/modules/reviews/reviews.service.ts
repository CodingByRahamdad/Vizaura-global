import type { Review } from "../../generated/prisma/client.js";
import {
  ReviewsRepository,
  type AdminReviewFilters,
  type RatingAggregate,
  type ReviewWithProduct,
} from "./reviews.repository.js";
import { ProductsRepository } from "../catalog/products.repository.js";
import { UsersRepository } from "../users/users.repository.js";
import { catalogErrors, reviewsErrors } from "../../errors/AppError.js";
import type {
  AdminCreateReviewInput,
  AdminUpdateReviewInput,
  CreateReviewInput,
  ListAdminReviewsQuery,
  UpdateReviewInput,
} from "./reviews.validators.js";

export interface ListResult<T> {
  reviews: T[];
  total: number;
}

/// Mirrors Pricing/Inventory's "resolve, then read" service shape: every
/// product-scoped read first confirms the product exists via Catalog's own
/// repository, never a cross-module Prisma query. Ownership checks for
/// customer-authored rows mirror ReturnsService.create's posture: never
/// distinguish "not yours" from "doesn't exist" (404 either way).
export class ReviewsService {
  constructor(
    private readonly reviewsRepository: ReviewsRepository = new ReviewsRepository(),
    private readonly productsRepository: ProductsRepository = new ProductsRepository(),
    private readonly usersRepository: UsersRepository = new UsersRepository(),
  ) {}

  async listForProduct(productId: string): Promise<Review[]> {
    await this.assertProductExists(productId);
    return this.reviewsRepository.findPublishedByProduct(productId);
  }

  async getRatingSummary(productId: string): Promise<RatingAggregate> {
    await this.assertProductExists(productId);
    return this.reviewsRepository.aggregateForProduct(productId);
  }

  async listFeatured(limit: number): Promise<Review[]> {
    return this.reviewsRepository.findFeatured(limit);
  }

  /// Public, cross-product listing (homepage/storefront "All Reviews" page) —
  /// no permission check, always published-only. Thin passthrough, same shape
  /// as adminList below, minus the moderation filters.
  async listPublished(skip: number, take: number): Promise<ListResult<ReviewWithProduct>> {
    const result = await this.reviewsRepository.listPublished(skip, take);
    return { reviews: result.reviews, total: result.total };
  }

  /// The current user's own review for a product, or null if they haven't
  /// reviewed it (or it's unpublished — an owner editing their own hidden
  /// review is out of scope for this phase; it still shows via this call so
  /// they can see/edit what they wrote).
  async getOwnForProduct(userId: string, productId: string): Promise<Review | null> {
    return this.reviewsRepository.findByProductAndUser(productId, userId);
  }

  /// Customer self-service submission. Upserts on (productId, userId) — a
  /// resubmission edits the existing row rather than erroring (simplest UX,
  /// and the unique constraint already forces this shape). isVerifiedPurchase
  /// is computed once here and frozen; it is never recomputed on a later edit.
  async submit(userId: string, productId: string, input: CreateReviewInput): Promise<Review> {
    const product = await this.productsRepository.findById(productId);
    if (!product) throw catalogErrors.notFound("Product");

    const author = await this.usersRepository.findActiveById(userId);
    if (!author) throw reviewsErrors.notFound();

    const isVerifiedPurchase = await this.reviewsRepository.hasCompletedOrderForProduct(userId, productId);

    return this.reviewsRepository.upsertCustomerReview(productId, userId, {
      rating: input.rating,
      title: input.title ?? null,
      body: input.body,
      authorName: `${author.firstName} ${author.lastName}`,
      authorLocation: null,
      avatarUrl: null,
      isVerifiedPurchase,
    });
  }

  async updateOwn(userId: string, reviewId: string, input: UpdateReviewInput): Promise<Review> {
    const review = await this.getOwnedOrThrow(reviewId, userId);
    return this.reviewsRepository.update(review.id, {
      ...(input.rating !== undefined ? { rating: input.rating } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
    });
  }

  async deleteOwn(userId: string, reviewId: string): Promise<void> {
    const review = await this.getOwnedOrThrow(reviewId, userId);
    await this.reviewsRepository.delete(review.id);
  }

  /// Admin-authored review — never tied to isVerifiedPurchase=true, and
  /// source is always ADMIN regardless of anything in the request body
  /// (adminCreateReviewBodySchema doesn't even accept those fields, but this
  /// is enforced here too as defense in depth).
  async adminCreate(input: AdminCreateReviewInput): Promise<Review> {
    const product = await this.productsRepository.findById(input.productId);
    if (!product) throw catalogErrors.notFound("Product");

    if (input.userId) {
      const user = await this.usersRepository.findActiveById(input.userId);
      if (!user) throw reviewsErrors.notFound();
    }

    return this.reviewsRepository.create({
      productId: input.productId,
      userId: input.userId ?? null,
      rating: input.rating,
      title: input.title ?? null,
      body: input.body,
      authorName: input.authorName,
      authorLocation: input.authorLocation ?? null,
      avatarUrl: input.avatarUrl ?? null,
      source: "ADMIN",
      isVerifiedPurchase: false,
      isPublished: input.isPublished,
      isFeatured: input.isFeatured,
    });
  }

  async adminUpdate(id: string, input: AdminUpdateReviewInput): Promise<Review> {
    const review = await this.reviewsRepository.findById(id);
    if (!review) throw reviewsErrors.notFound();

    return this.reviewsRepository.update(id, {
      ...(input.rating !== undefined ? { rating: input.rating } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.authorName !== undefined ? { authorName: input.authorName } : {}),
      ...(input.authorLocation !== undefined ? { authorLocation: input.authorLocation } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
      ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
      // isVerifiedPurchase/source are never accepted by adminUpdateReviewBodySchema
      // in the first place, so there is nothing to strip here — this is the
      // single write path and it simply never touches those columns.
    });
  }

  async adminDelete(id: string): Promise<void> {
    const review = await this.reviewsRepository.findById(id);
    if (!review) throw reviewsErrors.notFound();
    await this.reviewsRepository.delete(id);
  }

  async adminGetById(id: string): Promise<Review> {
    const review = await this.reviewsRepository.findById(id);
    if (!review) throw reviewsErrors.notFound();
    return review;
  }

  async adminList(query: ListAdminReviewsQuery, skip: number, take: number): Promise<ListResult<Review>> {
    const filters: AdminReviewFilters = {
      productId: query.productId,
      source: query.source,
      isFeatured: query.featured,
      isPublished: query.status === "published" ? true : query.status === "unpublished" ? false : undefined,
    };
    const result = await this.reviewsRepository.listAdmin(filters, skip, take);
    return { reviews: result.reviews, total: result.total };
  }

  private async assertProductExists(productId: string): Promise<void> {
    const product = await this.productsRepository.findById(productId);
    if (!product) throw catalogErrors.notFound("Product");
  }

  private async getOwnedOrThrow(reviewId: string, userId: string): Promise<Review> {
    const review = await this.reviewsRepository.findById(reviewId);
    if (!review || review.userId !== userId) throw reviewsErrors.notFound();
    return review;
  }
}
