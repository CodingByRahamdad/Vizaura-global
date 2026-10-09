import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPermission } from "@/lib/auth/requireAdminPermission";
import { getAdminOrderServer } from "@/lib/api/admin/orders-server";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { ApiError } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { EditOrderForm } from "@/components/admin/orders/EditOrderForm";

interface EditAdminOrderPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditAdminOrderPage({ params }: EditAdminOrderPageProps) {
  // Permission check BEFORE any data fetch — see requireAdminPermission.ts.
  await requireAdminPermission(PERMISSIONS.ordersUpdate);
  const { id } = await params;

  let order;
  try {
    order = await getAdminOrderServer(id);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    return <AdminErrorState message={error instanceof ApiError ? error.message : "Couldn't load this order."} />;
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <Link href={`/admin/orders/${order.id}`} className="text-sm text-primary hover:underline">
          ← Back to order {order.orderNumber}
        </Link>
      </div>
      <AdminPageHeader
        title={`Edit Order ${order.orderNumber}`}
        description="Address and line-item changes are only accepted while nothing has happened to this order yet (payment captured, shipment dispatched, or a return opened)."
      />
      <EditOrderForm order={order} />
    </div>
  );
}
