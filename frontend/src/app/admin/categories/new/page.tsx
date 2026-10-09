import { requireAdminPermission } from "@/lib/auth/requireAdminPermission";
import { getCategoriesForAdminServer } from "@/lib/api/admin/categories";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { CategoryForm } from "@/components/admin/categories/CategoryForm";
import { ApiError } from "@/lib/api";

export default async function NewAdminCategoryPage() {
  await requireAdminPermission(PERMISSIONS.categoriesCreate);

  let allCategories;
  try {
    allCategories = await getCategoriesForAdminServer();
  } catch (error) {
    return <AdminErrorState message={error instanceof ApiError ? error.message : "Couldn't load categories."} />;
  }

  return (
    <div>
      <AdminPageHeader title="New Category" description="Categories are shared by both markets." />
      <CategoryForm mode="create" allCategories={allCategories} canUpdate />
    </div>
  );
}
