import { ShieldAlert, Users, Package, RotateCcw, AlertTriangle } from "lucide-react";
import { getServerSession } from "@/lib/api/auth-server";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/authorization";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { ApiError } from "@/lib/api";
import { getAdminDashboardServer } from "@/lib/api/admin/analytics-server";
import { getAdminOrdersServer } from "@/lib/api/admin/orders-server";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminFormSection } from "@/components/admin/AdminFormSection";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/admin/dashboard/StatCard";
import { MarketScopedSection } from "@/components/admin/dashboard/MarketScopedSection";
import { MarketSplitPanel } from "@/components/admin/dashboard/MarketSplitPanel";
import { RecentOrdersList } from "@/components/admin/dashboard/RecentOrdersList";
import { LowStockList } from "@/components/admin/dashboard/LowStockList";
import { RecentCustomersList } from "@/components/admin/dashboard/RecentCustomersList";
import { QuickActionsPanel } from "@/components/admin/dashboard/QuickActionsPanel";
import { PromoBanner } from "@/components/admin/dashboard/PromoBanner";

export default async function AdminDashboardPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  // Deliberately NOT requireAdminPermission: its "missing permission"
  // fallback redirects to /admin/dashboard — this page — which would loop.
  // Every other admin page keeps using requireAdminPermission as-is.
  if (!hasPermission(session, PERMISSIONS.analyticsRead)) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-8 w-8" aria-hidden />}
        title="Access Restricted"
        description="Your account doesn't have permission to view the dashboard."
        action={<Button href="/account">Back to My Account</Button>}
      />
    );
  }

  let dashboard: Awaited<ReturnType<typeof getAdminDashboardServer>> | null = null;
  let recentOrders: Awaited<ReturnType<typeof getAdminOrdersServer>> | null = null;
  let loadError: string | null = null;

  try {
    [dashboard, recentOrders] = await Promise.all([
      getAdminDashboardServer(),
      getAdminOrdersServer({ limit: 5 }),
    ]);
  } catch (error) {
    loadError = error instanceof ApiError ? error.message : "Couldn't load the dashboard.";
  }

  if (loadError || !dashboard) {
    return (
      <div>
        <AdminPageHeader title={`Good morning, ${session.user.firstName}`} />
        <AdminErrorState message={loadError ?? undefined} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title={`Good morning, ${session.user.firstName}`}
        description="Here's what's happening with your store today."
      />

      {/* Reference-matching order (Phase 6M): global counters first, then
          the per-market revenue/chart/top-products section below — the
          reverse of the pre-6M layout. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Users className="h-5 w-5 text-white" aria-hidden />}
          iconClassName="bg-accent-green"
          label="Total Customers"
          value={dashboard.customerCount.toLocaleString("en-US")}
        />
        <StatCard
          icon={<Package className="h-5 w-5 text-white" aria-hidden />}
          iconClassName="bg-primary"
          label="Total Products"
          value={dashboard.productCount.toLocaleString("en-US")}
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5 text-white" aria-hidden />}
          iconClassName="bg-error"
          label="Low Stock Items"
          value={dashboard.lowStock.length.toLocaleString("en-US")}
        />
        <StatCard
          icon={<RotateCcw className="h-5 w-5 text-white" aria-hidden />}
          iconClassName="bg-warning"
          label="Total Returned Items"
          value={dashboard.totalReturnedItems.toLocaleString("en-US")}
        />
      </div>

      <MarketScopedSection markets={dashboard.markets} days={dashboard.days} />

      <div className="grid gap-4 lg:grid-cols-3">
        <AdminFormSection title="Recent Orders" description="Across both markets">
          <RecentOrdersList orders={recentOrders?.items ?? []} />
        </AdminFormSection>
        <AdminFormSection title="Low Stock Alerts">
          <LowStockList items={dashboard.lowStock} />
        </AdminFormSection>
        <AdminFormSection title="Recent Customers">
          <RecentCustomersList customers={dashboard.recentCustomers} />
        </AdminFormSection>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <AdminFormSection title="Quick Actions">
          <QuickActionsPanel />
        </AdminFormSection>
        <AdminFormSection title="Market Performance">
          <MarketSplitPanel markets={dashboard.markets} />
        </AdminFormSection>
        <PromoBanner />
      </div>
    </div>
  );
}
