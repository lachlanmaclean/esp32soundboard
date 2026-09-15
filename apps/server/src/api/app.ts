import express from "express";
import cors from "cors";
import { devicesRouter } from "./routes/devices";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  app.use("/api/devices", devicesRouter);

  return app;
}
