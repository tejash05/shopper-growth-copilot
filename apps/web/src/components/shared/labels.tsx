import {
  CHANNEL_LABELS,
  PERSONA_LABELS,
  type Channel,
  type ChurnRisk,
  type CommunicationStatus,
  type LoyaltyTier,
  type Persona,
} from '@scp/shared';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function ChurnBadge({ risk }: { risk: ChurnRisk }) {
  const variant = risk === 'HIGH' ? 'destructive' : risk === 'MEDIUM' ? 'warning' : 'success';
  return <Badge variant={variant}>{risk[0] + risk.slice(1).toLowerCase()}</Badge>;
}

export function PersonaBadge({ persona }: { persona: Persona }) {
  return (
    <Badge variant="muted" className="font-medium">
      {PERSONA_LABELS[persona]}
    </Badge>
  );
}

const TIER_STYLE: Record<LoyaltyTier, string> = {
  PLATINUM: 'bg-slate-800 text-white',
  GOLD: 'bg-amber-100 text-amber-800',
  SILVER: 'bg-slate-200 text-slate-700',
  BRONZE: 'bg-orange-100 text-orange-800',
};

export function TierBadge({ tier }: { tier: LoyaltyTier }) {
  return (
    <span className={cn('inline-flex rounded-md px-2 py-0.5 text-xs font-medium', TIER_STYLE[tier])}>
      {tier[0] + tier.slice(1).toLowerCase()}
    </span>
  );
}

const CHANNEL_STYLE: Record<Channel, string> = {
  WHATSAPP: 'bg-emerald-100 text-emerald-700',
  SMS: 'bg-sky-100 text-sky-700',
  EMAIL: 'bg-violet-100 text-violet-700',
  RCS: 'bg-indigo-100 text-indigo-700',
};

export function ChannelBadge({ channel }: { channel: Channel }) {
  return (
    <span className={cn('inline-flex rounded-md px-2 py-0.5 text-xs font-medium', CHANNEL_STYLE[channel])}>
      {CHANNEL_LABELS[channel]}
    </span>
  );
}

const STATUS_VARIANT: Record<CommunicationStatus, 'muted' | 'primary' | 'success' | 'warning' | 'destructive'> = {
  QUEUED: 'muted',
  SENT: 'primary',
  DELIVERED: 'primary',
  READ: 'primary',
  CLICKED: 'success',
  ATTRIBUTED_ORDER: 'success',
  FAILED: 'destructive',
};

export function StatusBadge({ status }: { status: CommunicationStatus }) {
  const label = status === 'ATTRIBUTED_ORDER' ? 'Converted' : status[0] + status.slice(1).toLowerCase();
  return <Badge variant={STATUS_VARIANT[status]}>{label}</Badge>;
}
