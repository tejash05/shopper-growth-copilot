'use client';

import * as React from 'react';
import { Bookmark, Sparkles, X } from 'lucide-react';
import { formatInrCompact } from '@scp/shared';
import type { SegmentSource } from '@/hooks/use-campaign-audience';
import type { SegmentSummary } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Label, Spinner } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/components/shared/states';
import { SegmentRuleDetails } from '@/components/segments/segment-rule-details';
import { getLatestSegmentRule } from '@/lib/segments';
import { cn } from '@/lib/utils';

interface SegmentSourcePanelProps {
  source: SegmentSource;
  onSourceChange: (source: SegmentSource) => void;
  segments: SegmentSummary[];
  segmentsLoading: boolean;
  segmentsError: boolean;
  selectedSegmentId: string | null;
  onSelectSegment: (segmentId: string) => void;
  selectedSegment?: SegmentSummary;
  segmentNotFound?: boolean;
  onClearSegment?: () => void;
  aiSegmentName?: string;
  aiExplanation?: string;
  onRetryLoad?: () => void;
}

export function SegmentSourcePanel({
  source,
  onSourceChange,
  segments,
  segmentsLoading,
  segmentsError,
  selectedSegmentId,
  onSelectSegment,
  selectedSegment,
  segmentNotFound,
  onClearSegment,
  aiSegmentName,
  aiExplanation,
  onRetryLoad,
}: SegmentSourcePanelProps) {
  const savedRule = selectedSegment ? getLatestSegmentRule(selectedSegment) : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign audience</CardTitle>
        <CardDescription>
          Use an AI-recommended segment from your plan, or reuse a segment you’ve already saved.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {segmentNotFound && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
            <p className="text-sm font-medium text-destructive">Saved segment not found</p>
            <p className="text-sm text-muted-foreground">
              You can continue with an AI-generated segment or choose another saved segment.
            </p>
            {onClearSegment && (
              <Button variant="outline" size="sm" onClick={onClearSegment}>
                Clear invalid segment link
              </Button>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <SourceToggle
            active={source === 'ai'}
            onClick={() => onSourceChange('ai')}
            icon={Sparkles}
            label="AI recommended segment"
            hint="From your generated campaign plan"
          />
          <SourceToggle
            active={source === 'saved'}
            onClick={() => onSourceChange('saved')}
            icon={Bookmark}
            label="Saved segment"
            hint="Reuse a saved audience"
          />
        </div>

        {source === 'ai' ? (
          aiSegmentName ? (
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="primary">AI plan</Badge>
                <p className="text-sm font-medium">{aiSegmentName}</p>
              </div>
              {aiExplanation && (
                <p className="text-sm leading-relaxed text-muted-foreground">{aiExplanation}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Generate a campaign plan above to get an AI-recommended audience, or switch to a saved segment.
            </p>
          )
        ) : segmentsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            Loading saved segments…
          </div>
        ) : segmentsError ? (
          <ErrorState
            title="Couldn’t load saved segments"
            description="Ensure the CRM API is running."
            action={
              onRetryLoad ? (
                <Button variant="outline" size="sm" onClick={onRetryLoad}>
                  Try again
                </Button>
              ) : undefined
            }
          />
        ) : segments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No saved segments yet. Save one from Segment Builder, then return here to reuse it.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Choose saved segment</Label>
              <Select
                value={selectedSegmentId ?? ''}
                onChange={(e) => onSelectSegment(e.target.value)}
              >
                <option value="">Select a segment…</option>
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.cachedAudienceSize != null ? ` · ${s.cachedAudienceSize.toLocaleString('en-IN')} shoppers` : ''}
                  </option>
                ))}
              </Select>
            </div>

            {selectedSegment && savedRule && (
              <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{selectedSegment.name}</p>
                    {selectedSegment.naturalLanguageQuery && (
                      <p className="mt-1 text-sm italic text-muted-foreground">
                        “{selectedSegment.naturalLanguageQuery}”
                      </p>
                    )}
                  </div>
                  {onClearSegment && (
                    <Button variant="ghost" size="sm" onClick={onClearSegment} className="shrink-0">
                      <X className="size-4" />
                      Clear
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <span>
                    <span className="text-muted-foreground">Audience: </span>
                    <span className="font-medium tabular-nums">
                      {selectedSegment.cachedAudienceSize?.toLocaleString('en-IN') ?? '—'}
                    </span>
                  </span>
                  <span>
                    <span className="text-muted-foreground">Revenue potential: </span>
                    <span className="font-medium tabular-nums text-accent">
                      {selectedSegment.cachedRevenuePotential != null
                        ? formatInrCompact(selectedSegment.cachedRevenuePotential)
                        : '—'}
                    </span>
                  </span>
                </div>
                {selectedSegment.aiExplanation && (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {selectedSegment.aiExplanation}
                  </p>
                )}
                <SegmentRuleDetails rule={savedRule} />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SourceToggle({
  active,
  onClick,
  icon: Icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-w-[200px] flex-1 flex-col items-start rounded-lg border px-4 py-3 text-left transition-colors sm:max-w-xs',
        active
          ? 'border-primary bg-primary/[0.06] ring-1 ring-primary/20'
          : 'border-border bg-card hover:border-primary/30 hover:bg-muted/30',
      )}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        <Icon className={cn('size-4', active ? 'text-primary' : 'text-muted-foreground')} />
        {label}
      </span>
      <span className="mt-0.5 text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}
