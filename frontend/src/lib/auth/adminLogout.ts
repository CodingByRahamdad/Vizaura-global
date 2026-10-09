import type { useRouter } from "next/navigation";
import { logout } from "@/lib/api/auth";

type Router = ReturnType<typeof useRouter>;

/**
 * The one sign-out implementation both admin call sites use (navbar profile
 * dropdown and the sidebar's bottom button) — calls the exact same
 * `logout()` the storefront account menu uses (POST /auth/logout), then
 * clears the server-rendered admin session by redirecting to /login.
 * `AdminShell` doesn't participate in `AuthContext`, so this calls the API
 * client directly rather than going through the `useAuth()` wrapper.
 */
export async function performAdminLogout(router: Router): Promise<void> {
  try {
    await logout();
  } finally {
    router.push("/login");
    router.refresh();
  }
}
