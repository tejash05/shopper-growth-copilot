import type { FastifyReply } from 'fastify';
import { z, ZodError } from 'zod';

/** Parse input with a Zod schema, replying 400 with structured details on failure. */
export function parseOr400<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown,
  reply: FastifyReply,
): z.infer<S> | null {
  try {
    return schema.parse(data);
  } catch (e) {
    if (e instanceof ZodError) {
      reply.code(400).send({
        error: 'ValidationError',
        message: 'Request validation failed.',
        details: e.flatten(),
      });
      return null;
    }
    throw e;
  }
}
