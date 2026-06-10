import type { AiContext } from '../types.js';

/**
 * Minimal OpenAI Chat Completions call using JSON mode. We avoid the SDK to keep
 * the package dependency-light; the response is parsed as JSON and validated by
 * the caller against the capability's Zod schema.
 */
export async function callOpenAi(
  prompt: string,
  schemaHint: string,
  ctx: AiContext,
): Promise<unknown> {
  if (!ctx.apiKey) throw new Error('OPENAI_API_KEY missing');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ctx.apiKey}`,
    },
    body: JSON.stringify({
      model: ctx.model,
      temperature: 0.6,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are an AI engine inside a retail marketing CRM. Always respond with a single valid JSON object that conforms to the requested schema. No prose, no markdown.',
        },
        { role: 'user', content: `${prompt}\n\nSchema (Zod): ${schemaHint}` },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenAI error ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned empty content');
  return JSON.parse(content);
}
