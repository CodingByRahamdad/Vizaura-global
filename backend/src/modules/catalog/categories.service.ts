import { CategoriesRepository } from "./categories.repository.js";
import { catalogErrors } from "../../errors/AppError.js";
import { isUniqueConstraintViolation } from "./prismaErrors.js";
import { slugify } from "./slugify.js";
import type { CreateCategoryInput, UpdateCategoryInput } from "./categories.validators.js";
import type { Category } from "../../generated/prisma/client.js";

const MAX_ANCESTOR_DEPTH = 50;

export class CategoriesService {
  constructor(private readonly categoriesRepository: CategoriesRepository = new CategoriesRepository()) {}

  async create(input: CreateCategoryInput): Promise<Category> {
    const slug = input.slug ?? slugify(input.name);
    // A derived slug never went through the Zod slug schema, and slugify()
    // returns "" for names with no [a-z0-9] characters (e.g. "!!!" or
    // non-Latin text) — never insert that; ask for an explicit slug instead.
    if (!slug) {
      throw catalogErrors.validation({
        slug: "A URL slug could not be derived from this name — please enter a slug.",
      });
    }
    await this.assertSlugAvailable(slug);

    if (input.parentId) {
      await this.getExistingOrThrow(input.parentId);
    }

    try {
      return await this.categoriesRepository.create({
        name: input.name,
        slug,
        parentId: input.parentId ?? null,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        isActive: input.isActive,
        position: input.position,
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error, "slug")) throw catalogErrors.slugConflict(slug);
      throw error;
    }
  }

  async get(id: string): Promise<Category> {
    return this.getExistingOrThrow(id);
  }

  async list(
    filter: { parentId?: string; includeInactive: boolean; search?: string },
    pagination: { skip: number; take: number },
  ): Promise<{ categories: Category[]; total: number }> {
    return this.categoriesRepository.list({
      parentId: filter.parentId,
      isActive: filter.includeInactive ? undefined : true,
      search: filter.search,
      skip: pagination.skip,
      take: pagination.take,
    });
  }

  /// Same page as list(), plus each category's real product count — one
  /// batched groupBy for the whole page instead of a limit:1-products query
  /// per category.
  async listWithCounts(
    filter: { parentId?: string; includeInactive: boolean },
    pagination: { skip: number; take: number },
    marketCode?: string,
  ): Promise<{ categories: Category[]; total: number; counts: Map<string, number> }> {
    const { categories, total } = await this.list(filter, pagination);
    const counts = await this.categoriesRepository.countProductsByCategoryIds(
      categories.map((category) => category.id),
      marketCode,
    );
    return { categories, total, counts };
  }

  /// Admin list: same page as list(), plus all-status product/child counts.
  async listForAdmin(
    filter: { parentId?: string; includeInactive: boolean },
    pagination: { skip: number; take: number },
  ): Promise<{
    categories: Category[];
    total: number;
    productCounts: Map<string, number>;
    childCounts: Map<string, number>;
  }> {
    const { categories, total } = await this.list(filter, pagination);
    const { products, children } = await this.categoriesRepository.countLinksByCategoryIds(
      categories.map((category) => category.id),
    );
    return { categories, total, productCounts: products, childCounts: children };
  }

  async update(id: string, input: UpdateCategoryInput): Promise<Category> {
    const existing = await this.getExistingOrThrow(id);

    if (input.slug && input.slug !== existing.slug) {
      await this.assertSlugAvailable(input.slug, id);
    }

    if (input.parentId !== undefined && input.parentId !== existing.parentId) {
      if (input.parentId !== null) {
        await this.getExistingOrThrow(input.parentId);
        await this.assertNotOwnAncestor(id, input.parentId);
      }
    }

    try {
      return await this.categoriesRepository.update(id, {
        name: input.name,
        slug: input.slug,
        parentId: input.parentId,
        description: input.description,
        imageUrl: input.imageUrl,
        isActive: input.isActive,
        position: input.position,
      });
    } catch (error) {
      if (input.slug && isUniqueConstraintViolation(error, "slug")) throw catalogErrors.slugConflict(input.slug);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    await this.getExistingOrThrow(id);

    const [childCount, productCount] = await Promise.all([
      this.categoriesRepository.countChildren(id),
      this.categoriesRepository.countProductLinks(id),
    ]);
    if (childCount > 0 || productCount > 0) {
      throw catalogErrors.categoryInUse();
    }

    await this.categoriesRepository.delete(id);
  }

  private async getExistingOrThrow(id: string): Promise<Category> {
    const category = await this.categoriesRepository.findById(id);
    if (!category) {
      throw catalogErrors.notFound("Category");
    }
    return category;
  }

  private async assertSlugAvailable(slug: string, excludeId?: string): Promise<void> {
    const existing = await this.categoriesRepository.findBySlug(slug);
    if (existing && existing.id !== excludeId) {
      throw catalogErrors.slugConflict(slug);
    }
  }

  /// Walks up from `proposedParentId` toward the root, rejecting the update
  /// if `categoryId` appears in that chain — which would make the category
  /// its own ancestor once re-parented.
  private async assertNotOwnAncestor(categoryId: string, proposedParentId: string): Promise<void> {
    let currentId: string | null = proposedParentId;
    for (let depth = 0; depth < MAX_ANCESTOR_DEPTH && currentId; depth += 1) {
      if (currentId === categoryId) {
        throw catalogErrors.invalidCategoryParent();
      }
      const current = await this.categoriesRepository.findById(currentId);
      currentId = current?.parentId ?? null;
    }
  }
}
