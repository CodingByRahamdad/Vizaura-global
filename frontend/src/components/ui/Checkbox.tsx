import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function Checkbox({ label, id, className, ...props }: CheckboxProps) {
  return (
    <label htmlFor={id} className={cn("flex items-center gap-2 text-sm text-text", className)}>
      <input
        id={id}
        type="checkbox"
        className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/30"
        {...props}
      />
      {label}
    </label>
  );
}
