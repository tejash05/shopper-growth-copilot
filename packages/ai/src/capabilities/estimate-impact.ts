import { AiCapability, Channel } from '@scp/shared';
import type { Capability } from '../types.js';
import { estimateImpactOutput, type EstimateImpactOutput } from '../schemas.js';
import type { EstimateCampaignImpactInput } from '../inputs.js';

/** Funnel rate priors per channel: delivery, read, click, conversion. */
const FUNNEL_PRIORS: Record<Channel, [number, number, number, number]> = {
  WHATSAPP: [0.96, 0.72, 0.2, 0.07],
  RCS: [0.93, 0.66, 0.18, 0.06],
  SMS: [0.98, 0.55, 0.11, 0.04],
  EMAIL: [0.9, 0.38, 0.08, 0.03],
};

export const estimateCampaignImpact: Capability<EstimateCampaignImpactInput, EstimateImpactOutput> = {
  name: AiCapability.ESTIMATE_CAMPAIGN_IMPACT,
  schemaHint: estimateImpactOutput.toString(),
  buildPrompt: (input) =>
    [
      'Estimate the expected funnel performance and revenue for a retail campaign.',
      `Audience: ${input.audienceSize}. Channel: ${input.channel}. AOV: ₹${input.averageOrderValue}. Has offer: ${input.hasOffer}.`,
      'Return JSON with delivery/read/click/conversion rates, estimated revenue, and assumptions.',
    ].join('\n'),
  mock: (input) => {
    const [delivery, read, click, baseConv] = FUNNEL_PRIORS[input.channel];
    // An offer lifts conversion ~25%.
    const conversion = Number((baseConv * (input.hasOffer ? 1.25 : 1)).toFixed(3));
    const estimatedRevenue = Math.round(
      input.audienceSize * delivery * conversion * input.averageOrderValue,
    );
    return {
      result: {
        estimatedDeliveryRate: delivery,
        estimatedReadRate: read,
        estimatedClickRate: click,
        estimatedConversionRate: conversion,
        estimatedRevenue,
        assumptions: [
          `${input.channel} funnel priors applied to ${input.audienceSize} targeted shoppers.`,
          input.hasOffer ? 'Offer applies a 25% conversion uplift.' : 'No offer uplift modelled.',
          'Estimate excludes the holdout control group.',
        ],
      },
      explanation: `Projects ~₹${estimatedRevenue.toLocaleString('en-IN')} from ${input.audienceSize} ${input.channel} sends.`,
      confidence: 0.74,
    };
  },
};
