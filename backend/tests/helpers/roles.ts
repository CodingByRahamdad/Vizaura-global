import type { Express } from "express";
import { registerUser } from "./authFlow.js";
import { testPrisma } from "./db.js";

/// Phase 6E collapsed the seeded role set to just `super_admin`/`customer`
/// (see backend/prisma/seed.ts). A handful of tests still need a caller
/// with an EXACT partial permission subset — neither `super_admin` (has
/// everything) nor `customer` (has nothing) can express that — to assert a
/// genuine permission-boundary behavior (e.g. "has products:read but not
/// inventory:update -> 403"). This creates a uniquely-keyed, non-system
/// `Role` row with exactly the given permissions, scoped to one test; it is
/// test scaffolding, not a reintroduced business role. Cleaned up every test
/// by tests/helpers/db.ts::resetTestData (`role.deleteMany({isSystem:false})`).
let adHocRoleCounter = 0;

export async function createAdHocRole(permissionKeys: string[]): Promise<string> {
  const prisma = testPrisma();
  adHocRoleCounter += 1;
  const key = `test-role-${Date.now()}-${adHocRoleCounter}`;

  const permissions = await prisma.permission.findMany({ where: { key: { in: permissionKeys } } });
  if (permissions.length !== permissionKeys.length) {
    const found = new Set(permissions.map((p) => p.key));
    const missing = permissionKeys.filter((k) => !found.has(k));
    throw new Error(`createAdHocRole: unknown permission key(s): ${missing.join(", ")}`);
  }

  const role = await prisma.role.create({
    data: {
      key,
      name: `Test role (${key})`,
      description: "Ad-hoc role for one test's permission-boundary assertion — see tests/helpers/roles.ts.",
      isSystem: false,
      permissions: { create: permissions.map((p) => ({ permissionId: p.id })) },
    },
  });
  return role.id;
}

/// Registers a fresh user and assigns an already-seeded role by key (e.g.
/// "super_admin"/"customer"). Equivalent to the `asRole` helper duplicated
/// locally in several test files — new/updated test files should prefer
/// importing this one instead of redefining it.
///
/// Deletes any existing UserRole rows first (registerUser already assigned
/// "customer" via the real register endpoint) — mirrors
/// UsersRepository.replaceRole's own delete-then-create pattern, so the
/// resulting fixture actually reflects the app's one-role-per-user
/// invariant. Fixed in Phase 6M: calling asRole(app, "super_admin") used to
/// leave the user holding BOTH "customer" and "super_admin" simultaneously
/// (an app-invariant-violating state real app usage never produces), which
/// silently passed every prior test but broke the Customers module's
/// roleKey-filtered queries — see customers.test.ts.
export async function asRole(app: Express, key: string): Promise<string> {
  const { cookieHeader, payload } = await registerUser(app);
  const prisma = testPrisma();
  const role = await prisma.role.findUniqueOrThrow({ where: { key } });
  const user = await prisma.user.findUniqueOrThrow({ where: { email: payload.email } });
  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId: user.id } }),
    prisma.userRole.create({ data: { userId: user.id, roleId: role.id } }),
  ]);
  return cookieHeader;
}

/// Registers a fresh user and assigns a brand-new ad-hoc role holding
/// exactly `permissionKeys`. Use this only for a genuine partial-permission
/// boundary assertion — for "some staff member can do X" positive-path
/// setup, use `asRole(app, "super_admin")` instead.
export async function asPermissions(app: Express, permissionKeys: string[]): Promise<string> {
  const { cookieHeader, payload } = await registerUser(app);
  const prisma = testPrisma();
  const roleId = await createAdHocRole(permissionKeys);
  const user = await prisma.user.findUniqueOrThrow({ where: { email: payload.email } });
  await prisma.userRole.create({ data: { userId: user.id, roleId } });
  return cookieHeader;
}
