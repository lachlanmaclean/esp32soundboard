import express from "express";
import { env } from "./env";
import { startBot } from "./bot/client";
import { playSoundForUser, findUserVoiceChannel, TriggerError } from "./bot/trigger";

/**
 * Separate process from the public API, run with Docker's host networking.
 * Discord voice needs direct UDP for its IP-discovery handshake, which
 * Docker's default bridge-network NAT breaks - the API's bridge networking
 * is fine since it's plain HTTP. Not reachable publicly; the API proxies to
 * it internally for anything that needs the live bot connection.
 */
async function main() {
  await startBot();

  const app = express();
  app.use(express.json());

  app.post("/internal/trigger", async (req, res) => {
    const { userId, soundId } = req.body as { userId?: string; soundId?: string };
    if (!userId || !soundId) {
      return res.status(400).json({ error: "userId and soundId are required" });
    }

    try {
      await playSoundForUser(userId, soundId);
      return res.status(202).json({ ok: true });
    } catch (error) {
      if (error instanceof TriggerError) {
        return res.status(409).json({ error: error.message });
      }
      console.error("[bot] internal trigger failed", error);
      return res.status(500).json({ error: "Playback failed" });
    }
  });

  app.get("/internal/voice-status", (req, res) => {
    const discordId = req.query.discordId as string | undefined;
    if (!discordId) {
      return res.status(400).json({ error: "discordId is required" });
    }

    const channel = findUserVoiceChannel(discordId);
    return res.json({ inVoiceChannel: channel !== null });
  });

  app.listen(env.botInternalPort, () => {
    console.log(`[bot] internal API listening on :${env.botInternalPort}`);
  });
}

main().catch((error) => {
  console.error("Fatal error during bot startup", error);
  process.exit(1);
});
