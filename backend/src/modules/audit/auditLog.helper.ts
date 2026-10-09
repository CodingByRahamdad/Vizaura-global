import type { Request } from "express";
import { AuditLogService } from "./auditLog.service.js";

const auditLogService = new AuditLogService();

/// Thin controller-layer helper so the seven wired domains don't each
/// reimplement pulling actorUserId/ipAddress/userAgent off `req`. Never
/// throws (AuditLogService.record() itself never throws) — safe to await
/// directly in a controller without an extra try/catch.
export async function recordAudit(
  req: Request,
  params: { action: string; entityType: string; entityId: string; before?: unknown; after?: unknown },
): Promise<void> {
  await auditLogService.record({
    actorUserId: req.auth?.userId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    before: params.before,
    after: params.after,
    ipAddress: req.ip,
    userAgent: req.get("user-agent") ?? undefined,
  });
}
