import { Router } from "express";
import { customAlphabet } from "nanoid";
import { prisma } from "../../db";
import { triggerPlayback, BotProxyError } from "../botClient";
import { PAIRING_CODE_LENGTH, PAIRING_CODE_TTL_MS } from "@gooseboard/shared";
import type { DeviceRegisterRequest, DeviceRegisterResponse, TriggerSoundRequest } from "@gooseboard/shared";

export const devicesRouter = Router();

// Unambiguous alphabet (no 0/O/1/I) for a code a human retypes off a small screen.
const generatePairingCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", PAIRING_CODE_LENGTH);

/**
 * A CYD calls this on first boot (after Wi-Fi is configured) and on every
 * check-in thereafter. If it has no paired user yet, it gets back a fresh
 * pairing code to display; if it's already paired, `paired: true` and no code.
 */
devicesRouter.post("/register", async (req, res) => {
  const { cuid, firmwareVersion } = req.body as DeviceRegisterRequest;

  if (!cuid || typeof cuid !== "string") {
    return res.status(400).json({ error: "cuid is required" });
  }

  const existing = await prisma.device.findUnique({ where: { cuid } });

  if (existing?.userId) {
    await prisma.device.update({
      where: { cuid },
      data: { lastSeenAt: new Date() },
    });

    const response: DeviceRegisterResponse = { cuid, pairingCode: null, paired: true };
    return res.json(response);
  }

  const needsNewCode =
    !existing?.pairingCode ||
    !existing.pairingCodeExpiresAt ||
    existing.pairingCodeExpiresAt < new Date();

  const pairingCode = needsNewCode ? generatePairingCode() : existing!.pairingCode!;
  const pairingCodeExpiresAt = needsNewCode
    ? new Date(Date.now() + PAIRING_CODE_TTL_MS)
    : existing!.pairingCodeExpiresAt!;

  await prisma.device.upsert({
    where: { cuid },
    create: { cuid, pairingCode, pairingCodeExpiresAt, lastSeenAt: new Date() },
    update: { pairingCode, pairingCodeExpiresAt, lastSeenAt: new Date() },
  });

  // firmwareVersion is accepted for future compatibility checks; not yet persisted.
  void firmwareVersion;

  const response: DeviceRegisterResponse = { cuid, pairingCode, paired: false };
  return res.json(response);
});

/**
 * Called from the portal once a signed-in user submits a pairing code.
 * Binds the device to that user and clears the pairing code.
 */
devicesRouter.post("/pair", async (req, res) => {
  const { pairingCode, userId } = req.body as { pairingCode: string; userId: string };

  if (!pairingCode || !userId) {
    return res.status(400).json({ error: "pairingCode and userId are required" });
  }

  const device = await prisma.device.findUnique({ where: { pairingCode } });

  if (!device || !device.pairingCodeExpiresAt || device.pairingCodeExpiresAt < new Date()) {
    return res.status(404).json({ error: "Invalid or expired pairing code" });
  }

  const updated = await prisma.device.update({
    where: { id: device.id },
    data: { userId, pairingCode: null, pairingCodeExpiresAt: null },
  });

  return res.json({ cuid: updated.cuid, paired: true });
});

/** Called from the portal to unbind a device. The CYD notices on its next check-in. */
devicesRouter.post("/:cuid/unpair", async (req, res) => {
  const { cuid } = req.params;

  const device = await prisma.device.findUnique({ where: { cuid } });
  if (!device) {
    return res.status(404).json({ error: "Device not found" });
  }

  await prisma.device.update({
    where: { cuid },
    data: { userId: null },
  });

  return res.status(204).send();
});

/** Called by the CYD when a button is tapped. */
devicesRouter.post("/trigger", async (req, res) => {
  const { cuid, soundId } = req.body as TriggerSoundRequest;

  if (!cuid || !soundId) {
    return res.status(400).json({ error: "cuid and soundId are required" });
  }

  const device = await prisma.device.findUnique({ where: { cuid } });
  if (!device?.userId) {
    return res.status(404).json({ error: "Device not paired" });
  }

  try {
    await triggerPlayback(device.userId, soundId);
    return res.status(202).json({ ok: true });
  } catch (error) {
    if (error instanceof BotProxyError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("[trigger] playback failed", error);
    return res.status(500).json({ error: "Playback failed" });
  }
});
