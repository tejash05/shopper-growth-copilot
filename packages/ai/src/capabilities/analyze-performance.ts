import { AiCapability, Channel, CHANNEL_LABELS, formatInrCompact, formatPercent } from '@scp/shared';
import type { Capability } from '../types.js';
import {
  analyzePerformanceOutput,
  recommendNextActionOutput,
  type AnalyzePerformanceOutput,
  type RecommendNextActionOutput,
} from '../schemas.js';
import type { AnalyzeCampaignPerformanceInput, RecommendNextActionInput } from '../inputs.js';

type ChannelWithRates = AnalyzeCampaignPerformanceInput['channelBreakdown'][number] & {
  clickRate: number;
};

function rankChannels(channelBreakdown: AnalyzeCampaignPerformanceInput['channelBreakdown']): ChannelWithRates[] {
  return [...channelBreakdown]
    .map((c) => ({ ...c, clickRate: c.sent ? c.clicked / c.sent : 0 }))
    .sort((a, b) => b.clickRate - a.clickRate);
}

/**
 * Deterministic performance narrative built only from settled metrics.
 * Used for mock mode and to overwrite OpenAI prose so numbers never contradict the dashboard.
 */
export function buildAnalysisFromMetrics(
  input: AnalyzeCampaignPerformanceInput,
): AnalyzePerformanceOutput {
  const { metrics, channelBreakdown, variantBreakdown, topAudience } = input;
  const channelsByClick = rankChannels(channelBreakdown);
  const best = channelsByClick[0];
  const worst = channelsByClick[channelsByClick.length - 1];
  const bestChannel = (best?.channel ?? Channel.WHATSAPP) as Channel;

  const bestVariant = [...variantBreakdown].sort((a, b) => b.conversionRate - a.conversionRate)[0];
  const bestAud = topAudience?.[0];

  const lift =
    best && worst && worst.clickRate > 0 ? (best.clickRate / worst.clickRate).toFixed(1) : '1.0';

  const channelCtrLines = channelsByClick
    .filter((c) => c.sent > 0)
    .map(
      (c) =>
        `${CHANNEL_LABELS[c.channel as Channel]} ${formatPercent(c.clickRate)} CTR (${c.clicked.toLocaleString('en-IN')}/${c.sent.toLocaleString('en-IN')} clicked/sent)`,
    );

  const summary =
    `${CHANNEL_LABELS[bestChannel]} led engagement at ${formatPercent(best?.clickRate ?? 0)} CTR` +
    (worst && worst.channel !== bestChannel
      ? ` — ${lift}x ${CHANNEL_LABELS[worst.channel as Channel]} (${formatPercent(worst.clickRate)} CTR).`
      : '.') +
    ` Simulated attribution: ${formatInrCompact(metrics.attributedRevenue)} revenue across ${metrics.attributedOrders.toLocaleString('en-IN')} orders` +
    ` (${formatPercent(metrics.conversionRate)} conversion, ${metrics.clicked.toLocaleString('en-IN')} clicks).` +
    (bestAud
      ? ` Top converting cell: ${bestAud.persona.replaceAll('_', ' ').toLowerCase()} shoppers in ${bestAud.city}.`
      : '') +
    (metrics.liftVsControl > 0
      ? ` Lift vs control: ${formatPercent(metrics.liftVsControl)}.`
      : '');

  return {
    summary,
    whatWorked: [
      `${metrics.clicked.toLocaleString('en-IN')} simulated clicks from ${metrics.sent.toLocaleString('en-IN')} sends (${formatPercent(metrics.clickRate)} click rate on delivered).`,
      ...channelCtrLines.map((line) => `${line}.`),
      bestVariant
        ? `Variant ${bestVariant.label} converted best at ${formatPercent(bestVariant.conversionRate)} (${bestVariant.clicked.toLocaleString('en-IN')} clicked, ${Math.round(bestVariant.conversionRate * bestVariant.sent)} attributed).`
        : 'Personalised messaging resonated with the targeted segment.',
      metrics.liftVsControl > 0
        ? `Positive incremental lift vs control (${formatPercent(metrics.liftVsControl)}) on ${formatInrCompact(metrics.attributedRevenue)} simulated revenue.`
        : `${formatInrCompact(metrics.attributedRevenue)} simulated attributed revenue across ${metrics.attributedOrders.toLocaleString('en-IN')} orders.`,
    ].slice(0, 4),
    whatDidNotWork: [
      worst && worst.channel !== bestChannel
        ? `${CHANNEL_LABELS[worst.channel as Channel]} lagged at ${formatPercent(worst.clickRate)} CTR (${worst.clicked.toLocaleString('en-IN')}/${worst.sent.toLocaleString('en-IN')} clicked/sent) — keep as fallback.`
        : 'Some delivered messages went unread — test send-time optimisation.',
      metrics.failed > 0
        ? `${metrics.failed.toLocaleString('en-IN')} simulated sends failed — review contact data quality.`
        : `${(metrics.clicked - metrics.attributedOrders).toLocaleString('en-IN')} clickers did not convert — a follow-up nudge could recover them.`,
    ],
    bestAudience: bestAud
      ? `${bestAud.persona.replaceAll('_', ' ')} in ${bestAud.city}`
      : 'Dormant high-value shoppers',
    bestChannel,
    bestVariant: bestVariant?.label ?? 'A',
  };
}

export const analyzeCampaignPerformance: Capability<
  AnalyzeCampaignPerformanceInput,
  AnalyzePerformanceOutput
> = {
  name: AiCapability.ANALYZE_CAMPAIGN_PERFORMANCE,
  schemaHint: analyzePerformanceOutput.toString(),
  buildPrompt: (input) =>
    [
      'Analyse the completed retail campaign and produce an executive performance summary.',
      `Campaign: ${input.campaignName}.`,
      `Metrics: ${JSON.stringify(input.metrics)}.`,
      `Channel breakdown: ${JSON.stringify(input.channelBreakdown)}.`,
      `Variant breakdown: ${JSON.stringify(input.variantBreakdown)}.`,
      'Return JSON: summary, whatWorked[], whatDidNotWork[], bestAudience, bestChannel, bestVariant.',
      'Use only the numeric values provided in metrics and breakdowns — do not invent counts or rates.',
    ].join('\n'),
  mock: (input) => {
    const result = buildAnalysisFromMetrics(input);
    return {
      result,
      explanation: result.summary,
      confidence: 0.81,
    };
  },
};

export const recommendNextAction: Capability<RecommendNextActionInput, RecommendNextActionOutput> = {
  name: AiCapability.RECOMMEND_NEXT_ACTION,
  schemaHint: recommendNextActionOutput.toString(),
  buildPrompt: (input) =>
    [
      'Given the campaign results, recommend the single highest-leverage next campaign.',
      `Campaign: ${input.campaignName}. Best channel: ${input.bestChannel}.`,
      `Metrics: ${JSON.stringify(input.metrics)}.`,
      'Return JSON: nextCampaignName, goal, targetAudience, recommendedChannel, recommendedOffer, rationale.',
    ].join('\n'),
  mock: (input) => {
    const clickedNonConverted = Math.max(0, input.metrics.clicked - input.metrics.attributedOrders);
    return {
      result: {
        nextCampaignName: 'Clicked-Not-Purchased Recovery',
        goal: `Convert ${clickedNonConverted.toLocaleString('en-IN')} shoppers who clicked but did not purchase, using a sharper category-specific offer.`,
        targetAudience: 'Shoppers who reached CLICKED but not ATTRIBUTED_ORDER in this campaign.',
        recommendedChannel: input.bestChannel,
        recommendedOffer: '10% category-specific offer with 48-hour urgency',
        rationale: `${clickedNonConverted.toLocaleString('en-IN')} simulated clickers did not convert; a tighter, time-boxed offer on ${CHANNEL_LABELS[input.bestChannel]} can recover a share without broad discounting.`,
      },
      explanation:
        'Follow up clicked-but-not-purchased shoppers on the best-performing channel with a 10% category offer.',
      confidence: 0.77,
    };
  },
};
