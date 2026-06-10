# Deployment Guide — Vercel + Railway

This project deploys as **three runtime processes** plus **Postgres** and **Redis**:

| Component | Platform | Config |
|-----------|----------|--------|
| `apps/web` | **Vercel** | [`apps/web/vercel.json`](apps/web/vercel.json) |
| `apps/crm-api` | **Railway** | [`apps/crm-api/railway.json`](apps/crm-api/railway.json) |
| `apps/channel-service` | **Railway** | [`apps/channel-service/railway.json`](apps/channel-service/railway.json) |
| Postgres | **Railway plugin** | `DATABASE_URL` |
| Redis | **Railway plugin** | `REDIS_URL` |

`@scp/ai` is a library inside `crm-api` — not deployed separately.

---

## Prerequisites

- Node.js ≥ 20, pnpm 9.12 (see root `package.json`)
- GitHub repo connected to Vercel and Railway
- Local preflight: `pnpm install`, `pnpm typecheck`, `pnpm build`

---

## Architecture

```
Browser → Vercel (Next.js)
       → Railway crm-api (Fastify + BullMQ send worker + AI)
       → Railway channel-service (simulator + callback worker)
crm-api ↔ Postgres (Railway)
crm-api ↔ Redis (Railway) ↔ channel-service
channel-service → HMAC callbacks → crm-api
```

---

## Step 1 — Railway project (data layer)

1. Create a new **Railway project** and connect this repository.
2. Add **PostgreSQL** plugin → note `DATABASE_URL`.
3. Add **Redis** plugin → note `REDIS_URL`.

### Apply database schema

From your machine (with Railway `DATABASE_URL`):

```bash
export DATABASE_URL="postgresql://..."   # Railway Postgres URL
pnpm db:generate
pnpm db:push                             # quick demo path (no migrations folder yet)
```

**Production schema (recommended before real customer data):**

```bash
# One-time locally: create initial migration
pnpm db:migrate                          # prisma migrate dev

# On each production release:
pnpm --filter @scp/db migrate:deploy     # prisma migrate deploy
```

### Demo seed (optional — demo data only)

```bash
pnpm db:seed
```

**Warning:** `pnpm db:seed` **wipes and regenerates** the NovaWear demo dataset (~10k shoppers). Use only for **demo/staging**. Do **not** run on a production database with real customers.

---

## Step 2 — Railway: `crm-api`

1. Add a **new service** from the same repo.
2. Set **Root Directory** to the **repository root** (not `apps/crm-api`).
3. Set **Config file path** to `apps/crm-api/railway.json` (or paste equivalent settings in the UI).

### Build command (from monorepo root)

```bash
pnpm install --frozen-lockfile && pnpm db:generate
```

### Start command

```bash
pnpm --filter @scp/crm-api start
```

Runs `tsx src/index.ts` with the in-process BullMQ **send worker**.

### Port

Railway injects `PORT`. The app binds via `CRM_API_PORT`, which falls back to `process.env.PORT` when unset (see [`apps/crm-api/src/env.ts`](apps/crm-api/src/env.ts)). **No manual port mapping required** if you do not set `CRM_API_PORT` on Railway.

### Environment variables

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` or paste Railway Postgres URL |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |
| `CHANNEL_SERVICE_URL` | Public HTTPS URL of channel-service (set after Step 3) |
| `CHANNEL_CALLBACK_SECRET` | Strong random string (≥8 chars) |
| `CORS_ORIGIN` | Your Vercel production URL, e.g. `https://your-app.vercel.app` |
| `AI_PROVIDER` | `mock` (demo) or `openai` |
| `OPENAI_API_KEY` | Required if `AI_PROVIDER=openai` |
| `OPENAI_MODEL` | `gpt-4o-mini` (optional) |
| `NODE_ENV` | `production` |

Do **not** set `CRM_API_PORT` on Railway unless debugging — use Railway's `PORT`.

### Health check

- Path: **`GET /health`**
- Configured in `railway.json` as `healthcheckPath: "/health"`

Enable **public networking** and copy the service URL (e.g. `https://crm-api-production-xxxx.up.railway.app`).

---

## Step 3 — Railway: `channel-service`

1. Add another **service** from the same repo.
2. **Root Directory:** repository root.
3. **Config file path:** `apps/channel-service/railway.json`.

### Build command

```bash
pnpm install --frozen-lockfile
```

### Start command

```bash
pnpm --filter @scp/channel-service start
```

### Port

Uses `CHANNEL_SERVICE_PORT`, falling back to Railway `PORT` (see [`apps/channel-service/src/env.ts`](apps/channel-service/src/env.ts)).

### Environment variables

| Variable | Value |
|----------|-------|
| `REDIS_URL` | `${{Redis.REDIS_URL}}` (same Redis as crm-api) |
| `CRM_API_URL` | Public HTTPS URL of **crm-api** from Step 2 |
| `CHANNEL_CALLBACK_SECRET` | **Same value as crm-api** |
| `NODE_ENV` | `production` |

### Health check

- Path: **`GET /health`**

Enable public networking; copy the channel-service URL.

### Wire URLs

After both services are live:

1. Set crm-api `CHANNEL_SERVICE_URL` = channel-service public URL → redeploy crm-api.
2. Set channel-service `CRM_API_URL` = crm-api public URL → redeploy channel-service.

---

## Step 4 — Vercel: `apps/web`

1. Import the GitHub repo into **Vercel**.
2. Set **Root Directory** to **`apps/web`**.
3. Vercel reads [`apps/web/vercel.json`](apps/web/vercel.json):

| Setting | Command |
|---------|---------|
| **Install** | `cd ../.. && pnpm install --frozen-lockfile` |
| **Build** | `cd ../.. && pnpm --filter @scp/web build` |
| **Output** | `.next` (Next.js default) |

### Environment variables (set before first production build)

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_CRM_API_URL` | crm-api public Railway URL (HTTPS) |
| `CRM_API_URL` | Same URL (SSR fallback) |
| `NODE_ENV` | `production` |

The browser calls `${NEXT_PUBLIC_CRM_API_URL}/api/...` directly ([`apps/web/src/lib/api.ts`](apps/web/src/lib/api.ts)).

Deploy and note your Vercel URL (e.g. `https://your-app.vercel.app`).

### CORS

Set crm-api `CORS_ORIGIN` to your Vercel URL (comma-separated for preview + production):

```env
CORS_ORIGIN=https://your-app.vercel.app
```

crm-api reads this in [`apps/crm-api/src/server.ts`](apps/crm-api/src/server.ts). If unset, all origins are allowed (local dev default).

---

## Step 5 — Verification checklist

After all services are deployed:

| Check | How |
|-------|-----|
| **crm-api health** | `curl https://<crm-api>/health` → `{ "status": "ok", "service": "crm-api" }` |
| **channel-service health** | `curl https://<channel-service>/health` → `{ "status": "ok", "service": "channel-service" }` |
| **Dashboard** | Open Vercel URL → shopper counts visible (requires seed or real data) |
| **Campaign Studio** | Generate plan → segment/offer populated (mock AI OK) |
| **AI status** | DevTools → `POST /api/ai/campaign-plan` → `plan.status` is `SUCCESS` or `FALLBACK` |
| **Launch + monitor** | Launch campaign → KPI cards settle; channel/variant sent counts align |
| **AI insights** | After settlement, insights match KPI cards (not ₹0 / stale partial data) |
| **Callbacks** | crm-api logs show channel callbacks; communications move past `QUEUED` |

---

## Environment variable reference

See [`.env.example`](.env.example) for a full local template with sections for web, crm-api, channel-service, Postgres, Redis, and OpenAI.

**Secrets to rotate in production:**

- `CHANNEL_CALLBACK_SECRET`
- `OPENAI_API_KEY` (if used)
- Postgres credentials (managed by Railway)

---

## Useful commands (local / CI)

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:push              # schema sync (demo)
pnpm db:migrate           # create migration (dev)
pnpm --filter @scp/db migrate:deploy   # apply migrations (prod)
pnpm db:seed              # DEMO ONLY — wipes demo tables
pnpm typecheck
pnpm build
pnpm --filter @scp/crm-api start
pnpm --filter @scp/channel-service start
pnpm --filter @scp/web start
```

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Campaign stuck at `QUEUED` | `CHANNEL_SERVICE_URL` wrong or channel-service down |
| No callbacks / no funnel progress | `CRM_API_URL` on channel-service not public HTTPS |
| CORS errors in browser | `CORS_ORIGIN` on crm-api missing or wrong Vercel URL |
| Empty dashboard | Schema not pushed or seed not run |
| AI always `FALLBACK` | OpenAI quota/key issue — mock still works with `AI_PROVIDER=mock` |

---

## Not included in this deploy

- Authentication / multi-tenancy
- Real WhatsApp/SMS provider adapters
- Docker images (services run via `tsx`; add Dockerfiles as a follow-up)
- Automated CI deploy pipelines (configure in Vercel/Railway UI or GitHub Actions)
