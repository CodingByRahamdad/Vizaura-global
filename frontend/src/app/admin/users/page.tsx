import Link from "next/link";
import { requireAdminPermission } from "@/lib/auth/requireAdminPermission";
import { getAdminUsersServer } from "@/lib/api/admin/users-server";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { ApiError } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable, type AdminTableColumn } from "@/components/admin/AdminTable";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminSearchInput } from "@/components/admin/AdminSearchInput";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { Badge } from "@/components/ui/Badge";
import {
  ROLE_KEY_LABELS,
  ROLE_KEY_VALUES,
  USER_STATUS_BADGE_VARIANT,
  USER_STATUS_LABELS,
  USER_STATUS_VALUES,
  type AdminUserSummary,
  type RoleKey,
  type UserStatus,
} from "@/lib/types/admin-users";
import { formatOrderDate } from "@/lib/utils/adminOrderFormat";

const BASE_PATH = "/admin/users";

interface AdminUsersPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

function pick<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

function StatusBadge({ status }: { status: UserStatus }) {
  return <Badge variant={USER_STATUS_BADGE_VARIANT[status]}>{USER_STATUS_LABELS[status]}</Badge>;
}

function RoleBadge({ roleKey }: { roleKey: RoleKey | null }) {
  if (!roleKey) return <span className="text-text-secondary">—</span>;
  return <Badge variant={roleKey === "super_admin" ? "best-seller" : "neutral"}>{ROLE_KEY_LABELS[roleKey]}</Badge>;
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  // Permission check BEFORE any data fetch — see requireAdminPermission.ts.
  await requireAdminPermission(PERMISSIONS.usersRead);

  const params = await searchParams;
  const parsedPage = Number(params.page);
  const page = Number.isInteger(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
  const search = params.search?.trim().slice(0, 100) || undefined;
  const status = pick(params.status, USER_STATUS_VALUES);
  const role = pick(params.role, ROLE_KEY_VALUES);

  let listResult: Awaited<ReturnType<typeof getAdminUsersServer>> | null = null;
  let loadError: string | null = null;

  try {
    listResult = await getAdminUsersServer({ page, limit: 20, search, status, role });
  } catch (error) {
    loadError = error instanceof ApiError ? error.message : "Couldn't load users.";
  }

  const columns: AdminTableColumn<AdminUserSummary>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <Link href={`${BASE_PATH}/${row.id}`} className="font-medium text-primary hover:underline">
          {row.firstName} {row.lastName}
        </Link>
      ),
    },
    { key: "email", header: "Email", render: (row) => <span className="break-all">{row.email}</span> },
    { key: "role", header: "Role", render: (row) => <RoleBadge roleKey={row.roleKey} /> },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "created", header: "Joined", render: (row) => formatOrderDate(row.createdAt) },
  ];

  const hasFilters = !!(search || status || role);

  return (
    <div>
      <AdminPageHeader title="Users" description="Every registered account across both markets." />

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <AdminSearchInput basePath={BASE_PATH} placeholder="Name or email..." />
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
            {
              param: "role",
              label: "Role",
              allValue: "",
              options: [
                { label: "All roles", value: "" },
                ...ROLE_KEY_VALUES.map((v) => ({ label: ROLE_KEY_LABELS[v], value: v })),
              ],
            },
          ]}
        />
      </div>

      {loadError ? (
        <AdminErrorState message={loadError} />
      ) : !listResult || listResult.items.length === 0 ? (
        <AdminEmptyState
          title="No users found"
          description={hasFilters ? "Try adjusting your search or filters." : "Users will appear here once they register."}
        />
      ) : (
        <>
          {/* Desktop: table. Mobile: stacked cards (avoids a wide horizontal scroll). */}
          <div className="hidden md:block">
            <AdminTable columns={columns} rows={listResult.items} getRowKey={(row) => row.id} />
          </div>
          <ul className="flex flex-col gap-3 md:hidden">
            {listResult.items.map((user) => (
              <li key={user.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`${BASE_PATH}/${user.id}`} className="font-semibold text-primary hover:underline">
                    {user.firstName} {user.lastName}
                  </Link>
                  <StatusBadge status={user.status} />
                </div>
                <p className="mt-1 break-all text-xs text-text-secondary">{user.email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <RoleBadge roleKey={user.roleKey} />
                  <span className="text-xs text-text-secondary">Joined {formatOrderDate(user.createdAt)}</span>
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
