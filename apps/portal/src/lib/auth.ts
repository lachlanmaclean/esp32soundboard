import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { prisma } from "./db";

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      // identify is all we need: sounds belong to the account, and playback
      // follows whichever voice channel the user is in.
      authorization: "https://discord.com/api/oauth2/authorize?scope=identify",
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!account || account.provider !== "discord") return false;

      const existing = await prisma.user.findUnique({ where: { discordId: user.id } });
      // Blocked at the door, not just hidden - a suspended account can't get
      // a session at all, so every API route behind getCurrentUser() is
      // covered without needing its own check.
      if (existing?.status === "SUSPENDED") return false;

      // Only looked up for brand-new accounts - existing.cooldownPolicyId is
      // left alone on every later sign-in so an admin's assignment sticks.
      const defaultPolicy = existing
        ? null
        : await prisma.cooldownPolicy.findFirst({ where: { isDefault: true } });

      await prisma.user.upsert({
        where: { discordId: user.id },
        create: {
          discordId: user.id,
          discordUsername: user.name ?? "unknown",
          discordAvatar: user.image ?? null,
          cooldownPolicyId: defaultPolicy?.id,
        },
        update: {
          discordUsername: user.name ?? "unknown",
          discordAvatar: user.image ?? null,
        },
      });

      return true;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
};
