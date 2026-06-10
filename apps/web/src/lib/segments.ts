import {
  CHANNEL_LABELS,
  PERSONA_LABELS,
  formatInrCompact,
  type SegmentRule,
} from '@scp/shared';
import type { SegmentSummary } from '@/lib/types';

/** Latest structured rule from a saved segment (rules are versioned, newest first). */
export function getLatestSegmentRule(segment: SegmentSummary): SegmentRule {
  return segment.rules[0]?.rule ?? {};
}

/** Human-readable bullet lines for segment cards — not raw JSON. */
export function formatSegmentRuleReadable(rule: SegmentRule): string[] {
  const lines: string[] = [];
  if (rule.city) lines.push(`City: ${rule.city}`);
  if (rule.gender) lines.push(`Gender: ${rule.gender[0] + rule.gender.slice(1).toLowerCase()}`);
  if (rule.loyaltyTier?.length) {
    lines.push(`Loyalty tier: ${rule.loyaltyTier.map((t) => t[0] + t.slice(1).toLowerCase()).join(', ')}`);
  }
  if (rule.churnRisk?.length) {
    lines.push(`Churn risk: ${rule.churnRisk.map((r) => r[0] + r.slice(1).toLowerCase()).join(', ')}`);
  }
  if (rule.persona?.length) {
    lines.push(`Persona: ${rule.persona.map((p) => PERSONA_LABELS[p]).join(', ')}`);
  }
  if (rule.favouriteCategory?.length) {
    lines.push(
      `Favourite category: ${rule.favouriteCategory.map((c) => c[0] + c.slice(1).toLowerCase()).join(', ')}`,
    );
  }
  if (rule.preferredChannel?.length) {
    lines.push(`Preferred channel: ${rule.preferredChannel.map((c) => CHANNEL_LABELS[c]).join(', ')}`);
  }
  if (rule.totalSpend?.gte !== undefined) {
    lines.push(`Total spend ≥ ₹${rule.totalSpend.gte.toLocaleString('en-IN')}`);
  }
  if (rule.totalSpend?.lte !== undefined) {
    lines.push(`Total spend ≤ ₹${rule.totalSpend.lte.toLocaleString('en-IN')}`);
  }
  if (rule.orderCount?.gte !== undefined) lines.push(`Order count ≥ ${rule.orderCount.gte}`);
  if (rule.averageOrderValue?.gte !== undefined) {
    lines.push(`AOV ≥ ₹${rule.averageOrderValue.gte.toLocaleString('en-IN')}`);
  }
  if (rule.rfmTotal?.gte !== undefined) lines.push(`RFM score ≥ ${rule.rfmTotal.gte}`);
  if (rule.lastPurchaseDays?.gte !== undefined || rule.lastPurchaseDays?.lte !== undefined) {
    const parts: string[] = [];
    if (rule.lastPurchaseDays.gte !== undefined) parts.push(`inactive ≥ ${rule.lastPurchaseDays.gte} days`);
    if (rule.lastPurchaseDays.lte !== undefined) parts.push(`active within ${rule.lastPurchaseDays.lte} days`);
    lines.push(`Last purchase: ${parts.join(', ')}`);
  }
  if (rule.consentRequired) lines.push('Messaging consent required');
  if (lines.length === 0) lines.push('All shoppers (no filters applied)');
  return lines;
}

/** One-line label for dropdown options: name · audience · revenue · rule hint. */
export function formatSegmentOptionLabel(segment: SegmentSummary): string {
  const parts = [segment.name];
  if (segment.cachedAudienceSize != null) {
    parts.push(`${segment.cachedAudienceSize.toLocaleString('en-IN')} shoppers`);
  }
  if (segment.cachedRevenuePotential != null) {
    parts.push(`${formatInrCompact(segment.cachedRevenuePotential)} potential`);
  }
  const ruleHint = formatSegmentRuleShortSummary(getLatestSegmentRule(segment));
  if (ruleHint) parts.push(ruleHint);
  return parts.join(' · ');
}

/** Compact rule summary for dropdowns and preview headers. */
export function formatSegmentRuleShortSummary(rule: SegmentRule, maxLength = 48): string {
  const lines = formatSegmentRuleReadable(rule);
  const summary = lines.slice(0, 2).join('; ');
  if (summary.length <= maxLength) return summary;
  return `${summary.slice(0, maxLength - 1)}…`;
}

export function findSegmentById(segments: SegmentSummary[], id: string): SegmentSummary | undefined {
  return segments.find((s) => s.id === id);
}

export const SEGMENTS_QUERY_KEY = ['segments'] as const;
