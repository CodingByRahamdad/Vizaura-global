import type { Market, Product, VariantPrice, VariantStock } from "../../generated/prisma/client.js";
import type { ProductAdminRow, ProductCardRow, ProductDetail } from "./products.repository.js";
import { toAdminPriceResponse, toPublicPriceResponse, type AdminPriceResponse, type PublicPriceResponse } from "../pricing/pricing.mapper.js";
import { toAdminStockResponse, toPublicStockResponse, type AdminStockResponse, type PublicStockResponse } from "../inventory/inventory.mapper.js";
import type { RatingAggregate } from "../reviews/reviews.repository.js";

export interface ProductSummaryResponse {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  status: string;
  isActive: boolean;
  badge: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toProductSummary(product: Product): ProductSummaryResponse {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    shortDescription: product.shortDescription,
    status: product.status,
    isActive: product.isActive,
    badge: product.badge,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

/// Storefront listing/card shape — GET /products?include=card. Reuses
/// Pricing's and Inventory's own public-safe mapper functions verbatim so a
/// card can never leak an admin-only field (raw onHand/reserved, non-
/// effective price, ids, isActive) that the single-variant public endpoints
/// don't already expose.
export interface ProductCardResponse extends ProductSummaryResponse {
  imageUrl: string | null;
  defaultVariantId: string | null;
  price: PublicPriceResponse | null;
  stock: PublicStockResponse | null;
  rating: number | null;
  reviewCount: number;
}

export function toProductCardResponse(
  product: ProductCardRow,
  price: (VariantPrice & { market: Market }) | undefined,
  stock: (VariantStock & { market: Market }) | undefined,
  ratingAggregate: RatingAggregate | undefined,
): ProductCardResponse {
  return {
    ...toProductSummary(product),
    imageUrl: product.primaryMediaUrl,
    defaultVariantId: product.defaultVariantId,
    price: price ? toPublicPriceResponse(price) : null,
    stock: stock ? toPublicStockResponse(stock) : null,
    rating: ratingAggregate?.averageRating ?? null,
    reviewCount: ratingAggregate?.reviewCount ?? 0,
  };
}

/// Admin listing shape — GET /products?include=admin (products:read only).
/// Unlike the card shape, this exposes raw per-market price/stock (not the
/// resolved/effective public view) and every market at once, since admin
/// management is never scoped to a single market. Reuses Pricing's and
/// Inventory's own admin mapper functions verbatim — the same cross-module
/// precedent toProductCardResponse already sets for the public mappers.
export interface ProductAdminListResponse extends ProductSummaryResponse {
  imageUrl: string | null;
  variantCount: number;
  categories: { id: string; name: string }[];
  markets: {
    code: string;
    name: string;
    isAvailable: boolean;
    isVisible: boolean;
    price: AdminPriceResponse | null;
    stock: AdminStockResponse | null;
  }[];
}

export function toProductAdminListResponse(
  product: ProductAdminRow,
  prices: (VariantPrice & { market: Market })[],
  stocks: (VariantStock & { market: Market })[],
): ProductAdminListResponse {
  const priceByMarketCode = new Map(prices.map((price) => [price.market.code, price]));
  const stockByMarketCode = new Map(stocks.map((stock) => [stock.market.code, stock]));

  return {
    ...toProductSummary(product),
    imageUrl: product.primaryMediaUrl,
    variantCount: product.variantCount,
    categories: product.categories,
    markets: product.marketAvailability.map((availability) => {
      const price = priceByMarketCode.get(availability.market.code);
      const stock = stockByMarketCode.get(availability.market.code);
      return {
        code: availability.market.code,
        name: availability.market.name,
        isAvailable: availability.isAvailable,
        isVisible: availability.isVisible,
        price: price ? toAdminPriceResponse(price) : null,
        stock: stock ? toAdminStockResponse(stock) : null,
      };
    }),
  };
}

export interface ProductDetailResponse extends ProductSummaryResponse {
  description: string | null;
  features: string[];
  specifications: { key: string; value: string }[];
  benefits: string[];
  ingredients: string[];
  certifications: string[];
  storageInstructions: string | null;
  shelfLife: string | null;
  categories: { id: string; name: string; slug: string }[];
  options: {
    id: string;
    name: string;
    position: number;
    values: { id: string; value: string; position: number }[];
  }[];
  variants: {
    id: string;
    sku: string;
    title: string;
    status: string;
    position: number;
    isDefault: boolean;
    optionValues: { optionId: string; optionName: string; valueId: string; value: string }[];
    media: { id: string; type: string; url: string; altText: string | null; position: number; isPrimary: boolean }[];
  }[];
  media: { id: string; type: string; url: string; altText: string | null; position: number; isPrimary: boolean }[];
  markets: { marketId: string; code: string; name: string; isAvailable: boolean; isVisible: boolean }[];
}

export function toProductDetail(product: ProductDetail): ProductDetailResponse {
  return {
    ...toProductSummary(product),
    description: product.description,
    features: product.features,
    specifications: (product.specifications as { key: string; value: string }[] | null) ?? [],
    benefits: product.benefits,
    ingredients: product.ingredients,
    certifications: product.certifications,
    storageInstructions: product.storageInstructions,
    shelfLife: product.shelfLife,
    categories: product.categories.map((link) => ({
      id: link.category.id,
      name: link.category.name,
      slug: link.category.slug,
    })),
    options: product.options.map((option) => ({
      id: option.id,
      name: option.name,
      position: option.position,
      values: option.values.map((value) => ({ id: value.id, value: value.value, position: value.position })),
    })),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      title: variant.title,
      status: variant.status,
      position: variant.position,
      isDefault: variant.isDefault,
      optionValues: variant.optionValues.map((assignment) => ({
        optionId: assignment.option.id,
        optionName: assignment.option.name,
        valueId: assignment.optionValue.id,
        value: assignment.optionValue.value,
      })),
      media: variant.media.map(toMediaResponse),
    })),
    media: product.media.map(toMediaResponse),
    markets: product.marketAvailability.map((availability) => ({
      marketId: availability.market.id,
      code: availability.market.code,
      name: availability.market.name,
      isAvailable: availability.isAvailable,
      isVisible: availability.isVisible,
    })),
  };
}

function toMediaResponse(media: {
  id: string;
  type: string;
  url: string;
  altText: string | null;
  position: number;
  isPrimary: boolean;
}) {
  return {
    id: media.id,
    type: media.type,
    url: media.url,
    altText: media.altText,
    position: media.position,
    isPrimary: media.isPrimary,
  };
}
