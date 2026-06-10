import { ChurnRisk, LoyaltyTier, Persona, ProductCategory } from '../constants/enums.js';
import type { RfmScore } from './rfm.js';

export interface PersonaInput {
  rfm: RfmScore;
  churnRisk: ChurnRisk;
  loyaltyTier: LoyaltyTier;
  recencyDays: number;
  orderCount: number;
  totalSpend: number;
  discountSensitivity: number; // 0..1
  favouriteCategory: ProductCategory;
}

/**
 * Deterministic persona assignment. Order matters: the first matching rule wins,
 * so more specific / higher-value personas are checked before generic ones.
 */
export function assignPersona(input: PersonaInput): Persona {
  const { rfm, churnRisk, recencyDays, orderCount, totalSpend, discountSensitivity, favouriteCategory } =
    input;

  // Brand new: very few orders, recent.
  if (orderCount <= 1 && recencyDays <= 45) return Persona.NEW_CUSTOMER;

  // Window shopper: barely transacts, low value.
  if (orderCount <= 1 && totalSpend < 3000) return Persona.WINDOW_SHOPPER;

  // Dormant high spender: high lifetime value but gone quiet.
  if (totalSpend >= 25000 && recencyDays >= 45) return Persona.DORMANT_HIGH_SPENDER;

  // At-risk loyalist: frequent buyer drifting away.
  if (rfm.frequency >= 3 && churnRisk !== ChurnRisk.LOW) return Persona.AT_RISK_LOYALIST;

  // Discount-led: high sensitivity, repeat buyer.
  if (discountSensitivity >= 0.6 && orderCount >= 2) return Persona.DISCOUNT_LED_BUYER;

  // Beauty repeat buyer.
  if (favouriteCategory === ProductCategory.BEAUTY && orderCount >= 3) return Persona.BEAUTY_REPEAT_BUYER;

  // VIP fashion loyalist: high RFM, fashion-leaning, active.
  if (rfm.total >= 11 && favouriteCategory === ProductCategory.FASHION) return Persona.VIP_FASHION_LOYALIST;

  // Fallback by remaining signals.
  if (rfm.total >= 11) return Persona.VIP_FASHION_LOYALIST;
  if (discountSensitivity >= 0.5) return Persona.DISCOUNT_LED_BUYER;
  return Persona.WINDOW_SHOPPER;
}
