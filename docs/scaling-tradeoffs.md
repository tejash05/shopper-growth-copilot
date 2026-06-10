# Scaling & Tradeoffs

## What this build optimises for

A take-home should be **runnable, readable, and correct end-to-end** on a laptop. So:

- **PostgreSQL** is the single source of truth for all entities.
- **Redis + BullMQ** handle async sends and callback simulation (delayed jobs, retries, DLQ).
- **Analytics** are computed with SQL aggregations (`groupBy`, `aggregate`, one raw query for
  the top-converting audience cells) plus light per-request work — no separate OLAP store.
- **Single brand, no auth** — the demo is single-tenant (NovaWear) to keep focus on the deep
  campaign journey rather than plumbing.

These are explicit, deliberate scope choices, not omissions.

## Where it would break at scale, and the fix

| Dimension | Take-home approach | At scale |
| --- | --- | --- |
| **Event ingestion** | HTTP callbacks → Postgres rows | Stream communication events through **Kafka / SQS / PubSub**; consumers materialise state. |
| **Sending** | One in-process BullMQ worker | Dedicated, horizontally-scaled **send workers**; shard by campaign; per-channel rate limiting. |
| **Analytics** | SQL aggregations on the OLTP DB | Push events to **ClickHouse / BigQuery**; pre-aggregate funnel metrics per campaign/variant/channel. |
| **Segmentation** | Rule → `WHERE` at query time | **Precompute segment membership** (materialised tables) + scheduled RFM recompute on new orders. |
| **Event volume** | One `CommunicationEvent` table | **Partition** events by date and/or campaign; roll up + archive cold partitions. |
| **Failed callbacks** | BullMQ failed set | True **DLQ** with alerting + automated replay tooling. |
| **AI cost** | One LLM call per action | **Cache** generated templates; personalise via template variables instead of per-user LLM calls; batch + rate-limit. |
| **Live monitor** | Client polling every 3s | **SSE / WebSocket** push from an events consumer. |
| **Multi-tenancy** | Single brand, cached id | Brand scoping from auth/session on every query; row-level security. |

## Specific tradeoffs made

- **Denormalised customer metrics.** `totalSpend`, `orderCount`, RFM, persona, etc. are stored
  on `Customer` (computed at seed time) so the 10k-row table and segment resolution are fast,
  indexed scans. In production these are recomputed incrementally on each new order (or via a
  nightly job); the pure functions in `packages/shared/domain` are written to support exactly
  that single-customer recompute.
- **Materialised status + append-only events.** We pay a little write amplification (event +
  status update) to get idempotency, out-of-order safety, and full replayability. Worth it.
- **Control-group baseline is seeded at launch.** Rather than wait for real organic behaviour,
  we synthesise a small baseline conversion for the holdout so **lift** is demonstrable
  immediately. In production the control group is simply measured.
- **`force-dynamic` SSR** on dashboards for always-fresh numbers. With real traffic you'd add
  short `revalidate` windows or a cache in front of the aggregations.
- **No CLI build step for services** — they run via `tsx` and import workspace TS directly,
  which keeps the monorepo simple. A production deploy would compile each service.

## Capacity sketch

At ~10k shoppers and ~50k orders the seed runs in ~12s and every page is sub-100ms locally.
The same schema + indexes comfortably handle low-millions of customers on a single Postgres
instance for OLTP; the analytics path is the first thing to move off Postgres as campaign
volume grows.
