import type { NextFunction, Request, Response } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { AppError } from "../errors/AppError.js";
import { ErrorCodes } from "../errors/errorCodes.js";
import { errorResponse } from "../utils/apiResponse.js";

interface BodyParserError extends Error {
  type: string;
  status?: number;
  statusCode?: number;
}

function isBodyParserError(err: unknown): err is BodyParserError {
  return (
    err instanceof Error &&
    "type" in err &&
    typeof (err as { type: unknown }).type === "string" &&
    ((err as { type: string }).type.startsWith("entity.") ||
      (err as { type: string }).type.startsWith("request.") ||
      (err as { type: string }).type.startsWith("charset."))
  );
}

/// Maps a thrown error onto the documented response envelope. AppError
/// instances are safe-by-construction (they carry their own client-facing
/// message/code); anything else is unexpected and is logged in full
/// server-side but reported to the client only as a generic 500 — never a
/// stack trace, SQL error, Prisma internal, hash, token, or secret.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  // Database constraint errors are a business-logic outcome (e.g. a unique
  // email), not an unexpected failure — map them to a clean 409 rather than
  // leaking a Prisma error code or letting them fall through to a 500.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    res.status(409).json(errorResponse(ErrorCodes.CONFLICT, "This resource already exists."));
    return;
  }

  // express.json()/body-parser errors (oversized body, malformed JSON) are a
  // client mistake, not an unexpected server failure — body-parser marks
  // these with a `.type` string and a `.status`/`.statusCode`.
  if (isBodyParserError(err)) {
    if (err.type === "entity.too.large") {
      res
        .status(413)
        .json(errorResponse(ErrorCodes.PAYLOAD_TOO_LARGE, "Request body is too large."));
      return;
    }
    res.status(400).json(errorResponse(ErrorCodes.MALFORMED_REQUEST, "Request body could not be parsed."));
    return;
  }

  if (err instanceof AppError) {
    if (err.httpStatus >= 500 || err.logContext) {
      console.error(`[${req.requestId}]`, err.code, err.message, err.logContext ?? "");
    }
    res.status(err.httpStatus).json(errorResponse(err.code, err.message, err.details));
    return;
  }

  console.error(`[${req.requestId}]`, err);
  res
    .status(500)
    .json(errorResponse(ErrorCodes.INTERNAL_SERVER_ERROR, "An unexpected error occurred.", {
      requestId: req.requestId,
    }));
}
