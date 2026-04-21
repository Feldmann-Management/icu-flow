FROM node:20-alpine AS base
RUN apk update && apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app

FROM base AS pruner
RUN pnpm add -g turbo@^2
COPY . .
RUN turbo prune web --docker

FROM base AS builder
# Install deps first (cached while package.jsons are unchanged)
COPY --from=pruner /app/out/json/ ./
RUN pnpm install --frozen-lockfile
# Then copy full source
COPY --from=pruner /app/out/full/ ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter web build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
# Leverage Next.js output tracing for a minimal image
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
