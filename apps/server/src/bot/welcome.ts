import { ChannelType, EmbedBuilder, Events, PermissionsBitField, type Guild, type TextChannel } from "discord.js";
import { env } from "../env";
import { discordClient } from "./client";

function displayUrl(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** Shared by the join announcement and /help so they can't drift apart. */
export function buildHelpEmbed() {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🪿 Gooseboard")
    .setDescription("Thanks for adding me! I play sounds into whichever voice channel you're in.")
    .addFields(
      {
        name: "Getting started",
        value: [
          "`/join` — bring me into your current voice channel",
          "`/leave` — disconnect me from voice",
          "`/help` — show this message again",
        ].join("\n"),
      },
      {
        name: "Playing sounds",
        value: `Hop into a voice channel, then tap a sound on the [web soundboard](${env.portalUrl}/board) or your Gooseboard device. I'll follow you in automatically.`,
      },
      {
        name: "Manage your sounds",
        value: `Upload sounds, set colours and icons, and pair a device at [${displayUrl(env.portalUrl)}](${env.portalUrl}).`,
      },
    );
}

/** First channel the bot can actually post in, preferring the server's system channel. */
async function findWelcomeChannel(guild: Guild): Promise<TextChannel | null> {
  const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  if (!me) return null;

  const canPost = (channel: TextChannel) =>
    channel
      .permissionsFor(me)
      ?.has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]) ?? false;

  if (guild.systemChannel && canPost(guild.systemChannel)) return guild.systemChannel;

  return (
    guild.channels.cache.find(
      (channel): channel is TextChannel => channel.type === ChannelType.GuildText && canPost(channel),
    ) ?? null
  );
}

export function registerWelcomeMessage() {
  discordClient.on(Events.GuildCreate, async (guild) => {
    const channel = await findWelcomeChannel(guild);

    if (!channel) {
      console.log(`[bot] joined "${guild.name}" but has no channel it can post in`);
      return;
    }

    await channel
      .send({ embeds: [buildHelpEmbed()] })
      .catch((error) => console.error("[bot] failed to post welcome message", error));
  });
}
