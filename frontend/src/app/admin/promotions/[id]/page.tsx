import { notFound } from "next/navigation";
import { requireAdminPermission } from "@/lib/auth/requireAdminPermission";
import { getAdminPromotionServer } from "@/lib/api/admin/promotions-server";
import { getCategoriesForAdminServer } from "@/lib/api/admin/categories";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { hasPermission } from "@/lib/authorization";
import { ApiError } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PromotionForm } from "@/components/admin/promotions/PromotionForm";
import { PromotionLifecycleActions } from "@/components/admin/promotions/PromotionLifecycleActions";

interface AdminPromotionDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminPromotionDetailPage({ params }: AdminPromotionDetailPageProps) {
  const session = await requireAdminPermission(PERMISSIONS.promotionsRead);
  const { id } = await params;

  let promotion;
  try {
    promotion = await getAdminPromotionServer(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const categories = await getCategoriesForAdminServer().catch(() => []);
  const canUpdate = hasPermission(session, PERMISSIONS.promotionsUpdate);
  const canDelete = hasPermission(session, PERMISSIONS.promotionsDelete);

  return (
    <div>
      <AdminPageHeader
        title={promotion.title}
        description="Controls the homepage Promotion Section."
        actions={<PromotionLifecycleActions promotion={promotion} canUpdate={canUpdate} canDelete={canDelete} />}
      />
      <PromotionForm mode="edit" promotion={promotion} categories={categories} canUpdate={canUpdate} />
    </div>
  );
}
