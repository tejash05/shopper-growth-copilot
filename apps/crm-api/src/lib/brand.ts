import { prisma } from '@scp/db';

let cachedBrandId: string | null = null;

/**
 * The demo is single-tenant (NovaWear). We resolve and cache the brand id once
 * so every scoped query can filter by it. In a multi-tenant build this would
 * come from the authenticated session / API key.
 */
export async function getDefaultBrandId(): Promise<string> {
  if (cachedBrandId) return cachedBrandId;
  const brand = await prisma.brand.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!brand) throw new Error('No brand found. Run `pnpm db:seed` to generate the demo dataset.');
  cachedBrandId = brand.id;
  return brand.id;
}
