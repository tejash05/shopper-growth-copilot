import { prisma, type Prisma } from '@scp/db';
import {
  segmentRuleToPrismaWhere,
  type CreateSegmentInput,
  type ProductCategory,
  type SegmentPreviewResult,
  type SegmentRule,
} from '@scp/shared';

function brandScopedWhere(brandId: string, rule: SegmentRule): Prisma.CustomerWhereInput {
  return { brandId, ...(segmentRuleToPrismaWhere(rule) as Prisma.CustomerWhereInput) };
}

export async function previewSegment(
  brandId: string,
  rule: SegmentRule,
  sampleSize: number,
): Promise<SegmentPreviewResult> {
  const where = brandScopedWhere(brandId, rule);

  const [audienceSize, agg, categoryGroups, channelGroups, sample] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.aggregate({
      where,
      _sum: { totalSpend: true },
      _avg: { averageOrderValue: true },
    }),
    prisma.customer.groupBy({
      by: ['favouriteCategory'],
      where,
      _count: { _all: true },
      orderBy: { _count: { favouriteCategory: 'desc' } },
    }),
    prisma.customer.groupBy({
      by: ['preferredChannel'],
      where,
      _count: { _all: true },
    }),
    prisma.customer.findMany({
      where,
      orderBy: { totalSpend: 'desc' },
      take: sampleSize,
      select: {
        id: true,
        name: true,
        city: true,
        totalSpend: true,
        persona: true,
        lastPurchaseAt: true,
      },
    }),
  ]);

  return {
    audienceSize,
    revenuePotential: Math.round(agg._sum.totalSpend ?? 0),
    averageOrderValue: Math.round(agg._avg.averageOrderValue ?? 0),
    topCategories: categoryGroups.slice(0, 4).map((g) => ({
      category: g.favouriteCategory as ProductCategory,
      count: g._count._all,
    })),
    channelMix: channelGroups.map((g) => ({
      channel: g.preferredChannel,
      count: g._count._all,
    })),
    sampleCustomers: sample.map((c) => ({
      id: c.id,
      name: c.name,
      city: c.city,
      totalSpend: c.totalSpend,
      persona: c.persona,
      lastPurchaseAt: c.lastPurchaseAt ? c.lastPurchaseAt.toISOString() : null,
    })),
  };
}

export async function createSegment(brandId: string, input: CreateSegmentInput) {
  const where = brandScopedWhere(brandId, input.rule);
  const audienceSize = await prisma.customer.count({ where });
  const agg = await prisma.customer.aggregate({ where, _sum: { totalSpend: true } });

  return prisma.segment.create({
    data: {
      brandId,
      name: input.name,
      description: input.description,
      naturalLanguageQuery: input.naturalLanguageQuery,
      aiExplanation: input.aiExplanation,
      cachedAudienceSize: audienceSize,
      cachedRevenuePotential: Math.round(agg._sum.totalSpend ?? 0),
      rules: { create: { version: 1, rule: input.rule as object } },
    },
    include: { rules: true },
  });
}

export async function sampleAudienceForMessaging(brandId: string, rule: SegmentRule, take: number) {
  const where = brandScopedWhere(brandId, rule);
  const rows = await prisma.customer.findMany({
    where,
    orderBy: { totalSpend: 'desc' },
    take,
    select: {
      id: true,
      name: true,
      city: true,
      favouriteCategory: true,
      persona: true,
    },
  });
  return rows.map((c) => ({
    customerId: c.id,
    firstName: c.name.split(' ')[0] ?? 'there',
    city: c.city,
    favouriteCategory: c.favouriteCategory,
    persona: c.persona,
  }));
}

export async function listSegments(brandId: string) {
  return prisma.segment.findMany({
    where: { brandId },
    orderBy: { createdAt: 'desc' },
    include: { rules: { orderBy: { version: 'desc' }, take: 1 } },
  });
}
