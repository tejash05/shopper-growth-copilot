import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Channel } from '@scp/shared';
import { buildAnalysisFromMetrics } from '../capabilities/analyze-performance.js';
import type { AnalyzeCampaignPerformanceInput } from '../inputs.js';

const SETTLED_INPUT: AnalyzeCampaignPerformanceInput = {
  campaignName: 'Sneaker Clearance Campaign',
  metrics: {
    audience: 120,
    controlGroup: 12,
    targeted: 88,
    queued: 0,
    sent: 88,
    delivered: 86,
    read: 60,
    clicked: 24,
    failed: 2,
    attributedOrders: 15,
    attributedRevenue: 73_700,
    deliveryRate: 86 / 88,
    clickRate: 24 / 86,
    conversionRate: 15 / 88,
    controlConversionRate: 0.025,
    liftVsControl: 0.42,
  },
  channelBreakdown: [
    { channel: Channel.WHATSAPP, sent: 53, clicked: 22, attributedRevenue: 58_000 },
    { channel: Channel.RCS, sent: 35, clicked: 4, attributedRevenue: 15_700 },
  ],
  variantBreakdown: [
    { label: 'A', channel: Channel.WHATSAPP, sent: 53, clicked: 22, conversionRate: 12 / 53 },
    { label: 'B', channel: Channel.RCS, sent: 35, clicked: 4, conversionRate: 3 / 35 },
  ],
};

describe('buildAnalysisFromMetrics', () => {
  it('reflects settled dashboard metrics in summary and bullets', () => {
    const result = buildAnalysisFromMetrics(SETTLED_INPUT);

    assert.match(result.summary, /15/);
    assert.match(result.summary, /73\.7K|73700|73,700/i);
    assert.match(result.summary, /24/);
    assert.match(result.summary, /41\.5%/);
    assert.doesNotMatch(result.summary, /₹0\b|0 orders|0\.0% conversion/i);

    const joined = [result.summary, ...result.whatWorked, ...result.whatDidNotWork].join(' ');
    assert.match(joined, /41\.5%/);
    assert.match(joined, /11\.4%/);
    assert.match(joined, /15/);
    assert.match(joined, /24/);
  });

  it('picks WhatsApp as best channel when CTR is higher', () => {
    const result = buildAnalysisFromMetrics(SETTLED_INPUT);
    assert.equal(result.bestChannel, Channel.WHATSAPP);
    assert.equal(result.bestVariant, 'A');
  });
});
