import {
  AiCapability,
  ChurnRisk,
  CITIES,
  LoyaltyTier,
  Persona,
  ProductCategory,
  type SegmentRule,
} from '@scp/shared';
import type { Capability } from '../types.js';
import { parseSegmentIntentOutput, type ParseSegmentIntentOutput } from '../schemas.js';
import type { ParseSegmentIntentInput } from '../inputs.js';
import {
  buildClearanceSegmentName,
  detectCampaignType,
  enrichSegmentRuleFromGoal,
  normalizePriceRange,
  parseCategoriesFromGoal,
  parseGoalConstraints,
  parsePriceRangeFromGoal,
} from '../lib/goal-constraints.js';

/** Convert "₹10,000" / "10k" / "2.4L" / "2 lakh" → number. */
function parseAmount(raw: string, unit?: string): number {
  const n = Number(raw.replace(/,/g, ''));
  if (Number.isNaN(n)) return 0;
  const u = (unit ?? '').toLowerCase();
  if (u.startsWith('k')) return n * 1_000;
  if (u.startsWith('l')) return n * 1_00_000;
  if (u.startsWith('cr')) return n * 1_00_00_000;
  return n;
}

function unitToDays(n: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith('week')) return n * 7;
  if (u.startsWith('month')) return n * 30;
  if (u.startsWith('year')) return n * 365;
  return n;
}

/**
 * Heuristic natural-language → SegmentRule parser. This is the deterministic
 * brain behind mock mode; it reliably handles the canonical marketer prompts
 * (city, spend thresholds, recency windows, churn intent, category/persona).
 */
function parse(query: string): SegmentRule {
  const q = query.toLowerCase();
  const rule: SegmentRule = {};

  // City
  for (const city of CITIES) {
    if (q.includes(city.toLowerCase())) {
      rule.city = city;
      break;
    }
  }

  // Spend threshold
  const spendMatch = q.match(
    /(?:spent|spend|spending|over|above|more than|worth|value of|ltv of)[^\d₹]{0,14}(?:₹|rs\.?|inr)?\s?([\d,.]+)\s?(k|l|lakh|lakhs|cr|crore)?/i,
  );
  if (spendMatch) {
    const amount = parseAmount(spendMatch[1]!, spendMatch[2]);
    if (amount >= 100) rule.totalSpend = { gte: amount };
  } else if (/high[-\s]?value|big spender|top spender/.test(q)) {
    rule.totalSpend = { gte: 10000 };
  }

  // AOV / price band (e.g. sneakers costing ₹2000–₹5000)
  const priceRange = parsePriceRangeFromGoal(query);
  if (priceRange) rule.averageOrderValue = priceRange;

  // Recency: inactivity (gte) — "haven't purchased in 45 days"
  const inactivity = q.match(
    /(?:haven'?t|hasn'?t|not|no longer|without)\s+(?:purchas|bought|order|shop|buy|active)\w*[^\d]{0,16}(\d+)\s*(day|days|week|weeks|month|months|year|years)/i,
  );
  // Window: recent activity (lte) — "bought in the last 6 months"
  const window = q.match(
    /(?:in|within|over)\s+the\s+last\s+(\d+)\s*(day|days|week|weeks|month|months|year|years)/i,
  );

  const lastPurchaseDays: { gte?: number; lte?: number } = {};
  if (inactivity) lastPurchaseDays.gte = unitToDays(Number(inactivity[1]), inactivity[2]!);
  if (window) lastPurchaseDays.lte = unitToDays(Number(window[1]), window[2]!);
  if (Object.keys(lastPurchaseDays).length) rule.lastPurchaseDays = lastPurchaseDays;

  const campaignType = detectCampaignType(query);

  // Churn intent — skip for clearance goals unless explicitly win-back
  if (
    campaignType !== 'clearance' &&
    /at[-\s]?risk|churn|about to leave|slipping|lapsing|win[-\s]?back/.test(q)
  ) {
    rule.churnRisk = [ChurnRisk.HIGH, ChurnRisk.MEDIUM];
  }

  // Loyalty / VIP
  if (/\bvip\b|loyal|platinum|gold tier|best customers/.test(q)) {
    rule.loyaltyTier = [LoyaltyTier.PLATINUM, LoyaltyTier.GOLD];
  }

  // Persona hints
  const personas: Persona[] = [];
  if (/dormant|inactive|lapsed/.test(q)) personas.push(Persona.DORMANT_HIGH_SPENDER);
  if (/new customer|first[-\s]?time|recently joined/.test(q)) personas.push(Persona.NEW_CUSTOMER);
  if (campaignType === 'clearance' || /deal seeker|discount|offer-led/.test(q)) {
    personas.push(Persona.DISCOUNT_LED_BUYER);
  }
  if (personas.length) rule.persona = personas;

  // Category
  const categories = parseCategoriesFromGoal(query);
  if (categories.length) rule.favouriteCategory = categories;

  return rule;
}

function describe(rule: SegmentRule, campaignType: ReturnType<typeof detectCampaignType>): string {
  const parts: string[] = [];
  if (rule.city) parts.push(`based in ${rule.city}`);
  if (rule.totalSpend?.gte) parts.push(`who have spent over ₹${rule.totalSpend.gte.toLocaleString('en-IN')}`);
  if (rule.averageOrderValue?.gte && rule.averageOrderValue.lte) {
    parts.push(
      `with typical order values between ₹${rule.averageOrderValue.gte.toLocaleString('en-IN')} and ₹${rule.averageOrderValue.lte.toLocaleString('en-IN')}`,
    );
  }
  if (rule.lastPurchaseDays?.gte) parts.push(`inactive for ${rule.lastPurchaseDays.gte}+ days`);
  if (rule.lastPurchaseDays?.lte) parts.push(`but active within ${rule.lastPurchaseDays.lte} days`);
  if (rule.churnRisk?.length) parts.push('flagged at churn risk');
  if (rule.favouriteCategory?.length)
    parts.push(`leaning toward ${rule.favouriteCategory.join(', ').toLowerCase()}`);
  if (campaignType === 'clearance') parts.push('responsive to offer-led clearance messaging');
  return parts.length
    ? `Targets shoppers ${parts.join(', ')}.`
    : 'Broad audience — consider adding spend or recency filters to sharpen targeting.';
}

function suggestSegmentName(query: string, rule: SegmentRule): string {
  const constraints = parseGoalConstraints(query);

  if (constraints.campaignType === 'clearance') {
    return buildClearanceSegmentName(
      constraints.categories.length ? constraints.categories : (rule.favouriteCategory ?? []),
      constraints.priceRange ?? normalizePriceRange(rule.averageOrderValue),
    );
  }

  if (rule.persona?.includes(Persona.DORMANT_HIGH_SPENDER) || (rule.totalSpend?.gte ?? 0) >= 10000) {
    return rule.churnRisk ? 'Dormant High-Value Win-back' : 'High-Value Shoppers';
  }
  if (rule.city) return `${rule.city} Shoppers`;
  if (rule.favouriteCategory?.length && rule.averageOrderValue) {
    const label = rule.favouriteCategory[0]!.toLowerCase();
    return `${label.charAt(0).toUpperCase()}${label.slice(1)} Shoppers — AOV band`;
  }
  if (rule.favouriteCategory?.length) {
    const label = rule.favouriteCategory[0]!.toLowerCase();
    return `${label.charAt(0).toUpperCase()}${label.slice(1)} Enthusiasts`;
  }
  return 'Custom Segment';
}

export const parseSegmentIntent: Capability<ParseSegmentIntentInput, ParseSegmentIntentOutput> = {
  name: AiCapability.PARSE_SEGMENT_INTENT,
  schemaHint: parseSegmentIntentOutput.toString(),
  buildPrompt: (input) =>
    [
      'You are a retail CRM segmentation engine. Convert the marketer request into a structured segment rule.',
      'Only use these fields: city, gender, loyaltyTier[], churnRisk[], persona[], favouriteCategory[], totalSpend{gte,lte}, orderCount{}, averageOrderValue{}, lastPurchaseDays{gte,lte}, consentRequired.',
      'lastPurchaseDays.gte = "at least N days since last purchase". lastPurchaseDays.lte = "purchased within the last N days".',
      `Request: """${input.query}"""`,
      'Return JSON: { rule, audienceMatters, suggestedName }.',
    ].join('\n'),
  mock: (input) => {
    const campaignType = detectCampaignType(input.query);
    const rule = enrichSegmentRuleFromGoal(parse(input.query), input.query);
    const suggestedName = suggestSegmentName(input.query, rule);
    const audienceMatters = describe(rule, campaignType);
    return {
      result: {
        rule,
        suggestedName,
        audienceMatters,
      },
      explanation: `Parsed ${Object.keys(rule).length} filters from the request. ${audienceMatters}`,
      confidence: Object.keys(rule).length >= 2 ? 0.86 : 0.55,
    };
  },
};
