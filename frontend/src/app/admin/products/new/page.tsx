import { requireAdminPermission } from "@/lib/auth/requireAdminPermission";
import { getCategoriesForAdminServer } from "@/lib/api/admin/categories";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ProductForm } from "@/components/admin/products/ProductForm";

export default async function NewAdminProductPage() {
  await requireAdminPermission(PERMISSIONS.productsCreate);
  const categories = await getCategoriesForAdminServer();

  return (
    <div>
      <AdminPageHeader title="New Product" description="Create a product and assign it to a category and market." />
      <ProductForm mode="create" categories={categories} canUpdate />
    </div>
  );
}
