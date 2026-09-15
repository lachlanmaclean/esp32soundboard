import { Router } from "express";
import { discordClient } from "../../bot/client";

export const botRouter = Router();

/** Guilds the bot is currently a member of — used by the portal to filter the guild picker. */
botRouter.get("/guilds", (_req, res) => {
  res.json({ guildIds: [...discordClient.guilds.cache.keys()] });
});
