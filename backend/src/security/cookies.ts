import type { CookieOptions, Request, Response } from "express";
import { env } from "../config/env.js";

const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_MAX_AGE_MS = env.refreshToken.expiresInDays * 24 * 60 * 60 * 1000;

const REFRESH_COOKIE_PATH = "/api/v1/auth";

/// Cookie names carry the `__Secure-` prefix in production, which browsers
/// enforce must only be set with the Secure attribute over HTTPS. No `Domain`
/// is ever set: both cookies are host-only, scoped to whichever origin the
/// API is served from. See docs/AUTH_SECURITY.md.
export const ACCESS_COOKIE_NAME = env.cookies.usePrefix ? "__Secure-vz_at" : "vz_at";
export const REFRESH_COOKIE_NAME = env.cookies.usePrefix ? "__Secure-vz_rt" : "vz_rt";

function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.cookies.secure,
    sameSite: env.cookies.sameSite,
    // Deliberately omitted: Domain. Host-only cookies are the default and
    // are what allows the __Secure- prefix; see docs/AUTH_SECURITY.md for
    // when this would need to change (different registrable domains).
  };
}

export function setAccessCookie(res: Response, token: string): void {
  res.cookie(ACCESS_COOKIE_NAME, token, {
    ...baseCookieOptions(),
    path: "/",
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
  });
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...baseCookieOptions(),
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE_NAME, { ...baseCookieOptions(), path: "/" });
  res.clearCookie(REFRESH_COOKIE_NAME, { ...baseCookieOptions(), path: REFRESH_COOKIE_PATH });
}

export function readAccessCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[ACCESS_COOKIE_NAME];
}

export function readRefreshCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[REFRESH_COOKIE_NAME];
}
