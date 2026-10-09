import helmet from "helmet";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { env } from "../config/env.js";

/// This API only ever returns JSON, so a minimal, restrictive CSP is
/// correct here. The storefront's own CSP (inline scripts, images, fonts
/// etc.) is a frontend-phase concern and is deliberately not specified.
export const securityHeaders: RequestHandler = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: env.isProduction ? { maxAge: 15552000, includeSubDomains: true } : false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  crossOriginResourcePolicy: { policy: "same-site" },
});

/// Every authenticated or auth-adjacent response carries credentials/PII and
/// must never be cached by a shared or browser cache.
export function noStore(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Cache-Control", "no-store");
  next();
}
