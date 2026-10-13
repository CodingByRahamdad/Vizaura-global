import { createApp } from "./app/app.js";
import { env } from "./config/env.js";
import { disconnectPrisma, getPrismaClient } from "./db/prismaClient.js";
import { bootstrapSuperAdmin } from "./security/adminBootstrap.js";

const app = createApp();

await bootstrapSuperAdmin(getPrismaClient());

const server = app.listen(env.port, () => {
  console.log(`VIZAURA GLOBAL backend listening on port ${env.port} (${env.nodeEnv})`);
});

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down gracefully`);
  server.close(() => {
    disconnectPrisma()
      .catch((error: unknown) => {
        console.error("Error disconnecting Prisma during shutdown:", error);
      })
      .finally(() => {
        process.exit(0);
      });
  });
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
