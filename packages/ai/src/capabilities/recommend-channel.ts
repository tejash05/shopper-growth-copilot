import { AiCapability, Channel, CHANNEL_LABELS } from '@scp/shared';
import type { Capability } from '../types.js';
import { recommendChannelOutput, type RecommendChannelOutput } from '../schemas.js';
import type { RecommendChannelInput } from '../inputs.js';

/** Base effectiveness priors per channel for retail marketing (engagement-weighted). */
const CHANNEL_PRIOR: Record<Channel, number> = {
  WHATSAPP: 1.0,
  RCS: 0.85,
  EMAIL: 0.6,
  SMS: 0.7,
};

export const recommendChannel: Capability<RecommendChannelInput, RecommendChannelOutput> = {
  name: AiCapability.RECOMMEND_CHANNEL,
  schemaHint: recommendChannelOutput.toString(),
  buildPrompt: (input) =>
    [
      'Recommend the best primary + fallback channel for a retail campaign.',
      `Audience preferred-channel distribution: ${JSON.stringify(input.channelMix)}.`,
      input.goal ? `Goal: ${input.goal}` : '',
      'Weigh audience preference against channel engagement priors. Return JSON.',
    ].join('\n'),
  mock: (input) => {
    const total = input.channelMix.reduce((s, c) => s + c.count, 0) || 1;
    const scores = (Object.keys(CHANNEL_PRIOR) as Channel[]).map((channel) => {
      const pref = (input.channelMix.find((c) => c.channel === channel)?.count ?? 0) / total;
      // 60% audience preference, 40% engagement prior.
      const score = Number((pref * 0.6 + CHANNEL_PRIOR[channel] * 0.4).toFixed(3));
      return { channel, score };
    });
    scores.sort((a, b) => b.score - a.score);
    const primary = scores[0]!.channel;
    const fallback = scores[1]!.channel;
    return {
      result: {
        primaryChannel: primary,
        fallbackChannel: fallback,
        reasoning: `${CHANNEL_LABELS[primary]} blends the strongest audience preference with high engagement; ${CHANNEL_LABELS[fallback]} covers shoppers who don't engage on ${CHANNEL_LABELS[primary]}.`,
        channelScores: scores,
      },
      explanation: `Primary ${CHANNEL_LABELS[primary]}, fallback ${CHANNEL_LABELS[fallback]} based on preference + engagement priors.`,
      confidence: 0.78,
    };
  },
};
