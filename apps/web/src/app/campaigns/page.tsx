import Link from 'next/link';
import { Megaphone, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { Topbar } from '@/components/layout/topbar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChannelBadge } from '@/components/shared/labels';
import { EmptyState } from '@/components/shared/states';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Campaigns · Shopper Growth Copilot' };

const STATUS_VARIANT: Record<string, 'muted' | 'primary' | 'success' | 'warning' | 'destructive'> = {
  DRAFT: 'muted',
  SCHEDULED: 'warning',
  LAUNCHING: 'primary',
  RUNNING: 'primary',
  COMPLETED: 'success',
  FAILED: 'destructive',
};

export default async function CampaignsPage() {
  const campaigns = await api.campaigns();

  return (
    <>
      <Topbar title="Campaigns" subtitle="Track every campaign from launch to attributed revenue" />
      <div className="p-6">
        {campaigns.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No campaigns yet"
            description="Use the AI Campaign Studio to design and launch your first personalised win-back."
            action={
              <Link href="/campaigns/studio" className={cn(buttonVariants({ size: 'sm' }))}>
                <Sparkles className="size-4" />
                Open Campaign Studio
              </Link>
            }
          />
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Channels</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Targeted</TableHead>
                  <TableHead>Control</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/campaigns/${c.id}`} className="font-medium text-foreground hover:text-primary">
                        {c.name}
                      </Link>
                      {c.goal && <p className="max-w-md truncate text-xs text-muted-foreground">{c.goal}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[c.status] ?? 'muted'}>{c.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {c.variants.map((v) => (
                          <ChannelBadge key={v.id} channel={v.channel} />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">{c.audienceSize.toLocaleString('en-IN')}</TableCell>
                    <TableCell className="tabular-nums">{c.targetedSize.toLocaleString('en-IN')}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {c.controlGroupSize.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString('en-IN')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </>
  );
}
