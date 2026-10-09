import type { Request, Response } from "express";
import { successResponse } from "../../utils/apiResponse.js";

export function getHealth(_req: Request, res: Response) {
  res.status(200).json(
    successResponse({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }),
  );
}
