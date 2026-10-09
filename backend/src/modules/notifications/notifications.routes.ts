import { Router } from "express";
import * as controller from "./notifications.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import {
  listCustomerNotificationsQuerySchema,
  listNotificationsQuerySchema,
  notificationIdParamsSchema,
} from "./notifications.validators.js";

// Mounted at "/admin/notifications" (routes/index.ts). Rows are themselves
// filtered per-domain by NotificationsService (same posture as the search
// module) — "notifications:read"/"notifications:update" just gate whether
// this admin has the feature at all.
export const adminNotificationsRouter = Router();

adminNotificationsRouter.get(
  "/",
  authenticate,
  requirePermission("notifications:read"),
  validate({ query: listNotificationsQuerySchema }),
  controller.list,
);

adminNotificationsRouter.get(
  "/unread-count",
  authenticate,
  requirePermission("notifications:read"),
  controller.unreadCount,
);

adminNotificationsRouter.patch(
  "/read-all",
  authenticate,
  requirePermission("notifications:update"),
  controller.markAllRead,
);

adminNotificationsRouter.patch(
  "/:id/read",
  authenticate,
  requirePermission("notifications:update"),
  validate({ params: notificationIdParamsSchema }),
  controller.markRead,
);

// Mounted at "/notifications" (routes/index.ts) — a flat top-level domain,
// same posture as Wishlist/Addresses. Ownership-scoped (no permission check
// — Customer role holds no permissions): a customer's own notification feed,
// distinct storage and visibility model from the admin router above.
export const customerNotificationsRouter = Router();

customerNotificationsRouter.get(
  "/",
  authenticate,
  validate({ query: listCustomerNotificationsQuerySchema }),
  controller.listMine,
);

customerNotificationsRouter.get("/unread-count", authenticate, controller.unreadCountMine);

customerNotificationsRouter.patch("/read-all", authenticate, controller.markAllMineRead);

customerNotificationsRouter.patch(
  "/:id/read",
  authenticate,
  validate({ params: notificationIdParamsSchema }),
  controller.markMineRead,
);
