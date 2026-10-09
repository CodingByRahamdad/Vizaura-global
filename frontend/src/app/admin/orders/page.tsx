import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAdminPermission } from "@/lib/auth/requireAdminPermission";
import { getAdminOrdersServer } from "@/lib/api/admin/orders-server";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { MARKET_CODES, MARKETS } from "@/lib/constants/market";
import { ApiError } from "@/lib/api";
import { hasPermission } from "@/lib/authorization";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable, type AdminTableColumn } from "@/components/admin/AdminTable";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminSearchInput } from "@/components/admin/AdminSearchInput";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { AdminDateRangeFilter } from "@/components/admin/AdminDateRangeFilter";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { Button } from "@/components/ui/Button";
import { OrderSourceBadge } from "@/components/admin/orders/OrderBadges";
import { OrderInlineStatusSelect } from "@/components/admin/orders/OrderInlineStatusSelect";
import { ShipmentInlineStatusSelect } from "@/components/admin/orders/ShipmentInlineStatusSelect";
import { PaymentInlineStatusSelect } from "@/components/admin/orders/PaymentInlineStatusSelect";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/types/orders";
import {
  ORDER_STATUS_VALUES,
  PAYMENT_STATUS_VALUES,
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_VALUES,
  type AdminOrderSummary,
} from "@/lib/types/admin-orders";
import { formatOrderDate, formatOrderMoney } from "@/lib/utils/adminOrderFormat";

const BASE_PATH = "/admin/orders";
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

interface AdminOrdersPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

/** Drops any value outside the allowed set, so a hand-edited URL can't reach the API as garbage. */
function pick<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

function pickDate(value: string | undefined): string | undefined {
  return value && DATE_ONLY.test(value) && !Number.isNaN(Date.parse(value)) ? value : undefined;
}

export default async function AdminOrdersPage({ searchParams }: AdminOrdersPageProps) {
  // Permission check BEFORE any data fetch — see requireAdminPermission.ts.
  const session = await requireAdminPermission(PERMISSIONS.ordersRead);
  const canCreate = hasPermission(session, PERMISSIONS.ordersCreate);
  const canUpdate = hasPermission(session, PERMISSIONS.ordersUpdate);
  const canCancel = hasPermission(session, PERMISSIONS.ordersCancel);
  const canManagePayments = hasPermission(session, PERMISSIONS.paymentsUpdate);
  const canRefundPayments = hasPermission(session, PERMISSIONS.paymentsRefund);
  const canManageShipments = hasPermission(session, PERMISSIONS.shippingUpdate);

  const params = await searchParams;
  const parsedPage = Number(params.page);
  const page = Number.isInteger(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
  const search = params.search?.trim().slice(0, 100) || undefined;
  const status = pick(params.status, ORDER_STATUS_VALUES);
  const paymentStatus = pick(params.paymentStatus, PAYMENT_STATUS_VALUES);
  const shipmentStatus = pick(params.shipmentStatus, SHIPMENT_STATUS_VALUES);
  const market = pick(params.market, MARKET_CODES);
  const dateFrom = pickDate(params.dateFrom);
  const dateTo = pickDate(params.dateTo);

  let listResult: Awaited<ReturnType<typeof getAdminOrdersServer>> | null = null;
  let loadError: string | null = null;

  try {
    listResult = await getAdminOrdersServer({
      page,
      limit: 20,
      search,
      status,
      paymentStatus,
      shipmentStatus,
      market,
      dateFrom,
      dateTo,
    });
  } catch (error) {
    loadError = error instanceof ApiError ? error.message : "Couldn't load orders.";
  }

  const columns: AdminTableColumn<AdminOrderSummary>[] = [
    {
      key: "order",
      header: "Order",
      render: (row) => (
        <Link href={`${BASE_PATH}/${row.id}`} className="font-medium text-primary hover:underline">
          {row.orderNumber}
        </Link>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (row) => (
        <div>
          <p className="font-medium text-text">{row.customer.name}</p>
          <p className="text-xs text-text-secondary">{row.customer.email}</p>
        </div>
      ),
    },
    { key: "market", header: "Market", render: (row) => <span className="font-semibold">{row.marketCode}</span> },
    { key: "source", header: "Source", render: (row) => <OrderSourceBadge source={row.source} /> },
    { key: "placed", header: "Placed", render: (row) => formatOrderDate(row.placedAt) },
    {
      key: "total",
      header: "Total",
      render: (row) => <span className="font-medium">{formatOrderMoney(row.totalAmount, row.currencyCode)}</span>,
    },
    {
      key: "payment",
      header: "Payment",
      render: (row) => (
        <PaymentInlineStatusSelect
          paymentId={row.paymentId}
          provider={row.paymentProvider}
          status={row.paymentStatus}
          canUpdate={canManagePayments}
          canRefund={canRefundPayments}
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <OrderInlineStatusSelect orderId={row.id} status={row.status} canUpdate={canUpdate} canCancel={canCancel} />
      ),
    },
    {
      key: "shipment",
      header: "Shipment",
      render: (row) => (
        <ShipmentInlineStatusSelect
          shipmentId={row.shipmentId}
          status={row.shipmentStatus}
          orderStatus={row.status}
          canUpdate={canManageShipments}
        />
      ),
    },
  ];

  const hasFilters = !!(search || status || paymentStatus || shipmentStatus || market || dateFrom || dateTo);

  return (
    <div>
      <AdminPageHeader
        title="Orders"
        description="Orders from both markets. Each order is shown in the market and currency it was placed in."
        actions={
          canCreate ? (
            <Button href={`${BASE_PATH}/new`}>
              <Plus className="h-4 w-4" aria-hidden />
              Add Order
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <AdminSearchInput basePath={BASE_PATH} placeholder="Customer name, order # or email..." debounceMs={500} />
          <AdminDateRangeFilter basePath={BASE_PATH} />
        </div>
        <AdminFilters
          basePath={BASE_PATH}
          filters={[
            {
              param: "status",
              label: "Order status",
              allValue: "",
              options: [
                { label: "All order statuses", value: "" },
                ...ORDER_STATUS_VALUES.map((v) => ({ label: ORDER_STATUS_LABELS[v], value: v })),
              ],
            },
            {
              param: "paymentStatus",
              label: "Payment status",
              allValue: "",
              options: [
                { label: "All payment statuses", value: "" },
                ...PAYMENT_STATUS_VALUES.map((v) => ({ label: PAYMENT_STATUS_LABELS[v], value: v })),
              ],
            },
            {
              param: "shipmentStatus",
              label: "Shipment status",
              allValue: "",
              options: [
                { label: "All shipment statuses", value: "" },
                ...SHIPMENT_STATUS_VALUES.map((v) => ({ label: SHIPMENT_STATUS_LABELS[v], value: v })),
              ],
            },
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
          title="No orders found"
          description={hasFilters ? "Try adjusting your search or filters." : "Orders will appear here once customers check out."}
        />
      ) : (
        <>
          {/* Desktop: table. Mobile: stacked cards (avoids a wide horizontal scroll). */}
          <div className="hidden md:block">
            <AdminTable columns={columns} rows={listResult.items} getRowKey={(row) => row.id} />
          </div>
          <ul className="flex flex-col gap-3 md:hidden">
            {listResult.items.map((order) => (
              <li key={order.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`${BASE_PATH}/${order.id}`} className="font-semibold text-primary hover:underline">
                    {order.orderNumber}
                  </Link>
                  <span className="text-sm font-medium text-text">
                    {formatOrderMoney(order.totalAmount, order.currencyCode)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-text">{order.customer.name}</p>
                <p className="text-xs text-text-secondary">
                  {order.customer.email} · {order.marketCode} · {formatOrderDate(order.placedAt)}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <OrderSourceBadge source={order.source} />
                  <OrderInlineStatusSelect orderId={order.id} status={order.status} canUpdate={canUpdate} canCancel={canCancel} />
                  <PaymentInlineStatusSelect
                    paymentId={order.paymentId}
                    provider={order.paymentProvider}
                    status={order.paymentStatus}
                    canUpdate={canManagePayments}
                    canRefund={canRefundPayments}
                  />
                  <ShipmentInlineStatusSelect
                    shipmentId={order.shipmentId}
                    status={order.shipmentStatus}
                    orderStatus={order.status}
                    canUpdate={canManageShipments}
                  />
                </div>
              </li>
            ))}
          </ul>
          <AdminPagination pagination={listResult.pagination} basePath={BASE_PATH} />
        </>
      )}
    </div>
  );
}
