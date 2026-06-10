import { Queue } from 'bullmq';
import { connection, SEND_QUEUE_NAME } from './redis.js';

export interface SendJobData {
  communicationId: string;
}

/**
 * Outbound send queue. Each job dispatches one communication to the channel
 * service. Retries with exponential backoff; jobs that exhaust attempts remain
 * in BullMQ's failed set (our dead-letter store) and the communication is marked
 * FAILED by the worker.
 */
export const sendQueue = new Queue<SendJobData>(SEND_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1500 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});
