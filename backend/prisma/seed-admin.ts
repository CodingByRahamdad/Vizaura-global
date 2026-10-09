import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { hashPassword, validatePasswordPolicy } from "../src/security/password.js";

// Dev/ops-only super_admin bootstrap — deliberately separate from
// prisma/seed.ts. seed.ts's own `main()` always runs unconditionally
// (its bootstrap-data branch, at least) and is exercised by
// tests/integration/seed-guard.test.ts, which asserts a fresh production
// seed creates ZERO users. Folding admin creation into that script would
// break that invariant. This script is never wired into db:seed,
// db:migrate:deploy, or any install hook — it must be run explicitly.
//
// No role is created or renamed — it assigns the existing, already-seeded
// `super_admin` role by key. Safe to re-run: upserts the user and the role
// assignment rather than failing on a second run.

const isProduction = process.env.NODE_ENV === "production";
const allowInProduction = process.env.SEED_ALLOW_ADMIN_BOOTSTRAP === "true";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  // Mirrors src/config/env.ts's own production-safety pattern: fail closed,
  // require an explicit opt-in env var, never fall back to a default.
  if (isProduction && !allowInProduction) {
    console.error(
      'Refusing to bootstrap a super_admin account: NODE_ENV=production and SEED_ALLOW_ADMIN_BOOTSTRAP is not "true". ' +
        "Set SEED_ALLOW_ADMIN_BOOTSTRAP=true explicitly if this production-mode environment (e.g. staging) genuinely needs one.",
    );
    process.exitCode = 1;
    return;
  }

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const firstName = process.env.BOOTSTRAP_ADMIN_FIRST_NAME ?? "Super";
  const lastName = process.env.BOOTSTRAP_ADMIN_LAST_NAME ?? "Admin";

  if (!email || !password) {
    console.error(
      "BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD must both be set (see .env.example). " +
        "Never hardcode credentials in source — this script reads them from the environment only.",
    );
    process.exitCode = 1;
    return;
  }

  const violation = validatePasswordPolicy(password);
  if (violation) {
    console.error(`BOOTSTRAP_ADMIN_PASSWORD does not meet the password policy: ${violation.message}`);
    process.exitCode = 1;
    return;
  }

  const superAdminRole = await prisma.role.findUnique({ where: { key: "super_admin" } });
  if (!superAdminRole) {
    console.error('The "super_admin" role does not exist yet — run `npm run db:seed` first.');
    process.exitCode = 1;
    return;
  }

  // A super_admin may have since changed their own email (self-service
  // change-email flow) — re-running this script with the ORIGINAL
  // BOOTSTRAP_ADMIN_EMAIL would then no longer match that row by email, and
  // the upsert below would create a second super_admin. Guard on role
  // membership instead of email so this can never happen: if any super_admin
  // already exists, this script is a no-op regardless of email match.
  const existingSuperAdmin = await prisma.userRole.findFirst({
    where: { roleId: superAdminRole.id },
  });
  if (existingSuperAdmin) {
    console.log("A super_admin already exists — skipping bootstrap (not overwriting or duplicating).");
    return;
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: {}, // Never overwrite an existing admin's password/name on re-run.
    create: {
      email,
      passwordHash,
      firstName,
      lastName,
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
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
