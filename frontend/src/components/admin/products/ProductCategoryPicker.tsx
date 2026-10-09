"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api";
import { replaceCategories } from "@/lib/api/admin/products";
import type { CategoryResponse } from "@/lib/types/catalog";

interface ProductCategoryPickerProps {
  productId: string;
  categories: CategoryResponse[];
  selectedIds: string[];
  canUpdate: boolean;
}

/**
 * Saves independently via PUT /:id/categories, not bundled into the main
 * product form submit — matches the backend's own separation (categoryIds
 * isn't part of updateProductSchema). Always shows inactive categories too
 * (fetched with includeInactive=true) so an existing assignment to a since-
 * deactivated category stays visible/editable rather than disappearing.
 */
export function ProductCategoryPicker({ productId, categories, selectedIds, canUpdate }: ProductCategoryPickerProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(selectedIds);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggle(id: string) {
    setSaved(false);
    setSelected((current) => (current.includes(id) ? current.filter((c) => c !== id) : [...current, id]));
  }

  async function handleSave() {
    setIsSubmitting(true);
    setError(null);
    try {
      await replaceCategories(productId, selected);
      setSaved(true);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Couldn't save categories.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const active = categories.filter((c) => c.isActive);
  const inactive = categories.filter((c) => !c.isActive);

  return (
    <div className="flex flex-col gap-3">
      {error ? <p className="text-sm text-error">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {active.map((category) => (
          <label key={category.id} className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(category.id)}
              onChange={() => toggle(category.id)}
              disabled={!canUpdate}
            />
            {category.name}
          </label>
        ))}
      </div>
      {inactive.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <p className="w-full text-xs font-medium text-text-secondary">Inactive categories</p>
          {inactive.map((category) => (
            <label
              key={category.id}
              className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-2 py-1 text-sm text-text-secondary"
            >
              <input
                type="checkbox"
                checked={selected.includes(category.id)}
                onChange={() => toggle(category.id)}
                disabled={!canUpdate}
              />
              {category.name} (inactive)
            </label>
          ))}
        </div>
      ) : null}
      {canUpdate ? (
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={handleSave} isLoading={isSubmitting}>
            Save Categories
          </Button>
          {saved ? <span className="text-xs text-success">Saved</span> : null}
        </div>
      ) : null}
    </div>
  );
}
