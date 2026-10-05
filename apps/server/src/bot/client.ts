import { Client, GatewayIntentBits } from "discord.js";
import { env } from "../env";
import { registerBotCommands } from "./commands";
import { registerWelcomeMessage } from "./welcome";
import { registerAutoLeave } from "./playback";
import { registerVoiceSessionTracking } from "../analytics";

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
  registerVoiceSessionTracking();

  await discordClient.login(env.discordBotToken);
}
