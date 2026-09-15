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

  // TEMPORARY: diagnosing voice connections getting stuck in "signalling" —
  // confirms whether Discord's gateway is sending these at all.
  discordClient.on("raw", (packet: { t?: string; d?: unknown }) => {
    if (packet.t === "VOICE_STATE_UPDATE" || packet.t === "VOICE_SERVER_UPDATE") {
      console.log(`[gateway-raw] ${packet.t}`, JSON.stringify(packet.d));
    }
  });

  registerBotCommands();

  await discordClient.login(env.discordBotToken);
}
