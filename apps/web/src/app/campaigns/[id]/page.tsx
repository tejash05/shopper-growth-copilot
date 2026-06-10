import { notFound } from 'next/navigation';
import { CHANNEL_LABELS } from '@scp/shared';
import { api, ApiError } from '@/lib/api';
import { Topbar } from '@/components/layout/topbar';
import { Badge } from '@/components/ui/badge';
import { CampaignMonitor } from '@/components/campaigns/campaign-monitor';

export const dynamic = 'force-dynamic';

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let campaign;
  try {
    campaign = await api.campaign(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <>
      <Topbar
        title={campaign.name}
        subtitle={campaign.goal ?? `${CHANNEL_LABELS[campaign.primaryChannel]} campaign`}
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
