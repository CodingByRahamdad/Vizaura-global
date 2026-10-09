import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface FeatureItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface FeatureColumnsProps {
  items: readonly FeatureItem[];
  tone?: "light" | "dark";
  iconVariant?: "blob" | "plain";
  align?: "center" | "start";
  className?: string;
}

/**
 * Shared 4-up icon row (Mission & Values, Why Choose Us, Impact) — 2 columns
 * from the smallest width up (most phones are under the old sm breakpoint),
 * 4-up from lg. Vertical dividers only kick in at lg, so the 2x2 grid never
 * gets a stray border on the 3rd item.
 */
export function FeatureColumns({
  items,
  tone = "light",
  iconVariant = "plain",
  align = "center",
  className,
}: FeatureColumnsProps) {
  const isDark = tone === "dark";
  const isCenter = align === "center";

  return (
    <ul className={cn("grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4 lg:gap-0", className)}>
      {items.map(({ icon: Icon, title, description }) => (
        <li
          key={title}
          className={cn(
            "flex min-w-0 flex-col gap-3",
            isCenter ? "items-center text-center" : "items-start text-left",
            "lg:border-l lg:px-5 lg:first:border-l-0 lg:first:pl-0",
            isDark ? "lg:border-white/15" : "lg:border-border"
          )}
        >
          {iconVariant === "blob" ? (
            <span className="flex h-16 w-16 items-center justify-center rounded-[58%_42%_52%_48%/48%_56%_44%_52%] bg-accent-green/10">
              <Icon className="h-7 w-7 text-primary" strokeWidth={1.5} aria-hidden />
            </span>
          ) : (
            <Icon className={cn("h-8 w-8", isDark ? "text-white" : "text-primary")} strokeWidth={1.5} aria-hidden />
          )}
          <h3 className={cn("font-serif text-lg font-semibold", isDark ? "text-white" : "text-forest")}>{title}</h3>
          <p className={cn("max-w-[15rem] text-sm leading-relaxed", isDark ? "text-white/70" : "text-text-secondary")}>
            {description}
          </p>
        </li>
      ))}
    </ul>
  );
}
