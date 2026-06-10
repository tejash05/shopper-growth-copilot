'use client';

import * as React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CommunicationStatus } from '@scp/shared';

interface Point {
  t: string;
  delivered: number;
  clicked: number;
  converted: number;
}

/** Build a cumulative engagement series bucketed to ~3s windows. */
function buildSeries(events: { eventType: CommunicationStatus; occurredAt: string }[]): Point[] {
  if (events.length === 0) return [];
  const sorted = [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const start = new Date(sorted[0]!.occurredAt).getTime();
  const buckets = new Map<number, { delivered: number; clicked: number; converted: number }>();

  let delivered = 0;
  let clicked = 0;
  let converted = 0;
  for (const e of sorted) {
    if (['DELIVERED', 'READ', 'CLICKED', 'ATTRIBUTED_ORDER'].includes(e.eventType)) delivered++;
    if (['CLICKED', 'ATTRIBUTED_ORDER'].includes(e.eventType)) clicked++;
    if (e.eventType === 'ATTRIBUTED_ORDER') converted++;
    const bucket = Math.floor((new Date(e.occurredAt).getTime() - start) / 3000);
    buckets.set(bucket, { delivered, clicked, converted });
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bucket, v]) => ({ t: `${bucket * 3}s`, ...v }));
}

export default function TimelineChart({
  events,
}: {
  events: { eventType: CommunicationStatus; occurredAt: string }[];
}) {
  const data = React.useMemo(() => buildSeries(events), [events]);

  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        Waiting for events…
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={224}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="gDelivered" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(235 62% 52%)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="hsl(235 62% 52%)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gConverted" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(167 72% 40%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(167 72% 40%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 28% 90%)" vertical={false} />
        <XAxis dataKey="t" tick={{ fontSize: 11, fill: 'hsl(215 16% 47%)' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'hsl(215 16% 47%)' }} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: '1px solid hsl(214 28% 90%)',
            fontSize: 12,
            boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
          }}
        />
        <Area type="monotone" dataKey="delivered" stroke="hsl(235 62% 52%)" fill="url(#gDelivered)" strokeWidth={2} name="Delivered" />
        <Area type="monotone" dataKey="clicked" stroke="hsl(199 89% 48%)" fill="transparent" strokeWidth={2} name="Clicked" />
        <Area type="monotone" dataKey="converted" stroke="hsl(167 72% 40%)" fill="url(#gConverted)" strokeWidth={2} name="Converted" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
