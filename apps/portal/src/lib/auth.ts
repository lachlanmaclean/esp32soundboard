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

      await prisma.user.upsert({
        where: { discordId: user.id },
        create: {
          discordId: user.id,
          discordUsername: user.name ?? "unknown",
          discordAvatar: user.image ?? null,
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
