import { AuditLogRepository, type AuditLogFilters } from "./auditLog.repository.js";

export interface RecordAuditEntryInput {
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

export interface ListResult<T> {
  logs: T[];
  total: number;
}

export class AuditLogService {
  constructor(private readonly auditLogRepository: AuditLogRepository = new AuditLogRepository()) {}

  /// Never throws — an audit-write failure must never block or fail the
  /// business operation it's auditing. Callers fire-and-forget this after
  /// their own primary mutation has already succeeded.
  async record(entry: RecordAuditEntryInput): Promise<void> {
    try {
      await this.auditLogRepository.create({
        userId: entry.actorUserId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        before: entry.before as never,
        after: entry.after as never,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      });
    } catch (error) {
      console.warn(`audit log: failed to record ${entry.action} on ${entry.entityType}:${entry.entityId}`, error);
    }
  }

  async list(filters: AuditLogFilters, skip: number, take: number) {
    return this.auditLogRepository.list(filters, skip, take);
  }
}
