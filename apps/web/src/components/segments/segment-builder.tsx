'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Sparkles, Users, Wand2 } from 'lucide-react';
import {
  CITIES,
  ChurnRisk,
  formatInrCompact,
  type SegmentPreviewResult,
  type SegmentRule,
} from '@scp/shared';
import { apiFetch } from '@/lib/api';
import { SEGMENTS_QUERY_KEY } from '@/lib/segments';
import type { ParseIntentResponse } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label, Separator, Spinner } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { PersonaBadge } from '@/components/shared/labels';
import { EmptyState } from '@/components/shared/states';

const EXAMPLES = [
  'Find customers from Bangalore who spent over ₹10,000, bought in the last 6 months, but haven’t purchased in 45 days.',
  'High-value shoppers at risk of churn who love sneakers.',
  'Beauty repeat buyers in Mumbai active in the last 90 days.',
];

export function SegmentBuilder() {
  const queryClient = useQueryClient();
  const [query, setQuery] = React.useState(EXAMPLES[0]!);
  const [rule, setRule] = React.useState<SegmentRule>({});
  const [explanation, setExplanation] = React.useState('');
  const [confidence, setConfidence] = React.useState<number | null>(null);
  const [preview, setPreview] = React.useState<SegmentPreviewResult | null>(null);
  const [name, setName] = React.useState('');
  const [saved, setSaved] = React.useState(false);

  const parseMutation = useMutation({
    mutationFn: (q: string) =>
      apiFetch<ParseIntentResponse>('/api/ai/parse-intent', {
        method: 'POST',
        body: JSON.stringify({ query: q }),
      }),
    onSuccess: (res) => {
      setRule(res.result.rule);
      setExplanation(res.result.audienceMatters);
      setConfidence(res.confidence);
      setPreview(res.preview);
      setName(res.result.suggestedName);
      setSaved(false);
    },
  });

  const previewMutation = useMutation({
    mutationFn: (r: SegmentRule) =>
      apiFetch<SegmentPreviewResult>('/api/segments/preview', {
        method: 'POST',
        body: JSON.stringify({ rule: r, sampleSize: 8 }),
      }),
    onSuccess: (res) => setPreview(res),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/segments', {
        method: 'POST',
        body: JSON.stringify({ name, rule, naturalLanguageQuery: query, aiExplanation: explanation }),
      }),
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: SEGMENTS_QUERY_KEY });
    },
  });

  const updateRule = (patch: Partial<SegmentRule>) => {
    const next = { ...rule, ...patch };
    setRule(next);
    setSaved(false);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Left: builders */}
      <div className="space-y-6 lg:col-span-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              Describe your audience
            </CardTitle>
            <CardDescription>Write in plain English. The AI converts it into structured segment rules.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea value={query} onChange={(e) => setQuery(e.target.value)} rows={3} className="resize-none" />
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setQuery(ex)}
                  className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
                >
                  {ex.length > 48 ? ex.slice(0, 48) + '…' : ex}
                </button>
              ))}
            </div>
            <Button onClick={() => parseMutation.mutate(query)} disabled={parseMutation.isPending}>
              {parseMutation.isPending ? <Spinner /> : <Wand2 className="size-4" />}
              Parse with AI
            </Button>
          </CardContent>
        </Card>

        {/* Manual fallback */}
        <Card>
          <CardHeader>
            <CardTitle>Refine rules manually</CardTitle>
            <CardDescription>Fine-tune the AI’s output, or build a segment from scratch.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="City">
              <Select
                value={rule.city ?? ''}
                onChange={(e) => updateRule({ city: (e.target.value || undefined) as SegmentRule['city'] })}
              >
                <option value="">Any city</option>
                {CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Churn risk">
              <Select
                value={rule.churnRisk?.[0] ?? ''}
                onChange={(e) =>
                  updateRule({ churnRisk: e.target.value ? [e.target.value as ChurnRisk] : undefined })
                }
              >
                <option value="">Any risk</option>
                {Object.values(ChurnRisk).map((c) => (
                  <option key={c} value={c}>{c[0] + c.slice(1).toLowerCase()}</option>
                ))}
              </Select>
            </Field>
            <Field label="Min total spend (₹)">
              <Input
                type="number"
                value={rule.totalSpend?.gte ?? ''}
                onChange={(e) =>
                  updateRule({ totalSpend: e.target.value ? { gte: Number(e.target.value) } : undefined })
                }
                placeholder="e.g. 10000"
              />
            </Field>
            <Field label="Min orders">
              <Input
                type="number"
                value={rule.orderCount?.gte ?? ''}
                onChange={(e) =>
                  updateRule({ orderCount: e.target.value ? { gte: Number(e.target.value) } : undefined })
                }
                placeholder="e.g. 2"
              />
            </Field>
            <Field label="Inactive for at least (days)">
              <Input
                type="number"
                value={rule.lastPurchaseDays?.gte ?? ''}
                onChange={(e) =>
                  updateRule({
                    lastPurchaseDays: { ...rule.lastPurchaseDays, gte: e.target.value ? Number(e.target.value) : undefined },
                  })
                }
                placeholder="e.g. 45"
              />
            </Field>
            <Field label="Active within (days)">
              <Input
                type="number"
                value={rule.lastPurchaseDays?.lte ?? ''}
                onChange={(e) =>
                  updateRule({
                    lastPurchaseDays: { ...rule.lastPurchaseDays, lte: e.target.value ? Number(e.target.value) : undefined },
                  })
                }
                placeholder="e.g. 180"
              />
            </Field>
            <div className="sm:col-span-2">
              <Button variant="outline" onClick={() => previewMutation.mutate(rule)} disabled={previewMutation.isPending}>
                {previewMutation.isPending ? <Spinner /> : <Users className="size-4" />}
                Preview audience
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Rule JSON */}
        <Card>
          <CardHeader>
            <CardTitle>Segment rule (JSON)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs leading-relaxed text-slate-100 scroll-thin">
              {JSON.stringify(rule, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>

      {/* Right: preview + save */}
      <div className="space-y-6 lg:col-span-2">
        {explanation && (
          <Card className="border-primary/20 bg-primary/[0.03]">
            <CardContent className="flex gap-3 p-5">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm text-foreground">{explanation}</p>
                {confidence !== null && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    AI confidence: {(confidence * 100).toFixed(0)}%
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Audience preview</CardTitle>
          </CardHeader>
          <CardContent>
            {!preview ? (
              <EmptyState
                icon={Users}
                title="No preview yet"
                description="Parse a description or preview your manual rules to see the audience."
                className="border-0 bg-transparent py-6"
              />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Audience size" value={preview.audienceSize.toLocaleString('en-IN')} />
                  <Stat label="Revenue potential" value={formatInrCompact(preview.revenuePotential)} />
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Top categories</p>
                  <div className="flex flex-wrap gap-1.5">
                    {preview.topCategories.map((c) => (
                      <Badge key={c.category} variant="muted">
                        {c.category[0] + c.category.slice(1).toLowerCase()} · {c.count}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Sample shoppers</p>
                  <div className="space-y-2">
                    {preview.sampleCustomers.map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.city}</p>
                        </div>
                        <PersonaBadge persona={s.persona} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {preview && (
          <Card>
            <CardHeader>
              <CardTitle>Save segment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Segment name" />
              <Button
                variant={saved ? 'success' : 'default'}
                className="w-full"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !name || saved}
              >
                {saveMutation.isPending ? <Spinner /> : saved ? <Check className="size-4" /> : null}
                {saved ? 'Segment saved' : 'Save segment'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
