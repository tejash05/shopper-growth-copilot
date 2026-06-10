import { z } from 'zod';
import { Channel, CommunicationStatus } from '../constants/enums.js';

/**
 * Channel → CRM callback payload. The `signature` is an HMAC over a canonical
 * subset of these fields (see domain/hmac.ts). `idempotencyKey` guarantees
 * exactly-once application even under provider retries.
 */
export const channelCallbackSchema = z.object({
  messageId: z.string().min(1),
  campaignId: z.string().min(1),
  customerId: z.string().min(1),
  eventType: z.nativeEnum(CommunicationStatus),
  timestamp: z.string().datetime(),
  channel: z.nativeEnum(Channel),
  providerMessageId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  signature: z.string().min(1),
  /** Optional context for ATTRIBUTED_ORDER / FAILED events. */
  metadata: z
    .object({
      orderValue: z.number().optional(),
      failureReason: z.string().optional(),
    })
    .optional(),
});
export type ChannelCallbackPayload = z.infer<typeof channelCallbackSchema>;

/** Request the channel service receives from the CRM API to simulate a send. */
export const channelSendRequestSchema = z.object({
  messageId: z.string().min(1),
  campaignId: z.string().min(1),
  customerId: z.string().min(1),
  channel: z.nativeEnum(Channel),
  to: z.string().min(1),
  subject: z.string().optional(),
  body: z.string().min(1),
  /** Persona-derived intent so the simulator can bias outcomes realistically. */
  engagementBias: z.number().min(0).max(1).default(0.5),
});
export type ChannelSendRequest = z.infer<typeof channelSendRequestSchema>;
