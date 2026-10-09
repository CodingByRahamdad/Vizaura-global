import { z } from "zod";

// Transport-layer validation only. See search.service.ts for the per-domain
// permission filtering that decides which result groups actually run.

export const globalSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
});

export type GlobalSearchQuery = z.infer<typeof globalSearchQuerySchema>;
