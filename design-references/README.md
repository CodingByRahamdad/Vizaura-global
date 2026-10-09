# Design References

This directory holds approved UI/UX reference images for VIZAURA GLOBAL, organized by page/module as they are added.

These images are a **visual source of truth** for look and feel — colors, layout style, spacing, tone — for their corresponding pages/modules.

They **must not override** the functional requirements or architecture documented in `docs/` (e.g. [../docs/UI_DESIGN_SYSTEM.md](../docs/UI_DESIGN_SYSTEM.md), [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)). Where a reference image conflicts with documented architecture, security, or data requirements, the documentation wins and the conflict should be flagged rather than silently resolved by copying the image.

## Current references

| File | Page |
|---|---|
| `Homepage.png` | Home — also the canonical source for the global color/branding system |
| `product-page.png` | Product detail |
| `Cart.png` | Cart |
| `Wishlist-page.png` | Account → Wishlist |
| `Blog-page.png` | Blog listing |
| `Customer-account page.png` | Account dashboard |
| `Login page.png` | Login |
| `Sign-up page.png` | Register |
| `Dashboard.png` | Admin dashboard |
| `contact-us.png` | Contact |
| `shop page.png` | Shop / product listing (`/products`) — used as the reference for the Phase 5C-2 Shop page rebuild |
| `ChatGPT Image Sep 15, 2026, 01_50_23 AM.png` | Loose brand/hero asset, not a page mockup |

No dedicated Categories or About mockup exists. Those pages' layout is derived conservatively from Home + Product + the design tokens in `docs/UI_DESIGN_SYSTEM.md`, per the project's own fallback rule — update this file if dedicated references for them are added later.
