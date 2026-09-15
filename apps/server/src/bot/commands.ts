import { Events, SlashCommandBuilder, GuildMember } from "discord.js";
import { entersState, VoiceConnectionStatus } from "@discordjs/voice";
import { discordClient } from "./client";
import { joinFreshVoiceChannel, leaveVoiceChannel } from "./playback";
import { buildHelpEmbed } from "./welcome";

const commands = [
  new SlashCommandBuilder().setName("join").setDescription("Bring Gooseboard into your current voice channel").toJSON(),
  new SlashCommandBuilder().setName("leave").setDescription("Disconnect Gooseboard from voice").toJSON(),
  new SlashCommandBuilder().setName("help").setDescription("Show Gooseboard's commands and portal link").toJSON(),
];

async function registerCommandsForGuild(guildId: string) {
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) return;
  await guild.commands.set(commands);
}

export function registerBotCommands() {
  discordClient.once(Events.ClientReady, async (client) => {
    for (const guildId of client.guilds.cache.keys()) {
      await registerCommandsForGuild(guildId).catch((error) =>
        console.error(`[bot] failed to register commands for guild ${guildId}`, error),
      );
    }
  });

  // Registers commands the moment the bot is invited to a new server, rather
  // than waiting for the next process restart.
  discordClient.on(Events.GuildCreate, (guild) => {
    registerCommandsForGuild(guild.id).catch((error) =>
      console.error(`[bot] failed to register commands for guild ${guild.id}`, error),
    );
  });

  discordClient.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "join") {
      const member = interaction.member instanceof GuildMember ? interaction.member : null;
      const channel = member?.voice.channel;

      if (!channel) {
        await interaction.reply({ content: "Join a voice channel first, then run this again.", ephemeral: true });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const connection = joinFreshVoiceChannel(channel);

      try {
        await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
        await interaction.editReply(`Joined **${channel.name}**.`);
      } catch (error) {
        connection.destroy();
        console.error("[bot] /join failed", error);
        await interaction.editReply("Couldn't establish a voice connection (timed out) — check the server logs.");
      }
      return;
    }

    if (interaction.commandName === "leave") {
      if (interaction.guildId) leaveVoiceChannel(interaction.guildId);
      await interaction.reply({ content: "Left voice.", ephemeral: true });
      return;
    }

    if (interaction.commandName === "help") {
      await interaction.reply({ embeds: [buildHelpEmbed()], ephemeral: true });
    }
  });
}
