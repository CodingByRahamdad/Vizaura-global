import type { NextFunction, Request, Response } from "express";
import { ReviewsService } from "./reviews.service.js";
import {
  toAdminReviewResponse,
  toPublicReviewResponse,
  toPublicReviewWithProductResponse,
  toRatingSummaryResponse,
} from "./reviews.mapper.js";
import { successResponse } from "../../utils/apiResponse.js";
import { authErrors } from "../../errors/AppError.js";
import { toPaginationMeta, toSkipTake, type PaginationQuery } from "../catalog/pagination.js";
import { notifyAdmins } from "../notifications/notifications.helper.js";
import type {
  AdminCreateReviewInput,
  AdminUpdateReviewInput,
  CreateReviewInput,
  FeaturedReviewsQuery,
  ListAdminReviewsQuery,
  ListPublicReviewsQuery,
  ProductReviewParams,
  ReviewIdParams,
  UpdateReviewInput,
} from "./reviews.validators.js";

const reviewsService = new ReviewsService();

/// Reviews are always resolved against the authenticated caller's own
/// userId — never a client-supplied id — so ownership is structural.
/// Mirrors wishlist.controller.ts's requireUserId exactly.
function requireUserId(req: Request): string {
  if (!req.auth) throw authErrors.unauthorized();
  return req.auth.userId;
}

export async function listForProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId } = req.params as unknown as ProductReviewParams;
    const reviews = await reviewsService.listForProduct(productId);
    res.status(200).json(successResponse(reviews.map(toPublicReviewResponse)));
  } catch (error) {
    next(error);
  }
}

export async function getRatingSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId } = req.params as unknown as ProductReviewParams;
    const summary = await reviewsService.getRatingSummary(productId);
    res.status(200).json(successResponse(toRatingSummaryResponse(summary)));
  } catch (error) {
    next(error);
  }
}

export async function listAll(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as ListPublicReviewsQuery;
    const { skip, take } = toSkipTake(query);
    const result = await reviewsService.listPublished(skip, take);
    res
      .status(200)
      .json(
        successResponse(result.reviews.map(toPublicReviewWithProductResponse), toPaginationMeta(query, result.total))
      );
  } catch (error) {
    next(error);
  }
}

export async function listFeatured(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit } = req.query as unknown as FeaturedReviewsQuery;
    const reviews = await reviewsService.listFeatured(limit ?? 6);
    res.status(200).json(successResponse(reviews.map(toPublicReviewResponse)));
  } catch (error) {
    next(error);
  }
}

/// Returns the current user's own review for a product, or null — used by
/// the storefront to decide whether to show "write a review" or "edit your
/// review". 401 if not authenticated (the frontend only calls this when a
/// session exists, but the route itself requires `authenticate`).
export async function getOwnForProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId } = req.params as unknown as ProductReviewParams;
    const review = await reviewsService.getOwnForProduct(requireUserId(req), productId);
    res.status(200).json(successResponse(review ? toPublicReviewResponse(review) : null));
  } catch (error) {
    next(error);
  }
}

export async function submit(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId } = req.params as unknown as ProductReviewParams;
    const input = req.body as CreateReviewInput;
    const review = await reviewsService.submit(requireUserId(req), productId, input);
    await notifyAdmins({
      type: "REVIEW_SUBMITTED",
      title: "New review submitted",
      message: `${review.authorName} left a ${review.rating}-star review.`,
      entityType: "Review",
      entityId: review.id,
      requiredPermission: "reviews:read",
    });
    res.status(200).json(successResponse(toPublicReviewResponse(review)));
  } catch (error) {
    next(error);
  }
}

export async function updateOwn(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as unknown as ReviewIdParams;
    const input = req.body as UpdateReviewInput;
    const review = await reviewsService.updateOwn(requireUserId(req), id, input);
    res.status(200).json(successResponse(toPublicReviewResponse(review)));
  } catch (error) {
    next(error);
  }
}

export async function deleteOwn(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as unknown as ReviewIdParams;
    await reviewsService.deleteOwn(requireUserId(req), id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function adminList(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as ListAdminReviewsQuery & PaginationQuery;
    const { skip, take } = toSkipTake(query);
    const result = await reviewsService.adminList(query, skip, take);
    res
      .status(200)
      .json(successResponse(result.reviews.map(toAdminReviewResponse), toPaginationMeta(query, result.total)));
  } catch (error) {
    next(error);
  }
}

export async function adminGetById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as unknown as ReviewIdParams;
    const review = await reviewsService.adminGetById(id);
    res.status(200).json(successResponse(toAdminReviewResponse(review)));
  } catch (error) {
    next(error);
  }
}

export async function adminCreate(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as AdminCreateReviewInput;
    const review = await reviewsService.adminCreate(input);
    res.status(201).json(successResponse(toAdminReviewResponse(review)));
  } catch (error) {
    next(error);
  }
}

export async function adminUpdate(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as unknown as ReviewIdParams;
    const input = req.body as AdminUpdateReviewInput;
    const review = await reviewsService.adminUpdate(id, input);
    res.status(200).json(successResponse(toAdminReviewResponse(review)));
  } catch (error) {
    next(error);
  }
}

export async function adminDelete(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as unknown as ReviewIdParams;
    await reviewsService.adminDelete(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
