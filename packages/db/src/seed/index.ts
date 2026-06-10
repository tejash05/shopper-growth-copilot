import { randomUUID } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
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
import { SEED_CONFIG } from './config.js';
import { PRODUCT_CATALOG } from './catalog.js';
import { ARCHETYPES, pickArchetype, type Archetype } from './archetypes.js';

// Load env from the repo root regardless of where the script is invoked from.
const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(here, '../../../../.env') });

faker.seed(42); // deterministic dataset across runs
const rand = () => faker.number.float({ min: 0, max: 1 });

const CITIES = ['Bangalore', 'Delhi', 'Mumbai', 'Hyderabad', 'Pune'];
const now = SEED_CONFIG.now;

function rangeInt([min, max]: [number, number]): number {
  return faker.number.int({ min, max });
}
function rangeFloat([min, max]: [number, number]): number {
  return faker.number.float({ min, max });
}

function favouriteCategoryFor(a: Archetype): ProductCategory {
  if (a.favouriteCategoryBias !== 'mixed' && rand() < 0.7) return a.favouriteCategoryBias;
  return faker.helpers.arrayElement(PRODUCT_CATEGORIES);
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

async function main() {
  console.log('🌱 Seeding Shopper Growth Copilot demo dataset...');
  console.time('seed');

  // Clean slate (FK-safe order).
  await prisma.$transaction([
    prisma.aiAuditLog.deleteMany(),
    prisma.aiAgentRun.deleteMany(),
    prisma.attributedOrder.deleteMany(),
    prisma.communicationEvent.deleteMany(),
    prisma.channelCallback.deleteMany(),
    prisma.communication.deleteMany(),
    prisma.campaignVariant.deleteMany(),
    prisma.campaign.deleteMany(),
    prisma.segmentRule.deleteMany(),
    prisma.segment.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.product.deleteMany(),
    prisma.brand.deleteMany(),
  ]);

  // 1. Brand
  const brand = await prisma.brand.create({
    data: { name: SEED_CONFIG.brandName, industry: SEED_CONFIG.brandIndustry },
  });

  // 2. Products
  const products = PRODUCT_CATALOG.map((p) => ({ id: randomUUID(), brandId: brand.id, ...p }));
  await prisma.product.createMany({ data: products });
  const productsByCategory = new Map<ProductCategory, typeof products>();
  for (const cat of PRODUCT_CATEGORIES) {
    productsByCategory.set(
      cat,
      products.filter((p) => p.category === cat),
    );
  }

  // 3. Customers + orders (built in memory, bulk-inserted in chunks)
  const customers: BuiltCustomer[] = [];
  const orders: BuiltOrder[] = [];
  const orderItems: BuiltOrderItem[] = [];
  let orderSeq = 1;

  for (let i = 0; i < SEED_CONFIG.customerCount; i++) {
    const archetype = pickArchetype(rand);
    const gender = faker.helpers.arrayElement([Gender.FEMALE, Gender.MALE, Gender.OTHER]);
    const firstName = faker.person.firstName(
      gender === Gender.FEMALE ? 'female' : gender === Gender.MALE ? 'male' : undefined,
    );
    const lastName = faker.person.lastName();
    const name = `${firstName} ${lastName}`;
    const favouriteCategory = favouriteCategoryFor(archetype);
    const discountSensitivity = Number(rangeFloat(archetype.discountSensitivity).toFixed(2));
    const customerId = randomUUID();

    const orderCount = rangeInt(archetype.orderCount);
    let totalSpend = 0;
    let firstPurchaseAt: Date | null = null;
    let lastPurchaseAt: Date | null = null;
    const categoryTally = new Map<ProductCategory, number>();

    if (orderCount > 0) {
      const recencyDays = rangeInt(archetype.recencyDays);
      lastPurchaseAt = new Date(now.getTime() - recencyDays * 86_400_000);
      const historySpanDays = faker.number.int({ min: 90, max: 540 });

      for (let o = 0; o < orderCount; o++) {
        // Distribute order dates between [recency, recency + span] days ago.
        const daysAgo =
          o === 0 ? recencyDays : recencyDays + faker.number.int({ min: 1, max: historySpanDays });
        const placedAt = new Date(now.getTime() - daysAgo * 86_400_000);
        if (!firstPurchaseAt || placedAt < firstPurchaseAt) firstPurchaseAt = placedAt;

        // Pick category (biased to favourite) and build line items.
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

        // Scale subtotal toward archetype AOV so spend tiers are realistic.
        const aovTarget = rangeFloat(archetype.aov);
        const scaled = (subtotal + aovTarget) / 2;
        const discountAmount =
          rand() < discountSensitivity ? Math.round(scaled * rangeFloat([0.05, 0.25])) : 0;
        const totalAmount = Math.max(0, Math.round(scaled - discountAmount));
        totalSpend += totalAmount;

        orders.push({
          id: orderId,
          customerId,
          orderNumber: `NW-${String(orderSeq++).padStart(7, '0')}`,
          totalAmount,
          discountAmount,
          category,
          placedAt,
        });
      }
    }

    const averageOrderValue = orderCount > 0 ? Math.round(totalSpend / orderCount) : 0;
    const recencyDays = lastPurchaseAt
      ? Math.floor((now.getTime() - lastPurchaseAt.getTime()) / 86_400_000)
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
    // Favourite category = most purchased; fall back to assigned bias.
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
      email: `${firstName}.${lastName}.${i}@example.com`.toLowerCase().replace(/[^a-z0-9.@]/g, ''),
      phone: `+9198${faker.string.numeric(8)}`,
      city: faker.helpers.arrayElement(CITIES),
      gender,
      loyaltyTier,
      preferredChannel,
      // ~8% of customers have opted out of at least one channel.
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

  // 4. Bulk insert
  console.log(`Inserting ${customers.length} customers...`);
  await chunkInsert(customers, (c) => prisma.customer.createMany({ data: c, skipDuplicates: true }));
  console.log(`Inserting ${orders.length} orders...`);
  await chunkInsert(orders, (c) => prisma.order.createMany({ data: c, skipDuplicates: true }));
  console.log(`Inserting ${orderItems.length} order items...`);
  await chunkInsert(orderItems, (c) =>
    prisma.orderItem.createMany({ data: c, skipDuplicates: true }),
  );

  console.timeEnd('seed');
  const dormantVip = customers.filter(
    (c) => c.totalSpend >= 25000 && c.lastPurchaseAt && daysAgo(c.lastPurchaseAt) >= 45,
  ).length;
  console.log('✅ Seed complete.');
  console.log(
    `   Brand: ${brand.name} | Customers: ${customers.length} | Orders: ${orders.length} | Items: ${orderItems.length}`,
  );
  console.log(`   Dormant high-value shoppers (demo win-back audience): ~${dormantVip}`);
}

function daysAgo(d: Date): number {
  return Math.floor((now.getTime() - d.getTime()) / 86_400_000);
}

async function chunkInsert<T>(rows: T[], fn: (chunk: T[]) => Promise<unknown>): Promise<void> {
  const size = SEED_CONFIG.insertChunkSize;
  for (let i = 0; i < rows.length; i += size) {
    await fn(rows.slice(i, i + size));
  }
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
