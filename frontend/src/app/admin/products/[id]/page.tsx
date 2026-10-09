import { notFound } from "next/navigation";
import { requireAdminPermission } from "@/lib/auth/requireAdminPermission";
import { getAdminProductDetailServer } from "@/lib/api/admin/products-server";
import { getCategoriesForAdminServer } from "@/lib/api/admin/categories";
import { getPricesForVariantServer } from "@/lib/api/admin/pricing-server";
import { getStockForVariantServer } from "@/lib/api/admin/inventory-server";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { hasPermission } from "@/lib/authorization";
import { ApiError } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminFormSection } from "@/components/admin/AdminFormSection";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { ProductForm } from "@/components/admin/products/ProductForm";
import { ProductCategoryPicker } from "@/components/admin/products/ProductCategoryPicker";
import { ProductMarketPanel } from "@/components/admin/products/ProductMarketPanel";
import { ProductVariantsPanel } from "@/components/admin/products/ProductVariantsPanel";
import { ProductMediaPanel } from "@/components/admin/products/ProductMediaPanel";
import { ProductLifecycleActions } from "@/components/admin/products/ProductLifecycleActions";
import type { AdminPriceResponse, AdminStockResponse } from "@/lib/types/admin-catalog";

interface AdminProductEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminProductEditPage({ params }: AdminProductEditPageProps) {
  // Permission check BEFORE any data fetch — see requireAdminPermission.ts.
  const session = await requireAdminPermission(PERMISSIONS.productsRead);
  const { id } = await params;

  let product;
  let categories;
  try {
    [product, categories] = await Promise.all([getAdminProductDetailServer(id), getCategoriesForAdminServer()]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    return (
      <AdminErrorState message={error instanceof ApiError ? error.message : "Couldn't load this product."} />
    );
  }

  const pricesByVariantId: Record<string, AdminPriceResponse[]> = {};
  const stocksByVariantId: Record<string, AdminStockResponse[]> = {};
  await Promise.all(
    product.variants.map(async (variant) => {
      const [prices, stocks] = await Promise.all([
        getPricesForVariantServer(id, variant.id).catch(() => []),
        getStockForVariantServer(id, variant.id).catch(() => []),
      ]);
      pricesByVariantId[variant.id] = prices;
      stocksByVariantId[variant.id] = stocks;
    })
  );

  const canUpdate = hasPermission(session, PERMISSIONS.productsUpdate);
  const canDelete = hasPermission(session, PERMISSIONS.productsDelete);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <AdminPageHeader
        title={product.name}
        description={`Slug: ${product.slug}`}
        actions={<ProductLifecycleActions productId={id} status={product.status} canUpdate={canUpdate} canDelete={canDelete} />}
      />

      <AdminFormSection title="Details">
        <ProductForm mode="edit" product={product} categories={categories} canUpdate={canUpdate} />
      </AdminFormSection>

      <AdminFormSection title="Categories" description="Assigning or removing a category takes effect immediately.">
        <ProductCategoryPicker
          productId={id}
          categories={categories}
          selectedIds={product.categories.map((c) => c.id)}
          canUpdate={canUpdate}
        />
      </AdminFormSection>

      <AdminFormSection
        title="Markets"
        description="PK and AE are managed independently — there is no currency conversion between them."
      >
        <ProductMarketPanel productId={id} markets={product.markets} canUpdate={canUpdate} />
      </AdminFormSection>

      <AdminFormSection title="Variants & Pricing" description="Stock shown here is read-only aside from the Set stock action below.">
        <ProductVariantsPanel
          productId={id}
          productSlug={product.slug}
          variants={product.variants}
          options={product.options}
          pricesByVariantId={pricesByVariantId}
          stocksByVariantId={stocksByVariantId}
          canUpdate={canUpdate}
        />
      </AdminFormSection>

      <AdminFormSection title="Media">
        <ProductMediaPanel productId={id} media={product.media} canUpdate={canUpdate} />
      </AdminFormSection>
    </div>
  );
}
