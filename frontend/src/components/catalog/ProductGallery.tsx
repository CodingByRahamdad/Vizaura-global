"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { WishlistButton } from "@/components/catalog/WishlistButton";
import { ImageLightbox } from "@/components/catalog/ImageLightbox";
import { cn } from "@/lib/utils/cn";
import type { MediaItem, ProductBadge } from "@/lib/types/catalog";

const MAX_VISIBLE_THUMBNAILS = 5;

interface ProductGalleryProps {
  media: MediaItem[];
  productName: string;
  productId: string;
  badge?: ProductBadge | null;
}

export function ProductGallery({ media, productName, productId, badge }: ProductGalleryProps) {
  const primary = media.find((m) => m.isPrimary) ?? media[0];
  const [activeId, setActiveId] = useState<string | undefined>(primary?.id);
  const active = media.find((m) => m.id === activeId) ?? primary;
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const activeIndex = Math.max(
    0,
    media.findIndex((m) => m.id === active?.id)
  );

  function step(direction: 1 | -1) {
    if (media.length === 0) return;
    const nextIndex = (activeIndex + direction + media.length) % media.length;
    setActiveId(media[nextIndex]?.id);
  }

  const visibleThumbnails = media.slice(0, MAX_VISIBLE_THUMBNAILS);
  const hiddenCount = media.length - visibleThumbnails.length;

  return (
    <div className="flex flex-col gap-3 md:flex-row-reverse">
      <div className="relative mx-auto aspect-[21/25] w-full max-w-[420px] max-h-[500px] overflow-hidden rounded-lg border border-border">
        <button
          type="button"
          onClick={() => {
            if (active) setIsLightboxOpen(true);
          }}
          disabled={!active}
          className="h-full w-full cursor-zoom-in disabled:cursor-default"
          aria-label="View full image"
        >
          <SafeImage src={active?.url ?? null} alt={active?.altText ?? productName} />
        </button>

        {badge === "BEST_SELLER" ? (
          <Badge variant="best-seller" className="absolute left-3 top-3">
            Best Seller
          </Badge>
        ) : null}
        {badge === "NEW" ? (
          <Badge variant="new" className="absolute left-3 top-3">
            New
          </Badge>
        ) : null}

        <WishlistButton productId={productId} className="absolute right-3 top-3" />

        {media.length > 1 ? (
          <>
            <IconButton
              icon={<ChevronLeft className="h-5 w-5" aria-hidden />}
              label="Previous image"
              onClick={() => step(-1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-surface/90 shadow-sm hover:bg-surface"
            />
            <IconButton
              icon={<ChevronRight className="h-5 w-5" aria-hidden />}
              label="Next image"
              onClick={() => step(1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-surface/90 shadow-sm hover:bg-surface"
            />
          </>
        ) : null}

        {isLightboxOpen && media.length > 0 ? (
          <ImageLightbox
            media={media}
            activeIndex={activeIndex}
            onNavigate={(index) => setActiveId(media[index]?.id)}
            onClose={() => setIsLightboxOpen(false)}
          />
        ) : null}
      </div>

      {media.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto md:w-20 md:flex-col md:overflow-x-visible md:overflow-y-auto">
          {visibleThumbnails.map((item, index) => {
            const isLast = index === visibleThumbnails.length - 1;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveId(item.id)}
                aria-current={item.id === active?.id}
                className={cn(
                  "relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors md:h-20 md:w-20",
                  item.id === active?.id ? "border-primary" : "border-border hover:border-primary/50"
                )}
              >
                <SafeImage src={item.url} alt={item.altText ?? productName} />
                {isLast && hiddenCount > 0 ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white">
                    +{hiddenCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
