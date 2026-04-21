# One-shot image: applies Drizzle migrations against DATABASE_URL and exits.
# Used as the `migrate` service in docker-compose.coolify.yml.

FROM node:20-alpine AS base
RUN apk update && apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app

FROM base AS pruner
RUN pnpm add -g turbo@^2
COPY . .
RUN turbo prune @workspace/db --docker

FROM base AS builder
COPY --from=pruner /app/out/json/ ./
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ ./

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/ ./
WORKDIR /app/packages/db
CMD ["pnpm", "exec", "drizzle-kit", "migrate"]
