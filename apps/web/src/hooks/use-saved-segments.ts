'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SEGMENTS_QUERY_KEY } from '@/lib/segments';
import type { SegmentSummary } from '@/lib/types';

export function useSavedSegments() {
  return useQuery<SegmentSummary[]>({
    queryKey: SEGMENTS_QUERY_KEY,
    queryFn: () => api.segments(),
    staleTime: 30_000,
  });
}
