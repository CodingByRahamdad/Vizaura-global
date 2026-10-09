/**
 * Types mirror the backend's actual response shapes verbatim
 * (backend/src/modules/catalog/*.mapper.ts, pricing.mapper.ts, inventory.mapper.ts).
 * Do not add fields the backend doesn't return.
 */

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

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

export type ProductBadge = "BEST_SELLER" | "NEW";

export interface ProductSummaryResponse {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  status: string;
  isActive: boolean;
  badge: ProductBadge | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductSpecification {
  key: string;
  value: string;
}

export interface MediaItem {
  id: string;
  type: string;
  url: string;
  altText: string | null;
  position: number;
  isPrimary: boolean;
}

export interface ProductOptionValue {
  id: string;
  value: string;
  position: number;
}

export interface ProductOption {
  id: string;
  name: string;
  position: number;
  values: ProductOptionValue[];
}

export interface ProductVariantOptionValue {
  optionId: string;
  optionName: string;
  valueId: string;
  value: string;
}

export interface ProductVariant {
  id: string;
  sku: string;
  title: string;
  status: string;
  position: number;
  isDefault: boolean;
  optionValues: ProductVariantOptionValue[];
  media: MediaItem[];
}

export interface ProductMarketAvailability {
  marketId: string;
  code: string;
  name: string;
  isAvailable: boolean;
  isVisible: boolean;
}

export interface ProductDetailResponse extends ProductSummaryResponse {
  description: string | null;
  features: string[];
  specifications: ProductSpecification[];
  benefits: string[];
  ingredients: string[];
  certifications: string[];
  storageInstructions: string | null;
  shelfLife: string | null;
  categories: { id: string; name: string; slug: string }[];
  options: ProductOption[];
  variants: ProductVariant[];
  media: MediaItem[];
  markets: ProductMarketAvailability[];
}

export interface ProductCardResponse extends ProductSummaryResponse {
  imageUrl: string | null;
  defaultVariantId: string | null;
  price: PublicPriceResponse | null;
  stock: PublicStockResponse | null;
  rating: number | null;
  reviewCount: number;
}

export interface PublicPriceResponse {
  marketCode: string;
  currencyCode: string;
  amount: number;
  isOnSale: boolean;
  saleEndsAt: string | null;
  compareAtAmount: number | null;
}

export type StockStatus = "IN_STOCK" | "OUT_OF_STOCK";

export interface PublicStockResponse {
  marketCode: string;
  status: StockStatus;
  lowStockQuantity: number | null;
}
