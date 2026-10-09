import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface AboutSectionHeaderProps {
  eyebrow: string;
  title: ReactNode;
  id?: string;
  tone?: "light" | "dark";
  className?: string;
}

export function AboutSectionHeader({ eyebrow, title, id, tone = "light", className }: AboutSectionHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <p
        className={cn(
          "text-xs font-semibold uppercase tracking-[0.2em]",
          tone === "dark" ? "text-primary-light" : "text-warning"
        )}
      >
        {eyebrow}
      </p>
      <h2
        id={id}
        className={cn(
          "font-serif text-3xl font-semibold leading-tight md:text-4xl",
          tone === "dark" ? "text-white" : "text-forest"
        )}
      >
        {title}
      </h2>
    </div>
  );
}
