"use client";

import { useState, type ReactNode, type SyntheticEvent } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface SafeImageProps {
  src: string | null;
  alt: string;
  className?: string;
  fallback?: ReactNode;
}

/**
 * Plain <img> (not next/image) — no confirmed remote media host/CDN exists
 * yet, so next.config.ts has no images.remotePatterns to allowlist against.
 * Falls back to a placeholder (or a custom `fallback` node) on missing src
 * or a failed load.
 */
export function SafeImage({ src, alt, className, fallback }: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-primary-light/30 text-text-secondary",
          className
        )}
      >
        {fallback ?? <ImageOff className="h-6 w-6" aria-hidden />}
      </div>
    );
  }

  function handleError(event: SyntheticEvent<HTMLImageElement>) {
    event.currentTarget.onerror = null;
    setFailed(true);
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- no confirmed remote image host yet
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={handleError}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}
