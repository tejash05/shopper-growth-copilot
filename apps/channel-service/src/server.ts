import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import { Channel } from '@scp/shared';
import { env } from './env.js';
import { eventQueue } from './lib/queue.js';
import { planLifecycle } from './simulator.js';

const simulateSendSchema = z.object({
  messageId: z.string().min(1),
  campaignId: z.string().min(1),
  customerId: z.string().min(1),
  channel: z.nativeEnum(Channel),
  to: z.string().min(1),
  subject: z.string().optional(),
  body: z.string().min(1),
  engagementBias: z.number().min(0).max(1).default(0.5),
  averageOrderValue: z.number().optional(),
});

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'development'
        ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } }
        : true,
  });

  await app.register(cors, { origin: true });

  app.get('/health', async () => ({ status: 'ok', service: 'channel-service', ts: new Date().toISOString() }));

  /**
   * Accept a send request and schedule its simulated lifecycle as delayed jobs.
   * Returns 202 immediately — all delivery/engagement events arrive later via
   * signed callbacks to the CRM.
   */
  app.post('/api/simulate-send', async (req, reply) => {
    const parsed = simulateSendSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'ValidationError', details: parsed.error.flatten() });
    }
    const d = parsed.data;
    const plan = planLifecycle({
      channel: d.channel as Channel,
      engagementBias: d.engagementBias,
      averageOrderValue: d.averageOrderValue ?? 2000,
    });

    await eventQueue.addBulk(
      plan.events.map((e) => ({
        name: 'channel-event',
        data: {
          messageId: d.messageId,
          campaignId: d.campaignId,
          customerId: d.customerId,
          channel: d.channel as Channel,
          eventType: e.eventType,
          providerMessageId: plan.providerMessageId,
          orderValue: e.orderValue,
          failureReason: e.failureReason,
        },
        opts: { delay: e.delayMs },
      })),
    );

    return reply.code(202).send({ status: 'accepted', providerMessageId: plan.providerMessageId, events: plan.events.length });
  });

  return app;
}
