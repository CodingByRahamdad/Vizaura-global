import { Prisma } from "../../generated/prisma/client.js";

/// True when `error` is a Prisma unique-constraint violation (P2002) whose
/// target includes `field`. Checks both the query-engine shape
/// (`meta.target`) and the shape this project's actual transport — Prisma 7
/// with the `@prisma/adapter-pg` driver adapter — reports instead
/// (`meta.driverAdapterError.cause.constraint.index`), confirmed by direct
/// inspection against this project's own Postgres. Local, module-specific
/// copy rather than a cross-domain import — see inventory/prismaErrors.ts
/// for the same helper with the full explanation.
export function isUniqueConstraintViolation(error: unknown, field: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  const target = error.meta?.target;
  if (Array.isArray(target) && target.includes(field)) return true;
  if (typeof target === "string" && target.includes(field)) return true;

  const driverAdapterError = error.meta?.driverAdapterError as
    | { cause?: { constraint?: { index?: string } } }
    | undefined;
  const constraintName = driverAdapterError?.cause?.constraint?.index;
  return typeof constraintName === "string" && constraintName.includes(field);
}
