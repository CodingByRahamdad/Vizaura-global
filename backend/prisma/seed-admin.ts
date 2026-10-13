import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { bootstrapSuperAdmin } from "../src/security/adminBootstrap.js";

// Dev/ops-only manual entry point for the same bootstrap logic that also
// runs as an opt-in startup hook (backend/src/server.ts) — see
// backend/src/security/adminBootstrap.ts for the guard rails (production
// opt-in, idempotency, password policy). Kept as a separate script so an
// admin can still be provisioned by running a one-off command instead of
// relying on the startup hook.

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

bootstrapSuperAdmin(prisma)
  .then(async (result) => {
    // "bootstrapped" and "already_exists" are successful outcomes for a
    // manual run; everything else means nothing was created and the caller
    // should see a non-zero exit code.
    if (result !== "bootstrapped" && result !== "already_exists") {
      process.exitCode = 1;
    }
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
