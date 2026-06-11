'use client';

import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { useBrand } from '@/contexts/brand-context';
import { ErrorState } from '@/components/shared/states';
import { Button, buttonVariants } from '@/components/ui/button';

export function CampaignWorkspaceNotFound() {
  const { brands, selectedBrand, selectedBrandId, setSelectedBrandId } = useBrand();
  const otherWorkspaces = brands.filter((b) => b.id !== selectedBrandId);

  return (
    <ErrorState
      title="Campaign not found in the selected workspace."
      description="This campaign may belong to another workspace, or it no longer exists."
      action={
        <div className="flex flex-col items-center gap-3">
          <Link href="/campaigns" className={buttonVariants()}>
            Go to Campaigns
          </Link>
          {otherWorkspaces.length > 0 && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-muted-foreground">Switch workspace</p>
              <div className="flex flex-wrap justify-center gap-2">
                {otherWorkspaces.map((brand) => (
                  <Button
                    key={brand.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedBrandId(brand.id)}
                  >
                    <Building2 className="size-4" />
                    {brand.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {selectedBrand && (
            <p className="text-xs text-muted-foreground">
              Currently viewing: {selectedBrand.name}
            </p>
          )}
        </div>
      }
    />
  );
}

export function isCampaignNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
