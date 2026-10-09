"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, UserCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/context/AuthContext";
import { ACCOUNT_NAV_LINKS } from "@/lib/constants/account-nav";

export function AccountSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <aside className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-3">
      {user ? (
        <div className="mb-2 flex flex-col items-center gap-2 border-b border-border px-2 pb-4 text-center">
          <UserCircle className="h-14 w-14 text-text-secondary" aria-hidden />
          <div>
            <p className="font-medium text-text">
              {user.firstName} {user.lastName}
            </p>
            <p className="truncate text-xs text-text-secondary">{user.email}</p>
          </div>
          <Badge variant={user.emailVerified ? "success" : "warning"}>
            {user.emailVerified ? "Verified Account" : "Unverified Account"}
          </Badge>
        </div>
      ) : null}

      {ACCOUNT_NAV_LINKS.map((link) => {
        const isActive = link.href === "/account" ? pathname === link.href : pathname.startsWith(link.href);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary-light/50 text-primary-dark"
                : "text-text hover:bg-primary-light/40"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {link.label}
          </Link>
        );
      })}

      <button
        type="button"
        onClick={() => void handleLogout()}
        className="mt-2 flex items-center gap-2 rounded-md border-t border-border px-3 pt-3 text-sm font-medium text-error hover:bg-error/10"
      >
        <LogOut className="h-4 w-4" aria-hidden />
        Logout
      </button>
    </aside>
  );
}
