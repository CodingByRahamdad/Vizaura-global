import type { NextFunction, Request, Response } from "express";
import { ProductsService } from "./products.service.js";
import { toProductAdminListResponse, toProductCardResponse, toProductDetail, toProductSummary } from "./products.mapper.js";
import { successResponse } from "../../utils/apiResponse.js";
import { authErrors, catalogErrors } from "../../errors/AppError.js";
import { toSkipTake, toPaginationMeta } from "./pagination.js";
import { recordAudit } from "../audit/auditLog.helper.js";
import { notifyAdmins } from "../notifications/notifications.helper.js";
import type {
  CreateProductInput,
  ListProductsQuery,
  MarketParams,
  ProductIdParams,
  ReplaceCategoriesInput,
  UpdateProductInput,
  UpsertProductMarketInput,
} from "./products.validators.js";

const productsService = new ProductsService();

function canSeeAllStatuses(req: Request): boolean {
  return req.auth?.permissions.has("products:read") ?? false;
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await productsService.create(req.body as CreateProductInput);
    await recordAudit(req, { action: "CREATE_PRODUCT", entityType: "Product", entityId: product.id, after: product });
    await notifyAdmins({
      type: "PRODUCT_CREATED",
      title: "New product created",
      message: `"${product.name}" was added to the catalog.`,
      entityType: "Product",
      entityId: product.id,
      requiredPermission: "products:read",
    });
    res.status(201).json(successResponse(toProductDetail(product)));
  } catch (error) {
    next(error);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as ListProductsQuery;
    const filter = {
      status: query.status,
      badge: query.badge,
      category: query.category,
      market: query.market,
      search: query.search,
      canSeeAllStatuses: canSeeAllStatuses(req),
    };

    if (query.include === "admin") {
      // Unlike card/summary, admin must reject (not silently widen) a
      // caller lacking products:read — the route itself stays
      // optionalAuthenticate since it's shared with summary/card. Mirrors
      // requirePermission's own 401-vs-403 split even though this isn't
      // route-level middleware.
      if (!req.auth) throw authErrors.unauthorized();
      if (!canSeeAllStatuses(req)) throw authErrors.forbidden({ requiredPermission: "products:read" });

      const { products, total, prices, stocks } = await productsService.listForAdmin(filter, toSkipTake(query));
      const rows = products.map((product) =>
        toProductAdminListResponse(
          product,
          product.defaultVariantId ? (prices.get(product.defaultVariantId) ?? []) : [],
          product.defaultVariantId ? (stocks.get(product.defaultVariantId) ?? []) : [],
        ),
      );
      res.status(200).json(successResponse(rows, toPaginationMeta(query, total)));
      return;
    }

    if (query.include === "card") {
      const { products, total, prices, stocks, ratings } = await productsService.listWithCards(
        filter,
        toSkipTake(query),
      );
      const cards = products.map((product) =>
        toProductCardResponse(
          product,
          product.defaultVariantId ? prices.get(product.defaultVariantId) : undefined,
          product.defaultVariantId ? stocks.get(product.defaultVariantId) : undefined,
          ratings.get(product.id),
        ),
      );
      res.status(200).json(successResponse(cards, toPaginationMeta(query, total)));
      return;
    }

    const { products, total } = await productsService.list(filter, toSkipTake(query));
    res.status(200).json(successResponse(products.map(toProductSummary), toPaginationMeta(query, total)));
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as unknown as ProductIdParams;
    const product = await productsService.get(id, canSeeAllStatuses(req));
    if ((product.status !== "ACTIVE" || !product.isActive) && !canSeeAllStatuses(req)) {
      throw catalogErrors.notFound("Product");
    }
    res.status(200).json(successResponse(toProductDetail(product)));
  } catch (error) {
    next(error);
  }
}

export async function getBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    const { slug } = req.params as { slug: string };
    const product = await productsService.getBySlug(slug, canSeeAllStatuses(req));
    if ((product.status !== "ACTIVE" || !product.isActive) && !canSeeAllStatuses(req)) {
      throw catalogErrors.notFound("Product");
    }
    res.status(200).json(successResponse(toProductDetail(product)));
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as unknown as ProductIdParams;
    const product = await productsService.update(id, req.body as UpdateProductInput);
    await recordAudit(req, { action: "UPDATE_PRODUCT", entityType: "Product", entityId: id, after: product });
    res.status(200).json(successResponse(toProductDetail(product)));
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as unknown as ProductIdParams;
    const before = await productsService.get(id);
    await productsService.remove(id);
    await recordAudit(req, { action: "DELETE_PRODUCT", entityType: "Product", entityId: id, before });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function replaceCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as unknown as ProductIdParams;
    const { categoryIds } = req.body as ReplaceCategoriesInput;
    const product = await productsService.replaceCategories(id, categoryIds);
    res.status(200).json(successResponse(toProductDetail(product)));
  } catch (error) {
    next(error);
  }
}

export async function upsertMarket(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, marketCode } = req.params as unknown as MarketParams;
    const product = await productsService.upsertMarket(id, marketCode, req.body as UpsertProductMarketInput);
    res.status(200).json(successResponse(toProductDetail(product)));
  } catch (error) {
    next(error);
  }
}
