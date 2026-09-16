import { env } from "../env";

export class BotProxyError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
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

/** Best-effort: if the bot is unreachable, assume not-in-voice rather than failing the whole config fetch. */
export async function isUserInVoiceChannel(discordId: string): Promise<boolean> {
  try {
    const res = await fetch(`${env.botInternalUrl}/internal/voice-status?discordId=${encodeURIComponent(discordId)}`);
    if (!res.ok) return false;
    const body = (await res.json()) as { inVoiceChannel: boolean };
    return body.inVoiceChannel;
  } catch (error) {
    console.error("[api] failed to reach bot for voice status", error);
    return false;
  }
}
