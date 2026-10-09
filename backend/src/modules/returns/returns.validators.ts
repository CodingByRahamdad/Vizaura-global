import { z } from "zod";
import { paginationQuerySchema } from "../catalog/pagination.js";

const returnStatusValues = ["REQUESTED", "APPROVED", "REJECTED", "RECEIVED", "REFUNDED"] as const;

export const returnIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const orderIdParamsSchema = z.object({
  orderId: z.string().uuid(),
});

export const createReturnBodySchema = z.object({
  // Customer-supplied, optional — no PRD reason enum.
  reason: z.string().trim().min(1).max(255).optional(),
  items: z
    .array(
      z.object({
        orderItemId: z.string().uuid(),
        quantity: z.coerce.number().int().positive(),
      }),
    )
    .min(1)
    .max(100)
    .refine((items) => new Set(items.map((i) => i.orderItemId)).size === items.length, {
      message: "Each orderItemId may appear at most once per return request.",
    }),
});

export const rejectReturnBodySchema = z.object({
  rejectionReason: z.string().trim().min(1).max(255),
});

export const listAdminReturnsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(returnStatusValues).optional(),
  orderId: z.string().uuid().optional(),
});

export type ReturnIdParams = z.infer<typeof returnIdParamsSchema>;
export type OrderIdParams = z.infer<typeof orderIdParamsSchema>;
export type CreateReturnInput = z.infer<typeof createReturnBodySchema>;
export type RejectReturnInput = z.infer<typeof rejectReturnBodySchema>;
export type ListAdminReturnsQuery = z.infer<typeof listAdminReturnsQuerySchema>;
