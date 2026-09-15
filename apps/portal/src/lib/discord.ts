import type { OAuthGuildSummary } from "@gooseboard/shared";
import { canManageGuild } from "./auth";

// View Channel, Send Messages + Embed Links (its welcome/help message), and
// Connect + Speak (joining voice and playing a sound). Nothing more.
const BOT_PERMISSIONS = 1024 | 2048 | 16384 | 1048576 | 2097152;

/** Link that opens Discord's native "add bot to server" picker (scope=bot). */
export function buildBotInviteUrl() {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID!,
    scope: "bot applications.commands",
    permissions: String(BOT_PERMISSIONS),
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

interface DiscordApiGuild {
  id: string;
  name: string;
  icon: string | null;
  permissions: string;
}

/** Fetches the guilds the signed-in user belongs to, from the `guilds` OAuth2 scope. */
export async function fetchUserGuilds(accessToken: string): Promise<OAuthGuildSummary[]> {
  const res = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch guilds: ${res.status}`);
  }

  const guilds: DiscordApiGuild[] = await res.json();

  return guilds.map((guild) => ({
    id: guild.id,
    name: guild.name,
    icon: guild.icon,
    canManage: canManageGuild(guild.permissions),
  }));
}
