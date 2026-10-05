import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { env } from "./env";

const execFileAsync = promisify(execFile);

export const YOUTUBE_MAX_DURATION_SECONDS = 15 * 60;

export class YoutubeError extends Error {}

export interface YoutubeMetadata {
  title: string;
  durationSeconds: number;
}

const tmpDir = path.join(env.uploadDir, "youtube-tmp");
fs.mkdirSync(tmpDir, { recursive: true });

function isYoutubeUrl(url: string) {
  try {
    const { hostname } = new URL(url);
    return ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "music.youtube.com"].includes(hostname);
  } catch {
    return false;
  }
}

/** Fast metadata-only lookup (no download) - used to reject anything over the length cap before spending time on a real download. */
export async function getYoutubeMetadata(url: string): Promise<YoutubeMetadata> {
  if (!isYoutubeUrl(url)) {
    throw new YoutubeError("Only youtube.com/youtu.be links are supported");
  }

  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(
      "python3",
      ["-m", "yt_dlp", "--dump-json", "--no-playlist", "--skip-download", url],
      { timeout: 20_000, maxBuffer: 10 * 1024 * 1024 },
    ));
  } catch (error) {
    console.error(`[youtube] metadata lookup failed for ${url}`, error);
    throw new YoutubeError("Could not look up that video");
  }

  let data: { title?: string; duration?: number };
  try {
    data = JSON.parse(stdout);
  } catch (error) {
    console.error(`[youtube] metadata response was not valid JSON for ${url}`, stdout.slice(0, 500));
    throw new YoutubeError("Could not look up that video");
  }

  const durationSeconds = Math.round(data.duration ?? 0);
  if (durationSeconds > YOUTUBE_MAX_DURATION_SECONDS) {
    throw new YoutubeError(`That video is too long - max ${YOUTUBE_MAX_DURATION_SECONDS / 60} minutes`);
  }

  return { title: data.title ?? "Untitled", durationSeconds };
}

/**
 * Downloads the best available audio-only stream, no re-encoding by yt-dlp
 * itself - whatever container YouTube serves (usually webm/opus or m4a)
 * goes straight to disk. Both Discord playback (ffmpeg transcodes any input
 * format already) and the web preview player (browsers play webm/m4a audio
 * natively) can use it as-is, so there's no reason to make yt-dlp shell out
 * to ffmpeg a second time just to produce an intermediate format.
 *
 * Caller owns cleanup - this never touches the user's library/DB, matching
 * "ephemeral, never saved."
 */
export async function downloadYoutubeAudio(url: string): Promise<string> {
  const destTemplate = path.join(tmpDir, `${nanoid()}.%(ext)s`);

  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(
      "python3",
      ["-m", "yt_dlp", "-f", "bestaudio", "--no-playlist", "--print", "after_move:filepath", "-o", destTemplate, url],
      { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 },
    ));
  } catch (error) {
    console.error(`[youtube] audio download failed for ${url}`, error);
    throw new YoutubeError("Could not download that video's audio");
  }

  const filePath = stdout.trim().split("\n").pop();
  if (!filePath || !fs.existsSync(filePath)) {
    throw new YoutubeError("Could not download that video's audio");
  }

  return filePath;
}

/** Deletes a downloaded file after a delay, so a slow web preview load or a slightly-delayed Discord playback start isn't cut off. */
export function scheduleYoutubeTempCleanup(filePath: string, delayMs = 10 * 60 * 1000) {
  setTimeout(() => fs.unlink(filePath, () => {}), delayMs);
}
