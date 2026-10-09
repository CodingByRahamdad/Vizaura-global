import rateLimit, { ipKeyGenerator, type Options } from "express-rate-limit";
import type { Request, RequestHandler } from "express";
import { env } from "../config/env.js";
import { authErrors } from "../errors/AppError.js";
import { errorResponse } from "../utils/apiResponse.js";
import { ErrorCodes } from "../errors/errorCodes.js";

// In-memory store (express-rate-limit's default). No Redis in this phase.
//
// KNOWN LIMITATION: counters are per-process. Running N instances behind a
// load balancer yields roughly N x the intended limit, and every deploy
// resets all counters. Acceptable for a single-instance MVP. Before
// horizontally scaling, prefer (in order): Cloudflare edge rate limiting
// (already in the stack for Turnstile, no new infrastructure), a
// Postgres-backed counter table, then Redis — which stays out of scope
// unless explicitly approved. See docs/AUTH_SECURITY.md.

const sharedHandler: Options["handler"] = (req, res) => {
  const retryAfterHeader = res.getHeader("Retry-After");
  const retryAfterSeconds =
    typeof retryAfterHeader === "string" ? Number.parseInt(retryAfterHeader, 10) : undefined;
  const error = authErrors.rateLimited(retryAfterSeconds);
  res.status(error.httpStatus).json(errorResponse(ErrorCodes.AUTH_RATE_LIMITED, error.message, error.details));
};

function byIp(req: Request): string {
  return ipKeyGenerator(req.ip ?? "unknown");
}

function byEmail(req: Request): string {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" ? `email:${email.toLowerCase()}` : byIp(req);
}

function byAuthenticatedUser(req: Request): string {
  return req.auth ? `user:${req.auth.userId}` : byIp(req);
}

function limiter(options: { windowMs: number; limit: number; keyGenerator?: (req: Request) => string }): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: sharedHandler,
    skip: () => !env.rateLimitEnabled,
    keyGenerator: options.keyGenerator ?? byIp,
  });
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export const loginIpLimiter = limiter({ windowMs: 15 * MINUTE, limit: 10, keyGenerator: byIp });
export const loginEmailLimiter = limiter({ windowMs: 15 * MINUTE, limit: 5, keyGenerator: byEmail });
export const registerLimiter = limiter({ windowMs: HOUR, limit: 5, keyGenerator: byIp });
export const forgotPasswordIpLimiter = limiter({ windowMs: HOUR, limit: 3, keyGenerator: byIp });
export const forgotPasswordEmailLimiter = limiter({ windowMs: HOUR, limit: 3, keyGenerator: byEmail });
export const resetPasswordLimiter = limiter({ windowMs: HOUR, limit: 5, keyGenerator: byIp });
export const verifyEmailLimiter = limiter({ windowMs: HOUR, limit: 10, keyGenerator: byIp });
export const resendVerificationLimiter = limiter({
  windowMs: HOUR,
  limit: 3,
  keyGenerator: byAuthenticatedUser,
});
export const refreshLimiter = limiter({ windowMs: 15 * MINUTE, limit: 60, keyGenerator: byIp });
// Admin-initiated password reset (users.routes.ts) — throttles one admin
// account mass-triggering reset emails, same keying as resendVerificationLimiter.
export const adminResetPasswordLimiter = limiter({ windowMs: HOUR, limit: 10, keyGenerator: byAuthenticatedUser });
export const defaultLimiter = limiter({ windowMs: 15 * MINUTE, limit: 300, keyGenerator: byIp });
export const contactIpLimiter = limiter({ windowMs: HOUR, limit: 5, keyGenerator: byIp });
// Keyed by authenticated user, not IP — the review submission route always
// runs after `authenticate`, so this is a stronger guard against a single
// abusive account than IP-keying (which a NAT/shared office IP would weaken).
export const reviewSubmitLimiter = limiter({ windowMs: HOUR, limit: 10, keyGenerator: byAuthenticatedUser });
