'use client';

import * as React from 'react';
import type { SegmentRule } from '@scp/shared';
import { useSavedSegments } from '@/hooks/use-saved-segments';
import { findSegmentById, getLatestSegmentRule } from '@/lib/segments';
import type { CampaignPlanResponse, SegmentSummary } from '@/lib/types';

export type SegmentSource = 'ai' | 'saved';

export function useCampaignAudience(options: {
  initialSegmentId?: string | null;
  plan: CampaignPlanResponse | null;
}) {
  const { data: segments, isLoading, isError, refetch } = useSavedSegments();
  const [source, setSource] = React.useState<SegmentSource>(options.initialSegmentId ? 'saved' : 'ai');
  const [selectedSegmentId, setSelectedSegmentId] = React.useState<string | null>(
    options.initialSegmentId ?? null,
  );
  const [segmentsResolved, setSegmentsResolved] = React.useState(!options.initialSegmentId);

  const selectedSegment = React.useMemo(
    () => (selectedSegmentId ? findSegmentById(segments ?? [], selectedSegmentId) : undefined),
    [segments, selectedSegmentId],
  );

  const savedRule = React.useMemo(
    () => (selectedSegment ? getLatestSegmentRule(selectedSegment) : undefined),
    [selectedSegment],
  );

  const aiRule = options.plan?.plan.result.segmentRule;

  const activeRule: SegmentRule | undefined = source === 'saved' ? savedRule : aiRule;

  // Preload segment from ?segmentId= once the list is available.
  React.useEffect(() => {
    if (!options.initialSegmentId) {
      setSegmentsResolved(true);
      return;
    }
    if (isLoading) return;

    setSegmentsResolved(true);
    const match = findSegmentById(segments ?? [], options.initialSegmentId);
    if (match) {
      setSource('saved');
      setSelectedSegmentId(match.id);
    } else if (!isError) {
      setSelectedSegmentId(null);
      setSource('ai');
    }
  }, [options.initialSegmentId, segments, isLoading, isError]);

  const segmentNotFound = Boolean(
    options.initialSegmentId &&
      segmentsResolved &&
      !isLoading &&
      !isError &&
      !findSegmentById(segments ?? [], options.initialSegmentId),
  );

  const selectSegment = React.useCallback((segment: SegmentSummary | null) => {
    setSelectedSegmentId(segment?.id ?? null);
    if (segment) setSource('saved');
  }, []);

  const clearSegmentSelection = React.useCallback(() => {
    setSelectedSegmentId(null);
    setSource('ai');
  }, []);

  return {
    source,
    setSource,
    selectedSegmentId,
    setSelectedSegmentId,
    selectSegment,
    clearSegmentSelection,
    selectedSegment,
    savedRule,
    activeRule,
    segmentNotFound,
    segments: segments ?? [],
    segmentsLoading: isLoading,
    segmentsError: isError,
    refetchSegments: refetch,
  };
}
