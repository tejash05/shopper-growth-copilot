import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(here, '../../../.env') });

/** Railway and other PaaS hosts inject PORT; fall back to CHANNEL_SERVICE_PORT or 4001 locally. */
function resolveListenPort(explicitPort: string | undefined): number {
  const raw = explicitPort ?? process.env.PORT ?? '4001';
  const port = Number(raw);
  if (!Number.isFinite(port) || port <= 0) return 4001;
  return port;
}

const schema = z.object({
  REDIS_URL: z.string().default('redis://localhost:6379'),
  CHANNEL_SERVICE_PORT: z.preprocess(
    (value) => resolveListenPort(typeof value === 'string' ? value : undefined),
    z.number(),
  ),
  CRM_API_URL: z.string().url().default('http://localhost:4000'),
  CHANNEL_CALLBACK_SECRET: z.string().min(8),
  NODE_ENV: z.string().default('development'),
});

export const env = schema.parse(process.env);
