import { NextRequest, NextResponse } from "next/server";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` — see
// node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md.
// This generates a fresh per-request nonce and sets a Content-Security-Policy
// header, which forces every matched route into dynamic rendering (required
// for nonces); this app's pages are already SSR/session-gated, so nothing
// here was statically optimized to begin with.

// Product/category/promotion images are absolute URLs served directly from
// the backend's own host (backend/src/integrations/media/local.provider.ts
// in dev/test) or from Cloudinary (backend/src/integrations/media/
// cloudinary.provider.ts, required in production) — never proxied through
// next.config.ts's rewrite. So this must resolve the backend's real origin
// even when NEXT_PUBLIC_API_BASE_URL is set to a relative path ("/api/v1",
// in production — see lib/api.ts), which `new URL()` can't parse on its
// own. API_BASE_URL_INTERNAL is always absolute.
function apiOrigin(): string {
  try {
    const raw =
      process.env.API_BASE_URL_INTERNAL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "https://vizaura-backend.onrender.com/api/v1";
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const backend = apiOrigin();

  // reCAPTCHA (src/components/ui/Recaptcha.tsx) is the only third-party
  // script; it self-inserts a <script src="https://www.google.com/...">
  // tag, which 'strict-dynamic' trusts because the inserting page bundle is
  // itself nonce'd. The explicit google.com/gstatic.com host entries are a
  // fallback for browsers that don't support strict-dynamic. Turnstile
  // (src/components/auth/Turnstile.tsx) is unused dead code, not allowlisted.
  //
  // style-src keeps 'unsafe-inline' (not nonce'd) rather than
  // style-src-attr, since Safari doesn't support style-src-attr and would
  // fall back to the main style-src rule for inline style="" attributes —
  // the one documented exception is MarketSplitPanel.tsx's single dynamic
  // inline style attribute (a computed bar-chart width %); no <style> tag
  // injection vector exists anywhere in this app.
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https://res.cloudinary.com${backend ? ` ${backend}` : ""};
    font-src 'self';
    connect-src 'self'${backend ? ` ${backend}` : ""} https://www.google.com https://www.gstatic.com;
    frame-src https://www.google.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    ${isDev ? "" : "upgrade-insecure-requests;"}
`;

  const contentSecurityPolicyHeaderValue = cspHeader.replace(/\s{2,}/g, " ").trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicyHeaderValue);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", contentSecurityPolicyHeaderValue);

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
