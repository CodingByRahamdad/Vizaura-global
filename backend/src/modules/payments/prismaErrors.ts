import { Prisma } from "../../generated/prisma/client.js";

/// True when `error` is a Prisma unique-constraint violation (P2002) whose
/// target includes `field`. Local, module-specific copy rather than a
/// cross-domain import — see checkout/prismaErrors.ts and its siblings for
/// the same helper with the full explanation (this project's Prisma 7 +
/// `@prisma/adapter-pg` transport reports the violated constraint
/// differently from the query-engine shape).
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
