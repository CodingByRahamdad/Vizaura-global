import { PERMISSIONS, type PermissionKey } from "@/lib/constants/permissions";

// A string key, not the lucide component itself: this module is imported by
// the server-rendered admin/layout.tsx and passed into the client
// AdminSidebar component. Lucide icons are forwardRef objects, not plain
// serializable data, so passing the component reference across the
// Server->Client boundary throws ("Only plain objects can be passed to
// Client Components"). AdminSidebar.tsx (a client component) owns the
// name->component map and resolves this at render time instead.
export type AdminIconName =
  | "LayoutDashboard"
  | "Package"
  | "FolderTree"
  | "ShoppingCart"
  | "Users"
  | "Globe"
  | "Boxes"
  | "Settings"
  | "Star"
  | "Megaphone";

export interface AdminNavChild {
  label: string;
  href: string;
}

export interface AdminNavLink {
  label: string;
  href: string;
  icon: AdminIconName;
  /** No field = visible to any admin-capable user (see lib/authorization.ts's hasAdminAccess). An array means "any of". */
  permission?: PermissionKey | PermissionKey[];
  /** False (default) renders as a disabled "coming in a later phase" placeholder — see admin/layout.tsx. */
  isRouted?: boolean;
  /** A dropdown/submenu (Phase 6M) — the parent itself is not a link when present. */
  children?: AdminNavChild[];
}

// Phase 6M restructure: dropped the generic "Users & Roles" module from the
// primary nav (role assignment stays reachable internally — see the
// Settings page's "Administrator Accounts" link — but is not a standalone
// product module, per explicit product direction) and introduced Customers
// as the primary account-management surface. Products/Categories gained a
// dropdown (All/Add) matching the same pattern. Promotions/Shipping/
// Payments/Analytics were removed as standalone items at the time — all were
// non-functional placeholders for domains either FUTURE (Promotions) or
// already reachable elsewhere (Payments/Shipping via Order Detail,
// Analytics via the Dashboard itself). Promotions re-added below once the
// module became real (see promotions.routes.ts) — no longer a placeholder.
export const ADMIN_NAV_LINKS: AdminNavLink[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: "LayoutDashboard", isRouted: true },
  {
    label: "Products",
    href: "/admin/products",
    icon: "Package",
    permission: PERMISSIONS.productsRead,
    isRouted: true,
    children: [
      { label: "All Products", href: "/admin/products" },
      { label: "Add Product", href: "/admin/products/new" },
    ],
  },
  {
    label: "Categories",
    href: "/admin/categories",
    icon: "FolderTree",
    permission: PERMISSIONS.categoriesRead,
    isRouted: true,
    children: [
      { label: "All Categories", href: "/admin/categories" },
      { label: "Add Category", href: "/admin/categories/new" },
    ],
  },
  { label: "Orders", href: "/admin/orders", icon: "ShoppingCart", permission: PERMISSIONS.ordersRead, isRouted: true },
  {
    label: "Customers",
    href: "/admin/customers",
    icon: "Users",
    permission: PERMISSIONS.customersRead,
    isRouted: true,
  },
  {
    label: "Reviews",
    href: "/admin/reviews",
    icon: "Star",
    permission: [PERMISSIONS.reviewsRead, PERMISSIONS.reviewsModerate],
    isRouted: true,
  },
  {
    label: "Promotions",
    href: "/admin/promotions",
    icon: "Megaphone",
    permission: PERMISSIONS.promotionsRead,
    isRouted: true,
    children: [
      { label: "All Promotions", href: "/admin/promotions" },
      { label: "Add Promotion", href: "/admin/promotions/new" },
    ],
  },
  { label: "Markets", href: "/admin/markets", icon: "Globe", permission: PERMISSIONS.marketsRead, isRouted: true },
  {
    label: "Inventory",
    href: "/admin/inventory",
    icon: "Boxes",
    permission: PERMISSIONS.inventoryRead,
    isRouted: true,
  },
  // No dedicated settings:* permission exists — visible to any admin-capable
  // user, same posture the pre-Phase-6M placeholder used.
  { label: "Settings", href: "/admin/settings", icon: "Settings", isRouted: true },
];
