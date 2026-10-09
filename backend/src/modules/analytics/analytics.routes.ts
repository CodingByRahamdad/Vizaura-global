import { Router } from "express";
import * as analytics from "./analytics.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { dashboardQuerySchema } from "./analytics.validators.js";

// Mounted at "/admin/analytics" (routes/index.ts) — same dedicated
// "/admin" prefix pattern orders.routes.ts/inventory.routes.ts established.
export const adminAnalyticsRouter = Router();

adminAnalyticsRouter.get(
  "/dashboard",
  authenticate,
  requirePermission("analytics:read"),
  validate({ query: dashboardQuerySchema }),
  analytics.getDashboard,
);
