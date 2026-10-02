import path from "path";
import { nanoid } from "nanoid";
import { env } from "../env";
import { prisma } from "../db";
import { transcodeToOpus, downloadViaFfmpeg } from "../audio";
import { deduplicateUpload } from "../storage";

// myinstants results have no color of their own - pick a stable one from the
// name so the same sound always lands on the same color rather than looking
// random on every import.
const PALETTE = ["#5865F2", "#23A55A", "#F23F43", "#FAA61A", "#EB459E", "#00A8FC"];

function colorFor(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

/** Downloads a myinstants clip into the user's own library, sharing the same dedup/pre-encode path as a direct upload. */
export async function importMyinstantsSound(userId: string, mp3Url: string, displayName: string) {
  const ext = path.extname(new URL(mp3Url).pathname) || ".mp3";
  const tempPath = path.join(env.uploadDir, `${nanoid()}${ext}`);

  await downloadViaFfmpeg(mp3Url, tempPath);

  const { fileHash, canonicalPath } = await deduplicateUpload(tempPath, ext);

  const sound = await prisma.sound.create({
    data: {
      userId,
      displayName,
      color: colorFor(displayName),
      icon: "🤣",
      audioUrl: `/uploads/${path.basename(tempPath)}`,
      fileHash,
      onBoard: false,
    },
  });

  try {
    await transcodeToOpus(canonicalPath);
  } catch (error) {
    console.error("[library] pre-encoding imported sound to Opus failed", error);
  }

  return sound;
}
