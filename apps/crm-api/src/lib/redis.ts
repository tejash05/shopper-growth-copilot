import { Redis } from 'ioredis';
import { env } from '../env.js';

/**
 * Shared ioredis connection for BullMQ. `maxRetriesPerRequest: null` is required
 * by BullMQ for blocking commands.
 */
export const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const SEND_QUEUE_NAME = 'campaign-send';
