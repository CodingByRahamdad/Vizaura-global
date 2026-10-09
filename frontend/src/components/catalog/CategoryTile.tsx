import Link from "next/link";
import { SafeImage } from "@/components/ui/SafeImage";
import type { CategoryResponse } from "@/lib/types/catalog";

interface CategoryTileProps {
  category: CategoryResponse;
}

export function CategoryTile({ category }: CategoryTileProps) {
  return (
    <Link
      href={`/products?category=${category.id}`}
      className="group relative block aspect-[4/5] overflow-hidden rounded-lg"
    >
      <SafeImage
        src={category.imageUrl}
        alt={category.name}
        className="transition-transform duration-300 group-hover:scale-105"
        fallback={
          <span className="text-lg font-semibold text-primary-dark">
            {category.name.charAt(0)}
          </span>
        }
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <span className="absolute bottom-3 left-3 text-sm font-semibold text-white">
        {category.name}
      </span>
    </Link>
  );
}
