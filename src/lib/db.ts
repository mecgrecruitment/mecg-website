import { PrismaClient } from "@prisma/client";

// ponytail: standard Next.js dev singleton to avoid exhausting DB
// connections from hot-reload re-imports.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
