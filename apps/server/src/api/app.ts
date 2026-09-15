import express from "express";
import cors from "cors";
import { devicesRouter } from "./routes/devices";
import { soundsRouter } from "./routes/sounds";
import { env } from "../env";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use("/uploads", express.static(env.uploadDir));

  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  app.use("/api/devices", devicesRouter);
  app.use("/api/sounds", soundsRouter);

  return app;
}
