import { spawnSync } from "node:child_process";
import path from "node:path";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { resetTestData, closeTestDb, testPrisma } from "../helpers/db.js";

afterEach(resetTestData);
afterAll(closeTestDb);

const backendRoot = path.resolve(import.meta.dirname, "../..");

/// Regression coverage for the production seed guard (backend/prisma/seed.ts)
/// — locks in the documented behavior: bootstrap/reference data (markets,
/// RBAC permissions/roles, shipping methods) always seeds; demo catalog data
/// (categories/products/reviewer users/reviews) is skipped in production
/// unless explicitly opted into via SEED_ALLOW_DEMO_DATA. Runs the real
/// script as a child process against the test database (not imported
/// in-process, since it executes `main()` and calls `process.exit` at module
/// load) — slower than a unit test but exercises the actual guard, not a
/// reimplementation of it.
function runSeed(env: Record<string, string | undefined>) {
  // shell: true is required to resolve `npx` on Windows (no shell-injection
  // risk here — args are fixed literals, never interpolated from input).
  const result = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
    cwd: backendRoot,
    shell: true,
    encoding: "utf-8",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    throw new Error(`seed.ts exited ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
  }
}

describe("prisma/seed.ts production guard", () => {
  it(
    "seeds bootstrap/reference data but no demo catalog when NODE_ENV=production and SEED_ALLOW_DEMO_DATA is unset",
    async () => {
      const databaseUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
      runSeed({ NODE_ENV: "production", SEED_ALLOW_DEMO_DATA: undefined, DATABASE_URL: databaseUrl });

      const prisma = testPrisma();
      const [pkMarket, aeMarket, superAdminRole, customerRole, allRoles, productsReadPermission, demoProduct] =
        await Promise.all([
          prisma.market.findUnique({ where: { code: "PK" } }),
          prisma.market.findUnique({ where: { code: "AE" } }),
          prisma.role.findUnique({ where: { key: "super_admin" } }),
          prisma.role.findUnique({ where: { key: "customer" } }),
          prisma.role.findMany({ select: { key: true } }),
          prisma.permission.findUnique({ where: { key: "products:read" } }),
          prisma.product.findUnique({ where: { slug: "himalayan-shilajit-resin" } }),
        ]);

      expect(pkMarket).not.toBeNull();
      expect(aeMarket).not.toBeNull();
      expect(superAdminRole).not.toBeNull();
      expect(customerRole).not.toBeNull();
      // Phase 6E: the seed is authoritative for role EXISTENCE, not just
      // each kept role's permission set — exactly these two roles exist,
      // the 7 retired operational roles are gone.
      expect(allRoles.map((r) => r.key).sort()).toEqual(["customer", "super_admin"]);
      expect(productsReadPermission).not.toBeNull();
      expect(demoProduct).toBeNull();
      expect(await prisma.product.count()).toBe(0);
      expect(await prisma.user.count()).toBe(0);
    },
    30000,
  );

  it(
    "seeds the demo catalog when NODE_ENV=production and SEED_ALLOW_DEMO_DATA=true",
    async () => {
      const databaseUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
      runSeed({ NODE_ENV: "production", SEED_ALLOW_DEMO_DATA: "true", DATABASE_URL: databaseUrl });

      const prisma = testPrisma();
      const demoProduct = await prisma.product.findUnique({ where: { slug: "himalayan-shilajit-resin" } });
      expect(demoProduct).not.toBeNull();
    },
    30000,
  );
});
