import { Worker } from 'bullmq';
import { prisma } from '@scp/db';
import { Channel, CommunicationStatus, Persona } from '@scp/shared';
import { connection, SEND_QUEUE_NAME } from '../lib/redis.js';
import { env } from '../env.js';
import type { SendJobData } from '../lib/queue.js';

/** Persona → engagement bias the channel simulator uses to weight outcomes. */
const PERSONA_BIAS: Record<Persona, number> = {
  VIP_FASHION_LOYALIST: 0.85,
  BEAUTY_REPEAT_BUYER: 0.72,
  AT_RISK_LOYALIST: 0.6,
  DORMANT_HIGH_SPENDER: 0.55,
  DISCOUNT_LED_BUYER: 0.5,
  NEW_CUSTOMER: 0.45,
  WINDOW_SHOPPER: 0.3,
};

/**
 * Dispatches one communication to the channel service. The channel service then
 * drives the lifecycle (SENT→…→ATTRIBUTED_ORDER) asynchronously via signed
 * callbacks. Failures here are retried by BullMQ; exhausted jobs mark the
 * communication FAILED (dead-letter-style tracking).
 */
export function startSendWorker(): Worker<SendJobData> {
  const worker = new Worker<SendJobData>(
    SEND_QUEUE_NAME,
    async (job) => {
      const comm = await prisma.communication.findUnique({
        where: { id: job.data.communicationId },
        include: { customer: { select: { persona: true, averageOrderValue: true } } },
      });
      if (!comm) return; // communication deleted; nothing to do.

      const bias = PERSONA_BIAS[comm.customer.persona as Persona] ?? 0.5;

      const res = await fetch(`${env.CHANNEL_SERVICE_URL}/api/simulate-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: comm.id,
          campaignId: comm.campaignId,
          customerId: comm.customerId,
          channel: comm.channel,
          to: comm.recipient,
          subject: comm.renderedSubject ?? undefined,
          body: comm.renderedBody,
          engagementBias: bias,
          averageOrderValue: comm.customer.averageOrderValue,
        }),
      });
      if (!res.ok) {
        throw new Error(`Channel service responded ${res.status}`);
      }
    },
    { connection, concurrency: 20 },
  );

  worker.on('failed', async (job, err) => {
    if (!job) return;
    // Final attempt exhausted → mark FAILED + append event (dead-letter handling).
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      const comm = await prisma.communication.findUnique({ where: { id: job.data.communicationId } });
      if (comm && comm.status === CommunicationStatus.QUEUED) {
        await prisma.$transaction([
          prisma.communication.update({
            where: { id: comm.id },
            data: { status: CommunicationStatus.FAILED, failureReason: err.message.slice(0, 200) },
          }),
          prisma.communicationEvent.create({
            data: {
              communicationId: comm.id,
              eventType: CommunicationStatus.FAILED,
              channel: comm.channel as Channel,
              occurredAt: new Date(),
            },
          }),
        ]);
      }
    }
  });

  return worker;
}
