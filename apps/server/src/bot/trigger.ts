import path from "path";
import { prisma } from "../db";
import { env } from "../env";
import { ensureOpusFile } from "../audio";
import { canonicalAudioPath } from "../storage";
import { discordClient } from "./client";
import { playSoundInChannel } from "./playback";

export class TriggerError extends Error {}

/**
 * Discord only lets an account sit in one voice channel at a time, across
 * every server — so there's no need to pin a user to a particular guild.
 * Whichever channel they're in is where a sound (or the CYD's grid) follows.
 *
 * Reads the local voice-state cache (kept current by the GuildVoiceStates
 * intent) rather than hitting Discord's API on every call.
 */
export function findUserVoiceChannel(discordId: string) {
  for (const guild of discordClient.guilds.cache.values()) {
    const channel = guild.voiceStates.cache.get(discordId)?.channel;
    if (channel) return channel;
  }
  return null;
}

export async function playSoundForUser(userId: string, soundId: string) {
  const [user, sound] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.sound.findFirst({ where: { id: soundId, userId } }),
  ]);

  if (!user) throw new TriggerError("User not found");
  if (user.status === "SUSPENDED") throw new TriggerError("Account suspended");
  if (!sound) throw new TriggerError("Sound not found");

  const channel = findUserVoiceChannel(user.discordId);
  if (!channel) {
    throw new TriggerError("Join a voice channel in a server Gooseboard is in, then try again");
  }

  // Sounds uploaded before file-hash dedup existed have no hash (migrated
  // to "", which never matches a real one) - their audio still lives at the
  // plain upload path rather than a hardlink into originals/.
  const sourcePath = sound.fileHash
    ? canonicalAudioPath(sound.fileHash, path.extname(sound.audioUrl))
    : path.join(env.uploadDir, path.basename(sound.audioUrl));
  const opusPath = await ensureOpusFile(sourcePath);

  await playSoundInChannel(channel, opusPath ?? sourcePath, opusPath !== null, sound.volume);
}

/**
 * Plays an external (not-uploaded) mp3 straight from its URL. ffmpeg accepts
 * an HTTP(S) URL as an input path just like a local file, so this skips
 * downloading anything to disk first - at the cost of always taking the slow
 * ffmpeg-transcode path, same as an unencoded upload.
 */
export async function playExternalSoundForUser(userId: string, mp3Url: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new TriggerError("User not found");
  if (user.status === "SUSPENDED") throw new TriggerError("Account suspended");

  const channel = findUserVoiceChannel(user.discordId);
  if (!channel) {
    throw new TriggerError("Join a voice channel in a server Gooseboard is in, then try again");
  }

  await playSoundInChannel(channel, mp3Url, false);
}
