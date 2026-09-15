import { PrismaClient } from "@gooseboard/db";

// Next.js reloads modules in dev; stash the client on `global` to avoid
// exhausting the Postgres connection pool with a new client per hot-reload.
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
