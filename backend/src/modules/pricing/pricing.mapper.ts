import type { Market, VariantPrice } from "../../generated/prisma/client.js";
import { resolveEffectivePrice } from "./pricing.service.js";

export interface AdminPriceResponse {
  id: string;
  variantId: string;
  marketCode: string;
  currencyCode: string;
  amount: number;
  saleAmount: number | null;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicPriceResponse {
  marketCode: string;
  currencyCode: string;
  amount: number;
  isOnSale: boolean;
  saleEndsAt: string | null;
  /// The pre-sale amount, only when isOnSale — lets the storefront show a
  /// strikethrough original price / discount %. Null when not on sale
  /// (there is nothing to compare against).
  compareAtAmount: number | null;
}

/// Full record — never returned to an unprivileged caller (see
/// docs/modules/PRICING.md's public/admin visibility split).
export function toAdminPriceResponse(price: VariantPrice & { market: Market }): AdminPriceResponse {
  return {
    id: price.id,
    variantId: price.variantId,
    marketCode: price.market.code,
    currencyCode: price.currencyCode,
    amount: price.amount,
    saleAmount: price.saleAmount,
    saleStartsAt: price.saleStartsAt?.toISOString() ?? null,
    saleEndsAt: price.saleEndsAt?.toISOString() ?? null,
    isActive: price.isActive,
    createdAt: price.createdAt.toISOString(),
    updatedAt: price.updatedAt.toISOString(),
  };
}

/// Storefront-safe shape: the resolved effective amount only (sale already
/// applied), no id/isActive/raw saleAmount/administrative timestamps.
export function toPublicPriceResponse(price: VariantPrice & { market: Market }): PublicPriceResponse {
  const effective = resolveEffectivePrice(price);
  return {
    marketCode: price.market.code,
    currencyCode: effective.currencyCode,
    amount: effective.effectiveAmount,
    isOnSale: effective.isOnSale,
    saleEndsAt: effective.saleEndsAt?.toISOString() ?? null,
    compareAtAmount: effective.isOnSale ? price.amount : null,
  };
}
