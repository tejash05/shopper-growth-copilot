'use client';

import { useQuery } from '@tanstack/react-query';
import { Mail, Phone, ShoppingBag, Sparkles } from 'lucide-react';
import { formatInr, formatPercent } from '@scp/shared';
import { api } from '@/lib/api';
import type { CustomerDetail } from '@/lib/types';
import { useBrand } from '@/contexts/brand-context';
import { Sheet } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/misc';
import { ChannelBadge, ChurnBadge, PersonaBadge, StatusBadge, TierBadge } from '@/components/shared/labels';
import { Badge } from '@/components/ui/badge';

export function CustomerDetailDrawer({
  customerId,
  onClose,
}: {
  customerId: string | null;
  onClose: () => void;
}) {
  const { selectedBrandId } = useBrand();
  const { data, isLoading } = useQuery<CustomerDetail>({
    queryKey: ['customer', selectedBrandId, customerId],
    queryFn: () => api.customer(customerId!),
    enabled: !!customerId && !!selectedBrandId,
  });

  const c = data?.customer;

  return (
    <Sheet
      open={!!customerId}
      onClose={onClose}
      title={c ? c.name : 'Shopper profile'}
      description={c ? `${c.city} · ${c.email}` : undefined}
    >
      {isLoading || !data ? (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top badges */}
          <div className="flex flex-wrap items-center gap-2">
            <PersonaBadge persona={c!.persona} />
            <TierBadge tier={c!.loyaltyTier} />
            <ChurnBadge risk={c!.churnRisk} />
            <ChannelBadge channel={c!.preferredChannel as never} />
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Total spend" value={formatInr(c!.totalSpend)} />
            <Metric label="Lifetime value" value={formatInr(c!.lifetimeValue)} />
            <Metric label="Orders" value={String(c!.orderCount)} />
            <Metric label="Avg order value" value={formatInr(c!.averageOrderValue)} />
            <Metric label="Discount sensitivity" value={formatPercent(c!.discountSensitivity, 0)} />
            <Metric label="Favourite category" value={c!.favouriteCategory[0] + c!.favouriteCategory.slice(1).toLowerCase()} />
          </div>

          {/* RFM */}
          <div>
            <SectionTitle icon={Sparkles}>RFM scorecard</SectionTitle>
            <div className="grid grid-cols-4 gap-3">
              <RfmCell label="Recency" value={c!.rfm.recency} />
              <RfmCell label="Frequency" value={c!.rfm.frequency} />
              <RfmCell label="Monetary" value={c!.rfm.monetary} />
              <RfmCell label="Total" value={c!.rfm.total} accent />
            </div>
          </div>

          {/* Consent */}
          <div>
            <SectionTitle>Channel consent</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {Object.entries(c!.consent).map(([k, v]) => (
                <Badge key={k} variant={v ? 'success' : 'muted'}>
                  {k.toUpperCase()}: {v ? 'opted in' : 'opted out'}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          {/* Timeline */}
          <div>
            <SectionTitle>Activity timeline</SectionTitle>
            {data.timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-border pl-5">
                {data.timeline.slice(0, 20).map((t, i) => (
                  <li key={i} className="relative">
                    <span
                      className={`absolute -left-[1.46rem] top-1 size-2.5 rounded-full ring-4 ring-card ${
                        t.type === 'ORDER' ? 'bg-accent' : 'bg-primary'
                      }`}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{t.title}</p>
                        <p className="text-xs text-muted-foreground">{t.detail}</p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(t.at).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Recent orders */}
          <div>
            <SectionTitle icon={ShoppingBag}>Recent orders</SectionTitle>
            {data.orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <div className="space-y-2">
                {data.orders.slice(0, 6).map((o) => (
                  <div key={o.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">{o.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {o.items.map((it) => it.name).slice(0, 2).join(', ')}
                        {o.items.length > 2 ? ` +${o.items.length - 2}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium tabular-nums">{formatInr(o.totalAmount)}</p>
                      <p className="text-xs text-muted-foreground">{new Date(o.placedAt).toLocaleDateString('en-IN')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Campaign comms */}
          {data.communications.length > 0 && (
            <div>
              <SectionTitle>Campaign communications</SectionTitle>
              <div className="space-y-2">
                {data.communications.slice(0, 6).map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2">
                      <ChannelBadge channel={m.channel} />
                      <span className="text-sm">{m.campaignName}</span>
                    </div>
                    <StatusBadge status={m.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4 pt-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Phone className="size-3.5" />{c!.phone}</span>
            <span className="inline-flex items-center gap-1.5"><Mail className="size-3.5" />{c!.email}</span>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function RfmCell({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 text-center ${accent ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function SectionTitle({ children, icon: Icon }: { children: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
      {Icon && <Icon className="size-3.5 text-muted-foreground" />}
      {children}
    </h3>
  );
}
