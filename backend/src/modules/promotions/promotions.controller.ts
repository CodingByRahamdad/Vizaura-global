import type { NextFunction, Request, Response } from "express";
import { PromotionsService } from "./promotions.service.js";
import { toAdminPromotionResponse, toPublicPromotionResponse } from "./promotions.mapper.js";
import { successResponse } from "../../utils/apiResponse.js";
import { promotionsErrors } from "../../errors/AppError.js";
import { toSkipTake, toPaginationMeta } from "../catalog/pagination.js";
import { recordAudit } from "../audit/auditLog.helper.js";
import { notifyAdmins } from "../notifications/notifications.helper.js";
import { CustomerNotificationsService } from "../notifications/notifications.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { buildPromotionMediaUrl } from "../catalog/mediaStorage.js";
import type {
  BroadcastPromotionInput,
  CreatePromotionInput,
  ListAdminPromotionsQuery,
  PromotionIdParams,
  UpdatePromotionInput,
} from "./promotions.validators.js";

const promotionsService = new PromotionsService();
const customerNotificationsService = new CustomerNotificationsService();
const usersRepository = new UsersRepository();

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const promotion = await promotionsService.create(req.body as CreatePromotionInput);
    await recordAudit(req, { action: "CREATE_PROMOTION", entityType: "Promotion", entityId: promotion.id, after: promotion });
    await notifyAdmins({
      type: "PROMOTION_CREATED",
      title: "New promotion created",
      message: `"${promotion.title}" was added.`,
      entityType: "Promotion",
      entityId: promotion.id,
      requiredPermission: "promotions:read",
    });
    res.status(201).json(successResponse(toAdminPromotionResponse(promotion)));
  } catch (error) {
    next(error);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as ListAdminPromotionsQuery;
    const { skip, take } = toSkipTake(query);
    const result = await promotionsService.list(query, skip, take);
    res
      .status(200)
      .json(successResponse(result.promotions.map(toAdminPromotionResponse), toPaginationMeta(query, result.total)));
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as unknown as PromotionIdParams;
    const promotion = await promotionsService.get(id);
    res.status(200).json(successResponse(toAdminPromotionResponse(promotion)));
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as unknown as PromotionIdParams;
    const promotion = await promotionsService.update(id, req.body as UpdatePromotionInput);
    await recordAudit(req, { action: "UPDATE_PROMOTION", entityType: "Promotion", entityId: id, after: promotion });
    res.status(200).json(successResponse(toAdminPromotionResponse(promotion)));
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as unknown as PromotionIdParams;
    const before = await promotionsService.get(id);
    await promotionsService.remove(id);
    await recordAudit(req, { action: "DELETE_PROMOTION", entityType: "Promotion", entityId: id, before });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function uploadImage(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      throw promotionsErrors.validation({ fields: [{ path: "file", message: "No file was uploaded." }] });
    }
    const url = buildPromotionMediaUrl(req, req.file.filename);
    res.status(201).json(successResponse({ url }));
  } catch (error) {
    next(error);
  }
}

/// Minimal admin-triggered broadcast (no automatic trigger exists tied to
/// promotion create/update) — fans out one CustomerNotification per active
/// customer via a single batched insert. A direct admin action, so a
/// fan-out failure surfaces as a real error rather than being swallowed.
export async function broadcast(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, message } = req.body as BroadcastPromotionInput;
    const userIds = await usersRepository.listAllCustomerIds();
    const notifiedCount = await customerNotificationsService.broadcast(userIds, {
      type: "PROMOTION",
      title,
      message,
    });
    await recordAudit(req, {
      action: "BROADCAST_PROMOTION_NOTIFICATION",
      entityType: "Promotion",
      entityId: "broadcast",
      after: { title, message, notifiedCount },
    });
    res.status(200).json(successResponse({ notifiedCount }));
  } catch (error) {
    next(error);
  }
}

/// Public, unauthenticated — backs the homepage Promotion Section.
export async function listActive(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await promotionsService.getActiveForHomepage();
    res.status(200).json(
      successResponse({
        layout: result.layout,
        promotions: result.promotions.map(toPublicPromotionResponse),
      }),
    );
  } catch (error) {
    next(error);
  }
}
