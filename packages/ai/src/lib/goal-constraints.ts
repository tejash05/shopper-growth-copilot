import { Persona, ProductCategory, type SegmentRule } from '@scp/shared';

export type CampaignType = 'clearance' | 'winback' | 'general';

export interface MinDiscountConstraint {
  min: number;
  /** When true, recommended discount must be strictly greater than `min`. */
  exclusive: boolean;
}

export interface ParsedGoalConstraints {
  campaignType: CampaignType;
  categories: ProductCategory[];
  priceRange?: { gte: number; lte: number };
  minDiscount?: MinDiscountConstraint;
}

const CLEARANCE_PATTERN =
  /\b(clear(?:\s+the)?\s+stock|clearance|overstock|liquidate|move\s+inventory|sell\s+through|excess\s+stock)\b/i;

const WINBACK_PATTERN = /\b(win[-\s]?back|lapsed|dormant|haven'?t\s+purchas|inactive\s+for|churn)\b/i;

const DISCOUNT_SLABS = [20, 25, 30, 35, 40] as const;

/** Parse a numeric amount from strings like "2,000", "2k", "2.4L". */
function parseAmount(raw: string, unit?: string): number {
  const n = Number(raw.replace(/,/g, ''));
  if (Number.isNaN(n)) return 0;
  const u = (unit ?? '').toLowerCase();
  if (u.startsWith('k')) return n * 1_000;
  if (u.startsWith('l')) return n * 1_00_000;
  if (u.startsWith('cr')) return n * 1_00_00_000;
  return n;
}

export function detectCampaignType(goal: string): CampaignType {
  const q = goal.toLowerCase();
  if (CLEARANCE_PATTERN.test(q)) return 'clearance';
  if (WINBACK_PATTERN.test(q)) return 'winback';
  return 'general';
}

export function parseCategoriesFromGoal(goal: string): ProductCategory[] {
  const q = goal.toLowerCase();
  const categories: ProductCategory[] = [];
  if (/dress|fashion|apparel|clothing|outfit|summer collection/.test(q))
    categories.push(ProductCategory.FASHION);
  if (/beauty|skincare|makeup|cosmetic|serum/.test(q)) categories.push(ProductCategory.BEAUTY);
  if (/sneaker|shoe|footwear/.test(q)) categories.push(ProductCategory.SNEAKERS);
  if (/accessor|bag|jewell?ery|watch/.test(q)) categories.push(ProductCategory.ACCESSORIES);
  return categories;
}

/** Extract an AOV band such as "₹2000 to ₹5000" or "2000-5000 rs". */
export function parsePriceRangeFromGoal(goal: string): { gte: number; lte: number } | undefined {
  const patterns = [
    /(?:₹|rs\.?|inr)?\s*([\d,.]+)\s*(?:k|thousand)?\s*(?:to|–|-)\s*(?:₹|rs\.?|inr)?\s*([\d,.]+)\s*(k|thousand|l|lakh|lakhs)?/i,
    /(?:between|from)\s+(?:₹|rs\.?|inr)?\s*([\d,.]+)\s*(?:k|thousand)?\s+(?:and|to)\s+(?:₹|rs\.?|inr)?\s*([\d,.]+)\s*(k|thousand|l|lakh|lakhs)?/i,
    /(?:around|about|cost(?:s)?\s+around)\s+(?:₹|rs\.?|inr)?\s*([\d,.]+)\s*(?:k|thousand)?\s*(?:to|–|-)\s*(?:₹|rs\.?|inr)?\s*([\d,.]+)\s*(k|thousand|l|lakh|lakhs)?/i,
  ];

  for (const pattern of patterns) {
    const match = goal.match(pattern);
    if (!match) continue;
    const gte = parseAmount(match[1]!, /k|thousand/i.test(match[0]) ? 'k' : undefined);
    const lte = parseAmount(match[2]!, match[3]);
    if (gte >= 100 && lte >= gte) return { gte, lte };
  }
  return undefined;
}

/** Parse minimum discount constraints like "more than 15%". */
export function parseMinimumDiscountFromGoal(goal: string): MinDiscountConstraint | undefined {
  const exclusiveMatch = goal.match(
    /(?:more than|greater than|above|over)\s+(\d+(?:\.\d+)?)\s*(?:%|percent|percentage)/i,
  );
  if (exclusiveMatch) {
    return { min: Number(exclusiveMatch[1]), exclusive: true };
  }

  const inclusiveMatch = goal.match(
    /(?:at least|minimum|min\.?|no less than)\s+(\d+(?:\.\d+)?)\s*(?:%|percent|percentage)/i,
  );
  if (inclusiveMatch) {
    return { min: Number(inclusiveMatch[1]), exclusive: false };
  }

  return undefined;
}

/**
 * If the recommended discount violates the user's stated minimum, bump to the next slab
 * (20 → 25 → 30 …). "More than 15%" requires strictly >15%, so 15% becomes 20%.
 */
export function validateAndBumpDiscount(
  recommendedPercent: number,
  constraint?: MinDiscountConstraint,
): number {
  if (!constraint) return recommendedPercent;

  const violates = constraint.exclusive
    ? recommendedPercent <= constraint.min
    : recommendedPercent < constraint.min;

  if (!violates) return recommendedPercent;

  for (const slab of DISCOUNT_SLABS) {
    if (constraint.exclusive ? slab > constraint.min : slab >= constraint.min) {
      return slab;
    }
  }
  return DISCOUNT_SLABS[DISCOUNT_SLABS.length - 1]!;
}

export function parseGoalConstraints(goal: string): ParsedGoalConstraints {
  return {
    campaignType: detectCampaignType(goal),
    categories: parseCategoriesFromGoal(goal),
    priceRange: parsePriceRangeFromGoal(goal),
    minDiscount: parseMinimumDiscountFromGoal(goal),
  };
}

export function formatCompactInrRange(gte: number, lte: number): string {
  const fmt = (n: number) => {
    if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(n % 1_00_000 === 0 ? 0 : 1)}L`;
    if (n >= 1_000) return `₹${n / 1_000}k`;
    return `₹${n.toLocaleString('en-IN')}`;
  };
  return `${fmt(gte)}–${fmt(lte)}`;
}

/** Normalize a segment rule AOV filter into a concrete price band when both bounds exist. */
export function normalizePriceRange(
  range?: { gte?: number; lte?: number },
): { gte: number; lte: number } | undefined {
  if (range?.gte != null && range.lte != null) return { gte: range.gte, lte: range.lte };
  return undefined;
}

function categoryShortLabel(category: ProductCategory): string {
  switch (category) {
    case ProductCategory.SNEAKERS:
      return 'Sneaker';
    case ProductCategory.FASHION:
      return 'Fashion';
    case ProductCategory.BEAUTY:
      return 'Beauty';
    case ProductCategory.ACCESSORIES:
      return 'Accessories';
    default:
      return 'Stock';
  }
}

export function buildClearanceSegmentName(
  categories: ProductCategory[],
  priceRange?: { gte: number; lte: number },
): string {
  const prefix =
    categories.length > 0 ? `${categoryShortLabel(categories[0]!)} Clearance` : 'Stock Clearance';
  const priceSuffix = priceRange ? ` ${formatCompactInrRange(priceRange.gte, priceRange.lte)}` : '';
  return `${prefix} — Deal Seekers${priceSuffix}`;
}

export function generateOfferCode(
  categories: ProductCategory[],
  discountPercent: number,
  campaignType: CampaignType,
): string {
  if (campaignType === 'clearance') {
    const prefix =
      categories[0] === ProductCategory.SNEAKERS
        ? 'SNEAKER'
        : categories[0] === ProductCategory.FASHION
          ? 'STYLE'
          : categories[0] === ProductCategory.BEAUTY
            ? 'GLOW'
            : categories[0] === ProductCategory.ACCESSORIES
              ? 'ACCESS'
              : 'CLEAR';
    return `${prefix}${discountPercent}`;
  }
  if (campaignType === 'winback') return `COMEBACK${discountPercent}`;
  return `OFFER${discountPercent}`;
}

/** Enrich a parsed segment rule with goal-derived filters. */
export function enrichSegmentRuleFromGoal(rule: SegmentRule, goal: string): SegmentRule {
  const constraints = parseGoalConstraints(goal);
  const enriched: SegmentRule = { ...rule };

  if (constraints.priceRange) {
    enriched.averageOrderValue = constraints.priceRange;
  }

  if (constraints.categories.length) {
    enriched.favouriteCategory = [
      ...(enriched.favouriteCategory ?? []),
      ...constraints.categories.filter((c) => !enriched.favouriteCategory?.includes(c)),
    ];
  }

  if (constraints.campaignType === 'clearance') {
    const personas = new Set(enriched.persona ?? []);
    personas.add(Persona.DISCOUNT_LED_BUYER);
    enriched.persona = [...personas];
  }

  return enriched;
}

export function defaultDiscountForCampaign(campaignType: CampaignType): number {
  return campaignType === 'clearance' ? 20 : 15;
}

export function resolveDiscountPercent(goal: string, recommended = defaultDiscountForCampaign(detectCampaignType(goal))): number {
  const constraints = parseGoalConstraints(goal);
  return validateAndBumpDiscount(recommended, constraints.minDiscount);
}
