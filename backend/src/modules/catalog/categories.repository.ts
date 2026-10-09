import type { Category, Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { getPrismaClient } from "../../db/prismaClient.js";

export interface CreateCategoryData {
  name: string;
  slug: string;
  parentId?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
  position?: number;
}

export type UpdateCategoryData = Partial<CreateCategoryData>;

export interface ListCategoriesFilter {
  parentId?: string;
  isActive?: boolean;
  search?: string;
  skip: number;
  take: number;
}

export class CategoriesRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async create(data: CreateCategoryData): Promise<Category> {
    return this.prisma.category.create({ data });
  }

  async findById(id: string): Promise<Category | null> {
    return this.prisma.category.findUnique({ where: { id } });
  }

  async findBySlug(slug: string): Promise<Category | null> {
    return this.prisma.category.findUnique({ where: { slug } });
  }

  async update(id: string, data: UpdateCategoryData): Promise<Category> {
    return this.prisma.category.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.category.delete({ where: { id } });
  }

  async list(filter: ListCategoriesFilter): Promise<{ categories: Category[]; total: number }> {
    const where: Prisma.CategoryWhereInput = {};
    if (filter.parentId !== undefined) where.parentId = filter.parentId;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;
    if (filter.search) where.name = { contains: filter.search, mode: "insensitive" };

    const [categories, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      }),
      this.prisma.category.count({ where }),
    ]);
    return { categories, total };
  }

  async countChildren(id: string): Promise<number> {
    return this.prisma.category.count({ where: { parentId: id } });
  }

  async countProductLinks(id: string): Promise<number> {
    return this.prisma.productCategory.count({ where: { categoryId: id } });
  }

  /// Batched link counts for the admin list (GET /categories?include=admin).
  /// Unlike countProductsByCategoryIds this is NOT filtered to ACTIVE/visible
  /// products — it counts exactly what remove()'s in-use guard counts (every
  /// ProductCategory row, including draft/archived/soft-deleted products), so
  /// a "0 products" row in the admin UI really is deletable.
  async countLinksByCategoryIds(categoryIds: string[]): Promise<{
    products: Map<string, number>;
    children: Map<string, number>;
  }> {
    if (categoryIds.length === 0) return { products: new Map(), children: new Map() };
    const [productRows, childRows] = await Promise.all([
      this.prisma.productCategory.groupBy({
        by: ["categoryId"],
        where: { categoryId: { in: categoryIds } },
        _count: true,
      }),
      this.prisma.category.groupBy({
        by: ["parentId"],
        where: { parentId: { in: categoryIds } },
        _count: true,
      }),
    ]);
    return {
      products: new Map(productRows.map((row) => [row.categoryId, row._count])),
      children: new Map(childRows.flatMap((row) => (row.parentId ? [[row.parentId, row._count] as const] : []))),
    };
  }

  /// Batched product count per category (GET /categories?include=count) —
  /// one groupBy for the whole page of categories instead of one
  /// limit:1-products query per category.
  async countProductsByCategoryIds(categoryIds: string[], marketCode?: string): Promise<Map<string, number>> {
    if (categoryIds.length === 0) return new Map();
    const rows = await this.prisma.productCategory.groupBy({
      by: ["categoryId"],
      where: {
        categoryId: { in: categoryIds },
        product: {
          deletedAt: null,
          status: "ACTIVE",
          ...(marketCode ? { marketAvailability: { some: { market: { code: marketCode }, isVisible: true } } } : {}),
        },
      },
      _count: true,
    });
    return new Map(rows.map((row) => [row.categoryId, row._count]));
  }
}
