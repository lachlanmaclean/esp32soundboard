import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Resolves the signed-in session to our own User row, for API routes that need it. Null if not signed in / no matching account. */
export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  return prisma.user.findUnique({ where: { discordId: session.user.id } });
}
