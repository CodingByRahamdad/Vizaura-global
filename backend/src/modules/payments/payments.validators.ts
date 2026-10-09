import { z } from "zod";
import { paginationQuerySchema } from "../catalog/pagination.js";

const paymentStatusValues = [
  "PENDING",
  "AUTHORIZED",
  "PAID",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
] as const;

export const paymentIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const listAdminPaymentsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(paymentStatusValues).optional(),
  provider: z.string().trim().toUpperCase().min(1).max(32).optional(),
  orderId: z.string().uuid().optional(),
});

export const markFailedBodySchema = z.object({
  reason: z.string().trim().min(1).max(255),
});

export const refundBodySchema = z.object({
  // Omitted amount means "refund the full remaining captured amount" —
  // resolved server-side in payments.service.ts, never client-computed.
  amount: z.coerce.number().int().positive().optional(),
});

export const markRefundedBodySchema = z.object({
  amount: z.coerce.number().int().positive().optional(),
  // Staff-supplied refund reference (e.g. a cash receipt/voucher number) —
  // COD has no provider to produce one, so this is stored in place of
  // providerReference. Optional: falls back to `staff:<actorUserId>` in
  // payments.service.ts if omitted.
  reference: z.string().trim().min(1).max(255).optional(),
});

export type PaymentIdParams = z.infer<typeof paymentIdParamsSchema>;
export type ListAdminPaymentsQuery = z.infer<typeof listAdminPaymentsQuerySchema>;
export type MarkFailedInput = z.infer<typeof markFailedBodySchema>;
export type RefundInput = z.infer<typeof refundBodySchema>;
export type MarkRefundedInput = z.infer<typeof markRefundedBodySchema>;
