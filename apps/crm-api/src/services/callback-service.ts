import { Prisma, prisma } from '@scp/db';
import { CommunicationStatus, projectStatus, type ChannelCallbackPayload } from '@scp/shared';
import { buildSignaturePayload, verifySignature } from '@scp/shared/crypto';
import { env } from '../env.js';

export type CallbackOutcome =
  | { status: 'invalid-signature' }
  | { status: 'duplicate' }
  | { status: 'not-found' }
  | { status: 'processed'; communicationStatus: CommunicationStatus };

/** Timestamp column to stamp for each lifecycle event. */
const TIMESTAMP_FIELD: Partial<Record<CommunicationStatus, keyof Prisma.CommunicationUpdateInput>> = {
  SENT: 'sentAt',
  DELIVERED: 'deliveredAt',
  READ: 'readAt',
  CLICKED: 'clickedAt',
  ATTRIBUTED_ORDER: 'attributedAt',
};

/**
 * Process an inbound channel callback. Guarantees:
 *  - HMAC signature verification (rejects forged callbacks)
 *  - exactly-once application via the unique idempotencyKey
 *  - safe handling of out-of-order events (status never regresses)
 *  - append-only event log + materialised Communication.status
 */
export async function processChannelCallback(
  payload: ChannelCallbackPayload,
): Promise<CallbackOutcome> {
  // 1. Verify signature over the canonical field set.
  const signaturePayload = buildSignaturePayload(payload);
  const signatureValid = verifySignature(
    signaturePayload,
    env.CHANNEL_CALLBACK_SECRET,
    payload.signature,
  );

  if (!signatureValid) {
    await safeStoreCallback(payload, false, 'Invalid HMAC signature').catch(() => undefined);
    return { status: 'invalid-signature' };
  }

  // 2. Idempotency guard — unique idempotencyKey. If it already exists, no-op.
  try {
    await prisma.channelCallback.create({
      data: {
        campaignId: payload.campaignId,
        idempotencyKey: payload.idempotencyKey,
        eventType: payload.eventType,
        channel: payload.channel,
        signatureValid: true,
        processed: false,
        rawPayload: payload as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { status: 'duplicate' };
    }
    throw e;
  }

  // 3. Load the target communication.
  const communication = await prisma.communication.findUnique({
    where: { id: payload.messageId },
    include: { events: { select: { eventType: true } } },
  });
  if (!communication) {
    await prisma.channelCallback.update({
      where: { idempotencyKey: payload.idempotencyKey },
      data: { processed: false, errorReason: 'Unknown communication (messageId).' },
    });
    return { status: 'not-found' };
  }

  // 4. Append the event (append-only) and re-project status.
  const eventTime = new Date(payload.timestamp);
  const allEventTypes = [
    ...communication.events.map((e) => e.eventType),
    payload.eventType,
  ] as CommunicationStatus[];
  const nextStatus = projectStatus(allEventTypes);

  const updateData: Prisma.CommunicationUpdateInput = { status: nextStatus };
  const tsField = TIMESTAMP_FIELD[payload.eventType];
  if (tsField) (updateData as Record<string, unknown>)[tsField] = eventTime;
  if (payload.eventType === CommunicationStatus.FAILED) {
    updateData.failureReason = payload.metadata?.failureReason ?? 'Delivery failed';
  }
  if (payload.providerMessageId) updateData.providerMessageId = payload.providerMessageId;

  await prisma.$transaction([
    prisma.communicationEvent.create({
      data: {
        communicationId: communication.id,
        eventType: payload.eventType,
        channel: payload.channel,
        providerMessageId: payload.providerMessageId,
        idempotencyKey: payload.idempotencyKey,
        occurredAt: eventTime,
      },
    }),
    prisma.communication.update({ where: { id: communication.id }, data: updateData }),
    prisma.channelCallback.update({
      where: { idempotencyKey: payload.idempotencyKey },
      data: { processed: true },
    }),
  ]);

  // 5. Attribution — idempotent on communicationId.
  if (payload.eventType === CommunicationStatus.ATTRIBUTED_ORDER) {
    const orderValue = payload.metadata?.orderValue ?? 0;
    await prisma.attributedOrder
      .create({
        data: {
          campaignId: payload.campaignId,
          communicationId: communication.id,
          customerId: communication.customerId,
          orderValue: Math.round(orderValue),
        },
      })
      .catch((e) => {
        // Ignore duplicate attribution (P2002 on unique communicationId).
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
      });
  }

  return { status: 'processed', communicationStatus: nextStatus };
}

async function safeStoreCallback(
  payload: ChannelCallbackPayload,
  signatureValid: boolean,
  errorReason: string,
) {
  await prisma.channelCallback.create({
    data: {
      campaignId: payload.campaignId,
      idempotencyKey: payload.idempotencyKey,
      eventType: payload.eventType,
      channel: payload.channel,
      signatureValid,
      processed: false,
      errorReason,
      rawPayload: payload as unknown as Prisma.InputJsonValue,
    },
  });
}
