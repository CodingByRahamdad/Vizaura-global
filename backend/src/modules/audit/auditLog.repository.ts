import type { AuditLog, Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { getPrismaClient } from "../../db/prismaClient.js";

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

const listOrderBy: Prisma.AuditLogOrderByWithRelationInput[] = [{ createdAt: "desc" }, { id: "desc" }];

/// Append-only by construction: this repository exposes only `create`/`list`.
/// No `update`/`delete` method exists anywhere in this module — there is
/// structurally no code path to mutate a row once written.
export class AuditLogRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async create(params: {
    userId?: string;
    action: string;
    entityType: string;
    entityId: string;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        before: params.before,
        after: params.after,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  }

  async list(filters: AuditLogFilters, skip: number, take: number): Promise<{ logs: AuditLog[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {
        ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
        ...(filters.dateTo ? { lte: filters.dateTo } : {}),
      };
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: listOrderBy, skip, take }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { logs, total };
  }
}
