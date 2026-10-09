import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPermission } from "@/lib/auth/requireAdminPermission";
import { getAdminCategoriesServer, getCategoryForAdminServer } from "@/lib/api/admin/categories";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { hasPermission } from "@/lib/authorization";
import { ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminFormSection } from "@/components/admin/AdminFormSection";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { CategoryForm } from "@/components/admin/categories/CategoryForm";
import { CategoryLifecycleActions } from "@/components/admin/categories/CategoryLifecycleActions";

interface AdminCategoryEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminCategoryEditPage({ params }: AdminCategoryEditPageProps) {
  // Permission check BEFORE any data fetch — see requireAdminPermission.ts.
  const session = await requireAdminPermission(PERMISSIONS.categoriesRead);
  const { id } = await params;

  let category;
  let allCategories;
  let counts: { productCount: number; childCount: number } | null = null;
  try {
    // One admin list request supplies the parent picker AND this category's
    // counts. Only if the category sits beyond the first 100 do we fall back
    // to the plain detail read — counts are then unknown and Delete is not
    // offered (the backend guard would still protect it regardless).
    const list = await getAdminCategoriesServer({ page: 1, limit: 100 });
    allCategories = list.items;
    const found = list.items.find((c) => c.id === id);
    if (found) {
      category = found;
      counts = { productCount: found.productCount, childCount: found.childCount };
    } else {
      category = await getCategoryForAdminServer(id);
    }
  } catch (error) {
    // 400 = malformed id (not a UUID): treat like any other unknown category.
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    return <AdminErrorState message={error instanceof ApiError ? error.message : "Couldn't load this category."} />;
  }

  const canUpdate = hasPermission(session, PERMISSIONS.categoriesUpdate);
  const canDelete = hasPermission(session, PERMISSIONS.categoriesDelete);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/admin/categories" className="text-sm text-primary hover:underline">
          ← All categories
        </Link>
      </div>

      <AdminPageHeader
        title={category.name}
        description={`Slug: ${category.slug}`}
        actions={
          <div className="flex flex-col items-end gap-2">
            <Badge variant={category.isActive ? "success" : "neutral"}>{category.isActive ? "Active" : "Inactive"}</Badge>
            <CategoryLifecycleActions
              categoryId={category.id}
              isActive={category.isActive}
              productCount={counts?.productCount ?? 1}
              childCount={counts?.childCount ?? 0}
              canUpdate={canUpdate}
              canDelete={canDelete && counts !== null}
            />
          </div>
        }
      />

      {counts ? (
        <p className="text-sm text-text-secondary">
          {counts.productCount} product link(s) (any status) · {counts.childCount} subcategor
          {counts.childCount === 1 ? "y" : "ies"}
        </p>
      ) : null}

      <AdminFormSection title="Details" description="Changing the name or slug never affects which products belong to this category.">
        <CategoryForm mode="edit" category={category} allCategories={allCategories} canUpdate={canUpdate} />
      </AdminFormSection>
    </div>
  );
}
