import { Client, GatewayIntentBits } from "discord.js";
import { env } from "../env";
import { registerBotCommands } from "./commands";

export const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

export async function startBot() {
  discordClient.once("ready", (client) => {
    console.log(`[bot] logged in as ${client.user.tag}`);
  });

  registerBotCommands();

  await discordClient.login(env.discordBotToken);
}
