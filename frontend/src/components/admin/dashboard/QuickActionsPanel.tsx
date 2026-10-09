import Link from "next/link";
import { Boxes, FolderTree, PackagePlus, ShoppingCart } from "lucide-react";

/// Only links to routes that already exist — never a dead/fake control for
/// an unbuilt feature (the reference's "Create Order"/"Manage Coupons"/
/// "Add Customer"/"View Reports" have no backing feature yet).
const ACTIONS = [
  { label: "Add Product", href: "/admin/products/new", icon: PackagePlus },
  { label: "Orders", href: "/admin/orders", icon: ShoppingCart },
  { label: "Inventory", href: "/admin/inventory", icon: Boxes },
  { label: "Categories", href: "/admin/categories", icon: FolderTree },
];

export function QuickActionsPanel() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {ACTIONS.map(({ label, href, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-center text-xs font-medium text-text-secondary transition-colors hover:border-primary hover:text-primary"
        >
          <Icon className="h-5 w-5" aria-hidden />
          {label}
        </Link>
      ))}
    </div>
  );
}
