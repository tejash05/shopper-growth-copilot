import { generateBrandDemoData, type GenerateBrandDemoResult } from '@scp/db';
import { resolveBrandId } from '../lib/brand.js';
import type { FastifyRequest } from 'fastify';

export async function generateDemoDataForBrand(
  req: FastifyRequest,
  brandId: string,
): Promise<GenerateBrandDemoResult> {
  const activeBrandId = await resolveBrandId(req);
  if (activeBrandId !== brandId) {
    throw Object.assign(new Error('Workspace context does not match the requested brand.'), {
      statusCode: 403,
    });
  }
  return generateBrandDemoData(brandId);
}
