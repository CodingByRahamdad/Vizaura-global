import { notFound } from "next/navigation";
import { requireAdminPermission } from "@/lib/auth/requireAdminPermission";
import { getAdminCustomerServer } from "@/lib/api/admin/customers-server";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { ApiError } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { CustomerForm } from "@/components/admin/customers/CustomerForm";

interface EditAdminCustomerPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditAdminCustomerPage({ params }: EditAdminCustomerPageProps) {
  await requireAdminPermission(PERMISSIONS.customersUpdate);
  const { id } = await params;

  let customer;
  try {
    customer = await getAdminCustomerServer(id);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    return <AdminErrorState message={error instanceof ApiError ? error.message : "Couldn't load this customer."} />;
  }

  return (
    <div>
      <AdminPageHeader title="Edit Customer" description={`${customer.firstName} ${customer.lastName}`} />
      <CustomerForm mode="edit" customer={customer} />
    </div>
  );
}
