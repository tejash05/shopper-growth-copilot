'use client';

import * as React from 'react';
import { Megaphone, RefreshCw } from 'lucide-react';
import { useSavedSegments } from '@/hooks/use-saved-segments';
import { findSegmentById, formatSegmentOptionLabel } from '@/lib/segments';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/misc';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/shared/states';
import { SavedSegmentPreview } from '@/components/segments/saved-segment-preview';
import { cn } from '@/lib/utils';

export function SavedSegmentsList() {
  const { data, isLoading, isError, refetch, isFetching } = useSavedSegments();
  const [selectedId, setSelectedId] = React.useState('');

  const selectedSegment = React.useMemo(
    () => (selectedId && data ? findSegmentById(data, selectedId) : undefined),
    [selectedId, data],
  );

  const selectionMissing = Boolean(selectedId && data && !selectedSegment);

  // Clear stale selection if segment was deleted after refresh.
  React.useEffect(() => {
    if (selectionMissing) setSelectedId('');
  }, [selectionMissing]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
        <div>
          <CardTitle className="text-base">Saved segments</CardTitle>
          <CardDescription>Reuse saved audiences in Campaign Studio.</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching || isLoading}>
          <RefreshCw className={cn('size-4', isFetching && 'animate-spin')} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        ) : isError ? (
          <ErrorState
            title="Could not load saved segments"
            description="Ensure the CRM API is running."
            action={
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        ) : !data?.length ? (
          <EmptyState
            icon={Megaphone}
            title="No saved segments yet"
            description="Build an audience above and click Save segment. It will appear here for reuse in campaigns."
            className="border-0 bg-muted/20 py-8"
          />
        ) : (
          <>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Choose a saved segment</Label>
              <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                <option value="">Choose a saved segment</option>
                {data.map((segment) => (
                  <option key={segment.id} value={segment.id}>
                    {formatSegmentOptionLabel(segment)}
                  </option>
                ))}
              </Select>
            </div>

            {selectionMissing && (
              <p className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-muted-foreground">
                The selected segment is no longer available. Choose another segment from the list.
              </p>
            )}

            {selectedSegment && <SavedSegmentPreview segment={selectedSegment} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}
