'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrandProvider } from '@/contexts/brand-context';
import { OnboardingProvider } from '@/contexts/onboarding-context';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <BrandProvider>
        <OnboardingProvider>{children}</OnboardingProvider>
      </BrandProvider>
    </QueryClientProvider>
  );
}
