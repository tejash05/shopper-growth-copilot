import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { prisma, generateBrandDemoData } from '../index.js';
import { SEED_CONFIG } from './config.js';

// Load env from the repo root regardless of where the script is invoked from.
const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(here, '../../../../.env') });

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

  const brand = await prisma.brand.create({
    data: { name: SEED_CONFIG.brandName, industry: SEED_CONFIG.brandIndustry },
  });

  const result = await generateBrandDemoData(brand.id, {
    customerCount: SEED_CONFIG.customerCount,
    force: true,
  });

  console.timeEnd('seed');
  console.log('✅ Seed complete.');
  console.log(
    `   Brand: ${result.brandName} | Customers: ${result.customers} | Orders: ${result.orders} | Items: ${result.orderItems}`,
  );
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
