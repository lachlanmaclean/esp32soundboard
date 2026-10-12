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

export async function triggerExternalPlayback(userId: string, mp3Url: string): Promise<void> {
  const res = await fetch(`${env.botInternalUrl}/internal/trigger-external`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, mp3Url }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new BotProxyError(res.status, body.error ?? "Playback failed");
  }
}

/** Plays an already-downloaded local file (e.g. extracted YouTube audio) straight into the user's voice channel. */
export async function triggerLocalFilePlayback(userId: string, filePath: string, volume: number): Promise<void> {
  const res = await fetch(`${env.botInternalUrl}/internal/trigger-file`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, filePath, volume }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new BotProxyError(res.status, body.error ?? "Playback failed");
  }
}

/** Changes the live volume of the web player's current track in the user's voice channel. */
export async function triggerVolumeChange(userId: string, volume: number): Promise<void> {
  const res = await fetch(`${env.botInternalUrl}/internal/volume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, volume }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new BotProxyError(res.status, body.error ?? "Volume change failed");
  }
}

/** Stops whatever's currently playing in the user's voice channel. */
export async function triggerStopPlayback(userId: string): Promise<void> {
  const res = await fetch(`${env.botInternalUrl}/internal/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new BotProxyError(res.status, body.error ?? "Stop failed");
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
