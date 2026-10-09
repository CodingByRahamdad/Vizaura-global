import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPermission } from "@/lib/auth/requireAdminPermission";
import { getAdminUserServer } from "@/lib/api/admin/users-server";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { hasPermission } from "@/lib/authorization";
import { ApiError } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminFormSection } from "@/components/admin/AdminFormSection";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { Badge } from "@/components/ui/Badge";
import { UserRoleActions } from "@/components/admin/users/UserRoleActions";
import { UserStatusActions } from "@/components/admin/users/UserStatusActions";
import { AdminResetPasswordAction } from "@/components/admin/users/AdminResetPasswordAction";
import { ROLE_KEY_LABELS, USER_STATUS_BADGE_VARIANT, USER_STATUS_LABELS } from "@/lib/types/admin-users";
import { formatOrderDateTime } from "@/lib/utils/adminOrderFormat";

interface AdminUserDetailPageProps {
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

export default async function AdminUserDetailPage({ params }: AdminUserDetailPageProps) {
  // Permission check BEFORE any data fetch — see requireAdminPermission.ts.
  const session = await requireAdminPermission(PERMISSIONS.usersRead);
  const { id } = await params;

  let user;
  try {
    user = await getAdminUserServer(id);
  } catch (error) {
    // 400 = malformed id (not a UUID): treat like any other unknown user.
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    return <AdminErrorState message={error instanceof ApiError ? error.message : "Couldn't load this user."} />;
  }

  const canManageStatus = hasPermission(session, PERMISSIONS.usersUpdate);
  const canAssignRole = hasPermission(session, PERMISSIONS.rolesAssign);
  // Self-modification is rejected server-side regardless (409), but these
  // controls are hidden entirely for the caller's own account rather than
  // merely disabled — never a confusing "why did that fail?" moment.
  const isSelf = user.id === session.user.id;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/admin/users" className="text-sm text-primary hover:underline">
          ← All users
        </Link>
      </div>

      <AdminPageHeader
        title={`${user.firstName} ${user.lastName}`}
        description={user.email}
        actions={
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap justify-end gap-2">
              <Badge variant={USER_STATUS_BADGE_VARIANT[user.status]}>{USER_STATUS_LABELS[user.status]}</Badge>
              {user.role ? <Badge variant={user.role.key === "super_admin" ? "best-seller" : "neutral"}>{user.role.name}</Badge> : null}
            </div>
            {isSelf ? (
              <p className="max-w-xs text-right text-xs text-text-secondary">
                This is your own account — role, status, and password-reset actions aren&apos;t available here.
              </p>
            ) : (
              <>
                <UserRoleActions userId={user.id} currentRole={user.role?.key ?? null} canAssign={canAssignRole} />
                <UserStatusActions userId={user.id} status={user.status} canManage={canManageStatus} />
                <AdminResetPasswordAction userId={user.id} canManage={canManageStatus} />
              </>
            )}
          </div>
        }
      />

      <AdminFormSection title="Account">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">{user.email}</Field>
          <Field label="Phone">{user.phone ?? "—"}</Field>
          <Field label="Email verified">{user.emailVerified ? "Yes" : "No"}</Field>
          <Field label="Joined">{formatOrderDateTime(user.createdAt)}</Field>
          <Field label="Last login">{formatOrderDateTime(user.lastLoginAt)}</Field>
          <Field label="User ID">
            <span className="break-all font-mono text-xs">{user.id}</span>
          </Field>
        </dl>
      </AdminFormSection>

      <AdminFormSection
        title="Role & permissions"
        description="Permissions are inherited entirely from the assigned role — there is no per-user permission override."
      >
        <dl className="flex flex-col gap-4">
          <Field label="Role">{user.role ? ROLE_KEY_LABELS[user.role.key] : "No role assigned"}</Field>
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-secondary">Inherited permissions</dt>
            <dd className="mt-1">
              {user.permissions.length === 0 ? (
                <span className="text-sm text-text-secondary">None</span>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {user.permissions.map((permission) => (
                    <li key={permission} className="rounded-sm bg-bg px-2 py-0.5 font-mono text-xs text-text-secondary">
                      {permission}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        </dl>
      </AdminFormSection>
    </div>
  );
}
