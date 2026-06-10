import type { FastifyInstance } from 'fastify';
import { getDashboard } from '../services/dashboard-service.js';

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/api/dashboard', async () => getDashboard());
}
