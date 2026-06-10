import type { SegmentRule } from '../dto/segment.js';

/**
 * Translate a structured SegmentRule into a Prisma-compatible `where` object.
 * Centralised here so the CRM API, segment preview, and campaign audience
 * resolution all compute identical audiences from the same rule.
 *
 * Returns a plain object; the caller passes it to `prisma.customer.findMany`.
 */
export function segmentRuleToPrismaWhere(rule: SegmentRule): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  const AND: Record<string, unknown>[] = [];

  if (rule.city) where.city = rule.city;
  if (rule.gender) where.gender = rule.gender;
  if (rule.loyaltyTier?.length) where.loyaltyTier = { in: rule.loyaltyTier };
  if (rule.churnRisk?.length) where.churnRisk = { in: rule.churnRisk };
  if (rule.persona?.length) where.persona = { in: rule.persona };
  if (rule.favouriteCategory?.length) where.favouriteCategory = { in: rule.favouriteCategory };
  if (rule.preferredChannel?.length) where.preferredChannel = { in: rule.preferredChannel };

  if (rule.totalSpend) where.totalSpend = numericFilter(rule.totalSpend);
  if (rule.orderCount) where.orderCount = numericFilter(rule.orderCount);
  if (rule.averageOrderValue) where.averageOrderValue = numericFilter(rule.averageOrderValue);
  if (rule.rfmTotal) where.rfmTotal = numericFilter(rule.rfmTotal);

  // lastPurchaseDays is expressed as "days ago"; translate to date boundaries.
  if (rule.lastPurchaseDays) {
    const now = Date.now();
    const dateFilter: Record<string, Date> = {};
    if (rule.lastPurchaseDays.gte !== undefined) {
      // at least N days ago => lastPurchaseAt <= now - N days
      dateFilter.lte = new Date(now - rule.lastPurchaseDays.gte * 86_400_000);
    }
    if (rule.lastPurchaseDays.lte !== undefined) {
      // at most M days ago => lastPurchaseAt >= now - M days
      dateFilter.gte = new Date(now - rule.lastPurchaseDays.lte * 86_400_000);
    }
    if (Object.keys(dateFilter).length) where.lastPurchaseAt = dateFilter;
  }

  if (rule.consentRequired) {
    // Consent depends on channel; default to messaging consent.
    AND.push({ consentWhatsApp: true });
  }

  if (AND.length) where.AND = AND;
  return where;
}

function numericFilter(f: { gte?: number; lte?: number; gt?: number; lt?: number }) {
  const out: Record<string, number> = {};
  if (f.gte !== undefined) out.gte = f.gte;
  if (f.lte !== undefined) out.lte = f.lte;
  if (f.gt !== undefined) out.gt = f.gt;
  if (f.lt !== undefined) out.lt = f.lt;
  return out;
}
