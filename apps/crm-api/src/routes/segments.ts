import type { FastifyInstance } from 'fastify';
import { createSegmentSchema, segmentPreviewSchema } from '@scp/shared';
import { parseOr400 } from '../lib/validate.js';
import { createSegment, listSegments, previewSegment } from '../services/segment-service.js';

export async function segmentRoutes(app: FastifyInstance) {
  app.get('/api/segments', async () => listSegments());

  app.post('/api/segments/preview', async (req, reply) => {
    const input = parseOr400(segmentPreviewSchema, req.body, reply);
    if (!input) return;
    return previewSegment(input.rule, input.sampleSize);
  });

  app.post('/api/segments', async (req, reply) => {
    const input = parseOr400(createSegmentSchema, req.body, reply);
    if (!input) return;
    const segment = await createSegment(input);
    return reply.code(201).send(segment);
  });
}
