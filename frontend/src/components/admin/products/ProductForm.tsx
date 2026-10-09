"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api";
import { slugify } from "@/lib/utils/slugify";
import { createProduct, updateProduct, type CreateProductInput } from "@/lib/api/admin/products";
import { MARKET_CODES } from "@/lib/constants/market";
import type { CategoryResponse, ProductBadge, ProductDetailResponse, ProductSpecification } from "@/lib/types/catalog";

interface ProductFormProps {
  mode: "create" | "edit";
  product?: ProductDetailResponse;
  categories: CategoryResponse[];
  canUpdate: boolean;
}

const STATUS_OPTIONS = [
  { label: "Draft", value: "DRAFT" },
  { label: "Active", value: "ACTIVE" },
  { label: "Archived", value: "ARCHIVED" },
];

const BADGE_OPTIONS = [
  { label: "None", value: "" },
  { label: "Best Seller", value: "BEST_SELLER" },
  { label: "New", value: "NEW" },
];

/**
 * POST /products accepts categoryIds/markets inline and creates the product
 * + category links + market rows in one transaction
 * (products.repository.ts::create) — no multi-call orchestration or
 * partial-failure handling is needed for the create step itself. No variant
 * is created here: the product starts with zero variants, and the admin is
 * redirected to the edit page to explicitly create the first one via "Add
 * variant" (ProductVariantsPanel), which also collects Size, price and
 * stock in one step.
 */
export function ProductForm({ mode, product, categories, canUpdate }: ProductFormProps) {
  const router = useRouter();
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [shortDescription, setShortDescription] = useState(product?.shortDescription ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [status, setStatus] = useState(product?.status ?? "DRAFT");
  const [badge, setBadge] = useState<string>(product?.badge ?? "");
  const [features, setFeatures] = useState<string[]>(product?.features ?? []);
  const [specifications, setSpecifications] = useState<ProductSpecification[]>(product?.specifications ?? []);
  const [benefits, setBenefits] = useState<string[]>(product?.benefits ?? []);
  const [ingredients, setIngredients] = useState<string[]>(product?.ingredients ?? []);
  const [certifications, setCertifications] = useState<string[]>(product?.certifications ?? []);
  const [storageInstructions, setStorageInstructions] = useState(product?.storageInstructions ?? "");
  const [shelfLife, setShelfLife] = useState(product?.shelfLife ?? "");
  const [categoryIds, setCategoryIds] = useState<string[]>(product?.categories.map((c) => c.id) ?? []);
  const [pkVisible, setPkVisible] = useState(false);
  const [aeVisible, setAeVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSlug = slugTouched ? slug : slugify(name);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const effectiveBadge = (badge || null) as ProductBadge | null;
    const effectiveFeatures = features.map((f) => f.trim()).filter(Boolean);
    const effectiveSpecifications = specifications
      .map((s) => ({ key: s.key.trim(), value: s.value.trim() }))
      .filter((s) => s.key && s.value);
    const effectiveBenefits = benefits.map((b) => b.trim()).filter(Boolean);
    const effectiveIngredients = ingredients.map((i) => i.trim()).filter(Boolean);
    const effectiveCertifications = certifications.map((c) => c.trim()).filter(Boolean);

    try {
      if (mode === "edit" && product) {
        await updateProduct(product.id, {
          name,
          slug: effectiveSlug,
          shortDescription,
          description,
          status: status as "DRAFT" | "ACTIVE" | "ARCHIVED",
          badge: effectiveBadge,
          features: effectiveFeatures,
          specifications: effectiveSpecifications,
          benefits: effectiveBenefits,
          ingredients: effectiveIngredients,
          certifications: effectiveCertifications,
          storageInstructions: storageInstructions || undefined,
          shelfLife: shelfLife || undefined,
        });
        router.refresh();
        return;
      }

      const input: CreateProductInput = {
        name,
        slug: effectiveSlug || undefined,
        shortDescription: shortDescription || undefined,
        description: description || undefined,
        status: status as "DRAFT" | "ACTIVE" | "ARCHIVED",
        badge: effectiveBadge,
        features: effectiveFeatures,
        specifications: effectiveSpecifications,
        benefits: effectiveBenefits,
        ingredients: effectiveIngredients,
        certifications: effectiveCertifications,
        storageInstructions: storageInstructions || undefined,
        shelfLife: shelfLife || undefined,
        categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
        markets: [
          { marketCode: "PK", isAvailable: pkVisible, isVisible: pkVisible },
          { marketCode: "AE", isAvailable: aeVisible, isVisible: aeVisible },
        ],
      };

      const created = await createProduct(input);

      // categoryIds/markets are already sent via createProduct's own
      // markets/categoryIds fields in one call — no further steps needed
      // unless that create call itself only partially applied them, which
      // it cannot (single transaction server-side, see products.repository.ts).
      // No variant is created here — the product starts with zero variants;
      // the admin is redirected to the edit page to explicitly add one via
      // "Add variant" (ProductVariantsPanel), which also collects Size,
      // price and stock in one step.
      router.push(`/admin/products/${created.id}`);
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        setError(submitError.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleCategory(id: string) {
    setCategoryIds((current) => (current.includes(id) ? current.filter((c) => c !== id) : [...current, id]));
  }

  function updateFeature(index: number, value: string) {
    setFeatures((current) => current.map((f, i) => (i === index ? value : f)));
  }

  function removeFeature(index: number) {
    setFeatures((current) => current.filter((_, i) => i !== index));
  }

  function updateSpecification(index: number, field: "key" | "value", value: string) {
    setSpecifications((current) => current.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  function removeSpecification(index: number) {
    setSpecifications((current) => current.filter((_, i) => i !== index));
  }

  function updateBenefit(index: number, value: string) {
    setBenefits((current) => current.map((b, i) => (i === index ? value : b)));
  }

  function removeBenefit(index: number) {
    setBenefits((current) => current.filter((_, i) => i !== index));
  }

  function updateIngredient(index: number, value: string) {
    setIngredients((current) => current.map((ingredient, i) => (i === index ? value : ingredient)));
  }

  function removeIngredient(index: number) {
    setIngredients((current) => current.filter((_, i) => i !== index));
  }

  function updateCertification(index: number, value: string) {
    setCertifications((current) => current.map((c, i) => (i === index ? value : c)));
  }

  function removeCertification(index: number) {
    setCertifications((current) => current.filter((_, i) => i !== index));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error ? <p className="rounded-md bg-error/10 px-3 py-2 text-sm text-error">{error}</p> : null}

      <FormField label="Name" htmlFor="product-name" required>
        <Input
          id="product-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={!canUpdate}
          required
        />
      </FormField>

      <FormField label="Slug" htmlFor="product-slug" required>
        <Input
          id="product-slug"
          value={effectiveSlug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.target.value);
          }}
          disabled={!canUpdate}
          required
        />
      </FormField>

      <FormField label="Short description" htmlFor="product-short-description">
        <Input
          id="product-short-description"
          value={shortDescription}
          onChange={(event) => setShortDescription(event.target.value)}
          disabled={!canUpdate}
        />
      </FormField>

      <FormField label="Description" htmlFor="product-description">
        <textarea
          id="product-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={!canUpdate}
          rows={5}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </FormField>

      <FormField label="Status" htmlFor="product-status">
        <Select
          id="product-status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          disabled={!canUpdate}
          options={STATUS_OPTIONS}
        />
      </FormField>

      <FormField label="Badge" htmlFor="product-badge">
        <Select
          id="product-badge"
          value={badge}
          onChange={(event) => setBadge(event.target.value)}
          disabled={!canUpdate}
          options={BADGE_OPTIONS}
        />
      </FormField>

      <FormField label="Highlights / tags" htmlFor="product-features">
        <div className="flex flex-col gap-2">
          {features.map((feature, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={feature}
                onChange={(event) => updateFeature(index, event.target.value)}
                disabled={!canUpdate}
                placeholder="e.g. Boosts Energy & Stamina"
              />
              {canUpdate ? (
                <Button type="button" variant="outline" size="sm" onClick={() => removeFeature(index)}>
                  Remove
                </Button>
              ) : null}
            </div>
          ))}
          {canUpdate ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setFeatures((f) => [...f, ""])}>
              Add feature
            </Button>
          ) : null}
        </div>
      </FormField>

      <FormField label="Specifications" htmlFor="product-specifications">
        <div className="flex flex-col gap-2">
          {specifications.map((spec, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={spec.key}
                onChange={(event) => updateSpecification(index, "key", event.target.value)}
                disabled={!canUpdate}
                placeholder="e.g. Net Weight"
              />
              <Input
                value={spec.value}
                onChange={(event) => updateSpecification(index, "value", event.target.value)}
                disabled={!canUpdate}
                placeholder="e.g. 30g"
              />
              {canUpdate ? (
                <Button type="button" variant="outline" size="sm" onClick={() => removeSpecification(index)}>
                  Remove
                </Button>
              ) : null}
            </div>
          ))}
          {canUpdate ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSpecifications((s) => [...s, { key: "", value: "" }])}
            >
              Add specification
            </Button>
          ) : null}
        </div>
      </FormField>

      <FormField label="Key benefits" htmlFor="product-benefits">
        <div className="flex flex-col gap-2">
          {benefits.map((benefit, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={benefit}
                onChange={(event) => updateBenefit(index, event.target.value)}
                disabled={!canUpdate}
                placeholder="e.g. Boosts Energy & Stamina"
              />
              {canUpdate ? (
                <Button type="button" variant="outline" size="sm" onClick={() => removeBenefit(index)}>
                  Remove
                </Button>
              ) : null}
            </div>
          ))}
          {canUpdate ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setBenefits((b) => [...b, ""])}>
              Add benefit
            </Button>
          ) : null}
        </div>
      </FormField>

      <FormField label="Ingredients" htmlFor="product-ingredients">
        <div className="flex flex-col gap-2">
          {ingredients.map((ingredient, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={ingredient}
                onChange={(event) => updateIngredient(index, event.target.value)}
                disabled={!canUpdate}
                placeholder="e.g. Himalayan Shilajit Extract"
              />
              {canUpdate ? (
                <Button type="button" variant="outline" size="sm" onClick={() => removeIngredient(index)}>
                  Remove
                </Button>
              ) : null}
            </div>
          ))}
          {canUpdate ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setIngredients((i) => [...i, ""])}>
              Add ingredient
            </Button>
          ) : null}
        </div>
      </FormField>

      <FormField label="Certifications" htmlFor="product-certifications">
        <div className="flex flex-col gap-2">
          {certifications.map((certification, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={certification}
                onChange={(event) => updateCertification(index, event.target.value)}
                disabled={!canUpdate}
                placeholder="e.g. ISO 22000"
              />
              {canUpdate ? (
                <Button type="button" variant="outline" size="sm" onClick={() => removeCertification(index)}>
                  Remove
                </Button>
              ) : null}
            </div>
          ))}
          {canUpdate ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCertifications((c) => [...c, ""])}
            >
              Add certification
            </Button>
          ) : null}
        </div>
      </FormField>

      <FormField label="Storage instructions" htmlFor="product-storage">
        <Input
          id="product-storage"
          value={storageInstructions}
          onChange={(event) => setStorageInstructions(event.target.value)}
          disabled={!canUpdate}
          placeholder="e.g. Store in a cool, dry place away from direct sunlight."
        />
      </FormField>

      <FormField label="Shelf life" htmlFor="product-shelf-life">
        <Input
          id="product-shelf-life"
          value={shelfLife}
          onChange={(event) => setShelfLife(event.target.value)}
          disabled={!canUpdate}
          placeholder="e.g. 24 months from manufacture date"
        />
      </FormField>

      {mode === "create" ? (
        <>
          <FormField label="Categories" htmlFor="product-categories">
            <div className="flex flex-wrap gap-2">
              {categories.length === 0 ? (
                <p className="text-sm text-text-secondary">No categories yet.</p>
              ) : (
                categories.map((category) => (
                  <label
                    key={category.id}
                    className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={categoryIds.includes(category.id)}
                      onChange={() => toggleCategory(category.id)}
                    />
                    {category.name}
                    {!category.isActive ? <span className="text-text-secondary"> (inactive)</span> : null}
                  </label>
                ))
              )}
            </div>
          </FormField>

          <FormField label="Market availability" htmlFor="product-markets">
            <div className="flex gap-4">
              {MARKET_CODES.map((code) => (
                <label key={code} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={code === "PK" ? pkVisible : aeVisible}
                    onChange={(event) =>
                      code === "PK" ? setPkVisible(event.target.checked) : setAeVisible(event.target.checked)
                    }
                  />
                  Visible in {code}
                </label>
              ))}
            </div>
          </FormField>
        </>
      ) : null}

      {canUpdate ? (
        <div className="flex justify-end">
          <Button type="submit" isLoading={isSubmitting}>
            {mode === "create" ? "Create Product" : "Save Changes"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
