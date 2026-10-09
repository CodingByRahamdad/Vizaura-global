import type { NextFunction, Request, Response } from "express";
import { AnalyticsService } from "./analytics.service.js";
import { successResponse } from "../../utils/apiResponse.js";
import type { DashboardQuery } from "./analytics.validators.js";

const analyticsService = new AnalyticsService();

/// GET /admin/analytics/dashboard (analytics:read) — the admin dashboard's
/// sole data source. See docs/modules/ANALYTICS.md.
export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as DashboardQuery;
    const data = await analyticsService.getDashboard(query);
    res.status(200).json(successResponse(data));
  } catch (error) {
    next(error);
  }
}
