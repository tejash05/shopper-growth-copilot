import { PrismaClient } from '@prisma/client';

/**
 * Singleton Prisma client. Reused across hot-reloads in dev to avoid exhausting
 * the connection pool, and shared by every backend service.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export * from '@prisma/client';
export { PrismaClient } from '@prisma/client';
export {
  generateBrandDemoData,
  type GenerateBrandDemoOptions,
  type GenerateBrandDemoResult,
} from './demo/generate-brand-demo.js';
