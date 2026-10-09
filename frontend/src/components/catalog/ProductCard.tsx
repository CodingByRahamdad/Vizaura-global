import Link from "next/link";
import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SafeImage } from "@/components/ui/SafeImage";
import { AddToCartButton } from "@/components/catalog/AddToCartButton";
import { WishlistButton } from "@/components/catalog/WishlistButton";
import { cn } from "@/lib/utils/cn";
import { truncateWords } from "@/lib/utils/truncateWords";
import type { NormalizedProductCard } from "@/lib/api/catalog";

interface ProductCardProps {
  product: NormalizedProductCard;
  /** "list" renders a wider horizontal row (Shop page's list view toggle) instead of the default vertical grid card. */
  layout?: "grid" | "list";
}

function RatingRow({ product }: { product: NormalizedProductCard }) {
  if (product.reviewCount === 0 || product.rating === null) return null;
  return (
    <div className="flex items-center gap-1 text-xs text-text-secondary">
      <Star className="h-3.5 w-3.5 fill-warning text-warning" aria-hidden />
      <span className="font-medium text-text">{product.rating.toFixed(1)}</span>
      <span>({product.reviewCount})</span>
    </div>
  );
}

function ProductCardImageFrame({
  product,
  className,
  children,
}: {
  product: NormalizedProductCard;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <Link href={`/products/${product.slug}`} className="absolute inset-0 block">
        <SafeImage src={product.imageUrl} alt={product.name} className="absolute inset-0" />
      </Link>
      {children}
    </div>
  );
}

function ShortDescriptionRow({ product }: { product: NormalizedProductCard }) {
  if (!product.shortDescription) return null;
  return (
    <p className="line-clamp-2 text-xs text-text-secondary">
      {truncateWords(product.shortDescription, 15)}
    </p>
  );
}

function PriceRow({ product }: { product: NormalizedProductCard }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-sm font-semibold text-text">
        {product.priceLabel ?? "Price unavailable"}
      </span>
      {product.compareAtPriceLabel ? (
        <span className="text-xs text-text-secondary line-through">
          {product.compareAtPriceLabel}
        </span>
      ) : null}
    </div>
  );
}

export function ProductCard({ product, layout = "grid" }: ProductCardProps) {
  if (layout === "list") {
    return (
      <div className="group relative flex gap-4 overflow-hidden rounded-lg border border-border bg-surface p-3">
        <ProductCardImageFrame
          product={product}
          className="h-28 w-28 shrink-0 rounded-md sm:h-32 sm:w-32"
        >
          {product.discountPercent ? (
            <Badge variant="discount" className="absolute left-1.5 top-1.5">
              {product.discountPercent}% OFF
            </Badge>
          ) : null}
        </ProductCardImageFrame>
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/products/${product.slug}`}
              className="font-medium text-text hover:text-primary-dark"
            >
              {product.name}
            </Link>
            <WishlistButton productId={product.id} className="relative shrink-0" />
          </div>
          <ShortDescriptionRow product={product} />
          <RatingRow product={product} />
          <PriceRow product={product} />
          <AddToCartButton variantId={product.defaultVariantId} size="sm" className="mt-auto w-fit" />
        </div>
      </div>
    );
  }

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <ProductCardImageFrame product={product} className="aspect-square">
        {product.discountPercent ? (
          <Badge variant="discount" className={cn("absolute left-2 top-2")}>
            {product.discountPercent}% OFF
          </Badge>
        ) : null}
        <WishlistButton productId={product.id} className="absolute right-2 top-2" />
      </ProductCardImageFrame>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <Link
          href={`/products/${product.slug}`}
          className="line-clamp-1 text-sm font-medium text-text hover:text-primary-dark"
        >
          {product.name}
        </Link>

        <ShortDescriptionRow product={product} />
        <RatingRow product={product} />
        <PriceRow product={product} />

        <AddToCartButton variantId={product.defaultVariantId} size="sm" className="mt-1" />
      </div>
    </div>
  );
}
