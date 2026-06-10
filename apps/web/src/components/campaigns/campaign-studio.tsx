'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  MessageSquare,
  Rocket,
  Send,
  Shield,
  Sparkles,
  Target,
} from 'lucide-react';
import {
  CHANNELS,
  CHANNEL_LABELS,
  Channel,
  formatInrCompact,
  formatPercent,
  type SafetyCheckResult,
  type SegmentRule,
} from '@scp/shared';
import { apiFetch, ApiError } from '@/lib/api';
import type { CampaignPlanResponse, GenerateMessagesResponse } from '@/lib/types';
import { useCampaignAudience } from '@/hooks/use-campaign-audience';
import { SegmentSourcePanel } from '@/components/campaigns/segment-source-panel';
import { readPrefilledGoal, studioPathWithout } from '@/lib/studio-navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label, ProgressBar, Separator, Spinner } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { ChannelBadge } from '@/components/shared/labels';

const DEFAULT_GOAL =
  'Win back high-value shoppers who haven’t purchased in 45 days and promote the summer collection.';

function parseDiscountPercent(value: string | undefined, fallback = 15): number {
  if (!value) return fallback;
  const match = value.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : fallback;
}

function buildMessageTemplate(channel: Channel, discountPercent: number): string {
  const templates: Record<Channel, string> = {
    WHATSAPP: `Hey {{firstName}}! Your favourite {{category}} picks are back at NovaWear. Enjoy ${discountPercent}% off this weekend with {{offer}}. Tap to explore 👉`,
    SMS: `{{firstName}}, your {{category}} favourites are back. ${discountPercent}% off with {{offer}}. Shop now.`,
    EMAIL: `Hi {{firstName}},\n\nYour favourite {{category}} styles are back in stock. Here’s ${discountPercent}% off with {{offer}}.\n\nExplore your edit.\n— NovaWear`,
    RCS: `{{firstName}}, your {{category}} favourites are back ✨ ${discountPercent}% off with {{offer}}.\n[ Shop now ]`,
  };
  return templates[channel];
}

function variantBodyFromPlan(channel: Channel, plan: CampaignPlanResponse): string {
  const discountPercent = parseDiscountPercent(plan.plan.result.offerRecommendation.value);
  const sample = plan.plan.result.sampleMessages.find((m) => m.channel === channel);
  return sample?.text ?? buildMessageTemplate(channel, discountPercent);
}

interface VariantState {
  label: string;
  channel: Channel;
  allocation: number;
  subject?: string;
  bodyTemplate: string;
}

export function CampaignStudio() {
  return (
    <Suspense fallback={<CampaignStudioSkeleton />}>
      <CampaignStudioInner />
    </Suspense>
  );
}

function CampaignStudioInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSegmentId = searchParams.get('segmentId');
  const [goal, setGoal] = React.useState(
    () => readPrefilledGoal(searchParams.get('goal')) ?? DEFAULT_GOAL,
  );
  const [plan, setPlan] = React.useState<CampaignPlanResponse | null>(null);

  const [name, setName] = React.useState('');
  const [offerCode, setOfferCode] = React.useState('COMEBACK15');
  const [fallback, setFallback] = React.useState<Channel | ''>(Channel.SMS);
  const [controlRatio, setControlRatio] = React.useState(0.1);
  const [variants, setVariants] = React.useState<VariantState[]>([
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
  ]);
  const [messages, setMessages] = React.useState<GenerateMessagesResponse | null>(null);
  const [campaignId, setCampaignId] = React.useState<string | null>(null);
  const [safety, setSafety] = React.useState<SafetyCheckResult | null>(null);
  const preloadedName = React.useRef(false);

  const audience = useCampaignAudience({ initialSegmentId, plan });

  React.useEffect(() => {
    if (audience.selectedSegment && audience.source === 'saved' && !preloadedName.current) {
      setName(`${audience.selectedSegment.name} Campaign`);
      preloadedName.current = true;
    }
  }, [audience.selectedSegment, audience.source]);

  const rule = audience.activeRule;
  const readyToConfigure =
    Boolean(rule) &&
    (audience.source === 'saved' ? Boolean(audience.selectedSegment) : Boolean(plan));

  const planMutation = useMutation({
    mutationFn: () =>
      apiFetch<CampaignPlanResponse>('/api/ai/campaign-plan', {
        method: 'POST',
        body: JSON.stringify({ goal }),
      }),
    onSuccess: (res) => {
      setPlan(res);
      setName(res.plan.result.recommendedSegmentName + ' Campaign');
      setOfferCode(res.plan.result.offerRecommendation.code);
      const primary = res.channel.result.primaryChannel;
      const fb = res.channel.result.fallbackChannel ?? Channel.SMS;
      setFallback(fb);
      setVariants([
        { label: 'A', channel: primary, allocation: 60, bodyTemplate: variantBodyFromPlan(primary, res) },
        { label: 'B', channel: fb, allocation: 40, bodyTemplate: variantBodyFromPlan(fb, res) },
      ]);
    },
  });

  const messagesMutation = useMutation({
    mutationFn: () =>
      apiFetch<GenerateMessagesResponse>('/api/ai/generate-messages', {
        method: 'POST',
        body: JSON.stringify({
          rule,
          channel: variants[0]!.channel,
          offerCode,
          discountPercent: plan
            ? parseDiscountPercent(plan.plan.result.offerRecommendation.value)
            : 15,
          goal,
          sampleSize: 6,
        }),
      }),
    onSuccess: (res) => setMessages(res),
  });

  const launchMutation = useMutation({
    mutationFn: async () => {
      const created = await apiFetch<{ id: string }>('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name,
          goal,
          ...(audience.source === 'saved' && audience.selectedSegmentId
            ? { segmentId: audience.selectedSegmentId }
            : {}),
          segmentRule: rule,
          primaryChannel: variants[0]!.channel,
          fallbackChannel: fallback || undefined,
          offerCode,
          controlGroupRatio: controlRatio,
          variants: variants.map((v) => ({
            label: v.label,
            channel: v.channel,
            allocation: v.allocation,
            subject: v.channel === Channel.EMAIL ? (v.subject ?? 'Your NovaWear favourites are back') : undefined,
            bodyTemplate: v.bodyTemplate,
          })),
        }),
      });
      setCampaignId(created.id);
      const check = await apiFetch<SafetyCheckResult>(`/api/campaigns/${created.id}/safety-check`);
      setSafety(check);
      return created.id;
    },
  });

  const finalLaunch = useMutation({
    mutationFn: () => {
      if (!campaignId) throw new Error('Run the safety check first to create the campaign draft.');
      return apiFetch(`/api/campaigns/${campaignId}/launch`, { method: 'POST' });
    },
    onSuccess: () => router.push(`/campaigns/${campaignId}`),
  });

  const allocationTotal = variants.reduce((s, v) => s + v.allocation, 0);
  const updateVariant = (i: number, patch: Partial<VariantState>) =>
    setVariants((vs) => vs.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));

  const clearSegmentFromUrl = () => {
    audience.clearSegmentSelection();
    router.replace(studioPathWithout(searchParams, ['segmentId']));
  };

  return (
    <div className="space-y-6">
      {/* Step 1: goal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="size-4 text-primary" />
            What’s your business goal?
          </CardTitle>
          <CardDescription>
            Describe the outcome you want. The AI agent designs the segment, channel mix, offer, and messages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} className="resize-none" />
          <Button onClick={() => planMutation.mutate()} disabled={planMutation.isPending}>
            {planMutation.isPending ? <Spinner /> : <Sparkles className="size-4" />}
            Generate campaign plan
          </Button>
        </CardContent>
      </Card>

      <SegmentSourcePanel
        source={audience.source}
        onSourceChange={audience.setSource}
        segments={audience.segments}
        segmentsLoading={audience.segmentsLoading}
        segmentsError={audience.segmentsError}
        selectedSegmentId={audience.selectedSegmentId}
        onSelectSegment={(id) => {
          const segment = audience.segments.find((s) => s.id === id);
          audience.selectSegment(segment ?? null);
        }}
        selectedSegment={audience.selectedSegment}
        segmentNotFound={audience.segmentNotFound}
        onClearSegment={clearSegmentFromUrl}
        aiSegmentName={plan?.plan.result.recommendedSegmentName}
        aiExplanation={plan?.plan.result.businessReason}
        onRetryLoad={() => void audience.refetchSegments()}
      />

      {planMutation.isError && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-5 text-sm text-destructive">
            Couldn’t generate a plan. Ensure the CRM API is running and seeded.
          </CardContent>
        </Card>
      )}

      {plan && audience.source === 'ai' && (
        <>
          {/* Step 2: AI plan */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  AI campaign plan
                  <Badge variant="muted" className="ml-1 font-normal">
                    {plan.plan.provider} · {(plan.plan.confidence * 100).toFixed(0)}% confidence
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Recommended segment</Label>
                  <p className="text-sm font-medium">{plan.plan.result.recommendedSegmentName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Why this audience</Label>
                  <p className="text-sm leading-relaxed">{plan.plan.result.businessReason}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Offer recommendation</Label>
                  <p className="text-sm">
                    <Badge variant="primary" className="mr-2">{plan.plan.result.offerRecommendation.code}</Badge>
                    {plan.plan.result.offerRecommendation.rationale}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Message strategy</Label>
                  <p className="text-sm leading-relaxed">{plan.plan.result.messageStrategy}</p>
                </div>
                <Separator />
                <div>
                  <Label className="mb-2 block text-muted-foreground">Risks & guardrails</Label>
                  <ul className="space-y-1.5">
                    {plan.plan.result.risks.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Audience & impact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Metric label="Audience size" value={plan.preview.audienceSize.toLocaleString('en-IN')} />
                  <Metric label="Recommended channel" value={CHANNEL_LABELS[plan.channel.result.primaryChannel]} />
                  <Metric
                    label="Est. conversion rate"
                    value={formatPercent(plan.impact.result.estimatedConversionRate)}
                  />
                  <Metric label="Est. revenue" value={formatInrCompact(plan.impact.result.estimatedRevenue)} accent />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Channel scores</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {plan.channel.result.channelScores.map((c) => (
                    <div key={c.channel} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span>{CHANNEL_LABELS[c.channel]}</span>
                        <span className="tabular-nums text-muted-foreground">{(c.score * 100).toFixed(0)}</span>
                      </div>
                      <ProgressBar value={c.score} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {readyToConfigure && (
        <>
          {/* Step 3: configure variants */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="size-4 text-primary" />
                Channels & A/B variants
              </CardTitle>
              <CardDescription>
                Personalisation tokens: <code className="rounded bg-muted px-1">{'{{firstName}}'}</code>{' '}
                <code className="rounded bg-muted px-1">{'{{category}}'}</code>{' '}
                <code className="rounded bg-muted px-1">{'{{offer}}'}</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Campaign name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Offer code</Label>
                  <Input value={offerCode} onChange={(e) => setOfferCode(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Fallback channel</Label>
                  <Select value={fallback} onChange={(e) => setFallback(e.target.value as Channel | '')}>
                    <option value="">None</option>
                    {CHANNELS.map((c) => (
                      <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {variants.map((v, i) => (
                  <div key={v.label} className="rounded-lg border border-border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="primary">Variant {v.label}</Badge>
                        <ChannelBadge channel={v.channel} />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{v.allocation}%</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          value={v.channel}
                          onChange={(e) => {
                            const ch = e.target.value as Channel;
                            const bodyTemplate = plan
                              ? variantBodyFromPlan(ch, plan)
                              : buildMessageTemplate(ch, 15);
                            updateVariant(i, { channel: ch, bodyTemplate });
                          }}
                        >
                          {CHANNELS.map((c) => (
                            <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
                          ))}
                        </Select>
                        <Input
                          type="number"
                          value={v.allocation}
                          onChange={(e) => updateVariant(i, { allocation: Number(e.target.value) })}
                        />
                      </div>
                      <Textarea
                        rows={3}
                        value={v.bodyTemplate}
                        onChange={(e) => updateVariant(i, { bodyTemplate: e.target.value })}
                        className="resize-none text-xs"
                      />
                      {v.channel === Channel.SMS && v.bodyTemplate.length > 160 && (
                        <p className="text-xs text-destructive">SMS exceeds 160 characters ({v.bodyTemplate.length}).</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">Control group</span>
                  <Select
                    value={String(controlRatio)}
                    onChange={(e) => setControlRatio(Number(e.target.value))}
                    className="w-24"
                  >
                    <option value="0">0%</option>
                    <option value="0.05">5%</option>
                    <option value="0.1">10%</option>
                    <option value="0.15">15%</option>
                  </Select>
                  {allocationTotal !== 100 && (
                    <span className="text-xs text-destructive">Allocations must sum to 100 (now {allocationTotal}).</span>
                  )}
                </div>
                <Button variant="outline" onClick={() => messagesMutation.mutate()} disabled={messagesMutation.isPending}>
                  {messagesMutation.isPending ? <Spinner /> : <Send className="size-4" />}
                  Preview personalised messages
                </Button>
              </div>

              {messages && (
                <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    Personalised previews (each shopper gets a unique message)
                  </p>
                  {messages.result.messages.map((m, i) => (
                    <div key={i} className="rounded-md border border-border bg-card p-3 text-sm">
                      <div className="mb-1 flex items-center gap-2">
                        <ChannelBadge channel={m.channel} />
                        {m.subject && <span className="text-xs font-medium">{m.subject}</span>}
                      </div>
                      <p className="whitespace-pre-wrap text-muted-foreground">{m.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 4: safety + launch */}
          {!safety ? (
            <div className="flex justify-end">
              <Button
                size="lg"
                onClick={() => launchMutation.mutate()}
                disabled={launchMutation.isPending || allocationTotal !== 100 || !name}
              >
                {launchMutation.isPending ? <Spinner /> : <Shield className="size-4" />}
                Run safety check
                <ArrowRight className="size-4" />
              </Button>
            </div>
          ) : (
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-4 text-primary" />
                  Pre-launch safety panel
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <SafetyStat label="Audience (clean)" value={safety.audienceAfter.toLocaleString('en-IN')} sub={`from ${safety.audienceBefore.toLocaleString('en-IN')}`} />
                  <SafetyStat label="No consent removed" value={String(safety.removedNoConsent)} />
                  <SafetyStat label="Recently messaged" value={String(safety.removedRecentlyMessaged)} />
                  <SafetyStat label="SMS length issues" value={String(safety.smsLengthIssues)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={safety.fatigueRisk === 'low' ? 'success' : 'warning'}>Fatigue: {safety.fatigueRisk}</Badge>
                  <Badge variant={safety.discountAbuseRisk === 'low' ? 'success' : 'warning'}>
                    Discount abuse: {safety.discountAbuseRisk}
                  </Badge>
                  <Badge variant="muted">Suggested control: {safety.recommendedControlGroupSize.toLocaleString('en-IN')}</Badge>
                </div>
                {safety.warnings.length > 0 && (
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {safety.warnings.map((w, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Check className="size-3.5 text-success" />
                        {w}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-col items-end gap-2 pt-2">
                  {finalLaunch.isError && (
                    <p className="text-sm text-destructive">
                      {finalLaunch.error instanceof ApiError
                        ? finalLaunch.error.message
                        : finalLaunch.error instanceof Error
                          ? finalLaunch.error.message
                          : 'Launch failed. Please try again.'}
                    </p>
                  )}
                  <Button size="lg" variant="success" onClick={() => finalLaunch.mutate()} disabled={finalLaunch.isPending || !campaignId}>
                    {finalLaunch.isPending ? <Spinner /> : <Rocket className="size-4" />}
                    Launch campaign
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${accent ? 'text-accent' : ''}`}>{value}</span>
    </div>
  );
}

function SafetyStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function CampaignStudioSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}
