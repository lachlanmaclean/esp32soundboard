import { PrismaClient } from "@gooseboard/db";

// Reused across the API and bot processes (both run in this same app).
export const prisma = new PrismaClient();
