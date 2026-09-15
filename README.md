# Gooseboard

A Discord soundboard triggered by a physical ESP32 CYD (Cheap Yellow Display).

## Layout

- `apps/server` — Discord bot (discord.js + @discordjs/voice) and the web API
  (Express) it shares a process with. Source of truth for devices, pairing,
  and sound config.
- `apps/portal` — Next.js web portal. Discord OAuth2 login, sound library
  management, device pairing/unpairing.
- `packages/db` — Prisma schema and generated client, shared by both apps.
- `packages/shared` — TypeScript types shared across server, portal, and (in
  spirit) the firmware's JSON payloads.
- `firmware` — PlatformIO/LovyanGFX firmware for the CYD (not yet scaffolded).

## Local development

```bash
cp .env.example .env   # fill in Discord app credentials + a local DATABASE_URL
npm install
npm run db:migrate     # creates the Postgres schema (needs a running Postgres)
npm run dev:server      # bot + API on :4000
npm run dev:portal      # portal on :3000
```

## Deployment (Dokploy / Docker)

`docker-compose.yml` at the repo root defines four services: `postgres`, a
one-shot `migrate` job (`prisma migrate deploy`), `server`, and `portal`.
Point a Dokploy "Docker Compose" application at this repo, set the env vars
from `.env.example` in Dokploy's environment settings, and deploy — Dokploy
builds each service's Dockerfile and runs migrations before the app
containers start.
