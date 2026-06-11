'use client';

import { Compass } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useOnboardingTour } from '@/contexts/onboarding-context';
import { Button } from '@/components/ui/button';

export function ReplayTourButton() {
  const pathname = usePathname();
  const { startTour } = useOnboardingTour();

  if (pathname !== '/') return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="mt-2 w-full justify-start text-xs text-muted-foreground"
      onClick={startTour}
    >
      <Compass className="size-3.5" />
      Replay tour
    </Button>
  );
}
