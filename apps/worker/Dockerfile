FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
RUN apk add --no-cache git tini

FROM base AS deps
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/worker/package.json ./apps/worker/package.json
COPY packages/queue/package.json ./packages/queue/package.json
COPY packages/eslint-config/package.json ./packages/eslint-config/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json
RUN pnpm install --frozen-lockfile --filter worker...

FROM base AS runner
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /repo/packages/queue/node_modules ./packages/queue/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker ./apps/worker
COPY packages/queue ./packages/queue
COPY packages/typescript-config ./packages/typescript-config

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 worker \
  && mkdir -p /var/lib/icu-flow/work \
  && chown -R worker:nodejs /var/lib/icu-flow /repo
USER worker
ENV WORK_DIR=/var/lib/icu-flow/work
VOLUME ["/var/lib/icu-flow/work"]

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--import", "tsx", "apps/worker/src/index.ts"]
