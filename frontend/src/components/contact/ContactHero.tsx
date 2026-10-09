import { Globe2, ShieldCheck, Zap } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SafeImage } from "@/components/ui/SafeImage";
import { TRUST_ITEMS } from "@/lib/constants/contact-content";

const ICONS = { zap: Zap, shield: ShieldCheck, globe: Globe2 } as const;

export function ContactHero() {
  return (
    <section
      className="relative overflow-hidden bg-gradient-to-br from-primary-light/60 via-cream to-surface"
      aria-label="Contact hero"
    >
      <Container className="grid gap-8 py-14 md:py-20 lg:grid-cols-2 lg:items-center">
        <div className="flex flex-col gap-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-green">Get in Touch</p>
          <h1 className="font-serif text-4xl font-semibold text-text md:text-5xl">Contact Us</h1>
          <p className="max-w-lg text-text-secondary">
            We&apos;re here to help! Whether you have a question, feedback, or need assistance, our team is
            ready to support you.
          </p>
          <div className="mt-2 flex flex-wrap gap-6">
            {TRUST_ITEMS.map((item) => {
              const Icon = ICONS[item.icon];
              return (
                <div key={item.label} className="flex items-start gap-2.5">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <div>
                    <p className="text-sm font-medium text-text">{item.label}</p>
                    <p className="text-xs text-text-secondary">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative mx-auto h-56 w-full max-w-md overflow-hidden rounded-xl md:h-72">
          <SafeImage src="/Contact%20us%20page/hero-image.webp" alt="VIZAURA GLOBAL Himalayan Shilajit jar with botanical leaves" />
          <span
            aria-hidden
            className="absolute right-4 top-4 hidden font-serif text-lg italic text-primary-dark md:block"
          >
            Nature Connects Us
          </span>
        </div>
      </Container>
    </section>
  );
}
