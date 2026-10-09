import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodType } from "zod";
import { authErrors } from "../errors/AppError.js";

interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/// Parses and replaces req.body/query/params with the schema's typed output.
/// Unknown keys are rejected by the schemas themselves (zod objects are
/// strict by default in this codebase's usage). Never echoes submitted field
/// values back in the error (a password is a submitted field value).
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as typeof req.query;
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as typeof req.params;
      }
      next();
    } catch (error) {
      next(authErrors.validation(toFieldDetails(error)));
    }
  };
}

function toFieldDetails(error: unknown): Record<string, unknown> | undefined {
  if (
    error &&
    typeof error === "object" &&
    "issues" in error &&
    Array.isArray((error as { issues: unknown }).issues)
  ) {
    const issues = (error as { issues: { path: (string | number)[]; message: string; code: string }[] }).issues;
    return {
      fields: issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      })),
    };
  }
  return undefined;
}
