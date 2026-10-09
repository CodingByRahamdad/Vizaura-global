import { requireAdminPermission } from "@/lib/auth/requireAdminPermission";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CustomerForm } from "@/components/admin/customers/CustomerForm";

export default async function NewAdminCustomerPage() {
  await requireAdminPermission(PERMISSIONS.customersCreate);

  return (
    <div>
      <AdminPageHeader title="Add Customer" description="Creates a regular customer account." />
      <CustomerForm mode="create" />
    </div>
  );
}
