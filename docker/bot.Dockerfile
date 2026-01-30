# ===========================================
# Fracti Bot - Telegram Bot (Polling Mode)
# ===========================================

FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

# Builder - install all dependencies
FROM base AS builder
ENV CI=true

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/ ./apps/
COPY libs/ ./libs/
COPY infra/ ./infra/
COPY app.yaml tsconfig*.json .npmrc ./

RUN pnpm install --frozen-lockfile

# Production - use tsx to run TypeScript directly
FROM base AS production
ENV NODE_ENV=production
WORKDIR /app

# Copy full workspace (needed for path resolution)
COPY --from=builder /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json ./
COPY --from=builder /app/apps/bot ./apps/bot
COPY --from=builder /app/libs ./libs
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/tsconfig*.json ./
COPY --from=builder /app/app.yaml ./

CMD ["npx", "tsx", "apps/bot/dev.ts"]
