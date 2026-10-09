import type { NextFunction, Request, RequestHandler, Response } from "express";
import { authErrors } from "../errors/AppError.js";

/// Requires the authenticated caller to hold ALL of the given permission
/// keys. Must run after `authenticate`. There is no role-name check anywhere
/// — this is a set-membership test against permissions loaded fresh from the
/// database for this request.
export function requirePermission(...permissionKeys: string[]): RequestHandler {
  return requireAllPermissions(permissionKeys);
}

export function requireAllPermissions(permissionKeys: string[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(authErrors.unauthorized());
      return;
    }
    const missing = permissionKeys.filter((key) => !req.auth!.permissions.has(key));
    if (missing.length > 0) {
      next(authErrors.forbidden({ requiredPermissions: permissionKeys, missing }));
      return;
    }
    next();
  };
}

export function requireAnyPermission(permissionKeys: string[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(authErrors.unauthorized());
      return;
    }
    const hasAny = permissionKeys.some((key) => req.auth!.permissions.has(key));
    if (!hasAny) {
      next(authErrors.forbidden({ requiredAnyOf: permissionKeys }));
      return;
    }
    next();
  };
}
