import { Router } from "express";
import { prisma } from "../../db";
import { BOARD_SOUND_LIMIT } from "@gooseboard/shared";

export const presetsRouter = Router();

/** All of a user's presets, each with its slots and the sound at each position, for the Designer page. */
presetsRouter.get("/", async (req, res) => {
  const userId = req.query.userId as string | undefined;
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  let presets = await prisma.preset.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { slots: { include: { sound: true }, orderBy: { position: "asc" } } },
  });

  // Every user should always have somewhere to put sounds - create their
  // first preset lazily rather than making the Designer handle an
  // all-presets-empty state.
  if (presets.length === 0) {
    await prisma.preset.create({ data: { userId, name: "My Soundboard", isActive: true } });
    presets = await prisma.preset.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: { slots: { include: { sound: true }, orderBy: { position: "asc" } } },
    });
  }

  return res.json(presets);
});

presetsRouter.post("/", async (req, res) => {
  const { userId, name } = req.body as { userId?: string; name?: string };
  if (!userId || !name) {
    return res.status(400).json({ error: "userId and name are required" });
  }

  // Normal tier (the only one enforced so far - TODO(tiers): use
  // PRO_PRESET_LIMIT once per-user tier checks exist) is capped at one
  // preset ever, so the first one is activated automatically and every
  // later one has to be switched to deliberately.
  const existingCount = await prisma.preset.count({ where: { userId } });

  const preset = await prisma.preset.create({
    data: { userId, name, isActive: existingCount === 0 },
    include: { slots: { include: { sound: true }, orderBy: { position: "asc" } } },
  });

  return res.status(201).json(preset);
});

presetsRouter.patch("/:id", async (req, res) => {
  const { name, isActive } = req.body as { name?: string; isActive?: boolean };

  const preset = await prisma.preset.findUnique({ where: { id: req.params.id } });
  if (!preset) {
    return res.status(404).json({ error: "Preset not found" });
  }

  if (isActive) {
    // Only one active preset per user - that's the one synced to their
    // device, so deactivate any other before activating this one.
    await prisma.preset.updateMany({
      where: { userId: preset.userId, id: { not: preset.id } },
      data: { isActive: false },
    });
  }

  const updated = await prisma.preset.update({
    where: { id: preset.id },
    data: { ...(name !== undefined ? { name } : {}), ...(isActive !== undefined ? { isActive } : {}) },
    include: { slots: { include: { sound: true }, orderBy: { position: "asc" } } },
  });

  return res.json(updated);
});

presetsRouter.delete("/:id", async (req, res) => {
  const preset = await prisma.preset.findUnique({ where: { id: req.params.id } });
  if (!preset) {
    return res.status(404).json({ error: "Preset not found" });
  }

  await prisma.preset.delete({ where: { id: preset.id } });

  // If that was the active one, promote whichever preset is oldest so the
  // user (and their device) always has some active board rather than none.
  if (preset.isActive) {
    const next = await prisma.preset.findFirst({ where: { userId: preset.userId }, orderBy: { createdAt: "asc" } });
    if (next) await prisma.preset.update({ where: { id: next.id }, data: { isActive: true } });
  }

  return res.status(204).send();
});

/** Assigns a library sound to a slot, replacing whatever was there. */
presetsRouter.put("/:id/slots/:position", async (req, res) => {
  const { soundId } = req.body as { soundId?: string };
  const position = Number(req.params.position);

  if (!soundId || !Number.isInteger(position) || position < 0 || position >= BOARD_SOUND_LIMIT) {
    return res.status(400).json({ error: `soundId is required and position must be 0-${BOARD_SOUND_LIMIT - 1}` });
  }

  const preset = await prisma.preset.findUnique({ where: { id: req.params.id } });
  if (!preset) {
    return res.status(404).json({ error: "Preset not found" });
  }

  const sound = await prisma.sound.findFirst({ where: { id: soundId, userId: preset.userId } });
  if (!sound) {
    return res.status(404).json({ error: "Sound not found" });
  }

  const slot = await prisma.presetSlot.upsert({
    where: { presetId_position: { presetId: preset.id, position } },
    create: { presetId: preset.id, position, soundId },
    update: { soundId },
    include: { sound: true },
  });
  await prisma.preset.update({ where: { id: preset.id }, data: { updatedAt: new Date() } });

  return res.json(slot);
});

presetsRouter.delete("/:id/slots/:position", async (req, res) => {
  const position = Number(req.params.position);

  await prisma.presetSlot
    .delete({ where: { presetId_position: { presetId: req.params.id, position } } })
    .catch(() => null);
  await prisma.preset.update({ where: { id: req.params.id }, data: { updatedAt: new Date() } }).catch(() => null);

  return res.status(204).send();
});
