import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { verifyAccessToken } from "../security/jwt.js";
import { readAccessCookie } from "../security/cookies.js";
import { getPrismaClient } from "../db/prismaClient.js";
import { RbacService } from "../modules/rbac/rbac.service.js";
import { authErrors } from "../errors/AppError.js";

export interface AuthContext {
  userId: string;
  sessionId: string;
  emailVerified: boolean;
  roleKeys: string[];
  permissions: Set<string>;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

const rbacService = new RbacService();

/// Verifies the access JWT and re-derives the caller's authorization state
/// from the database. JWT claims are trusted only for identity (sub, sid) —
/// never for role, permission, verification or account status, all of which
/// are re-read here so a change (suspension, permission edit, password
/// change) takes effect immediately rather than waiting for token expiry.
/// Throws an AppError on any failure; callers decide what "no valid auth"
/// means for their route (see `authenticate` vs `optionalAuthenticate`).
async function resolveAuthContext(token: string): Promise<AuthContext> {
  let claims;
  try {
    claims = verifyAccessToken(token);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw authErrors.sessionExpired();
    }
    throw authErrors.unauthorized("Invalid access token.");
  }

  const prisma = getPrismaClient();
  const [user, session] = await Promise.all([
    prisma.user.findUnique({ where: { id: claims.sub } }),
    prisma.session.findUnique({ where: { id: claims.sid } }),
  ]);

  if (!user || user.deletedAt !== null) {
    throw authErrors.unauthorized();
  }
  if (!session || session.userId !== user.id) {
    throw authErrors.unauthorized();
  }
  if (session.revokedAt !== null) {
    throw authErrors.sessionExpired();
  }
  if (session.expiresAt.getTime() <= Date.now()) {
    throw authErrors.sessionExpired();
  }
  if (user.status === "SUSPENDED" || user.status === "DEACTIVATED") {
    throw authErrors.accountSuspended();
  }
  // Password-change / reset invalidation: any access token issued before
  // the last password change is rejected, even if it has not expired yet
  // and even if its session row has not been revoked for some reason.
  //
  // `claims.iat` is whole seconds (JWT spec); passwordChangedAt has
  // millisecond precision. Floor it to seconds before comparing, or a
  // token issued in the same second as (but after) a password change gets
  // spuriously rejected whenever passwordChangedAt's sub-second remainder
  // rounds `iat` down past it.
  if (user.passwordChangedAt) {
    const passwordChangedAtSeconds = Math.floor(user.passwordChangedAt.getTime() / 1000);
    if (claims.iat < passwordChangedAtSeconds) {
      throw authErrors.sessionExpired();
    }
  }

  const { roleKeys, permissionKeys } = await rbacService.getAuthorizationState(user.id);

  return {
    userId: user.id,
    sessionId: session.id,
    emailVerified: user.emailVerifiedAt !== null,
    roleKeys,
    permissions: new Set(permissionKeys),
  };
}

export const authenticate: RequestHandler = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token = readAccessCookie(req);
    if (!token) {
      next(authErrors.unauthorized());
      return;
    }
    req.auth = await resolveAuthContext(token);
    next();
  } catch (error) {
    next(error);
  }
};

/// Same identity/authorization resolution as `authenticate`, but a missing
/// access token is not an error — `req.auth` is simply left undefined. Used
/// by public catalog reads that behave differently for a caller who holds
/// elevated permissions (e.g. seeing draft products) without requiring every
/// storefront visitor to be signed in. A present-but-invalid token is still
/// rejected: a tampered or expired cookie should never be silently treated
/// as "anonymous".
export const optionalAuthenticate: RequestHandler = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token = readAccessCookie(req);
    if (!token) {
      next();
      return;
    }
    req.auth = await resolveAuthContext(token);
    next();
  } catch (error) {
    next(error);
  }
};
