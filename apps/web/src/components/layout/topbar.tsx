import Link from 'next/link';
import { ChevronLeft, Sparkles } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function Topbar({
  title,
  subtitle,
  backHref,
  backLabel = 'Back to Campaigns',
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b border-border bg-background/80 px-6 backdrop-blur',
        backHref ? 'py-3' : 'flex h-16 items-center',
      )}
    >
      <div className={cn('flex items-center justify-between gap-4', backHref && 'w-full')}>
        <div className="min-w-0 flex-1">
          {backHref && (
            <Link
              href={backHref}
              className="mb-1 inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
              {backLabel}
            </Link>
          )}
          <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <Link
          href="/campaigns/studio"
          data-tour="new-ai-campaign"
          className={cn(buttonVariants({ size: 'sm' }), 'shrink-0')}
        >
          <Sparkles className="size-4" />
          New AI Campaign
        </Link>
      </div>
    </header>
  );
}
