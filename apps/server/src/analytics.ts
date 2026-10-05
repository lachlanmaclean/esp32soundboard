import { getVoiceConnection } from "@discordjs/voice";
import { Events, type VoiceState } from "discord.js";
import { discordClient } from "./bot/client";
import { prisma } from "./db";
import type { PlaySource } from "@gooseboard/db";

export async function recordPlayEvent(userId: string, soundId: string | null, source: PlaySource) {
  try {
    await prisma.playEvent.create({ data: { userId, soundId, source } });
  } catch (error) {
    // Analytics are best-effort - never let a logging failure break playback.
    console.error("[analytics] failed to record play event", error);
  }
}

async function startVoiceSession(discordId: string) {
  const user = await prisma.user.findUnique({ where: { discordId } });
  if (!user) return;

  const open = await prisma.voiceSession.findFirst({ where: { userId: user.id, endedAt: null } });
  if (open) return;

  await prisma.voiceSession.create({ data: { userId: user.id } });
}

async function endVoiceSession(discordId: string) {
  const user = await prisma.user.findUnique({ where: { discordId } });
  if (!user) return;

  await prisma.voiceSession.updateMany({ where: { userId: user.id, endedAt: null }, data: { endedAt: new Date() } });
}

/**
 * Tracks "usage time" for the owner admin page: how long a user spends in a
 * Discord voice channel the bot is also connected to and actively serving,
 * not just any voice activity app-wide. Known gap: if the bot itself leaves
 * (auto-leave, /leave) while users are still in the channel, their sessions
 * stay open until they personally leave too, rather than closing right
 * when the bot does - acceptable slop for a usage metric, not worth the
 * extra bookkeeping to close out every open session on every bot departure.
 */
export function registerVoiceSessionTracking() {
  discordClient.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
    const member = newState.member ?? oldState.member;
    if (!member || member.user.bot) return;

    const guildId = newState.guild.id;
    const botChannelId = getVoiceConnection(guildId)?.joinConfig.channelId;
    if (!botChannelId) return;

    const wasWithBot = oldState.channelId === botChannelId;
    const isWithBot = newState.channelId === botChannelId;

    if (!wasWithBot && isWithBot) await startVoiceSession(member.id);
    else if (wasWithBot && !isWithBot) await endVoiceSession(member.id);
  });
}
