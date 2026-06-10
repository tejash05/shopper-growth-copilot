import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateCampaignPlan } from '../capabilities/generate-campaign-plan.js';
import {
  buildClearanceSegmentName,
  generateOfferCode,
  parseGoalConstraints,
  parseMinimumDiscountFromGoal,
  parsePriceRangeFromGoal,
  resolveDiscountPercent,
  validateAndBumpDiscount,
} from './goal-constraints.js';

const DEMO_GOAL =
  'I want to clear the stock of sneakers which cost around 2000 to 5000 rs and offer should be more than 15%';

describe('goal-constraints', () => {
  it('parses clearance intent, sneaker category, price band, and exclusive min discount', () => {
    const parsed = parseGoalConstraints(DEMO_GOAL);
    assert.equal(parsed.campaignType, 'clearance');
    assert.ok(parsed.categories.includes('SNEAKERS'));
    assert.deepEqual(parsed.priceRange, { gte: 2000, lte: 5000 });
    assert.deepEqual(parsed.minDiscount, { min: 15, exclusive: true });
  });

  it('bumps discount above an exclusive minimum', () => {
    assert.equal(validateAndBumpDiscount(15, { min: 15, exclusive: true }), 20);
    assert.equal(resolveDiscountPercent(DEMO_GOAL, 15), 20);
  });

  it('builds a clearance-specific segment name and offer code', () => {
    const priceRange = parsePriceRangeFromGoal(DEMO_GOAL);
    assert.ok(priceRange);
    const name = buildClearanceSegmentName(['SNEAKERS'], priceRange);
    assert.match(name, /Sneaker Clearance/i);
    assert.match(name, /Deal Seekers/i);
    assert.match(name, /₹2k–₹5k/);
    assert.equal(generateOfferCode(['SNEAKERS'], 20, 'clearance'), 'SNEAKER20');
  });

  it('parses minimum discount helper independently', () => {
    assert.deepEqual(parseMinimumDiscountFromGoal('offer should be more than 15%'), {
      min: 15,
      exclusive: true,
    });
  });
});

describe('generateCampaignPlan mock — sneaker clearance demo', () => {
  const plan = generateCampaignPlan.mock({ goal: DEMO_GOAL });

  it('does not return Custom Segment or win-back defaults', () => {
    assert.notEqual(plan.result.recommendedSegmentName, 'Custom Segment');
    assert.match(plan.result.recommendedSegmentName, /Sneaker Clearance/i);
    assert.notEqual(plan.result.offerRecommendation.code, 'COMEBACK15');
    assert.equal(plan.result.offerRecommendation.code, 'SNEAKER20');
  });

  it('recommends 20% or more, not 15%', () => {
    const discount = Number(plan.result.offerRecommendation.value.replace('%', ''));
    assert.ok(discount >= 20);
    assert.notEqual(discount, 15);
  });

  it('uses clearance reasoning and segment filters', () => {
    assert.match(plan.result.businessReason.toLowerCase(), /clear|stock|sneaker/);
    assert.doesNotMatch(plan.result.businessReason.toLowerCase(), /win-back/);
    assert.deepEqual(plan.result.segmentRule.averageOrderValue, { gte: 2000, lte: 5000 });
    assert.ok(plan.result.segmentRule.favouriteCategory?.includes('SNEAKERS'));
  });
});
