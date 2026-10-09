"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { ProductKeyBenefits } from "@/components/catalog/ProductKeyBenefits";
import type { ProductSpecification } from "@/lib/types/catalog";

type TabKey = "description" | "specifications" | "ingredients" | "reviews" | "shipping";

interface ProductTabsProps {
  description: string | null;
  specifications: ProductSpecification[];
  benefits: string[];
  ingredients: string[];
  certifications: string[];
  storageInstructions: string | null;
  shelfLife: string | null;
  reviews: ReactNode;
}

export function ProductTabs({
  description,
  specifications,
  benefits,
  ingredients,
  certifications,
  storageInstructions,
  shelfLife,
  reviews,
}: ProductTabsProps) {
  const allSpecifications: ProductSpecification[] = [
    { key: "Brand", value: "VIZAURA GLOBAL" },
    ...specifications,
    ...(certifications.length > 0 ? [{ key: "Certifications", value: certifications.join(", ") }] : []),
    ...(storageInstructions ? [{ key: "Storage", value: storageInstructions }] : []),
    ...(shelfLife ? [{ key: "Shelf Life", value: shelfLife }] : []),
  ];
  const hasIngredients = ingredients.length > 0;
  const hasBenefits = benefits.length > 0;
  const [active, setActive] = useState<TabKey>("description");

  // ProductRating's "Write a review"/"No reviews yet" links point at
  // #write-review, which only exists in the DOM once this tab is active —
  // switch to it on load (and on an in-page hash change, e.g. clicking the
  // link again) so those links actually reveal the review form instead of
  // silently doing nothing.
  useEffect(() => {
    function syncFromHash() {
      if (window.location.hash === "#reviews" || window.location.hash === "#write-review") {
        setActive("reviews");
        // The browser's native hash-jump ran before this tab's content
        // existed in the DOM; re-scroll once it's painted.
        requestAnimationFrame(() => {
          document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" });
        });
      }
    }
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "description", label: "Description" },
    { key: "specifications", label: "Specifications" },
    ...(hasIngredients ? ([{ key: "ingredients", label: "Ingredients" }] as const) : []),
    { key: "reviews", label: "Reviews" },
    { key: "shipping", label: "Shipping & Returns" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-6 overflow-x-auto border-b border-border" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            id={tab.key === "reviews" ? "reviews" : undefined}
            type="button"
            role="tab"
            aria-selected={active === tab.key}
            onClick={() => setActive(tab.key)}
            className={cn(
              "shrink-0 border-b-2 pb-3 text-sm font-medium transition-colors",
              active === tab.key
                ? "border-primary text-primary-dark"
                : "border-transparent text-text-secondary hover:text-text"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === "description" ? (
        <div className={cn("grid grid-cols-1 gap-8", hasBenefits && "lg:grid-cols-2")}>
          <div>
            <h3 className="mb-3 font-serif text-lg font-semibold text-text">Product Description</h3>
            <p className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">
              {description ?? "No description available for this product."}
            </p>
          </div>
          {hasBenefits ? <ProductKeyBenefits benefits={benefits} /> : null}
        </div>
      ) : null}

      {active === "specifications" ? (
        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
          {allSpecifications.map((spec) => (
            <div key={spec.key} className="flex justify-between border-b border-border py-2 text-sm">
              <dt className="text-text-secondary">{spec.key}</dt>
              <dd className="font-medium text-text">{spec.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {active === "ingredients" && hasIngredients ? (
        <ul className="flex flex-col gap-2 text-sm leading-relaxed text-text-secondary">
          {ingredients.map((ingredient, index) => (
            <li key={index}>{ingredient}</li>
          ))}
        </ul>
      ) : null}

      {active === "reviews" ? <div>{reviews}</div> : null}

      {active === "shipping" ? (
        <div className="flex flex-col gap-3 text-sm leading-relaxed text-text-secondary">
          <p>We ship across Pakistan and the UAE. Orders are processed within 1-2 business days.</p>
          <p>
            Free shipping is available above the market&apos;s minimum order threshold; standard shipping rates
            apply below that.
          </p>
          <p>Items can be returned within 7 days of delivery in their original condition for a full refund.</p>
        </div>
      ) : null}
    </div>
  );
}
