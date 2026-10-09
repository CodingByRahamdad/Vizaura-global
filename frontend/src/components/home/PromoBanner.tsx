import { getActivePromotions } from "@/lib/api/promotions";
import { PromoBannerSingle } from "@/components/home/PromoBannerSingle";
import { PromoBannerGrid } from "@/components/home/PromoBannerGrid";

/**
 * Fully backend/admin-controlled — no hardcoded promotional copy, image,
 * discount, or CTA anywhere in this file or its children. Renders nothing
 * when zero promotions are currently eligible (handled gracefully, not a
 * broken layout gap). See backend/src/modules/promotions/promotions.service.ts
 * #getActiveForHomepage for the SINGLE-vs-GRID selection rule.
 */
export async function PromoBanner() {
  let result: Awaited<ReturnType<typeof getActivePromotions>> = { layout: null, promotions: [] };

  try {
    result = await getActivePromotions();
  } catch {
    // No promotion to show is a safe, silent fallback — this is a
    // decorative homepage section, not a critical path.
    return null;
  }

  if (result.layout === "SINGLE" && result.promotions[0]) {
    const promotion = result.promotions[0];
    return (
      <PromoBannerSingle
        overline={promotion.overline}
        title={promotion.title}
        subtitle={promotion.subtitle}
        badge={promotion.badge}
        ctaText={promotion.ctaText}
        ctaLink={promotion.ctaLink}
        imageUrl={promotion.imageUrl}
      />
    );
  }

  if (result.layout === "GRID" && result.promotions[0]) {
    const promotion = result.promotions[0];
    // Card 1 is always the promotion's own top-level fields; card 2 only
    // exists when Grid 2 was actually configured (grid2 !== null) — both
    // come from this single row, not a second Promotion record.
    const cards = [
      {
        overline: promotion.overline,
        title: promotion.title,
        subtitle: promotion.subtitle,
        badge: promotion.badge,
        ctaText: promotion.ctaText,
        ctaLink: promotion.ctaLink,
        imageUrl: promotion.imageUrl,
      },
      ...(promotion.grid2 ? [promotion.grid2] : []),
    ];
    return <PromoBannerGrid cards={cards} />;
  }

  return null;
}
