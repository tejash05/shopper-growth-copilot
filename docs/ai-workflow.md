# AI Workflow

All AI lives in `packages/ai`. Prompts and output schemas are **centralised** — never
scattered across components or routes. The web app calls CRM API endpoints; the CRM API calls
the AI service and persists every run.

## Design principles

1. **Structured output, always.** Each capability has a Zod schema. Real-model output is
   parsed against it; mock output is constructed to satisfy it by definition.
2. **Explainable + confidence-scored.** Every call returns
   `{ result, explanation, confidence, provider, status, latencyMs }`.
3. **Deterministic fallback.** If `AI_PROVIDER=mock` (default) the capability runs locally. If
   `AI_PROVIDER=openai` and the model errors or returns malformed JSON, we fall back to the
   mock and mark the run `FALLBACK`. **The product is fully functional with no API key.**
4. **Auditable.** Every call is written to `AiAgentRun` (+ `AiAuditLog`) with input, output,
   provider, latency, and status.

## Capabilities

| Capability | Input | Output (schema) |
| --- | --- | --- |
| `parseSegmentIntent` | NL query | `{ rule, suggestedName, audienceMatters }` |
| `generateCampaignPlan` | goal (+ audience) | segment, channel mix, offer, strategy, samples, expected perf, risks |
| `generatePersonalizedMessages` | channel, offer, customers[] | per-customer `{ subject?, body }` |
| `recommendChannel` | audience channel mix | primary + fallback + scores |
| `estimateCampaignImpact` | audience, channel, AOV | delivery/read/click/conversion + revenue |
| `analyzeCampaignPerformance` | metrics + breakdowns | summary, what worked / didn't, best channel/variant/audience |
| `recommendNextAction` | metrics, best channel | next campaign name/goal/audience/channel/offer |

## How a capability is structured

Each capability file exports a `Capability<Input, Output>` with:

- `buildPrompt(input)` — the exact prompt sent to a real model (also documents intended
  behaviour).
- `schemaHint` — the Zod schema embedded in the prompt for structured output.
- `mock(input)` — a deterministic implementation that returns `{ result, explanation,
  confidence }`.

The runner (`runCapability`) picks the provider, validates real output against the Zod schema,
and handles the fallback. The public surface is `createAiService(ctx)`.

## The deterministic engine (mock mode)

Mock mode is not a stub — it is a real, rules-based engine:

- **`parseSegmentIntent`** runs a heuristic NL parser that extracts city, spend thresholds
  (`₹10,000`, `10k`, `2.4L`), recency windows (_"haven't purchased in 45 days"_ → `gte`,
  _"in the last 6 months"_ → `lte`), churn/VIP intent, persona and category hints.
- **`generatePersonalizedMessages`** uses category-aware copy banks and enforces channel rules
  (SMS < 160 chars, Email has a subject, WhatsApp/RCS are CTA-led).
- **`generateCampaignPlan` / `recommendChannel` / `estimateCampaignImpact`** apply
  retail-tuned funnel priors and channel-engagement weights to the real, resolved audience.
- **`analyzeCampaignPerformance`** computes best channel by click rate, best variant by
  conversion, lift vs control, and produces the executive summary.

## Grounding in real data

The CRM API grounds AI plans in the actual database: after `generateCampaignPlan` returns a
rule, the API runs `previewSegment` to attach the **real audience size, revenue potential, and
channel mix**, then feeds that into `recommendChannel` and `estimateCampaignImpact`. The AI
never hallucinates audience numbers — they come from SQL.

## Switching to a real model

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

`callOpenAi` uses Chat Completions JSON mode; the response is `JSON.parse`d and validated by
the capability's Zod schema before it ever reaches the rest of the system.
