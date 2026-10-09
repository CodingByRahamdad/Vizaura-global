"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Leaf, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { SafeImage } from "@/components/ui/SafeImage";
import { cn } from "@/lib/utils/cn";
import { safeHref } from "@/lib/utils/safeHref";
import type { HeroSlide } from "@/components/home/heroSlides";

const AUTOPLAY_MS = 5000;

const TRUST_ITEMS = [
  { icon: Leaf, label: "100% Natural Ingredients" },
  { icon: ShieldCheck, label: "Premium Quality" },
  { icon: Users, label: "Trusted by Thousands" },
];

interface HeroSliderProps {
  slides: HeroSlide[];
}

export function HeroSlider({ slides }: HeroSliderProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = useCallback(
    (index: number) => {
      setActiveIndex(((index % slides.length) + slides.length) % slides.length);
    },
    [slides.length]
  );

  useEffect(() => {
    if (isPaused || slides.length <= 1) return;
    timerRef.current = setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, AUTOPLAY_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, slides.length]);

  const slide = slides[activeIndex];
  if (!slide) return null;

  return (
    <div
      className="relative overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      {slides.map((s, index) => (
        <div
          key={s.id}
          aria-hidden={index !== activeIndex}
          className={cn(
            "absolute inset-0 transition-opacity duration-700",
            index === activeIndex ? "relative opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          <div className="absolute inset-0">
            <SafeImage src={s.imageUrl} alt="" className="h-full w-full" />
            <div className="absolute inset-0 bg-black/55" />
          </div>

          <Container className="relative z-10">
            <div className="flex min-h-[400px] flex-col justify-center gap-4 py-12 md:min-h-[460px] md:py-16">
              <p className="text-xs font-semibold uppercase tracking-widest text-warning">
                {s.overline}
              </p>
              <h1 className="max-w-xl font-serif text-4xl font-semibold text-white md:text-5xl">
                {s.heading}
              </h1>
              <p className="max-w-lg text-white/80">{s.description}</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button href={safeHref(s.primaryCta.href)} className="min-w-[160px]">
                  {s.primaryCta.label}
                </Button>
                <Button
                  href={safeHref(s.secondaryCta.href)}
                  variant="outline"
                  className="min-w-[200px] border-white text-white hover:bg-white/10"
                >
                  {s.secondaryCta.label}
                </Button>
              </div>

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 sm:flex-nowrap">
                {TRUST_ITEMS.map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-white">
                    <Icon className="h-5 w-5 shrink-0 text-white" aria-hidden />
                    <span className="text-sm font-medium whitespace-nowrap">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Container>
        </div>
      ))}

      {slides.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => goTo(activeIndex - 1)}
            className="absolute left-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition-colors hover:bg-white/30 md:left-6"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => goTo(activeIndex + 1)}
            className="absolute right-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition-colors hover:bg-white/30 md:right-6"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>

          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2">
            {slides.map((s, index) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Go to slide ${index + 1}`}
                aria-current={index === activeIndex}
                onClick={() => goTo(index)}
                className={cn(
                  "h-2 rounded-full transition-all",
                  index === activeIndex ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/75"
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
