import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: ReactNode;
  rightElement?: ReactNode;
  invalid?: boolean;
}

export function Input({ leftIcon, rightElement, invalid, className, ...props }: InputProps) {
  return (
    <div className="relative">
      {leftIcon ? (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
          {leftIcon}
        </span>
      ) : null}
      <input
        className={cn(
          "h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-text placeholder:text-text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30",
          leftIcon ? "pl-10" : undefined,
          rightElement ? "pr-10" : undefined,
          invalid ? "border-error focus:border-error focus:ring-error/30" : undefined,
          className
        )}
        aria-invalid={invalid}
        {...props}
      />
      {rightElement ? (
        <span className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</span>
      ) : null}
    </div>
  );
}
