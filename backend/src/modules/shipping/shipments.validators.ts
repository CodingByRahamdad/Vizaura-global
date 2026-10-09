import { z } from "zod";
import { paginationQuerySchema } from "../catalog/pagination.js";

const shipmentStatusValues = [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "IN_TRANSIT",
  "DELIVERED",
  "RETURNED",
  "CANCELLED",
  "ITEM_RETURNED",
  "ITEM_LOST",
] as const;

export const shipmentIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const orderIdParamsSchema = z.object({
  orderId: z.string().uuid(),
});

export const listAdminShipmentsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(shipmentStatusValues).optional(),
  orderId: z.string().uuid().optional(),
});

export const updateShipmentBodySchema = z.object({
  status: z.enum(shipmentStatusValues),
  trackingNumber: z.string().trim().min(1).max(100).optional(),
  carrier: z.string().trim().min(1).max(100).optional(),
});

export type ShipmentIdParams = z.infer<typeof shipmentIdParamsSchema>;
export type OrderIdParams = z.infer<typeof orderIdParamsSchema>;
export type ListAdminShipmentsQuery = z.infer<typeof listAdminShipmentsQuerySchema>;
export type UpdateShipmentInput = z.infer<typeof updateShipmentBodySchema>;
