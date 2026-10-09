import Link from "next/link";
import { requireAdminPermission } from "@/lib/auth/requireAdminPermission";
import { getAdminReviewsServer } from "@/lib/api/admin/reviews";
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
import type { AdminReviewResponse, ReviewSource } from "@/lib/types/admin-reviews";

const BASE_PATH = "/admin/reviews";

interface AdminReviewsPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

function StatusBadge({ isPublished }: { isPublished: boolean }) {
  return <Badge variant={isPublished ? "success" : "neutral"}>{isPublished ? "Published" : "Unpublished"}</Badge>;
}

function SourceBadge({ source }: { source: ReviewSource }) {
  return <Badge variant={source === "CUSTOMER" ? "success" : "neutral"}>{source}</Badge>;
}

export default async function AdminReviewsPage({ searchParams }: AdminReviewsPageProps) {
  // Permission check BEFORE any data fetch — see requireAdminPermission.ts.
  const session = await requireAdminPermission(PERMISSIONS.reviewsRead);
  const canCreate = hasPermission(session, PERMISSIONS.reviewsModerate);

  const params = await searchParams;
  const parsedPage = Number(params.page);
  const page = Number.isInteger(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
  const status = params.status === "published" || params.status === "unpublished" ? params.status : undefined;
  const source = params.source === "CUSTOMER" || params.source === "ADMIN" || params.source === "SEED" ? params.source : undefined;

  let listResult: Awaited<ReturnType<typeof getAdminReviewsServer>> | null = null;
  let loadError: string | null = null;

  try {
    listResult = await getAdminReviewsServer({ page, limit: 20, status, source });
  } catch (error) {
    loadError = error instanceof ApiError ? error.message : "Couldn't load reviews.";
  }

  const columns: AdminTableColumn<AdminReviewResponse>[] = [
    {
      key: "author",
      header: "Reviewer",
      render: (row) => (
        <Link href={`${BASE_PATH}/${row.id}`} className="font-medium text-primary hover:underline">
          {row.authorName}
        </Link>
      ),
    },
    { key: "rating", header: "Rating", render: (row) => `${row.rating} / 5` },
    {
      key: "body",
      header: "Review",
      render: (row) => <span className="line-clamp-2 max-w-xs text-xs text-text-secondary">{row.body}</span>,
    },
    { key: "source", header: "Source", render: (row) => <SourceBadge source={row.source} /> },
    {
      key: "verified",
      header: "Verified",
      render: (row) => (row.isVerifiedPurchase ? <Badge variant="success">Verified</Badge> : "—"),
    },
    { key: "status", header: "Status", render: (row) => <StatusBadge isPublished={row.isPublished} /> },
    { key: "featured", header: "Featured", render: (row) => (row.isFeatured ? "Yes" : "—") },
    { key: "createdAt", header: "Created", render: (row) => new Date(row.createdAt).toLocaleDateString() },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Reviews"
        description="Manage every product review — moderate, feature, edit or remove."
        actions={
          <AdminPermissionGate permissions={session.permissions} require={PERMISSIONS.reviewsModerate}>
            <Button href={`${BASE_PATH}/new`}>New Review</Button>
          </AdminPermissionGate>
        }
      />

      {loadError ? (
        <AdminErrorState message={loadError} />
      ) : !listResult || listResult.items.length === 0 ? (
        <AdminEmptyState
          title="No reviews yet"
          description={canCreate ? "Create one manually, or wait for customers to submit theirs." : "Nothing to show."}
        />
      ) : (
        <>
          <div className="hidden md:block">
            <AdminTable columns={columns} rows={listResult.items} getRowKey={(row) => row.id} />
          </div>
          <ul className="flex flex-col gap-3 md:hidden">
            {listResult.items.map((row) => (
              <li key={row.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`${BASE_PATH}/${row.id}`} className="font-semibold text-primary hover:underline">
                    {row.authorName}
                  </Link>
                  <StatusBadge isPublished={row.isPublished} />
                </div>
                <p className="mt-1 text-xs text-text-secondary">{row.rating} / 5 · {row.body}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <SourceBadge source={row.source} />
                  {row.isVerifiedPurchase ? <Badge variant="success">Verified</Badge> : null}
                  {row.isFeatured ? <Badge variant="neutral">Featured</Badge> : null}
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
