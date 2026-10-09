/**
 * Guards an href sourced from CMS/promo API data before it reaches an anchor
 * or next/link `Link`. Only relative paths and http(s) URLs are allowed —
 * anything else (e.g. a `javascript:` scheme) falls back to a harmless `#`.
 */
export function safeHref(href: string): string {
  if (href.startsWith("/") || href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }
  return "#";
}
