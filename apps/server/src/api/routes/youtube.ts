import { Router } from "express";
import path from "path";
import { prisma } from "../../db";
import { env } from "../../env";
import { getYoutubeMetadata, downloadYoutubeAudio, scheduleYoutubeTempCleanup, YoutubeError } from "../../youtube";
import { triggerLocalFilePlayback, BotProxyError } from "../botClient";
import { recordPlayEvent } from "../../analytics";

export const youtubeRouter = Router();

// A streamUrl the client holds is just "/uploads/youtube-tmp/<name>.<ext>" -
// reject anything that doesn't match that exact shape before turning it
// back into a filesystem path, so a crafted value can't escape the tmp dir.
const STREAM_URL_PATTERN = /^\/uploads\/youtube-tmp\/([A-Za-z0-9_-]+\.[A-Za-z0-9]+)$/;

function resolveStreamUrlToPath(streamUrl: string): string | null {
  const match = STREAM_URL_PATTERN.exec(streamUrl);
  if (!match) return null;
  return path.join(env.uploadDir, "youtube-tmp", match[1]);
}

async function requireProUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new YoutubeError("User not found");
  if (user.tier !== "PRO") throw new YoutubeError("YouTube playback is a Pro feature");
  return user;
}

/** Looks up a video and downloads its audio for local preview - never saved to the user's library. */
youtubeRouter.post("/resolve", async (req, res) => {
  const { userId, url } = req.body as { userId?: string; url?: string };
  if (!userId || !url) {
    return res.status(400).json({ error: "userId and url are required" });
  }

  try {
    await requireProUser(userId);
    const metadata = await getYoutubeMetadata(url);
    const filePath = await downloadYoutubeAudio(url);
    scheduleYoutubeTempCleanup(filePath);

    return res.json({
      title: metadata.title,
      durationSeconds: metadata.durationSeconds,
      streamUrl: `/uploads/youtube-tmp/${path.basename(filePath)}`,
    });
  } catch (error) {
    if (error instanceof YoutubeError) {
      return res.status(error.message === "YouTube playback is a Pro feature" ? 403 : 422).json({ error: error.message });
    }
    console.error("[youtube] resolve failed", error);
    return res.status(502).json({ error: "Could not load that video" });
  }
});

/** Plays an already-downloaded preview straight into the user's Discord voice channel. */
youtubeRouter.post("/play", async (req, res) => {
  const { userId, streamUrl } = req.body as { userId?: string; streamUrl?: string };
  if (!userId || !streamUrl) {
    return res.status(400).json({ error: "userId and streamUrl are required" });
  }

  const filePath = resolveStreamUrlToPath(streamUrl);
  if (!filePath) {
    return res.status(400).json({ error: "Invalid streamUrl" });
  }

  try {
    await requireProUser(userId);
    await triggerLocalFilePlayback(userId, filePath);
    recordPlayEvent(userId, null, "DISCORD");
    return res.status(202).json({ ok: true });
  } catch (error) {
    if (error instanceof YoutubeError) {
      return res.status(error.message === "YouTube playback is a Pro feature" ? 403 : 422).json({ error: error.message });
    }
    if (error instanceof BotProxyError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("[youtube] play failed", error);
    return res.status(500).json({ error: "Playback failed" });
  }
});
