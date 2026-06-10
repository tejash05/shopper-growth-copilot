# Architecture

## Overview

Shopper Growth Copilot is a pnpm + Turborepo monorepo with three runnable apps and four
shared packages. The design goal is a clear separation between **presentation** (web),
**business logic** (crm-api), **side-effect simulation** (channel-service), and **pure,
reusable domain logic** (packages).

```
apps/
  web              Next.js 15 App Router — SSR dashboards + client islands
  crm-api          Fastify — all business logic, owns the send worker
  channel-service  Fastify — simulates omni-channel delivery + signed callbacks
packages/
  db               Prisma schema, client singleton, seed generator
  shared           enums, Zod DTOs, pure domain logic, HMAC
  ai               centralised AI capabilities (prompt + schema + mock)
docs/              this folder
```

## Why two backend services?

The CRM API and the Channel Service are deliberately separate processes that communicate over
HTTP, exactly as a real CRM integrates with an external messaging provider:

- The **CRM API** never blocks on delivery. It enqueues a send job, the worker dispatches a
  request to the channel service, and the channel service later **calls back** with lifecycle
  events. This models the real-world async, webhook-driven integration with WhatsApp/SMS BSPs.
- The **trust boundary** between them is enforced with an HMAC signature on every callback —
  the same way you'd verify a provider's webhook signature in production.

## Request / data flow

### Read paths (SSR)

The dashboard, campaigns list, and campaign detail pages are React Server Components that
`await` the CRM API directly (`force-dynamic` for always-fresh data). The customer table,
segment builder, campaign studio, and live monitor are client components using TanStack Query
against the same API.

### Campaign launch (write path)

```
POST /api/campaigns/:id/launch
  → resolve audience from segment rule (segmentRuleToPrismaWhere)
  → clean: drop no-consent + recently-messaged shoppers
  → split a deterministic 10% control group
  → allocate the rest across A/B variants
  → render per-customer message bodies (template + customer vars)
  → createMany Communications (QUEUED) + append QUEUED events
  → seed organic baseline conversions for the control group (for lift)
  → enqueue one BullMQ send job per targeted communication
```

### Delivery simulation (callback path)

```
send worker → POST channel-service /api/simulate-send
  → channel-service plans a weighted lifecycle (engagement bias × channel prior)
  → schedules delayed BullMQ jobs (SENT, DELIVERED, READ, CLICKED, ATTRIBUTED_ORDER / FAILED)
  → each job posts a signed, idempotent callback to crm-api
crm-api /api/receipts/channel-callback
  → verify HMAC → guard idempotencyKey → append CommunicationEvent
  → re-project Communication.status → write AttributedOrder on conversion
```

## Event sourcing for the send funnel

`CommunicationEvent` is append-only. `Communication.status` is a **materialised projection**
of the latest meaningful event (`projectStatus` in `packages/shared`). This gives us:

- **Idempotency** — re-applying an event never corrupts state.
- **Out-of-order safety** — status is the furthest-along event ever seen, so a `READ` arriving
  before `DELIVERED` doesn't regress the funnel.
- **Auditability / replay** — the full funnel is reconstructable from the log, and every raw
  callback is also stored verbatim in `ChannelCallback`.

## Attribution & control group

A configurable (default 10%) holdout receives **no message**. We seed a low organic baseline
conversion for the control group at launch, so the monitor can compute true **incremental
lift**: `(targetedConversion − controlConversion) / controlConversion`.

## Performance choices

- **Indexes** on every hot filter (see schema): customer city/spend/churn/category/persona/
  lastPurchase/rfm; campaign status/created; communication campaign+status+variant; event
  timestamp.
- **Server-side pagination + sorting + filtering** for the 10k-row customer table; debounced
  search; `keepPreviousData` to avoid flicker.
- **`createMany`** batched inserts for launch + seed (52k orders seed in ~12s).
- **Lazy loading**: the Recharts timeline and the AI insights panel are `dynamic()`-imported;
  charts never ship in the initial bundle.
- **RSC-first**: only the genuinely interactive surfaces are client components.

## Tech choices

| Concern | Choice | Why |
| --- | --- | --- |
| Monorepo | pnpm workspaces + Turborepo | fast, simple, shared TS packages |
| API | Fastify | lightweight, fast, great TS ergonomics |
| ORM | Prisma | typed queries, painless migrations, `groupBy` for analytics |
| Queue | BullMQ + Redis | delayed jobs, retries, dead-letter set |
| Validation | Zod | one schema, shared across boundaries + AI output parsing |
| UI | Next.js + Tailwind + shadcn-style | premium, accessible, RSC-friendly |
