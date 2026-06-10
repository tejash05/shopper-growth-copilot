import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Canonical signing scheme for channel callbacks. Both the channel service
 * (signer) and the CRM API (verifier) import this exact function so the byte
 * layout can never drift.
 *
 * We sign a stable, ordered subset of the payload rather than the whole JSON
 * blob to avoid key-ordering / whitespace ambiguity.
 */
export function buildSignaturePayload(fields: {
  messageId: string;
  campaignId: string;
  customerId: string;
  eventType: string;
  idempotencyKey: string;
  timestamp: string;
}): string {
  return [
    fields.messageId,
    fields.campaignId,
    fields.customerId,
    fields.eventType,
    fields.idempotencyKey,
    fields.timestamp,
  ].join('.');
}

export function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifySignature(payload: string, secret: string, signature: string): boolean {
  const expected = signPayload(payload, secret);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
