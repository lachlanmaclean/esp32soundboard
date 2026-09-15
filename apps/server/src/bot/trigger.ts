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
export async function playSoundForUser(userId: string, soundId: string) {
  const [user, sound] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.sound.findFirst({ where: { id: soundId, userId } }),
  ]);

  if (!user) throw new TriggerError("User not found");
  if (!user.guildId) throw new TriggerError("No server linked to this account yet");
  if (!sound) throw new TriggerError("Sound not found");

  const guild = discordClient.guilds.cache.get(user.guildId);
  if (!guild) throw new TriggerError("Bot is not in the linked server");

  // Read from the local voice-state cache (kept current by the
  // GuildVoiceStates intent) rather than fetching the member over the
  // Discord API, which would add a round trip to every single tap.
  const channel =
    guild.voiceStates.cache.get(user.discordId)?.channel ??
    (await guild.members.fetch(user.discordId).catch(() => null))?.voice.channel;

  if (!channel) throw new TriggerError("You're not in a voice channel in that server");

  const sourcePath = path.join(env.uploadDir, path.basename(sound.audioUrl));
  const opusPath = await ensureOpusFile(sourcePath);

  await playSoundInChannel(channel, opusPath ?? sourcePath, opusPath !== null);
}
