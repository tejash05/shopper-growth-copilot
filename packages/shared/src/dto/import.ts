import { z } from 'zod';
import { Channel, LoyaltyTier, ProductCategory } from '../constants/enums.js';

const channelSchema = z.enum([Channel.WHATSAPP, Channel.SMS, Channel.EMAIL, Channel.RCS]);
const loyaltyTierSchema = z.enum([
  LoyaltyTier.PLATINUM,
  LoyaltyTier.GOLD,
  LoyaltyTier.SILVER,
  LoyaltyTier.BRONZE,
]);
const productCategorySchema = z.enum([
  ProductCategory.FASHION,
  ProductCategory.BEAUTY,
  ProductCategory.ACCESSORIES,
  ProductCategory.SNEAKERS,
]);

const emailSchema = z.string().email().optional().or(z.literal(''));
const phoneSchema = z.string().min(6).max(20).optional().or(z.literal(''));

export const customerImportRowSchema = z
  .object({
    externalCustomerId: z.string().trim().min(1).optional(),
    firstName: z.string().trim().optional(),
    lastName: z.string().trim().optional(),
    email: emailSchema,
    phone: phoneSchema,
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
    preferredChannel: channelSchema.optional(),
    loyaltyTier: loyaltyTierSchema.optional(),
    consentWhatsApp: z.union([z.boolean(), z.string()]).optional(),
    consentSms: z.union([z.boolean(), z.string()]).optional(),
    consentEmail: z.union([z.boolean(), z.string()]).optional(),
    consentRcs: z.union([z.boolean(), z.string()]).optional(),
  })
  .superRefine((row, ctx) => {
    const hasIdentity =
      Boolean(row.externalCustomerId?.trim()) ||
      Boolean(row.email?.trim()) ||
      Boolean(row.phone?.trim());
    if (!hasIdentity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least one of externalCustomerId, email, or phone.',
        path: ['externalCustomerId'],
      });
    }
  });

export const orderImportRowSchema = z
  .object({
    externalOrderId: z.string().trim().min(1).optional(),
    externalCustomerId: z.string().trim().optional(),
    customerEmail: emailSchema,
    customerPhone: phoneSchema,
    orderDate: z.string().trim().min(1),
    orderValue: z.coerce.number().positive(),
    currency: z.string().trim().optional(),
    category: z.string().trim().optional(),
    productName: z.string().trim().optional(),
    quantity: z.coerce.number().int().positive().optional(),
    status: z.string().trim().optional(),
  })
  .superRefine((row, ctx) => {
    const hasCustomerRef =
      Boolean(row.externalCustomerId?.trim()) ||
      Boolean(row.customerEmail?.trim()) ||
      Boolean(row.customerPhone?.trim());
    if (!hasCustomerRef) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide externalCustomerId, customerEmail, or customerPhone.',
        path: ['externalCustomerId'],
      });
    }
    if (!row.category?.trim() && !row.productName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide category or productName.',
        path: ['category'],
      });
    }
  });

export const importPayloadSchema = z.object({
  fileName: z.string().min(1).max(255),
  sourceType: z.enum(['CSV', 'JSON']),
  customers: z.array(customerImportRowSchema).max(10_000),
  orders: z.array(orderImportRowSchema).max(50_000),
});

export type CustomerImportRow = z.infer<typeof customerImportRowSchema>;
export type OrderImportRow = z.infer<typeof orderImportRowSchema>;
export type ImportPayload = z.infer<typeof importPayloadSchema>;

export interface ImportRowError {
  rowNumber: number;
  entityType: 'CUSTOMER' | 'ORDER';
  field: string | null;
  message: string;
  rawRow: Record<string, unknown>;
}

export interface ImportPreviewResult {
  fileName: string;
  sourceType: 'CSV' | 'JSON';
  valid: boolean;
  summary: {
    customerCount: number;
    orderCount: number;
    errorCount: number;
  };
  preview: {
    customers: CustomerImportRow[];
    orders: OrderImportRow[];
  };
  errors: ImportRowError[];
  payload?: ImportPayload;
}

export interface ImportCommitResult {
  importJobId: string;
  brandId: string;
  brandName: string;
  customersImported: number;
  ordersImported: number;
  rowsSkipped: number;
  errorsCount: number;
  status: 'COMPLETED' | 'FAILED';
}

export interface ImportJobSummary {
  id: string;
  fileName: string;
  sourceType: string;
  status: string;
  customersImported: number;
  ordersImported: number;
  rowsSkipped: number;
  errorsCount: number;
  createdAt: string;
  completedAt: string | null;
}
