import Link from "next/link";
import { requireAdminPermission } from "@/lib/auth/requireAdminPermission";
import { getAdminCategoriesServer, getCategoriesForAdminServer } from "@/lib/api/admin/categories";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { hasPermission } from "@/lib/authorization";
import { ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPermissionGate } from "@/components/admin/AdminPermissionGate";
import { AdminTable, type AdminTableColumn } from "@/components/admin/AdminTable";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import type { AdminCategoryResponse } from "@/lib/types/admin-catalog";

const BASE_PATH = "/admin/categories";

interface AdminCategoriesPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return <Badge variant={isActive ? "success" : "neutral"}>{isActive ? "Active" : "Inactive"}</Badge>;
}

export default async function AdminCategoriesPage({ searchParams }: AdminCategoriesPageProps) {
  // Permission check BEFORE any data fetch — see requireAdminPermission.ts.
  const session = await requireAdminPermission(PERMISSIONS.categoriesRead);
  const canCreate = hasPermission(session, PERMISSIONS.categoriesCreate);

  const params = await searchParams;
  const parsedPage = Number(params.page);
  const page = Number.isInteger(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

  let listResult: Awaited<ReturnType<typeof getAdminCategoriesServer>> | null = null;
  let parentNames = new Map<string, string>();
  let loadError: string | null = null;

  try {
    const [list, everyCategory] = await Promise.all([
      getAdminCategoriesServer({ page, limit: 20 }),
      // Only used to resolve a parent's name when it sits on another page.
      getCategoriesForAdminServer().catch(() => []),
    ]);
    listResult = list;
    parentNames = new Map(everyCategory.map((c) => [c.id, c.name]));
  } catch (error) {
    loadError = error instanceof ApiError ? error.message : "Couldn't load categories.";
  }

  const parentLabel = (row: AdminCategoryResponse) => (row.parentId ? (parentNames.get(row.parentId) ?? "—") : "—");

  const columns: AdminTableColumn<AdminCategoryResponse>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <Link href={`${BASE_PATH}/${row.id}`} className="font-medium text-primary hover:underline">
          {row.name}
        </Link>
      ),
    },
    { key: "slug", header: "Slug", render: (row) => <span className="font-mono text-xs">{row.slug}</span> },
    { key: "parent", header: "Parent", render: (row) => parentLabel(row) },
    { key: "status", header: "Status", render: (row) => <StatusBadge isActive={row.isActive} /> },
    { key: "position", header: "Position", render: (row) => row.position },
    {
      key: "products",
      header: "Products",
      render: (row) => (
        <span>
          {row.productCount}
          {row.childCount > 0 ? (
            <span className="text-xs text-text-secondary"> · {row.childCount} sub</span>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Categories"
        description="Categories are shared by both markets; which products appear where is controlled per product."
        actions={
          <AdminPermissionGate permissions={session.permissions} require={PERMISSIONS.categoriesCreate}>
            <Button href={`${BASE_PATH}/new`}>New Category</Button>
          </AdminPermissionGate>
        }
      />

      {loadError ? (
        <AdminErrorState message={loadError} />
      ) : !listResult || listResult.items.length === 0 ? (
        <AdminEmptyState
          title="No categories yet"
          description={canCreate ? "Create the first category to start organising products." : "Nothing to show."}
        />
      ) : (
        <>
          {/* Desktop: table. Mobile: stacked cards (avoids a wide horizontal scroll). */}
          <div className="hidden md:block">
            <AdminTable columns={columns} rows={listResult.items} getRowKey={(row) => row.id} />
          </div>
          <ul className="flex flex-col gap-3 md:hidden">
            {listResult.items.map((category) => (
              <li key={category.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`${BASE_PATH}/${category.id}`} className="font-semibold text-primary hover:underline">
                    {category.name}
                  </Link>
                  <StatusBadge isActive={category.isActive} />
                </div>
                <p className="mt-1 font-mono text-xs text-text-secondary">{category.slug}</p>
                <p className="mt-2 text-xs text-text-secondary">
                  Parent: {parentLabel(category)} · Position {category.position} · {category.productCount} product(s)
                  {category.childCount > 0 ? ` · ${category.childCount} sub` : ""}
                </p>
              </li>
            ))}
          </ul>
          <AdminPagination pagination={listResult.pagination} basePath={BASE_PATH} />
        </>
      )}
    </div>
  );
}
