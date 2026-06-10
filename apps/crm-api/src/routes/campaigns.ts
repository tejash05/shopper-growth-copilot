import type { FastifyInstance } from 'fastify';
import { AiCapability, createCampaignSchema } from '@scp/shared';
import { parseOr400 } from '../lib/validate.js';
import {
  createCampaign,
  getCampaign,
  launchCampaign,
  listCampaigns,
  runSafetyCheck,
} from '../services/campaign-service.js';
import {
  getChannelBreakdown,
  getCampaignMetrics,
  getEventTimeline,
  getTopAudience,
  getVariantBreakdown,
} from '../services/metrics-service.js';
import { ai, recordAiRun } from '../lib/ai.js';

export async function campaignRoutes(app: FastifyInstance) {
  app.get('/api/campaigns', async () => listCampaigns());

  app.get<{ Params: { id: string } }>('/api/campaigns/:id', async (req, reply) => {
    const campaign = await getCampaign(req.params.id);
    if (!campaign) return reply.code(404).send({ error: 'NotFound', message: 'Campaign not found.' });
    return campaign;
  });

  app.post('/api/campaigns', async (req, reply) => {
    const input = parseOr400(createCampaignSchema, req.body, reply);
    if (!input) return;
    const campaign = await createCampaign(input);
    return reply.code(201).send(campaign);
  });

  app.get<{ Params: { id: string } }>('/api/campaigns/:id/safety-check', async (req) =>
    runSafetyCheck(req.params.id),
  );

  app.post<{ Params: { id: string } }>('/api/campaigns/:id/launch', async (req, reply) => {
    const result = await launchCampaign(req.params.id);
    return reply.code(202).send(result);
  });

  app.get<{ Params: { id: string } }>('/api/campaigns/:id/metrics', async (req) => {
    const [metrics, channels, variants, timeline] = await Promise.all([
      getCampaignMetrics(req.params.id),
      getChannelBreakdown(req.params.id),
      getVariantBreakdown(req.params.id),
      getEventTimeline(req.params.id),
    ]);
    return { metrics, channels, variants, timeline };
  });

  // AI post-campaign insights: performance analysis + next-best-action.
  app.get<{ Params: { id: string } }>('/api/campaigns/:id/insights', async (req) => {
    const campaign = await getCampaign(req.params.id);
    if (!campaign) return { error: 'NotFound' };

    const [metrics, channels, variants, topAudience] = await Promise.all([
      getCampaignMetrics(req.params.id),
      getChannelBreakdown(req.params.id),
      getVariantBreakdown(req.params.id),
      getTopAudience(req.params.id),
    ]);

    const analysisInput = {
      campaignName: campaign.name,
      metrics,
      channelBreakdown: channels,
      variantBreakdown: variants.map((v) => ({
        label: v.label,
        channel: v.channel,
        sent: v.sent,
        clicked: v.clicked,
        conversionRate: v.conversionRate,
      })),
      topAudience,
    };

    const { result: analysis } = await recordAiRun(
      AiCapability.ANALYZE_CAMPAIGN_PERFORMANCE,
      analysisInput,
      () => ai.analyzeCampaignPerformance(analysisInput),
    );
    const nextInput = {
      campaignName: campaign.name,
      metrics,
      bestChannel: analysis.result.bestChannel,
    };
    const { result: next } = await recordAiRun(AiCapability.RECOMMEND_NEXT_ACTION, nextInput, () =>
      ai.recommendNextAction(nextInput),
    );

    return { analysis, nextAction: next };
  });
}
