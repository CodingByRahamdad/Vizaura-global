import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { SafeImage } from "@/components/ui/SafeImage";
import { safeHref } from "@/lib/utils/safeHref";
import type { PublicPromotionCard } from "@/lib/types/promotions";

export interface PromoBannerGridProps {
  /** 1 or 2 cards — card 1 and (when configured) card 2 of a single GRID-layout promotion. */
  cards: PublicPromotionCard[];
}

/**
 * Two independent promotion cards side by side (one card alone renders
 * within this same grid area when Grid 2 isn't configured — never stretched
 * into the single-banner design). No reference image exists for this mode;
 * mirrors PromoBannerSingle's visual language (dark photo background,
 * overline, serif heading, CTA, badge) at card width rather than inventing
 * a different style.
 */
export function PromoBannerGrid({ cards }: PromoBannerGridProps) {
  return (
    <Container className="my-8 md:my-10">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((promotion, index) => (
          <div key={index} className="relative h-48 overflow-hidden rounded-lg md:h-56">
            <div className="absolute inset-0">
              <SafeImage src={promotion.imageUrl} alt="" className="h-full w-full" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent" />
            </div>

            <div className="relative z-10 flex h-full flex-col justify-end gap-2 p-5">
              {promotion.badge ? (
                <span className="w-fit rounded-full border border-white/70 px-2.5 py-1 text-xs font-semibold text-white">
                  {promotion.badge}
                </span>
              ) : null}
              {promotion.overline ? (
                <p className="text-xs font-semibold uppercase tracking-widest text-warning">{promotion.overline}</p>
              ) : null}
              <h3 className="font-serif text-xl font-semibold text-white">{promotion.title}</h3>
              {promotion.subtitle ? <p className="text-sm text-white/80">{promotion.subtitle}</p> : null}
              <Button href={safeHref(promotion.ctaLink)} size="sm" className="mt-1 w-fit">
                {promotion.ctaText}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Container>
  );
}
