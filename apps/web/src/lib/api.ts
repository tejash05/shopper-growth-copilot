/**
 * Thin typed client for the CRM API. Used by both Server Components (direct
 * await) and Client Components (via TanStack Query). The same base URL works in
 * both contexts in local/dev; in production the server could use an internal URL.
 */
import { BRAND_COOKIE_NAME, BRAND_STORAGE_KEY } from '@/lib/brand-storage';

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

type FetchOpts = RequestInit & { revalidate?: number; brandId?: string | null; skipBrandHeader?: boolean };

function shouldAttachBrandHeader(path: string): boolean {
  const pathOnly = path.split('?')[0] ?? path;
  if (pathOnly === '/api/brands') return false;
  return true;
}

async function resolveBrandIdForRequest(explicit?: string | null): Promise<string | null> {
  if (explicit !== undefined) return explicit;
  if (typeof window !== 'undefined') {
    return localStorage.getItem(BRAND_STORAGE_KEY);
  }
  const { cookies } = await import('next/headers');
  const jar = await cookies();
  return jar.get(BRAND_COOKIE_NAME)?.value ?? null;
}

export async function apiFetch<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const { revalidate, brandId: explicitBrandId, skipBrandHeader, ...init } = opts;
  const headers = new Headers(init.headers);
  if (init.body !== undefined && init.body !== null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!skipBrandHeader && shouldAttachBrandHeader(path)) {
    const brandId = await resolveBrandIdForRequest(explicitBrandId);
    if (brandId) headers.set('X-Brand-Id', brandId);
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

export interface BrandSummary {
  id: string;
  name: string;
  industry: string;
  createdAt: string;
}

export interface GenerateDemoDataResult {
  brandId: string;
  brandName: string;
  customers: number;
  orders: number;
  orderItems: number;
  products: number;
}

export const api = {
  brands: () => apiFetch<BrandSummary[]>('/api/brands'),
  createBrand: (body: { name: string; industry: string }) =>
    apiFetch<BrandSummary>('/api/brands', {
      method: 'POST',
      body: JSON.stringify(body),
      skipBrandHeader: true,
    }),
  generateDemoData: (brandId: string) =>
    apiFetch<GenerateDemoDataResult>(`/api/brands/${brandId}/demo-data`, {
      method: 'POST',
      brandId,
    }),
  deleteBrand: (brandId: string) =>
    apiFetch<{ ok: true; id: string; name: string }>(`/api/brands/${brandId}`, {
      method: 'DELETE',
      skipBrandHeader: true,
    }),
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
  importJobs: () => apiFetch<import('@scp/shared').ImportJobSummary[]>('/api/import/jobs'),
  importPreview: async (formData: FormData) => {
    const brandId = await resolveBrandIdForRequest();
    const headers = new Headers();
    if (brandId) headers.set('X-Brand-Id', brandId);
    const res = await fetch(`${API_BASE}/api/import/preview`, {
      method: 'POST',
      headers,
      body: formData,
      cache: 'no-store',
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
    return res.json() as Promise<import('@scp/shared').ImportPreviewResult>;
  },
  importCommit: (payload: import('@scp/shared').ImportPayload, signal?: AbortSignal) =>
    apiFetch<import('@scp/shared').ImportCommitResult>('/api/import/commit', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
    }),
};
