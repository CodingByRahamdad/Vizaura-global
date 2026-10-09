import { Prisma } from "../../generated/prisma/client.js";

/// True when `error` is a Prisma unique-constraint violation (P2002) whose
/// target includes `field`. Used to translate a same-request race (the
/// application-level pre-check passed, but a concurrent request won the DB
/// constraint first) into the same domain-specific error the pre-check
/// would have produced, instead of falling through to errorHandler.ts's
/// generic P2002 -> 409 CONFLICT mapping.
export function isUniqueConstraintViolation(error: unknown, field: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.includes(field);
  if (typeof target === "string") return target.includes(field);
  return false;
}
