import { cookies } from "next/headers";
import { apiFetch } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import type { AuthSession } from "@/lib/types/auth";

/**
 * Server Component / layout use only — forwards the incoming request's
 * cookies to the backend's GET /auth/me. Deliberately does not attempt a
 * refresh (unlike the client-side getMeWithRefresh): a refresh here would
 * need to write new Set-Cookie headers back onto the response, which a
 * layout render cannot do. An expired access token simply reads as
 * unauthenticated server-side; the client-side AuthProvider's own
 * getMeWithRefresh call (which can retry) is what actually recovers the
 * session on the client after this server-side redirect.
 */
export async function getServerSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (!cookieHeader) return null;

  try {
    return await apiFetch<AuthSession>(ENDPOINTS.auth.me, {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    });
  } catch {
    return null;
  }
}
