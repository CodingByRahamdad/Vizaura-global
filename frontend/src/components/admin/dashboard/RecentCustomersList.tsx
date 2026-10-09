import { AdminTable, type AdminTableColumn } from "@/components/admin/AdminTable";
import { formatOrderDate } from "@/lib/utils/adminOrderFormat";
import type { DashboardRecentCustomer } from "@/lib/types/admin-dashboard";

interface RecentCustomersListProps {
  customers: DashboardRecentCustomer[];
}

export function RecentCustomersList({ customers }: RecentCustomersListProps) {
  if (customers.length === 0) {
    return <p className="text-sm text-text-secondary">No customers yet.</p>;
  }

  const columns: AdminTableColumn<DashboardRecentCustomer>[] = [
    {
      key: "customer",
      header: "Customer",
      className: "px-4 py-3 align-middle text-text max-w-[200px]",
      render: (customer) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-text">{customer.name || customer.email}</p>
          <p className="truncate text-xs text-text-secondary">{customer.email}</p>
        </div>
      ),
    },
    { key: "orders", header: "Orders", render: (customer) => customer.orderCount },
    { key: "joined", header: "Joined", render: (customer) => formatOrderDate(customer.createdAt) },
  ];

  return <AdminTable columns={columns} rows={customers} getRowKey={(customer) => customer.id} />;
}
