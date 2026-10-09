import type { NextFunction, Request, RequestHandler, Response } from "express";
import { env } from "../config/env.js";
import { authErrors } from "../errors/AppError.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function parseOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/// Cookie-based auth needs CSRF protection independent of HttpOnly.
/// SameSite=Lax already blocks the cookie on cross-site requests, but this is
/// defence in depth for anything that slips past it (e.g. a same-site
/// sibling subdomain compromise): every mutating request must present an
/// Origin/Referer matching the configured frontend, AND a custom header that
/// a cross-site form post cannot attach without triggering a CORS preflight
/// this API will refuse. No token store is needed because both checks are
/// stateless. See docs/AUTH_SECURITY.md.
export const csrfProtection: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const allowedOrigin = parseOrigin(env.frontendUrl);
  const requestOrigin = parseOrigin(req.headers.origin) ?? parseOrigin(req.headers.referer);

  if (!allowedOrigin || !requestOrigin || requestOrigin !== allowedOrigin) {
    next(authErrors.csrfFailed());
    return;
  }

  const customHeader = req.headers[env.csrfHeaderName];
  if (customHeader === undefined) {
    next(authErrors.csrfFailed("Missing required request header."));
    return;
  }

  next();
};
