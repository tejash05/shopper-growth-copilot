import type { FastifyInstance } from 'fastify';
import { customerListQuerySchema } from '@scp/shared';
import { resolveBrandId } from '../lib/brand.js';
import { parseOr400 } from '../lib/validate.js';
import { getCustomerDetail, listCustomers } from '../services/customer-service.js';

export async function customerRoutes(app: FastifyInstance) {
  app.get('/api/customers', async (req, reply) => {
    const q = parseOr400(customerListQuerySchema, req.query, reply);
    if (!q) return;
    const brandId = await resolveBrandId(req);
    return listCustomers(brandId, q);
  });

  app.get<{ Params: { id: string } }>('/api/customers/:id', async (req, reply) => {
    const brandId = await resolveBrandId(req);
    const detail = await getCustomerDetail(brandId, req.params.id);
    if (!detail) return reply.code(404).send({ error: 'NotFound', message: 'Customer not found.' });
    return detail;
  });
}
