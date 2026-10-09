import type { Prisma, PrismaClient, Product, ProductBadge, ProductStatus } from "../../generated/prisma/client.js";
import { Prisma as PrismaRuntime } from "../../generated/prisma/client.js";
import { getPrismaClient } from "../../db/prismaClient.js";

/// `includeAllVariantStatuses` mirrors the product-level visibility split
/// already used for `Product.status` (see docs/modules/CATALOG.md's
/// "Resolved rules"): an unprivileged/public caller gets ACTIVE variants
/// only, a caller with products:read gets every status. Defaults to true so
/// every existing internal call site (admin create/update's own response)
/// keeps seeing everything without needing to pass the flag explicitly.
export function buildProductDetailInclude(includeAllVariantStatuses = true) {
  return {
    categories: { include: { category: true } },
    variants: {
      where: includeAllVariantStatuses ? { deletedAt: null } : { deletedAt: null, status: "ACTIVE" as const },
      orderBy: { position: "asc" },
      include: {
        optionValues: { include: { option: true, optionValue: true } },
        media: { orderBy: { position: "asc" } },
      },
    },
    options: {
      orderBy: { position: "asc" },
      include: { values: { orderBy: { position: "asc" } } },
    },
    media: { where: { variantId: null }, orderBy: { position: "asc" } },
    marketAvailability: { include: { market: true } },
  } satisfies Prisma.ProductInclude;
}

export type ProductDetail = Prisma.ProductGetPayload<{ include: ReturnType<typeof buildProductDetailInclude> }>;

export interface CreateProductData {
  name: string;
  slug: string;
  shortDescription?: string | null;
  description?: string | null;
  status?: ProductStatus;
  badge?: ProductBadge | null;
  features?: string[];
  specifications?: Prisma.InputJsonValue | null;
  benefits?: string[];
  ingredients?: string[];
  certifications?: string[];
  storageInstructions?: string | null;
  shelfLife?: string | null;
  categoryIds: string[];
  markets: { marketId: string; isAvailable?: boolean; isVisible?: boolean }[];
  defaultVariant?: { sku: string; title: string };
}

export interface UpdateProductData {
  name?: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  status?: ProductStatus;
  isActive?: boolean;
  badge?: ProductBadge | null;
  features?: string[];
  specifications?: Prisma.InputJsonValue | null;
  benefits?: string[];
  ingredients?: string[];
  certifications?: string[];
  storageInstructions?: string | null;
  shelfLife?: string | null;
}

export interface ListProductsFilter {
  status?: ProductStatus;
  badge?: ProductBadge;
  categoryId?: string;
  marketCode?: string;
  requireVisible?: boolean;
  requireAvailable?: boolean;
  requireActive?: boolean;
  search?: string;
  skip: number;
  take: number;
}

export interface ProductCardRow extends Product {
  defaultVariantId: string | null;
  primaryMediaUrl: string | null;
}

export interface ProductAdminRow extends Product {
  defaultVariantId: string | null;
  primaryMediaUrl: string | null;
  variantCount: number;
  categories: { id: string; name: string }[];
  marketAvailability: { isAvailable: boolean; isVisible: boolean; market: { code: string; name: string } }[];
}

export class ProductsRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async create(data: CreateProductData): Promise<ProductDetail> {
    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: data.name,
          slug: data.slug,
          shortDescription: data.shortDescription,
          description: data.description,
          status: data.status,
          badge: data.badge,
          features: data.features ?? [],
          specifications: data.specifications ?? undefined,
          benefits: data.benefits ?? [],
          ingredients: data.ingredients ?? [],
          certifications: data.certifications ?? [],
          storageInstructions: data.storageInstructions,
          shelfLife: data.shelfLife,
        },
      });

      if (data.defaultVariant) {
        await tx.productVariant.create({
          data: {
            productId: created.id,
            sku: data.defaultVariant.sku,
            title: data.defaultVariant.title,
            isDefault: true,
          },
        });
      }

      if (data.categoryIds.length > 0) {
        await tx.productCategory.createMany({
          data: data.categoryIds.map((categoryId) => ({ productId: created.id, categoryId })),
        });
      }

      if (data.markets.length > 0) {
        await tx.productMarket.createMany({
          data: data.markets.map((market) => ({
            productId: created.id,
            marketId: market.marketId,
            isAvailable: market.isAvailable,
            isVisible: market.isVisible,
          })),
        });
      }

      return created;
    });

    return this.findDetailById(product.id) as Promise<ProductDetail>;
  }

  async findDetailById(id: string, includeAllVariantStatuses = true): Promise<ProductDetail | null> {
    return this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: buildProductDetailInclude(includeAllVariantStatuses),
    });
  }

  async findDetailBySlug(slug: string, includeAllVariantStatuses = true): Promise<ProductDetail | null> {
    return this.prisma.product.findFirst({
      where: { slug, deletedAt: null },
      include: buildProductDetailInclude(includeAllVariantStatuses),
    });
  }

  async findById(id: string): Promise<Product | null> {
    return this.prisma.product.findFirst({ where: { id, deletedAt: null } });
  }

  async findBySlug(slug: string): Promise<Product | null> {
    return this.prisma.product.findFirst({ where: { slug, deletedAt: null } });
  }

  async update(id: string, data: UpdateProductData): Promise<ProductDetail> {
    const { specifications, ...rest } = data;
    await this.prisma.product.update({
      where: { id },
      data: {
        ...rest,
        ...(specifications !== undefined
          ? { specifications: specifications === null ? PrismaRuntime.JsonNull : specifications }
          : {}),
      },
    });
    return this.findDetailById(id) as Promise<ProductDetail>;
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /// Permanently removes the product row. Every dependent relation is
  /// Cascade or SetNull in the schema (see schema.prisma's Product model),
  /// so a single delete is sufficient — no manual child cleanup or
  /// transaction needed. OrderItem survives via its own snapshotted fields
  /// with productId/variantId set to null; Review/WishlistItem/CartItem
  /// rows referencing this product are destroyed.
  async hardDelete(id: string): Promise<void> {
    await this.prisma.product.delete({ where: { id } });
  }

  async list(filter: ListProductsFilter): Promise<{ products: Product[]; total: number }> {
    const where = this.buildWhere(filter);

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      }),
      this.prisma.product.count({ where }),
    ]);
    return { products, total };
  }

  /// Card data for a storefront listing page — same filter/pagination as
  /// list(), plus each row's default-variant id and primary image resolved
  /// via a nested include (bounded take:1 per relation) rather than a
  /// separate query per product. Price/stock/rating are NOT resolved here —
  /// those live in Pricing/Inventory/Reviews and are batched by the caller
  /// (products.service.ts::listWithCards) using the ids this returns.
  async listForCards(filter: ListProductsFilter): Promise<{ products: ProductCardRow[]; total: number }> {
    const where = this.buildWhere(filter);

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        include: {
          variants: {
            where: { deletedAt: null },
            orderBy: [{ isDefault: "desc" }, { position: "asc" }],
            take: 1,
            select: { id: true },
          },
          media: {
            where: { variantId: null },
            orderBy: [{ isPrimary: "desc" }, { position: "asc" }],
            take: 1,
            select: { url: true },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    const products = rows.map((row) => ({
      ...row,
      defaultVariantId: row.variants[0]?.id ?? null,
      primaryMediaUrl: row.media[0]?.url ?? null,
    }));
    return { products, total };
  }

  /// Admin list data (Phase 6D) — same filter/pagination as list()/
  /// listForCards(), plus brief categories, active variant count, and
  /// EVERY market's availability row (never narrowed to one market, unlike
  /// listForCards, since admin management is never scoped to a single
  /// market). Raw price/stock across both markets are batched by the caller
  /// (products.service.ts::listForAdmin) using the default-variant ids this
  /// returns, same cross-module pattern as listWithCards.
  async listForAdmin(filter: ListProductsFilter): Promise<{ products: ProductAdminRow[]; total: number }> {
    const where = this.buildWhere(filter);

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        include: {
          variants: {
            where: { deletedAt: null },
            orderBy: [{ isDefault: "desc" }, { position: "asc" }],
            take: 1,
            select: { id: true },
          },
          media: {
            where: { variantId: null },
            orderBy: [{ isPrimary: "desc" }, { position: "asc" }],
            take: 1,
            select: { url: true },
          },
          categories: { include: { category: { select: { id: true, name: true } } } },
          marketAvailability: { include: { market: { select: { code: true, name: true } } } },
          _count: { select: { variants: { where: { deletedAt: null } } } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    const products = rows.map((row) => ({
      ...row,
      defaultVariantId: row.variants[0]?.id ?? null,
      primaryMediaUrl: row.media[0]?.url ?? null,
      variantCount: row._count.variants,
      categories: row.categories.map((link) => link.category),
      marketAvailability: row.marketAvailability,
    }));
    return { products, total };
  }

  private buildWhere(filter: ListProductsFilter): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = { deletedAt: null };
    if (filter.status) where.status = filter.status;
    if (filter.requireActive) where.isActive = true;
    if (filter.badge) where.badge = filter.badge;
    if (filter.search) where.name = { contains: filter.search, mode: "insensitive" };
    if (filter.categoryId) where.categories = { some: { categoryId: filter.categoryId } };
    if (filter.marketCode) {
      where.marketAvailability = {
        some: {
          market: { code: filter.marketCode },
          ...(filter.requireVisible ? { isVisible: true } : {}),
          ...(filter.requireAvailable ? { isAvailable: true } : {}),
        },
      };
    }
    return where;
  }

  async replaceCategories(productId: string, categoryIds: string[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.productCategory.deleteMany({ where: { productId } }),
      this.prisma.productCategory.createMany({
        data: categoryIds.map((categoryId) => ({ productId, categoryId })),
        skipDuplicates: true,
      }),
    ]);
  }

  async countCategoriesByIds(categoryIds: string[]): Promise<number> {
    return this.prisma.category.count({ where: { id: { in: categoryIds } } });
  }

  async variantSkuExists(sku: string): Promise<boolean> {
    const existing = await this.prisma.productVariant.findFirst({
      where: { sku, deletedAt: null },
      select: { id: true },
    });
    return existing !== null;
  }

  /// Only resolves markets that are active — a deactivated market is a
  /// closed business boundary and must behave as "not found" for any new
  /// or updated product association, exactly like an unknown code.
  async resolveMarketIdsByCode(codes: string[]): Promise<Map<string, string>> {
    if (codes.length === 0) return new Map();
    const markets = await this.prisma.market.findMany({ where: { code: { in: codes }, isActive: true } });
    return new Map(markets.map((market) => [market.code, market.id]));
  }

  async upsertProductMarket(
    productId: string,
    marketId: string,
    data: { isAvailable?: boolean; isVisible?: boolean },
  ): Promise<void> {
    await this.prisma.productMarket.upsert({
      where: { productId_marketId: { productId, marketId } },
      update: data,
      create: { productId, marketId, ...data },
    });
  }
}
