import { z } from "zod";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function toSkipTake(pagination: PaginationQuery): { skip: number; take: number } {
  return { skip: (pagination.page - 1) * pagination.limit, take: pagination.limit };
}

export function toPaginationMeta(pagination: PaginationQuery, total: number) {
  return {
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  };
}
