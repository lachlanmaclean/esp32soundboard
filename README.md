# Gooseboard

A Discord soundboard triggered by a physical ESP32 CYD (Cheap Yellow Display).

## Layout

- `apps/server` — one codebase, two runtime processes (`src/index.ts` for the
  API, `src/bot-index.ts` for the Discord bot), deployed as separate
  containers. See "Why two processes?" below. Source of truth for devices,
  pairing, and sound config.
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

`docker-compose.yml` at the repo root defines five services: `postgres`, a
one-shot `migrate` job (`prisma migrate deploy`), `server` (API), `bot`
(Discord client + voice), and `portal`. Point a Dokploy "Docker Compose"
application at this repo, set the env vars from `.env.example` in Dokploy's
environment settings, and deploy — Dokploy builds each service's Dockerfile
and runs migrations before the app containers start.

### Why two processes?

Discord voice needs a direct UDP handshake with Discord's voice servers
(separate from the regular gateway WebSocket) to work at all. Docker's
default bridge network NATs a container's outbound traffic, and that extra
NAT layer reliably breaks this handshake — regular HTTP traffic goes through
fine, but voice connections get stuck and time out. The fix is running the
bot with Docker's host networking (`network_mode: host` on `bot` in
`docker-compose.yml`), so its network stack matches the host machine's
directly. That only works cleanly for a service with no public domain
though, since Traefik's usual container-network routing doesn't apply to a
host-networked container - so the public API stays on the normal bridge
network as its own service, and proxies to the bot's small internal HTTP API
(guild list, trigger playback) over `host.docker.internal`.

If you ever see Discord voice connections stuck in `signalling` or bouncing
`connecting -> signalling` without reaching `ready` (check the `bot`
service's logs), that's this exact class of problem - confirm by comparing
a plain `node` process on the host machine (no Docker) against the same
code in the container.
