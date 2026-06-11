import { randomUUID } from 'node:crypto';
import { prisma, type Prisma } from '@scp/db';
import {
  CHANNEL_LIMITS,
  CampaignStatus,
  Channel,
  CommunicationStatus,
  DEFAULT_CONTROL_GROUP_RATIO,
  RECENT_CONTACT_WINDOW_DAYS,
  segmentRuleToPrismaWhere,
  type CreateCampaignInput,
  type SafetyCheckResult,
  type SegmentRule,
} from '@scp/shared';
import { renderTemplate } from '@scp/ai';
import { sendQueue } from '../lib/queue.js';

const consentField: Record<Channel, keyof Prisma.CustomerWhereInput> = {
  WHATSAPP: 'consentWhatsApp',
  SMS: 'consentSms',
  EMAIL: 'consentEmail',
  RCS: 'consentRcs',
};

/** Resolve the structured rule a campaign should target. */
async function resolveCampaignRule(campaign: {
  segmentId: string | null;
  segmentRuleSnapshot: Prisma.JsonValue | null;
}): Promise<SegmentRule> {
  if (campaign.segmentRuleSnapshot) return campaign.segmentRuleSnapshot as SegmentRule;
  if (campaign.segmentId) {
    const rule = await prisma.segmentRule.findFirst({
      where: { segmentId: campaign.segmentId },
      orderBy: { version: 'desc' },
    });
    if (rule) return rule.rule as SegmentRule;
  }
  return {};
}

export async function createCampaign(brandId: string, input: CreateCampaignInput) {
  const totalAllocation = input.variants.reduce((s, v) => s + v.allocation, 0);
  if (totalAllocation !== 100) {
    throw Object.assign(new Error('Variant allocations must sum to 100.'), { statusCode: 400 });
  }

  let segmentRuleSnapshot = input.segmentRule;
  if (!segmentRuleSnapshot && input.segmentId) {
    const segment = await prisma.segment.findFirst({
      where: { id: input.segmentId, brandId },
    });
    if (!segment) {
      throw Object.assign(new Error('Segment not found.'), { statusCode: 404 });
    }
    const latestRule = await prisma.segmentRule.findFirst({
      where: { segmentId: input.segmentId },
      orderBy: { version: 'desc' },
    });
    if (!latestRule) {
      throw Object.assign(new Error('Segment not found or has no rules.'), { statusCode: 400 });
    }
    segmentRuleSnapshot = latestRule.rule as SegmentRule;
  }
  if (!segmentRuleSnapshot) {
    throw Object.assign(new Error('Provide segmentRule or a valid segmentId.'), { statusCode: 400 });
  }

  return prisma.campaign.create({
    data: {
      brandId,
      name: input.name,
      goal: input.goal,
      status: CampaignStatus.DRAFT,
      segmentId: input.segmentId,
      segmentRuleSnapshot: segmentRuleSnapshot as Prisma.InputJsonValue,
      primaryChannel: input.primaryChannel,
      fallbackChannel: input.fallbackChannel,
      offerCode: input.offerCode,
      controlGroupRatio: input.controlGroupRatio,
      aiPlanRunId: input.aiPlanRunId,
      variants: {
        create: input.variants.map((v) => ({
          label: v.label,
          channel: v.channel,
          allocation: v.allocation,
          subject: v.subject,
          bodyTemplate: v.bodyTemplate,
          offerCode: v.offerCode,
        })),
      },
    },
    include: { variants: true },
  });
}

interface AudienceCustomer {
  id: string;
  name: string;
  city: string;
  favouriteCategory: Prisma.CustomerGetPayload<object>['favouriteCategory'];
  persona: Prisma.CustomerGetPayload<object>['persona'];
  phone: string;
  email: string;
  averageOrderValue: number;
  consentWhatsApp: boolean;
  consentSms: boolean;
  consentEmail: boolean;
  consentRcs: boolean;
}

async function resolveAudience(rule: SegmentRule, brandId: string): Promise<AudienceCustomer[]> {
  const where = { brandId, ...(segmentRuleToPrismaWhere(rule) as Prisma.CustomerWhereInput) };
  return prisma.customer.findMany({
    where,
    select: {
      id: true,
      name: true,
      city: true,
      favouriteCategory: true,
      persona: true,
      phone: true,
      email: true,
      averageOrderValue: true,
      consentWhatsApp: true,
      consentSms: true,
      consentEmail: true,
      consentRcs: true,
    },
  });
}

function hasConsent(c: AudienceCustomer, channel: Channel): boolean {
  switch (channel) {
    case Channel.WHATSAPP:
      return c.consentWhatsApp;
    case Channel.SMS:
      return c.consentSms;
    case Channel.EMAIL:
      return c.consentEmail;
    case Channel.RCS:
      return c.consentRcs;
  }
}

/**
 * Pre-launch safety panel. Computes the cleaned audience and the risks a
 * marketer must acknowledge before spending message budget.
 */
export async function runSafetyCheck(campaignId: string, brandId: string): Promise<SafetyCheckResult> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, brandId },
    include: { variants: true },
  });
  if (!campaign) {
    throw Object.assign(new Error('Campaign not found.'), { statusCode: 404 });
  }
  const rule = await resolveCampaignRule(campaign);
  const audience = await resolveAudience(rule, brandId);

  const audienceBefore = audience.length;
  const channels = new Set<Channel>(campaign.variants.map((v) => v.channel as Channel));
  if (campaign.fallbackChannel) channels.add(campaign.fallbackChannel as Channel);

  // Remove customers with no consent on ANY usable channel.
  let removedNoConsent = 0;
  const consented = audience.filter((c) => {
    const ok = [...channels].some((ch) => hasConsent(c, ch));
    if (!ok) removedNoConsent++;
    return ok;
  });

  // Recently messaged customers.
  const recentCutoff = new Date(Date.now() - RECENT_CONTACT_WINDOW_DAYS * 86_400_000);
  const recentlyMessaged = await prisma.communication.findMany({
    where: { customerId: { in: consented.map((c) => c.id) }, queuedAt: { gte: recentCutoff } },
    select: { customerId: true },
    distinct: ['customerId'],
  });
  const recentSet = new Set(recentlyMessaged.map((r) => r.customerId));
  const afterRecent = consented.filter((c) => !recentSet.has(c.id));
  const removedRecentlyMessaged = consented.length - afterRecent.length;

  // SMS length issues across variants.
  const smsLengthIssues = campaign.variants.filter(
    (v) => v.channel === Channel.SMS && (v.bodyTemplate?.length ?? 0) > (CHANNEL_LIMITS.SMS.maxLength ?? 160),
  ).length;

  const audienceAfter = afterRecent.length;
  const fatigueRisk = removedRecentlyMessaged / Math.max(1, consented.length) > 0.15 ? 'medium' : 'low';
  const discountAbuseRisk = campaign.offerCode ? 'medium' : 'low';

  return {
    audienceBefore,
    audienceAfter,
    removedNoConsent,
    removedDuplicates: 0, // audience is already unique by customer id
    removedRecentlyMessaged,
    smsLengthIssues,
    fatigueRisk,
    discountAbuseRisk,
    recommendedControlGroupSize: Math.round(audienceAfter * DEFAULT_CONTROL_GROUP_RATIO),
    warnings: [
      removedNoConsent > 0 ? `${removedNoConsent} shoppers removed for missing consent.` : '',
      removedRecentlyMessaged > 0
        ? `${removedRecentlyMessaged} shoppers skipped (messaged in last ${RECENT_CONTACT_WINDOW_DAYS} days).`
        : '',
      smsLengthIssues > 0 ? `${smsLengthIssues} SMS variant(s) exceed 160 characters.` : '',
    ].filter(Boolean),
  };
}

export async function launchCampaign(campaignId: string, brandId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, brandId },
    include: { variants: { orderBy: { label: 'asc' } } },
  });
  if (!campaign) {
    throw Object.assign(new Error('Campaign not found.'), { statusCode: 404 });
  }
  if (campaign.status !== CampaignStatus.DRAFT && campaign.status !== CampaignStatus.SCHEDULED) {
    throw Object.assign(new Error(`Campaign is already ${campaign.status}.`), { statusCode: 409 });
  }
  if (campaign.variants.length === 0) {
    throw Object.assign(new Error('Campaign has no variants.'), { statusCode: 400 });
  }

  const rule = await resolveCampaignRule(campaign);
  const audience = await resolveAudience(rule, brandId);

  // 1. Consent + recent-contact cleaning (same logic as safety check).
  const recentCutoff = new Date(Date.now() - RECENT_CONTACT_WINDOW_DAYS * 86_400_000);
  const recently = await prisma.communication.findMany({
    where: { customerId: { in: audience.map((c) => c.id) }, queuedAt: { gte: recentCutoff } },
    select: { customerId: true },
    distinct: ['customerId'],
  });
  const recentSet = new Set(recently.map((r) => r.customerId));

  const eligible = audience.filter((c) => {
    if (recentSet.has(c.id)) return false;
    const channelsForCustomer = campaign.variants.map((v) => v.channel as Channel);
    if (campaign.fallbackChannel) channelsForCustomer.push(campaign.fallbackChannel as Channel);
    return channelsForCustomer.some((ch) => hasConsent(c, ch));
  });

  // 2. Control group split (deterministic shuffle by id hash for reproducibility).
  const shuffled = [...eligible].sort((a, b) => a.id.localeCompare(b.id));
  const controlSize = Math.round(shuffled.length * campaign.controlGroupRatio);
  const controlGroup = shuffled.slice(0, controlSize);
  const targeted = shuffled.slice(controlSize);

  // 3. Allocate targeted customers across variants by allocation %.
  const offer = campaign.offerCode ?? 'COMEBACK15';
  const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { name: true } });
  const brandName = brand?.name ?? 'your brand';
  const communications: Prisma.CommunicationCreateManyInput[] = [];
  const events: Prisma.CommunicationEventCreateManyInput[] = [];
  const now = new Date();

  let cursor = 0;
  for (let i = 0; i < campaign.variants.length; i++) {
    const variant = campaign.variants[i]!;
    const isLast = i === campaign.variants.length - 1;
    const count = isLast
      ? targeted.length - cursor
      : Math.round((variant.allocation / 100) * targeted.length);
    const slice = targeted.slice(cursor, cursor + count);
    cursor += count;

    for (const customer of slice) {
      // Honour consent: use variant channel, else fallback, else skip.
      let channel = variant.channel as Channel;
      if (!hasConsent(customer, channel)) {
        if (campaign.fallbackChannel && hasConsent(customer, campaign.fallbackChannel as Channel)) {
          channel = campaign.fallbackChannel as Channel;
        } else {
          continue;
        }
      }
      const commId = randomUUID();
      const templateVars = {
        firstName: customer.name.split(' ')[0] ?? 'there',
        category: customer.favouriteCategory,
        offer: variant.offerCode ?? offer,
        city: customer.city,
        persona: customer.persona,
        brandName,
      };
      const body = renderTemplate(variant.bodyTemplate, templateVars);
      const renderedSubject = variant.subject ? renderTemplate(variant.subject, templateVars) : null;
      communications.push({
        id: commId,
        campaignId,
        variantId: variant.id,
        customerId: customer.id,
        channel,
        renderedSubject,
        renderedBody: body,
        recipient: channel === Channel.EMAIL ? customer.email : customer.phone,
        status: CommunicationStatus.QUEUED,
        isControlGroup: false,
        queuedAt: now,
      });
      events.push({
        communicationId: commId,
        eventType: CommunicationStatus.QUEUED,
        channel,
        occurredAt: now,
      });
    }
  }

  // 4. Control group: stored but never sent. Simulate organic baseline
  //    conversions (~2.5%) so lift-vs-control is measurable.
  const controlVariant = campaign.variants[0]!;
  const attributedOrders: Prisma.AttributedOrderCreateManyInput[] = [];
  controlGroup.forEach((customer, idx) => {
    const commId = randomUUID();
    const organic = idx % 40 === 0; // ~2.5% organic baseline
    const body = renderTemplate(controlVariant.bodyTemplate, {
      firstName: customer.name.split(' ')[0] ?? 'there',
      category: customer.favouriteCategory,
      offer,
      city: customer.city,
      persona: customer.persona,
      brandName,
    });
    communications.push({
      id: commId,
      campaignId,
      variantId: controlVariant.id,
      customerId: customer.id,
      channel: controlVariant.channel as Channel,
      renderedBody: body,
      recipient: customer.phone,
      status: organic ? CommunicationStatus.ATTRIBUTED_ORDER : CommunicationStatus.QUEUED,
      isControlGroup: true,
      queuedAt: now,
      attributedAt: organic ? now : null,
    });
    if (organic) {
      events.push({
        communicationId: commId,
        eventType: CommunicationStatus.ATTRIBUTED_ORDER,
        channel: controlVariant.channel as Channel,
        occurredAt: now,
      });
      attributedOrders.push({
        campaignId,
        communicationId: commId,
        customerId: customer.id,
        orderValue: Math.round(customer.averageOrderValue || 2000),
      });
    }
  });

  const targetedComms = communications.filter((c) => !c.isControlGroup);

  // 5. Persist everything, then enqueue targeted sends.
  await prisma.$transaction([
    prisma.communication.createMany({ data: communications }),
    prisma.communicationEvent.createMany({ data: events }),
    ...(attributedOrders.length
      ? [prisma.attributedOrder.createMany({ data: attributedOrders })]
      : []),
    prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: CampaignStatus.RUNNING,
        launchedAt: now,
        segmentRuleSnapshot: rule as Prisma.InputJsonValue,
        audienceSize: eligible.length,
        controlGroupSize: controlGroup.length,
        targetedSize: targetedComms.length,
      },
    }),
  ]);

  // Enqueue one send job per targeted communication.
  await sendQueue.addBulk(
    targetedComms.map((c) => ({
      name: 'send',
      data: { communicationId: c.id! },
    })),
  );

  return {
    campaignId,
    audienceSize: eligible.length,
    controlGroupSize: controlGroup.length,
    targetedSize: targetedComms.length,
    queued: targetedComms.length,
  };
}

export async function listCampaigns(brandId: string) {
  return prisma.campaign.findMany({
    where: { brandId },
    orderBy: { createdAt: 'desc' },
    include: { variants: true, _count: { select: { communications: true } } },
  });
}

export async function getCampaign(id: string, brandId: string) {
  return prisma.campaign.findFirst({
    where: { id, brandId },
    include: { variants: true, segment: true },
  });
}
