import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Container({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[var(--container-max)] px-5 md:px-17", className)}
      {...props}
    />
  );
}
