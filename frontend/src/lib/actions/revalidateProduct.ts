"use server";

import { revalidatePath } from "next/cache";

/**
 * Narrowly scoped to the variant create/delete admin flows (Phase 6R) —
 * those are the flows this fix is actually about. Other admin mutations
 * (pricing, media, categories, markets) keep the existing revalidate:60
 * window on getProductBySlug; broadening this to every mutation would be a
 * separate, cross-cutting change.
 */
export async function revalidateProductPage(slug: string): Promise<void> {
  revalidatePath(`/products/${slug}`);
}
