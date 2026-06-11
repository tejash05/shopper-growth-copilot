import { createHash, randomUUID } from 'node:crypto';
import { faker } from '@faker-js/faker';
import {
  Channel,
  Gender,
  PRODUCT_CATEGORIES,
  ProductCategory,
  assignPersona,
  computeChurnRisk,
  computeRfm,
  estimateLifetimeValue,
} from '@scp/shared';
import { prisma } from '../index.js';
import { PRODUCT_CATALOG } from '../seed/catalog.js';
import { ARCHETYPES, pickArchetype, type Archetype } from '../seed/archetypes.js';

const CITIES = ['Bangalore', 'Delhi', 'Mumbai', 'Hyderabad', 'Pune'];
const INSERT_CHUNK_SIZE = 5_000;
const DEFAULT_CUSTOMER_COUNT = Number(process.env.WORKSPACE_DEMO_CUSTOMERS ?? 2_500);
const REFERENCE_NOW = new Date();

export interface GenerateBrandDemoOptions {
  customerCount?: number;
  /** Skip the guard when the workspace already has shoppers (global seed only). */
  force?: boolean;
}

export interface GenerateBrandDemoResult {
  brandId: string;
  brandName: string;
  customers: number;
  orders: number;
  orderItems: number;
  products: number;
}

interface BuiltCustomer {
  id: string;
  brandId: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  gender: Gender;
  loyaltyTier: Archetype['loyaltyTier'][number];
  preferredChannel: Channel;
  consentWhatsApp: boolean;
  consentSms: boolean;
  consentEmail: boolean;
  consentRcs: boolean;
  totalSpend: number;
  orderCount: number;
  averageOrderValue: number;
  favouriteCategory: ProductCategory;
  discountSensitivity: number;
  churnRisk: ReturnType<typeof computeChurnRisk>;
  persona: ReturnType<typeof assignPersona>;
  lifetimeValue: number;
  rfmRecency: number;
  rfmFrequency: number;
  rfmMonetary: number;
  rfmCell: string;
  rfmTotal: number;
  firstPurchaseAt: Date | null;
  lastPurchaseAt: Date | null;
}

interface BuiltOrder {
  id: string;
  brandId: string;
  customerId: string;
  orderNumber: string;
  totalAmount: number;
  discountAmount: number;
  category: ProductCategory;
  placedAt: Date;
}

interface BuiltOrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
}

function seedFromBrandId(brandId: string): number {
  const hash = createHash('sha256').update(brandId).digest();
  return hash.readUInt32BE(0);
}

function orderPrefixForBrandName(name: string): string {
  const letters = name.replace(/[^a-zA-Z]/g, '').toUpperCase();
  if (letters.length >= 2) return letters.slice(0, 2);
  return name.slice(0, 2).toUpperCase().padEnd(2, 'X');
}

function emailDomainForBrandName(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug || 'workspace'}.demo`;
}

function phoneForBrandCustomer(brandId: string, index: number): string {
  const hash = seedFromBrandId(brandId);
  const base = (hash % 90_000_000) + 10_000_000;
  return `+9198${String(base + index).padStart(8, '0').slice(-8)}`;
}

function rangeInt([min, max]: [number, number]): number {
  return faker.number.int({ min, max });
}

function rangeFloat([min, max]: [number, number]): number {
  return faker.number.float({ min, max });
}

function favouriteCategoryFor(a: Archetype, rand: () => number): ProductCategory {
  if (a.favouriteCategoryBias !== 'mixed' && rand() < 0.7) return a.favouriteCategoryBias;
  return faker.helpers.arrayElement(PRODUCT_CATEGORIES);
}

async function chunkInsert<T>(rows: T[], fn: (chunk: T[]) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
    await fn(rows.slice(i, i + INSERT_CHUNK_SIZE));
  }
}

interface ProductRow {
  id: string;
  brandId: string;
  name: string;
  category: ProductCategory;
  price: number;
}

async function ensureProducts(brandId: string) {
  const existing = (await prisma.product.findMany({ where: { brandId } })) as ProductRow[];
  if (existing.length > 0) {
    const productsByCategory = new Map<ProductCategory, ProductRow[]>();
    for (const cat of PRODUCT_CATEGORIES) {
      productsByCategory.set(
        cat,
        existing.filter((p) => p.category === cat),
      );
    }
    return { products: existing, productsByCategory };
  }

  const products: ProductRow[] = PRODUCT_CATALOG.map((p) => ({ id: randomUUID(), brandId, ...p }));
  await prisma.product.createMany({ data: products });
  const productsByCategory = new Map<ProductCategory, ProductRow[]>();
  for (const cat of PRODUCT_CATEGORIES) {
    productsByCategory.set(
      cat,
      products.filter((p) => p.category === cat),
    );
  }
  return { products, productsByCategory };
}

/**
 * Generate realistic shoppers, orders, and products for a single workspace.
 * Does not delete or modify any other brand's data.
 */
export async function generateBrandDemoData(
  brandId: string,
  options: GenerateBrandDemoOptions = {},
): Promise<GenerateBrandDemoResult> {
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) {
    throw Object.assign(new Error('Brand not found.'), { statusCode: 404 });
  }

  const existingCustomers = await prisma.customer.count({ where: { brandId } });
  if (existingCustomers > 0 && !options.force) {
    throw Object.assign(
      new Error(
        `${brand.name} already has shopper data. Demo data can only be generated for an empty workspace.`,
      ),
      { statusCode: 409 },
    );
  }

  faker.seed(seedFromBrandId(brandId));
  const rand = () => faker.number.float({ min: 0, max: 1 });
  const customerCount = options.customerCount ?? DEFAULT_CUSTOMER_COUNT;
  const orderPrefix = orderPrefixForBrandName(brand.name);
  const emailDomain = emailDomainForBrandName(brand.name);
  const { products, productsByCategory } = await ensureProducts(brandId);

  const customers: BuiltCustomer[] = [];
  const orders: BuiltOrder[] = [];
  const orderItems: BuiltOrderItem[] = [];
  let orderSeq = 1;

  for (let i = 0; i < customerCount; i++) {
    const archetype = pickArchetype(rand);
    const gender = faker.helpers.arrayElement([Gender.FEMALE, Gender.MALE, Gender.OTHER]);
    const firstName = faker.person.firstName(
      gender === Gender.FEMALE ? 'female' : gender === Gender.MALE ? 'male' : undefined,
    );
    const lastName = faker.person.lastName();
    const name = `${firstName} ${lastName}`;
    const favouriteCategory = favouriteCategoryFor(archetype, rand);
    const discountSensitivity = Number(rangeFloat(archetype.discountSensitivity).toFixed(2));
    const customerId = randomUUID();

    const orderCount = rangeInt(archetype.orderCount);
    let totalSpend = 0;
    let firstPurchaseAt: Date | null = null;
    let lastPurchaseAt: Date | null = null;
    const categoryTally = new Map<ProductCategory, number>();

    if (orderCount > 0) {
      const recencyDays = rangeInt(archetype.recencyDays);
      lastPurchaseAt = new Date(REFERENCE_NOW.getTime() - recencyDays * 86_400_000);
      const historySpanDays = faker.number.int({ min: 90, max: 540 });

      for (let o = 0; o < orderCount; o++) {
        const daysAgo =
          o === 0 ? recencyDays : recencyDays + faker.number.int({ min: 1, max: historySpanDays });
        const placedAt = new Date(REFERENCE_NOW.getTime() - daysAgo * 86_400_000);
        if (!firstPurchaseAt || placedAt < firstPurchaseAt) firstPurchaseAt = placedAt;

        const category =
          rand() < 0.7 ? favouriteCategory : faker.helpers.arrayElement(PRODUCT_CATEGORIES);
        categoryTally.set(category, (categoryTally.get(category) ?? 0) + 1);
        const pool = productsByCategory.get(category)!;

        const itemCount = faker.number.int({ min: 1, max: 3 });
        let subtotal = 0;
        const orderId = randomUUID();
        for (let it = 0; it < itemCount; it++) {
          const product = faker.helpers.arrayElement(pool);
          const quantity = faker.number.int({ min: 1, max: 2 });
          subtotal += product.price * quantity;
          orderItems.push({
            id: randomUUID(),
            orderId,
            productId: product.id,
            quantity,
            unitPrice: product.price,
          });
        }

        const aovTarget = rangeFloat(archetype.aov);
        const scaled = (subtotal + aovTarget) / 2;
        const discountAmount =
          rand() < discountSensitivity ? Math.round(scaled * rangeFloat([0.05, 0.25])) : 0;
        const totalAmount = Math.max(0, Math.round(scaled - discountAmount));
        totalSpend += totalAmount;

        orders.push({
          id: orderId,
          brandId: brand.id,
          customerId,
          orderNumber: `${orderPrefix}-${String(orderSeq++).padStart(7, '0')}`,
          totalAmount,
          discountAmount,
          category,
          placedAt,
        });
      }
    }

    const averageOrderValue = orderCount > 0 ? Math.round(totalSpend / orderCount) : 0;
    const recencyDays = lastPurchaseAt
      ? Math.floor((REFERENCE_NOW.getTime() - lastPurchaseAt.getTime()) / 86_400_000)
      : 999;
    const rfm = computeRfm({ recencyDays, frequency: orderCount, monetary: totalSpend });
    const churnRisk = computeChurnRisk(
      { recencyDays, frequency: orderCount, monetary: totalSpend },
      rfm,
    );
    const lifetimeValue = estimateLifetimeValue({
      totalSpend,
      averageOrderValue,
      orderCount,
      churnRisk,
    });

    let resolvedFavourite = favouriteCategory;
    let max = 0;
    for (const [cat, count] of categoryTally) {
      if (count > max) {
        max = count;
        resolvedFavourite = cat;
      }
    }
    const persona = assignPersona({
      rfm,
      churnRisk,
      loyaltyTier: faker.helpers.arrayElement(archetype.loyaltyTier),
      recencyDays,
      orderCount,
      totalSpend,
      discountSensitivity,
      favouriteCategory: resolvedFavourite,
    });

    const loyaltyTier = faker.helpers.arrayElement(archetype.loyaltyTier);
    const preferredChannel = faker.helpers.weightedArrayElement([
      { value: Channel.WHATSAPP, weight: 5 },
      { value: Channel.SMS, weight: 2 },
      { value: Channel.EMAIL, weight: 2 },
      { value: Channel.RCS, weight: 1 },
    ]);

    customers.push({
      id: customerId,
      brandId: brand.id,
      name,
      email: `${firstName}.${lastName}.${i}@${emailDomain}`.toLowerCase().replace(/[^a-z0-9.@]/g, ''),
      phone: phoneForBrandCustomer(brandId, i),
      city: faker.helpers.arrayElement(CITIES),
      gender,
      loyaltyTier,
      preferredChannel,
      consentWhatsApp: rand() > 0.06,
      consentSms: rand() > 0.1,
      consentEmail: rand() > 0.08,
      consentRcs: rand() > 0.12,
      totalSpend,
      orderCount,
      averageOrderValue,
      favouriteCategory: resolvedFavourite,
      discountSensitivity,
      churnRisk,
      persona,
      lifetimeValue,
      rfmRecency: rfm.recency,
      rfmFrequency: rfm.frequency,
      rfmMonetary: rfm.monetary,
      rfmCell: rfm.cell,
      rfmTotal: rfm.total,
      firstPurchaseAt,
      lastPurchaseAt,
    });
  }

  await chunkInsert(customers, (chunk) => prisma.customer.createMany({ data: chunk, skipDuplicates: true }));
  await chunkInsert(orders, (chunk) => prisma.order.createMany({ data: chunk, skipDuplicates: true }));
  await chunkInsert(orderItems, (chunk) => prisma.orderItem.createMany({ data: chunk, skipDuplicates: true }));

  return {
    brandId: brand.id,
    brandName: brand.name,
    customers: customers.length,
    orders: orders.length,
    orderItems: orderItems.length,
    products: products.length,
  };
}
