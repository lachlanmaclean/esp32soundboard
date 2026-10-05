import express from "express";
import { env } from "./env";
import { startBot } from "./bot/client";
import {
  playSoundForUser,
  playExternalSoundForUser,
  playLocalFileForUser,
  stopPlaybackForUser,
  findUserVoiceChannel,
  TriggerError,
} from "./bot/trigger";
import { RateLimitError } from "./cooldown";

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
      if (error instanceof RateLimitError) {
        return res.status(429).json({ error: error.message });
      }
      if (error instanceof TriggerError) {
        return res.status(409).json({ error: error.message });
      }
      console.error("[bot] internal trigger failed", error);
      return res.status(500).json({ error: "Playback failed" });
    }
  });

  app.post("/internal/trigger-external", async (req, res) => {
    const { userId, mp3Url } = req.body as { userId?: string; mp3Url?: string };
    if (!userId || !mp3Url) {
      return res.status(400).json({ error: "userId and mp3Url are required" });
    }

    try {
      await playExternalSoundForUser(userId, mp3Url);
      return res.status(202).json({ ok: true });
    } catch (error) {
      if (error instanceof RateLimitError) {
        return res.status(429).json({ error: error.message });
      }
      if (error instanceof TriggerError) {
        return res.status(409).json({ error: error.message });
      }
      console.error("[bot] external trigger failed", error);
      return res.status(500).json({ error: "Playback failed" });
    }
  });

  app.post("/internal/trigger-file", async (req, res) => {
    const { userId, filePath } = req.body as { userId?: string; filePath?: string };
    if (!userId || !filePath) {
      return res.status(400).json({ error: "userId and filePath are required" });
    }

    try {
      await playLocalFileForUser(userId, filePath);
      return res.status(202).json({ ok: true });
    } catch (error) {
      if (error instanceof RateLimitError) {
        return res.status(429).json({ error: error.message });
      }
      if (error instanceof TriggerError) {
        return res.status(409).json({ error: error.message });
      }
      console.error("[bot] local file trigger failed", error);
      return res.status(500).json({ error: "Playback failed" });
    }
  });

  app.post("/internal/stop", async (req, res) => {
    const { userId } = req.body as { userId?: string };
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    try {
      await stopPlaybackForUser(userId);
      return res.status(202).json({ ok: true });
    } catch (error) {
      if (error instanceof TriggerError) {
        return res.status(409).json({ error: error.message });
      }
      console.error("[bot] stop failed", error);
      return res.status(500).json({ error: "Stop failed" });
    }
  });

  app.get("/healthz", (_req, res) => res.json({ ok: true }));

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
