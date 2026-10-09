import { cookies } from "next/headers";
import { apiFetch, apiFetchWithMeta } from "@/lib/api";

/**
 * Server Component-only fetch for endpoints that require the caller's
 * session — forwards the incoming request's cookies, same technique as
 * getServerSession (lib/api/auth-server.ts). No refresh-on-401 (a Server
 * Component render can't write new Set-Cookie headers back onto the
 * response, same limitation documented there) — an expired access token
 * surfaces as a 401 ApiError here, which admin pages let requireAdminPermission's
 * own session check catch on the next navigation rather than retrying.
 *
 * Used to satisfy "permission check -> data fetch" for admin Server
 * Component pages (Phase 6D): the fetch itself still runs after
 * requireAdminPermission has already redirected an unauthorized caller away.
 */
async function cookieHeader(): Promise<string> {
  const store = await cookies();
  return store.toString();
}

export async function serverApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const cookie = await cookieHeader();
  return apiFetch<T>(path, { ...init, cache: "no-store", headers: { ...init?.headers, Cookie: cookie } });
}

export async function serverApiFetchWithMeta<T>(
  path: string,
  init?: RequestInit
): Promise<{ data: T; meta: Record<string, unknown> }> {
  const cookie = await cookieHeader();
  return apiFetchWithMeta<T>(path, { ...init, cache: "no-store", headers: { ...init?.headers, Cookie: cookie } });
}
