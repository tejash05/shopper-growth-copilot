# Channel Service

`apps/channel-service` is a standalone Fastify service that **simulates** an external
omni-channel messaging provider (WhatsApp / SMS / Email / RCS). It deliberately mirrors how a
real Business Solution Provider behaves: accept a send, process asynchronously, and call back
with delivery + engagement webhooks.

> No real providers are integrated. This is a faithful simulation of the integration shape.

## Endpoints

### `POST /api/simulate-send`

Called by the CRM send worker. Validates the request, plans a weighted lifecycle, and
schedules each event as a **delayed BullMQ job**. Returns `202 Accepted` immediately.

```jsonc
{
  "messageId": "<communicationId>",
  "campaignId": "...",
  "customerId": "...",
  "channel": "WHATSAPP",
  "to": "+9198...",
  "body": "Hey Priya! ...",
  "engagementBias": 0.55,        // persona-derived, weights outcomes
  "averageOrderValue": 5000      // used to size attributed order value
}
```

### `GET /health`

Liveness probe.

## Lifecycle simulation

`planLifecycle` produces a realistic, **conditional** funnel weighted by the customer's
engagement bias (persona) and a per-channel multiplier (WhatsApp > RCS > SMS > Email):

```
SENT → DELIVERED → READ → CLICKED → ATTRIBUTED_ORDER     (or FAILED)
```

- ~3% hard-fail before delivery; ~3% fail at the carrier step.
- `read | click | conversion` each fire conditionally on the previous step, with
  probabilities scaled by `bias × channelMultiplier`.
- Events are scheduled with increasing delays (jittered) so they arrive over ~15–20s — but the
  CRM is resilient to **out-of-order** arrival regardless.

## Callback protocol (channel → CRM)

`POST {CRM_API_URL}/api/receipts/channel-callback`

```jsonc
{
  "messageId": "...", "campaignId": "...", "customerId": "...",
  "eventType": "DELIVERED", "timestamp": "2026-06-10T...Z",
  "channel": "WHATSAPP", "providerMessageId": "prov_...",
  "idempotencyKey": "<messageId>:<eventType>",   // deterministic, exactly-once
  "signature": "<hmac-sha256 hex>",
  "metadata": { "orderValue": 4200 }              // for ATTRIBUTED_ORDER / FAILED
}
```

### Security: HMAC signatures

Both services import the **same** `buildSignaturePayload` + `signPayload` from
`@scp/shared/crypto`, so the signed byte layout can never drift. The signature covers a
canonical, ordered subset of fields (not the raw JSON, to avoid key-ordering ambiguity):

```
messageId . campaignId . customerId . eventType . idempotencyKey . timestamp
```

The CRM verifies with a constant-time comparison (`timingSafeEqual`). Invalid signatures are
stored (`signatureValid=false`) and rejected with `401`.

### Idempotency

`ChannelCallback.idempotencyKey` is `UNIQUE`. The CRM attempts to insert it first; a duplicate
(`P2002`) short-circuits with `200 { status: "duplicate" }` and **no** state change. Because
the key is `messageId:eventType`, BullMQ retries of the same event are naturally collapsed.

### Out-of-order handling

The CRM appends the event and recomputes `Communication.status` via `projectStatus`, which
selects the furthest-along stage ever observed. A late `DELIVERED` after a `CLICKED` therefore
cannot regress the funnel.

## Failure handling & dead-lettering

- **CRM send worker:** BullMQ `attempts: 3` with exponential backoff. On final failure the
  communication is marked `FAILED` with a reason and a `FAILED` event is appended.
- **Channel callback worker:** `attempts: 5` with backoff. 4xx responses (rejected/duplicate)
  are treated as terminal — only 5xx is retried. Exhausted jobs remain in BullMQ's failed set
  (the dead-letter store).
