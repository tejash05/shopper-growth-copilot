import { AiCapability, Channel, ProductCategory } from '@scp/shared';
import type { Capability } from '../types.js';
import { campaignPlanOutput, type CampaignPlanOutput } from '../schemas.js';
import type { GenerateCampaignPlanInput } from '../inputs.js';
import { parseSegmentIntent } from './parse-segment-intent.js';
import {
  buildClearanceSegmentName,
  defaultDiscountForCampaign,
  formatCompactInrRange,
  generateOfferCode,
  normalizePriceRange,
  parseGoalConstraints,
  resolveDiscountPercent,
} from '../lib/goal-constraints.js';

function categoryDisplayName(category: ProductCategory | undefined): string {
  switch (category) {
    case ProductCategory.SNEAKERS:
      return 'sneakers';
    case ProductCategory.FASHION:
      return 'fashion picks';
    case ProductCategory.BEAUTY:
      return 'beauty favourites';
    case ProductCategory.ACCESSORIES:
      return 'accessories';
    default:
      return 'favourites';
  }
}

function buildSavedSegmentPlan(input: GenerateCampaignPlanInput): CampaignPlanOutput {
  const rule = input.segmentRule!;
  const segmentName = input.segmentName!;
  const brandToken = '{{brandName}}';
  const constraints = parseGoalConstraints(input.goal);
  const category = rule.favouriteCategory?.[0] ?? constraints.categories[0];
  const categoryLabel = categoryDisplayName(category);
  const discountPercent = resolveDiscountPercent(
    input.goal,
    defaultDiscountForCampaign(constraints.campaignType),
  );
  const offerCode = generateOfferCode(
    category ? [category] : constraints.categories,
    discountPercent,
    constraints.campaignType,
  );
  const audienceSize = input.audience?.size ?? 500;
  const aov = input.audience?.averageOrderValue ?? 2600;
  const estConversion = 0.06;
  const estimatedRevenue = Math.round(audienceSize * estConversion * aov);

  const audienceContext = input.naturalLanguageQuery
    ? `"${input.naturalLanguageQuery}"`
    : 'the saved segment filters';

  const businessReason = [
    `This saved audience (${segmentName}) matches ${audienceContext}.`,
    input.audience?.size
      ? `${input.audience.size.toLocaleString('en-IN')} shoppers with strong ${categoryLabel} affinity are ready for a personalised push.`
      : `Shoppers in this segment show strong ${categoryLabel} affinity and are ready for a personalised push.`,
    `A targeted ${categoryLabel} offer through their preferred channels should drive repeat purchases efficiently.`,
  ].join(' ');

  const messageStrategy = `Lead with ${categoryLabel} relevance and a clear ${discountPercent}% offer (${offerCode}). WhatsApp carries the primary push; SMS is the fallback for non-WhatsApp-consented shoppers. Keep copy brand-specific to ${brandToken}.`;

  return {
    recommendedSegmentName: segmentName,
    segmentRule: rule,
    businessReason,
    channelMix: [
      { channel: Channel.WHATSAPP, share: 0.65 },
      { channel: Channel.SMS, share: 0.35 },
    ],
    offerRecommendation: {
      type: 'percentage',
      value: `${discountPercent}%`,
      code: offerCode,
      rationale: `A ${discountPercent}% ${categoryLabel} incentive re-engages this saved audience without over-discounting.`,
    },
    messageStrategy,
    sampleMessages: [
      {
        channel: Channel.WHATSAPP,
        text: `Hey {{firstName}}! Your favourite {{category}} picks are waiting at ${brandToken}. Use ${offerCode} this weekend — ${discountPercent}% off with {{offer}}. Tap to explore 👉`,
      },
      {
        channel: Channel.SMS,
        text: `{{firstName}}, your {{category}} favourites are back at ${brandToken}. Use {{offer}} for ${discountPercent}% off.`,
      },
    ],
    expectedPerformance: {
      estimatedDeliveryRate: 0.94,
      estimatedClickRate: 0.18,
      estimatedConversionRate: estConversion,
      estimatedRevenue,
    },
    risks: [
      'Exclude shoppers without messaging consent before launch.',
      'Cap frequency: skip anyone messaged in the last 7 days to avoid fatigue.',
      'Hold a 10% control group to measure true incremental lift from this saved audience.',
    ],
  };
}

/**
 * The hero capability: turn a free-text business goal into an actionable plan
 * (segment + channel mix + offer + message strategy + impact estimate + risks).
 */
export const generateCampaignPlan: Capability<GenerateCampaignPlanInput, CampaignPlanOutput> = {
  name: AiCapability.GENERATE_CAMPAIGN_PLAN,
  schemaHint: campaignPlanOutput.toString(),
  buildPrompt: (input) =>
    [
      `You are a senior retail growth strategist for ${input.brandName ?? 'a retail brand'}.`,
      `Business goal: """${input.goal}"""`,
      input.segmentName
        ? `Saved segment: "${input.segmentName}".${input.naturalLanguageQuery ? ` Original query: """${input.naturalLanguageQuery}"""` : ''}`
        : '',
      input.audience
        ? `Resolved audience: ${input.audience.size} shoppers, ₹${Math.round(input.audience.totalRevenue)} historic revenue, AOV ₹${Math.round(input.audience.averageOrderValue)}.`
        : 'Audience not yet resolved.',
      'Produce a complete campaign plan: recommended segment + rule, business reason, channel mix, offer, message strategy, 2-3 sample messages, expected performance, and risks (consent/fatigue/discount).',
      'Use {{brandName}} as a template token in sample messages — do not hardcode a brand name.',
      'Return strict JSON matching the CampaignPlan schema.',
    ]
      .filter(Boolean)
      .join('\n'),
  mock: (input) => {
    const brandToken = '{{brandName}}';

    if (input.segmentRule && input.segmentName) {
      const result = buildSavedSegmentPlan(input);
      return {
        result,
        explanation: `Built a campaign plan for saved segment "${input.segmentName}" with ${result.offerRecommendation.code} over WhatsApp+SMS.`,
        confidence: 0.82,
      };
    }

    const constraints = parseGoalConstraints(input.goal);
    const parsed = parseSegmentIntent.mock({ query: input.goal });
    const rule = parsed.result.rule;
    const size = input.audience?.size ?? 1200;
    const aov =
      input.audience?.averageOrderValue ??
      (constraints.priceRange
        ? Math.round((constraints.priceRange.gte + constraints.priceRange.lte) / 2)
        : 2600);

    const discountPercent = resolveDiscountPercent(
      input.goal,
      defaultDiscountForCampaign(constraints.campaignType),
    );
    const offerCode = generateOfferCode(constraints.categories, discountPercent, constraints.campaignType);
    const categoryLabel = categoryDisplayName(constraints.categories[0] ?? rule.favouriteCategory?.[0]);
    const priceBandLabel = constraints.priceRange
      ? formatCompactInrRange(constraints.priceRange.gte, constraints.priceRange.lte)
      : undefined;

    const isClearance = constraints.campaignType === 'clearance';
    const recommendedSegmentName = isClearance
      ? buildClearanceSegmentName(
          constraints.categories.length ? constraints.categories : (rule.favouriteCategory ?? []),
          constraints.priceRange ?? normalizePriceRange(rule.averageOrderValue),
        )
      : parsed.result.suggestedName;

    const channelMix = isClearance
      ? [
          { channel: Channel.WHATSAPP, share: 0.65 },
          { channel: Channel.SMS, share: 0.35 },
        ]
      : [
          { channel: Channel.WHATSAPP, share: 0.7 },
          { channel: Channel.SMS, share: 0.3 },
        ];

    const estConversion = isClearance ? 0.08 : 0.06;
    const estimatedRevenue = Math.round(size * estConversion * aov);

    const businessReason = isClearance
      ? [
          parsed.result.audienceMatters,
          priceBandLabel
            ? `This ${categoryLabel} clearance push focuses on deal-seeking shoppers in the ${priceBandLabel} price band who are most likely to convert on a limited-time offer.`
            : `This clearance push targets deal-seeking shoppers most likely to convert on a limited-time offer.`,
          `Urgency on remaining ${categoryLabel} inventory, paired with a ${discountPercent}% offer, should drive offer-led conversion without waiting for full-price demand.`,
        ].join(' ')
      : `${parsed.result.audienceMatters} This cohort has proven purchase intent and the highest recoverable revenue per message, making a personalised win-back the most efficient growth lever right now.`;

    const offerRationale = isClearance
      ? `A ${discountPercent}% clearance incentive clears ${categoryLabel} stock in the target price band while staying above your stated discount floor.`
      : 'A 15% category-specific incentive is enough to re-trigger lapsed high-value shoppers without eroding margin or training discount-seeking behaviour.';

    const messageStrategy = isClearance
      ? `Lead with inventory urgency and ${categoryLabel} relevance, highlight the ${discountPercent}% offer and code ${offerCode}, and keep the price band implicit. WhatsApp carries the primary push; SMS is the fallback for non-WhatsApp-consented users.`
      : 'Lead with personalised category relevance (their favourite line), add urgency (weekend window), and keep the offer secondary to the product hook. WhatsApp carries the primary push; SMS is the fallback for non-WhatsApp-consented users.';

    const sampleMessages = isClearance
      ? [
          {
            channel: Channel.WHATSAPP,
            text: `Hey {{firstName}}! Last pairs of ${categoryLabel} in your size are on clearance at ${brandToken}. Enjoy ${discountPercent}% off with {{offer}} — shop the ${priceBandLabel ?? 'limited'} edit before they're gone 👉`,
          },
          {
            channel: Channel.SMS,
            text: `{{firstName}}, ${categoryLabel} clearance is live at ${brandToken}. ${discountPercent}% off with {{offer}}. Limited stock — shop now.`,
          },
        ]
      : [
          {
            channel: Channel.WHATSAPP,
            text: `Hey {{firstName}}! Your favourite ${categoryLabel} are back at ${brandToken}. Enjoy ${discountPercent}% off this weekend with {{offer}}. Tap to explore 👉`,
          },
          {
            channel: Channel.SMS,
            text: `{{firstName}}, fresh ${categoryLabel} just landed at ${brandToken}. ${discountPercent}% off with {{offer}}. Shop now.`,
          },
        ];

    const risks = isClearance
      ? [
          'Exclude shoppers without messaging consent before launch.',
          'Cap frequency: skip anyone messaged in the last 7 days to avoid fatigue.',
          'Hold a 10% control group to measure true incremental lift from the clearance offer.',
          'Monitor margin on discounted SKUs — pause if sell-through outpaces replenishment plans.',
        ]
      : [
          'Exclude shoppers without messaging consent before launch.',
          'Cap frequency: skip anyone messaged in the last 7 days to avoid fatigue.',
          'Discount-led buyers may wait for offers — hold a 10% control group to measure true incremental lift.',
        ];

    const result: CampaignPlanOutput = {
      recommendedSegmentName,
      segmentRule: rule,
      businessReason,
      channelMix,
      offerRecommendation: {
        type: 'percentage',
        value: `${discountPercent}%`,
        code: offerCode,
        rationale: offerRationale,
      },
      messageStrategy,
      sampleMessages,
      expectedPerformance: {
        estimatedDeliveryRate: 0.94,
        estimatedClickRate: isClearance ? 0.22 : 0.18,
        estimatedConversionRate: estConversion,
        estimatedRevenue,
      },
      risks,
    };

    const campaignLabel = isClearance ? 'clearance' : 'win-back';
    return {
      result,
      explanation: `Recommends a ${result.recommendedSegmentName} ${campaignLabel} over WhatsApp+SMS with a ${discountPercent}% offer (${offerCode}), projecting ~₹${estimatedRevenue.toLocaleString('en-IN')} recoverable revenue.`,
      confidence: 0.8,
    };
  },
};
