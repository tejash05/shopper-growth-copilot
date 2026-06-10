import type { AiCapability } from '@scp/shared';

export type AiStatus = 'SUCCESS' | 'FALLBACK' | 'ERROR';

/**
 * Every AI capability returns this envelope. The structured `result` is always
 * schema-validated; `explanation` + `confidence` make outputs reviewable, and
 * `status` records whether we used the real model or the deterministic fallback.
 */
export interface AiResult<T> {
  result: T;
  explanation: string;
  confidence: number; // 0..1
  provider: string; // "mock" | "openai"
  model?: string;
  status: AiStatus;
  latencyMs: number;
}

export interface AiContext {
  provider: 'mock' | 'openai';
  apiKey?: string;
  model: string;
}

export interface Capability<Input, Output> {
  name: AiCapability;
  /** Build the prompt sent to a real LLM (also documents intended behaviour). */
  buildPrompt: (input: Input) => string;
  /** JSON schema description embedded in the prompt for structured output. */
  schemaHint: string;
  /** Deterministic local implementation — powers mock mode + fallback. */
  mock: (input: Input) => { result: Output; explanation: string; confidence: number };
}
