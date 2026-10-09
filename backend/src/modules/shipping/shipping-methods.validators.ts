import { z } from "zod";
import { paginationQuerySchema } from "../catalog/pagination.js";

// Transport-layer validation only. Business rules (market activeness,
// isActive archiving) live in shipping-methods.service.ts. See
// docs/modules/SHIPPING.md.

const marketCode = z.string().trim().toUpperCase().min(2).max(8);
// Mirrors the money ceiling used elsewhere in this schema (docs/DATABASE.md).
const money = z.coerce.number().int().min(0).max(2_100_000_000);
const days = z.coerce.number().int().min(0).max(365);

export const shippingMethodIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const publicListShippingMethodsQuerySchema = z.object({
  market: marketCode,
});

export const listAdminShippingMethodsQuerySchema = paginationQuerySchema.extend({
  market: marketCode.optional(),
  isActive: z.coerce.boolean().optional(),
});

export const createShippingMethodSchema = z.object({
  marketCode,
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(512).optional(),
  baseRate: money,
  freeShippingThreshold: money.optional(),
  estimatedMinDays: days.optional(),
  estimatedMaxDays: days.optional(),
  isActive: z.boolean().optional(),
});

export const updateShippingMethodSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(512).optional(),
  baseRate: money.optional(),
  freeShippingThreshold: money.optional(),
  estimatedMinDays: days.optional(),
  estimatedMaxDays: days.optional(),
  isActive: z.boolean().optional(),
});

export type ShippingMethodIdParams = z.infer<typeof shippingMethodIdParamsSchema>;
export type PublicListShippingMethodsQuery = z.infer<typeof publicListShippingMethodsQuerySchema>;
export type ListAdminShippingMethodsQuery = z.infer<typeof listAdminShippingMethodsQuerySchema>;
export type CreateShippingMethodInput = z.infer<typeof createShippingMethodSchema>;
export type UpdateShippingMethodInput = z.infer<typeof updateShippingMethodSchema>;
