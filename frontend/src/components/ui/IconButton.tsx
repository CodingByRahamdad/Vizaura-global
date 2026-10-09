import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
  variant?: "default" | "ghost";
}

export function IconButton({
  icon,
  label,
  variant = "ghost",
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-md text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        variant === "ghost" ? "hover:bg-primary-light/50" : "border border-border hover:bg-surface",
        className
      )}
      {...props}
    >
      {icon}
    </button>
  );
}
