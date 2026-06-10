'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import type { SegmentRule } from '@scp/shared';
import { formatSegmentRuleReadable } from '@/lib/segments';
import { cn } from '@/lib/utils';

export function SegmentRuleDetails({
  rule,
  className,
}: {
  rule: SegmentRule;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const readable = formatSegmentRuleReadable(rule);

  return (
    <div className={cn('space-y-2', className)}>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {readable.map((line) => (
          <li key={line} className="flex items-start gap-2">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/60" />
            {line}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
        {open ? 'Hide rule JSON' : 'View rule JSON'}
      </button>
      {open && (
        <pre className="max-h-48 overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-relaxed text-slate-100 scroll-thin">
          {JSON.stringify(rule, null, 2)}
        </pre>
      )}
    </div>
  );
}
