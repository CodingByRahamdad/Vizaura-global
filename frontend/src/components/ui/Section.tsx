import type { ElementType, HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

interface SectionProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
}

export function Section({ as: Tag = "section", className, ...props }: SectionProps) {
  return <Tag className={cn("py-10 md:py-14", className)} {...props} />;
}
