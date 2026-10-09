import { z } from "zod";
import { paginationQuerySchema } from "../catalog/pagination.js";
import { shippingAddressSchema } from "../checkout/checkout.validators.js";

// Transport-layer validation only. Business rules (ownership, permission,
// state-machine transitions) live in orders.service.ts. See
// docs/modules/ORDERS.md.

const orderStatusValues = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
  "REFUNDED",
  "RETURNED",
] as const;

const orderPaymentStatusValues = [
  "PENDING",
  "AUTHORIZED",
  "PAID",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
] as const;

export const orderIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const listOwnOrdersQuerySchema = paginationQuerySchema.extend({
  status: z.enum(orderStatusValues).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

const shipmentStatusValues = [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "IN_TRANSIT",
  "DELIVERED",
  "RETURNED",
  "CANCELLED",
] as const;

// A date-only upper bound ("2026-09-25") means "through the end of that day",
// not midnight at its start — otherwise an admin filtering to a single day
// would miss every order placed after 00:00 UTC.
const inclusiveDateTo = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const parsed = new Date(isDateOnly ? `${value}T23:59:59.999Z` : value);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid date" });
      return z.NEVER;
    }
    return parsed;
  });

export const listAdminOrdersQuerySchema = paginationQuerySchema.extend({
  status: z.enum(orderStatusValues).optional(),
  paymentStatus: z.enum(orderPaymentStatusValues).optional(),
  shipmentStatus: z.enum(shipmentStatusValues).optional(),
  market: z.string().trim().toUpperCase().min(2).max(8).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: inclusiveDateTo.optional(),
  search: z.string().trim().min(1).max(100).optional(),
  // Named "customer" to match the PRD's literal filter name; mapped to
  // Order.userId internally by orders.service.ts.
  customer: z.string().uuid().optional(),
  orderNumber: z.string().trim().min(1).max(32).optional(),
});

// Transitions this phase's state machine can produce (see orders.service.ts
// ORDER_TRANSITIONS table) — REFUNDED/RETURNED/FAILED are never a PATCH
// target here (payment/returns-domain-driven), so they're excluded from
// this schema entirely rather than accepted-then-rejected.
export const updateOrderStatusBodySchema = z.object({
  status: z.enum(["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED"]),
  reason: z.string().trim().min(1).max(255).optional(),
});

// Admin create-order (POST /admin/orders) — phone/WhatsApp/walk-in orders
// entered by staff on an existing customer's behalf. Lines must reference
// real catalog products/variants (re-validated in orders.service.ts exactly
// like checkout.service.ts#buildAndValidateLines), never free-text items,
// so inventory/pricing stay accurate. shippingAddress reuses Checkout's own
// schema rather than redefining the identical shape.
const adminOrderLineSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1),
  // Admin price override — defaults to the catalog's live price for this
  // variant+market when omitted. Still an Int minor-units amount, same
  // convention as every other monetary field.
  unitAmountOverride: z.coerce.number().int().min(0).optional(),
});

export const createAdminOrderBodySchema = z
  .object({
    // Exactly one of userId/guestEmail must be supplied — see the .refine
    // below. userId: an existing, registered customer. guestEmail: a
    // phone/WhatsApp/walk-in customer with no account; their name/phone/
    // address come entirely from shippingAddress, no User row is created.
    userId: z.string().uuid().optional(),
    guestEmail: z.string().trim().toLowerCase().pipe(z.email().max(255)).optional(),
    market: z.string().trim().toUpperCase().min(2).max(8),
    // Admin-specific tags (CASH/BANK_TRANSFER/OTHER) distinct from the online
    // checkout's COD/MOCK — service-layer validation, not a fixed enum here,
    // same "transport-layer only" posture checkoutBodySchema.paymentMethod
    // already follows.
    paymentMethod: z.string().trim().toUpperCase().min(1).max(32),
    // Offline orders are frequently already paid (cash/bank transfer) at the
    // moment of entry — the admin sets this directly instead of going through
    // Payments' mark-paid flow afterward. PENDING is still the default.
    paymentStatus: z.enum(["PENDING", "PAID"]).default("PENDING"),
    billingAddress: shippingAddressSchema,
    shipToDifferentAddress: z.boolean().default(false),
    shippingAddress: shippingAddressSchema.optional(),
    lines: z.array(adminOrderLineSchema).min(1),
  })
  .refine((body) => Boolean(body.userId) !== Boolean(body.guestEmail), {
    message: "Provide either an existing customer's userId or a guestEmail, not both or neither.",
    path: ["userId"],
  })
  .refine((body) => body.shipToDifferentAddress === Boolean(body.shippingAddress), {
    message: "shippingAddress is required when shipToDifferentAddress is true, and must be omitted otherwise.",
    path: ["shippingAddress"],
  });

// Admin edit (PATCH /admin/orders/:id) — only reachable while the order is
// still fully mutable (orderMutability.helper.ts#assertOrderIsMutable).
// A line edit is exactly one of: remove an existing line (id + remove),
// adjust an existing line's quantity/price (id, no remove), or add a brand
// new line (no id, productId+variantId+quantity required — re-validated
// against the live catalog in orders.service.ts, same as adminOrderLineSchema).
const editOrderLineSchema = z
  .object({
    id: z.string().uuid().optional(),
    remove: z.boolean().optional(),
    productId: z.string().uuid().optional(),
    variantId: z.string().uuid().optional(),
    quantity: z.coerce.number().int().min(1).optional(),
    unitAmountOverride: z.coerce.number().int().min(0).optional(),
  })
  .refine(
    (line) => {
      if (line.id) {
        // Existing line: either remove it, or change its quantity/price —
        // never both a remove flag and a quantity/price change.
        if (line.remove) return line.quantity === undefined && line.unitAmountOverride === undefined;
        return line.quantity !== undefined || line.unitAmountOverride !== undefined;
      }
      // New line: no id, no remove, must supply enough to add it.
      return !line.remove && Boolean(line.productId) && Boolean(line.variantId) && line.quantity !== undefined;
    },
    { message: "Each line edit must be a remove (id+remove), a quantity/price change (id+quantity|unitAmountOverride), or a new line (productId+variantId+quantity, no id)." },
  );

export const editAdminOrderBodySchema = z
  .object({
    billingAddress: shippingAddressSchema.optional(),
    shippingAddress: shippingAddressSchema.optional(),
    items: z.array(editOrderLineSchema).optional(),
  })
  .refine((body) => Boolean(body.billingAddress) || Boolean(body.shippingAddress) || (body.items && body.items.length > 0), {
    message: "Provide at least one of billingAddress, shippingAddress, or items to edit.",
  });

export type OrderIdParams = z.infer<typeof orderIdParamsSchema>;
export type ListOwnOrdersQuery = z.infer<typeof listOwnOrdersQuerySchema>;
export type ListAdminOrdersQuery = z.infer<typeof listAdminOrdersQuerySchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusBodySchema>;
export type CreateAdminOrderInput = z.infer<typeof createAdminOrderBodySchema>;
export type AdminOrderLineInput = z.infer<typeof adminOrderLineSchema>;
export type EditAdminOrderInput = z.infer<typeof editAdminOrderBodySchema>;
export type EditOrderLineInput = z.infer<typeof editOrderLineSchema>;
