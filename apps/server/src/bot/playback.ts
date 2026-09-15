import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  entersState,
  VoiceConnectionStatus,
  AudioPlayerStatus,
} from "@discordjs/voice";
import type { VoiceBasedChannel } from "discord.js";

/**
 * Joins the given voice channel (if not already connected) and plays a single
 * audio file, then leaves once playback finishes.
 */
export async function playSoundInChannel(channel: VoiceBasedChannel, audioUrl: string) {
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
  });

  connection.on("stateChange", (oldState, newState) => {
    console.log(`[voice] connection ${oldState.status} -> ${newState.status}`);
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
  } catch (error) {
    connection.destroy();
    throw error;
  }

  const player = createAudioPlayer();
  const resource = createAudioResource(audioUrl);

  connection.subscribe(player);
  player.play(resource);

  return new Promise<void>((resolve, reject) => {
    player.on(AudioPlayerStatus.Idle, () => {
      connection.destroy();
      resolve();
    });
    player.on("error", (error) => {
      connection.destroy();
      reject(error);
    });
  });
}
