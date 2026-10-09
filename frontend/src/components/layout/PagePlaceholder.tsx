import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";

interface PagePlaceholderProps {
  eyebrow?: string;
  title: string;
  description?: string;
}

export function PagePlaceholder({ eyebrow, title, description }: PagePlaceholderProps) {
  return (
    <Container>
      <Section className="flex min-h-[40vh] flex-col items-start justify-center gap-3">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-green">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-serif text-3xl font-semibold text-text md:text-4xl">{title}</h1>
        <p className="max-w-xl text-text-secondary">
          {description ?? "This page is part of the Phase 5A foundation and will be built out in a later phase."}
        </p>
      </Section>
    </Container>
  );
}
