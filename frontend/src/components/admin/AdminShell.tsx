"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Menu, Search, X } from "lucide-react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminGlobalSearch } from "@/components/admin/AdminGlobalSearch";
import { AdminNotificationBell } from "@/components/admin/AdminNotificationBell";
import { AdminProfileMenu } from "@/components/admin/AdminProfileMenu";
import { performAdminLogout } from "@/lib/auth/adminLogout";
import type { AdminNavLink } from "@/lib/constants/admin-nav";
import type { AuthSession } from "@/lib/types/auth";
import { cn } from "@/lib/utils/cn";

interface AdminShellProps {
  session: AuthSession;
  links: AdminNavLink[];
  children: ReactNode;
}

/**
 * Owns the mobile-drawer open/closed state for the admin shell — split out
 * of admin/layout.tsx (an async Server Component, can't hold useState) so
 * the server-side auth/permission check there stays untouched. Desktop
 * layout (fixed sidebar + fixed header + scrollable <main>) is unchanged
 * from before; this only adds the below-`md` collapsible drawer.
 */
export function AdminShell({ session, links, children }: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();

  async function handleSidebarSignOut() {
    setSigningOut(true);
    await performAdminLogout(router);
  }

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileSearchOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileSearchOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileSearchOpen]);

  return (
    <div className="md:h-dvh">
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col gap-1 overflow-y-auto bg-footer p-4 text-white transition-transform duration-200 ease-in-out md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="mb-4 flex items-center justify-between px-2">
          <div>
            <span className="font-serif text-lg font-semibold">VIZAURA GLOBAL</span>
            <p className="text-xs text-white/60">Admin Panel</p>
          </div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white md:hidden"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <AdminSidebar links={links} onNavigate={() => setMobileOpen(false)} />
        <div className="mt-auto border-t border-white/10 pt-3">
          <button
            type="button"
            disabled={signingOut}
            onClick={handleSidebarSignOut}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-white/80 transition-colors hover:bg-white/5 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden />
            {signingOut ? "Signing out…" : "Sign Out"}
          </button>
        </div>
      </aside>

      {/* left-64 matches aside's w-64 (same Tailwind spacing value) so this column starts exactly where the
          sidebar ends. min-w-0: a flex item defaults to min-width:auto, so a wide table (AdminTable is
          min-w-max) would stretch <main> instead of scrolling inside its own overflow-x-auto wrapper. */}
      <div className="flex min-w-0 flex-col md:fixed md:inset-y-0 md:right-0 md:left-64 md:z-20 md:overflow-hidden">
        {/* Always rendered (unlike the old hidden-below-md header) so the hamburger button has somewhere to
            live on mobile. Below md: hamburger + brand name (the sidebar carrying the brand is off-canvas
            there, so without this the name disappeared along with it), a search icon that opens the
            overlay below, then the bell + profile menu — all now visible on mobile instead of only on
            desktop. At md+: unchanged desktop layout (full search bar, bell, profile). */}
        <header className="flex items-center gap-2 border-b border-border bg-surface px-4 py-3 md:gap-4 md:px-6">
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((value) => !value)}
            className="rounded-full p-2 text-text-secondary hover:bg-bg md:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <span className="truncate font-serif text-base font-semibold text-text md:hidden">VIZAURA GLOBAL</span>

          <div className="hidden flex-1 items-center md:flex">
            <AdminGlobalSearch />
          </div>

          <button
            type="button"
            aria-label="Search"
            onClick={() => setMobileSearchOpen(true)}
            className="ml-auto rounded-full p-2 text-text-secondary hover:bg-bg md:hidden"
          >
            <Search className="h-5 w-5" aria-hidden />
          </button>

          {/* ml-auto only has an effect at md+ (mobile's ml-auto already sits on the search button
              above); at md+ it pushes this group to the row's true right edge — AdminGlobalSearch is
              capped at max-w-md, so without this the group sat right after the search box instead of
              at the header's far right. */}
          <div className="flex items-center gap-2 md:ml-auto">
            <AdminNotificationBell />
            <AdminProfileMenu session={session} />
          </div>
        </header>

        {mobileSearchOpen ? (
          <div className="fixed inset-x-0 top-0 z-50 flex items-center gap-2 border-b border-border bg-surface p-3 md:hidden">
            <AdminGlobalSearch className="max-w-none" />
            <button
              type="button"
              aria-label="Close search"
              onClick={() => setMobileSearchOpen(false)}
              className="shrink-0 rounded-full p-2 text-text-secondary hover:bg-bg"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        ) : null}

        <main className="flex-1 overflow-y-auto bg-bg px-5 py-6 md:px-6 md:py-8">{children}</main>
      </div>
    </div>
  );
}
