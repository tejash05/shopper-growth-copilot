'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { formatInrCompact } from '@scp/shared';
import { getLatestSegmentRule } from '@/lib/segments';
import type { SegmentSummary } from '@/lib/types';
import { SegmentRuleDetails } from '@/components/segments/segment-rule-details';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SavedSegmentPreviewProps {
  segment: SegmentSummary;
}

export function SavedSegmentPreview({ segment }: SavedSegmentPreviewProps) {
  const rule = getLatestSegmentRule(segment);

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h3 className="font-semibold text-foreground">{segment.name}</h3>
          {segment.naturalLanguageQuery ? (
            <p className="text-sm italic text-muted-foreground">“{segment.naturalLanguageQuery}”</p>
          ) : segment.description ? (
            <p className="text-sm text-muted-foreground">{segment.description}</p>
          ) : null}
        </div>
        <Link
          href={`/campaigns/studio?segmentId=${segment.id}`}
          className={cn(buttonVariants({ size: 'sm' }), 'shrink-0 self-start')}
        >
          Use in Campaign
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <PreviewStat
          label="Audience"
          value={
            segment.cachedAudienceSize != null
              ? segment.cachedAudienceSize.toLocaleString('en-IN')
              : '—'
          }
        />
        <PreviewStat
          label="Revenue potential"
          value={
            segment.cachedRevenuePotential != null
              ? formatInrCompact(segment.cachedRevenuePotential)
              : '—'
          }
          accent
        />
        <PreviewStat
          label="Saved"
          value={new Date(segment.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        />
      </div>

      {segment.aiExplanation && (
        <p className="text-sm leading-relaxed text-muted-foreground">{segment.aiExplanation}</p>
      )}

      <SegmentRuleDetails rule={rule} />
    </div>
  );
}

function PreviewStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <span>
      <span className="text-muted-foreground">{label}: </span>
      <span className={cn('font-medium tabular-nums', accent && 'text-accent')}>{value}</span>
    </span>
  );
}
