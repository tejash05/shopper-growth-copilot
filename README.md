# Shopper Growth Copilot

**An AI-native mini CRM for retail marketing.** Give it a business goal in plain English —
_"Win back high-value shoppers who haven't purchased in 45 days and promote the summer
collection"_ — and it builds the segment, generates personalised messages, recommends the
channel mix, launches the campaign, simulates delivery across WhatsApp/SMS/Email/RCS, tracks
the funnel in real time, attributes revenue against a control group, and writes the
post-campaign analysis.

This is **not** a generic sales CRM. It is a consumer/retail growth tool in the spirit of
Xeno — segmentation, personalised campaigns, simulated omni-channel delivery, and revenue
attribution for a fashion brand (**NovaWear**).

## Live Demo

**App:** [https://web-production-092f5.up.railway.app/](https://web-production-092f5.up.railway.app/)

**Walkthrough video:** [Shopper Growth Copilot demo (Google Drive)](https://drive.google.com/file/d/1bwMOvtPTRYMD-csPsYYSfiHt716pOm5r/view?usp=sharing)

---

## Architecture Overview

| Layer | Technology | Role |
| --- | --- | --- |
| **Frontend** | Next.js 15, React, Tailwind | Command Center, segments, studio, monitor |
| **CRM API** | Fastify, Prisma, PostgreSQL | Product APIs, campaigns, imports, AI, receipts |
| **Async sends** | Redis + BullMQ | Outbound send queue only — not used for dashboard/table caching |
| **Channel service** | Fastify (separate process) | Stubbed WhatsApp / SMS / Email / RCS provider |

In production messaging, providers do not return final delivery results in the same HTTP response. The CRM submits a send; the provider later posts webhooks for `sent`, `delivered`, `read`, `clicked`, `failed`, and so on. This project models that lifecycle: **crm-api** enqueues sends, **channel-service** simulates delayed lifecycle events, and posts **HMAC-signed, idempotent** callbacks to `/api/receipts/channel-callback`. `CommunicationEvent` rows are append-only; `Communication.status` is a materialised projection.

More detail: [`docs/architecture.md`](docs/architecture.md) · [`apps/crm-api/README.md`](apps/crm-api/README.md) · [`apps/channel-service/README.md`](apps/channel-service/README.md)

---

## Product Walkthrough

Screenshots from the live demo workspace. [Open the app →](https://web-production-092f5.up.railway.app/)

### Command Center

Workspace-scoped KPIs, communication performance, and an AI opportunity card with recoverable revenue and a recommended next action.

<img src="./repo-assets/command-center-novawear.png" alt="Command Center" width="100%" />

<p align="center"><em>NovaWear demo dashboard — shoppers, revenue, at-risk count, and active campaigns</em></p>

### Workspace & Data Import

Switch workspaces from the sidebar, generate brand-scoped demo data for empty tenants, or upload CSV/JSON shoppers and orders with preview, validation, and import history.

<table>
<tr>
<td width="50%" valign="top">
<img src="./repo-assets/empty-workspace.png" alt="Empty workspace" width="100%" />
<p align="center"><em>Empty workspace — generate demo data or upload files</em></p>
</td>
<td width="50%" valign="top">
<img src="./repo-assets/data-import.png" alt="Data import" width="100%" />
<p align="center"><em>Data import — JSON/CSV upload, templates, staged progress</em></p>
</td>
</tr>
</table>

### Shoppers Intelligence

Server-side paginated shopper table with RFM, churn risk, persona, favourite category, and a detail drawer for orders and campaign history.

<img src="./repo-assets/shoppers.png" alt="Shoppers intelligence table" width="100%" />

<p align="center"><em>Shopper intelligence table with filters, sorting, and profile drawer</em></p>

### Segment Builder

Natural-language intent is parsed into a structured segment rule with live audience preview, revenue potential, and saved segments reusable in Campaign Studio.

<img src="./repo-assets/segment-builder.png" alt="Segment builder" width="100%" />

<p align="center"><em>NL segment builder — AI-parsed rule and audience preview</em></p>

### AI Campaign Studio

Business goal → AI or saved segment → channel mix, offer, A/B variants with personalisation tokens, safety check, and launch.

<img src="./repo-assets/campaign-studio.png" alt="Campaign studio" width="100%" />

<p align="center"><em>Campaign Studio — plan, variants, and pre-launch safety panel</em></p>

### Campaign Monitoring & Performance

Live funnel metrics, channel and variant breakdown, lift vs control, timeline chart, and post-campaign AI insights after events settle.

<img src="./repo-assets/campaign-monitor.png" alt="Campaign monitor" width="100%" />

<p align="center"><em>Campaign monitor — funnel KPIs, channel split, and performance insights</em></p>

---

## Product thesis

A marketer should be able to express intent, not operate machinery. The Copilot turns a
goal into an end-to-end, measurable campaign while keeping a human in the loop at every
decision point (segment preview, message preview, safety panel, launch). Every AI output is
**structured, explained, confidence-scored, and falls back to a deterministic engine** so
the product is fully usable with zero API keys.

---

## Key features

| Area | What it does |
| --- | --- |
| **Command Center** | Total shoppers, revenue, repeat-purchase rate, at-risk shoppers, active campaigns, comms performance, and an **AI opportunity card** (recoverable revenue + recommended action). |
| **Customer intelligence** | 10k seeded shoppers with RFM, churn risk, LTV, favourite category, discount sensitivity, preferred channel, and a derived **persona** (VIP Fashion Loyalist, Dormant High Spender, …). Server-side paginated/sorted/filtered table with debounced search and a detail drawer (order + campaign timeline). |
| **NL segment builder** | Type intent → AI parses it into a structured rule → live audience preview (size, revenue potential, top categories, sample shoppers) → save. Saved segments can be reused in Campaign Studio. Manual rule builder fallback. |
| **Saved segments** | Segments saved from the builder appear in a reusable list with audience stats and rule preview. **Use in Campaign** opens Campaign Studio with the segment preloaded. |
| **AI Campaign Studio** | Goal → recommended segment *or* saved segment, channel mix, offer, message strategy, expected performance, risks → per-customer personalised messages → A/B variants → safety check → launch. |
| **Campaign safety panel** | Removes no-consent / recently-messaged / duplicate shoppers, flags SMS length + fatigue + discount-abuse risk, recommends a 10% control group. |
| **Live campaign monitor** | Near-real-time funnel (sent→delivered→read→clicked→converted), channel + A/B breakdown, **lift vs control**, engagement-over-time chart, and lazy-loaded AI insights. |
| **AI insights** | What worked / what didn't, best channel/variant/audience, and the recommended next campaign. |
| **Workspace data import** | Upload CSV or JSON shoppers/orders per workspace. Preview → validate → import with row-level errors, upsert dedupe, and automatic RFM/persona recompute. |
| **Workspace demo data** | Empty workspaces can generate brand-scoped demo shoppers without running global seed or touching NovaWear. |

Saved segments can be reused in Campaign Studio (`segmentId` + frozen `segmentRuleSnapshot` on each campaign).

---

## System diagram

```
web (Next.js) ──▶ crm-api (Fastify + Prisma + send worker) ──▶ channel-service (simulator)
                        │   ▲                                      │
                        ▼   └── HMAC callbacks (idempotent) ───────┘
                   PostgreSQL          Redis (BullMQ queues only)
```

Package layout and service READMEs: [`docs/architecture.md`](docs/architecture.md)

---

## Local setup

**Prerequisites:** Node ≥ 20, pnpm ≥ 9, Docker (for Postgres + Redis).

```bash
# 1. Install
pnpm install

# 2. Configure env (defaults work out of the box)
cp .env.example .env

# 3. Start Postgres + Redis
pnpm infra:up

# 4. Create schema + generate the demo dataset (10k shoppers, ~52k orders)
pnpm db:generate
pnpm db:push
pnpm db:seed          # the "Generate Demo Retail Dataset" action

# 5. Run everything (web :3000, crm-api :4000, channel-service :4001)
pnpm dev
```

Then open **http://localhost:3000**. A one-shot convenience is also available:
`pnpm setup` (install + generate + push + seed).

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://scp:scp@localhost:5432/...` | Postgres connection |
| `REDIS_URL` | `redis://localhost:6379` | BullMQ broker |
| `CRM_API_URL` / `NEXT_PUBLIC_CRM_API_URL` | `http://localhost:4000` | CRM API base |
| `CHANNEL_SERVICE_URL` | `http://localhost:4001` | Channel service base |
| `CHANNEL_CALLBACK_SECRET` | `dev-super-secret-rotate-me` | Shared HMAC secret for callbacks |
| `AI_PROVIDER` | `mock` | `mock` (no key needed) or `openai` |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | — / `gpt-4o-mini` | Used only when `AI_PROVIDER=openai` |

> **No API key? No problem.** With `AI_PROVIDER=mock` the entire AI surface runs on a
> deterministic engine (real NL parsing, personalisation, planning, analysis) so the demo is
> fully reproducible. Set `AI_PROVIDER=openai` + a key to use a live model; malformed model
> output automatically falls back to the mock and is flagged as `FALLBACK` in `AiAgentRun`.

---

## AI-native workflow

```
goal ─▶ generateCampaignPlan ─▶ segment rule ─▶ previewSegment (real audience)
     └▶ recommendChannel ─▶ estimateCampaignImpact ─▶ generatePersonalizedMessages
launch ─▶ (send worker → channel service → signed callbacks) ─▶ metrics
done  ─▶ analyzeCampaignPerformance ─▶ recommendNextAction
```

Seven capabilities (`parseSegmentIntent`, `generateCampaignPlan`,
`generatePersonalizedMessages`, `recommendChannel`, `estimateCampaignImpact`,
`analyzeCampaignPerformance`, `recommendNextAction`) each return
`{ result, explanation, confidence }` and are persisted to `AiAgentRun` + `AiAuditLog`.
Details in [`docs/ai-workflow.md`](docs/ai-workflow.md).

---

## Channel lifecycle & callback security

```
QUEUED → SENT → DELIVERED → READ → CLICKED → ATTRIBUTED_ORDER   (+ FAILED)
```

`CommunicationEvent` is **append-only**; `Communication.status` is a materialised projection
rebuildable from the log. Callbacks are **HMAC-signed**, **idempotent** (unique
`idempotencyKey`), and **out-of-order safe** (status never regresses). Failed sends use
BullMQ retries with exponential backoff and a dead-letter-style FAILED state. Full protocol
in [`docs/channel-service.md`](docs/channel-service.md).

---

## Data model

`Brand · Customer · Product · Order · OrderItem · Segment · SegmentRule · Campaign ·
CampaignVariant · Communication · CommunicationEvent · ChannelCallback · AttributedOrder ·
AiAgentRun · AiAuditLog`. Indexed for the hot read paths (customer filters by
city/spend/churn/category/persona/lastPurchase; campaign funnels by campaign/status/variant;
event log by timestamp). Schema: [`packages/db/prisma/schema.prisma`](packages/db/prisma/schema.prisma).

---

## Demo scenario (NovaWear)

1. Open **Campaign Studio**, keep the default goal, click **Generate campaign plan**.
2. AI recommends a **Dormant High-Value** segment (~800–1,500 shoppers depending on filters),
   WhatsApp primary + SMS fallback, a 15% offer, and projected revenue.
3. Preview personalised messages (each shopper gets a unique, category-aware message).
4. **Run safety check** → no-consent + recently-messaged shoppers removed, 10% control held.
5. **Launch** → the channel service simulates delivery; the monitor updates in near-real-time.
6. After events flow in, the monitor shows **WhatsApp out-performing SMS**, **lift vs control**,
   and an **AI insight** with the recommended next campaign.

---

## Workspace data import

Each workspace (brand) can load its own shopper and order data from **CSV** or **JSON** via
**Data Import** (`/data-import`). All import routes are scoped by the active workspace through
the `X-Brand-Id` header — the same email or phone can exist in NovaWear and another workspace
without conflict.

### Supported formats

| Format | Use case |
| --- | --- |
| **Combined JSON** | One file with `customers` and `orders` arrays |
| **customers.csv** | Shopper rows only |
| **orders.csv** | Order rows only (can be uploaded with customers.csv) |

Download sample templates from the import page (customer CSV, order CSV, JSON).

### Customer CSV columns

`externalCustomerId`, `firstName`, `lastName`, `email`, `phone`, `city`, `state`,
`preferredChannel`, `loyaltyTier`, `consentWhatsApp`, `consentSms`, `consentEmail`, `consentRcs`

**Required identity:** at least one of `externalCustomerId`, `email`, or `phone`.

### Order CSV columns

`externalOrderId`, `externalCustomerId`, `customerEmail`, `customerPhone`, `orderDate`,
`orderValue`, `currency`, `category`, `productName`, `quantity`, `status`

**Required:** `orderDate`, `orderValue`, `category` or `productName`, and a customer reference
via `externalCustomerId`, `customerEmail`, or `customerPhone`.

Defaults: currency = workspace currency (INR), `quantity = 1`, status = COMPLETED.

### JSON template

```json
{
  "customers": [
    {
      "externalCustomerId": "CUST001",
      "firstName": "Priya",
      "lastName": "Sharma",
      "email": "priya@example.com",
      "phone": "9876543210",
      "city": "Bangalore",
      "preferredChannel": "WHATSAPP",
      "loyaltyTier": "GOLD",
      "consentWhatsApp": true,
      "consentSms": true,
      "consentEmail": true,
      "consentRcs": false
    }
  ],
  "orders": [
    {
      "externalOrderId": "ORD001",
      "externalCustomerId": "CUST001",
      "orderDate": "2026-05-20",
      "orderValue": 2499,
      "currency": "INR",
      "category": "FASHION",
      "productName": "Summer Floral Dress",
      "quantity": 1,
      "status": "COMPLETED"
    }
  ]
}
```

### Import flow

1. **Upload** — choose JSON or CSV (max **10MB** per file).
2. **Preview** — first 10 rows per entity.
3. **Validate** — row-level Zod errors (row number, field, message).
4. **Import** — brand-scoped upsert (`externalCustomerId` → email → phone for customers;
   `externalOrderId` for orders).
5. **Done** — dashboard/customers refresh for the current workspace.

**Limits (v1):** 10,000 customers and 50,000 orders per import. Parsing is synchronous in-memory
for this take-home; production would use async jobs (BullMQ) and object storage (S3).

### Workspace demo data (not global seed)

On an empty workspace dashboard, **Generate demo data for this workspace** creates realistic
shoppers/orders for **that brand only** via `POST /api/brands/:brandId/demo-data`. It does **not**
call `pnpm db:seed`, truncate tables, or switch you to NovaWear. NovaWear remains available via
**View NovaWear demo workspace**.

---

## Scale assumptions & tradeoffs

For take-home scope: Postgres is the primary store; Redis/BullMQ handles async sends and callback
simulation only; analytics are SQL aggregations from Postgres. At production scale you'd
move communication events to Kafka/SQS, fan sends across dedicated workers, push analytics to
an OLAP store (ClickHouse/BigQuery), precompute segment membership, partition events by
date/campaign, add per-channel rate limiting and a real DLQ, and cache AI templates to cut
per-user LLM cost. Full discussion in [`docs/scaling-tradeoffs.md`](docs/scaling-tradeoffs.md).

---

## Useful commands

```bash
pnpm dev            # run web + both services
pnpm typecheck      # typecheck all packages/apps
pnpm build          # build everything
pnpm db:seed        # regenerate the global NovaWear demo dataset (wipes all brands)
pnpm db:push        # apply schema changes (required after pulling import models)
pnpm db:studio      # open Prisma Studio
pnpm infra:down     # stop Postgres + Redis
```

## Future improvements

- AuthN/Z + RBAC (workspace scoping exists via `X-Brand-Id`; no login yet).
- Real provider adapters behind the channel-service interface.
- Precomputed/materialised segment membership + scheduled recompute of RFM.
- Streaming monitor via SSE/WebSockets instead of polling.
- Per-channel send-time optimisation and frequency capping across campaigns.
- Caching layer + OLAP for cross-campaign analytics.
