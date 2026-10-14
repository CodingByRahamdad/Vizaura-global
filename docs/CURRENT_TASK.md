# CURRENT_TASK.md

> This file always reflects the single active task. Keep it focused (see [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md), rule 20).

**Task:** Fixed admin image uploads not persisting in production — product/category/promotion images were written to local disk on the backend (Render), which doesn't survive a redeploy/restart/multi-instance scaling, so every uploaded image eventually 404ed. Migrated to a `MediaProvider` abstraction (Cloudinary required in production, local disk kept as the dev/test default) and fixed a resulting CSP gap (Cloudinary images, served from `res.cloudinary.com`, weren't yet allowlisted in the frontend's `img-src`). The user's pasted request also diagnosed a "Tailwind/layout discrepancy" between localhost and Vercel — investigation found this codebase has no `tailwind.config.ts`/content array and no dynamic Tailwind class strings to fix; the user confirmed what they were actually seeing was the broken images, i.e. the same root cause, not a CSS purge bug.

**Status:** Code/typecheck-level changes complete. Prisma migration `add_product_media_public_id` applied against the dev database (or pending — see Verification below for the exact outcome). Needs a manual Render env var change (`MEDIA_PROVIDER=cloudinary` + `CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET`) to take effect in production, and existing `/uploads/...` image URLs already in the database are permanently broken (source files no longer exist) — affected products/categories/promotions need their images re-uploaded manually once Cloudinary is live.

## Decisions made (confirmed with user before implementing)

1. Storage provider: **Cloudinary** (over S3/Vercel Blob) — free tier, CDN+transforms built in, and the backend runs on Render (not Vercel), so Vercel Blob would add a cross-provider dependency just for storage.
2. Dev/test behavior: **keep local-disk storage as the dev/test default**, Cloudinary required only in production — mirrors the existing `integrations/email/` console-vs-Brevo split and the `MOCK` payment provider's production-only gate, and keeps `npm test` free of any external network dependency.
3. Declined the pasted request's Tailwind `content`-array fix and Express body-size-limit increase: this project's Tailwind 4 setup is CSS-native (no JS config, no dynamic class strings found anywhere), and `express.json`'s limit is irrelevant to multer's multipart handling (which has its own 5MB limit, unchanged). The user confirmed the real "UI discrepancy" was the broken images, not a CSS/layout bug.

## What was built

**Backend:**
- New `backend/src/integrations/media/` — `MediaProvider` interface (`media.types.ts`), `CloudinaryMediaProvider` (buffer → `cloudinary.uploader.upload_stream`, never touches disk), `LocalMediaProvider` (the old disk-write behavior, adapted — relative URL, `publicId` = that same relative path), and a factory (`index.ts#getMediaProvider()`) choosing by `env.media.provider`. Deleted `backend/src/modules/catalog/mediaStorage.ts` — absorbed into this module.
- `backend/src/modules/catalog/mediaUpload.middleware.ts` — `multer.diskStorage` → `multer.memoryStorage()` for all three upload middlewares; validation (MIME allowlist, 5MB limit, error translation) unchanged. Added `extensionFor()`/`toAbsoluteMediaUrl()` helpers (the latter passes an already-absolute Cloudinary URL through unchanged, or prefixes a relative local-disk URL with the request's own protocol/host, exactly like the old `buildXMediaUrl` helpers did).
- `categories.controller.ts#uploadImage`, `promotions.controller.ts#uploadImage`, `variants.controller.ts#uploadMedia` now call `getMediaProvider().upload(...)` instead of building a local `/uploads/...` URL directly.
- `ProductMedia` gained a nullable `mediaPublicId` column (migration `add_product_media_public_id`) — set only for rows created via upload (by either provider), used by `variants.controller.ts#removeMedia` to delete the right asset from whichever provider created it. Category/Promotion image deletion was never wired to file cleanup before this change and still isn't (pre-existing gap, not a regression).
- `backend/src/config/env.ts` / `backend/.env.example` — new `MEDIA_PROVIDER`/`CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET`, required in production via the same `superRefine` pattern as `DATABASE_URL`/`APP_URL`; local is explicitly refused in production.
- `backend/src/app/app.ts` — updated the `/uploads` static mount's comment (it now only ever serves the local dev/test provider's output).
- `backend/package.json` — added `cloudinary` dependency.
- Tests: `catalog.media.test.ts`/`catalog.categories.media.test.ts` re-pointed their `*_UPLOAD_DIR` import to the new `integrations/media/local.provider.ts`; added a new case asserting `mediaPublicId` is set on an uploaded row and `null` on a URL-pasted row.

**Frontend:**
- `frontend/src/proxy.ts` — added `https://res.cloudinary.com` to the CSP's `img-src` (Cloudinary images are a different origin than the backend, which was the only host previously allowlisted). This was a gap found during implementation, not in the original request.

**Docs:** `docs/modules/CATALOG.md`, `docs/MODULE_STATUS.md`, this file, and `docs/CHANGELOG.md` updated.

## Verification performed

- `backend`: `npm run build` (prisma generate + tsc) clean, `npm run lint` clean. `npm test`: 697/701 passing. The 4 failures (`catalog.products.test.ts`, `customers.test.ts`, `catalog.categories.admin.test.ts`, `requireCaptcha.test.ts`) are the same pre-existing, unrelated failures already called out in the 2026-10-14 "Cross-domain cookie fix" changelog entry — none touch media/catalog-upload code. Both new/changed media test files (`catalog.media.test.ts`, `catalog.categories.media.test.ts`, 13 tests total, including the new `mediaPublicId` case) pass.
- `frontend`: `npm run lint` and `npm run typecheck` both clean.
- Prisma migration `add_product_media_public_id` applied via `npx prisma migrate dev` against the Neon dev database (`DATABASE_URL`), and via `npx prisma migrate deploy` (with `DATABASE_URL` temporarily pointed at `DATABASE_URL_TEST`) against the local test database — `migrate dev`/`deploy` always read `DATABASE_URL` from `prisma.config.ts`, never `DATABASE_URL_TEST` automatically, so the test database needed a separate explicit apply before `npm test` could pass.
- Not run: a real Cloudinary upload smoke test (no credentials configured in this environment) — the local-provider path is what's covered by the automated tests above.

## Not performed — requires user action / cannot be done in this environment

- **Manual Render dashboard change (required for this fix to take effect in production)**: set `MEDIA_PROVIDER=cloudinary`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (from a Cloudinary account's dashboard) in the backend's production environment, then redeploy. Without this, production continues to fail to boot once this code ships, since the local provider is refused there.
- **End-to-end verification on a real deploy** (no browser tool available here): upload a product/category/promotion image in the live admin UI, confirm the returned URL is `https://res.cloudinary.com/...`, and confirm it still renders after a Render redeploy (the actual regression this fix addresses).
- **Manual data cleanup**: any existing `imageUrl`/`url` DB rows still pointing at `/uploads/...` paths from before this fix are permanently broken (the files no longer exist) — no automated migration is possible; affected images need to be re-uploaded through the admin UI once Cloudinary is live.

## Previous task (for reference — superseded by the one above)

Fixed the `/admin/dashboard` redirect loop that persisted after the earlier same-day `COOKIE_SAMESITE=none` fix, by making the frontend talk to its own origin for all API calls (same-origin Vercel rewrite) instead of the backend's cross-origin URL, so cookies become first-party regardless of `SameSite`/third-party cookie policy. COMPLETE at the code/typecheck level; needs a manual Vercel env var change + a preview/production deploy to verify end-to-end. Full details were in this file's previous version — see `docs/CHANGELOG.md`'s 2026-10-14 "Same-origin API proxy" entry.
