'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import '@/components/onboarding/onboarding-tour.css';
import { useBrand } from '@/contexts/brand-context';
import { buildAvailableTourSteps } from '@/lib/onboarding/steps';
import { isOnboardingCompleted, markOnboardingCompleted } from '@/lib/onboarding/constants';

interface OnboardingContextValue {
  startTour: () => void;
}

const OnboardingContext = React.createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoading } = useBrand();
  const driverRef = React.useRef<Driver | null>(null);
  const completedThisRunRef = React.useRef(false);
  const autoStartedRef = React.useRef(false);

  const destroyTour = React.useCallback(() => {
    driverRef.current?.destroy();
    driverRef.current = null;
  }, []);

  const startTour = React.useCallback(() => {
    if (typeof window === 'undefined') return;

    const steps = buildAvailableTourSteps();
    if (steps.length === 0) return;

    destroyTour();
    completedThisRunRef.current = false;

    const driverObj = driver({
      animate: true,
      smoothScroll: true,
      allowClose: true,
      overlayOpacity: 0.62,
      stagePadding: 10,
      stageRadius: 12,
      showProgress: true,
      progressText: '{{current}} of {{total}}',
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Finish',
      popoverClass: 'scp-driver-popover',
      steps,
      onNextClick: (_element, _step, { driver: activeDriver }) => {
        if (activeDriver.isLastStep()) {
          completedThisRunRef.current = true;
          markOnboardingCompleted();
        }
        activeDriver.moveNext();
      },
      onDestroyed: () => {
        driverRef.current = null;
        if (completedThisRunRef.current) return;
      },
      onPopoverRender: (popover, { driver: activeDriver }) => {
        const footer = popover.footerButtons;
        if (!footer || footer.querySelector('.driver-popover-skip-btn')) return;

        const skipButton = document.createElement('button');
        skipButton.type = 'button';
        skipButton.className = 'driver-popover-skip-btn';
        skipButton.textContent = 'Skip';
        skipButton.addEventListener('click', () => {
          completedThisRunRef.current = true;
          markOnboardingCompleted();
          activeDriver.destroy();
        });
        footer.prepend(skipButton);
      },
    });

    driverRef.current = driverObj;
    driverObj.drive();
  }, [destroyTour]);

  React.useEffect(() => {
    if (pathname !== '/' || isLoading) return;
    if (isOnboardingCompleted()) return;
    if (autoStartedRef.current) return;

    autoStartedRef.current = true;
    const timer = window.setTimeout(() => startTour(), 900);
    return () => window.clearTimeout(timer);
  }, [pathname, isLoading, startTour]);

  React.useEffect(() => () => destroyTour(), [destroyTour]);

  const value = React.useMemo(() => ({ startTour }), [startTour]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboardingTour() {
  const ctx = React.useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboardingTour must be used within OnboardingProvider');
  return ctx;
}
