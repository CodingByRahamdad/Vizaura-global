# CURRENT_TASK.md

> This file always reflects the single active task. Keep it focused (see [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md), rule 20).

**Task:** Rebuilt the Cart page (`/cart`) to match a provided design spec + reference image (hero banner, two-column Shopping Cart + Order Summary, "You Might Also Like" recommendations), entirely on top of the existing cart/pricing/inventory/shipping/checkout/wishlist backend.

**Status:** COMPLETE at the code/API/test level. Backend `tsc --noEmit`/`npm run lint` clean, `tests/integration/cart.test.ts` re-run: 36/36 passing. Frontend `tsc --noEmit`/`npm run lint` clean. Both dev servers confirmed serving the rebuilt page (hero text and empty-cart state fetched via `curl`) with no server error. Manual browser QA not performed (no browser tool in this environment — see below).

## Decisions made (confirmed with user before implementing)

1. **Coupon/discount-code UI** = omitted entirely. The design reference shows a "Have a discount code?" field, but audit found no coupon/promo-code backend exists anywhere in the project — `checkout.service.ts` explicitly throws `couponUnsupported()` if a code is ever passed, and the only "promotion" concept is marketing banners, not redeemable codes. Building a real coupon system was judged out of scope for a visual redesign task.
2. **Cart line original-price/discount-%** = backend extended to expose it (not faked on the frontend). `resolveEffectivePrice()` in the pricing service already resolves both the pre-sale amount and the effective (sale) amount internally; `CartItemView` just didn't surface them. Extended `cart.mapper.ts`/`cart.service.ts`/`cart.repository.ts` to expose `originalAmount`/`discountPercent` (only non-null while a sale is actually active), using the same rounding formula the storefront's product-card discount badge already uses.

## What was built

**1. Backend (`backend/src/modules/cart/`) — additive, no schema migration.**
- `cart.repository.ts`: `cartWithItemsInclude` now also includes each line's `product.media` (ordered `isPrimary desc, position asc`, `take: 1`) — the same primary-image pattern `catalog/products.repository.ts` already uses.
- `cart.mapper.ts`: `CartItemView` gained `productId`, `productSlug`, `productName`, `variantTitle`, `imageUrl`, `originalAmount`, `discountPercent`.
- `cart.service.ts#buildItemView`: populates the new fields from data already joined/resolved per line (no new query) — `originalAmount`/`discountPercent` only set when `resolveEffectivePrice().isOnSale` is true.
- `frontend/src/lib/types/cart.ts`: mirrored verbatim.

**2. Frontend.**
- `components/cart/CartHero.tsx` + `cartHeroContent.ts` (new) — full-bleed hero banner ("YOUR CART" / "Good Things Are Worth the Wait" / subtext over an image), following the exact same static-content-function precedent as `catalog/ShopHero.tsx`/`shopHeroContent.ts` (no CMS/Banner model backs cart-specific content yet).
- `app/(storefront)/cart/page.tsx` — renders `<CartHero />` full-width above the container, drops the old plain heading.
- `components/cart/CartView.tsx` (rebuilt) — two-column layout:
  - Left "Shopping Cart" card: header (title + item count + "Continue Shopping →"), a Product/Price/Quantity/Total table-header strip, redesigned item rows (thumbnail, product name linking to the PDP, variant subtitle, a stock pill driven by the existing real `isAvailable`/`isInStock` flags, current price + struck-through original + "Save N%" badge when a sale is active, the existing `QuantityStepper` wired to `updateItem`, line total, remove button wired to `removeItem`), "Clear Cart" retained.
  - Right "Order Summary" card: subtotal, a shipping row computed the same way `CheckoutView.tsx` already does (fetch `getShippingMethods(marketCode)`, compare the real `freeShippingThreshold` against `cart.subtotalAmount` — no new formula), total, a free-shipping notice using that same real threshold, a "Proceed to Checkout →" button that just navigates to `/checkout` (Checkout independently re-reads the same shared `useCartWishlist()` cart — no payload passed, no new checkout logic), and a static trust-indicator row (Secure Checkout / Easy Returns / 24/7 Support — no backend content source exists for this copy).
  - No coupon section (per decision #1 above).
  - All loading/error/empty/unauthenticated states and "Clear Cart" kept as they already were.
- `components/cart/CartRecommendations.tsx` (new) — no per-cart recommendation endpoint exists in Catalog (confirmed by audit); reuses the same `getProductCards()` call `RelatedProducts.tsx` already makes on the product detail page (without a single-category filter, since a cart can span many categories), excludes products already in the cart, renders through the existing `ProductCard` grid unchanged — wishlist heart, rating, price/compare-at, and Add to Cart all come for free.

## Verification performed

Backend: `tsc --noEmit` and `npm run lint` clean. `npx vitest run tests/integration/cart.test.ts` — 36/36 passing (no existing test asserted the full `CartItemView` shape, so none needed updating).

Frontend: `tsc --noEmit` and `npm run lint` clean.

Live: both dev servers (already running) confirmed serving the rebuilt page — `GET /api/v1/health` returned `ok`, and `curl http://localhost:3000/cart` returned the new hero copy ("Good Things" / "Your natural wellness journey is just a step away.") and the empty-cart `EmptyState` with no server error.

## Not performed — genuinely blocked

- Interactive browser QA: logging in as a seeded customer, adding real products (including one on an active sale) to the cart, and visually confirming the populated two-column layout against the reference image, the real free-shipping threshold for both PKR and AED, the "Proceed to Checkout" → Checkout handoff, "You Might Also Like" exclusion logic, and mobile stacking/no-horizontal-scroll. No headless-browser tool (`chromium-cli`, Playwright, Puppeteer) is available in this environment, and installing one wasn't part of the approved plan. The manual end-to-end steps from the implementation plan have not been run against a live browser session — recommend the user open `http://localhost:3000/cart` themselves to confirm visual fidelity.
