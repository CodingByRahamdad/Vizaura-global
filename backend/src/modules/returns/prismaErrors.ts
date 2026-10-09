import { Prisma } from "../../generated/prisma/client.js";

/// True when `error` is a Prisma unique-constraint violation (P2002) whose
/// target includes `field`. Local, module-specific copy rather than a
/// cross-domain import — see payments/prismaErrors.ts and its siblings for
/// the same helper with the full explanation (this project's Prisma 7 +
/// `@prisma/adapter-pg` transport reports the violated constraint
/// differently from the query-engine shape). Also the mechanism that
/// catches the hand-added `returns_orderId_open_unique` partial-index
/// violation — that index isn't declared in schema.prisma (Prisma has no
/// partial-index syntax), so its violation is only visible via the
/// `driverAdapterError.cause.constraint.index` fallback path below, not
/// `error.meta.target`.
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
