/**
 * Pre-push backfill for Phase 2 tenant hardening.
 * Safe to run multiple times. Does not wipe data.
 *
 * - Backfills Order.brandId from Customer.brandId when the column exists but is empty.
 * - Adds a nullable brandId column first when upgrading an older schema.
 */
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(here, '../../../.env') });

async function main() {
  console.log('🔧 Backfilling tenant fields…');

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'brandId'
      ) THEN
        ALTER TABLE "Order" ADD COLUMN "brandId" TEXT;
      END IF;
    END $$;
  `);

  const updated = await prisma.$executeRaw`
    UPDATE "Order" AS o
    SET "brandId" = c."brandId"
    FROM "Customer" AS c
    WHERE o."customerId" = c."id"
      AND o."brandId" IS NULL
  `;

  console.log(`   Order.brandId rows updated: ${updated}`);

  // Resolve duplicate phones within a brand before adding @@unique([brandId, phone]).
  const dedupedPhones = await prisma.$executeRaw`
    WITH ranked AS (
      SELECT id,
        ROW_NUMBER() OVER (PARTITION BY "brandId", phone ORDER BY id) AS rn
      FROM "Customer"
    )
    UPDATE "Customer" AS c
    SET phone = c.phone || '-d' || SUBSTRING(c.id FROM 1 FOR 4)
    FROM ranked AS r
    WHERE c.id = r.id AND r.rn > 1
  `;

  console.log(`   Customer duplicate phones rewritten: ${dedupedPhones}`);
  console.log('✅ Tenant backfill complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
