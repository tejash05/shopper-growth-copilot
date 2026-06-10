import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AiCapability, Channel, segmentRuleSchema } from '@scp/shared';
import { parseOr400 } from '../lib/validate.js';
import { ai, recordAiRun } from '../lib/ai.js';
import { previewSegment, sampleAudienceForMessaging } from '../services/segment-service.js';

const parseIntentSchema = z.object({ query: z.string().min(3).max(500) });
const campaignPlanSchema = z.object({ goal: z.string().min(3).max(1000) });
const generateMessagesSchema = z.object({
  rule: segmentRuleSchema,
  channel: z.nativeEnum(Channel),
  offerCode: z.string().max(40).optional(),
  discountPercent: z.number().min(0).max(90).optional(),
  goal: z.string().max(500).optional(),
  sampleSize: z.number().int().min(1).max(25).default(12),
});

export async function aiRoutes(app: FastifyInstance) {
  // Natural-language → structured segment + live audience preview.
  app.post('/api/ai/parse-intent', async (req, reply) => {
    const input = parseOr400(parseIntentSchema, req.body, reply);
    if (!input) return;
    const { result, runId } = await recordAiRun(AiCapability.PARSE_SEGMENT_INTENT, input, () =>
      ai.parseSegmentIntent(input),
    );
    const preview = await previewSegment(result.result.rule, 8);
    return { runId, ...result, preview };
  });

  // Hero flow: business goal → full campaign plan grounded in real audience data.
  app.post('/api/ai/campaign-plan', async (req, reply) => {
    const input = parseOr400(campaignPlanSchema, req.body, reply);
    if (!input) return;

    const { result: plan, runId } = await recordAiRun(
      AiCapability.GENERATE_CAMPAIGN_PLAN,
      input,
      () => ai.generateCampaignPlan(input),
    );

    const preview = await previewSegment(plan.result.segmentRule, 6);
    const channelInput = {
      channelMix: preview.channelMix.map((c) => ({ channel: c.channel as Channel, count: c.count })),
      goal: input.goal,
    };
    const { result: channel } = await recordAiRun(AiCapability.RECOMMEND_CHANNEL, channelInput, () =>
      ai.recommendChannel(channelInput),
    );
    const impactInput = {
      audienceSize: preview.audienceSize,
      channel: channel.result.primaryChannel,
      averageOrderValue: preview.averageOrderValue,
      hasOffer: true,
    };
    const { result: impact } = await recordAiRun(
      AiCapability.ESTIMATE_CAMPAIGN_IMPACT,
      impactInput,
      () => ai.estimateCampaignImpact(impactInput),
    );

    return { runId, plan, preview, channel, impact };
  });

  // Per-customer personalised message generation.
  app.post('/api/ai/generate-messages', async (req, reply) => {
    const input = parseOr400(generateMessagesSchema, req.body, reply);
    if (!input) return;
    const customers = await sampleAudienceForMessaging(input.rule, input.sampleSize);
    const genInput = {
      channel: input.channel as Channel,
      offerCode: input.offerCode,
      discountPercent: input.discountPercent,
      goal: input.goal,
      customers,
    };
    const { result, runId } = await recordAiRun(
      AiCapability.GENERATE_PERSONALIZED_MESSAGES,
      { channel: input.channel, count: customers.length },
      () => ai.generatePersonalizedMessages(genInput),
    );
    return { runId, ...result };
  });
}
