import Link from "next/link";
import { requireAdminPermission } from "@/lib/auth/requireAdminPermission";
import { getAdminCustomersServer } from "@/lib/api/admin/customers-server";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { hasPermission } from "@/lib/authorization";
import { ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable, type AdminTableColumn } from "@/components/admin/AdminTable";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminSearchInput } from "@/components/admin/AdminSearchInput";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import {
  USER_STATUS_BADGE_VARIANT,
  USER_STATUS_LABELS,
  USER_STATUS_VALUES,
  type UserStatus,
} from "@/lib/types/admin-users";
import type { AdminCustomerSummary } from "@/lib/types/admin-customers";
import { formatOrderDate, formatOrderMoney } from "@/lib/utils/adminOrderFormat";

const BASE_PATH = "/admin/customers";

interface AdminCustomersPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

function pick<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

function StatusBadge({ status }: { status: UserStatus }) {
  return <Badge variant={USER_STATUS_BADGE_VARIANT[status]}>{USER_STATUS_LABELS[status]}</Badge>;
}

/** A customer's spend, one line per currency — never summed across PK/AE. */
function TotalSpent({ totalSpent }: { totalSpent: AdminCustomerSummary["totalSpent"] }) {
  if (totalSpent.length === 0) return <span className="text-text-secondary">—</span>;
  return (
    <div className="flex flex-col">
      {totalSpent.map((entry) => (
        <span key={entry.currencyCode}>{formatOrderMoney(entry.amount, entry.currencyCode)}</span>
      ))}
    </div>
  );
}

export default async function AdminCustomersPage({ searchParams }: AdminCustomersPageProps) {
  // Permission check BEFORE any data fetch — see requireAdminPermission.ts.
  const session = await requireAdminPermission(PERMISSIONS.customersRead);
  const canCreate = hasPermission(session, PERMISSIONS.customersCreate);

  const params = await searchParams;
  const parsedPage = Number(params.page);
  const page = Number.isInteger(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
  const search = params.search?.trim().slice(0, 100) || undefined;
  const status = pick(params.status, USER_STATUS_VALUES);

  let listResult: Awaited<ReturnType<typeof getAdminCustomersServer>> | null = null;
  let loadError: string | null = null;

  try {
    listResult = await getAdminCustomersServer({ page, limit: 20, search, status });
  } catch (error) {
    loadError = error instanceof ApiError ? error.message : "Couldn't load customers.";
  }

  const columns: AdminTableColumn<AdminCustomerSummary>[] = [
    {
      key: "name",
      header: "Customer",
      render: (row) => (
        <Link href={`${BASE_PATH}/${row.id}`} className="font-medium text-primary hover:underline">
          {row.firstName} {row.lastName}
        </Link>
      ),
    },
    { key: "email", header: "Email", render: (row) => <span className="break-all">{row.email}</span> },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "orders", header: "Orders", render: (row) => row.orderCount.toLocaleString("en-US") },
    { key: "spent", header: "Total Spent", render: (row) => <TotalSpent totalSpent={row.totalSpent} /> },
    { key: "created", header: "Joined", render: (row) => formatOrderDate(row.createdAt) },
  ];

  const hasFilters = !!(search || status);

  return (
    <div>
      <AdminPageHeader
        title="Customers"
        description="Every customer account — super_admin accounts are managed separately (see Settings)."
        actions={canCreate ? <Button href={`${BASE_PATH}/new`}>Add Customer</Button> : undefined}
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <AdminSearchInput basePath={BASE_PATH} placeholder="Name or email..." debounceMs={500} />
        </div>
        <AdminFilters
          basePath={BASE_PATH}
          filters={[
            {
              param: "status",
              label: "Status",
              allValue: "",
              options: [
                { label: "All statuses", value: "" },
                ...USER_STATUS_VALUES.map((v) => ({ label: USER_STATUS_LABELS[v], value: v })),
              ],
            },
          ]}
        />
      </div>

      {loadError ? (
        <AdminErrorState message={loadError} />
      ) : !listResult || listResult.items.length === 0 ? (
        <AdminEmptyState
          title="No customers found"
          description={hasFilters ? "Try adjusting your search or filters." : "Customers will appear here once they register."}
        />
      ) : (
        <>
          {/* Desktop: table. Mobile: stacked cards (avoids a wide horizontal scroll). */}
          <div className="hidden md:block">
            <AdminTable columns={columns} rows={listResult.items} getRowKey={(row) => row.id} />
          </div>
          <ul className="flex flex-col gap-3 md:hidden">
            {listResult.items.map((customer) => (
              <li key={customer.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`${BASE_PATH}/${customer.id}`} className="font-semibold text-primary hover:underline">
                    {customer.firstName} {customer.lastName}
                  </Link>
                  <StatusBadge status={customer.status} />
                </div>
                <p className="mt-1 break-all text-xs text-text-secondary">{customer.email}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
                  <span>{customer.orderCount} orders</span>
                  <TotalSpent totalSpent={customer.totalSpent} />
                </div>
                <p className="mt-1 text-xs text-text-secondary">Joined {formatOrderDate(customer.createdAt)}</p>
              </li>
            ))}
          </ul>
          <AdminPagination pagination={listResult.pagination} basePath={BASE_PATH} />
        </>
      )}
    </div>
  );
}
