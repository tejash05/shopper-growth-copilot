import { Channel } from '@scp/shared';
import type { CampaignPlanResponse } from '@/lib/types';

export function parseDiscountPercent(value: string | undefined, fallback = 15): number {
  if (!value) return fallback;
  const match = value.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : fallback;
}

export function buildMessageTemplate(channel: Channel, discountPercent = 15): string {
  const templates: Record<Channel, string> = {
    WHATSAPP: `Hey {{firstName}}! Your favourite {{category}} picks are waiting at {{brandName}}. Use {{offer}} this weekend. Tap to explore 👉`,
    SMS: `{{firstName}}, your {{category}} favourites are back at {{brandName}}. Use {{offer}}.`,
    EMAIL: `Hi {{firstName}},\n\nYour favourite {{category}} styles are back in stock at {{brandName}}. Here's ${discountPercent}% off with {{offer}}.\n\nExplore your edit.`,
    RCS: `{{firstName}}, your {{category}} favourites are back at {{brandName}} ✨ Use {{offer}}.\n[ Shop now ]`,
  };
  return templates[channel];
}

export function defaultEmailSubject(): string {
  return 'Your {{brandName}} favourites are back';
}

export function createDefaultVariants(): {
  label: string;
  channel: Channel;
  allocation: number;
  bodyTemplate: string;
}[] {
  return [
    {
      label: 'A',
      channel: Channel.WHATSAPP,
      allocation: 60,
      bodyTemplate: buildMessageTemplate(Channel.WHATSAPP, 15),
    },
    {
      label: 'B',
      channel: Channel.SMS,
      allocation: 40,
      bodyTemplate: buildMessageTemplate(Channel.SMS, 15),
    },
  ];
}

export function variantBodyFromPlan(channel: Channel, plan: CampaignPlanResponse): string {
  const discountPercent = parseDiscountPercent(plan.plan.result.offerRecommendation.value);
  const sample = plan.plan.result.sampleMessages.find((m) => m.channel === channel);
  return sample?.text ?? buildMessageTemplate(channel, discountPercent);
}

export function buildSavedSegmentGoal(
  segmentName: string,
  brandName: string,
  userGoal: string | undefined,
): string {
  const trimmed = userGoal?.trim();
  if (trimmed) return trimmed;
  return `Create a personalised campaign for ${segmentName} in ${brandName} to drive repeat purchases.`;
}
