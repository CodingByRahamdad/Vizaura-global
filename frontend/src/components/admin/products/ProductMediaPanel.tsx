"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SafeImage } from "@/components/ui/SafeImage";
import { ApiError } from "@/lib/api";
import { createMedia, deleteMedia, updateMedia, uploadProductMedia } from "@/lib/api/admin/products";
import type { MediaItem } from "@/lib/types/catalog";

interface ProductMediaPanelProps {
  productId: string;
  media: MediaItem[];
  canUpdate: boolean;
}

/**
 * Real file upload (Phase 6M, local disk storage — see
 * docs/modules/CATALOG.md for the production-storage caveat) alongside the
 * original URL-entry field, which stays fully supported — pasting an
 * externally-hosted image URL is still a valid way to add media.
 */
export function ProductMediaPanel({ productId, media, canUpdate }: ProductMediaPanelProps) {
  const router = useRouter();
  const [newUrl, setNewUrl] = useState("");
  const [newAlt, setNewAlt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleAdd() {
    setIsSubmitting(true);
    setError(null);
    try {
      await createMedia(productId, { url: newUrl, altText: newAlt || undefined, isPrimary: media.length === 0 });
      setNewUrl("");
      setNewAlt("");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Couldn't add media.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file
    if (!file) return;

    setIsUploading(true);
    setError(null);
    try {
      await uploadProductMedia(productId, file, { isPrimary: media.length === 0 });
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Couldn't upload image.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleMove(item: MediaItem, direction: -1 | 1) {
    const sorted = [...media].sort((a, b) => a.position - b.position);
    const index = sorted.findIndex((m) => m.id === item.id);
    const swapWith = sorted[index + direction];
    if (!swapWith) return;

    setError(null);
    try {
      await Promise.all([
        updateMedia(productId, item.id, { position: swapWith.position }),
        updateMedia(productId, swapWith.id, { position: item.position }),
      ]);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Couldn't reorder media.");
    }
  }

  async function handleSetPrimary(mediaId: string) {
    setError(null);
    try {
      await updateMedia(productId, mediaId, { isPrimary: true });
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Couldn't update media.");
    }
  }

  async function handleRemove(mediaId: string) {
    setError(null);
    try {
      await deleteMedia(productId, mediaId);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Couldn't remove media.");
    }
  }

  const sorted = [...media].sort((a, b) => a.position - b.position);

  return (
    <div className="flex flex-col gap-4">
      {error ? <p className="text-sm text-error">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {sorted.map((item, index) => (
          <div key={item.id} className="flex flex-col gap-1">
            <div className="aspect-square overflow-hidden rounded-md border border-border">
              <SafeImage src={item.url} alt={item.altText ?? ""} />
            </div>
            <div className="flex items-center justify-between">
              {item.isPrimary ? (
                <span className="text-xs font-medium text-primary">Primary</span>
              ) : canUpdate ? (
                <button type="button" onClick={() => handleSetPrimary(item.id)} className="text-xs text-text-secondary underline">
                  Set primary
                </button>
              ) : (
                <span />
              )}
              {canUpdate ? (
                <button type="button" onClick={() => handleRemove(item.id)} className="text-xs text-error underline">
                  Remove
                </button>
              ) : null}
            </div>
            {canUpdate && sorted.length > 1 ? (
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handleMove(item, -1)}
                  disabled={index === 0}
                  className="text-xs text-text-secondary underline disabled:opacity-30"
                >
                  ↑ Move up
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(item, 1)}
                  disabled={index === sorted.length - 1}
                  className="text-xs text-text-secondary underline disabled:opacity-30"
                >
                  ↓ Move down
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {canUpdate ? (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelected}
              className="hidden"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              isLoading={isUploading}
            >
              Upload Image
            </Button>
            <span className="text-xs text-text-secondary">JPEG, PNG, or WEBP, up to 5MB.</span>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <Input placeholder="Or paste an image URL" value={newUrl} onChange={(event) => setNewUrl(event.target.value)} className="w-64" />
            <Input placeholder="Alt text (optional)" value={newAlt} onChange={(event) => setNewAlt(event.target.value)} className="w-48" />
            <Button type="button" size="sm" onClick={handleAdd} isLoading={isSubmitting} disabled={!newUrl}>
              Add Image
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
