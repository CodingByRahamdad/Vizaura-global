"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import type { MediaItem } from "@/lib/types/catalog";

interface ImageLightboxProps {
  media: MediaItem[];
  activeIndex: number;
  onNavigate: (index: number) => void;
  onClose: () => void;
}

export function ImageLightbox({ media, activeIndex, onNavigate, onClose }: ImageLightboxProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onNavigate((activeIndex - 1 + media.length) % media.length);
      if (event.key === "ArrowRight") onNavigate((activeIndex + 1) % media.length);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, media.length, onNavigate, onClose]);

  const active = media[activeIndex];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-text hover:bg-white"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>

      {media.length > 1 ? (
        <button
          type="button"
          aria-label="Previous image"
          onClick={(event) => {
            event.stopPropagation();
            onNavigate((activeIndex - 1 + media.length) % media.length);
          }}
          className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-text hover:bg-white"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
      ) : null}

      <div
        className="h-[80vh] w-full max-w-3xl overflow-hidden rounded-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <SafeImage src={active?.url ?? null} alt={active?.altText ?? "Product image"} className="object-contain" />
      </div>

      {media.length > 1 ? (
        <button
          type="button"
          aria-label="Next image"
          onClick={(event) => {
            event.stopPropagation();
            onNavigate((activeIndex + 1) % media.length);
          }}
          className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-text hover:bg-white"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
