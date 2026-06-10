import { Bookmark, Sparkles } from 'lucide-react';
import type { SegmentRule } from '@scp/shared';
import { formatSegmentRuleReadable } from '@/lib/segments';
import type { CampaignDetail } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CampaignAudienceCardProps {
  campaign: CampaignDetail;
}

export function CampaignAudienceCard({ campaign }: CampaignAudienceCardProps) {
  const rule = (campaign.segmentRuleSnapshot ?? {}) as SegmentRule;
  const readable = formatSegmentRuleReadable(rule);
  const isSaved = Boolean(campaign.segmentId);
  const segmentMissing = isSaved && !campaign.segment;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Campaign audience</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isSaved ? 'primary' : 'muted'} className="gap-1">
            {isSaved ? <Bookmark className="size-3" /> : <Sparkles className="size-3" />}
            {isSaved ? 'Saved segment' : 'AI-generated inline segment'}
          </Badge>
          <Badge variant="muted">Control group: {(campaign.controlGroupRatio * 100).toFixed(0)}%</Badge>
        </div>

        {isSaved && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Segment name</p>
            {campaign.segment ? (
              <p className="mt-0.5 text-sm font-medium">{campaign.segment.name}</p>
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">
                Linked segment unavailable — it may have been removed. Using the rule snapshot from launch.
              </p>
            )}
          </div>
        )}

        {segmentMissing && campaign.segmentId && (
          <p className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-muted-foreground">
            Segment ID <code className="text-[11px]">{campaign.segmentId}</code> no longer resolves in the
            database.
          </p>
        )}

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Audience rule summary</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {readable.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/60" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
