import { requireAdminPermission } from "@/lib/auth/requireAdminPermission";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AddOrderForm } from "@/components/admin/orders/AddOrderForm";

export default async function NewAdminOrderPage() {
  // Permission check BEFORE any data fetch — see requireAdminPermission.ts.
  await requireAdminPermission(PERMISSIONS.ordersCreate);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <AdminPageHeader
        title="Add Order"
        description="Enter an order received outside the website — phone, WhatsApp, walk-in, or other offline/custom orders."
      />
      <AddOrderForm />
    </div>
  );
}
