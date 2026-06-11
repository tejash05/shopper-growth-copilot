import type { FastifyInstance } from 'fastify';
import { AiCapability, createCampaignSchema } from '@scp/shared';
import { resolveBrandId } from '../lib/brand.js';
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
  app.get('/api/campaigns', async (req) => {
    const brandId = await resolveBrandId(req);
    return listCampaigns(brandId);
  });

  app.get<{ Params: { id: string } }>('/api/campaigns/:id', async (req, reply) => {
    const brandId = await resolveBrandId(req);
    const campaign = await getCampaign(req.params.id, brandId);
    if (!campaign) return reply.code(404).send({ error: 'NotFound', message: 'Campaign not found.' });
    return campaign;
  });

  app.post('/api/campaigns', async (req, reply) => {
    const input = parseOr400(createCampaignSchema, req.body, reply);
    if (!input) return;
    const brandId = await resolveBrandId(req);
    const campaign = await createCampaign(brandId, input);
    return reply.code(201).send(campaign);
  });

  app.get<{ Params: { id: string } }>('/api/campaigns/:id/safety-check', async (req) => {
    const brandId = await resolveBrandId(req);
    return runSafetyCheck(req.params.id, brandId);
  });

  app.post<{ Params: { id: string } }>('/api/campaigns/:id/launch', async (req, reply) => {
    const brandId = await resolveBrandId(req);
    const result = await launchCampaign(req.params.id, brandId);
    return reply.code(202).send(result);
  });

  app.get<{ Params: { id: string } }>('/api/campaigns/:id/metrics', async (req) => {
    const brandId = await resolveBrandId(req);
    const [metrics, channels, variants, timeline] = await Promise.all([
      getCampaignMetrics(req.params.id, brandId),
      getChannelBreakdown(req.params.id, brandId),
      getVariantBreakdown(req.params.id, brandId),
      getEventTimeline(req.params.id, brandId),
    ]);
    return { metrics, channels, variants, timeline };
  });

  app.get<{ Params: { id: string } }>('/api/campaigns/:id/insights', async (req, reply) => {
    const brandId = await resolveBrandId(req);
    const campaign = await getCampaign(req.params.id, brandId);
    if (!campaign) return reply.code(404).send({ error: 'NotFound', message: 'Campaign not found.' });

    const [metrics, channels, variants, topAudience] = await Promise.all([
      getCampaignMetrics(req.params.id, brandId),
      getChannelBreakdown(req.params.id, brandId),
      getVariantBreakdown(req.params.id, brandId),
      getTopAudience(req.params.id, brandId),
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
      brandId,
      AiCapability.ANALYZE_CAMPAIGN_PERFORMANCE,
      analysisInput,
      () => ai.analyzeCampaignPerformance(analysisInput),
    );
    const nextInput = {
      campaignName: campaign.name,
      metrics,
      bestChannel: analysis.result.bestChannel,
    };
    const { result: next } = await recordAiRun(brandId, AiCapability.RECOMMEND_NEXT_ACTION, nextInput, () =>
      ai.recommendNextAction(nextInput),
    );

    return { analysis, nextAction: next };
  });
}
