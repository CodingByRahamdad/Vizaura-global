import { z } from "zod";

// Transport-layer validation only. See docs/modules/MARKETS.md.

export const marketIdParamsSchema = z.object({
  id: z.uuid(),
});

// isActive is the only field this endpoint lets an admin change — code,
// currency, and timezone are fixed business configuration, not casual
// toggles (see docs/modules/MARKETS.md's "explicitly not in scope").
export const updateMarketBodySchema = z.object({
  isActive: z.boolean(),
});

export type MarketIdParams = z.infer<typeof marketIdParamsSchema>;
export type UpdateMarketInput = z.infer<typeof updateMarketBodySchema>;
