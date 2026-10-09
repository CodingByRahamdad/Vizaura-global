import { z } from "zod";

// Transport-layer validation only. Business rules (market activeness, cart
// state, catalog/price/stock re-validation, payment-method/coupon support)
// live in checkout.service.ts. See docs/modules/CHECKOUT.md.

const marketCode = z.string().trim().toUpperCase().min(2).max(8);

// No Customers/Address domain exists yet — this is an inline snapshot
// object, not a reference to a stored, reusable address (see
// docs/modules/CHECKOUT.md's documented deviation from the PRD's literal
// `shippingAddressId` field). Exported so the Orders module's admin
// create-order validator can reuse the identical shape instead of
// redefining it.
export const shippingAddressSchema = z.object({
  fullName: z.string().trim().min(1).max(150),
  phone: z.string().trim().min(1).max(32),
  line1: z.string().trim().min(1).max(255),
  line2: z.string().trim().max(255).optional(),
  city: z.string().trim().min(1).max(100),
  region: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
  countryCode: z.string().trim().toUpperCase().length(2),
});

export const checkoutQuerySchema = z.object({
  market: marketCode,
});

export const checkoutBodySchema = z
  .object({
    // Always collected — the order's billing/payment address. Used as the
    // shipping address too unless shipToDifferentAddress is true.
    billingAddress: shippingAddressSchema,
    shipToDifferentAddress: z.boolean().default(false),
    // Required when shipToDifferentAddress is true, rejected (not silently
    // dropped) when false — see the .refine below.
    shippingAddress: shippingAddressSchema.optional(),
    // Plain string, not a fixed enum — only "COD" is accepted this phase
    // (checkout.service.ts), but the schema itself doesn't hard-code the
    // eventual provider list, since the PRD explicitly leaves it open.
    paymentMethod: z.string().trim().toUpperCase().min(1).max(32),
    // Phase 4M: resolved server-side to a real, market-scoped ShippingMethod
    // — checkout.service.ts looks it up and computes shippingAmount from it
    // (baseRate, or 0 past freeShippingThreshold). Never a client-supplied
    // cost. Replaces the earlier informational-only `shippingMethod` string,
    // now that a Shipping domain exists to back it.
    shippingMethodId: z.string().uuid(),
    // Accepted so a coupon-bearing request gets an explicit, honest rejection
    // (CHECKOUT_COUPON_UNSUPPORTED) rather than being silently dropped.
    couponCode: z.string().trim().min(1).max(64).optional(),
  })
  .refine((body) => body.shipToDifferentAddress === Boolean(body.shippingAddress), {
    message: "shippingAddress is required when shipToDifferentAddress is true, and must be omitted otherwise.",
    path: ["shippingAddress"],
  });

export type CheckoutQuery = z.infer<typeof checkoutQuerySchema>;
export type CheckoutInput = z.infer<typeof checkoutBodySchema>;
export type ShippingAddressInput = z.infer<typeof shippingAddressSchema>;
