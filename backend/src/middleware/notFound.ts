import type { Request, Response } from "express";
import { errorResponse } from "../utils/apiResponse.js";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json(errorResponse("NOT_FOUND", `Route ${req.method} ${req.originalUrl} not found`));
}
