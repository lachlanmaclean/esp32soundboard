# Debian-based (glibc), not Alpine (musl) - musl's DNS resolver has known
# reliability issues with the kind of fresh, per-session lookups Discord
# voice needs (a new region-specific hostname every connection), which
# caused voice connections to hang even with correct networking otherwise.
FROM node:22-bookworm-slim AS base
# openssl: Prisma's query engine. ffmpeg: transcodes uploaded mp3/wav/ogg to
# Opus for @discordjs/voice.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

# --- deps: install full workspace so npm can resolve internal packages ---
FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/server/package.json apps/server/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm install --workspaces --include-workspace-root

# --- build ---
FROM base AS build
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/package.json ./package.json
COPY package-lock.json* ./
COPY packages/db packages/db
COPY packages/shared packages/shared
COPY apps/server apps/server
# prisma generate downloads its query-engine binary over the network; retry
# on the transient ECONNRESET Prisma's own client can throw as an unhandled
# rejection instead of retrying cleanly.
RUN for i in 1 2 3 4 5; do npm run build --workspace=packages/db && exit 0; echo "prisma generate failed, retrying ($i)..."; sleep 5; done; exit 1
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/server

# --- runtime ---
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/packages/db packages/db
COPY --from=build /repo/packages/shared packages/shared
COPY --from=build /repo/apps/server/dist apps/server/dist
COPY --from=build /repo/apps/server/package.json apps/server/package.json

EXPOSE 4000
CMD ["node", "apps/server/dist/index.js"]
