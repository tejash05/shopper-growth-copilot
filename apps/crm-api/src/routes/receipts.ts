import type { FastifyInstance } from 'fastify';
import { channelCallbackSchema } from '@scp/shared';
import { parseOr400 } from '../lib/validate.js';
import { processChannelCallback } from '../services/callback-service.js';

export async function receiptRoutes(app: FastifyInstance) {
  /**
   * Inbound channel lifecycle callbacks. Secured by HMAC signature, idempotent
   * via idempotencyKey, and tolerant of out-of-order delivery.
   */
  app.post('/api/receipts/channel-callback', async (req, reply) => {
    const payload = parseOr400(channelCallbackSchema, req.body, reply);
    if (!payload) return;

    const outcome = await processChannelCallback(payload);
    switch (outcome.status) {
      case 'invalid-signature':
        return reply.code(401).send({ error: 'InvalidSignature', message: 'HMAC verification failed.' });
      case 'duplicate':
        return reply.code(200).send({ status: 'duplicate' });
      case 'not-found':
        return reply.code(404).send({ error: 'NotFound', message: 'Communication not found.' });
      case 'processed':
        return reply.code(200).send({ status: 'processed', communicationStatus: outcome.communicationStatus });
    }
  });
}
