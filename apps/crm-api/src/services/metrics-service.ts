import { prisma } from '@scp/db';
import {
  COMMUNICATION_STATUS_RANK,
  Channel,
  CommunicationStatus,
  type CampaignFunnelMetrics,
} from '@scp/shared';

/** Count communications that reached AT LEAST the given funnel stage. */
function reachedAtLeast(
  byStatus: Map<CommunicationStatus, number>,
  stage: CommunicationStatus,
): number {
  let total = 0;
  for (const [status, count] of byStatus) {
    if (status === CommunicationStatus.FAILED) continue;
    if (COMMUNICATION_STATUS_RANK[status] >= COMMUNICATION_STATUS_RANK[stage]) total += count;
  }
  return total;
}

export async function getCampaignMetrics(campaignId: string): Promise<CampaignFunnelMetrics> {
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });

  const [targetedGroups, controlAttributed, revenueAgg, controlCount] = await Promise.all([
    prisma.communication.groupBy({
      by: ['status'],
      where: { campaignId, isControlGroup: false },
      _count: { _all: true },
    }),
    prisma.communication.count({
      where: { campaignId, isControlGroup: true, status: CommunicationStatus.ATTRIBUTED_ORDER },
    }),
    prisma.attributedOrder.aggregate({
      where: { campaignId, communication: { isControlGroup: false } },
      _sum: { orderValue: true },
    }),
    prisma.communication.count({ where: { campaignId, isControlGroup: true } }),
  ]);

  const byStatus = new Map<CommunicationStatus, number>();
  for (const g of targetedGroups) byStatus.set(g.status, g._count._all);

  const targeted = campaign.targetedSize || [...byStatus.values()].reduce((s, n) => s + n, 0);
  const queued = byStatus.get(CommunicationStatus.QUEUED) ?? 0;
  const failed = byStatus.get(CommunicationStatus.FAILED) ?? 0;
  const sent = reachedAtLeast(byStatus, CommunicationStatus.SENT);
  const delivered = reachedAtLeast(byStatus, CommunicationStatus.DELIVERED);
  const read = reachedAtLeast(byStatus, CommunicationStatus.READ);
  const clicked = reachedAtLeast(byStatus, CommunicationStatus.CLICKED);
  const attributedOrders = byStatus.get(CommunicationStatus.ATTRIBUTED_ORDER) ?? 0;

  const conversionRate = targeted > 0 ? attributedOrders / targeted : 0;
  const controlConversionRate = controlCount > 0 ? controlAttributed / controlCount : 0;
  const liftVsControl =
    controlConversionRate > 0 ? (conversionRate - controlConversionRate) / controlConversionRate : 0;

  return {
    audience: campaign.audienceSize,
    controlGroup: campaign.controlGroupSize,
    targeted,
    queued,
    sent,
    delivered,
    read,
    clicked,
    failed,
    attributedOrders,
    attributedRevenue: Math.round(revenueAgg._sum.orderValue ?? 0),
    deliveryRate: sent > 0 ? delivered / sent : 0,
    clickRate: delivered > 0 ? clicked / delivered : 0,
    conversionRate,
    controlConversionRate,
    liftVsControl,
  };
}

interface ChannelStats {
  channel: Channel;
  sent: number;
  clicked: number;
  attributed: number;
  attributedRevenue: number;
}

/** Aggregate funnel stats by actual send channel (shared by channel + variant breakdowns). */
async function aggregateChannelStats(campaignId: string): Promise<Map<Channel, ChannelStats>> {
  const groups = await prisma.communication.groupBy({
    by: ['channel', 'status'],
    where: { campaignId, isControlGroup: false },
    _count: { _all: true },
  });
  const revenue = await prisma.attributedOrder.groupBy({
    by: ['communicationId'],
    where: { campaignId, communication: { isControlGroup: false } },
    _sum: { orderValue: true },
  });
  const attributedComms = await prisma.communication.findMany({
    where: { campaignId, isControlGroup: false, status: CommunicationStatus.ATTRIBUTED_ORDER },
    select: { id: true, channel: true },
  });
  const revByComm = new Map(revenue.map((r) => [r.communicationId, r._sum.orderValue ?? 0]));

  const channels = new Map<Channel, ChannelStats>();
  for (const ch of Object.values(Channel)) {
    channels.set(ch, { channel: ch, sent: 0, clicked: 0, attributed: 0, attributedRevenue: 0 });
  }
  for (const g of groups) {
    const entry = channels.get(g.channel)!;
    if (g.status !== CommunicationStatus.QUEUED && g.status !== CommunicationStatus.FAILED) {
      entry.sent += g._count._all;
    }
    if (COMMUNICATION_STATUS_RANK[g.status] >= COMMUNICATION_STATUS_RANK[CommunicationStatus.CLICKED]) {
      entry.clicked += g._count._all;
    }
    if (g.status === CommunicationStatus.ATTRIBUTED_ORDER) {
      entry.attributed += g._count._all;
    }
  }
  for (const c of attributedComms) {
    channels.get(c.channel)!.attributedRevenue += revByComm.get(c.id) ?? 0;
  }
  return channels;
}

export async function getChannelBreakdown(campaignId: string) {
  const channels = await aggregateChannelStats(campaignId);
  return [...channels.values()]
    .filter((c) => c.sent > 0)
    .map(({ channel, sent, clicked, attributedRevenue }) => ({
      channel,
      sent,
      clicked,
      attributedRevenue,
    }));
}

/**
 * Variant rows use the same actual send-channel stats as channel performance so
 * Variant A (WhatsApp) sent matches WhatsApp channel sent when channels are 1:1.
 */
export async function getVariantBreakdown(campaignId: string) {
  const variants = await prisma.campaignVariant.findMany({ where: { campaignId } });
  const channelStats = await aggregateChannelStats(campaignId);

  return variants.map((v) => {
    const stats = channelStats.get(v.channel as Channel) ?? {
      channel: v.channel as Channel,
      sent: 0,
      clicked: 0,
      attributed: 0,
      attributedRevenue: 0,
    };
    return {
      label: v.label,
      channel: v.channel as Channel,
      sent: stats.sent,
      clicked: stats.clicked,
      attributed: stats.attributed,
      conversionRate: stats.sent > 0 ? stats.attributed / stats.sent : 0,
      clickRate: stats.sent > 0 ? stats.clicked / stats.sent : 0,
    };
  });
}

/** Recent event activity bucketed for the live monitor sparkline. */
export async function getEventTimeline(campaignId: string) {
  const events = await prisma.communicationEvent.findMany({
    where: { communication: { campaignId, isControlGroup: false } },
    orderBy: { occurredAt: 'desc' },
    take: 1500,
    select: { eventType: true, occurredAt: true },
  });
  return events
    .map((e) => ({ eventType: e.eventType, occurredAt: e.occurredAt.toISOString() }))
    .reverse();
}

/** Top converting audience cells (city + persona) for the AI analysis. */
export async function getTopAudience(campaignId: string) {
  const rows = await prisma.$queryRaw<
    { city: string; persona: string; conv: number }[]
  >`
    SELECT c.city, c.persona,
      AVG(CASE WHEN comm.status = 'ATTRIBUTED_ORDER' THEN 1.0 ELSE 0 END) AS conv
    FROM "Communication" comm
    JOIN "Customer" c ON c.id = comm."customerId"
    WHERE comm."campaignId" = ${campaignId} AND comm."isControlGroup" = false
    GROUP BY c.city, c.persona
    HAVING COUNT(*) > 5
    ORDER BY conv DESC
    LIMIT 3
  `;
  return rows.map((r) => ({
    city: r.city,
    persona: r.persona as never,
    conversionRate: Number(r.conv),
  }));
}
