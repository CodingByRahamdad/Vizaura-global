import type { AuthResult } from "./auth.service.js";

/// Shape returned by register/login/me. Never includes tokens (they travel
/// only as HttpOnly cookies) or password/session internals.
export function toAuthResponse(result: AuthResult) {
  return {
    user: result.user,
    roles: result.roleKeys,
    permissions: result.permissionKeys,
  };
}
