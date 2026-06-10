import { z } from 'zod';
import { Channel, CITIES, ChurnRisk, LoyaltyTier, Persona, ProductCategory } from '../constants/enums.js';

const numericRange = z
  .object({
    gte: z.number().optional(),
    lte: z.number().optional(),
    gt: z.number().optional(),
    lt: z.number().optional(),
  })
  .strict();

/**
 * Structured segment rule. This is the canonical, AI- and human-authorable
 * representation of an audience. Both the NL builder and manual builder emit
 * this shape; `segmentRuleToPrismaWhere` turns it into a query.
 */
export const segmentRuleSchema = z
  .object({
    city: z.enum(CITIES).optional(),
    gender: z.enum(['FEMALE', 'MALE', 'OTHER']).optional(),
    loyaltyTier: z.array(z.nativeEnum(LoyaltyTier)).optional(),
    churnRisk: z.array(z.nativeEnum(ChurnRisk)).optional(),
    persona: z.array(z.nativeEnum(Persona)).optional(),
    favouriteCategory: z.array(z.nativeEnum(ProductCategory)).optional(),
    preferredChannel: z.array(z.nativeEnum(Channel)).optional(),
    totalSpend: numericRange.optional(),
    orderCount: numericRange.optional(),
    averageOrderValue: numericRange.optional(),
    rfmTotal: numericRange.optional(),
    /** Days since last purchase: gte = at least N days ago, lte = at most M days ago. */
    lastPurchaseDays: numericRange.optional(),
    consentRequired: z.boolean().optional(),
  })
  .strict();
export type SegmentRule = z.infer<typeof segmentRuleSchema>;

export const createSegmentSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  rule: segmentRuleSchema,
  naturalLanguageQuery: z.string().max(500).optional(),
  aiExplanation: z.string().max(2000).optional(),
});
export type CreateSegmentInput = z.infer<typeof createSegmentSchema>;

export const segmentPreviewSchema = z.object({
  rule: segmentRuleSchema,
  sampleSize: z.coerce.number().int().min(1).max(20).default(8),
});
export type SegmentPreviewInput = z.infer<typeof segmentPreviewSchema>;

export interface SegmentPreviewResult {
  audienceSize: number;
  revenuePotential: number;
  averageOrderValue: number;
  topCategories: { category: ProductCategory; count: number }[];
  channelMix: { channel: string; count: number }[];
  sampleCustomers: {
    id: string;
    name: string;
    city: string;
    totalSpend: number;
    persona: Persona;
    lastPurchaseAt: string | null;
  }[];
}
