# Multi-stage, multi-target build for web / api / worker.
# Build a target with:  docker build --target api -t kpm-api .
FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile

FROM deps AS build
RUN pnpm --filter @kpm/api prisma generate
RUN pnpm build

# --- api ---
FROM base AS api
COPY --from=build /app /app
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]

# --- worker ---
FROM base AS worker
COPY --from=build /app /app
WORKDIR /app/apps/worker
CMD ["node", "dist/main.js"]

# --- web ---
FROM base AS web
COPY --from=build /app /app
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "start"]
