import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
