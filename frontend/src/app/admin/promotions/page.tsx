import Link from "next/link";
import { requireAdminPermission } from "@/lib/auth/requireAdminPermission";
import { getAdminPromotionsServer } from "@/lib/api/admin/promotions-server";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { ApiError } from "@/lib/api";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPermissionGate } from "@/components/admin/AdminPermissionGate";
import { AdminTable, type AdminTableColumn } from "@/components/admin/AdminTable";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import type { AdminPromotionResponse, PromotionStatus } from "@/lib/types/promotions";

const BASE_PATH = "/admin/promotions";

const STATUS_VARIANT: Record<PromotionStatus, BadgeVariant> = {
  DRAFT: "neutral",
  SCHEDULED: "warning",
  ACTIVE: "success",
  EXPIRED: "error",
};

function targetLabel(row: AdminPromotionResponse): string {
  if (row.targetType === "PRODUCT") return row.targetProductName ?? "—";
  if (row.targetType === "CATEGORY") return row.targetCategoryName ?? "—";
  return "—";
}

interface AdminPromotionsPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function AdminPromotionsPage({ searchParams }: AdminPromotionsPageProps) {
  // Permission check BEFORE any data fetch — see requireAdminPermission.ts.
  const session = await requireAdminPermission(PERMISSIONS.promotionsRead);

  const params = await searchParams;
  const parsedPage = Number(params.page);
  const page = Number.isInteger(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

  let listResult: Awaited<ReturnType<typeof getAdminPromotionsServer>> | null = null;
  let loadError: string | null = null;

  try {
    listResult = await getAdminPromotionsServer({ page, limit: 20 });
  } catch (error) {
    loadError = error instanceof ApiError ? error.message : "Couldn't load promotions.";
  }

  const columns: AdminTableColumn<AdminPromotionResponse>[] = [
    {
      key: "title",
      header: "Title",
      render: (row) => (
        <Link href={`${BASE_PATH}/${row.id}`} className="font-medium text-primary hover:underline">
          {row.title}
        </Link>
      ),
    },
    { key: "status", header: "Status", render: (row) => <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge> },
    { key: "layout", header: "Layout", render: (row) => row.displayLayout },
    { key: "order", header: "Order", render: (row) => row.displayOrder },
    { key: "target", header: "Target", render: (row) => targetLabel(row) },
    {
      key: "dates",
      header: "Dates",
      render: (row) => (
        <span className="text-xs text-text-secondary">
          {row.startAt ? new Date(row.startAt).toLocaleDateString() : "—"}
          {" → "}
          {row.endAt ? new Date(row.endAt).toLocaleDateString() : "—"}
        </span>
      ),
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Promotions"
        description="Controls the homepage Promotion Section — nothing there is hardcoded."
        actions={
          <AdminPermissionGate permissions={session.permissions} require={PERMISSIONS.promotionsCreate}>
            <Button href={`${BASE_PATH}/new`}>New Promotion</Button>
          </AdminPermissionGate>
        }
      />

      {loadError ? (
        <AdminErrorState message={loadError} />
      ) : !listResult || listResult.items.length === 0 ? (
        <AdminEmptyState
          title="No promotions yet"
          description="Create a promotion to populate the homepage Promotion Section."
        />
      ) : (
        <>
          {/* Desktop: table. Mobile: stacked cards (avoids a wide horizontal scroll). */}
          <div className="hidden md:block">
            <AdminTable columns={columns} rows={listResult.items} getRowKey={(row) => row.id} />
          </div>
          <ul className="flex flex-col gap-3 md:hidden">
            {listResult.items.map((promotion) => (
              <li key={promotion.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`${BASE_PATH}/${promotion.id}`} className="font-semibold text-primary hover:underline">
                    {promotion.title}
                  </Link>
                  <Badge variant={STATUS_VARIANT[promotion.status]}>{promotion.status}</Badge>
                </div>
                <p className="mt-2 text-xs text-text-secondary">
                  {promotion.displayLayout} · Order {promotion.displayOrder} · {targetLabel(promotion)}
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
