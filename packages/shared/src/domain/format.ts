import { CURRENCY } from '../constants/index.js';

/** Compact INR formatter — ₹2.4L, ₹12.5K, ₹980. */
export function formatInrCompact(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_00_00_000) return `${CURRENCY.symbol}${(amount / 1_00_00_000).toFixed(1)}Cr`;
  if (abs >= 1_00_000) return `${CURRENCY.symbol}${(amount / 1_00_000).toFixed(1)}L`;
  if (abs >= 1_000) return `${CURRENCY.symbol}${(amount / 1_000).toFixed(1)}K`;
  return `${CURRENCY.symbol}${Math.round(amount)}`;
}

/** Full INR formatter — ₹1,24,500. */
export function formatInr(amount: number): string {
  return new Intl.NumberFormat(CURRENCY.locale, {
    style: 'currency',
    currency: CURRENCY.code,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(value: number, fractionDigits = 1): string {
  return `${(value * 100).toFixed(fractionDigits)}%`;
}

export function daysBetween(from: Date, to: Date = new Date()): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}
