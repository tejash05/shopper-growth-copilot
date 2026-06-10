import type { Channel, Persona, ProductCategory, SegmentRule } from '@scp/shared';
import type { CampaignFunnelMetrics } from '@scp/shared';

export interface ParseSegmentIntentInput {
  query: string;
}

export interface AudienceStats {
  size: number;
  totalRevenue: number;
  averageOrderValue: number;
  topCategories: { category: ProductCategory; count: number }[];
  channelMix: { channel: Channel; count: number }[];
}

export interface GenerateCampaignPlanInput {
  goal: string;
  /** Optional pre-resolved audience to ground the estimate. */
  audience?: AudienceStats;
}

export interface MessageCustomer {
  customerId: string;
  firstName: string;
  city: string;
  favouriteCategory: ProductCategory;
  persona: Persona;
}

export interface GeneratePersonalizedMessagesInput {
  channel: Channel;
  offerCode?: string;
  discountPercent?: number;
  goal?: string;
  customers: MessageCustomer[];
}

export interface RecommendChannelInput {
  channelMix: { channel: Channel; count: number }[];
  goal?: string;
}

export interface EstimateCampaignImpactInput {
  audienceSize: number;
  channel: Channel;
  averageOrderValue: number;
  hasOffer: boolean;
}

export interface AnalyzeCampaignPerformanceInput {
  campaignName: string;
  metrics: CampaignFunnelMetrics;
  channelBreakdown: { channel: Channel; sent: number; clicked: number; attributedRevenue: number }[];
  variantBreakdown: { label: string; channel: Channel; sent: number; clicked: number; conversionRate: number }[];
  topAudience?: { city: string; persona: Persona; conversionRate: number }[];
}

export interface RecommendNextActionInput {
  campaignName: string;
  metrics: CampaignFunnelMetrics;
  bestChannel: Channel;
}
