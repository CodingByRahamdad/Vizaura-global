import { Router } from "express";
import * as controller from "./auditLog.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { listAuditLogsQuerySchema } from "./auditLog.validators.js";

// Mounted at "/admin/audit-logs" (routes/index.ts). Read-only — no write
// route exists here or anywhere else; audit rows are only ever created via
// AuditLogService.record(), never through an HTTP body. `audit:read` is a
// deliberately narrower permission than every other `:read` key in this
// codebase — only super_admin/admin hold it (seed.ts) — matching the PRD's
// own "usually admin-only" phrasing (§2C.21) and the fact that audit rows
// can contain every other domain's before/after data.
export const adminAuditLogsRouter = Router();

adminAuditLogsRouter.get(
  "/",
  authenticate,
  requirePermission("audit:read"),
  validate({ query: listAuditLogsQuerySchema }),
  controller.listAdmin,
);
