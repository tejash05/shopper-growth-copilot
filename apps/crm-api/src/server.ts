import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { env } from './env.js';
import { customerRoutes } from './routes/customers.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { segmentRoutes } from './routes/segments.js';
import { campaignRoutes } from './routes/campaigns.js';
import { aiRoutes } from './routes/ai.js';
import { receiptRoutes } from './routes/receipts.js';

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'development'
        ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } }
        : true,
  });

  const corsOrigin = env.CORS_ORIGIN
    ? env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
    : true;
  await app.register(cors, { origin: corsOrigin });

  // Centralised error handler → consistent structured error envelope.
  app.setErrorHandler((error, _req, reply) => {
    const err = error as Error & { statusCode?: number };
    const statusCode = err.statusCode ?? 500;
    if (statusCode >= 500) app.log.error(err);
    reply.code(statusCode).send({
      error: err.name ?? 'InternalError',
      message: err.message,
    });
  });

  app.get('/health', async () => ({ status: 'ok', service: 'crm-api', ts: new Date().toISOString() }));

  await app.register(dashboardRoutes);
  await app.register(customerRoutes);
  await app.register(segmentRoutes);
  await app.register(campaignRoutes);
  await app.register(aiRoutes);
  await app.register(receiptRoutes);

  return app;
}
