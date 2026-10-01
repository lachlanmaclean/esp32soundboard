import { Client, GatewayIntentBits } from "discord.js";
import { env } from "../env";
import { registerBotCommands } from "./commands";
import { registerWelcomeMessage } from "./welcome";
import { registerAutoLeave } from "./playback";

export const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

export async function startBot() {
  discordClient.once("ready", (client) => {
    console.log(`[bot] logged in as ${client.user.tag}`);
  });

  registerBotCommands();
  registerWelcomeMessage();
  registerAutoLeave();

  await discordClient.login(env.discordBotToken);
}
