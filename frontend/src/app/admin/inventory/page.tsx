import { requireAdminPermission } from "@/lib/auth/requireAdminPermission";
import { getAdminInventoryServer } from "@/lib/api/admin/inventory-server";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { MARKET_CODES, MARKETS } from "@/lib/constants/market";
import { hasPermission } from "@/lib/authorization";
import { ApiError } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable, type AdminTableColumn } from "@/components/admin/AdminTable";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminSearchInput } from "@/components/admin/AdminSearchInput";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { InventoryAdjustButton } from "@/components/admin/inventory/InventoryAdjustButton";
import type { AdminInventoryListResponse } from "@/lib/types/admin-catalog";

const BASE_PATH = "/admin/inventory";

interface AdminInventoryPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function AdminInventoryPage({ searchParams }: AdminInventoryPageProps) {
  // Permission check BEFORE any data fetch — see requireAdminPermission.ts.
  const session = await requireAdminPermission(PERMISSIONS.inventoryRead);
  const canAdjust = hasPermission(session, PERMISSIONS.inventoryUpdate);

  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;
  const search = params.search;
  const market = params.market || undefined;

  let listResult: Awaited<ReturnType<typeof getAdminInventoryServer>> | null = null;
  let loadError: string | null = null;

  try {
    listResult = await getAdminInventoryServer({ page, limit: 20, search, market });
  } catch (error) {
    loadError = error instanceof ApiError ? error.message : "Couldn't load inventory.";
  }

  const columns: AdminTableColumn<AdminInventoryListResponse>[] = [
    {
      key: "product",
      header: "Product",
      render: (row) => (
        <div>
          <p className="font-medium text-text">{row.productName}</p>
          <p className="text-xs text-text-secondary">{row.variantTitle} · {row.sku}</p>
        </div>
      ),
    },
    { key: "market", header: "Market", render: (row) => <span className="font-semibold">{row.marketCode}</span> },
    { key: "onHand", header: "On Hand", render: (row) => row.onHand },
    { key: "reserved", header: "Reserved", render: (row) => row.reserved },
    {
      key: "available",
      header: "Available",
      render: (row) => <span className={row.available <= 0 ? "font-semibold text-error" : undefined}>{row.available}</span>,
    },
    ...(canAdjust
      ? [
          {
            key: "actions",
            header: "",
            render: (row: AdminInventoryListResponse) => (
              <InventoryAdjustButton
                productId={row.productId}
                variantId={row.variantId}
                marketCode={row.marketCode}
                productName={row.productName}
                onHand={row.onHand}
              />
            ),
          } satisfies AdminTableColumn<AdminInventoryListResponse>,
        ]
      : []),
  ];

  return (
    <div>
      <AdminPageHeader
        title="Inventory"
        description="Stock levels across both PK and AE markets. Stock is managed here; product/category/pricing data is managed in Products."
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <AdminSearchInput basePath={BASE_PATH} placeholder="Search product or SKU..." />
        <AdminFilters
          basePath={BASE_PATH}
          filters={[
            {
              param: "market",
              label: "Market",
              allValue: "",
              options: [
                { label: "All markets", value: "" },
                ...MARKET_CODES.map((code) => ({ label: MARKETS[code].label, value: code })),
              ],
            },
          ]}
        />
      </div>

      {loadError ? (
        <AdminErrorState message={loadError} />
      ) : !listResult || listResult.items.length === 0 ? (
        <AdminEmptyState
          title="No stock records found"
          description="Try adjusting your search or market filter."
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
