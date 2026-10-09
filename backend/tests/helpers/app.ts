import { createApp } from "../../src/app/app.js";
import { env } from "../../src/config/env.js";

export function buildTestApp() {
  return createApp();
}

export function csrfHeaders(): Record<string, string> {
  return {
    Origin: env.frontendUrl,
    [env.csrfHeaderName]: "1",
  };
}

/// Parses `Set-Cookie` response headers into a simple name->value map (values
/// only, attributes discarded) for chaining into the next request's Cookie
/// header.
export function parseSetCookies(setCookieHeader: string[] | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const raw of setCookieHeader ?? []) {
    const [pair] = raw.split(";");
    const eqIndex = pair.indexOf("=");
    if (eqIndex === -1) continue;
    const name = pair.slice(0, eqIndex).trim();
    const value = pair.slice(eqIndex + 1).trim();
    cookies[name] = value;
  }
  return cookies;
}

export function toCookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

/// True when a Set-Cookie entry clears the named cookie (Max-Age=0 or an
/// expiry in the past), which is how logout/rotation invalidation is
/// asserted in tests.
export function isCookieCleared(setCookieHeader: string[] | undefined, name: string): boolean {
  return (setCookieHeader ?? []).some(
    (raw) => raw.startsWith(`${name}=`) && (raw.includes("Max-Age=0") || /Expires=.*1970/.test(raw)),
  );
}
