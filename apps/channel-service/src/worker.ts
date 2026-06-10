import { Worker } from 'bullmq';
import { buildSignaturePayload, signPayload } from '@scp/shared/crypto';
import { connection, EVENT_QUEUE_NAME } from './lib/redis.js';
import { env } from './env.js';
import type { CallbackJobData } from './lib/queue.js';

/**
 * Delivers one simulated lifecycle event to the CRM as a signed, idempotent
 * callback. The idempotency key is deterministic per (message, event) so even if
 * BullMQ retries the job, the CRM applies it exactly once.
 */
export function startCallbackWorker(): Worker<CallbackJobData> {
  return new Worker<CallbackJobData>(
    EVENT_QUEUE_NAME,
    async (job) => {
      const d = job.data;
      const timestamp = new Date().toISOString();
      const idempotencyKey = `${d.messageId}:${d.eventType}`;

      const signature = signPayload(
        buildSignaturePayload({
          messageId: d.messageId,
          campaignId: d.campaignId,
          customerId: d.customerId,
          eventType: d.eventType,
          idempotencyKey,
          timestamp,
        }),
        env.CHANNEL_CALLBACK_SECRET,
      );

      const res = await fetch(`${env.CRM_API_URL}/api/receipts/channel-callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: d.messageId,
          campaignId: d.campaignId,
          customerId: d.customerId,
          eventType: d.eventType,
          timestamp,
          channel: d.channel,
          providerMessageId: d.providerMessageId,
          idempotencyKey,
          signature,
          metadata: { orderValue: d.orderValue, failureReason: d.failureReason },
        }),
      });

      // 4xx (except 5xx) are terminal — don't retry a rejected/duplicate callback.
      if (!res.ok && res.status >= 500) {
        throw new Error(`CRM callback failed ${res.status}`);
      }
    },
    { connection, concurrency: 30 },
  );
}
