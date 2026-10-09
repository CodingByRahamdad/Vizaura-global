import { Router } from "express";
import * as users from "./users.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { adminResetPasswordLimiter } from "../../middleware/rateLimiters.js";
import {
  listAdminUsersQuerySchema,
  updateUserRoleBodySchema,
  updateUserStatusBodySchema,
  userIdParamsSchema,
  listAdminCustomersQuerySchema,
  createCustomerBodySchema,
  updateCustomerBodySchema,
} from "./users.validators.js";

// Mounted at "/admin/users" (routes/index.ts) — same dedicated "/admin"
// prefix pattern orders.routes.ts/returns.routes.ts/analytics.routes.ts
// established. No public/customer-facing router exists in this module —
// /auth/me remains the only self-service user read (auth.routes.ts).
export const adminUsersRouter = Router();

adminUsersRouter.get(
  "/",
  authenticate,
  requirePermission("users:read"),
  validate({ query: listAdminUsersQuerySchema }),
  users.listAdmin,
);

adminUsersRouter.get(
  "/:id",
  authenticate,
  requirePermission("users:read"),
  validate({ params: userIdParamsSchema }),
  users.getById,
);

adminUsersRouter.patch(
  "/:id/status",
  authenticate,
  requirePermission("users:update"),
  validate({ params: userIdParamsSchema, body: updateUserStatusBodySchema }),
  users.updateStatus,
);

adminUsersRouter.patch(
  "/:id/role",
  authenticate,
  requirePermission("roles:assign"),
  validate({ params: userIdParamsSchema, body: updateUserRoleBodySchema }),
  users.updateRole,
);

adminUsersRouter.post(
  "/:id/reset-password",
  authenticate,
  requirePermission("users:update"),
  adminResetPasswordLimiter,
  validate({ params: userIdParamsSchema }),
  users.resetPassword,
);

// Customers module (Phase 6M) — mounted separately at "/admin/customers"
// (routes/index.ts), gated by the dedicated customers:* permissions rather
// than users:*/roles:* (see docs/RBAC.md). Same User table underneath
// (UsersService hardcodes roleKey="customer" — see users.service.ts), a
// different admin-facing lens, not a second entity.
export const adminCustomersRouter = Router();

adminCustomersRouter.get(
  "/",
  authenticate,
  requirePermission("customers:read"),
  validate({ query: listAdminCustomersQuerySchema }),
  users.listCustomers,
);

adminCustomersRouter.post(
  "/",
  authenticate,
  requirePermission("customers:create"),
  validate({ body: createCustomerBodySchema }),
  users.createCustomer,
);

adminCustomersRouter.get(
  "/:id",
  authenticate,
  requirePermission("customers:read"),
  validate({ params: userIdParamsSchema }),
  users.getCustomerById,
);

adminCustomersRouter.patch(
  "/:id/status",
  authenticate,
  requirePermission("customers:update"),
  validate({ params: userIdParamsSchema, body: updateUserStatusBodySchema }),
  users.updateCustomerStatus,
);

adminCustomersRouter.patch(
  "/:id",
  authenticate,
  requirePermission("customers:update"),
  validate({ params: userIdParamsSchema, body: updateCustomerBodySchema }),
  users.updateCustomer,
);

adminCustomersRouter.delete(
  "/:id",
  authenticate,
  requirePermission("customers:delete"),
  validate({ params: userIdParamsSchema }),
  users.deleteCustomer,
);
