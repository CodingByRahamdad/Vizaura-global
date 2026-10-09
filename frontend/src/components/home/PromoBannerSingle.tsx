import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { SafeImage } from "@/components/ui/SafeImage";
import { safeHref } from "@/lib/utils/safeHref";

export interface PromoBannerSingleProps {
  overline: string | null;
  title: string;
  subtitle: string | null;
  badge: string | null;
  ctaText: string;
  ctaLink: string;
  imageUrl: string | null;
}

/**
 * Pure presentational — every string/URL is a prop, nothing hardcoded. Body
 * is byte-for-byte the original PromoBanner.tsx design (the attached
 * reference image), now fed by real admin-controlled data instead of
 * literal strings. Reused both by the homepage (via PromoBanner.tsx) and the
 * admin Promotion form's live preview panel.
 */
export function PromoBannerSingle({
  overline,
  title,
  subtitle,
  badge,
  ctaText,
  ctaLink,
  imageUrl,
}: PromoBannerSingleProps) {
  return (
    <Container className="my-8 md:my-10">
      <div className="relative h-56 overflow-hidden rounded-lg md:h-64">
        <div className="absolute inset-0">
          <SafeImage src={imageUrl} alt="" className="h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
        </div>

        <div className="relative z-10 flex h-full flex-col items-start justify-center gap-3 px-5 md:flex-row md:items-center md:justify-between md:px-10">
          <div className="flex flex-col gap-2">
            {overline ? (
              <p className="text-xs font-semibold uppercase tracking-widest text-warning">{overline}</p>
            ) : null}
            <h2 className="max-w-md font-serif text-2xl font-semibold text-white md:text-3xl">{title}</h2>
            {subtitle ? <p className="max-w-md text-sm text-white/80">{subtitle}</p> : null}
            <Button href={safeHref(ctaLink)} size="sm" className="mt-1 w-fit">
              {ctaText}
            </Button>
          </div>

          {badge ? (
            <div className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-white/70 text-center text-white md:flex">
              <span className="font-serif text-base font-semibold leading-tight">{badge}</span>
            </div>
          ) : null}
        </div>
      </div>
    </Container>
  );
}
