import { prisma } from '@scp/db';
import {
  CampaignStatus,
  ChurnRisk,
  CommunicationStatus,
  DORMANT_THRESHOLD_DAYS,
} from '@scp/shared';

export async function getDashboard(brandId: string) {
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  const dormantCutoff = new Date(Date.now() - DORMANT_THRESHOLD_DAYS * 86_400_000);

  const [
    totalShoppers,
    revenueAgg,
    buyers,
    repeatBuyers,
    atRisk,
    activeCampaigns,
    commCounts,
    revenueAttributed,
    opportunity,
    opportunityRevenue,
  ] = await Promise.all([
    prisma.customer.count({ where: { brandId } }),
    prisma.customer.aggregate({ where: { brandId }, _sum: { totalSpend: true } }),
    prisma.customer.count({ where: { brandId, orderCount: { gte: 1 } } }),
    prisma.customer.count({ where: { brandId, orderCount: { gte: 2 } } }),
    prisma.customer.count({ where: { brandId, churnRisk: ChurnRisk.HIGH } }),
    prisma.campaign.count({
      where: { brandId, status: { in: [CampaignStatus.RUNNING, CampaignStatus.LAUNCHING] } },
    }),
    prisma.communication.groupBy({
      by: ['status'],
      where: { campaign: { brandId }, isControlGroup: false },
      _count: { _all: true },
    }),
    prisma.attributedOrder.aggregate({
      where: { campaign: { brandId } },
      _sum: { orderValue: true },
      _count: { _all: true },
    }),
    prisma.customer.count({
      where: {
        brandId,
        totalSpend: { gte: 10000 },
        churnRisk: { in: [ChurnRisk.HIGH, ChurnRisk.MEDIUM] },
        lastPurchaseAt: { lte: dormantCutoff },
      },
    }),
    prisma.customer.aggregate({
      where: {
        brandId,
        totalSpend: { gte: 10000 },
        churnRisk: { in: [ChurnRisk.HIGH, ChurnRisk.MEDIUM] },
        lastPurchaseAt: { lte: dormantCutoff },
      },
      _avg: { averageOrderValue: true },
    }),
  ]);

  const statusCount = (s: CommunicationStatus) =>
    commCounts.find((c) => c.status === s)?._count._all ?? 0;

  const totalSent =
    statusCount(CommunicationStatus.SENT) +
    statusCount(CommunicationStatus.DELIVERED) +
    statusCount(CommunicationStatus.READ) +
    statusCount(CommunicationStatus.CLICKED) +
    statusCount(CommunicationStatus.ATTRIBUTED_ORDER);
  const delivered =
    statusCount(CommunicationStatus.DELIVERED) +
    statusCount(CommunicationStatus.READ) +
    statusCount(CommunicationStatus.CLICKED) +
    statusCount(CommunicationStatus.ATTRIBUTED_ORDER);
  const clicked =
    statusCount(CommunicationStatus.CLICKED) + statusCount(CommunicationStatus.ATTRIBUTED_ORDER);

  const avgOrder = opportunityRevenue._avg.averageOrderValue ?? 2500;
  const recoverableRevenue = Math.round(opportunity * 0.06 * avgOrder);

  return {
    brandId,
    brandName: brand?.name ?? 'Workspace',
    metrics: {
      totalShoppers,
      totalRevenue: Math.round(revenueAgg._sum.totalSpend ?? 0),
      repeatPurchaseRate: buyers > 0 ? repeatBuyers / buyers : 0,
      atRiskShoppers: atRisk,
      activeCampaigns,
      attributedRevenue: Math.round(revenueAttributed._sum.orderValue ?? 0),
      attributedOrders: revenueAttributed._count._all,
    },
    communicationPerformance: {
      sent: totalSent,
      delivered,
      clicked,
      failed: statusCount(CommunicationStatus.FAILED),
      deliveryRate: totalSent > 0 ? delivered / totalSent : 0,
      clickRate: delivered > 0 ? clicked / delivered : 0,
    },
    opportunity: {
      audienceSize: opportunity,
      recoverableRevenue,
      recommendedAction: 'WhatsApp win-back campaign',
      headline: `${opportunity.toLocaleString('en-IN')} high-value shoppers are at risk of churn.`,
    },
  };
}
