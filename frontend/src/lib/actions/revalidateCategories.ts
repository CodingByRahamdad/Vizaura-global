"use server";

import { revalidatePath } from "next/cache";

/**
 * Called from the admin category create/update flow right after a
 * successful save, so the storefront (which reads getCategories() with a
 * 60s revalidate window — see lib/api/catalog.ts) reflects a changed
 * image/name immediately instead of waiting out that window. Revalidates
 * the whole layout subtree, not a single path, because getCategories() is
 * read from multiple places (the storefront layout/homepage, /categories,
 * and elsewhere), the same breadth tradeoff already made in
 * revalidateProduct.ts for its own narrower case.
 */
export async function revalidateCategoriesPages(): Promise<void> {
  revalidatePath("/", "layout");
}
