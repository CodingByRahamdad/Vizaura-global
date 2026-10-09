import type { Category } from "../../generated/prisma/client.js";

export interface CategoryResponse {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export function toCategoryResponse(category: Category): CategoryResponse {
  return {
    id: category.id,
    parentId: category.parentId,
    name: category.name,
    slug: category.slug,
    description: category.description,
    imageUrl: category.imageUrl,
    isActive: category.isActive,
    position: category.position,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

export interface CategoryWithCountResponse extends CategoryResponse {
  productCount: number;
}

/// Admin list row (GET /categories?include=admin): productCount counts every
/// ProductCategory link regardless of product status/visibility, childCount
/// the direct subcategories — together exactly what DELETE's in-use guard checks.
export interface AdminCategoryResponse extends CategoryResponse {
  productCount: number;
  childCount: number;
}

export function toAdminCategoryResponse(
  category: Category,
  productCount: number,
  childCount: number,
): AdminCategoryResponse {
  return { ...toCategoryResponse(category), productCount, childCount };
}

export function toCategoryWithCount(category: Category, productCount: number): CategoryWithCountResponse {
  return { ...toCategoryResponse(category), productCount };
}
