import path from "path";
import { prisma } from "../db";
import { env } from "../env";
import { discordClient } from "./client";
import { playSoundInChannel } from "./playback";

export class TriggerError extends Error {}

/**
 * Plays one of a user's sounds into whichever voice channel they're
 * currently sitting in, in the guild they've linked. No manual "join voice"
 * step needed — the bot follows the user.
 */
export async function playSoundForUser(userId: string, soundId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new TriggerError("User not found");
  if (!user.guildId) throw new TriggerError("No server linked to this account yet");

  const sound = await prisma.sound.findFirst({ where: { id: soundId, userId } });
  if (!sound) throw new TriggerError("Sound not found");

  const guild = discordClient.guilds.cache.get(user.guildId);
  if (!guild) throw new TriggerError("Bot is not in the linked server");

  const member = await guild.members.fetch(user.discordId).catch(() => null);
  const channel = member?.voice.channel;
  if (!channel) throw new TriggerError("You're not in a voice channel in that server");

  const filePath = path.join(env.uploadDir, path.basename(sound.audioUrl));
  await playSoundInChannel(channel, filePath);
}
