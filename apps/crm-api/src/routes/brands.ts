import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseOr400 } from '../lib/validate.js';
import { createBrand, deleteBrand, listBrands } from '../services/brand-service.js';
import { generateDemoDataForBrand } from '../services/demo-data-service.js';

const createBrandSchema = z.object({
  name: z.string().min(1).max(120),
  industry: z.string().min(1).max(120),
});

export async function brandRoutes(app: FastifyInstance) {
  app.get('/api/brands', async () => listBrands());

  app.post('/api/brands', async (req, reply) => {
    const input = parseOr400(createBrandSchema, req.body, reply);
    if (!input) return;
    const brand = await createBrand(input);
    return reply.code(201).send(brand);
  });

  app.post<{ Params: { brandId: string } }>('/api/brands/:brandId/demo-data', async (req, reply) => {
    const result = await generateDemoDataForBrand(req, req.params.brandId);
    return reply.code(201).send(result);
  });

  app.delete<{ Params: { brandId: string } }>('/api/brands/:brandId', async (req, reply) => {
    const result = await deleteBrand(req.params.brandId);
    return reply.send({ ok: true, ...result });
  });
}
