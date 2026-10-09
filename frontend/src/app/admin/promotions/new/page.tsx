import { requireAdminPermission } from "@/lib/auth/requireAdminPermission";
import { getCategoriesForAdminServer } from "@/lib/api/admin/categories";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PromotionForm } from "@/components/admin/promotions/PromotionForm";

export default async function NewPromotionPage() {
  await requireAdminPermission(PERMISSIONS.promotionsCreate);

  const categories = await getCategoriesForAdminServer().catch(() => []);

  return (
    <div>
      <AdminPageHeader title="New Promotion" description="Controls the homepage Promotion Section." />
      <PromotionForm mode="create" categories={categories} canUpdate />
    </div>
  );
}
