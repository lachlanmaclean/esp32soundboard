FROM node:22-alpine AS base
# Prisma's query engine needs openssl on Alpine.
RUN apk add --no-cache openssl
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
RUN npm run build --workspace=packages/db
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
