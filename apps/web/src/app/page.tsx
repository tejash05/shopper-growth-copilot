import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  IndianRupee,
  Megaphone,
  Repeat,
  Sparkles,
  TrendingDown,
  Users,
} from 'lucide-react';
import { formatInr, formatInrCompact, formatPercent } from '@scp/shared';
import { api } from '@/lib/api';
import { ATTRIBUTION_ORDERS_LABEL, ATTRIBUTION_REVENUE_LABEL, ATTRIBUTION_TOOLTIP } from '@/lib/attribution-copy';
import { buildStudioUrl, DEFAULT_WINBACK_GOAL } from '@/lib/studio-navigation';
import { Topbar } from '@/components/layout/topbar';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProgressBar } from '@/components/ui/misc';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const data = await api.dashboard();
  const { metrics, communicationPerformance: comm, opportunity } = data;

  const funnel = [
    { label: 'Sent', value: comm.sent },
    { label: 'Delivered', value: comm.delivered },
    { label: 'Clicked', value: comm.clicked },
  ];
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.value));

  return (
    <>
      <Topbar title="Command Center" subtitle="Real-time view of NovaWear's shopper base and growth engine" />
      <div className="space-y-6 p-6">
        {/* AI opportunity card */}
        <Card className="overflow-hidden border-primary/20">
          <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="size-5" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Badge variant="primary">AI Opportunity</Badge>
                  <span className="text-xs text-muted-foreground">Updated just now</span>
                </div>
                <p className="max-w-2xl text-[15px] font-medium leading-relaxed text-foreground">
                  {opportunity.headline} Estimated recoverable revenue:{' '}
                  <span className="text-primary">{formatInrCompact(opportunity.recoverableRevenue)}</span>.
                  Recommended action: <span className="font-semibold">{opportunity.recommendedAction}</span>.
                </p>
              </div>
            </div>
            <Link
              href={buildStudioUrl({ goal: DEFAULT_WINBACK_GOAL })}
              className={cn(buttonVariants(), 'shrink-0 self-start md:self-center')}
            >
              Launch win-back
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </Card>

        {/* KPI grid */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Total shoppers" value={metrics.totalShoppers.toLocaleString('en-IN')} icon={Users} hint="Across all cities" />
          <StatCard label="Total revenue" value={formatInrCompact(metrics.totalRevenue)} icon={IndianRupee} hint="Lifetime realised spend" />
          <StatCard
            label="Repeat purchase rate"
            value={formatPercent(metrics.repeatPurchaseRate)}
            icon={Repeat}
            hint="Buyers with 2+ orders"
          />
          <StatCard label="At-risk shoppers" value={metrics.atRiskShoppers.toLocaleString('en-IN')} icon={TrendingDown} hint="High churn risk" />
          <StatCard label="Active campaigns" value={metrics.activeCampaigns} icon={Megaphone} hint="Running or launching" />
          <StatCard
            label={ATTRIBUTION_REVENUE_LABEL}
            value={formatInrCompact(metrics.attributedRevenue)}
            icon={Activity}
            accent
            hint={`${metrics.attributedOrders.toLocaleString('en-IN')} simulated attributed orders`}
            hintTitle={ATTRIBUTION_TOOLTIP}
          />
        </div>

        {/* Communication performance */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Communication performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {funnel.map((f) => (
                <div key={f.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{f.label}</span>
                    <span className="font-medium tabular-nums">{f.value.toLocaleString('en-IN')}</span>
                  </div>
                  <ProgressBar value={f.value / maxFunnel} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground">Delivery rate</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">{formatPercent(comm.deliveryRate)}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground">Click rate</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">{formatPercent(comm.clickRate)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Win-back opportunity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Dormant high-value shoppers</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {opportunity.audienceSize.toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Estimated recoverable revenue</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-accent">
                  {formatInr(opportunity.recoverableRevenue)}
                </p>
              </div>
              <Link
                href={buildStudioUrl({ goal: DEFAULT_WINBACK_GOAL })}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full')}
              >
                Open Campaign Studio
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
