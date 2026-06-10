import { z } from 'zod';
import { Channel } from '../constants/enums.js';
import { segmentRuleSchema } from './segment.js';

const channelEnum = z.nativeEnum(Channel);

export const campaignVariantInputSchema = z.object({
  label: z.string().min(1).max(20), // "A", "B"
  channel: channelEnum,
  /** % of audience allocated to this variant. Variants must sum to 100. */
  allocation: z.number().min(1).max(100),
  subject: z.string().max(150).optional(),
  /** Message template with {{firstName}}, {{category}}, {{offer}} placeholders. */
  bodyTemplate: z.string().min(1).max(2000),
  offerCode: z.string().max(40).optional(),
});
export type CampaignVariantInput = z.infer<typeof campaignVariantInputSchema>;

export const createCampaignSchema = z.object({
  name: z.string().min(2).max(140),
  goal: z.string().max(1000).optional(),
  segmentId: z.string().cuid().optional(),
  /** Inline rule if not saving a named segment first. */
  segmentRule: segmentRuleSchema.optional(),
  primaryChannel: channelEnum,
  fallbackChannel: channelEnum.optional(),
  controlGroupRatio: z.number().min(0).max(0.5).default(0.1),
  offerCode: z.string().max(40).optional(),
  variants: z.array(campaignVariantInputSchema).min(1).max(4),
  aiPlanRunId: z.string().cuid().optional(),
});
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const launchCampaignSchema = z.object({
  campaignId: z.string().cuid(),
});
export type LaunchCampaignInput = z.infer<typeof launchCampaignSchema>;

export interface CampaignFunnelMetrics {
  audience: number;
  controlGroup: number;
  targeted: number;
  queued: number;
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
  failed: number;
  attributedOrders: number;
  attributedRevenue: number;
  deliveryRate: number;
  clickRate: number;
  conversionRate: number;
  /** Conversion lift of targeted vs control group. */
  controlConversionRate: number;
  liftVsControl: number;
}

export interface SafetyCheckResult {
  audienceBefore: number;
  audienceAfter: number;
  removedNoConsent: number;
  removedDuplicates: number;
  removedRecentlyMessaged: number;
  smsLengthIssues: number;
  fatigueRisk: 'low' | 'medium' | 'high';
  discountAbuseRisk: 'low' | 'medium' | 'high';
  recommendedControlGroupSize: number;
  warnings: string[];
}
