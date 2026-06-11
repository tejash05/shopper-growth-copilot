'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CHANNEL_LABELS } from '@scp/shared';
import { api, ApiError } from '@/lib/api';
import { Topbar } from '@/components/layout/topbar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared/states';
import { buttonVariants } from '@/components/ui/button';
import { CampaignMonitor } from '@/components/campaigns/campaign-monitor';
import {
  CampaignWorkspaceNotFound,
  isCampaignNotFoundError,
} from '@/components/campaigns/campaign-workspace-not-found';
import { useBrand } from '@/contexts/brand-context';

const CAMPAIGN_BACK_HREF = '/campaigns';

function CampaignDetailSkeleton() {
  return (
    <>
      <Topbar
        title="Loading campaign…"
        subtitle="Fetching campaign for this workspace"
        backHref={CAMPAIGN_BACK_HREF}
      />
      <div className="space-y-6 p-6">
        <Skeleton className="h-6 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    </>
  );
}

export function CampaignDetailView({ campaignId }: { campaignId: string }) {
  const { selectedBrandId } = useBrand();

  const {
    data: campaign,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['campaign', selectedBrandId, campaignId],
    queryFn: () => api.campaign(campaignId),
    enabled: Boolean(selectedBrandId),
    retry: (_count, err) => !(err instanceof ApiError && err.status === 404),
  });

  if (!selectedBrandId || isLoading) {
    return <CampaignDetailSkeleton />;
  }

  if (isError && isCampaignNotFoundError(error)) {
    return (
      <>
        <Topbar
          title="Campaign"
          subtitle="Not available in this workspace"
          backHref={CAMPAIGN_BACK_HREF}
        />
        <div className="p-6">
          <CampaignWorkspaceNotFound />
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <Topbar
          title="Campaign"
          subtitle="Could not load campaign"
          backHref={CAMPAIGN_BACK_HREF}
        />
        <div className="p-6">
          <ErrorState
            title="Could not load campaign"
            description={error instanceof Error ? error.message : 'Something went wrong.'}
            action={
              <Link href="/campaigns" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Go to Campaigns
              </Link>
            }
          />
        </div>
      </>
    );
  }

  if (!campaign) {
    return <CampaignDetailSkeleton />;
  }

  return (
    <>
      <Topbar
        title={campaign.name}
        subtitle={campaign.goal ?? `${CHANNEL_LABELS[campaign.primaryChannel]} campaign`}
        backHref={CAMPAIGN_BACK_HREF}
      />
      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="primary">{campaign.status}</Badge>
          {campaign.offerCode && <Badge variant="muted">Offer: {campaign.offerCode}</Badge>}
          {campaign.launchedAt && (
            <span className="text-xs text-muted-foreground">
              Launched {new Date(campaign.launchedAt).toLocaleString('en-IN')}
            </span>
          )}
        </div>
        <CampaignMonitor campaign={campaign} />
      </div>
    </>
  );
}
