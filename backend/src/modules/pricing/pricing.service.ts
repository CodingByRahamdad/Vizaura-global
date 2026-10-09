import type { Market, VariantPrice } from "../../generated/prisma/client.js";
import { PricingRepository } from "./pricing.repository.js";
import { ProductsRepository } from "../catalog/products.repository.js";
import { VariantsRepository } from "../catalog/variants.repository.js";
import { catalogErrors, pricingErrors } from "../../errors/AppError.js";
import type { UpsertPriceInput } from "./pricing.validators.js";

export interface EffectivePrice {
  currencyCode: string;
  amount: number;
  isOnSale: boolean;
  effectiveAmount: number;
  saleEndsAt: Date | null;
}

/// Resolves whether a sale is currently active for `price` given `now()`.
/// A sale applies when saleAmount is set and now falls inside the optional
/// window (an unset bound is open-ended) — the exact rule documented in
/// docs/DATABASE.md and docs/modules/PRICING.md. This is the stable
/// "effective price" contract a future Checkout/Order service snapshots at
/// the time of sale; Pricing itself does no snapshotting in this phase.
export function resolveEffectivePrice(price: VariantPrice, now: Date = new Date()): EffectivePrice {
  const saleActive =
    price.saleAmount !== null &&
    (price.saleStartsAt === null || price.saleStartsAt <= now) &&
    (price.saleEndsAt === null || price.saleEndsAt >= now);

  return {
    currencyCode: price.currencyCode,
    amount: price.amount,
    isOnSale: saleActive,
    effectiveAmount: saleActive ? price.saleAmount! : price.amount,
    saleEndsAt: saleActive ? price.saleEndsAt : null,
  };
}

export class PricingService {
  constructor(
    private readonly pricingRepository: PricingRepository = new PricingRepository(),
    private readonly productsRepository: ProductsRepository = new ProductsRepository(),
    private readonly variantsRepository: VariantsRepository = new VariantsRepository(),
  ) {}

  async setPrice(
    productId: string,
    variantId: string,
    marketCode: string,
    input: UpsertPriceInput,
  ): Promise<VariantPrice & { market: Market }> {
    await this.assertVariantExists(productId, variantId);
    const market = await this.resolveActiveMarket(marketCode);

    const currencyCode = input.currencyCode ?? market.currencyCode;
    if (currencyCode !== market.currencyCode) {
      throw pricingErrors.currencyMismatch(market.currencyCode, currencyCode);
    }
    if (input.saleAmount !== undefined && input.saleAmount >= input.amount) {
      throw pricingErrors.invalidSaleAmount();
    }

    return this.pricingRepository.upsertPrice(variantId, market.id, {
      currencyCode,
      amount: input.amount,
      saleAmount: input.saleAmount ?? null,
      saleStartsAt: input.saleStartsAt ?? null,
      saleEndsAt: input.saleEndsAt ?? null,
      isActive: input.isActive,
    });
  }

  async removePrice(productId: string, variantId: string, marketCode: string): Promise<void> {
    await this.assertVariantExists(productId, variantId);
    const market = await this.resolveActiveMarket(marketCode);
    await this.pricingRepository.deactivatePrice(variantId, market.id);
  }

  /// `canSeeAdmin` widens visibility the same way Catalog's read endpoints
  /// widen for a caller holding the relevant `:read` permission: every row
  /// including inactive ones, with full fields — see pricing.mapper.ts for
  /// the public/admin response shape split.
  async getPrice(
    productId: string,
    variantId: string,
    marketCode: string,
    canSeeAllStatuses: boolean,
    canSeeAdmin: boolean,
  ): Promise<VariantPrice & { market: Market }> {
    await this.assertVariantVisible(productId, variantId, canSeeAllStatuses);
    const market = await this.resolveActiveMarket(marketCode);

    const price = await this.pricingRepository.findPrice(variantId, market.id);
    if (!price) throw pricingErrors.notFound();
    if (!canSeeAdmin && !price.isActive) throw pricingErrors.notFound();
    return price;
  }

  async listPrices(
    productId: string,
    variantId: string,
    canSeeAllStatuses: boolean,
    canSeeAdmin: boolean,
  ): Promise<(VariantPrice & { market: Market })[]> {
    await this.assertVariantVisible(productId, variantId, canSeeAllStatuses);
    const prices = await this.pricingRepository.findPricesByVariant(variantId);
    if (canSeeAdmin) return prices;
    return prices.filter((price) => price.market.isActive && price.isActive);
  }

  // -- Shared guards --------------------------------------------------------

  private async assertVariantExists(productId: string, variantId: string): Promise<void> {
    const variant = await this.variantsRepository.findVariantByProductAndId(productId, variantId);
    if (!variant) throw catalogErrors.notFound("Variant");
  }

  /// Draft/archived products' variants are only visible to a caller who can
  /// see the product itself — identical rule to Catalog's
  /// VariantsService.listVariants (docs/modules/CATALOG.md).
  private async assertVariantVisible(productId: string, variantId: string, canSeeAllStatuses: boolean): Promise<void> {
    const product = await this.productsRepository.findById(productId);
    if (!product) throw catalogErrors.notFound("Product");
    if (product.status !== "ACTIVE" && !canSeeAllStatuses) throw catalogErrors.notFound("Product");

    const variant = await this.variantsRepository.findVariantByProductAndId(productId, variantId);
    if (!variant) throw catalogErrors.notFound("Variant");
  }

  /// An inactive/unknown market is a closed business boundary and behaves
  /// as "not found" for a write — same rule Catalog applies (see
  /// products.service.ts's resolveActiveMarketId).
  private async resolveActiveMarket(marketCode: string): Promise<Market> {
    const market = await this.pricingRepository.findActiveMarketByCode(marketCode);
    if (!market) throw catalogErrors.notFound("Market");
    return market;
  }
}
