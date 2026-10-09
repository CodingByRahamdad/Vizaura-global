import { ApiError } from "@/lib/api";
import { refreshOnce } from "@/lib/api/auth";

/**
 * Shared by any authenticated-endpoint service layer (cart, wishlist, …):
 * on a 401, attempt exactly one refresh (via the concurrency-safe
 * refreshOnce() from lib/api/auth.ts) and retry exactly once. If that still
 * fails, the original 401 is rethrown so the caller can treat it as a real
 * logout instead of looping. Extracted from lib/api/cart.ts (Phase 5B-2B)
 * so lib/api/wishlist.ts reuses the exact same mechanism rather than a
 * second, duplicated implementation — Cart's own behavior is unchanged by
 * this extraction.
 */
export async function withAuthRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      try {
        await refreshOnce();
        return await fn();
      } catch {
        throw error;
      }
    }
    throw error;
  }
}
