import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { prisma } from "./db";

// Discord permission bit flags relevant to "can this user manage the guild the bot lives in".
const PERMISSION_ADMINISTRATOR = 0x8;
const PERMISSION_MANAGE_GUILD = 0x20;

export function canManageGuild(permissions: string): boolean {
  const bits = BigInt(permissions);
  return (bits & BigInt(PERMISSION_ADMINISTRATOR)) !== 0n || (bits & BigInt(PERMISSION_MANAGE_GUILD)) !== 0n;
}

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      // guilds is required up front - Discord locks scopes in at consent time.
      authorization: "https://discord.com/api/oauth2/authorize?scope=identify+guilds",
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
    async jwt({ token, account }) {
      // Discord's OAuth access token, needed later to call /users/@me/guilds
      // for the guild-picker step (per-guild `canManage` from permission bits).
      if (account?.access_token) {
        token.discordAccessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub;
        session.discordAccessToken = token.discordAccessToken;
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
};
