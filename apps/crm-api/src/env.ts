import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(here, '../../../.env') });

/** Railway and other PaaS hosts inject PORT; fall back to CRM_API_PORT or 4000 locally. */
function resolveListenPort(explicitPort: string | undefined): number {
  const raw = explicitPort ?? process.env.PORT ?? '4000';
  const port = Number(raw);
  if (!Number.isFinite(port) || port <= 0) return 4000;
  return port;
}

const schema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  CRM_API_PORT: z.preprocess(
    (value) => resolveListenPort(typeof value === 'string' ? value : undefined),
    z.number(),
  ),
  CHANNEL_SERVICE_URL: z.string().url().default('http://localhost:4001'),
  CHANNEL_CALLBACK_SECRET: z.string().min(8),
  /** Comma-separated browser origins allowed by CORS (e.g. Vercel production URL). */
  CORS_ORIGIN: z.string().optional(),
  AI_PROVIDER: z.enum(['mock', 'openai']).default('mock'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  NODE_ENV: z.string().default('development'),
});

export const env = schema.parse(process.env);
