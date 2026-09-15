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
import type { VoiceBasedChannel } from "discord.js";

// One player per guild, kept alive alongside the connection so rapid taps
// reuse it instead of stacking subscriptions. Playing while already playing
// interrupts the current sound, which is what a soundboard should do.
const playersByGuild = new Map<string, AudioPlayer>();

function attachStateLogging(connection: VoiceConnection) {
  connection.on("stateChange", (oldState, newState) => {
    console.log(`[voice] connection ${oldState.status} -> ${newState.status}`);
  });
}

/** Always tears down any existing connection first, so callers get a clean one. */
export function joinFreshVoiceChannel(channel: VoiceBasedChannel) {
  getVoiceConnection(channel.guild.id)?.destroy();
  playersByGuild.delete(channel.guild.id);

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
 */
export async function playSoundInChannel(
  channel: VoiceBasedChannel,
  filePath: string,
  preEncoded: boolean,
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
  const resource = preEncoded
    ? createAudioResource(fs.createReadStream(filePath), { inputType: StreamType.OggOpus })
    : createAudioResource(filePath);

  player.play(resource);
}

/** Used by /leave, and whenever a connection should be torn down deliberately. */
export function leaveVoiceChannel(guildId: string) {
  getVoiceConnection(guildId)?.destroy();
  playersByGuild.delete(guildId);
}
