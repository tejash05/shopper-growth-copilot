import { LoyaltyTier, ProductCategory } from '@scp/shared';

export interface Archetype {
  key: string;
  weight: number;
  orderCount: [number, number];
  /** Days since most recent purchase. */
  recencyDays: [number, number];
  aov: [number, number];
  discountSensitivity: [number, number];
  favouriteCategoryBias: ProductCategory | 'mixed';
  loyaltyTier: LoyaltyTier[];
}

/**
 * Weighted retail archetypes. Tuned so the dataset yields ~1,200–1,500 dormant
 * high-value shoppers (the NovaWear win-back demo audience) and a realistic
 * long tail of low-value window shoppers.
 */
export const ARCHETYPES: Archetype[] = [
  {
    key: 'vip_active',
    weight: 8,
    orderCount: [8, 16],
    recencyDays: [2, 40],
    aov: [2800, 5200],
    discountSensitivity: [0.1, 0.35],
    favouriteCategoryBias: ProductCategory.FASHION,
    loyaltyTier: [LoyaltyTier.PLATINUM, LoyaltyTier.GOLD],
  },
  {
    key: 'dormant_high_spender',
    weight: 14,
    orderCount: [6, 12],
    recencyDays: [46, 175],
    aov: [3000, 5500],
    discountSensitivity: [0.15, 0.45],
    favouriteCategoryBias: 'mixed',
    loyaltyTier: [LoyaltyTier.PLATINUM, LoyaltyTier.GOLD],
  },
  {
    key: 'at_risk_loyalist',
    weight: 11,
    orderCount: [4, 9],
    recencyDays: [55, 130],
    aov: [1500, 3200],
    discountSensitivity: [0.25, 0.55],
    favouriteCategoryBias: 'mixed',
    loyaltyTier: [LoyaltyTier.GOLD, LoyaltyTier.SILVER],
  },
  {
    key: 'discount_led',
    weight: 15,
    orderCount: [3, 8],
    recencyDays: [10, 90],
    aov: [900, 2000],
    discountSensitivity: [0.6, 0.95],
    favouriteCategoryBias: 'mixed',
    loyaltyTier: [LoyaltyTier.SILVER, LoyaltyTier.BRONZE],
  },
  {
    key: 'beauty_repeat',
    weight: 10,
    orderCount: [4, 10],
    recencyDays: [5, 70],
    aov: [800, 1800],
    discountSensitivity: [0.3, 0.6],
    favouriteCategoryBias: ProductCategory.BEAUTY,
    loyaltyTier: [LoyaltyTier.GOLD, LoyaltyTier.SILVER],
  },
  {
    key: 'new_customer',
    weight: 12,
    orderCount: [1, 2],
    recencyDays: [1, 35],
    aov: [1200, 3000],
    discountSensitivity: [0.2, 0.6],
    favouriteCategoryBias: 'mixed',
    loyaltyTier: [LoyaltyTier.BRONZE],
  },
  {
    key: 'window_shopper',
    weight: 20,
    orderCount: [0, 1],
    recencyDays: [120, 400],
    aov: [600, 1400],
    discountSensitivity: [0.5, 0.9],
    favouriteCategoryBias: 'mixed',
    loyaltyTier: [LoyaltyTier.BRONZE],
  },
  {
    key: 'steady_regular',
    weight: 10,
    orderCount: [3, 7],
    recencyDays: [10, 60],
    aov: [1400, 2800],
    discountSensitivity: [0.25, 0.55],
    favouriteCategoryBias: 'mixed',
    loyaltyTier: [LoyaltyTier.SILVER, LoyaltyTier.GOLD],
  },
];

export function pickArchetype(rng: () => number): Archetype {
  const total = ARCHETYPES.reduce((s, a) => s + a.weight, 0);
  let r = rng() * total;
  for (const a of ARCHETYPES) {
    r -= a.weight;
    if (r <= 0) return a;
  }
  return ARCHETYPES[ARCHETYPES.length - 1]!;
}
