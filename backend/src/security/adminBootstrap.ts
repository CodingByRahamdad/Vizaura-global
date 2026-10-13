import type { PrismaClient } from "../generated/prisma/client.js";
import { env } from "../config/env.js";
import { hashPassword, validatePasswordPolicy } from "./password.js";

export type AdminBootstrapResult =
  | "bootstrapped"
  | "already_exists"
  | "not_configured"
  | "production_guard"
  | "invalid_password"
  | "role_missing"
  | "error";

// Shared by prisma/seed-admin.ts (manual CLI run) and src/server.ts (an
// opt-in startup hook) — see docs/AUTH_SECURITY.md. Deliberately separate
// from prisma/seed.ts: that script always runs unconditionally and is
// exercised by tests/integration/seed-guard.test.ts, which asserts a fresh
// production seed creates ZERO users. This function only ever acts when
// BOOTSTRAP_ADMIN_EMAIL/PASSWORD are explicitly set ("not_configured" is the
// default, silent result), so leaving it wired into every server startup is
// safe.
//
// No role is created or renamed — it assigns the existing, already-seeded
// `super_admin` role by key. Safe to call repeatedly: upserts the user and
// the role assignment rather than failing on a second run, and is a no-op
// if any super_admin already exists (guarded by role membership, not
// email, so a super_admin who later changes their own email can never
// cause a second super_admin to be created).
export async function bootstrapSuperAdmin(prisma: PrismaClient): Promise<AdminBootstrapResult> {
  try {
    const email = env.adminBootstrap.email;
    const password = env.adminBootstrap.password;

    if (!email || !password) {
      return "not_configured";
    }

    if (env.isProduction && !env.adminBootstrap.allowInProduction) {
      console.error(
        'Refusing to bootstrap a super_admin account: NODE_ENV=production and SEED_ALLOW_ADMIN_BOOTSTRAP is not "true". ' +
          "Set SEED_ALLOW_ADMIN_BOOTSTRAP=true explicitly if this production-mode environment genuinely needs one.",
      );
      return "production_guard";
    }

    const violation = validatePasswordPolicy(password);
    if (violation) {
      console.error(`BOOTSTRAP_ADMIN_PASSWORD does not meet the password policy: ${violation.message}`);
      return "invalid_password";
    }

    const superAdminRole = await prisma.role.findUnique({ where: { key: "super_admin" } });
    if (!superAdminRole) {
      console.error('The "super_admin" role does not exist yet — run `npm run db:seed` first.');
      return "role_missing";
    }

    const existingSuperAdmin = await prisma.userRole.findFirst({
      where: { roleId: superAdminRole.id },
    });
    if (existingSuperAdmin) {
      console.log("A super_admin already exists — skipping bootstrap (not overwriting or duplicating).");
      return "already_exists";
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.upsert({
      where: { email },
      update: {}, // Never overwrite an existing admin's password/name on re-run.
      create: {
        email,
        passwordHash,
        firstName: env.adminBootstrap.firstName,
        lastName: env.adminBootstrap.lastName,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        passwordChangedAt: new Date(),
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: superAdminRole.id } },
      update: {},
      create: { userId: user.id, roleId: superAdminRole.id },
    });

    // Never log the password.
    console.log(`Bootstrapped super_admin user: ${email}`);
    return "bootstrapped";
  } catch (error) {
    console.error("Error bootstrapping super_admin account:", error);
    return "error";
  }
}
