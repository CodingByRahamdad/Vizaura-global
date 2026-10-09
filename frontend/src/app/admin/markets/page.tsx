import { requireAdminPermission } from "@/lib/auth/requireAdminPermission";
import { getAdminMarketsServer } from "@/lib/api/markets-server";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { hasPermission } from "@/lib/authorization";
import { ApiError } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable, type AdminTableColumn } from "@/components/admin/AdminTable";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { Badge } from "@/components/ui/Badge";
import { MarketStatusAction } from "@/components/admin/markets/MarketStatusAction";
import type { AdminMarket } from "@/lib/types/markets";

// Purely cosmetic (Phase 6M) — a flag per market code makes PK/AE
// distinguishable at a glance, matching the reference dashboard's own
// flag+currency chip style. Falls back to no flag for any future market
// code this map doesn't yet know about — never blocks rendering.
const MARKET_FLAG: Record<string, string> = { PK: "🇵🇰", AE: "🇦🇪" };

export default async function AdminMarketsPage() {
  // Permission check BEFORE any data fetch — see requireAdminPermission.ts.
  const session = await requireAdminPermission(PERMISSIONS.marketsRead);
  const canManage = hasPermission(session, PERMISSIONS.marketsUpdate);

  let markets: AdminMarket[] | null = null;
  let loadError: string | null = null;
  try {
    markets = await getAdminMarketsServer();
  } catch (error) {
    loadError = error instanceof ApiError ? error.message : "Couldn't load markets.";
  }

  const columns: AdminTableColumn<AdminMarket>[] = [
    {
      key: "name",
      header: "Market",
      render: (row) => (
        <span className="font-medium">
          <span aria-hidden className="mr-2">
            {MARKET_FLAG[row.code] ?? ""}
          </span>
          {row.name}
        </span>
      ),
    },
    { key: "code", header: "Code", render: (row) => <span className="font-mono text-xs">{row.code}</span> },
    { key: "currency", header: "Currency", render: (row) => row.currencyCode },
    {
      key: "status",
      header: "Status",
      render: (row) => <Badge variant={row.isActive ? "success" : "neutral"}>{row.isActive ? "Active" : "Inactive"}</Badge>,
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex justify-end">
          <MarketStatusAction marketId={row.id} marketName={row.name} isActive={row.isActive} canManage={canManage} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Markets"
        description="Pakistan and UAE are independently priced, stocked, and configured — deactivating a market removes it from the storefront switcher without touching its existing orders, prices, or stock."
      />

      {loadError ? (
        <AdminErrorState message={loadError} />
      ) : !markets ? null : (
        <AdminTable columns={columns} rows={markets} getRowKey={(row) => row.id} />
      )}
    </div>
  );
}
