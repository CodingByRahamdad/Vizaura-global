import type { NextFunction, Request, Response } from "express";
import { CategoriesService } from "./categories.service.js";
import { toAdminCategoryResponse, toCategoryResponse, toCategoryWithCount } from "./categories.mapper.js";
import { successResponse } from "../../utils/apiResponse.js";
import { authErrors, catalogErrors } from "../../errors/AppError.js";
import { toSkipTake, toPaginationMeta } from "./pagination.js";
import { recordAudit } from "../audit/auditLog.helper.js";
import { notifyAdmins } from "../notifications/notifications.helper.js";
import { buildCategoryMediaUrl } from "./mediaStorage.js";
import type { CategoryIdParams, CreateCategoryInput, ListCategoriesQuery, UpdateCategoryInput } from "./categories.validators.js";

const categoriesService = new CategoriesService();

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const category = await categoriesService.create(req.body as CreateCategoryInput);
    await recordAudit(req, { action: "CREATE_CATEGORY", entityType: "Category", entityId: category.id, after: category });
    await notifyAdmins({
      type: "CATEGORY_CREATED",
      title: "New category created",
      message: `"${category.name}" was added.`,
      entityType: "Category",
      entityId: category.id,
      requiredPermission: "categories:read",
    });
    res.status(201).json(successResponse(toCategoryResponse(category)));
  } catch (error) {
    next(error);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as ListCategoriesQuery;
    // includeInactive is only honoured for a caller who holds categories:read
    // (set by the optional-auth chain in categories.routes.ts) — anyone else
    // silently gets the public, active-only view rather than a 403, since the
    // endpoint itself is public.
    const canSeeInactive = req.auth?.permissions.has("categories:read") ?? false;
    const listFilter = {
      parentId: query.parentId,
      includeInactive: query.includeInactive && canSeeInactive,
      search: query.search,
    };

    if (query.include === "admin") {
      // Unlike count/summary, admin rejects (not silently widens) a caller
      // lacking categories:read — the route itself stays optionalAuthenticate
      // since it is shared with the public views.
      if (!req.auth) throw authErrors.unauthorized();
      if (!canSeeInactive) throw authErrors.forbidden({ requiredPermission: "categories:read" });
      const { categories, total, productCounts, childCounts } = await categoriesService.listForAdmin(
        listFilter,
        toSkipTake(query),
      );
      const rows = categories.map((category) =>
        toAdminCategoryResponse(category, productCounts.get(category.id) ?? 0, childCounts.get(category.id) ?? 0),
      );
      res.status(200).json(successResponse(rows, toPaginationMeta(query, total)));
      return;
    }

    if (query.include === "count") {
      const { categories, total, counts } = await categoriesService.listWithCounts(
        listFilter,
        toSkipTake(query),
        query.market,
      );
      const withCounts = categories.map((category) => toCategoryWithCount(category, counts.get(category.id) ?? 0));
      res.status(200).json(successResponse(withCounts, toPaginationMeta(query, total)));
      return;
    }

    const { categories, total } = await categoriesService.list(listFilter, toSkipTake(query));
    res
      .status(200)
      .json(successResponse(categories.map(toCategoryResponse), toPaginationMeta(query, total)));
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as unknown as CategoryIdParams;
    const category = await categoriesService.get(id);
    const canSeeInactive = req.auth?.permissions.has("categories:read") ?? false;
    if (!category.isActive && !canSeeInactive) {
      throw catalogErrors.notFound("Category");
    }
    res.status(200).json(successResponse(toCategoryResponse(category)));
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as unknown as CategoryIdParams;
    const category = await categoriesService.update(id, req.body as UpdateCategoryInput);
    await recordAudit(req, { action: "UPDATE_CATEGORY", entityType: "Category", entityId: id, after: category });
    res.status(200).json(successResponse(toCategoryResponse(category)));
  } catch (error) {
    next(error);
  }
}

export async function uploadImage(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      throw catalogErrors.validation({ fields: [{ path: "file", message: "No file was uploaded." }] });
    }
    const url = buildCategoryMediaUrl(req, req.file.filename);
    res.status(201).json(successResponse({ url }));
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as unknown as CategoryIdParams;
    const before = await categoriesService.get(id);
    await categoriesService.remove(id);
    await recordAudit(req, { action: "DELETE_CATEGORY", entityType: "Category", entityId: id, before });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
