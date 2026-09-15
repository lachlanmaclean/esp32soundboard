FROM node:22-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /repo

# --- deps ---
FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/portal/package.json apps/portal/package.json
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
COPY apps/portal apps/portal
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# prisma generate downloads its query-engine binary over the network; retry
# on the transient ECONNRESET Prisma's own client can throw as an unhandled
# rejection instead of retrying cleanly.
RUN for i in 1 2 3 4 5; do npm run build --workspace=packages/db && exit 0; echo "prisma generate failed, retrying ($i)..."; sleep 5; done; exit 1
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/portal

# --- runtime ---
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo/apps/portal/public apps/portal/public
COPY --from=build /repo/apps/portal/.next/standalone ./
COPY --from=build /repo/apps/portal/.next/static apps/portal/.next/static

EXPOSE 3000
CMD ["node", "apps/portal/server.js"]
