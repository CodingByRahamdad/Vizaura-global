import type { NextFunction, Request, Response } from "express";
import { SearchService } from "./search.service.js";
import { successResponse } from "../../utils/apiResponse.js";
import type { GlobalSearchQuery } from "./search.validators.js";

const searchService = new SearchService();

export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const { q } = req.query as unknown as GlobalSearchQuery;
    const permissions = req.auth?.permissions ?? new Set<string>();
    const result = await searchService.search(q, permissions);
    res.status(200).json(successResponse(result));
  } catch (error) {
    next(error);
  }
}
