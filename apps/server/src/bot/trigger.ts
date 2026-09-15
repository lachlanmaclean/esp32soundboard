import path from "path";
import { prisma } from "../db";
import { env } from "../env";
import { ensureOpusFile } from "../audio";
import { discordClient } from "./client";
import { playSoundInChannel } from "./playback";

export class TriggerError extends Error {}

/**
 * Plays one of a user's sounds into whichever voice channel they're
 * currently sitting in, in the guild they've linked. No manual "join voice"
 * step needed — the bot follows the user.
 */
/**
 * Discord only lets an account sit in one voice channel at a time, across
 * every server — so there's no need to pin a user to a particular guild.
 * Whichever channel they're in is where the sound goes.
 *
 * Reads the local voice-state cache (kept current by the GuildVoiceStates
 * intent) rather than hitting Discord's API on every tap.
 */
function findUserVoiceChannel(discordId: string) {
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
  if (!sound) throw new TriggerError("Sound not found");

  const channel = findUserVoiceChannel(user.discordId);
  if (!channel) {
    throw new TriggerError("Join a voice channel in a server Gooseboard is in, then try again");
  }

  const sourcePath = path.join(env.uploadDir, path.basename(sound.audioUrl));
  const opusPath = await ensureOpusFile(sourcePath);

  await playSoundInChannel(channel, opusPath ?? sourcePath, opusPath !== null);
}
