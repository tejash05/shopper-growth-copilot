# Channel Service (`@scp/channel-service`)

Stub **messaging provider** for Shopper Growth Copilot. Accepts send requests from CRM, simulates WhatsApp/SMS/Email/RCS lifecycles, and posts **HMAC-signed callbacks** to the CRM over time.

**Stack:** Node 20, TypeScript, Fastify 5. **Redis** only for BullMQ (`channel-events` queue) — no message DB, no cache layer.

---

## Purpose

Real providers are async: accept a message, then send webhooks later (`sent`, `delivered`, `read`, `clicked`, …). This service models that contract without external API keys.

CRM stays provider-agnostic: enqueue sends, ingest callbacks on `/api/receipts/channel-callback`.

---

## Why separate from CRM

- Mirrors production CRM ↔ provider boundary
- Lifecycle events are delayed — not part of the launch HTTP response
- Simulator retries don't block CRM Postgres work
- Real provider adapters can replace the simulator behind the same HTTP contract

---

## Responsibilities

- `POST /api/simulate-send` — accept one communication, return `202`
- Plan probabilistic lifecycle in `simulator.ts`
- Schedule delayed events on BullMQ `channel-events`
- Worker POSTs signed callbacks to CRM
- `GET /health`

---

## Folder structure

```
src/
├── index.ts, server.ts, env.ts
├── simulator.ts     # planLifecycle()
├── worker.ts        # Callback consumer → CRM
└── lib/queue.ts, lib/redis.ts
```

---

## Key flow

```
CRM send worker
  → POST /api/simulate-send

simulator.planLifecycle()
  → SENT → DELIVERED → READ? → CLICKED? → ATTRIBUTED_ORDER? (or FAILED)

eventQueue.addBulk(..., { delay })   # channel-events / Redis

Callback worker
  → HMAC sign → POST {CRM_API_URL}/api/receipts/channel-callback
  → idempotencyKey = "{messageId}:{eventType}"

CRM updates CommunicationEvent + status + metrics
```

Handler returns **before** events fire — same as a real provider ACK.

---

## Architecture decisions

- **Separate process** — Send/callback load isolated from CRM API.
- **BullMQ delays** — Realistic seconds-between-events timing; retries if CRM is down (5 attempts, backoff).
- **HMAC** — Shared `CHANNEL_CALLBACK_SECRET`; CRM rejects invalid signatures.
- **Probabilistic simulation** — Persona `engagementBias` + channel weights; ~3% hard failures. Models variable campaign outcomes.
- **Industry pattern** — Accept → provider ID → idempotent webhooks. Maps to Twilio/Meta/SendGrid integration later.

---

## Local development

From repo root (`pnpm infra:up` for Redis):

```bash
pnpm install
pnpm --filter @scp/channel-service dev    # http://localhost:4001
```

CRM needs `CHANNEL_SERVICE_URL=http://localhost:4001` and matching `CHANNEL_CALLBACK_SECRET`.

---

## Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `REDIS_URL` | Yes | Shared with CRM BullMQ |
| `CRM_API_URL` | Yes | Callback target (CRM base URL) |
| `CHANNEL_CALLBACK_SECRET` | Yes | Must match crm-api |
| `CHANNEL_SERVICE_PORT` | Local | Default 4001; Railway uses `PORT` |

---

## Health check

`GET /health` → `{ "status": "ok", "service": "channel-service" }`

Railway: `apps/channel-service/railway.json`.

After deploy: set CRM `CHANNEL_SERVICE_URL` to this service's public URL; set `CRM_API_URL` here to CRM's public URL.
