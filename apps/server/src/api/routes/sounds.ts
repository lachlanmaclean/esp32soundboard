import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";
import { prisma } from "../../db";
import { env } from "../../env";
import { triggerPlayback, BotProxyError } from "../botClient";
import { recordPlayEvent } from "../../analytics";
import { transcodeToOpus } from "../../audio";
import { deduplicateUpload, removeUploadedFile, canonicalAudioPath } from "../../storage";
import { ALLOWED_AUDIO_MIME_TYPES, MAX_AUDIO_FILE_BYTES, LIBRARY_SOUND_LIMIT, PRO_LIBRARY_SOUND_LIMIT } from "@gooseboard/shared";

export const soundsRouter = Router();

fs.mkdirSync(env.uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: env.uploadDir,
  filename: (_req, file, cb) => cb(null, `${nanoid()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_AUDIO_FILE_BYTES },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED_AUDIO_MIME_TYPES.includes(file.mimetype)),
});

async function deleteSoundFiles(sound: { id: string; audioUrl: string; fileHash: string }) {
  const filePath = path.join(env.uploadDir, path.basename(sound.audioUrl));
  const canonicalPath = canonicalAudioPath(sound.fileHash, path.extname(sound.audioUrl));
  const remainingReferences = await prisma.sound.count({ where: { fileHash: sound.fileHash } });
  removeUploadedFile(filePath, canonicalPath, remainingReferences);
}

/** Called from the portal's upload form - adds to the library. Assigning it to a soundboard slot is a separate step in the Designer. */
soundsRouter.post("/", upload.single("audio"), async (req, res) => {
  const { userId, displayName, color, icon } = req.body as Record<string, string | undefined>;

  if (!req.file) {
    return res.status(400).json({ error: "audio file is required (mp3/wav/ogg, max 5MB)" });
  }
  if (!userId || !displayName || !color) {
    fs.unlink(path.join(env.uploadDir, req.file.filename), () => {});
    return res.status(400).json({ error: "userId, displayName and color are required" });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    fs.unlink(path.join(env.uploadDir, req.file.filename), () => {});
    return res.status(404).json({ error: "User not found" });
  }

  const libraryLimit = user.tier === "PRO" ? PRO_LIBRARY_SOUND_LIMIT : LIBRARY_SOUND_LIMIT;
  const libraryCount = await prisma.sound.count({ where: { userId } });
  if (libraryCount >= libraryLimit) {
    fs.unlink(path.join(env.uploadDir, req.file.filename), () => {});
    return res.status(409).json({ error: `Library is full (max ${libraryLimit} sounds) - delete one first` });
  }

  const uploadedPath = path.join(env.uploadDir, req.file.filename);
  const { fileHash, canonicalPath } = await deduplicateUpload(uploadedPath, path.extname(req.file.filename));

  const sound = await prisma.sound.create({
    data: {
      userId,
      displayName,
      color,
      icon: icon || null,
      audioUrl: `/uploads/${req.file.filename}`,
      fileHash,
    },
  });

  // Pre-encode for Discord now so the first tap isn't the one that pays for
  // it. Shared across every sound with this hash, so a duplicate upload
  // skips straight to an already-encoded file. Playback falls back to the
  // original if this fails.
  try {
    await transcodeToOpus(canonicalPath);
  } catch (error) {
    console.error("[sounds] pre-encoding to Opus failed", error);
  }

  return res.status(201).json(sound);
});

/** Manual test-play from the portal, bypassing a physical device. */
soundsRouter.post("/:id/play", async (req, res) => {
  const { userId } = req.body as { userId?: string };
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  try {
    await triggerPlayback(userId, req.params.id);
    recordPlayEvent(userId, req.params.id, "WEB");
    return res.status(202).json({ ok: true });
  } catch (error) {
    if (error instanceof BotProxyError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("[sounds] test playback failed", error);
    return res.status(500).json({ error: "Playback failed" });
  }
});

/** Called from the portal's volume slider on each sound. */
soundsRouter.patch("/:id/volume", async (req, res) => {
  const { volume } = req.body as { volume?: number };

  if (typeof volume !== "number" || !Number.isFinite(volume) || volume < 0 || volume > 200) {
    return res.status(400).json({ error: "volume must be a number between 0 and 200" });
  }

  const sound = await prisma.sound.findUnique({ where: { id: req.params.id } });
  if (!sound) {
    return res.status(404).json({ error: "Sound not found" });
  }

  const updated = await prisma.sound.update({
    where: { id: sound.id },
    data: { volume: Math.round(volume) },
  });

  return res.json(updated);
});

soundsRouter.delete("/:id", async (req, res) => {
  const sound = await prisma.sound.findUnique({ where: { id: req.params.id } });
  if (!sound) {
    return res.status(404).json({ error: "Sound not found" });
  }

  await prisma.sound.delete({ where: { id: sound.id } });
  await deleteSoundFiles(sound);

  return res.status(204).send();
});
