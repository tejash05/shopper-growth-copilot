/** Default win-back goal used by dashboard opportunity CTAs. */
export const DEFAULT_WINBACK_GOAL =
  'Win back high-value shoppers who haven’t purchased in 45 days using WhatsApp as the primary channel and optimise for repeat purchase revenue.';

export interface StudioUrlParams {
  goal?: string;
  segmentId?: string;
}

/** Build a Campaign Studio path with optional query params. */
export function buildStudioUrl(params?: StudioUrlParams): string {
  const search = new URLSearchParams();
  if (params?.goal?.trim()) search.set('goal', params.goal.trim());
  if (params?.segmentId) search.set('segmentId', params.segmentId);
  const qs = search.toString();
  return qs ? `/campaigns/studio?${qs}` : '/campaigns/studio';
}

/** Read and normalise a goal from `?goal=`. */
export function readPrefilledGoal(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  return raw.trim();
}

/** Remove keys from the current studio search string. */
export function studioPathWithout(
  current: URLSearchParams | string,
  omit: ('goal' | 'segmentId')[],
): string {
  const search = new URLSearchParams(typeof current === 'string' ? current : current.toString());
  omit.forEach((key) => search.delete(key));
  const qs = search.toString();
  return qs ? `/campaigns/studio?${qs}` : '/campaigns/studio';
}
