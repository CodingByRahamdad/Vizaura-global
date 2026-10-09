import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/api/auth-server";
import { hasPermission } from "@/lib/authorization";
import type { PermissionKey } from "@/lib/constants/permissions";
import type { AuthSession } from "@/lib/types/auth";

/**
 * The admin layout's own gate (app/admin/layout.tsx) only protects rendered
 * JSX — Next.js still invokes a page component's render function even when
 * the layout doesn't render {children} for an unauthorized branch. Any
 * future admin page that fetches real data must call this BEFORE fetching,
 * not rely solely on the layout gate. No caller is wired up yet (no admin
 * data pages exist in this phase) — this is scaffolding for the next one.
 */
export async function requireAdminPermission(key: PermissionKey): Promise<AuthSession> {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!hasPermission(session, key)) redirect("/admin/dashboard");
  return session;
}
