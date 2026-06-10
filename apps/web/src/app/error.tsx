'use client';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/shared/states';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6">
      <ErrorState
        title="Couldn't load this view"
        description="The CRM API may be unavailable. Ensure the backend services are running (pnpm dev) and the database is seeded."
        action={
          <Button variant="outline" size="sm" onClick={reset}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
