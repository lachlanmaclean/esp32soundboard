import fs from "fs";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  StreamType,
  VoiceConnection,
  VoiceConnectionStatus,
  AudioPlayer,
  NoSubscriberBehavior,
} from "@discordjs/voice";
import { Events, type VoiceBasedChannel, type VoiceState } from "discord.js";
import { discordClient } from "./client";

// One player per guild, kept alive alongside the connection so rapid taps
// reuse it instead of stacking subscriptions. Playing while already playing
// interrupts the current sound, which is what a soundboard should do.
const playersByGuild = new Map<string, AudioPlayer>();

// Pending auto-leave timers, so a quick disconnect/reconnect (or someone
// just switching channels) doesn't boot the bot out immediately.
const EMPTY_CHANNEL_LEAVE_DELAY_MS = 60_000;
const autoLeaveTimers = new Map<string, NodeJS.Timeout>();

function cancelAutoLeave(guildId: string) {
  const timer = autoLeaveTimers.get(guildId);
  if (timer) {
    clearTimeout(timer);
    autoLeaveTimers.delete(guildId);
  }
}

function attachStateLogging(connection: VoiceConnection) {
  connection.on("stateChange", (oldState, newState) => {
    console.log(`[voice] connection ${oldState.status} -> ${newState.status}`);
  });
}

/** Always tears down any existing connection first, so callers get a clean one. */
export function joinFreshVoiceChannel(channel: VoiceBasedChannel) {
  getVoiceConnection(channel.guild.id)?.destroy();
  playersByGuild.delete(channel.guild.id);
  cancelAutoLeave(channel.guild.id);

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
  });

  attachStateLogging(connection);
  return connection;
}

/**
 * Reuses a healthy connection to the same channel if one exists, so the bot
 * stays put between sounds rather than rejoining every time. Only rebuilds
 * when there's nothing usable, or the user has moved to another channel.
 */
function getOrCreateConnection(channel: VoiceBasedChannel) {
  const existing = getVoiceConnection(channel.guild.id);

  if (existing) {
    const sameChannel = existing.joinConfig.channelId === channel.id;
    const usable =
      existing.state.status === VoiceConnectionStatus.Ready ||
      existing.state.status === VoiceConnectionStatus.Connecting ||
      existing.state.status === VoiceConnectionStatus.Signalling;

    if (sameChannel && usable) return existing;
  }

  return joinFreshVoiceChannel(channel);
}

function getOrCreatePlayer(guildId: string, connection: VoiceConnection) {
  const existing = playersByGuild.get(guildId);
  if (existing) return existing;

  const player = createAudioPlayer({
    // The bot lingers in the channel with nobody subscribed between sounds;
    // without this it would stop rather than idle.
    behaviors: { noSubscriber: NoSubscriberBehavior.Play },
  });
  player.on("error", (error) => console.error("[voice] player error", error));

  connection.subscribe(player);
  playersByGuild.set(guildId, player);
  return player;
}

/**
 * Joins the user's voice channel if needed and starts playing a sound.
 * Returns once playback has started, not when it finishes — the bot stays
 * connected afterwards, ready for the next tap.
 *
 * `preEncoded` files are already 48kHz stereo Opus, so they stream straight
 * through: no ffmpeg process to spawn, no Opus encoding. Anything else goes
 * down the slow path where @discordjs/voice shells out to ffmpeg.
 *
 * `volumePercent` only turns on inline volume mixing when it's not the 100
 * (unchanged) default - that mixing needs to decode and re-encode Opus in
 * real time, which is exactly the per-tap cost pre-encoding was added to
 * avoid, so sounds left at their default volume stay on the fast path.
 */
export async function playSoundInChannel(
  channel: VoiceBasedChannel,
  filePath: string,
  preEncoded: boolean,
  volumePercent = 100,
) {
  const connection = getOrCreateConnection(channel);

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
  } catch (error) {
    connection.destroy();
    playersByGuild.delete(channel.guild.id);
    throw error;
  }

  const player = getOrCreatePlayer(channel.guild.id, connection);
  const needsVolumeMixing = volumePercent !== 100;

  const resource = preEncoded
    ? createAudioResource(fs.createReadStream(filePath), {
        inputType: StreamType.OggOpus,
        inlineVolume: needsVolumeMixing,
      })
    : createAudioResource(filePath, { inlineVolume: needsVolumeMixing });

  if (needsVolumeMixing) {
    resource.volume?.setVolume(volumePercent / 100);
  }

  player.play(resource);
}

/** Stops whatever's currently playing without leaving the channel - used by the web player's Stop control. */
export function stopPlayback(guildId: string) {
  playersByGuild.get(guildId)?.stop();
}

/** Used by /leave, and whenever a connection should be torn down deliberately. */
export function leaveVoiceChannel(guildId: string) {
  getVoiceConnection(guildId)?.destroy();
  playersByGuild.delete(guildId);
  cancelAutoLeave(guildId);
}

/** True if nobody but the bot itself remains in the voice channel it's connected to. */
function isConnectedChannelEmpty(guildId: string, channel: VoiceBasedChannel) {
  const connection = getVoiceConnection(guildId);
  if (!connection || connection.joinConfig.channelId !== channel.id) return false;

  return !channel.members.some((member) => !member.user.bot);
}

/**
 * Leaves a voice channel once every human has been gone from it for a full
 * delay, rather than the instant it empties — so a quick rejoin (or everyone
 * briefly bouncing between channels) doesn't boot the bot out needlessly.
 */
export function registerAutoLeave() {
  discordClient.on(Events.VoiceStateUpdate, (oldState: VoiceState, newState: VoiceState) => {
    const guildId = oldState.guild.id;

    // Someone (re)joined the bot's channel: call off any pending leave.
    if (newState.channel && isSameChannelAsBot(guildId, newState.channel) && !newState.member?.user.bot) {
      cancelAutoLeave(guildId);
      return;
    }

    const channel = oldState.channel;
    if (!channel || !isConnectedChannelEmpty(guildId, channel)) return;
    if (autoLeaveTimers.has(guildId)) return;

    const timer = setTimeout(() => {
      autoLeaveTimers.delete(guildId);
      if (isConnectedChannelEmpty(guildId, channel)) leaveVoiceChannel(guildId);
    }, EMPTY_CHANNEL_LEAVE_DELAY_MS);

    autoLeaveTimers.set(guildId, timer);
  });
}

function isSameChannelAsBot(guildId: string, channel: VoiceBasedChannel) {
  return getVoiceConnection(guildId)?.joinConfig.channelId === channel.id;
}
