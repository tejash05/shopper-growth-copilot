# CRM API (`@scp/crm-api`)

HTTP API for **Shopper Growth Copilot** — workspace-scoped retail CRM data, campaigns, imports, AI-assisted planning, and inbound channel receipts.

**Stack:** Node 20, TypeScript, Fastify 5, Prisma + PostgreSQL. **Redis** is used only for BullMQ (`campaign-send` queue), not for dashboard or shopper caching.

---

## Purpose

All product REST endpoints the Next.js app calls: brands, shoppers, segments, campaigns, imports, AI, metrics, callbacks. Starts an **in-process BullMQ send worker** on boot that POSTs to channel-service.

AI lives in `@scp/ai` (library, not a separate deploy). Runs are persisted as `AiAgentRun`.

---

## Responsibilities

| Area | Endpoints |
|------|-----------|
| Workspaces | `/api/brands` — list, create, demo data, delete |
| Shoppers / dashboard | `/api/customers`, `/api/dashboard` |
| Segments | `/api/segments` |
| Campaigns | `/api/campaigns` — CRUD, safety check, launch, metrics, insights |
| Import | `/api/import/*` — multipart preview/commit, job history |
| AI | `/api/ai/*` — parse intent, campaign plan, message preview |
| Receipts | `/api/receipts/channel-callback` |

---

## Folder structure

```
src/
├── index.ts, server.ts, env.ts
├── routes/          # Thin HTTP handlers
├── services/        # Business logic + Prisma
├── worker/          # send-worker.ts → channel-service
└── lib/             # brand, ai, queue, redis, validate
```

---

## Key flows

**1. Workspace scoping** — `X-Brand-Id` header resolved in `lib/brand.ts`; queries filter by `brandId`.

**2. Data import** — Multipart preview validates rows; commit batch-upserts customers/orders, writes `ImportJob`/`ImportError`, recomputes metrics. Synchronous (no queue).

**3. Segment & AI planning** — `parse-intent` → structured rule + SQL preview. `campaign-plan` runs `@scp/ai`, grounds audience via `previewSegment`, returns channels/offer/messages.

**4. Campaign launch** — Consent/fatigue filters, control split, template render per shopper, bulk `Communication` (QUEUED), then `sendQueue.addBulk`.

**5. Callback ingestion** — HMAC verify → idempotent `ChannelCallback` → append `CommunicationEvent` → project status → `AttributedOrder` on conversion.

**6. Metrics & insights** — SQL funnel aggregates; insights endpoint feeds metrics into `@scp/ai`.

```
Launch → Postgres → BullMQ → channel-service → (delayed) signed callbacks → Postgres
```

---

## Architecture decisions

- **Fastify** — Lightweight, plugins for CORS/multipart, structured logs.
- **Prisma + Postgres** — Relational campaigns, append-only events, brand-scoped queries, segment SQL.
- **BullMQ for sends only** — Non-blocking launch; retries on channel-service failures. Not a general cache.
- **HMAC + idempotency** — Webhooks retry; duplicate keys must not double-count. Forged callbacks rejected.
- **Append-only events** — `CommunicationEvent` is source of truth; `Communication.status` is a projection (out-of-order safe).

---

## Local development

From repo root (`pnpm infra:up` for Postgres + Redis):

```bash
pnpm install && pnpm db:generate && pnpm db:push   # if schema changed
pnpm --filter @scp/crm-api dev                     # http://localhost:4000
```

Channel-service on `:4001` required for full send flow.

---

## Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | PostgreSQL |
| `REDIS_URL` | Yes | BullMQ send queue |
| `CHANNEL_CALLBACK_SECRET` | Yes | Match channel-service |
| `CHANNEL_SERVICE_URL` | Yes | Channel-service base URL |
| `CORS_ORIGIN` | Prod | Web app origin(s) |
| `AI_PROVIDER` | No | `mock` (default) or `openai` |
| `OPENAI_API_KEY` | If openai | |
| `CRM_API_PORT` | Local | Default 4000; Railway uses `PORT` |

See root `.env.example`.

---

## Health check

`GET /health` → `{ "status": "ok", "service": "crm-api" }`

Railway: `apps/crm-api/railway.json`.
