import type { FastifyRequest } from 'fastify';
import { prisma } from '@scp/db';

const NOVAWEAR_NAME = 'NovaWear';

function readBrandHeader(req?: FastifyRequest): string | undefined {
  if (!req) return undefined;
  const raw = req.headers['x-brand-id'];
  if (typeof raw === 'string') return raw.trim() || undefined;
  if (Array.isArray(raw)) return raw[0]?.trim() || undefined;
  return undefined;
}

/**
 * Resolve the active workspace (Brand) for a request.
 * 1. `X-Brand-Id` header when present and valid
 * 2. NovaWear by name (preserves demo default)
 * 3. Oldest brand in the database
 */
export async function resolveBrandId(req?: FastifyRequest): Promise<string> {
  const requestedId = readBrandHeader(req);
  if (requestedId) {
    const brand = await prisma.brand.findUnique({ where: { id: requestedId } });
    if (!brand) {
      throw Object.assign(new Error('Brand not found.'), { statusCode: 404 });
    }
    return brand.id;
  }

  const novawear = await prisma.brand.findFirst({ where: { name: NOVAWEAR_NAME } });
  if (novawear) return novawear.id;

  const oldest = await prisma.brand.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!oldest) {
    throw Object.assign(new Error('No brand found. Run `pnpm db:seed` to generate the demo dataset.'), {
      statusCode: 404,
    });
  }
  return oldest.id;
}
