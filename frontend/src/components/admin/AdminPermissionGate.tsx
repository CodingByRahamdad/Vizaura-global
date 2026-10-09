"use client";

import type { ReactNode } from "react";
import { hasAllPermissions, hasAnyPermission } from "@/lib/authorization";
import type { PermissionKey } from "@/lib/constants/permissions";

interface AdminPermissionGateProps {
  /** The session's permission list — pass session.permissions from a client AuthContext or a prop threaded down from a Server Component. */
  permissions: string[];
  require: PermissionKey | PermissionKey[];
  /** "any" (default) or "all" when `require` is an array. */
  mode?: "any" | "all";
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Client-side conditional rendering only (button/action visibility) — never
 * the actual authorization boundary. The backend re-checks every request's
 * permission independently (see requireAdminPermission.ts, AUTH_SECURITY.md);
 * this only avoids showing an action a caller can't actually perform.
 */
export function AdminPermissionGate({ permissions, require, mode = "any", children, fallback = null }: AdminPermissionGateProps) {
  const keys = Array.isArray(require) ? require : [require];
  const source = { permissions };
  const allowed = mode === "all" ? hasAllPermissions(source, keys) : hasAnyPermission(source, keys);
  return allowed ? <>{children}</> : <>{fallback}</>;
}
