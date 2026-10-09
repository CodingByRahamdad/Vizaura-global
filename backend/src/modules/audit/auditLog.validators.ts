import { z } from "zod";
import { paginationQuerySchema } from "../catalog/pagination.js";

// Exact filter list from the PRD's own §2C.21 audit API: user/action/
// entityType/entityId/dateFrom/dateTo.
export const listAuditLogsQuerySchema = paginationQuerySchema.extend({
  userId: z.string().uuid().optional(),
  action: z.string().trim().min(1).max(100).optional(),
  entityType: z.string().trim().min(1).max(50).optional(),
  entityId: z.string().trim().min(1).max(64).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
