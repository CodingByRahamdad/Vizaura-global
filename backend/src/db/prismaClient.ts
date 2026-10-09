import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "../config/env.js";

// Prisma 7 connects through a driver adapter rather than a bundled engine.
// This module is the single place the client is constructed; per
// docs/ARCHITECTURE.md, repositories are the only layer permitted to use it.
function createPrismaClient(): PrismaClient {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  const adapter = new PrismaPg({ connectionString: env.databaseUrl });
  return new PrismaClient({ adapter });
}

let client: PrismaClient | undefined;

/// Lazily constructs and reuses a single PrismaClient for the process.
export function getPrismaClient(): PrismaClient {
  client ??= createPrismaClient();
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  await client?.$disconnect();
  client = undefined;
}
