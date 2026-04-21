FROM node:20-alpine AS base
RUN apk update && apk add --no-cache libc6-compat git tini
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app

FROM base AS pruner
RUN pnpm add -g turbo@^2
COPY . .
RUN turbo prune worker --docker

FROM base AS builder
COPY --from=pruner /app/out/json/ ./
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ ./

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 worker \
  && mkdir -p /var/lib/icu-flow/work \
  && chown -R worker:nodejs /var/lib/icu-flow
COPY --from=builder --chown=worker:nodejs /app/ ./
USER worker
ENV WORK_DIR=/var/lib/icu-flow/work
VOLUME ["/var/lib/icu-flow/work"]

# Run from the worker package so `tsx` resolves in its local node_modules.
WORKDIR /app/apps/worker
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--import", "tsx", "src/index.ts"]
