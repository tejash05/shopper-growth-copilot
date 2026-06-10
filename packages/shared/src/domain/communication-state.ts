import {
  COMMUNICATION_STATUS_RANK,
  CommunicationStatus,
} from '../constants/enums.js';

/**
 * Project the materialised communication status from an append-only event log.
 *
 * Rules:
 *  - FAILED is terminal-ish and only overridden by an actual delivery success.
 *  - Otherwise the status is the furthest-along event ever seen, so out-of-order
 *    callbacks (e.g. READ arriving before DELIVERED) never regress the funnel.
 */
export function projectStatus(
  eventTypes: CommunicationStatus[],
): CommunicationStatus {
  if (eventTypes.length === 0) return CommunicationStatus.QUEUED;

  const hasSuccess = eventTypes.some(
    (e) => e !== CommunicationStatus.FAILED && e !== CommunicationStatus.QUEUED,
  );

  // If we only ever saw FAILED (no later success), it's failed.
  if (!hasSuccess && eventTypes.includes(CommunicationStatus.FAILED)) {
    return CommunicationStatus.FAILED;
  }

  return eventTypes.reduce<CommunicationStatus>((furthest, current) => {
    if (current === CommunicationStatus.FAILED) return furthest;
    return COMMUNICATION_STATUS_RANK[current] > COMMUNICATION_STATUS_RANK[furthest]
      ? current
      : furthest;
  }, CommunicationStatus.QUEUED);
}

/** Does applying `incoming` move the communication forward from `current`? */
export function isForwardTransition(
  current: CommunicationStatus,
  incoming: CommunicationStatus,
): boolean {
  if (incoming === CommunicationStatus.FAILED) {
    return current === CommunicationStatus.QUEUED || current === CommunicationStatus.SENT;
  }
  return COMMUNICATION_STATUS_RANK[incoming] > COMMUNICATION_STATUS_RANK[current];
}
