import Link from "next/link";
import { getServerSession } from "@/lib/api/auth-server";
import { redirect } from "next/navigation";
import { hasAdminAccess, hasPermission } from "@/lib/authorization";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { getAdminMarketsServer } from "@/lib/api/markets-server";
import { ApiError } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminFormSection } from "@/components/admin/AdminFormSection";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

/**
 * A real, scoped settings shell (Phase 6M) — not a placeholder, but also not
 * inventing configuration that doesn't exist. No dedicated `settings:*`
 * permission is seeded (same posture the pre-Phase-6M nav placeholder used),
 * so this page is gated the same way the rest of /admin/layout.tsx already
 * is (hasAdminAccess) and each section below independently checks the real
 * permission it needs before showing anything.
 */
export default async function AdminSettingsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!hasAdminAccess(session)) redirect("/account");

  const canReadMarkets = hasPermission(session, PERMISSIONS.marketsRead);
  const canAssignRoles = hasPermission(session, PERMISSIONS.rolesAssign);

  let marketsSummary: { name: string; code: string; isActive: boolean }[] | null = null;
  let marketsError: string | null = null;
  if (canReadMarkets) {
    try {
      const markets = await getAdminMarketsServer();
      marketsSummary = markets.map((m) => ({ name: m.name, code: m.code, isActive: m.isActive }));
    } catch (error) {
      marketsError = error instanceof ApiError ? error.message : "Couldn't load markets.";
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <AdminPageHeader title="Settings" description="Configuration surfaces that actually exist in this application today." />

      {canReadMarkets ? (
        <AdminFormSection
          title="Markets"
          description="Pakistan and UAE are independently priced, stocked, and configured — no currency conversion exists or is applied anywhere."
        >
          {marketsError ? (
            <p className="text-sm text-error">{marketsError}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {marketsSummary?.map((market) => (
                <div key={market.code} className="flex items-center justify-between text-sm">
                  <span>
                    {market.name} <span className="text-text-secondary">({market.code})</span>
                  </span>
                  <Badge variant={market.isActive ? "success" : "neutral"}>{market.isActive ? "Active" : "Inactive"}</Badge>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4">
            <Button href="/admin/markets" variant="outline" size="sm">
              Manage Markets
            </Button>
          </div>
        </AdminFormSection>
      ) : null}

      <AdminFormSection
        title="Security"
        description="Live account-security policy — not editable here; shown for reference."
      >
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-secondary">Minimum password length</dt>
            <dd className="mt-0.5 text-text">8 characters</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-secondary">Session (access token) lifetime</dt>
            <dd className="mt-0.5 text-text">15 minutes</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-secondary">Sign-in refresh window</dt>
            <dd className="mt-0.5 text-text">30 days</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-4">
          <Link href="/admin/profile" className="text-sm text-primary hover:underline">
            Change email →
          </Link>
          <Link href="/account/change-password" className="text-sm text-primary hover:underline">
            Change password →
          </Link>
        </div>
      </AdminFormSection>

      {canAssignRoles ? (
        <AdminFormSection
          title="Administrator Accounts"
          description="Assigning or removing super_admin access is an internal capability, not a standalone module — see the linked account list."
        >
          <Link href="/admin/users" className="text-sm text-primary hover:underline">
            View accounts &amp; assign roles →
          </Link>
        </AdminFormSection>
      ) : null}

      <AdminFormSection title="Coming later" description="Not yet built — listed here so nothing is silently invented.">
        <ul className="list-inside list-disc text-sm text-text-secondary">
          <li>Promotions / coupon configuration</li>
          <li>Notification preferences</li>
          <li>Storefront content (CMS) settings</li>
        </ul>
      </AdminFormSection>
    </div>
  );
}
