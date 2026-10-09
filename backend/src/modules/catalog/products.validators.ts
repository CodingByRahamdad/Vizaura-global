import { z } from "zod";
import { paginationQuerySchema } from "./pagination.js";

// Transport-layer validation only. Business rules (slug/SKU uniqueness,
// default-variant invariant, market/category association rules) live in
// products.service.ts. See docs/modules/CATALOG.md.

export const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers and hyphens only.")
  .max(255);
const productName = z.string().trim().min(1).max(255);
const shortDescription = z.string().trim().max(512).optional();
const description = z.string().trim().max(20000).optional();
export const productStatus = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);
export const productBadge = z.enum(["BEST_SELLER", "NEW"]);
export const sku = z.string().trim().min(1).max(64);
const variantTitle = z.string().trim().min(1).max(150);
const marketCode = z.string().trim().toUpperCase().min(2).max(8);
const features = z.array(z.string().trim().min(1).max(200)).max(20).optional();
const specifications = z
  .array(
    z.object({
      key: z.string().trim().min(1).max(100),
      value: z.string().trim().min(1).max(500),
    }),
  )
  .max(50)
  .optional();
const benefits = z.array(z.string().trim().min(1).max(200)).max(20).optional();
const ingredients = z.array(z.string().trim().min(1).max(200)).max(20).optional();
const certifications = z.array(z.string().trim().min(1).max(200)).max(20).optional();
const storageInstructions = z.string().trim().max(500).optional();
const shelfLife = z.string().trim().max(200).optional();

export const createProductSchema = z.object({
  name: productName,
  slug: slug.optional(),
  shortDescription,
  description,
  status: productStatus.optional(),
  badge: productBadge.nullable().optional(),
  features,
  specifications,
  benefits,
  ingredients,
  certifications,
  storageInstructions,
  shelfLife,
  categoryIds: z.array(z.uuid()).max(50).optional(),
  markets: z
    .array(
      z.object({
        marketCode,
        isAvailable: z.boolean().optional(),
        isVisible: z.boolean().optional(),
      }),
    )
    .max(50)
    .optional(),
  defaultVariant: z
    .object({
      sku,
      title: variantTitle,
    })
    .optional(),
});

export const updateProductSchema = z
  .object({
    name: productName.optional(),
    slug: slug.optional(),
    shortDescription,
    description,
    status: productStatus.optional(),
    isActive: z.boolean().optional(),
    badge: productBadge.nullable().optional(),
    features,
    specifications,
    benefits,
    ingredients,
    certifications,
    storageInstructions,
    shelfLife,
  })
  .refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided." });

export const productIdParamsSchema = z.object({
  id: z.uuid(),
});

export const listProductsQuerySchema = paginationQuerySchema.extend({
  market: marketCode.optional(),
  category: z.uuid().optional(),
  status: productStatus.optional(),
  badge: productBadge.optional(),
  search: z.string().trim().min(1).max(255).optional(),
  // "card" resolves market-scoped price/stock/rating/image alongside each
  // row (GET /products?include=card) — an explicit opt-in so existing
  // summary-only callers keep their current response shape unchanged.
  // "admin" (Phase 6D) resolves raw per-market price/stock/category/media for
  // every market at once (not just the one named by `market`) and requires
  // `products:read` — enforced in the controller, not here, since the route
  // stays `optionalAuthenticate` for summary/card. `market` is ignored for
  // this value: admin management is never scoped to a single market.
  include: z.enum(["summary", "card", "admin"]).optional().default("summary"),
});

export const replaceCategoriesSchema = z.object({
  categoryIds: z.array(z.uuid()).max(50),
});

export const marketParamsSchema = z.object({
  id: z.uuid(),
  marketCode,
});

export const upsertProductMarketSchema = z.object({
  isAvailable: z.boolean().optional(),
  isVisible: z.boolean().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductIdParams = z.infer<typeof productIdParamsSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
export type ReplaceCategoriesInput = z.infer<typeof replaceCategoriesSchema>;
export type MarketParams = z.infer<typeof marketParamsSchema>;
export type UpsertProductMarketInput = z.infer<typeof upsertProductMarketSchema>;
