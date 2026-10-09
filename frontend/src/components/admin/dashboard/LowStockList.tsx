import { AdminTable, type AdminTableColumn } from "@/components/admin/AdminTable";
import { Badge } from "@/components/ui/Badge";
import type { DashboardLowStockItem } from "@/lib/types/admin-dashboard";

interface LowStockListProps {
  items: DashboardLowStockItem[];
}

export function LowStockList({ items }: LowStockListProps) {
  if (items.length === 0) {
    return <p className="text-sm text-text-secondary">No low-stock items right now.</p>;
  }

  const columns: AdminTableColumn<DashboardLowStockItem>[] = [
    {
      key: "product",
      header: "Product",
      className: "px-4 py-3 align-middle text-text max-w-[180px]",
      render: (item) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-text">{item.productName}</p>
          <p className="truncate text-xs text-text-secondary">
            {item.sku} · {item.marketCode}
          </p>
        </div>
      ),
    },
    { key: "stock", header: "Stock", render: (item) => item.onHand },
    { key: "status", header: "Status", render: () => <Badge variant="warning">Low</Badge> },
  ];

  return <AdminTable columns={columns} rows={items} getRowKey={(item) => `${item.variantId}-${item.marketCode}`} />;
}
