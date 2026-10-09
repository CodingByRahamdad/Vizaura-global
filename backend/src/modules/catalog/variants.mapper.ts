import type { ProductMedia, ProductOption, ProductOptionValue, ProductVariant } from "../../generated/prisma/client.js";

export interface VariantResponse {
  id: string;
  productId: string;
  sku: string;
  title: string;
  status: string;
  position: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toVariantResponse(variant: ProductVariant): VariantResponse {
  return {
    id: variant.id,
    productId: variant.productId,
    sku: variant.sku,
    title: variant.title,
    status: variant.status,
    position: variant.position,
    isDefault: variant.isDefault,
    createdAt: variant.createdAt.toISOString(),
    updatedAt: variant.updatedAt.toISOString(),
  };
}

export interface OptionValueResponse {
  id: string;
  optionId: string;
  value: string;
  position: number;
}

export function toOptionValueResponse(value: ProductOptionValue): OptionValueResponse {
  return { id: value.id, optionId: value.optionId, value: value.value, position: value.position };
}

export interface OptionResponse {
  id: string;
  productId: string;
  name: string;
  position: number;
  values: OptionValueResponse[];
}

/// `values` is included when the caller already has the created/loaded
/// value rows on hand (e.g. right after createOption) — otherwise it's
/// omitted from the source object and defaults to an empty array, since
/// this mapper never queries the database itself.
export function toOptionResponse(option: ProductOption & { values?: ProductOptionValue[] }): OptionResponse {
  return {
    id: option.id,
    productId: option.productId,
    name: option.name,
    position: option.position,
    values: (option.values ?? []).map(toOptionValueResponse),
  };
}

export interface MediaResponse {
  id: string;
  productId: string;
  variantId: string | null;
  type: string;
  url: string;
  altText: string | null;
  position: number;
  isPrimary: boolean;
}

export function toMediaResponse(media: ProductMedia): MediaResponse {
  return {
    id: media.id,
    productId: media.productId,
    variantId: media.variantId,
    type: media.type,
    url: media.url,
    altText: media.altText,
    position: media.position,
    isPrimary: media.isPrimary,
  };
}
