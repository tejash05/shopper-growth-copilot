import { ChurnRisk } from '../constants/enums.js';

export interface RfmInput {
  /** Days since the customer's last purchase. */
  recencyDays: number;
  /** Lifetime order count. */
  frequency: number;
  /** Lifetime spend in INR. */
  monetary: number;
}

export interface RfmScore {
  recency: number; // 1..5 (5 = most recent)
  frequency: number; // 1..5
  monetary: number; // 1..5
  /** Concatenated cell e.g. "543". */
  cell: string;
  /** 3..15 composite. */
  total: number;
}

/**
 * Lightweight quintile-style RFM scoring with fixed, retail-tuned breakpoints.
 * We use fixed breakpoints (rather than dataset quintiles) so a single customer
 * can be scored in isolation — important for real-time recompute on new orders.
 */
export function computeRfm({ recencyDays, frequency, monetary }: RfmInput): RfmScore {
  const recency = scoreRecency(recencyDays);
  const freq = scoreFrequency(frequency);
  const mon = scoreMonetary(monetary);
  return {
    recency,
    frequency: freq,
    monetary: mon,
    cell: `${recency}${freq}${mon}`,
    total: recency + freq + mon,
  };
}

function scoreRecency(days: number): number {
  if (days <= 30) return 5;
  if (days <= 60) return 4;
  if (days <= 120) return 3;
  if (days <= 240) return 2;
  return 1;
}

function scoreFrequency(count: number): number {
  if (count >= 12) return 5;
  if (count >= 7) return 4;
  if (count >= 4) return 3;
  if (count >= 2) return 2;
  return 1;
}

function scoreMonetary(spend: number): number {
  if (spend >= 50000) return 5;
  if (spend >= 25000) return 4;
  if (spend >= 10000) return 3;
  if (spend >= 3000) return 2;
  return 1;
}

/**
 * Churn risk derived from recency + engagement. A high-frequency customer who
 * has gone quiet is riskier (more to lose) than a one-time buyer going quiet.
 */
export function computeChurnRisk(input: RfmInput, rfm: RfmScore): ChurnRisk {
  const { recencyDays } = input;
  if (recencyDays >= 90 && rfm.frequency >= 3) return ChurnRisk.HIGH;
  if (recencyDays >= 90) return ChurnRisk.MEDIUM;
  if (recencyDays >= 45 && rfm.frequency >= 3) return ChurnRisk.MEDIUM;
  if (recencyDays >= 60) return ChurnRisk.MEDIUM;
  return ChurnRisk.LOW;
}

/**
 * Predicted lifetime value. Blends realised spend with a forward projection
 * based on order cadence and a survival factor that decays with churn risk.
 */
export function estimateLifetimeValue(params: {
  totalSpend: number;
  averageOrderValue: number;
  orderCount: number;
  churnRisk: ChurnRisk;
}): number {
  const { totalSpend, averageOrderValue, orderCount, churnRisk } = params;
  const survival = churnRisk === ChurnRisk.HIGH ? 0.4 : churnRisk === ChurnRisk.MEDIUM ? 0.8 : 1.4;
  const cadenceFactor = Math.min(orderCount, 12) / 6; // more orders => stickier
  const projected = averageOrderValue * cadenceFactor * survival;
  return Math.round(totalSpend + projected);
}
