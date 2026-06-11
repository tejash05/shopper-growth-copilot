'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api, type BrandSummary } from '@/lib/api';
import {
  NOVAWEAR_BRAND_NAME,
  persistBrandId,
  readStoredBrandId,
  clearBrandId,
} from '@/lib/brand-storage';

interface BrandContextValue {
  brands: BrandSummary[];
  selectedBrand: BrandSummary | null;
  selectedBrandId: string | null;
  isLoading: boolean;
  setSelectedBrandId: (id: string) => void;
  refreshBrands: () => Promise<BrandSummary[]>;
  createBrand: (input: { name: string; industry: string }) => Promise<BrandSummary>;
  deleteBrand: (brandId: string) => Promise<void>;
}

const BrandContext = React.createContext<BrandContextValue | null>(null);

function pickDefaultBrandId(brands: BrandSummary[], storedId: string | null): string | null {
  if (storedId && brands.some((b) => b.id === storedId)) return storedId;
  const novawear = brands.find((b) => b.name === NOVAWEAR_BRAND_NAME);
  if (novawear) return novawear.id;
  return brands[0]?.id ?? null;
}

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [brands, setBrands] = React.useState<BrandSummary[]>([]);
  const [selectedBrandId, setSelectedBrandIdState] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const refreshBrands = React.useCallback(async () => {
    const list = await api.brands();
    setBrands(list);
    return list;
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.brands();
        if (cancelled) return;
        setBrands(list);
        const stored = readStoredBrandId();
        const defaultId = pickDefaultBrandId(list, stored);
        if (defaultId) {
          setSelectedBrandIdState(defaultId);
          persistBrandId(defaultId);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setSelectedBrandId = React.useCallback(
    (id: string) => {
      setSelectedBrandIdState(id);
      persistBrandId(id);
      queryClient.invalidateQueries();
      router.refresh();
    },
    [queryClient, router],
  );

  const createBrand = React.useCallback(
    async (input: { name: string; industry: string }) => {
      const brand = await api.createBrand(input);
      await refreshBrands();
      setSelectedBrandId(brand.id);
      return brand;
    },
    [refreshBrands, setSelectedBrandId],
  );

  const deleteBrand = React.useCallback(
    async (brandId: string) => {
      await api.deleteBrand(brandId);
      const list = await refreshBrands();
      const nextId = pickDefaultBrandId(list, null);
      if (nextId) {
        setSelectedBrandIdState(nextId);
        persistBrandId(nextId);
      } else {
        setSelectedBrandIdState(null);
        clearBrandId();
      }
      queryClient.invalidateQueries();
      router.push('/');
      router.refresh();
    },
    [refreshBrands, queryClient, router],
  );

  const selectedBrand = brands.find((b) => b.id === selectedBrandId) ?? null;

  const value = React.useMemo(
    () => ({
      brands,
      selectedBrand,
      selectedBrandId,
      isLoading,
      setSelectedBrandId,
      refreshBrands,
      createBrand,
      deleteBrand,
    }),
    [brands, selectedBrand, selectedBrandId, isLoading, setSelectedBrandId, refreshBrands, createBrand, deleteBrand],
  );

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand() {
  const ctx = React.useContext(BrandContext);
  if (!ctx) throw new Error('useBrand must be used within BrandProvider');
  return ctx;
}
