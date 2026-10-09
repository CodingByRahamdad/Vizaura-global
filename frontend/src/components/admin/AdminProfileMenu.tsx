"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, LogOut, User as UserIcon } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { performAdminLogout } from "@/lib/auth/adminLogout";
import type { AuthSession } from "@/lib/types/auth";

interface AdminProfileMenuProps {
  session: AuthSession;
}

/// Replaces the old static profile <div> with a real Dropdown (modeled on
/// layout/Header/AccountMenu.tsx) — the name/email shown are the real
/// authenticated session's, passed down unchanged from the server-rendered
/// admin layout. Sign-out uses the same shared helper as the sidebar's
/// bottom button, never a second implementation.
export function AdminProfileMenu({ session }: AdminProfileMenuProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut(close: () => void) {
    setSigningOut(true);
    close();
    await performAdminLogout(router);
  }

  return (
    <Dropdown
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label={`Account menu for ${session.user.firstName}`}
          className="flex items-center gap-1 rounded-full border-l border-border pl-3 pr-2 py-1 hover:bg-bg"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-sm font-semibold text-primary-dark">
            {session.user.firstName.charAt(0).toUpperCase()}
          </span>
          <ChevronDown className="h-4 w-4 text-text-secondary" aria-hidden />
        </button>
      )}
      panelClassName="right-0 w-64 max-w-[calc(100vw-1.5rem)] py-2"
    >
      {({ close }) => (
        <div>
          <div className="border-b border-border px-4 py-2">
            <p className="truncate text-sm font-medium text-text">
              {session.user.firstName} {session.user.lastName}
            </p>
            <p className="truncate text-xs text-text-secondary">{session.user.email}</p>
          </div>
          <Link
            href="/admin/profile"
            onClick={close}
            className="flex items-center gap-2 px-4 py-2 text-sm text-text hover:bg-primary-light/40 hover:text-primary-dark"
          >
            <UserIcon className="h-4 w-4" aria-hidden />
            Full Profile
          </Link>
          <button
            type="button"
            disabled={signingOut}
            onClick={() => handleSignOut(close)}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-error hover:bg-error/10 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {signingOut ? "Signing out…" : "Sign Out"}
          </button>
        </div>
      )}
    </Dropdown>
  );
}
