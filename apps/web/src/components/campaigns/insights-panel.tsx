'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Lightbulb, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react';
import { CHANNEL_LABELS } from '@scp/shared';
import { api, ApiError } from '@/lib/api';
import { buildStudioUrl } from '@/lib/studio-navigation';
import type { CampaignInsightsResponse } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useBrand } from '@/contexts/brand-context';

interface InsightsPanelProps {
  campaignId: string;
  /** When false, insights are not fetched (avoids partial simulation snapshots). */
  metricsSettled: boolean;
}

export default function InsightsPanel({ campaignId, metricsSettled }: InsightsPanelProps) {
  const { selectedBrandId } = useBrand();
  const { data, isLoading, isFetching, isError, error } = useQuery<CampaignInsightsResponse>({
    queryKey: ['insights', selectedBrandId, campaignId],
    queryFn: () => api.campaignInsights(campaignId),
    enabled: metricsSettled && Boolean(selectedBrandId),
    staleTime: 60_000,
    retry: (_count, err) => !(err instanceof ApiError && err.status === 404),
  });

  if (isError && error instanceof ApiError && error.status === 404) {
    return null;
  }

  if (!metricsSettled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> AI insights
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            AI-generated insights based on simulated metrics — available once the campaign simulation finishes.
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Waiting for simulated sends and attribution to settle before generating insights…
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || isFetching || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> AI insights
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            AI-generated insights based on simulated metrics.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const a = data.analysis.result;
  const next = data.nextAction.result;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" /> AI insights
          <Badge variant="muted" className="ml-1 font-normal">
            {data.analysis.provider} · {(data.analysis.confidence * 100).toFixed(0)}%
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          AI-generated insights based on simulated metrics — aligned with the KPI cards above.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm leading-relaxed">{a.summary}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-success/20 bg-success/5 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-success">
              <ThumbsUp className="size-3.5" /> What worked
            </p>
            <ul className="space-y-1.5 text-sm">
              {a.whatWorked.map((w, i) => (
                <li key={i} className="text-muted-foreground">• {w}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-warning/20 bg-warning/5 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-warning">
              <ThumbsDown className="size-3.5" /> What to improve
            </p>
            <ul className="space-y-1.5 text-sm">
              {a.whatDidNotWork.map((w, i) => (
                <li key={i} className="text-muted-foreground">• {w}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="primary">Best channel: {CHANNEL_LABELS[a.bestChannel]}</Badge>
          <Badge variant="primary">Best variant: {a.bestVariant}</Badge>
          <Badge variant="muted">Best audience: {a.bestAudience}</Badge>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-4">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Lightbulb className="size-3.5" /> Recommended next campaign
          </p>
          <p className="text-sm font-medium">{next.nextCampaignName}</p>
          <p className="mt-1 text-sm text-muted-foreground">{next.rationale}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="muted">{CHANNEL_LABELS[next.recommendedChannel]}</Badge>
            <Badge variant="muted">{next.recommendedOffer}</Badge>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <ArrowRight className="size-3" /> {next.targetAudience}
            </span>
          </div>
          <Link
            href={buildStudioUrl({ goal: next.goal })}
            className={cn(buttonVariants({ size: 'sm' }), 'mt-4')}
          >
            Create follow-up campaign
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
