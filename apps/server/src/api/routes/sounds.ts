import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";
import { prisma } from "../../db";
import { env } from "../../env";
import { triggerPlayback, BotProxyError } from "../botClient";
import { transcodeToOpus, opusPathFor } from "../../audio";
import { ALLOWED_AUDIO_MIME_TYPES, MAX_AUDIO_FILE_BYTES, MAX_SOUNDS_PER_USER } from "@gooseboard/shared";

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

function deleteFile(filename: string) {
  const sourcePath = path.join(env.uploadDir, filename);
  fs.unlink(sourcePath, () => {});
  fs.unlink(opusPathFor(sourcePath), () => {});
}

/** Called from the portal's upload form (proxied, since only this container has the uploads volume). */
soundsRouter.post("/", upload.single("audio"), async (req, res) => {
  const { userId, displayName, color, icon } = req.body as Record<string, string | undefined>;

  if (!req.file) {
    return res.status(400).json({ error: "audio file is required (mp3/wav/ogg, max 5MB)" });
  }
  if (!userId || !displayName || !color) {
    deleteFile(req.file.filename);
    return res.status(400).json({ error: "userId, displayName and color are required" });
  }

  const count = await prisma.sound.count({ where: { userId } });
  if (count >= MAX_SOUNDS_PER_USER) {
    deleteFile(req.file.filename);
    return res.status(409).json({ error: `Max ${MAX_SOUNDS_PER_USER} sounds per user` });
  }

  const sound = await prisma.sound.create({
    data: { userId, displayName, color, icon: icon || null, audioUrl: `/uploads/${req.file.filename}` },
  });

  // Pre-encode for Discord now so the first tap isn't the one that pays for
  // it. Playback falls back to the original file if this fails.
  try {
    await transcodeToOpus(path.join(env.uploadDir, req.file.filename));
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
    return res.status(202).json({ ok: true });
  } catch (error) {
    if (error instanceof BotProxyError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("[sounds] test playback failed", error);
    return res.status(500).json({ error: "Playback failed" });
  }
});

soundsRouter.delete("/:id", async (req, res) => {
  const sound = await prisma.sound.findUnique({ where: { id: req.params.id } });
  if (!sound) {
    return res.status(404).json({ error: "Sound not found" });
  }

  await prisma.sound.delete({ where: { id: sound.id } });
  deleteFile(path.basename(sound.audioUrl));

  return res.status(204).send();
});
