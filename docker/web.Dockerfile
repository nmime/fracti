# ===========================================
# Fracti Web - React Router SSR Frontend
# ===========================================

# Use full node image (glibc) instead of alpine (musl) for native binaries
FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

# Builder
FROM base AS builder
ENV CI=true

# Base path for React Router: '/' for Docker, '/app' for AWS Lambda
ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=$VITE_BASE_PATH

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/ ./apps/
COPY libs/ ./libs/
COPY infra/ ./infra/
COPY app.yaml tsconfig*.json ./

# Copy .npmrc which allows native binary builds
COPY .npmrc ./
RUN pnpm install --frozen-lockfile
RUN pnpm build:gui

# Production
FROM node:22-slim AS production
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/apps/web/build ./build
COPY --from=builder /app/apps/web/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/app.yaml ./

EXPOSE 3000
CMD ["npx", "react-router-serve", "./build/server/index.js"]
