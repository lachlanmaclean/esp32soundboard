import { Router } from "express";
import { fetchBotGuildIds } from "../botClient";

export const botRouter = Router();

/** Guilds the bot is currently a member of — used by the portal to filter the guild picker. */
botRouter.get("/guilds", async (_req, res) => {
  try {
    const guildIds = await fetchBotGuildIds();
    res.json({ guildIds });
  } catch (error) {
    console.error("[api] failed to reach bot service", error);
    res.status(502).json({ error: "Bot service unreachable" });
  }
});
