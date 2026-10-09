import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminFormSection } from "@/components/admin/AdminFormSection";
import { AdminProfileForm } from "@/components/admin/AdminProfileForm";
import { getServerSession } from "@/lib/api/auth-server";

export default async function AdminProfilePage() {
  // Every authenticated admin manages their own profile — no permission
  // check beyond "is logged in", same posture as /account/profile.
  const session = await getServerSession();
  if (!session) redirect("/login");

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="Full Profile" description="View and edit your account details." />
      <AdminFormSection title="Profile Information">
        <AdminProfileForm user={session.user} />
      </AdminFormSection>
    </div>
  );
}
