import { createAiService, type AiResult } from '@scp/ai';
import { prisma } from '@scp/db';
import { env } from '../env.js';

export const ai = createAiService({
  provider: env.AI_PROVIDER,
  apiKey: env.OPENAI_API_KEY,
  model: env.OPENAI_MODEL,
});

/**
 * Persist an AI run for auditability and return the result. Every AI call in the
 * product flows through here so AiAgentRun is the single source of truth for what
 * the AI was asked and what it produced.
 */
export async function recordAiRun<T>(
  brandId: string | null | undefined,
  capability: string,
  input: unknown,
  exec: () => Promise<AiResult<T>>,
): Promise<{ result: AiResult<T>; runId: string }> {
  const res = await exec();
  const run = await prisma.aiAgentRun.create({
    data: {
      brandId: brandId ?? null,
      capability,
      provider: res.provider,
      model: res.model,
      input: input as object,
      output: res.result as object,
      explanation: res.explanation,
      confidence: res.confidence,
      status: res.status,
      latencyMs: res.latencyMs,
      auditLogs: {
        create: {
          level: res.status === 'FALLBACK' ? 'warn' : 'info',
          message:
            res.status === 'FALLBACK'
              ? 'Provider call failed; served deterministic fallback.'
              : `Capability ${capability} executed via ${res.provider}.`,
        },
      },
    },
  });
  return { result: res, runId: run.id };
}
