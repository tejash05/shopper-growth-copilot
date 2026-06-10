import { z } from 'zod';
import { CITIES, ChurnRisk, LoyaltyTier, Persona, ProductCategory } from '../constants/enums.js';

export const customerListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z
    .enum(['totalSpend', 'lastPurchaseAt', 'orderCount', 'rfmTotal', 'lifetimeValue', 'createdAt'])
    .default('totalSpend'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().max(120).optional(),
  city: z.enum(CITIES).optional(),
  churnRisk: z.nativeEnum(ChurnRisk).optional(),
  loyaltyTier: z.nativeEnum(LoyaltyTier).optional(),
  persona: z.nativeEnum(Persona).optional(),
  favouriteCategory: z.nativeEnum(ProductCategory).optional(),
});
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;

export interface CustomerListItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  loyaltyTier: LoyaltyTier;
  persona: Persona;
  churnRisk: ChurnRisk;
  totalSpend: number;
  orderCount: number;
  averageOrderValue: number;
  lifetimeValue: number;
  rfmCell: string;
  rfmTotal: number;
  favouriteCategory: ProductCategory;
  preferredChannel: string;
  discountSensitivity: number;
  lastPurchaseAt: string | null;
}
