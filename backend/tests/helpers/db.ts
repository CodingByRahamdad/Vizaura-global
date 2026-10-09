import { getPrismaClient } from "../../src/db/prismaClient.js";

/// Wipes all per-test data (users cascade to sessions/tokens/user_roles;
/// products cascade to variants/options/option-values/media/market-links;
/// categories cascade to product-category links) while leaving the seeded
/// reference data (markets, roles, permissions, role_permissions) intact,
/// since auth registration depends on the "customer" role existing. Also
/// restores every role to isActive=true: tests that deactivate a role (e.g.
/// to prove inactive roles grant no permissions) mutate this shared seeded
/// data, and without restoring it here that corruption would silently
/// persist into the next test run.
export async function resetTestData(): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "users" CASCADE;');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "products" CASCADE;');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "categories" CASCADE;');
  // payment_webhook_events has no FK to users/products/categories (it's
  // keyed only on provider+eventId, deliberately outlives its Payment for
  // idempotency-replay auditing — see docs/modules/PAYMENTS.md), so the
  // CASCADE truncates above never reach it. Truncated separately here to
  // stop rows leaking across tests in the same file.
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "payment_webhook_events" CASCADE;');
  // shipping_methods hangs off markets (kept, seeded reference data), not
  // users/products/categories, so it's equally unreachable by the CASCADE
  // truncates above — same leak the payment_webhook_events fix (Phase 4K)
  // already addressed once. CASCADE here also clears any shipments
  // referencing an about-to-vanish method (shipments themselves are already
  // reached transitively via the users truncate, since orders->shipments).
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "shipping_methods" CASCADE;');
  // notifications has no FK to users/products/categories (entityId is a
  // plain string, not a relation — see schema.prisma's doc comment on the
  // model) so it's equally unreachable by the CASCADE truncates above;
  // without this it would accumulate indefinitely across every test file.
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "notifications" CASCADE;');
  await prisma.role.updateMany({ where: { isActive: false }, data: { isActive: true } });
  // Same restoration as roles above — markets.test.ts (Phase 6K) toggles
  // isActive off to prove the public /markets list excludes it, and without
  // restoring it here that corruption would silently persist into the next
  // test run/file (shared seeded reference data, never wiped by the
  // TRUNCATEs above).
  await prisma.market.updateMany({ where: { isActive: false }, data: { isActive: true } });
  // Ad-hoc per-test roles (Phase 6E: tests/helpers/roles.ts::createAdHocRole)
  // are always isSystem:false and never looked up by key across tests (each
  // gets a unique key), so they're safe to wipe every test — otherwise they
  // accumulate indefinitely across a run since nothing else ever deletes
  // them (their RolePermission rows cascade with them; their UserRole rows
  // already went with the users TRUNCATE above).
  await prisma.role.deleteMany({ where: { isSystem: false } });
}

export async function closeTestDb(): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.$disconnect();
}

export function testPrisma() {
  return getPrismaClient();
}
