import { requireAdminPermission } from "@/lib/auth/requireAdminPermission";
import { getCategoriesForAdminServer } from "@/lib/api/admin/categories";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { ProductForm } from "@/components/admin/products/ProductForm";
import { ApiError } from "@/lib/api";

export default async function NewAdminProductPage() {
  await requireAdminPermission(PERMISSIONS.productsCreate);

  let categories;
  try {
    categories = await getCategoriesForAdminServer();
  } catch (error) {
    return <AdminErrorState message={error instanceof ApiError ? error.message : "Couldn't load categories."} />;
  }

  return (
    <div>
      <AdminPageHeader title="New Product" description="Create a product and assign it to a category and market." />
      <ProductForm mode="create" categories={categories} canUpdate />
    </div>
  );
}
