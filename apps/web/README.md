# Web App

Marketer-facing UI for **Shopper Growth Copilot** — an AI-native mini CRM for retail and D2C brands.

**Stack:** Next.js 15 (App Router), React 18, TypeScript, Tailwind CSS 3, TanStack React Query v5, TanStack React Table v8, Recharts, react-hook-form + Zod, lucide-react, driver.js. Shared contracts come from `@scp/shared` (DTOs/enums) and `@scp/ai` (types only).

## Purpose

This app is the primary interface for marketers. It turns CRM data, AI recommendations, and campaign lifecycle events into a coherent workflow: understand growth opportunities, define audiences, plan and launch campaigns, then monitor delivery and attributed revenue. The frontend does not own business logic or messaging; it orchestrates user actions against the CRM API.

## Responsibilities

- **Workspace selection** — create/switch brand workspaces; scope all API calls to the active brand
- **Command Center** — dashboard with growth KPIs and AI opportunity cards
- **Shopper intelligence** — searchable, sortable shopper table with customer metrics
- **Segment Builder** — natural-language and rule-based audience definition
- **AI Campaign Studio** — goal-driven campaign planning with AI-generated copy and channel mix
- **Campaign list & Campaign Monitor** — launch campaigns and track funnel metrics over time
- **Data Import UI** — CSV upload for shoppers and orders with progress and error feedback
- **Onboarding tour** — guided first-run experience via driver.js

## App structure

Source lives under `src/`:

| Folder | Role |
|--------|------|
| `app/` | Next.js App Router routes, layouts, loading and error boundaries |
| `components/` | Reusable UI primitives and feature modules (dashboard, campaigns, import, layout) |
| `contexts/` | `brand-context` (active workspace) and `onboarding-context` (tour state) |
| `hooks/` | Client data hooks, e.g. `use-campaign-audience`, `use-saved-segments` |
| `lib/` | Typed API client (`api.ts`), campaign templates, navigation helpers, brand storage |

## Key pages

| Route | Page |
|-------|------|
| `/` | Command Center |
| `/customers` | Shoppers |
| `/segments` | Segment Builder |
| `/campaigns/studio` | AI Campaign Studio |
| `/campaigns` | Campaign list |
| `/campaigns/[id]` | Campaign Monitor |
| `/data-import` | Data Import |

## Data flow

```
Browser → lib/api.ts → CRM API (Fastify)
              ↑
    BrandContext + X-Brand-Id header
```

1. All HTTP calls go through `src/lib/api.ts`, which resolves `NEXT_PUBLIC_CRM_API_URL` (and `CRM_API_URL` on the server).
2. The selected workspace is stored in React context and persisted (localStorage + cookie) so refreshes keep the same brand.
3. Every brand-scoped request sends `X-Brand-Id`; only `/api/brands` is exempt so workspaces can be listed or created without a prior selection.
4. **TanStack React Query** owns server state: queries, loading/error UI, cache invalidation after mutations, and polling on Campaign Monitor while sends and channel callbacks are still in flight.
5. The web app does **not** connect to Redis, Postgres, or the channel service. Async delivery events are ingested by the CRM API; the UI observes updated metrics via polling.

## UI and product decisions

- **Dashboard first** — marketers land on actionable growth opportunities instead of empty configuration screens.
- **AI Opportunity card** — surfaces a recommended next step so users do not manually scan metrics first.
- **Segment Builder** — supports both natural-language prompts and explicit rules for different user comfort levels.
- **Campaign Studio** — starts from a business goal and saved segment context, not low-level channel knobs.
- **Campaign Monitor** — shows sent → delivered → clicked → converted → revenue because messaging is asynchronous; polling reflects eventual consistency from the channel simulator.
- **Empty workspace state** — clear path to demo data or CSV import when a brand has no shoppers yet.

## Local development

From the monorepo root:

```bash
pnpm install
pnpm --filter @scp/web dev
```

The dev server runs on **http://localhost:3000**. Ensure the CRM API is reachable (default `http://localhost:4000`). Production builds use `SKIP_DEV_GUARD=1` when the API is not on localhost.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_CRM_API_URL` | Base URL for client-side API calls |
| `CRM_API_URL` | Optional server-side override (falls back to `NEXT_PUBLIC_CRM_API_URL`) |

Both point the web app at the CRM API. No database or Redis variables are required in this app.

## What this app does not do

- Send real WhatsApp, SMS, Email, or RCS messages
- Talk directly to Redis or Postgres
- Own campaign simulation or channel callback logic (handled by CRM API + channel service)
- Use Framer Motion

## Interview notes

- **Shared typed contracts** (`@scp/shared`, `@scp/ai`) keep request/response shapes aligned with the API and reduce frontend/backend drift.
- **React Query** separates server state from UI state, making loading, refetch, and invalidation predictable across dashboards and wizards.
- **Workspace context + `X-Brand-Id`** gives a simple multi-tenant UX without embedding brand IDs in every route.
- **Campaign Monitor polling** is intentional: delivery metrics arrive asynchronously; the UI models eventual updates rather than pretending sends are synchronous.
- **Product-led flow** — insight (Command Center) → audience (Segments) → campaign (Studio) → performance (Monitor) — mirrors how marketers actually work.
