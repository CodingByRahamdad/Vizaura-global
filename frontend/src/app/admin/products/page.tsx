import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAdminPermission } from "@/lib/auth/requireAdminPermission";
import { getAdminProductsServer } from "@/lib/api/admin/products-server";
import { getCategoriesForAdminServer } from "@/lib/api/admin/categories";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { formatPrice } from "@/lib/api/catalog";
import { ApiError } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable, type AdminTableColumn } from "@/components/admin/AdminTable";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminSearchInput } from "@/components/admin/AdminSearchInput";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { AdminPermissionGate } from "@/components/admin/AdminPermissionGate";
import { Button } from "@/components/ui/Button";
import { SafeImage } from "@/components/ui/SafeImage";
import { ProductStatusBadge } from "@/components/admin/products/ProductStatusBadge";
import { ProductRowActions } from "@/components/admin/products/ProductRowActions";
import { hasAnyPermission } from "@/lib/authorization";
import type { ProductAdminListResponse } from "@/lib/types/admin-catalog";

const BASE_PATH = "/admin/products";

interface AdminProductsPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function AdminProductsPage({ searchParams }: AdminProductsPageProps) {
  // Permission check BEFORE any data fetch — see requireAdminPermission.ts.
  const session = await requireAdminPermission(PERMISSIONS.productsRead);

  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;
  const search = params.search;
  const category = params.category || undefined;
  // Defaults to ACTIVE (not "all") so archived products don't clutter the
  // default view — "All statuses" is an explicit filter choice.
  const statusParam = params.status ?? "ACTIVE";
  const status = statusParam === "ALL" ? undefined : (statusParam as "DRAFT" | "ACTIVE" | "ARCHIVED");

  let listResult: Awaited<ReturnType<typeof getAdminProductsServer>> | null = null;
  let categories: Awaited<ReturnType<typeof getCategoriesForAdminServer>> = [];
  let loadError: string | null = null;

  try {
    [listResult, categories] = await Promise.all([
      getAdminProductsServer({ page, limit: 20, search, category, status }),
      getCategoriesForAdminServer(),
    ]);
  } catch (error) {
    loadError = error instanceof ApiError ? error.message : "Couldn't load products.";
  }

  const canUpdateProducts = hasAnyPermission(session, [PERMISSIONS.productsUpdate]);
  const canDeleteProducts = hasAnyPermission(session, [PERMISSIONS.productsDelete]);

  const columns: AdminTableColumn<ProductAdminListResponse>[] = [
    {
      key: "product",
      header: "Product",
      render: (row) => (
        <Link href={`${BASE_PATH}/${row.id}`} className="flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border">
            <SafeImage src={row.imageUrl} alt={row.name} />
          </div>
          <div>
            <p className="font-medium text-text">{row.name}</p>
            <p className="text-xs text-text-secondary">{row.slug}</p>
          </div>
        </Link>
      ),
    },
    { key: "status", header: "Status", render: (row) => <ProductStatusBadge status={row.status} /> },
    {
      key: "categories",
      header: "Categories",
      render: (row) => (row.categories.length > 0 ? row.categories.map((c) => c.name).join(", ") : "—"),
    },
    { key: "variants", header: "Variants", render: (row) => row.variantCount },
    {
      key: "markets",
      header: "Markets & Pricing",
      render: (row) => (
        <div className="flex flex-col gap-1">
          {row.markets.map((market) => (
            <div key={market.code} className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-text">{market.code}</span>
              <span className={market.isVisible ? "text-success" : "text-text-secondary"}>
                {market.isVisible ? "Visible" : "Hidden"}
              </span>
              <span className="text-text-secondary">
                {market.price ? formatPrice(market.price.amount, market.price.currencyCode) : "No price"}
              </span>
              <span className="text-text-secondary">
                {market.stock ? `${market.stock.available} in stock` : "No stock record"}
              </span>
            </div>
          ))}
          {row.markets.length === 0 ? <span className="text-xs text-text-secondary">Not assigned to a market</span> : null}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "px-4 py-3 text-right align-middle",
      render: (row) => (
        <ProductRowActions
          productId={row.id}
          productName={row.name}
          isActive={row.isActive}
          canUpdate={canUpdateProducts}
          canDelete={canDeleteProducts}
        />
      ),
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Products"
        description="Manage the catalog across both PK and AE markets."
        actions={
          <AdminPermissionGate permissions={session.permissions} require={PERMISSIONS.productsCreate}>
            <Button href={`${BASE_PATH}/new`}>
              <Plus className="h-4 w-4" aria-hidden />
              New Product
            </Button>
          </AdminPermissionGate>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <AdminSearchInput basePath={BASE_PATH} placeholder="Search products..." />
        <AdminFilters
          basePath={BASE_PATH}
          filters={[
            {
              param: "status",
              label: "Status",
              allValue: "ACTIVE",
              options: [
                { label: "Active", value: "ACTIVE" },
                { label: "Draft", value: "DRAFT" },
                { label: "Archived", value: "ARCHIVED" },
                { label: "All statuses", value: "ALL" },
              ],
            },
            {
              param: "category",
              label: "Category",
              allValue: "",
              options: [{ label: "All categories", value: "" }, ...categories.map((c) => ({ label: c.name, value: c.id }))],
            },
          ]}
        />
      </div>

      {loadError ? (
        <AdminErrorState message={loadError} />
      ) : !listResult || listResult.items.length === 0 ? (
        <AdminEmptyState
          title="No products found"
          description="Try adjusting your search or filters, or create a new product."
        />
      ) : (
        <>
          <AdminTable columns={columns} rows={listResult.items} getRowKey={(row) => row.id} />
          <AdminPagination pagination={listResult.pagination} basePath={BASE_PATH} />
        </>
      )}
    </div>
  );
}
