import { Router } from "express";
import { prisma } from "../../db";
import { BOARD_SOUND_LIMIT, LIBRARY_SOUND_LIMIT } from "@gooseboard/shared";

export const presetsRouter = Router();

/**
 * How many slots a preset can hold, by the owner's tier. Pro presets are
 * capped at the CYD's physical grid size since that's the most a device can
 * ever show; Normal accounts have no device at all, so their one preset is
 * sized to their library limit instead.
 */
function slotLimitFor(tier: "NORMAL" | "PRO") {
  return tier === "PRO" ? BOARD_SOUND_LIMIT : LIBRARY_SOUND_LIMIT;
}

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

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const existingCount = await prisma.preset.count({ where: { userId } });

  // Normal tier is capped at exactly one preset ever (no concept of
  // "presets" is even shown to them - this is a backstop, not the primary
  // gate, which lives in the portal UI).
  if (user.tier !== "PRO" && existingCount >= 1) {
    return res.status(403).json({ error: "Upgrade to Pro for more than one soundboard" });
  }

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

/**
 * Appends a sound to the next open position. Slots are always kept
 * compacted (no gaps, filled positions 0..n-1) so the web Designer and the
 * physical device - which just draws however many buttons it's sent, with
 * no concept of "empty" - can never disagree about layout.
 */
presetsRouter.post("/:id/slots", async (req, res) => {
  const { soundId } = req.body as { soundId?: string };
  if (!soundId) {
    return res.status(400).json({ error: "soundId is required" });
  }

  const preset = await prisma.preset.findUnique({
    where: { id: req.params.id },
    include: { user: true, slots: true },
  });
  if (!preset) {
    return res.status(404).json({ error: "Preset not found" });
  }

  const sound = await prisma.sound.findFirst({ where: { id: soundId, userId: preset.userId } });
  if (!sound) {
    return res.status(404).json({ error: "Sound not found" });
  }

  const limit = slotLimitFor(preset.user.tier);
  if (preset.slots.length >= limit) {
    return res.status(409).json({ error: `This board is full (max ${limit} sounds)` });
  }

  const slot = await prisma.presetSlot.create({
    data: { presetId: preset.id, position: preset.slots.length, soundId },
    include: { sound: true },
  });
  await prisma.preset.update({ where: { id: preset.id }, data: { updatedAt: new Date() } });

  return res.status(201).json(slot);
});

/** Changes which sound sits at an already-filled position, without touching its place in the order. */
presetsRouter.put("/:id/slots/:position", async (req, res) => {
  const { soundId } = req.body as { soundId?: string };
  const position = Number(req.params.position);

  if (!soundId || !Number.isInteger(position) || position < 0) {
    return res.status(400).json({ error: "soundId is required and position must be a non-negative integer" });
  }

  const preset = await prisma.preset.findUnique({ where: { id: req.params.id } });
  if (!preset) {
    return res.status(404).json({ error: "Preset not found" });
  }

  const existing = await prisma.presetSlot.findUnique({
    where: { presetId_position: { presetId: preset.id, position } },
  });
  if (!existing) {
    return res.status(404).json({ error: "No sound at that position yet - add one instead of editing it" });
  }

  const sound = await prisma.sound.findFirst({ where: { id: soundId, userId: preset.userId } });
  if (!sound) {
    return res.status(404).json({ error: "Sound not found" });
  }

  const updated = await prisma.presetSlot.update({
    where: { id: existing.id },
    data: { soundId },
    include: { sound: true },
  });
  await prisma.preset.update({ where: { id: preset.id }, data: { updatedAt: new Date() } });

  return res.json(updated);
});

/** Removes a slot and shifts every later one down by one, so positions stay gap-free. */
presetsRouter.delete("/:id/slots/:position", async (req, res) => {
  const position = Number(req.params.position);
  if (!Number.isInteger(position) || position < 0) {
    return res.status(400).json({ error: "position must be a non-negative integer" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.presetSlot.deleteMany({ where: { presetId: req.params.id, position } });

    const remaining = await tx.presetSlot.findMany({
      where: { presetId: req.params.id },
      orderBy: { position: "asc" },
    });

    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].position !== i) {
        await tx.presetSlot.update({ where: { id: remaining[i].id }, data: { position: i } });
      }
    }

    await tx.preset.update({ where: { id: req.params.id }, data: { updatedAt: new Date() } });
  });

  return res.status(204).send();
});
