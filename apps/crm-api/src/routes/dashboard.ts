import type { FastifyInstance } from 'fastify';
import { resolveBrandId } from '../lib/brand.js';
import { getDashboard } from '../services/dashboard-service.js';

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/api/dashboard', async (req) => {
    const brandId = await resolveBrandId(req);
    return getDashboard(brandId);
  });
}
