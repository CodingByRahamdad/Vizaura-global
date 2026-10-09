import type { LucideIcon } from "lucide-react";
import { Bell, Heart, LayoutDashboard, Lock, MapPin, Package, User } from "lucide-react";

export interface AccountNavLink {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const ACCOUNT_NAV_LINKS: AccountNavLink[] = [
  { label: "Dashboard", href: "/account", icon: LayoutDashboard },
  { label: "My Orders", href: "/account/orders", icon: Package },
  { label: "Addresses", href: "/account/addresses", icon: MapPin },
  { label: "Wishlist", href: "/account/wishlist", icon: Heart },
  { label: "Profile Information", href: "/account/profile", icon: User },
  { label: "Change Password", href: "/account/change-password", icon: Lock },
  { label: "Notifications", href: "/account/notifications", icon: Bell },
];
