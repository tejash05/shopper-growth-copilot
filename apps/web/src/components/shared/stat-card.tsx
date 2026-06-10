import * as React from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  hint,
  hintTitle,
  icon: Icon,
  trend,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  hintTitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: { value: string; positive: boolean };
  accent?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <div
            className={cn(
              'flex size-8 items-center justify-center rounded-lg',
              accent ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary',
            )}
          >
            <Icon className="size-4" />
          </div>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
        {trend && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium',
              trend.positive ? 'text-success' : 'text-destructive',
            )}
          >
            {trend.positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {trend.value}
          </span>
        )}
      </div>
      {hint && (
        <p className="mt-1 text-xs text-muted-foreground" title={hintTitle}>
          {hint}
        </p>
      )}
    </Card>
  );
}
