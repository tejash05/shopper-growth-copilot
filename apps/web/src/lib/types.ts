import type {
  CampaignFunnelMetrics,
  Channel,
  ChurnRisk,
  CommunicationStatus,
  CustomerListItem,
  LoyaltyTier,
  Persona,
  ProductCategory,
  SegmentPreviewResult,
  SegmentRule,
} from '@scp/shared';

export interface DashboardData {
  metrics: {
    totalShoppers: number;
    totalRevenue: number;
    repeatPurchaseRate: number;
    atRiskShoppers: number;
    activeCampaigns: number;
    attributedRevenue: number;
    attributedOrders: number;
  };
  communicationPerformance: {
    sent: number;
    delivered: number;
    clicked: number;
    failed: number;
    deliveryRate: number;
    clickRate: number;
  };
  opportunity: {
    audienceSize: number;
    recoverableRevenue: number;
    recommendedAction: string;
    headline: string;
  };
}

export interface CustomerDetail {
  customer: CustomerListItem & {
    gender: string | null;
    consent: { whatsapp: boolean; sms: boolean; email: boolean; rcs: boolean };
    rfm: { recency: number; frequency: number; monetary: number; cell: string; total: number };
    firstPurchaseAt: string | null;
  };
  orders: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    discountAmount: number;
    category: ProductCategory;
    placedAt: string;
    items: { name: string; quantity: number; unitPrice: number }[];
  }[];
  communications: {
    id: string;
    campaignId: string;
    campaignName: string;
    channel: Channel;
    status: CommunicationStatus;
    queuedAt: string;
  }[];
  timeline: { type: 'ORDER' | 'COMMUNICATION'; at: string; title: string; detail: string }[];
}

export interface SegmentSummary {
  id: string;
  name: string;
  description: string | null;
  naturalLanguageQuery: string | null;
  aiExplanation: string | null;
  cachedAudienceSize: number | null;
  cachedRevenuePotential: number | null;
  createdAt: string;
  rules: { rule: SegmentRule; version: number }[];
}

export interface CampaignVariantData {
  id: string;
  label: string;
  channel: Channel;
  allocation: number;
  subject: string | null;
  bodyTemplate: string;
  offerCode: string | null;
}

export interface CampaignSummary {
  id: string;
  name: string;
  goal: string | null;
  status: string;
  primaryChannel: Channel;
  fallbackChannel: Channel | null;
  audienceSize: number;
  controlGroupSize: number;
  targetedSize: number;
  createdAt: string;
  launchedAt: string | null;
  variants: CampaignVariantData[];
  _count: { communications: number };
}

export interface CampaignDetail extends CampaignSummary {
  goal: string | null;
  offerCode: string | null;
  controlGroupRatio: number;
  segmentId: string | null;
  segmentRuleSnapshot: SegmentRule | null;
  segment?: {
    id: string;
    name: string;
    naturalLanguageQuery: string | null;
  } | null;
}

export interface CampaignMetricsResponse {
  metrics: CampaignFunnelMetrics;
  channels: { channel: Channel; sent: number; clicked: number; attributedRevenue: number }[];
  variants: {
    label: string;
    channel: Channel;
    sent: number;
    clicked: number;
    attributed: number;
    conversionRate: number;
    clickRate: number;
  }[];
  timeline: { eventType: CommunicationStatus; occurredAt: string }[];
}

export interface CampaignInsightsResponse {
  analysis: {
    result: {
      summary: string;
      whatWorked: string[];
      whatDidNotWork: string[];
      bestAudience: string;
      bestChannel: Channel;
      bestVariant: string;
    };
    confidence: number;
    provider: string;
    status: string;
  };
  nextAction: {
    result: {
      nextCampaignName: string;
      goal: string;
      targetAudience: string;
      recommendedChannel: Channel;
      recommendedOffer: string;
      rationale: string;
    };
    confidence: number;
  };
}

// AI campaign-plan endpoint response
export interface CampaignPlanResponse {
  runId: string;
  plan: {
    result: {
      recommendedSegmentName: string;
      segmentRule: SegmentRule;
      businessReason: string;
      channelMix: { channel: Channel; share: number }[];
      offerRecommendation: { type: string; value: string; code: string; rationale: string };
      messageStrategy: string;
      sampleMessages: { channel: Channel; text: string }[];
      expectedPerformance: {
        estimatedDeliveryRate: number;
        estimatedClickRate: number;
        estimatedConversionRate: number;
        estimatedRevenue: number;
      };
      risks: string[];
    };
    explanation: string;
    confidence: number;
    provider: string;
    status: string;
  };
  preview: SegmentPreviewResult;
  channel: {
    result: {
      primaryChannel: Channel;
      fallbackChannel?: Channel;
      reasoning: string;
      channelScores: { channel: Channel; score: number }[];
    };
  };
  impact: {
    result: {
      estimatedDeliveryRate: number;
      estimatedClickRate: number;
      estimatedConversionRate: number;
      estimatedRevenue: number;
      assumptions: string[];
    };
  };
}

export interface ParseIntentResponse {
  runId: string;
  result: { rule: SegmentRule; suggestedName: string; audienceMatters: string };
  explanation: string;
  confidence: number;
  preview: SegmentPreviewResult;
}

export interface GenerateMessagesResponse {
  runId: string;
  result: {
    messages: { customerId: string; channel: Channel; subject?: string; body: string }[];
  };
  explanation: string;
  confidence: number;
}

export type { ChurnRisk, LoyaltyTier, Persona, ProductCategory, Channel, CommunicationStatus };
