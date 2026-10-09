import { z } from "zod";

// Transport-layer validation only — the window/limit bounds keep every
// aggregation query cheap and bounded (see docs/modules/ANALYTICS.md).
export const dashboardQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional(),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
