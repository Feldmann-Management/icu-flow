# ICU Flow

Self-hostable service that keeps your ICU message catalogs translated. Connect a GitHub repository, push to `main`, and ICU Flow opens a PR with AI-translated entries for every missing key in every target locale.

## Why

Most translation automation is either a commercial SaaS or a CI action you copy into every repo. ICU Flow is a single app you run once on your own server:

- **Push-driven**. Point it at a repo, it listens for pushes, and opens a PR with translations. No CI minutes, no per-repo workflow files.
- **Self-hostable**. Runs on a single VM with Docker. All state in Postgres. You own the OpenAI key and the AI spend.
- **Bot identity**. Translations land in a PR authored by `icu-flow[bot]`, same pattern as Dependabot / Renovate.
- **Override-respecting**. Once a translation has a non-empty `msgstr`, the bot leaves it alone — devs can correct AI output and it stays corrected across future runs.

Built for Lingui / gettext `.po` catalogs. Other formats can be added later.

## How it works

```
  push to main ──► GitHub webhook ──► Next.js app (verifies HMAC)
                                           │
                                           ▼
                                   pg-boss queue in Postgres
                                           │
                                           ▼
                         Worker process:
                         · shallow clone repo with installation token
                         · read icu-flow.yml at repo root
                         · diff source .po against each target .po
                         · batch missing keys through OpenAI (gpt-4o-mini)
                         · write catalogs, commit as icu-flow[bot]
                         · force-push icu-flow/translations branch
                         · open or update PR against main
                         · delete working directory
```

Only missing or empty entries go to OpenAI — existing translations (including hand-edited ones) are preserved.

## Repo config

Add an `icu-flow.yml` at the root of any repo you want translated:

```yaml
source: en
targets: [de, fr, es]
messages:
  - apps/web/locales/{locale}/messages.po
  - packages/shared/locales/{locale}/messages.po
```

`{locale}` is substituted with the source locale and each target. The `messages` list supports monorepos with multiple catalogs.

## Architecture

Turborepo, pnpm workspaces, TypeScript throughout.

```
apps/
  web/       Next.js 16 app. Hosts the setup wizard, dashboard, auth,
             install callback, webhook receiver.
  worker/    Long-running Node process. Consumes the queue, does git
             clone + translation + commit + PR.
packages/
  db/        Drizzle schema + migrations (Postgres).
  queue/     Typed pg-boss wrapper. Zod-validated job payloads.
  github/    Octokit + App auth + installation-token minting.
  ui/        shadcn components (Tailwind v4, Base UI primitives).
  eslint-config/, typescript-config/
```

Stack: Next.js 16, React 19, Tailwind v4, shadcn + Base UI, Better-Auth (email+password, optional GitHub OAuth), Drizzle ORM, Postgres 16, pg-boss, TanStack Query + Form, Zod, Lingui, Vitest.

## Setup

### Prerequisites

- Node 20+
- pnpm 9.15+
- Docker (for Postgres)
- A public HTTPS URL that GitHub can reach (your production domain, or a tunnel in dev)
- An OpenAI API key

### 1. Install and start the database

```bash
pnpm install
docker compose up -d postgres
pnpm --filter @workspace/db db:migrate
```

Postgres runs on host port **55432** by default (port 5432 is left for whatever else you have local).

### 2. Configure environment

Copy `.env.example` → `apps/web/.env.local` and `apps/worker/.env.local`. Fill in:

```bash
# apps/web/.env.local
DATABASE_URL=postgres://icuflow:icuflow@localhost:55432/icuflow
APP_URL=https://your-public-url.example.com      # must be HTTPS and reachable from GitHub
BETTER_AUTH_SECRET=<openssl rand -base64 32>

# Optional: sign-in with GitHub via Better-Auth (separate from the GitHub App)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

```bash
# apps/worker/.env.local
DATABASE_URL=postgres://icuflow:icuflow@localhost:55432/icuflow
OPENAI_API_KEY=sk-...
WORK_DIR=/tmp/icu-flow-work
```

### 3. Start the web app and worker

```bash
pnpm --filter web dev
pnpm --filter worker dev
```

Web serves at `http://localhost:3000`. In production, `pnpm --filter web build && pnpm --filter web start` + running the worker via its `start` script.

### 4. First-run setup wizard

Visit `APP_URL` in your browser. You'll be redirected to `/setup`. Click **Create GitHub App** — this POSTs an app manifest to GitHub, which walks you through a one-click confirmation, then redirects back with the App's credentials (ID, client secret, private key, webhook secret). ICU Flow stores them in the `app_config` table. No manual form, no pasting secrets into env files.

### 5. Connect a repo

Sign up for an account, then on the dashboard click **Connect GitHub**. GitHub prompts you to pick which repos the App can access. After install, you land back on the dashboard with the installation and its repos listed.

Add `icu-flow.yml` to a repo, push to `main`, watch the PR open.

## Development

```bash
pnpm typecheck               # all packages
pnpm lint
pnpm test                    # vitest in apps/web

pnpm --filter web dev
pnpm --filter worker dev

pnpm --filter @workspace/db db:generate    # create a migration from schema changes
pnpm --filter @workspace/db db:migrate     # apply pending migrations
pnpm --filter @workspace/db db:studio      # browse DB

pnpm --filter web lingui:extract           # extract translatable strings from web UI
pnpm --filter web lingui:compile
```

### Dev webhooks

GitHub needs to reach your dev machine. Cloudflared quick tunnels work:

```bash
cloudflared tunnel --url http://localhost:3000
```

Copy the printed `trycloudflare.com` URL into `apps/web/.env.local` as `APP_URL`. Next picks it up on the next request (no restart needed). On web cold-boot, `instrumentation.ts` calls `PATCH /app/hook/config` on GitHub to sync the webhook URL to whatever `APP_URL` is currently set to — so tunnel rotations don't break push delivery after a restart.

For a stable URL, set up a named Cloudflare tunnel with a DNS route (one-time). Then `APP_URL` never changes.

## Deployment

Single server. Docker Compose with three services — Postgres, web, worker:

```bash
docker compose --profile full up -d
```

`docker-compose.yml` uses the `full` profile to gate the worker service so that `docker compose up postgres` (common in dev) stays fast. In production, include the profile to run everything.

For a droplet-class deployment:
- Point `APP_URL` at your real HTTPS domain.
- Put a reverse proxy (Caddy, Traefik, nginx) in front of the web service.
- Persist `/var/lib/icu-flow/work` and the Postgres volume.
- Rotate `BETTER_AUTH_SECRET`, `OPENAI_API_KEY`, and any DB credentials from the defaults.

## License

MIT — see [LICENSE](./LICENSE). Use it, fork it, ship it commercially. The usual "no warranty, no liability" disclaimer applies.
