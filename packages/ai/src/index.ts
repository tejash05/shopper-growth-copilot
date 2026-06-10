import type { AiContext, AiResult } from './types.js';
import { resolveAiContext, runCapability } from './client.js';
import {
  analyzePerformanceOutput,
  campaignPlanOutput,
  estimateImpactOutput,
  parseSegmentIntentOutput,
  personalizedMessagesOutput,
  recommendChannelOutput,
  recommendNextActionOutput,
  type AnalyzePerformanceOutput,
  type CampaignPlanOutput,
  type EstimateImpactOutput,
  type ParseSegmentIntentOutput,
  type PersonalizedMessagesOutput,
  type RecommendChannelOutput,
  type RecommendNextActionOutput,
} from './schemas.js';
import { parseSegmentIntent } from './capabilities/parse-segment-intent.js';
import { generateCampaignPlan } from './capabilities/generate-campaign-plan.js';
import { generatePersonalizedMessages } from './capabilities/generate-personalized-messages.js';
import { recommendChannel } from './capabilities/recommend-channel.js';
import { estimateCampaignImpact } from './capabilities/estimate-impact.js';
import {
  analyzeCampaignPerformance,
  recommendNextAction,
} from './capabilities/analyze-performance.js';
import type {
  AnalyzeCampaignPerformanceInput,
  EstimateCampaignImpactInput,
  GenerateCampaignPlanInput,
  GeneratePersonalizedMessagesInput,
  ParseSegmentIntentInput,
  RecommendChannelInput,
  RecommendNextActionInput,
} from './inputs.js';

/**
 * The single entry point for all AI in the product. Each method returns a fully
 * structured, schema-validated AiResult envelope. Backends persist these as
 * AiAgentRun rows for auditability.
 */
export function createAiService(ctx: AiContext = resolveAiContext()) {
  return {
    context: ctx,
    parseSegmentIntent: (input: ParseSegmentIntentInput): Promise<AiResult<ParseSegmentIntentOutput>> =>
      runCapability(parseSegmentIntent, parseSegmentIntentOutput, input, ctx),
    generateCampaignPlan: (input: GenerateCampaignPlanInput): Promise<AiResult<CampaignPlanOutput>> =>
      runCapability(generateCampaignPlan, campaignPlanOutput, input, ctx),
    generatePersonalizedMessages: (
      input: GeneratePersonalizedMessagesInput,
    ): Promise<AiResult<PersonalizedMessagesOutput>> =>
      runCapability(generatePersonalizedMessages, personalizedMessagesOutput, input, ctx),
    recommendChannel: (input: RecommendChannelInput): Promise<AiResult<RecommendChannelOutput>> =>
      runCapability(recommendChannel, recommendChannelOutput, input, ctx),
    estimateCampaignImpact: (
      input: EstimateCampaignImpactInput,
    ): Promise<AiResult<EstimateImpactOutput>> =>
      runCapability(estimateCampaignImpact, estimateImpactOutput, input, ctx),
    analyzeCampaignPerformance: (
      input: AnalyzeCampaignPerformanceInput,
    ): Promise<AiResult<AnalyzePerformanceOutput>> =>
      runCapability(analyzeCampaignPerformance, analyzePerformanceOutput, input, ctx),
    recommendNextAction: (
      input: RecommendNextActionInput,
    ): Promise<AiResult<RecommendNextActionOutput>> =>
      runCapability(recommendNextAction, recommendNextActionOutput, input, ctx),
  };
}

export type AiService = ReturnType<typeof createAiService>;

export { resolveAiContext, runCapability } from './client.js';
export { renderTemplate } from './capabilities/generate-personalized-messages.js';
export * from './types.js';
export * from './inputs.js';
export * from './schemas.js';
