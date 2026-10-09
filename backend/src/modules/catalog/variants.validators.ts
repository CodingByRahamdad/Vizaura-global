import { z } from "zod";
import { sku } from "./products.validators.js";

const variantStatus = z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]);
const variantTitle = z.string().trim().min(1).max(150);
const mediaType = z.enum(["IMAGE", "VIDEO"]);
const position = z.coerce.number().int().min(0).optional();

export const productIdParamsSchema = z.object({ productId: z.uuid() });
export const variantParamsSchema = z.object({ productId: z.uuid(), variantId: z.uuid() });
export const optionParamsSchema = z.object({ productId: z.uuid(), optionId: z.uuid() });
export const optionValueParamsSchema = z.object({
  productId: z.uuid(),
  optionId: z.uuid(),
  valueId: z.uuid(),
});
export const mediaParamsSchema = z.object({ productId: z.uuid(), mediaId: z.uuid() });

export const createVariantSchema = z.object({
  sku,
  title: variantTitle,
  status: variantStatus.optional(),
  position,
  isDefault: z.boolean().optional(),
  optionValueIds: z.array(z.uuid()).max(20).optional(),
});

export const updateVariantSchema = z
  .object({
    title: variantTitle.optional(),
    status: variantStatus.optional(),
    position,
    isDefault: z.boolean().optional(),
    optionValueIds: z.array(z.uuid()).max(20).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided." });

export const createOptionSchema = z.object({
  name: z.string().trim().min(1).max(64),
  position,
  values: z.array(z.string().trim().min(1).max(64)).min(1).max(50),
});

export const updateOptionSchema = z
  .object({
    name: z.string().trim().min(1).max(64).optional(),
    position,
  })
  .refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided." });

export const addOptionValueSchema = z.object({
  value: z.string().trim().min(1).max(64),
  position,
});

export const createMediaSchema = z.object({
  type: mediaType.optional(),
  url: z.url().max(2048),
  altText: z.string().trim().max(255).optional(),
  variantId: z.uuid().optional(),
  position,
  isPrimary: z.boolean().optional(),
});

export const updateMediaSchema = z
  .object({
    type: mediaType.optional(),
    url: z.url().max(2048).optional(),
    altText: z.string().trim().max(255).optional(),
    variantId: z.uuid().nullable().optional(),
    position,
    isPrimary: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided." });

export type ProductIdParams = z.infer<typeof productIdParamsSchema>;
export type VariantParams = z.infer<typeof variantParamsSchema>;
export type OptionParams = z.infer<typeof optionParamsSchema>;
export type OptionValueParams = z.infer<typeof optionValueParamsSchema>;
export type MediaParams = z.infer<typeof mediaParamsSchema>;
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
export type CreateOptionInput = z.infer<typeof createOptionSchema>;
export type UpdateOptionInput = z.infer<typeof updateOptionSchema>;
export type AddOptionValueInput = z.infer<typeof addOptionValueSchema>;
export type CreateMediaInput = z.infer<typeof createMediaSchema>;
export type UpdateMediaInput = z.infer<typeof updateMediaSchema>;
