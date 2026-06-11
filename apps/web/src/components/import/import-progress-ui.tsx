'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { ProgressBar } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

export interface ImportProgressState {
  percent: number;
  label: string;
}

export function ImportProgressBar({ progress }: { progress: ImportProgressState }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-foreground">{progress.label}</span>
        <span className="tabular-nums text-muted-foreground">{progress.percent}%</span>
      </div>
      <ProgressBar value={progress.percent / 100} barClassName="bg-primary transition-all duration-500" />
    </div>
  );
}

export function ImportProgressCard({
  progress,
  workspaceName,
  slowMessage,
  counts,
}: {
  progress: ImportProgressState;
  workspaceName: string;
  slowMessage?: string | null;
  counts?: {
    customersImported?: number;
    ordersImported?: number;
    rowsSkipped?: number;
  };
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Loader2 className="size-5 animate-spin" />
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Import in progress</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Writing data into <span className="font-medium text-foreground">{workspaceName}</span>
            </p>
          </div>

          <ImportProgressBar progress={progress} />

          {counts && (counts.customersImported !== undefined || counts.ordersImported !== undefined) && (
            <div className="grid gap-2 sm:grid-cols-3">
              {counts.customersImported !== undefined && (
                <MetricPill label="Shoppers" value={counts.customersImported} />
              )}
              {counts.ordersImported !== undefined && (
                <MetricPill label="Orders" value={counts.ordersImported} />
              )}
              {counts.rowsSkipped !== undefined && counts.rowsSkipped > 0 && (
                <MetricPill label="Skipped" value={counts.rowsSkipped} />
              )}
            </div>
          )}

          {slowMessage && <p className="text-sm text-muted-foreground">{slowMessage}</p>}

          <p className="text-xs text-muted-foreground">Please keep this tab open while the import finishes.</p>
        </div>
      </div>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{value.toLocaleString('en-IN')}</p>
    </div>
  );
}

export function ImportStepIndicator({
  steps,
  currentIndex,
}: {
  steps: { id: string; label: string }[];
  currentIndex: number;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-5">
      {steps.map((item, idx) => {
        const active = idx === currentIndex;
        const complete = idx < currentIndex;
        return (
          <div
            key={item.id}
            className={cn(
              'rounded-lg border px-3 py-2 text-center transition-colors',
              active && 'border-primary bg-primary/5 text-primary',
              complete && 'border-border bg-muted/40 text-foreground',
              !active && !complete && 'border-border bg-background text-muted-foreground',
            )}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide">{idx + 1}</p>
            <p className="mt-0.5 text-xs font-medium">{item.label}</p>
          </div>
        );
      })}
    </div>
  );
}

export function TemplateDownloadCard({
  title,
  description,
  icon: Icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all',
        'hover:border-primary/30 hover:bg-muted/30 hover:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
      )}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}
