'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { segmentsQueryKey } from '@/lib/segments';
import type { SegmentSummary } from '@/lib/types';
import { useBrand } from '@/contexts/brand-context';

export function useSavedSegments() {
  const { selectedBrandId } = useBrand();
  return useQuery<SegmentSummary[]>({
    queryKey: segmentsQueryKey(selectedBrandId),
    queryFn: () => api.segments(),
    enabled: Boolean(selectedBrandId),
    staleTime: 30_000,
  });
}
