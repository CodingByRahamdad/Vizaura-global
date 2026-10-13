# CURRENT_TASK.md

> This file always reflects the single active task. Keep it focused (see [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md), rule 20).

**Task:** Fixed the `/admin/dashboard` redirect loop that persisted after the earlier same-day `COOKIE_SAMESITE=none` fix, by making the frontend talk to its own origin for all API calls (same-origin Vercel rewrite) instead of the backend's cross-origin URL, so cookies become first-party regardless of `SameSite`/third-party cookie policy.

**Status:** COMPLETE at the code/typecheck level. Needs a manual Vercel env var change + a preview/production deploy to verify end-to-end (no browser tool available in this environment).

## Decisions made (confirmed with user before implementing)

1. Confirmed `COOKIE_SAMESITE=none` was already set in Render and the loop still happened — ruled out relying on `SameSite` alone, proceeded with the rewrite.
2. Rejected the user's originally proposed rewrite prefix (`/api/backend/:path*` → `.../api/v1/:path*`): it would have silently broken the refresh-token cookie's `Path=/api/v1/auth` matching (browsers match `Path` against the requested URL, not the proxy destination). The rewrite's `source` mirrors the backend's own `/api/v1` prefix exactly instead.
3. Kept `API_BASE_URL` environment-aware (client vs. server) rather than making it fully relative everywhere, since Server Component `fetch()` calls (no browsing context) can't resolve a relative URL.

## What was built

**Frontend only — no backend changes.**
- `frontend/next.config.ts` — added `rewrites()`: `/api/v1/:path*` → `${BACKEND_ORIGIN}/api/v1/:path*`.
- `frontend/src/lib/api.ts` — `API_BASE_URL` now branches on `typeof window === "undefined"`: server-side resolves the absolute `API_BASE_URL_INTERNAL`; client-side resolves `NEXT_PUBLIC_API_BASE_URL` (now `/api/v1`, relative, in production).
- `frontend/src/proxy.ts` — `apiOrigin()` (used for the CSP's `img-src`/`connect-src`) now resolves from the always-absolute `API_BASE_URL_INTERNAL` first, since uploaded product/category/promotion images are absolute URLs served directly from the backend and are never proxied by the rewrite. This was a real bug caught during implementation: with the old logic, a relative `NEXT_PUBLIC_API_BASE_URL` would have made `new URL()` throw, silently dropping the backend host from the CSP allowlist and blocking all images in production.
- `frontend/.env.example` — documented the two new server-only vars (`BACKEND_ORIGIN`, `API_BASE_URL_INTERNAL`); local dev env var unchanged.
- `docs/CHANGELOG.md` — new entry.

Audited (no change needed): `frontend/src/lib/api/admin/{products,categories-mutations,promotions-mutations}.ts` each duplicate the same `API_BASE_URL` fallback pattern for file uploads — they already read `NEXT_PUBLIC_API_BASE_URL` first, so they'll automatically pick up the relative path once it's set in Vercel. `frontend/src/lib/api/auth-server.ts`/`server-fetch.ts` — already forward cookies manually server-to-server, unaffected.

## Verification performed

`frontend`: `npm run typecheck` clean. `npm run lint` run (see latest output). `npm run build` not yet run in this session.

## Not performed — requires user action / cannot be done in this environment

- **Manual Vercel dashboard change (required for this fix to take effect in production)**: set `NEXT_PUBLIC_API_BASE_URL=/api/v1`, `BACKEND_ORIGIN=https://vizaura-backend.onrender.com`, and `API_BASE_URL_INTERNAL=https://vizaura-backend.onrender.com/api/v1` in both Production and Preview env vars, then redeploy.
- **End-to-end verification on a real deploy** (no browser tool available here): log in as admin, confirm no redirect loop; DevTools Network tab shows `/api/v1/auth/*` requests going to the frontend's own origin; DevTools Application/Cookies shows `__Secure-vz_at`/`__Secure-vz_rt` under the frontend's own domain with correct `Path`; confirm product/category/promotion images still render (the CSP fix above); smoke-test a non-admin flow (storefront, `/account`) for regressions.
