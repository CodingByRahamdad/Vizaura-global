import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPermission } from "@/lib/auth/requireAdminPermission";
import { getAdminReviewServer } from "@/lib/api/admin/reviews";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { hasPermission } from "@/lib/authorization";
import { ApiError } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminFormSection } from "@/components/admin/AdminFormSection";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { ReviewForm } from "@/components/admin/reviews/ReviewForm";
import { ReviewLifecycleActions } from "@/components/admin/reviews/ReviewLifecycleActions";

interface AdminReviewEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminReviewEditPage({ params }: AdminReviewEditPageProps) {
  // Permission check BEFORE any data fetch — see requireAdminPermission.ts.
  const session = await requireAdminPermission(PERMISSIONS.reviewsRead);
  const { id } = await params;

  let review;
  try {
    review = await getAdminReviewServer(id);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    return <AdminErrorState message={error instanceof ApiError ? error.message : "Couldn't load this review."} />;
  }

  const canUpdate = hasPermission(session, PERMISSIONS.reviewsModerate);
  const canDelete = hasPermission(session, PERMISSIONS.reviewsDelete);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <Link href="/admin/reviews" className="text-sm text-primary hover:underline">
          ← All reviews
        </Link>
      </div>

      <AdminPageHeader
        title={`Review by ${review.authorName}`}
        description={`Product: ${review.productId}`}
        actions={
          <ReviewLifecycleActions
            reviewId={review.id}
            isPublished={review.isPublished}
            isFeatured={review.isFeatured}
            canUpdate={canUpdate}
            canDelete={canDelete}
          />
        }
      />

      <AdminFormSection title="Details" description="Editing a review updates it everywhere it's displayed immediately.">
        <ReviewForm mode="edit" review={review} products={[]} canUpdate={canUpdate} />
      </AdminFormSection>
    </div>
  );
}
