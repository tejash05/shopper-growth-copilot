import { Queue } from 'bullmq';
import type { Channel, CommunicationStatus } from '@scp/shared';
import { connection, EVENT_QUEUE_NAME } from './redis.js';

export interface CallbackJobData {
  messageId: string;
  campaignId: string;
  customerId: string;
  channel: Channel;
  eventType: CommunicationStatus;
  providerMessageId: string;
  orderValue?: number;
  failureReason?: string;
}

/**
 * Delayed-job queue that fires each simulated lifecycle event back to the CRM.
 * Using BullMQ delays gives us realistic, async, out-of-process callback timing
 * (and automatic retries if the CRM callback endpoint is briefly unavailable).
 */
export const eventQueue = new Queue<CallbackJobData>(EVENT_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 2000,
    removeOnFail: 5000,
  },
});
