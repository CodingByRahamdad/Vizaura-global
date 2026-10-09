import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type BadgeVariant =
  | "best-seller"
  | "new"
  | "discount"
  | "success"
  | "warning"
  | "error"
  | "neutral";

const variantClasses: Record<BadgeVariant, string> = {
  "best-seller": "bg-primary text-white",
  new: "bg-accent-green text-white",
  discount: "bg-error text-white",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  error: "bg-error/10 text-error",
  neutral: "bg-primary-light text-primary-dark",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
