"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getMeWithRefresh, logout as logoutRequest } from "@/lib/api/auth";
import { hasAllPermissions, hasAnyPermission, hasAdminAccess as hasAdminAccessOf, hasPermission } from "@/lib/authorization";
import type { PermissionKey } from "@/lib/constants/permissions";
import type { AuthSession, PublicUser } from "@/lib/types/auth";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  status: AuthStatus;
  user: PublicUser | null;
  roles: string[];
  permissions: string[];
}

interface AuthContextValue extends AuthState {
  /** Adopts a session the caller already has (e.g. right after login/register), no extra request. */
  setSession: (session: AuthSession) => void;
  /** Re-checks the session with the backend (e.g. after an action that might have changed it). */
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Permission-based UX checks only — wrap lib/authorization.ts's pure
   * predicates over this context's own `permissions`. The backend
   * independently re-checks every request; these never substitute for that.
   */
  can: (key: PermissionKey) => boolean;
  canAny: (keys: PermissionKey[]) => boolean;
  canAll: (keys: PermissionKey[]) => boolean;
  hasAdminAccess: boolean;
}

const initialState: AuthState = {
  status: "loading",
  user: null,
  roles: [],
  permissions: [],
};

const AuthContext = createContext<AuthContextValue>({
  ...initialState,
  setSession: () => {},
  refreshSession: async () => {},
  logout: async () => {},
  can: () => false,
  canAny: () => false,
  canAll: () => false,
  hasAdminAccess: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState);

  const applySession = useCallback((session: AuthSession | null) => {
    setState(
      session
        ? {
            status: "authenticated",
            user: session.user,
            roles: session.roles,
            permissions: session.permissions,
          }
        : { status: "unauthenticated", user: null, roles: [], permissions: [] }
    );
  }, []);

  const refreshSession = useCallback(async () => {
    const session = await getMeWithRefresh();
    applySession(session);
  }, [applySession]);

  useEffect(() => {
    let cancelled = false;

    getMeWithRefresh().then((session) => {
      if (!cancelled) applySession(session);
    });

    return () => {
      cancelled = true;
    };
  }, [applySession]);

  const setSession = useCallback(
    (session: AuthSession) => {
      applySession(session);
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      // Logout is idempotent/best-effort server-side (see docs/CURRENT_TASK.md) —
      // always clear local state so the UI never keeps showing a signed-in user.
      applySession(null);
    }
  }, [applySession]);

  const can = useCallback((key: PermissionKey) => hasPermission(state, key), [state]);
  const canAny = useCallback((keys: PermissionKey[]) => hasAnyPermission(state, keys), [state]);
  const canAll = useCallback((keys: PermissionKey[]) => hasAllPermissions(state, keys), [state]);
  const adminAccess = useMemo(() => hasAdminAccessOf(state), [state]);

  return (
    <AuthContext.Provider
      value={{ ...state, setSession, refreshSession, logout, can, canAny, canAll, hasAdminAccess: adminAccess }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
