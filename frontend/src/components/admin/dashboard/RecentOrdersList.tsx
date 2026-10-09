import Link from "next/link";
import { AdminTable, type AdminTableColumn } from "@/components/admin/AdminTable";
import { OrderStatusBadge } from "@/components/admin/orders/OrderBadges";
import { formatOrderDate, formatOrderMoney } from "@/lib/utils/adminOrderFormat";
import type { AdminOrderSummary } from "@/lib/types/admin-orders";

interface RecentOrdersListProps {
  orders: AdminOrderSummary[];
}

export function RecentOrdersList({ orders }: RecentOrdersListProps) {
  if (orders.length === 0) {
    return <p className="text-sm text-text-secondary">No orders yet.</p>;
  }

  const columns: AdminTableColumn<AdminOrderSummary>[] = [
    {
      key: "order",
      header: "Order",
      render: (row) => (
        <Link href={`/admin/orders/${row.id}`} className="font-medium text-primary hover:underline">
          {row.orderNumber}
        </Link>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      className: "px-4 py-3 align-middle text-text max-w-[140px] truncate",
      render: (row) => row.customer.name,
    },
    {
      key: "total",
      header: "Total",
      render: (row) => <span className="font-medium">{formatOrderMoney(row.totalAmount, row.currencyCode)}</span>,
    },
    { key: "status", header: "Status", render: (row) => <OrderStatusBadge status={row.status} /> },
    { key: "date", header: "Date", render: (row) => formatOrderDate(row.placedAt) },
  ];

  return <AdminTable columns={columns} rows={orders} getRowKey={(row) => row.id} />;
}
