/// Derives a URL-safe slug from a display name. Used only as a fallback when
/// the caller does not supply an explicit slug; validation of the final
/// value (explicit or derived) always happens through the Zod slug schema.
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
