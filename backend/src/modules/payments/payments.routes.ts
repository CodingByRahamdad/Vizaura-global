import { Router } from "express";
import * as payments from "./payments.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import {
  listAdminPaymentsQuerySchema,
  markFailedBodySchema,
  markRefundedBodySchema,
  paymentIdParamsSchema,
  refundBodySchema,
} from "./payments.validators.js";

// Mounted at "/payments" (routes/index.ts). GET /:id is ownership-or-
// payments:read (Customer role holds no permissions — RBAC.md, same posture
// Orders established). POST /:id/refund is payments:refund-gated only — no
// ownership path, since a customer never legitimately triggers their own
// refund; payments:refund is granted only to super_admin for now (seed.ts —
// Phase 6E collapsed the seeded role set to super_admin/customer).
export const paymentsRouter = Router();

paymentsRouter.get("/:id", authenticate, validate({ params: paymentIdParamsSchema }), payments.getById);

paymentsRouter.post(
  "/:id/refund",
  authenticate,
  requirePermission("payments:refund"),
  validate({ params: paymentIdParamsSchema, body: refundBodySchema }),
  payments.refund,
);

// Mounted at "/admin/payments" — same split-router pattern Orders
// established (docs/modules/ORDERS.md).
export const adminPaymentsRouter = Router();

adminPaymentsRouter.get(
  "/",
  authenticate,
  requirePermission("payments:read"),
  validate({ query: listAdminPaymentsQuerySchema }),
  payments.listAdmin,
);

adminPaymentsRouter.patch(
  "/:id/mark-paid",
  authenticate,
  requirePermission("payments:update"),
  validate({ params: paymentIdParamsSchema }),
  payments.markPaid,
);

adminPaymentsRouter.patch(
  "/:id/mark-failed",
  authenticate,
  requirePermission("payments:update"),
  validate({ params: paymentIdParamsSchema, body: markFailedBodySchema }),
  payments.markFailed,
);

// COD-only refund attestation (Phase 4O) — payments:refund-gated, same
// permission as the provider-calling refund() above, since this moves an
// equivalent financial record (a REFUND PaymentTransaction) without a
// provider to verify it. Not payments:update — mark-paid/mark-failed are a
// lesser action (settling a still-PENDING payment), refunding money after
// capture warrants the stricter permission.
adminPaymentsRouter.patch(
  "/:id/mark-refunded",
  authenticate,
  requirePermission("payments:refund"),
  validate({ params: paymentIdParamsSchema, body: markRefundedBodySchema }),
  payments.markRefunded,
);
