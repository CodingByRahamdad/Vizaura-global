import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPermission } from "@/lib/auth/requireAdminPermission";
import { getAdminOrderServer } from "@/lib/api/admin/orders-server";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { hasPermission } from "@/lib/authorization";
import { ApiError } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminFormSection } from "@/components/admin/AdminFormSection";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { AdminTable, type AdminTableColumn } from "@/components/admin/AdminTable";
import {
  OrderPaymentBadge,
  OrderShipmentBadge,
  OrderSourceBadge,
  OrderStatusBadge,
} from "@/components/admin/orders/OrderBadges";
import { OrderStatusActions } from "@/components/admin/orders/OrderStatusActions";
import { PaymentActions } from "@/components/admin/orders/PaymentActions";
import { ShipmentActions } from "@/components/admin/orders/ShipmentActions";
import { ReturnActions } from "@/components/admin/orders/ReturnActions";
import { OrderAdminActions } from "@/components/admin/orders/OrderAdminActions";
import { ORDER_STATUS_LABELS } from "@/lib/types/orders";
import { RETURN_STATUS_LABELS } from "@/lib/types/admin-orders";
import type { OrderItemView } from "@/lib/types/checkout";
import { formatOrderDateTime, formatOrderMoney } from "@/lib/utils/adminOrderFormat";

interface AdminOrderDetailPageProps {
  params: Promise<{ id: string }>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-text-secondary">{label}</dt>
      <dd className="mt-0.5 text-sm text-text">{children}</dd>
    </div>
  );
}

export default async function AdminOrderDetailPage({ params }: AdminOrderDetailPageProps) {
  // Permission check BEFORE any data fetch — see requireAdminPermission.ts.
  const session = await requireAdminPermission(PERMISSIONS.ordersRead);
  const { id } = await params;

  let order;
  try {
    order = await getAdminOrderServer(id);
  } catch (error) {
    // 400 = malformed id (not a UUID): treat like any other unknown order.
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    return <AdminErrorState message={error instanceof ApiError ? error.message : "Couldn't load this order."} />;
  }

  const canUpdate = hasPermission(session, PERMISSIONS.ordersUpdate);
  const canCancel = hasPermission(session, PERMISSIONS.ordersCancel);
  const canManagePayments = hasPermission(session, PERMISSIONS.paymentsUpdate);
  const canRefundPayments = hasPermission(session, PERMISSIONS.paymentsRefund);
  const canManageShipments = hasPermission(session, PERMISSIONS.shippingUpdate);
  const canManageReturns = hasPermission(session, PERMISSIONS.returnsUpdate);
  const canEditOrder = hasPermission(session, PERMISSIONS.ordersUpdate);
  const canDeleteOrder = hasPermission(session, PERMISSIONS.ordersDelete);
  // Mirrors the backend's assertOrderIsMutable gate — see OrderAdminActions.
  const isOrderMutable =
    order.payments.every((payment) => payment.status === "PENDING") &&
    (order.shipment === null || order.shipment.status === "PENDING") &&
    order.returns.length === 0;
  // Everything below is the order's own stored snapshot, in its own currency.
  const money = (amount: number) => formatOrderMoney(amount, order.currencyCode);

  const itemColumns: AdminTableColumn<OrderItemView>[] = [
    {
      key: "item",
      header: "Item",
      render: (item) => (
        <div>
          <p className="font-medium text-text">{item.productName}</p>
          <p className="text-xs text-text-secondary">
            {item.variantName ? `${item.variantName} · ` : ""}
            {item.sku}
          </p>
        </div>
      ),
    },
    { key: "qty", header: "Qty", render: (item) => item.quantity },
    { key: "unit", header: "Unit price", render: (item) => formatOrderMoney(item.unitAmount, item.currencyCode) },
    {
      key: "line",
      header: "Line total",
      render: (item) => <span className="font-medium">{formatOrderMoney(item.lineTotal, item.currencyCode)}</span>,
    },
  ];

  const address = order.shippingAddress;
  const billingAddress = order.billingAddress;

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <Link href="/admin/orders" className="text-sm text-primary hover:underline">
          ← All orders
        </Link>
      </div>

      <AdminPageHeader
        title={`Order ${order.orderNumber}`}
        description={`Placed ${formatOrderDateTime(order.placedAt)} · ${order.marketCode} market · ${order.currencyCode}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <OrderSourceBadge source={order.source} />
            <OrderStatusBadge status={order.status} />
            <OrderPaymentBadge status={order.paymentStatus} />
            <OrderShipmentBadge status={order.shipmentStatus} />
          </div>
        }
      />

      <AdminFormSection title="Status" description="Allowed changes are enforced by the server. Every change is recorded in the history below.">
        <OrderStatusActions orderId={order.id} currentStatus={order.status} canUpdate={canUpdate} canCancel={canCancel} />
      </AdminFormSection>

      <AdminFormSection
        title="Order actions"
        description="Editing or deleting is only possible before anything has actually happened to the order (payment captured, shipment dispatched, or a return opened)."
      >
        <OrderAdminActions orderId={order.id} canUpdate={canEditOrder} canDelete={canDeleteOrder} isMutable={isOrderMutable} />
      </AdminFormSection>

      <AdminFormSection title="Customer">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            {order.customer.name}
            {order.customer.isGuest ? (
              <span className="ml-2 rounded-full bg-primary-light/40 px-2 py-0.5 text-xs font-medium text-primary">
                Guest
              </span>
            ) : null}
          </Field>
          <Field label="Email">{order.customer.email}</Field>
          {order.customer.id ? (
            <Field label="Customer ID">
              <span className="break-all font-mono text-xs">{order.customer.id}</span>
            </Field>
          ) : null}
        </dl>
        <p className="mt-3 text-xs text-text-secondary">
          {order.customer.isGuest
            ? "This order has no linked customer account — details are from the order's own shipping address."
            : "Shows the customer's current account details."}
        </p>
      </AdminFormSection>

      <AdminFormSection title="Items" description="Prices are the amounts charged when the order was placed.">
        <AdminTable columns={itemColumns} rows={order.items} getRowKey={(item) => item.id} />
        <dl className="mt-4 ml-auto grid max-w-xs grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <dt className="text-text-secondary">Subtotal</dt>
          <dd className="text-right">{money(order.subtotalAmount)}</dd>
          <dt className="text-text-secondary">Shipping</dt>
          <dd className="text-right">{money(order.shippingAmount)}</dd>
          <dt className="text-text-secondary">Discount</dt>
          <dd className="text-right">{money(order.discountAmount)}</dd>
          <dt className="text-text-secondary">Tax</dt>
          <dd className="text-right">{money(order.taxAmount)}</dd>
          <dt className="border-t border-border pt-1 font-semibold text-text">Total</dt>
          <dd className="border-t border-border pt-1 text-right font-semibold text-text">{money(order.totalAmount)}</dd>
        </dl>
      </AdminFormSection>

      <AdminFormSection title="Shipping">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Billing address">
            {billingAddress ? (
              <address className="not-italic">
                {billingAddress.fullName}
                <br />
                {billingAddress.line1}
                {billingAddress.line2 ? <>, {billingAddress.line2}</> : null}
                <br />
                {billingAddress.city}
                {billingAddress.region ? `, ${billingAddress.region}` : ""} {billingAddress.postalCode ?? ""}
                <br />
                {billingAddress.countryCode} · {billingAddress.phone}
              </address>
            ) : (
              "No address recorded"
            )}
          </Field>
          <Field label="Delivery address">
            {address ? (
              <address className="not-italic">
                {address.fullName}
                <br />
                {address.line1}
                {address.line2 ? <>, {address.line2}</> : null}
                <br />
                {address.city}
                {address.region ? `, ${address.region}` : ""} {address.postalCode ?? ""}
                <br />
                {address.countryCode} · {address.phone}
              </address>
            ) : (
              "No address recorded"
            )}
          </Field>
          <Field label="Shipment">
            {order.shipment ? (
              <div className="flex flex-col gap-1">
                <OrderShipmentBadge status={order.shipment.status} />
                <span>{order.shipment.shippingMethodName}</span>
                <span className="text-text-secondary">
                  {order.shipment.carrier ?? "No carrier yet"}
                  {order.shipment.trackingNumber ? ` · ${order.shipment.trackingNumber}` : ""}
                </span>
                <span className="text-xs text-text-secondary">
                  Shipped {formatOrderDateTime(order.shipment.shippedAt)} · Delivered{" "}
                  {formatOrderDateTime(order.shipment.deliveredAt)}
                </span>
                <ShipmentActions shipment={order.shipment} canUpdate={canManageShipments} orderStatus={order.status} />
              </div>
            ) : (
              "No shipment record"
            )}
          </Field>
        </dl>
      </AdminFormSection>

      <AdminFormSection title="Payment">
        {order.payments.length === 0 ? (
          <p className="text-sm text-text-secondary">No payment records.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {order.payments.map((payment) => (
              <li key={payment.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-text">
                    {payment.method} · {formatOrderMoney(payment.amount, payment.currencyCode)}
                  </span>
                  <OrderPaymentBadge status={payment.status} />
                </div>
                <p className="mt-1 text-xs text-text-secondary">
                  Provider {payment.provider}
                  {payment.providerPaymentId ? ` · Ref ${payment.providerPaymentId}` : ""} · Created{" "}
                  {formatOrderDateTime(payment.createdAt)} · Paid {formatOrderDateTime(payment.paidAt)}
                </p>
                <PaymentActions payment={payment} canUpdate={canManagePayments} canRefund={canRefundPayments} />
              </li>
            ))}
          </ul>
        )}
      </AdminFormSection>

      {order.returns.length > 0 ? (
        <AdminFormSection title="Returns" description="Approved returns restock inventory on receipt and refund via the order's payment.">
          <ul className="flex flex-col gap-3">
            {order.returns.map((ret) => (
              <li key={ret.id} className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium text-text">{RETURN_STATUS_LABELS[ret.status] ?? ret.status}</p>
                <p className="text-text-secondary">
                  {ret.reason ?? "No reason given"}
                  {ret.rejectionReason ? ` · Rejected: ${ret.rejectionReason}` : ""}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  Requested {formatOrderDateTime(ret.createdAt)}
                  {ret.refundAmount !== null ? ` · Refund ${money(ret.refundAmount)}` : ""}
                </p>
                <ReturnActions returnRecord={ret} canUpdate={canManageReturns} />
              </li>
            ))}
          </ul>
        </AdminFormSection>
      ) : null}

      <AdminFormSection title="Status history">
        {order.statusHistory.length === 0 ? (
          <p className="text-sm text-text-secondary">No status changes yet — the order is still in its initial state.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {order.statusHistory.map((entry, index) => (
              <li key={`${entry.createdAt}-${index}`} className="text-sm">
                <p className="text-text">
                  {entry.previousStatus ? ORDER_STATUS_LABELS[entry.previousStatus] : "—"} →{" "}
                  <span className="font-medium">{ORDER_STATUS_LABELS[entry.newStatus]}</span>
                </p>
                <p className="text-xs text-text-secondary">
                  {formatOrderDateTime(entry.createdAt)}
                  {entry.changedByUserId ? ` · by ${entry.changedByUserId}` : ""}
                  {entry.reason ? ` · ${entry.reason}` : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </AdminFormSection>
    </div>
  );
}
