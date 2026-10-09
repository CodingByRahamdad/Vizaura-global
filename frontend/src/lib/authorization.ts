import type { PermissionKey } from "@/lib/constants/permissions";

/**
 * Pure, framework-agnostic permission predicates — usable from both a
 * Server Component (given an AuthSession from getServerSession()) and
 * AuthContext (given its own client-side state), so the check logic exists
 * exactly once. Mirrors the backend's own requirePermission/
 * requireAnyPermission shape (backend/src/middleware/requirePermission.ts):
 * a Set-membership test, never a role-name comparison.
 */
type PermissionSource = { permissions: string[] } | null | undefined;

export function hasPermission(source: PermissionSource, key: PermissionKey): boolean {
  if (!source) return false;
  return source.permissions.includes(key);
}

export function hasAnyPermission(source: PermissionSource, keys: PermissionKey[]): boolean {
  if (!source || keys.length === 0) return false;
  const granted = new Set(source.permissions);
  return keys.some((key) => granted.has(key));
}

export function hasAllPermissions(source: PermissionSource, keys: PermissionKey[]): boolean {
  if (!source) return false;
  const granted = new Set(source.permissions);
  return keys.every((key) => granted.has(key));
}

/**
 * Whether the account can enter the admin area at all — derived from the
 * backend's own invariant (backend/prisma/seed.ts) that the default
 * `customer` role is seeded with permissions: [] and every staff role has
 * at least one. This is a permission-set check, not a role-name check —
 * there is no `role === "admin"` comparison here or anywhere else in this
 * codebase (mirrors the backend's own stated design principle).
 */
export function hasAdminAccess(source: PermissionSource): boolean {
  return !!source && source.permissions.length > 0;
}
