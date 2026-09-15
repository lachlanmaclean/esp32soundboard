import { env } from "../env";

export class BotProxyError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function fetchBotGuildIds(): Promise<string[]> {
  const res = await fetch(`${env.botInternalUrl}/internal/guilds`);
  if (!res.ok) throw new BotProxyError(res.status, "Bot service unreachable");
  const body = (await res.json()) as { guildIds: string[] };
  return body.guildIds;
}

export async function triggerPlayback(userId: string, soundId: string): Promise<void> {
  const res = await fetch(`${env.botInternalUrl}/internal/trigger`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, soundId }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new BotProxyError(res.status, body.error ?? "Playback failed");
  }
}
