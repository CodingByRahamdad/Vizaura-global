"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { useAuth } from "@/context/AuthContext";

export function AccountMenu() {
  const { status, user, logout } = useAuth();
  const router = useRouter();

  if (status !== "authenticated" || !user) {
    return (
      <Link
        href="/login"
        aria-label="Account"
        title="Account"
        className="flex h-10 w-10 items-center justify-center rounded-md text-text hover:bg-primary-light/50"
      >
        <User className="h-5 w-5" aria-hidden />
      </Link>
    );
  }

  async function handleLogout(close: () => void) {
    await logout();
    close();
    router.push("/");
  }

  return (
    <Dropdown
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label={`Account menu for ${user.firstName}`}
          title="Account"
          className="flex h-10 w-10 items-center justify-center rounded-md text-text hover:bg-primary-light/50"
        >
          <User className="h-5 w-5" aria-hidden />
        </button>
      )}
      panelClassName="right-0 w-56 py-2"
    >
      {({ close }) => (
        <div>
          <div className="border-b border-border px-4 py-2">
            <p className="truncate text-sm font-medium text-text">
              {user.firstName} {user.lastName}
            </p>
            <p className="truncate text-xs text-text-secondary">{user.email}</p>
          </div>
          <Link
            href="/account"
            onClick={close}
            className="block px-4 py-2 text-sm text-text hover:bg-primary-light/40 hover:text-primary-dark"
          >
            My Account
          </Link>
          <button
            type="button"
            onClick={() => handleLogout(close)}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-error hover:bg-error/10"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Logout
          </button>
        </div>
      )}
    </Dropdown>
  );
}
