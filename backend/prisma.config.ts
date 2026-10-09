import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma CLI configuration (migrate, validate, generate, studio).
// The connection string is read from the environment and is never committed.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
