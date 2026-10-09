import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminShell } from "@/components/admin/AdminShell";
import { ADMIN_NAV_LINKS } from "@/lib/constants/admin-nav";
import { getServerSession } from "@/lib/api/auth-server";
import { hasAdminAccess, hasAnyPermission } from "@/lib/authorization";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Authentication + authorization, both server-side, before any HTML
  // reaches the client — covers direct URL access, not just nav-link
  // hiding. The backend independently re-checks every admin API request
  // regardless of what happens here (see docs/AUTH_SECURITY.md).
  const session = await getServerSession();
  if (!session) redirect("/login");

  if (!hasAdminAccess(session)) {
    return (
      <main className="flex flex-1 items-center justify-center bg-bg p-6">
        <EmptyState
          icon={<ShieldAlert className="h-8 w-8" aria-hidden />}
          title="Access Restricted"
          description="Your account doesn't have permission to access the admin area."
          action={<Button href="/account">Back to My Account</Button>}
        />
      </main>
    );
  }

  // A nav item's own permission requirement and whether its route actually
  // exists yet (`isRouted`) are independent — a link can be permitted but
  // still render as a disabled placeholder until its page is built.
  const visibleLinks = ADMIN_NAV_LINKS.filter(
    (link) => !link.permission || hasAnyPermission(session, [link.permission].flat())
  );

  return (
    <AdminShell session={session} links={visibleLinks}>
      {children}
    </AdminShell>
  );
}
