import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@scp/db';
import { AiCapability, Channel, segmentRuleSchema } from '@scp/shared';
import { resolveBrandId } from '../lib/brand.js';
import { parseOr400 } from '../lib/validate.js';
import { ai, recordAiRun } from '../lib/ai.js';
import { previewSegment, sampleAudienceForMessaging } from '../services/segment-service.js';

const parseIntentSchema = z.object({ query: z.string().min(3).max(500) });
const campaignPlanSchema = z.object({
  goal: z.string().min(3).max(1000),
  segmentName: z.string().max(200).optional(),
  naturalLanguageQuery: z.string().max(500).optional(),
  segmentRule: segmentRuleSchema.optional(),
  audienceSize: z.number().int().min(0).optional(),
  revenuePotential: z.number().min(0).optional(),
});
const generateMessagesSchema = z.object({
  rule: segmentRuleSchema,
  channel: z.nativeEnum(Channel),
  offerCode: z.string().max(40).optional(),
  discountPercent: z.number().min(0).max(90).optional(),
  goal: z.string().max(500).optional(),
  sampleSize: z.number().int().min(1).max(25).default(12),
});

export async function aiRoutes(app: FastifyInstance) {
  app.post('/api/ai/parse-intent', async (req, reply) => {
    const input = parseOr400(parseIntentSchema, req.body, reply);
    if (!input) return;
    const brandId = await resolveBrandId(req);
    const { result, runId } = await recordAiRun(brandId, AiCapability.PARSE_SEGMENT_INTENT, input, () =>
      ai.parseSegmentIntent(input),
    );
    const preview = await previewSegment(brandId, result.result.rule, 8);
    return { runId, ...result, preview };
  });

  app.post('/api/ai/campaign-plan', async (req, reply) => {
    const input = parseOr400(campaignPlanSchema, req.body, reply);
    if (!input) return;
    const brandId = await resolveBrandId(req);
    const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { name: true } });
    const brandName = brand?.name ?? 'your brand';

    const audienceStats =
      input.segmentRule && input.audienceSize != null
        ? {
            size: input.audienceSize,
            totalRevenue: input.revenuePotential ?? 0,
            averageOrderValue:
              input.audienceSize > 0 && input.revenuePotential
                ? input.revenuePotential / input.audienceSize
                : 2600,
            topCategories: [],
            channelMix: [],
          }
        : undefined;

    const planInput = {
      goal: input.goal,
      brandName,
      segmentName: input.segmentName,
      naturalLanguageQuery: input.naturalLanguageQuery,
      segmentRule: input.segmentRule,
      audience: audienceStats,
    };

    const { result: plan, runId } = await recordAiRun(
      brandId,
      AiCapability.GENERATE_CAMPAIGN_PLAN,
      planInput,
      () => ai.generateCampaignPlan(planInput),
    );

    const ruleForPreview = input.segmentRule ?? plan.result.segmentRule;
    const preview = await previewSegment(brandId, ruleForPreview, 6);
    const channelInput = {
      channelMix: preview.channelMix.map((c) => ({ channel: c.channel as Channel, count: c.count })),
      goal: input.goal,
    };
    const { result: channel } = await recordAiRun(brandId, AiCapability.RECOMMEND_CHANNEL, channelInput, () =>
      ai.recommendChannel(channelInput),
    );
    const impactInput = {
      audienceSize: preview.audienceSize,
      channel: channel.result.primaryChannel,
      averageOrderValue: preview.averageOrderValue,
      hasOffer: true,
    };
    const { result: impact } = await recordAiRun(
      brandId,
      AiCapability.ESTIMATE_CAMPAIGN_IMPACT,
      impactInput,
      () => ai.estimateCampaignImpact(impactInput),
    );

    return { runId, plan, preview, channel, impact };
  });

  app.post('/api/ai/generate-messages', async (req, reply) => {
    const input = parseOr400(generateMessagesSchema, req.body, reply);
    if (!input) return;
    const brandId = await resolveBrandId(req);
    const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { name: true } });
    const brandName = brand?.name ?? 'your brand';
    const customers = await sampleAudienceForMessaging(brandId, input.rule, input.sampleSize);
    const genInput = {
      channel: input.channel as Channel,
      offerCode: input.offerCode,
      discountPercent: input.discountPercent,
      goal: input.goal,
      brandName,
      customers,
    };
    const { result, runId } = await recordAiRun(
      brandId,
      AiCapability.GENERATE_PERSONALIZED_MESSAGES,
      { channel: input.channel, count: customers.length },
      () => ai.generatePersonalizedMessages(genInput),
    );
    return { runId, ...result };
  });
}
