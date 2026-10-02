import { Router } from "express";
import { searchMyinstants, isMyinstantsAudioUrl } from "../../library/myinstants";
import { triggerExternalPlayback, BotProxyError } from "../botClient";

export const libraryRouter = Router();

/** Backs the portal's "meme library" search, proxying myinstants.com so the browser never talks to it directly. */
libraryRouter.get("/search", async (req, res) => {
  const query = req.query.q as string | undefined;
  if (!query || !query.trim()) {
    return res.status(400).json({ error: "q is required" });
  }

  try {
    const results = await searchMyinstants(query.trim());
    return res.json(results);
  } catch (error) {
    console.error("[library] myinstants search failed", error);
    return res.status(502).json({ error: "Search failed" });
  }
});

/** Plays a myinstants clip straight from its URL - nothing stored in the user's own library. */
libraryRouter.post("/play", async (req, res) => {
  const { userId, mp3Url } = req.body as { userId?: string; mp3Url?: string };
  if (!userId || !mp3Url) {
    return res.status(400).json({ error: "userId and mp3Url are required" });
  }
  if (!isMyinstantsAudioUrl(mp3Url)) {
    return res.status(400).json({ error: "mp3Url must be a myinstants.com sound" });
  }

  try {
    await triggerExternalPlayback(userId, mp3Url);
    return res.status(202).json({ ok: true });
  } catch (error) {
    if (error instanceof BotProxyError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("[library] playback failed", error);
    return res.status(500).json({ error: "Playback failed" });
  }
});
