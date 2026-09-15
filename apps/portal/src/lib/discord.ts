import type { OAuthGuildSummary } from "@gooseboard/shared";
import { canManageGuild } from "./auth";

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
