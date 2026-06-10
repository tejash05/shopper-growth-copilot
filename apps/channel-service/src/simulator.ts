import { randomUUID } from 'node:crypto';
import { Channel, CommunicationStatus } from '@scp/shared';

export interface SimulatedEvent {
  eventType: CommunicationStatus;
  delayMs: number;
  orderValue?: number;
  failureReason?: string;
}

export interface LifecyclePlan {
  providerMessageId: string;
  events: SimulatedEvent[];
}

/** Channel engagement multipliers applied on top of per-customer bias. */
const CHANNEL_MULTIPLIER: Record<Channel, number> = {
  WHATSAPP: 1.0,
  RCS: 0.92,
  SMS: 0.8,
  EMAIL: 0.7,
};

const rand = () => Math.random();
const jitter = (base: number, spread: number) => base + Math.floor(rand() * spread);

/**
 * Build a realistic communication lifecycle. Each funnel step is conditional on
 * the previous one and weighted by the customer's engagement bias and channel.
 * Returns events with cumulative delays so they fire in order — but the CRM is
 * resilient to out-of-order arrival regardless.
 */
export function planLifecycle(input: {
  channel: Channel;
  engagementBias: number;
  averageOrderValue: number;
}): LifecyclePlan {
  const providerMessageId = `prov_${randomUUID()}`;
  const mult = CHANNEL_MULTIPLIER[input.channel];
  const bias = Math.min(1, Math.max(0, input.engagementBias)) * mult;
  const events: SimulatedEvent[] = [];

  // ~3% of sends hard-fail before delivery.
  if (rand() < 0.03) {
    events.push({
      eventType: CommunicationStatus.FAILED,
      delayMs: jitter(1500, 1500),
      failureReason: rand() < 0.5 ? 'Unreachable handset' : 'Provider rejected message',
    });
    return { providerMessageId, events };
  }

  let t = jitter(600, 1200);
  events.push({ eventType: CommunicationStatus.SENT, delayMs: t });

  // Delivery ~97%.
  if (rand() > 0.97) {
    events.push({
      eventType: CommunicationStatus.FAILED,
      delayMs: t + jitter(1500, 1500),
      failureReason: 'Carrier delivery failure',
    });
    return { providerMessageId, events };
  }
  t += jitter(1800, 2500);
  events.push({ eventType: CommunicationStatus.DELIVERED, delayMs: t });

  const readProb = Math.min(0.95, 0.45 + 0.4 * bias);
  if (rand() < readProb) {
    t += jitter(2500, 4000);
    events.push({ eventType: CommunicationStatus.READ, delayMs: t });

    const clickProb = 0.25 + 0.45 * bias;
    if (rand() < clickProb) {
      t += jitter(3000, 5000);
      events.push({ eventType: CommunicationStatus.CLICKED, delayMs: t });

      const convProb = 0.25 + 0.4 * bias;
      if (rand() < convProb) {
        t += jitter(4000, 6000);
        const factor = 0.8 + rand() * 0.8;
        events.push({
          eventType: CommunicationStatus.ATTRIBUTED_ORDER,
          delayMs: t,
          orderValue: Math.round((input.averageOrderValue || 2000) * factor),
        });
      }
    }
  }

  return { providerMessageId, events };
}
