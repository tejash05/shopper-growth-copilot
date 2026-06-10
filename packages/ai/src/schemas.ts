import { z } from 'zod';
import { Channel, segmentRuleSchema } from '@scp/shared';

const channelEnum = z.nativeEnum(Channel);

// ── parseSegmentIntent ──
export const parseSegmentIntentOutput = z.object({
  rule: segmentRuleSchema,
  audienceMatters: z.string(),
  suggestedName: z.string(),
});
export type ParseSegmentIntentOutput = z.infer<typeof parseSegmentIntentOutput>;

// ── generateCampaignPlan ──
export const campaignPlanOutput = z.object({
  recommendedSegmentName: z.string(),
  segmentRule: segmentRuleSchema,
  businessReason: z.string(),
  channelMix: z.array(z.object({ channel: channelEnum, share: z.number() })),
  offerRecommendation: z.object({
    type: z.string(),
    value: z.string(),
    code: z.string(),
    rationale: z.string(),
  }),
  messageStrategy: z.string(),
  sampleMessages: z.array(z.object({ channel: channelEnum, text: z.string() })),
  expectedPerformance: z.object({
    estimatedDeliveryRate: z.number(),
    estimatedClickRate: z.number(),
    estimatedConversionRate: z.number(),
    estimatedRevenue: z.number(),
  }),
  risks: z.array(z.string()),
});
export type CampaignPlanOutput = z.infer<typeof campaignPlanOutput>;

// ── generatePersonalizedMessages ──
export const personalizedMessagesOutput = z.object({
  messages: z.array(
    z.object({
      customerId: z.string(),
      channel: channelEnum,
      subject: z.string().optional(),
      body: z.string(),
    }),
  ),
});
export type PersonalizedMessagesOutput = z.infer<typeof personalizedMessagesOutput>;

// ── recommendChannel ──
export const recommendChannelOutput = z.object({
  primaryChannel: channelEnum,
  fallbackChannel: channelEnum.optional(),
  reasoning: z.string(),
  channelScores: z.array(z.object({ channel: channelEnum, score: z.number() })),
});
export type RecommendChannelOutput = z.infer<typeof recommendChannelOutput>;

// ── estimateCampaignImpact ──
export const estimateImpactOutput = z.object({
  estimatedDeliveryRate: z.number(),
  estimatedReadRate: z.number(),
  estimatedClickRate: z.number(),
  estimatedConversionRate: z.number(),
  estimatedRevenue: z.number(),
  assumptions: z.array(z.string()),
});
export type EstimateImpactOutput = z.infer<typeof estimateImpactOutput>;

// ── analyzeCampaignPerformance ──
export const analyzePerformanceOutput = z.object({
  summary: z.string(),
  whatWorked: z.array(z.string()),
  whatDidNotWork: z.array(z.string()),
  bestAudience: z.string(),
  bestChannel: channelEnum,
  bestVariant: z.string(),
});
export type AnalyzePerformanceOutput = z.infer<typeof analyzePerformanceOutput>;

// ── recommendNextAction ──
export const recommendNextActionOutput = z.object({
  nextCampaignName: z.string(),
  goal: z.string(),
  targetAudience: z.string(),
  recommendedChannel: channelEnum,
  recommendedOffer: z.string(),
  rationale: z.string(),
});
export type RecommendNextActionOutput = z.infer<typeof recommendNextActionOutput>;
