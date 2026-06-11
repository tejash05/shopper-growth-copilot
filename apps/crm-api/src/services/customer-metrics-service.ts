import { prisma } from '@scp/db';
import {
  assignPersona,
  computeChurnRisk,
  computeRfm,
  estimateLifetimeValue,
  ProductCategory,
  type LoyaltyTier,
} from '@scp/shared';

const RECOMPUTE_CHUNK = 100;
const UPDATE_CONCURRENCY = 15;

async function runPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  if (items.length === 0) return;
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      if (current !== undefined) await fn(current);
    }
  });
  await Promise.all(workers);
}

function computeMetricsForCustomer(
  customer: {
    id: string;
    loyaltyTier: LoyaltyTier;
    favouriteCategory: ProductCategory;
    orders: { totalAmount: number; discountAmount: number; category: ProductCategory; placedAt: Date }[];
  },
  now: number,
) {
  const orders = customer.orders;
  const orderCount = orders.length;
  const totalSpend = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const averageOrderValue = orderCount > 0 ? Math.round(totalSpend / orderCount) : 0;
  const firstPurchaseAt = orders[0]?.placedAt ?? null;
  const lastPurchaseAt = orders[orderCount - 1]?.placedAt ?? null;
  const recencyDays = lastPurchaseAt
    ? Math.floor((now - lastPurchaseAt.getTime()) / 86_400_000)
    : 999;

  const categoryTally = new Map<ProductCategory, number>();
  for (const order of orders) {
    categoryTally.set(order.category, (categoryTally.get(order.category) ?? 0) + 1);
  }
  let favouriteCategory = customer.favouriteCategory;
  let max = 0;
  for (const [cat, count] of categoryTally) {
    if (count > max) {
      max = count;
      favouriteCategory = cat;
    }
  }

  const ordersWithDiscount = orders.filter((o) => o.discountAmount > 0).length;
  const discountSensitivity =
    orderCount > 0 ? Number((ordersWithDiscount / orderCount).toFixed(2)) : 0;

  const rfm = computeRfm({ recencyDays, frequency: orderCount, monetary: totalSpend });
  const churnRisk = computeChurnRisk({ recencyDays, frequency: orderCount, monetary: totalSpend }, rfm);
  const lifetimeValue = estimateLifetimeValue({
    totalSpend,
    averageOrderValue,
    orderCount,
    churnRisk,
  });
  const persona = assignPersona({
    rfm,
    churnRisk,
    loyaltyTier: customer.loyaltyTier,
    recencyDays,
    orderCount,
    totalSpend,
    discountSensitivity,
    favouriteCategory,
  });

  return {
    totalSpend,
    orderCount,
    averageOrderValue,
    favouriteCategory,
    discountSensitivity,
    churnRisk,
    persona,
    lifetimeValue,
    rfmRecency: rfm.recency,
    rfmFrequency: rfm.frequency,
    rfmMonetary: rfm.monetary,
    rfmCell: rfm.cell,
    rfmTotal: rfm.total,
    firstPurchaseAt,
    lastPurchaseAt,
  };
}

/**
 * Recompute denormalised shopper metrics from order history in batched queries.
 */
export async function recomputeCustomerMetrics(customerIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(customerIds)];
  if (uniqueIds.length === 0) return;

  const now = Date.now();

  for (let offset = 0; offset < uniqueIds.length; offset += RECOMPUTE_CHUNK) {
    const batchIds = uniqueIds.slice(offset, offset + RECOMPUTE_CHUNK);
    const customers = await prisma.customer.findMany({
      where: { id: { in: batchIds } },
      include: { orders: { orderBy: { placedAt: 'asc' } } },
    });

    await runPool(customers, UPDATE_CONCURRENCY, async (customer) => {
      const data = computeMetricsForCustomer(customer, now);
      await prisma.customer.update({ where: { id: customer.id }, data });
    });
  }
}
