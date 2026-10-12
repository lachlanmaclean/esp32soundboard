import { Router } from "express";
import path from "path";
import { prisma } from "../../db";
import { env } from "../../env";
import { getYoutubeMetadata, downloadYoutubeAudio, scheduleYoutubeTempCleanup, YoutubeError } from "../../youtube";
import { triggerLocalFilePlayback, triggerStopPlayback, triggerVolumeChange, BotProxyError } from "../botClient";
import { recordPlayEvent } from "../../analytics";

export const youtubeRouter = Router();

// A streamUrl the client holds is just "/uploads/youtube-tmp/<name>.<ext>" -
// reject anything that doesn't match that exact shape before turning it
// back into a filesystem path, so a crafted value can't escape the tmp dir.
const STREAM_URL_PATTERN = /^\/uploads\/youtube-tmp\/([A-Za-z0-9_-]+\.[A-Za-z0-9]+)$/;

// The player bar's Discord volume slider, as a percentage of the track's own level.
function isValidVolume(volume: unknown): volume is number {
  return typeof volume === "number" && Number.isFinite(volume) && volume >= 0 && volume <= 100;
}

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
  const { userId, streamUrl, volume = 100 } = req.body as { userId?: string; streamUrl?: string; volume?: number };
  if (!userId || !streamUrl) {
    return res.status(400).json({ error: "userId and streamUrl are required" });
  }
  if (!isValidVolume(volume)) {
    return res.status(400).json({ error: "volume must be a number between 0 and 100" });
  }

  const filePath = resolveStreamUrlToPath(streamUrl);
  if (!filePath) {
    return res.status(400).json({ error: "Invalid streamUrl" });
  }

  try {
    await requireProUser(userId);
    await triggerLocalFilePlayback(userId, filePath, volume);
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

/** Changes the current track's Discord volume live - used by the web player's volume slider. */
youtubeRouter.post("/volume", async (req, res) => {
  const { userId, volume } = req.body as { userId?: string; volume?: number };
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }
  if (!isValidVolume(volume)) {
    return res.status(400).json({ error: "volume must be a number between 0 and 100" });
  }

  try {
    await triggerVolumeChange(userId, volume);
    return res.status(202).json({ ok: true });
  } catch (error) {
    if (error instanceof BotProxyError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("[youtube] volume change failed", error);
    return res.status(500).json({ error: "Volume change failed" });
  }
});

/** Stops whatever's currently playing - used by the web player's Stop control. */
youtubeRouter.post("/stop", async (req, res) => {
  const { userId } = req.body as { userId?: string };
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  try {
    await triggerStopPlayback(userId);
    return res.status(202).json({ ok: true });
  } catch (error) {
    if (error instanceof BotProxyError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("[youtube] stop failed", error);
    return res.status(500).json({ error: "Stop failed" });
  }
});
