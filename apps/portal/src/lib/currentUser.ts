import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const IMPERSONATE_COOKIE = "impersonate_user_id";

export function isOwnerDiscordId(discordId: string) {
  return Boolean(process.env.OWNER_DISCORD_ID) && discordId === process.env.OWNER_DISCORD_ID;
}

/**
 * Looks up the real signed-in user by Discord ID, then - only if that user
 * is the owner and an impersonation cookie is set - swaps in the target
 * user instead. Every page/route using this gets impersonation "for free"
 * without its own special-casing; non-owners are completely unaffected.
 */
export async function resolveEffectiveUser(discordId: string) {
  const realUser = await prisma.user.findUnique({ where: { discordId } });
  if (!realUser) return { user: null, isImpersonating: false };

  if (isOwnerDiscordId(discordId)) {
    const impersonatingId = cookies().get(IMPERSONATE_COOKIE)?.value;
    if (impersonatingId) {
      const target = await prisma.user.findUnique({ where: { id: impersonatingId } });
      if (target) return { user: target, isImpersonating: true };
    }
  }

  return { user: realUser, isImpersonating: false };
}

/** Resolves the signed-in session to our own User row (impersonation-aware), for API routes that need it. Null if not signed in / no matching account. */
export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const { user } = await resolveEffectiveUser(session.user.id);
  return user;
}
