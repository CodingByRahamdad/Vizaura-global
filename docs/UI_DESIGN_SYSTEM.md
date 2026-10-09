# UI_DESIGN_SYSTEM.md

Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) first. This document records the approved visual direction and design tokens (palette, principles). It does not track which pages/components are actually built — real frontend pages exist as of Phase 5A onward; see [MODULE_STATUS.md](MODULE_STATUS.md) for the current, authoritative per-page/per-component build status.

## Brand

**VIZAURA GLOBAL** — premium, natural, modern, elegant, trustworthy, wellness/lifestyle-oriented.

Primary visual direction: **teal-green**.

## Palette

| Token | Hex | Usage |
|---|---|---|
| Primary Teal | `#0F766E` | Primary actions, links, brand accents |
| Dark Teal | `#115E59` | Hover/active states, emphasis text on light bg |
| Light Teal | `#CCFBF1` | Subtle backgrounds, badges, highlights |
| Natural Green | `#4D7C5A` | Secondary accents, natural/organic cues |
| Warm Off-White | `#FAFAF7` | Page background |
| White | `#FFFFFF` | Card/surface background |
| Deep Text | `#17201D` | Primary text |
| Secondary Text | `#66736E` | Secondary/muted text |
| Border | `#E2E8E5` | Dividers, input borders, card borders |
| Success | `#2F855A` | Success states |
| Warning | `#B7791F` | Warning states |
| Error | `#C53030` | Error states |

**Usage principle:** restrained and premium. Primary Teal and Dark Teal carry brand identity in a small number of high-intent places (primary buttons, active nav, key links). Light Teal and Natural Green are supporting accents, not backgrounds for large surfaces. Most of the UI is Warm Off-White/White with Deep/Secondary text — color is used to direct attention, not to decorate.

## Typography (principles only)

- One clean, modern sans-serif family across the app; a distinct but complementary serif/display option may be considered for storefront hero/editorial moments only.
- Clear type scale with limited steps (e.g. display, h1–h3, body, small/caption).
- Generous line-height for body copy to support a premium, uncluttered feel.

## Spacing

- Consistent spacing scale (4px/8px base unit) applied throughout; avoid ad-hoc spacing values.
- Generous whitespace around key content (product imagery, CTAs) to reinforce a premium feel.

## Border Radius

- Soft, moderate radius across cards, buttons, and inputs (not sharp, not pill-shaped by default) for a modern-but-elegant feel.

## Cards

- White surface on Warm Off-White page background, subtle Border color, soft shadow reserved for elevation/hover, not applied everywhere.

## Buttons

- Primary: Primary Teal fill, white text, Dark Teal on hover.
- Secondary: outlined or Light Teal-tinted, for lower-emphasis actions.
- Destructive actions use Error color, used sparingly and always with confirmation.

## Forms

- Clear labels, visible focus states (accessible contrast), inline validation messaging using Success/Warning/Error tokens.

## Navigation

- Clean, minimal top navigation for storefront; a structured sidebar for the admin dashboard, both using Primary/Dark Teal for active/selected states.

## Responsive Behavior

- Mobile-first layout for the storefront; admin dashboard optimized primarily for desktop/tablet with responsive fallback.

## Accessibility

- Maintain WCAG AA contrast for text and interactive elements against the chosen background colors.
- Visible focus indicators; no color-only signaling of state (pair color with icon/text).

## Imagery

- Natural, premium product photography (light, clean backgrounds) consistent with the wellness/lifestyle positioning.

## Product Cards (principle only)

- Image-forward, minimal text (name, price, key badge), consistent aspect ratio across the catalog.

## Admin Dashboard Visual Language

- Calmer, denser, data-oriented use of the same palette (more white/off-white surface, teal reserved for actions/status/emphasis, not large color blocks).

## Design References

Approved UI/UX reference images live in `design-references/`. See that directory's README — references are a visual source of truth for look/feel per page/module, but never override the functional requirements or architecture documented here and elsewhere in `docs/`.
