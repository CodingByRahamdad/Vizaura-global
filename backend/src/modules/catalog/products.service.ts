import { ProductsRepository, type ProductAdminRow, type ProductCardRow, type ProductDetail } from "./products.repository.js";
import { PricingRepository } from "../pricing/pricing.repository.js";
import { InventoryRepository } from "../inventory/inventory.repository.js";
import { ReviewsRepository, type RatingAggregate } from "../reviews/reviews.repository.js";
import { catalogErrors } from "../../errors/AppError.js";
import { isUniqueConstraintViolation } from "./prismaErrors.js";
import { slugify } from "./slugify.js";
import type {
  CreateProductInput,
  ListProductsQuery,
  UpdateProductInput,
  UpsertProductMarketInput,
} from "./products.validators.js";
import type { Market, Product, VariantPrice, VariantStock } from "../../generated/prisma/client.js";

export interface ListProductsFilterOptions {
  status?: ListProductsQuery["status"];
  badge?: ListProductsQuery["badge"];
  category?: string;
  market?: string;
  search?: string;
  canSeeAllStatuses: boolean;
}

export interface ListWithCardsResult {
  products: ProductCardRow[];
  total: number;
  prices: Map<string, VariantPrice & { market: Market }>;
  stocks: Map<string, VariantStock & { market: Market }>;
  ratings: Map<string, RatingAggregate>;
}

export interface ListForAdminResult {
  products: ProductAdminRow[];
  total: number;
  prices: Map<string, (VariantPrice & { market: Market })[]>;
  stocks: Map<string, (VariantStock & { market: Market })[]>;
}

export class ProductsService {
  constructor(
    private readonly productsRepository: ProductsRepository = new ProductsRepository(),
    private readonly pricingRepository: PricingRepository = new PricingRepository(),
    private readonly inventoryRepository: InventoryRepository = new InventoryRepository(),
    private readonly reviewsRepository: ReviewsRepository = new ReviewsRepository(),
  ) {}

  async create(input: CreateProductInput): Promise<ProductDetail> {
    const slugValue = input.slug ?? slugify(input.name);
    await this.assertSlugAvailable(slugValue);
    if (input.defaultVariant) {
      await this.assertSkuAvailable(input.defaultVariant.sku);
    }

    const categoryIds = [...new Set(input.categoryIds ?? [])];
    if (categoryIds.length > 0) {
      await this.assertCategoriesExist(categoryIds);
    }

    const markets = await this.resolveMarkets(input.markets ?? []);

    try {
      return await this.productsRepository.create({
        name: input.name,
        slug: slugValue,
        shortDescription: input.shortDescription,
        description: input.description,
        status: input.status,
        badge: input.badge,
        features: input.features,
        specifications: input.specifications,
        benefits: input.benefits,
        ingredients: input.ingredients,
        certifications: input.certifications,
        storageInstructions: input.storageInstructions,
        shelfLife: input.shelfLife,
        categoryIds,
        markets,
        defaultVariant: input.defaultVariant,
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error, "slug")) throw catalogErrors.slugConflict(slugValue);
      if (input.defaultVariant && isUniqueConstraintViolation(error, "sku")) {
        throw catalogErrors.skuConflict(input.defaultVariant.sku);
      }
      throw error;
    }
  }

  async get(id: string, canSeeAllStatuses = true): Promise<ProductDetail> {
    const product = await this.productsRepository.findDetailById(id, canSeeAllStatuses);
    if (!product) throw catalogErrors.notFound("Product");
    return product;
  }

  async getBySlug(slugValue: string, canSeeAllStatuses = true): Promise<ProductDetail> {
    const product = await this.productsRepository.findDetailBySlug(slugValue, canSeeAllStatuses);
    if (!product) throw catalogErrors.notFound("Product");
    return product;
  }

  async list(
    filter: ListProductsFilterOptions,
    pagination: { skip: number; take: number },
  ): Promise<{ products: Product[]; total: number }> {
    const isPublicView = !filter.canSeeAllStatuses;

    if (filter.market) {
      await this.assertMarketActive(filter.market);
    }

    return this.productsRepository.list({
      status: isPublicView ? "ACTIVE" : filter.status,
      badge: filter.badge,
      categoryId: filter.category,
      marketCode: filter.market,
      requireVisible: isPublicView,
      requireAvailable: false,
      requireActive: isPublicView,
      search: filter.search,
      skip: pagination.skip,
      take: pagination.take,
    });
  }

  /// Card data for a storefront listing page — requires a market (unlike
  /// list(), which admin callers may use without one) since price/stock are
  /// resolved per-market. Runs a fixed number of batched queries (product
  /// page + count + prices + stocks + ratings) regardless of page size,
  /// instead of the frontend's former per-product enrichment fetches.
  async listWithCards(
    filter: ListProductsFilterOptions,
    pagination: { skip: number; take: number },
  ): Promise<ListWithCardsResult> {
    if (!filter.market) throw catalogErrors.notFound("Market");
    await this.assertMarketActive(filter.market);

    const isPublicView = !filter.canSeeAllStatuses;
    const { products, total } = await this.productsRepository.listForCards({
      status: isPublicView ? "ACTIVE" : filter.status,
      badge: filter.badge,
      categoryId: filter.category,
      marketCode: filter.market,
      requireVisible: isPublicView,
      requireAvailable: false,
      requireActive: isPublicView,
      search: filter.search,
      skip: pagination.skip,
      take: pagination.take,
    });

    const variantIds = products.map((p) => p.defaultVariantId).filter((id): id is string => id !== null);
    const productIds = products.map((p) => p.id);
    const [priceRows, stockRows, ratings] = await Promise.all([
      this.pricingRepository.findActivePricesByVariantIds(variantIds, filter.market),
      this.inventoryRepository.findByVariantIdsAndMarket(variantIds, filter.market),
      this.reviewsRepository.aggregateForProducts(productIds),
    ]);

    return {
      products,
      total,
      prices: new Map(priceRows.map((p) => [p.variantId, p])),
      stocks: new Map(stockRows.map((s) => [s.variantId, s])),
      ratings,
    };
  }

  /// Admin list data (Phase 6D) — unlike listWithCards, never scoped to one
  /// market: `filter.market` is ignored here even if the caller passed one,
  /// since admin management always spans both markets at once. Returns
  /// every price/stock row (not just the active/single-market one) per
  /// default variant, grouped as arrays since more than one market's row can
  /// exist per variant.
  async listForAdmin(
    filter: Omit<ListProductsFilterOptions, "market">,
    pagination: { skip: number; take: number },
  ): Promise<ListForAdminResult> {
    const { products, total } = await this.productsRepository.listForAdmin({
      status: filter.status,
      categoryId: filter.category,
      search: filter.search,
      skip: pagination.skip,
      take: pagination.take,
    });

    const variantIds = products.map((p) => p.defaultVariantId).filter((id): id is string => id !== null);
    const [priceRows, stockRows] = await Promise.all([
      this.pricingRepository.findPricesByVariantIds(variantIds),
      this.inventoryRepository.findByVariantIds(variantIds),
    ]);

    return {
      products,
      total,
      prices: groupByVariantId(priceRows),
      stocks: groupByVariantId(stockRows),
    };
  }

  async update(id: string, input: UpdateProductInput): Promise<ProductDetail> {
    await this.assertExists(id);
    if (input.slug) {
      await this.assertSlugAvailable(input.slug, id);
    }

    try {
      return await this.productsRepository.update(id, {
        name: input.name,
        slug: input.slug,
        shortDescription: input.shortDescription,
        description: input.description,
        status: input.status,
        isActive: input.isActive,
        badge: input.badge,
        features: input.features,
        specifications: input.specifications,
        benefits: input.benefits,
        ingredients: input.ingredients,
        certifications: input.certifications,
        storageInstructions: input.storageInstructions,
        shelfLife: input.shelfLife,
      });
    } catch (error) {
      if (input.slug && isUniqueConstraintViolation(error, "slug")) throw catalogErrors.slugConflict(input.slug);
      throw error;
    }
  }

  /// Every product delete is a permanent hard delete, regardless of status,
  /// to avoid accumulating storage from demo/stale catalog data. All
  /// dependent relations are Cascade or SetNull in the schema (see
  /// products.repository.ts's hardDelete), so this is always safe.
  async remove(id: string): Promise<void> {
    await this.assertExists(id);
    await this.productsRepository.hardDelete(id);
  }

  async replaceCategories(productId: string, categoryIds: string[]): Promise<ProductDetail> {
    await this.assertExists(productId);
    const uniqueIds = [...new Set(categoryIds)];
    if (uniqueIds.length > 0) {
      await this.assertCategoriesExist(uniqueIds);
    }
    await this.productsRepository.replaceCategories(productId, uniqueIds);
    return this.get(productId);
  }

  async upsertMarket(
    productId: string,
    marketCode: string,
    data: UpsertProductMarketInput,
  ): Promise<ProductDetail> {
    await this.assertExists(productId);
    const marketId = await this.resolveActiveMarketId(marketCode);

    await this.productsRepository.upsertProductMarket(productId, marketId, data);
    return this.get(productId);
  }

  /// An inactive market is a closed business boundary and, from a caller's
  /// point of view, behaves exactly like an unknown one — both resolve to
  /// "not found" rather than a distinct "market is inactive" error, so a
  /// disabled market's code doesn't itself become discoverable/enumerable.
  private async resolveActiveMarketId(marketCode: string): Promise<string> {
    const resolved = await this.productsRepository.resolveMarketIdsByCode([marketCode]);
    const marketId = resolved.get(marketCode);
    if (!marketId) throw catalogErrors.notFound("Market");
    return marketId;
  }

  private async assertMarketActive(marketCode: string): Promise<void> {
    await this.resolveActiveMarketId(marketCode);
  }

  private async resolveMarkets(
    inputs: { marketCode: string; isAvailable?: boolean; isVisible?: boolean }[],
  ): Promise<{ marketId: string; isAvailable?: boolean; isVisible?: boolean }[]> {
    if (inputs.length === 0) return [];
    const codes = [...new Set(inputs.map((input) => input.marketCode))];
    const resolved = await this.productsRepository.resolveMarketIdsByCode(codes);
    return inputs.map((input) => {
      const marketId = resolved.get(input.marketCode);
      if (!marketId) throw catalogErrors.notFound("Market");
      return { marketId, isAvailable: input.isAvailable, isVisible: input.isVisible };
    });
  }

  // Note: resolveMarkets is used for the batch (product-creation) path and
  // intentionally duplicates resolveActiveMarketId's lookup rather than
  // calling it per-input, to resolve every code in a single query.

  private async assertExists(id: string): Promise<Product> {
    const product = await this.productsRepository.findById(id);
    if (!product) throw catalogErrors.notFound("Product");
    return product;
  }

  private async assertSlugAvailable(slugValue: string, excludeId?: string): Promise<void> {
    const existing = await this.productsRepository.findBySlug(slugValue);
    if (existing && existing.id !== excludeId) {
      throw catalogErrors.slugConflict(slugValue);
    }
  }

  private async assertSkuAvailable(skuValue: string): Promise<void> {
    const exists = await this.productsRepository.variantSkuExists(skuValue);
    if (exists) throw catalogErrors.skuConflict(skuValue);
  }

  private async assertCategoriesExist(categoryIds: string[]): Promise<void> {
    const count = await this.productsRepository.countCategoriesByIds(categoryIds);
    if (count !== categoryIds.length) {
      throw catalogErrors.notFound("Category");
    }
  }
}

function groupByVariantId<T extends { variantId: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const existing = map.get(row.variantId);
    if (existing) {
      existing.push(row);
    } else {
      map.set(row.variantId, [row]);
    }
  }
  return map;
}
