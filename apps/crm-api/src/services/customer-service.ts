import { prisma, type Prisma } from '@scp/db';
import type { CustomerListItem, CustomerListQuery, Paginated } from '@scp/shared';
import { getDefaultBrandId } from '../lib/brand.js';

function buildWhere(brandId: string, q: CustomerListQuery): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = { brandId };
  if (q.city) where.city = q.city;
  if (q.churnRisk) where.churnRisk = q.churnRisk;
  if (q.loyaltyTier) where.loyaltyTier = q.loyaltyTier;
  if (q.persona) where.persona = q.persona;
  if (q.favouriteCategory) where.favouriteCategory = q.favouriteCategory;
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { email: { contains: q.search, mode: 'insensitive' } },
      { phone: { contains: q.search } },
    ];
  }
  return where;
}

export async function listCustomers(q: CustomerListQuery): Promise<Paginated<CustomerListItem>> {
  const brandId = await getDefaultBrandId();
  const where = buildWhere(brandId, q);

  const [total, rows] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { [q.sortBy]: q.sortDir },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);

  return {
    data: rows.map(toListItem),
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}

export async function getCustomerDetail(id: string) {
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return null;

  const [orders, communications] = await Promise.all([
    prisma.order.findMany({
      where: { customerId: id },
      orderBy: { placedAt: 'desc' },
      take: 25,
      include: { items: { include: { product: true } } },
    }),
    prisma.communication.findMany({
      where: { customerId: id },
      orderBy: { queuedAt: 'desc' },
      take: 25,
      include: { campaign: { select: { id: true, name: true } }, events: true },
    }),
  ]);

  // Merge orders + communications into a single chronological timeline.
  const timeline = [
    ...orders.map((o) => ({
      type: 'ORDER' as const,
      at: o.placedAt.toISOString(),
      title: `Order ${o.orderNumber}`,
      detail: `${o.category} • ₹${o.totalAmount.toLocaleString('en-IN')}`,
    })),
    ...communications.flatMap((c) =>
      c.events.map((e) => ({
        type: 'COMMUNICATION' as const,
        at: e.occurredAt.toISOString(),
        title: `${c.campaign.name}`,
        detail: `${c.channel} • ${e.eventType}`,
      })),
    ),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  return {
    customer: toDetail(customer),
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      totalAmount: o.totalAmount,
      discountAmount: o.discountAmount,
      category: o.category,
      placedAt: o.placedAt.toISOString(),
      items: o.items.map((it) => ({
        name: it.product.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
    })),
    communications: communications.map((c) => ({
      id: c.id,
      campaignId: c.campaignId,
      campaignName: c.campaign.name,
      channel: c.channel,
      status: c.status,
      queuedAt: c.queuedAt.toISOString(),
    })),
    timeline,
  };
}

function toListItem(c: Prisma.CustomerGetPayload<object>): CustomerListItem {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    city: c.city,
    loyaltyTier: c.loyaltyTier,
    persona: c.persona,
    churnRisk: c.churnRisk,
    totalSpend: c.totalSpend,
    orderCount: c.orderCount,
    averageOrderValue: c.averageOrderValue,
    lifetimeValue: c.lifetimeValue,
    rfmCell: c.rfmCell,
    rfmTotal: c.rfmTotal,
    favouriteCategory: c.favouriteCategory,
    preferredChannel: c.preferredChannel,
    discountSensitivity: c.discountSensitivity,
    lastPurchaseAt: c.lastPurchaseAt ? c.lastPurchaseAt.toISOString() : null,
  };
}

function toDetail(c: Prisma.CustomerGetPayload<object>) {
  return {
    ...toListItem(c),
    gender: c.gender,
    consent: {
      whatsapp: c.consentWhatsApp,
      sms: c.consentSms,
      email: c.consentEmail,
      rcs: c.consentRcs,
    },
    rfm: {
      recency: c.rfmRecency,
      frequency: c.rfmFrequency,
      monetary: c.rfmMonetary,
      cell: c.rfmCell,
      total: c.rfmTotal,
    },
    firstPurchaseAt: c.firstPurchaseAt ? c.firstPurchaseAt.toISOString() : null,
  };
}
