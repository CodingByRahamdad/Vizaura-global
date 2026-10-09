import { Prisma } from "../../generated/prisma/client.js";

/// True when `error` is a Prisma unique-constraint violation (P2002) whose
/// target includes `field`. Same intent as Catalog's local copy
/// (catalog/prismaErrors.ts) — a tiny, module-independent duplicate rather
/// than a cross-domain import — but checks a different shape.
///
/// Catalog's version reads `error.meta.target`, which is where Prisma's
/// *query-engine* transport reports the violated column(s). This project
/// runs Prisma 7 with the `@prisma/adapter-pg` driver adapter, which
/// reports P2002 differently: `meta.target` is absent, and the violated
/// constraint's name instead appears at
/// `meta.driverAdapterError.cause.constraint.index` (verified directly
/// against this project's Postgres — e.g. "variant_stocks_variantId_
/// marketId_key" for a compound @@unique, "product_variants_sku_key" for a
/// plain @unique). Catalog's own conflict tests never actually exercise
/// this path (they all hit the pre-check before reaching the DB), so this
/// is a latent defect there too — flagged, not fixed, since no Catalog
/// test or documented behavior currently depends on it; see
/// docs/CURRENT_TASK.md. Checking both shapes here makes Inventory's own
/// create-race handling correct regardless of which transport is active.
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
