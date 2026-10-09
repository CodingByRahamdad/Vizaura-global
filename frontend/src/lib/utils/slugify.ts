/**
 * Mirrors backend/src/modules/catalog/slugify.ts exactly, so the New
 * Product form's auto-derived slug preview matches what the backend would
 * derive if `slug` were omitted (the backend remains the source of truth —
 * this is UX preview only, always re-validated server-side).
 */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
