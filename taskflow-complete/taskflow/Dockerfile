# ─── Base ─────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate
WORKDIR /app

# ─── Dependencies ─────────────────────────────────────────
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/utils/package.json packages/utils/
COPY packages/db/package.json packages/db/

# Copy all service package.jsons
COPY services/api-gateway/package.json services/api-gateway/
COPY services/auth-service/package.json services/auth-service/
COPY services/tenant-service/package.json services/tenant-service/
COPY services/project-service/package.json services/project-service/
COPY services/task-service/package.json services/task-service/
COPY services/realtime-service/package.json services/realtime-service/
COPY services/notification-service/package.json services/notification-service/
COPY services/analytics-service/package.json services/analytics-service/
COPY services/billing-service/package.json services/billing-service/
COPY services/worker-service/package.json services/worker-service/

RUN pnpm install --frozen-lockfile

# ─── Build ────────────────────────────────────────────────
FROM deps AS build
COPY . .
RUN pnpm run build

# ─── Production ───────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/utils/node_modules ./packages/utils/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=build /app/packages/utils/dist ./packages/utils/dist
COPY --from=build /app/packages/db/dist ./packages/db/dist
COPY --from=build /app/packages/utils/package.json ./packages/utils/
COPY --from=build /app/packages/db/package.json ./packages/db/
COPY pnpm-workspace.yaml package.json ./

# Service-specific files will be copied via docker-compose build args
ARG SERVICE_NAME
COPY --from=build /app/services/${SERVICE_NAME}/dist ./services/${SERVICE_NAME}/dist
COPY --from=build /app/services/${SERVICE_NAME}/package.json ./services/${SERVICE_NAME}/
COPY --from=deps /app/services/${SERVICE_NAME}/node_modules ./services/${SERVICE_NAME}/node_modules

WORKDIR /app/services/${SERVICE_NAME}

EXPOSE 3000
CMD ["node", "dist/index.js"]
