import { requireAdminPermission } from "@/lib/auth/requireAdminPermission";
import { getAdminProductsServer } from "@/lib/api/admin/products-server";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ReviewForm } from "@/components/admin/reviews/ReviewForm";

export default async function NewAdminReviewPage() {
  await requireAdminPermission(PERMISSIONS.reviewsModerate);

  // Best-effort only: the product picker falls back to a manual id field
  // (ReviewForm) if this caller doesn't also hold products:read — moderating
  // reviews and managing the catalog are independent permissions.
  const products = await getAdminProductsServer({ limit: 100 })
    .then((result) => result.items.map((p) => ({ id: p.id, name: p.name })))
    .catch(() => []);

  return (
    <div className="max-w-2xl">
      <AdminPageHeader title="New Review" description="Create a review on a customer's behalf, or a quoted testimonial with no account." />
      <ReviewForm mode="create" products={products} canUpdate />
    </div>
  );
}
