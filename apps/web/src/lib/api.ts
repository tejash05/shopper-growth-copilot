/**
 * Thin typed client for the CRM API. Used by both Server Components (direct
 * await) and Client Components (via TanStack Query). The same base URL works in
 * both contexts in local/dev; in production the server could use an internal URL.
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_CRM_API_URL ?? process.env.CRM_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type FetchOpts = RequestInit & { revalidate?: number };

export async function apiFetch<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const { revalidate, ...init } = opts;
  const headers = new Headers(init.headers);
  // Only declare JSON when we actually send a body — Fastify rejects empty bodies
  // with Content-Type: application/json (e.g. POST /launch).
  if (init.body !== undefined && init.body !== null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    ...(revalidate !== undefined ? { next: { revalidate } } : { cache: 'no-store' }),
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.message ?? message;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  dashboard: () => apiFetch<import('./types').DashboardData>('/api/dashboard'),
  customers: (qs: string) =>
    apiFetch<import('@scp/shared').Paginated<import('@scp/shared').CustomerListItem>>(
      `/api/customers?${qs}`,
    ),
  customer: (id: string) => apiFetch<import('./types').CustomerDetail>(`/api/customers/${id}`),
  segments: () => apiFetch<import('./types').SegmentSummary[]>('/api/segments'),
  campaigns: () => apiFetch<import('./types').CampaignSummary[]>('/api/campaigns'),
  campaign: (id: string) => apiFetch<import('./types').CampaignDetail>(`/api/campaigns/${id}`),
  campaignMetrics: (id: string) =>
    apiFetch<import('./types').CampaignMetricsResponse>(`/api/campaigns/${id}/metrics`),
  campaignInsights: (id: string) =>
    apiFetch<import('./types').CampaignInsightsResponse>(`/api/campaigns/${id}/insights`),
};
