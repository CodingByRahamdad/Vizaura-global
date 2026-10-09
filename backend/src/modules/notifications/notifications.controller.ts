import type { NextFunction, Request, Response } from "express";
import { CustomerNotificationsService, NotificationsService } from "./notifications.service.js";
import { successResponse } from "../../utils/apiResponse.js";
import { authErrors } from "../../errors/AppError.js";
import type {
  ListCustomerNotificationsQuery,
  ListNotificationsQuery,
  NotificationIdParams,
} from "./notifications.validators.js";

const notificationsService = new NotificationsService();
const customerNotificationsService = new CustomerNotificationsService();

// The set of domain permissions a notification can ever be scoped to —
// intersected against the caller's own permissions so each admin only ever
// sees events for domains they can already read, same posture as
// search.service.ts.
const NOTIFICATION_PERMISSION_KEYS = [
  "orders:read",
  "customers:read",
  "products:read",
  "categories:read",
  "reviews:read",
  "promotions:read",
];

function allowedPermissionsOf(req: Request): string[] {
  const permissions = req.auth?.permissions ?? new Set<string>();
  return NOTIFICATION_PERMISSION_KEYS.filter((key) => permissions.has(key));
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw authErrors.unauthorized();
    const query = req.query as unknown as ListNotificationsQuery;
    const { rows, total } = await notificationsService.list(req.auth.userId, allowedPermissionsOf(req), {
      skip: query.cursor,
      take: query.limit,
      unreadOnly: query.unreadOnly ?? false,
    });
    res.status(200).json(successResponse(rows, { total, nextCursor: query.cursor + rows.length }));
  } catch (error) {
    next(error);
  }
}

export async function unreadCount(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw authErrors.unauthorized();
    const count = await notificationsService.unreadCount(req.auth.userId, allowedPermissionsOf(req));
    res.status(200).json(successResponse({ count }));
  } catch (error) {
    next(error);
  }
}

export async function markRead(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw authErrors.unauthorized();
    const { id } = req.params as unknown as NotificationIdParams;
    await notificationsService.markRead(id, req.auth.userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function markAllRead(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw authErrors.unauthorized();
    await notificationsService.markAllRead(req.auth.userId, allowedPermissionsOf(req));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

// -- Customer-facing notification feed (ownership-scoped, no permission gate) ---

function requireUserId(req: Request): string {
  if (!req.auth) throw authErrors.unauthorized();
  return req.auth.userId;
}

export async function listMine(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireUserId(req);
    const query = req.query as unknown as ListCustomerNotificationsQuery;
    const { rows, total } = await customerNotificationsService.list(userId, {
      skip: query.cursor,
      take: query.limit,
      unreadOnly: query.unreadOnly ?? false,
    });
    res.status(200).json(successResponse(rows, { total, nextCursor: query.cursor + rows.length }));
  } catch (error) {
    next(error);
  }
}

export async function unreadCountMine(req: Request, res: Response, next: NextFunction) {
  try {
    const count = await customerNotificationsService.unreadCount(requireUserId(req));
    res.status(200).json(successResponse({ count }));
  } catch (error) {
    next(error);
  }
}

export async function markMineRead(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireUserId(req);
    const { id } = req.params as unknown as NotificationIdParams;
    await customerNotificationsService.markRead(id, userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function markAllMineRead(req: Request, res: Response, next: NextFunction) {
  try {
    await customerNotificationsService.markAllRead(requireUserId(req));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
