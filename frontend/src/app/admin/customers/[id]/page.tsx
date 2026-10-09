import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPermission } from "@/lib/auth/requireAdminPermission";
import { getAdminCustomerServer } from "@/lib/api/admin/customers-server";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { hasPermission } from "@/lib/authorization";
import { ApiError } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminFormSection } from "@/components/admin/AdminFormSection";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CustomerStatusActions } from "@/components/admin/customers/CustomerStatusActions";
import { CustomerDeleteAction } from "@/components/admin/customers/CustomerDeleteAction";
import { USER_STATUS_BADGE_VARIANT, USER_STATUS_LABELS } from "@/lib/types/admin-users";
import { formatOrderDateTime, formatOrderMoney } from "@/lib/utils/adminOrderFormat";

interface AdminCustomerDetailPageProps {
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

export default async function AdminCustomerDetailPage({ params }: AdminCustomerDetailPageProps) {
  // Permission check BEFORE any data fetch — see requireAdminPermission.ts.
  const session = await requireAdminPermission(PERMISSIONS.customersRead);
  const { id } = await params;

  let customer;
  try {
    customer = await getAdminCustomerServer(id);
  } catch (error) {
    // 404 = not found, or the id resolves to a non-customer (e.g. a
    // super_admin) account — this surface never distinguishes the two.
    // 400 = malformed id (not a UUID): treat like any other unknown customer.
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    return <AdminErrorState message={error instanceof ApiError ? error.message : "Couldn't load this customer."} />;
  }

  const canManageStatus = hasPermission(session, PERMISSIONS.customersUpdate);
  const canUpdate = hasPermission(session, PERMISSIONS.customersUpdate);
  const canDelete = hasPermission(session, PERMISSIONS.customersDelete);

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <Link href="/admin/customers" className="text-sm text-primary hover:underline">
          ← All customers
        </Link>
      </div>

      <AdminPageHeader
        title={`${customer.firstName} ${customer.lastName}`}
        description={customer.email}
        actions={
          <div className="flex flex-col items-end gap-2">
            <Badge variant={USER_STATUS_BADGE_VARIANT[customer.status]}>{USER_STATUS_LABELS[customer.status]}</Badge>
            <div className="flex items-center gap-2">
              {canUpdate ? (
                <Button href={`/admin/customers/${customer.id}/edit`} variant="outline" size="sm">
                  Edit
                </Button>
              ) : null}
              <CustomerStatusActions customerId={customer.id} status={customer.status} canManage={canManageStatus} />
            </div>
            <CustomerDeleteAction customerId={customer.id} canDelete={canDelete} orderCount={customer.orderCount} />
          </div>
        }
      />

      <AdminFormSection title="Account">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">{customer.email}</Field>
          <Field label="Phone">{customer.phone ?? "—"}</Field>
          <Field label="Email verified">{customer.emailVerified ? "Yes" : "No"}</Field>
          <Field label="Joined">{formatOrderDateTime(customer.createdAt)}</Field>
          <Field label="Last login">{formatOrderDateTime(customer.lastLoginAt)}</Field>
          <Field label="Customer ID">
            <span className="break-all font-mono text-xs">{customer.id}</span>
          </Field>
        </dl>
      </AdminFormSection>

      <AdminFormSection title="Address">
        {customer.addressLine1 ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Address line 1">{customer.addressLine1}</Field>
            <Field label="Address line 2">{customer.addressLine2 ?? "—"}</Field>
            <Field label="City">{customer.city ?? "—"}</Field>
            <Field label="Region/State">{customer.region ?? "—"}</Field>
            <Field label="Postal code">{customer.postalCode ?? "—"}</Field>
            <Field label="Country code">{customer.countryCode ?? "—"}</Field>
          </dl>
        ) : (
          <p className="text-sm text-text-secondary">No address on file.</p>
        )}
      </AdminFormSection>

      <AdminFormSection title="Orders" description="Spend is shown per market currency — never combined into one total.">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Total orders">{customer.orderCount.toLocaleString("en-US")}</Field>
          <Field label="Total spent">
            {customer.totalSpent.length === 0 ? (
              "—"
            ) : (
              <div className="flex flex-col">
                {customer.totalSpent.map((entry) => (
                  <span key={entry.currencyCode}>{formatOrderMoney(entry.amount, entry.currencyCode)}</span>
                ))}
              </div>
            )}
          </Field>
        </dl>
      </AdminFormSection>
    </div>
  );
}
