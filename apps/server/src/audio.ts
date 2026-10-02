import { spawn } from "child_process";
import fs from "fs";

/**
 * Discord voice transmits 48kHz stereo Opus. Pre-encoding uploads into that
 * exact format means playback can stream the file straight out - no ffmpeg
 * process to spawn and no Opus encoding on the hot path, which is most of
 * the delay between tapping a button and hearing the sound.
 */
export function opusPathFor(sourcePath: string) {
  return `${sourcePath}.opus.ogg`;
}

/**
 * Downloads a remote URL to a local file via ffmpeg's own fetching (stream
 * copy, no re-encode) instead of Node's fetch or curl - both of those get a
 * 403 from Cloudflare on myinstants.com's media URLs (TLS/client
 * fingerprinting, same as the HTML pages), while ffmpeg's own HTTP client
 * doesn't. Playback already depends on that working, so this reuses the
 * same proven path rather than a second, untested one.
 */
export function downloadViaFfmpeg(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", ["-i", url, "-c", "copy", "-y", destPath]);

    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg download exited with code ${code}`));
    });
  });
}

export function transcodeToOpus(sourcePath: string): Promise<void> {
  const target = opusPathFor(sourcePath);

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i", sourcePath,
      "-c:a", "libopus",
      "-b:a", "96k",
      "-ar", "48000",
      "-ac", "2",
      "-f", "ogg",
      "-y", target,
    ]);

    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

/**
 * Returns the pre-encoded Opus file, transcoding it first if it doesn't exist
 * yet (sounds uploaded before pre-encoding existed). Null if transcoding
 * fails, so callers can fall back to the original file.
 */
export async function ensureOpusFile(sourcePath: string): Promise<string | null> {
  const target = opusPathFor(sourcePath);
  if (fs.existsSync(target)) return target;

  try {
    await transcodeToOpus(sourcePath);
    return target;
  } catch (error) {
    console.error("[audio] failed to transcode to Opus, falling back to source", error);
    return null;
  }
}
