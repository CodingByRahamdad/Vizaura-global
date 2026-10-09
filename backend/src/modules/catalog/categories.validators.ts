import { z } from "zod";
import { paginationQuerySchema } from "./pagination.js";

// Transport-layer validation only (shape, type, length, format). Business
// rules (slug uniqueness, parent-cycle prevention, in-use deletion blocks)
// live in categories.service.ts. See docs/modules/CATALOG.md.

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers and hyphens only.")
  .max(255);
const categoryName = z.string().trim().min(1).max(150);
const description = z.string().trim().max(5000).optional();
const imageUrl = z.url().max(2048).optional();
const position = z.coerce.number().int().min(0).optional();

export const createCategorySchema = z.object({
  name: categoryName,
  slug: slug.optional(),
  parentId: z.uuid().optional(),
  description,
  imageUrl,
  isActive: z.boolean().optional(),
  position,
});

export const updateCategorySchema = z
  .object({
    name: categoryName.optional(),
    slug: slug.optional(),
    parentId: z.uuid().nullable().optional(),
    // null clears the field (an admin must be able to remove a description
    // or image, not just replace it).
    description: description.nullable(),
    imageUrl: imageUrl.nullable(),
    isActive: z.boolean().optional(),
    position,
  })
  .refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided." });

export const categoryIdParamsSchema = z.object({
  id: z.uuid(),
});

export const listCategoriesQuerySchema = paginationQuerySchema.extend({
  parentId: z.uuid().optional(),
  includeInactive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  // "count" resolves each category's real product count alongside it
  // (GET /categories?include=count&market=PK) — explicit opt-in, market is
  // only meaningful together with it (which products count is market-scoped).
  // "admin" (categories:read required, else 403) adds the all-status
  // productCount + childCount an admin needs to judge whether a category is
  // safe to delete — see categories.service.ts::listForAdmin.
  include: z.enum(["summary", "count", "admin"]).optional().default("summary"),
  market: z
    .string()
    .trim()
    .toUpperCase()
    .min(2)
    .max(8)
    .optional(),
  search: z.string().trim().min(1).max(100).optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CategoryIdParams = z.infer<typeof categoryIdParamsSchema>;
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
