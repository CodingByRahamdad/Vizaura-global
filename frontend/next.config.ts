import type { NextConfig } from "next";

// Server-only — proxies browser requests to the real backend so cookies are
// first-party from the browser's perspective. Source mirrors the backend's
// own /api/v1 prefix exactly: the refresh cookie's Path=/api/v1/auth
// (backend/src/security/cookies.ts) is matched by the browser against the
// REQUESTED path, not the proxy destination — a mismatched prefix here would
// silently break refresh-token delivery.
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || "https://vizaura-backend.onrender.com";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${BACKEND_ORIGIN}/api/v1/:path*`,
      },
    ];
  },
  experimental: {
    // Turbopack persists its dev compile graph across `next dev` restarts by
    // default (since Next 16.1). A restored graph can go stale/inconsistent
    // with the real route tree, causing pages to 404 after a restart even
    // though they compile fine — reproduced and confirmed as the cause of a
    // "every route 404s after restarting the dev server" incident. Disabling
    // it makes every dev start a deterministic cold compile.
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
