import type { NextFunction, Request, Response } from "express";
import { AuditLogService } from "./auditLog.service.js";
import { toAuditLogView } from "./auditLog.mapper.js";
import { successResponse } from "../../utils/apiResponse.js";
import { toSkipTake, toPaginationMeta } from "../catalog/pagination.js";
import type { ListAuditLogsQuery } from "./auditLog.validators.js";

const auditLogService = new AuditLogService();

export async function listAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as ListAuditLogsQuery;
    const { skip, take } = toSkipTake(query);
    const { logs, total } = await auditLogService.list(
      {
        userId: query.userId,
        action: query.action,
        entityType: query.entityType,
        entityId: query.entityId,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      },
      skip,
      take,
    );
    res.status(200).json(successResponse(logs.map(toAuditLogView), toPaginationMeta(query, total)));
  } catch (error) {
    next(error);
  }
}
