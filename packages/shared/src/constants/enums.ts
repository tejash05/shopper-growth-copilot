/**
 * Canonical enums for the platform. These string values are mirrored 1:1 in the
 * Prisma schema (packages/db). Keep them in sync — they are the contract shared
 * across the web app, CRM API, and channel service.
 */

export const Channel = {
  WHATSAPP: 'WHATSAPP',
  SMS: 'SMS',
  EMAIL: 'EMAIL',
  RCS: 'RCS',
} as const;
export type Channel = (typeof Channel)[keyof typeof Channel];
export const CHANNELS = Object.values(Channel);

/** Hard provider limits we enforce before a send is ever queued. */
export const CHANNEL_LIMITS: Record<Channel, { maxLength?: number; supportsSubject: boolean }> = {
  WHATSAPP: { maxLength: 1024, supportsSubject: false },
  SMS: { maxLength: 160, supportsSubject: false },
  EMAIL: { supportsSubject: true },
  RCS: { maxLength: 2000, supportsSubject: false },
};

/**
 * Communication lifecycle. CommunicationEvent rows are append-only; the
 * Communication.status column is a materialised projection of the latest
 * meaningful event (see domain/communication-state.ts).
 */
export const CommunicationStatus = {
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  CLICKED: 'CLICKED',
  ATTRIBUTED_ORDER: 'ATTRIBUTED_ORDER',
  FAILED: 'FAILED',
} as const;
export type CommunicationStatus = (typeof CommunicationStatus)[keyof typeof CommunicationStatus];

/** Monotonic rank used to resolve out-of-order callbacks. Higher = later in funnel. */
export const COMMUNICATION_STATUS_RANK: Record<CommunicationStatus, number> = {
  QUEUED: 0,
  SENT: 1,
  DELIVERED: 2,
  READ: 3,
  CLICKED: 4,
  ATTRIBUTED_ORDER: 5,
  FAILED: 6,
};

export const CampaignStatus = {
  DRAFT: 'DRAFT',
  SCHEDULED: 'SCHEDULED',
  LAUNCHING: 'LAUNCHING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;
export type CampaignStatus = (typeof CampaignStatus)[keyof typeof CampaignStatus];

export const LoyaltyTier = {
  PLATINUM: 'PLATINUM',
  GOLD: 'GOLD',
  SILVER: 'SILVER',
  BRONZE: 'BRONZE',
} as const;
export type LoyaltyTier = (typeof LoyaltyTier)[keyof typeof LoyaltyTier];

export const ChurnRisk = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;
export type ChurnRisk = (typeof ChurnRisk)[keyof typeof ChurnRisk];

export const ProductCategory = {
  FASHION: 'FASHION',
  BEAUTY: 'BEAUTY',
  ACCESSORIES: 'ACCESSORIES',
  SNEAKERS: 'SNEAKERS',
} as const;
export type ProductCategory = (typeof ProductCategory)[keyof typeof ProductCategory];
export const PRODUCT_CATEGORIES = Object.values(ProductCategory);

export const Persona = {
  VIP_FASHION_LOYALIST: 'VIP_FASHION_LOYALIST',
  DORMANT_HIGH_SPENDER: 'DORMANT_HIGH_SPENDER',
  DISCOUNT_LED_BUYER: 'DISCOUNT_LED_BUYER',
  NEW_CUSTOMER: 'NEW_CUSTOMER',
  BEAUTY_REPEAT_BUYER: 'BEAUTY_REPEAT_BUYER',
  WINDOW_SHOPPER: 'WINDOW_SHOPPER',
  AT_RISK_LOYALIST: 'AT_RISK_LOYALIST',
} as const;
export type Persona = (typeof Persona)[keyof typeof Persona];

export const PERSONA_LABELS: Record<Persona, string> = {
  VIP_FASHION_LOYALIST: 'VIP Fashion Loyalist',
  DORMANT_HIGH_SPENDER: 'Dormant High Spender',
  DISCOUNT_LED_BUYER: 'Discount-Led Buyer',
  NEW_CUSTOMER: 'New Customer',
  BEAUTY_REPEAT_BUYER: 'Beauty Repeat Buyer',
  WINDOW_SHOPPER: 'Window Shopper',
  AT_RISK_LOYALIST: 'At-Risk Loyalist',
};

export const Gender = {
  FEMALE: 'FEMALE',
  MALE: 'MALE',
  OTHER: 'OTHER',
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

export const CITIES = ['Bangalore', 'Delhi', 'Mumbai', 'Hyderabad', 'Pune'] as const;
export type City = (typeof CITIES)[number];

export const CHANNEL_LABELS: Record<Channel, string> = {
  WHATSAPP: 'WhatsApp',
  SMS: 'SMS',
  EMAIL: 'Email',
  RCS: 'RCS',
};

export const AiCapability = {
  PARSE_SEGMENT_INTENT: 'parseSegmentIntent',
  GENERATE_CAMPAIGN_PLAN: 'generateCampaignPlan',
  GENERATE_PERSONALIZED_MESSAGES: 'generatePersonalizedMessages',
  RECOMMEND_CHANNEL: 'recommendChannel',
  ESTIMATE_CAMPAIGN_IMPACT: 'estimateCampaignImpact',
  ANALYZE_CAMPAIGN_PERFORMANCE: 'analyzeCampaignPerformance',
  RECOMMEND_NEXT_ACTION: 'recommendNextAction',
} as const;
export type AiCapability = (typeof AiCapability)[keyof typeof AiCapability];
