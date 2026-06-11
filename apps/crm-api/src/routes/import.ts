import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { importPayloadSchema } from '@scp/shared';
import { resolveBrandId } from '../lib/brand.js';
import { parseOr400 } from '../lib/validate.js';
import {
  MAX_IMPORT_FILE_BYTES,
  buildImportPreview,
  commitImport,
  getImportJobErrors,
  listImportJobs,
  parseImportFiles,
} from '../services/import-service.js';

export async function importRoutes(app: FastifyInstance) {
  await app.register(multipart, {
    limits: { fileSize: MAX_IMPORT_FILE_BYTES, files: 2 },
  });

  app.post('/api/import/preview', async (req, reply) => {
    const brandId = await resolveBrandId(req);
    const parts = req.parts();
    let jsonText: string | undefined;
    let customersCsvText: string | undefined;
    let ordersCsvText: string | undefined;
    let fileName = 'upload';

    for await (const part of parts) {
      if (part.type !== 'file') continue;
      const buffer = await part.toBuffer();
      if (buffer.byteLength > MAX_IMPORT_FILE_BYTES) {
        return reply.code(400).send({
          error: 'BadRequest',
          message: `File exceeds the ${MAX_IMPORT_FILE_BYTES / (1024 * 1024)}MB limit.`,
        });
      }
      const text = buffer.toString('utf8');
      fileName = part.filename || fileName;

      if (part.fieldname === 'file') {
        if (fileName.toLowerCase().endsWith('.json')) jsonText = text;
        else if (fileName.toLowerCase().includes('order')) ordersCsvText = text;
        else customersCsvText = text;
      } else if (part.fieldname === 'customersFile') {
        customersCsvText = text;
      } else if (part.fieldname === 'ordersFile') {
        ordersCsvText = text;
      }
    }

    const parsed = parseImportFiles({ jsonText, customersCsvText, ordersCsvText, fileName });
    const preview = buildImportPreview({ fileName, ...parsed });
    return reply.send(preview);
  });

  app.post('/api/import/commit', async (req, reply) => {
    const brandId = await resolveBrandId(req);
    const input = parseOr400(importPayloadSchema, req.body, reply);
    if (!input) return;
    const result = await commitImport(brandId, input, {
      info: (obj, msg) => req.log.info(obj, msg),
      error: (obj, msg) => req.log.error(obj, msg),
    });
    return reply.code(201).send(result);
  });

  app.get('/api/import/jobs', async (req) => {
    const brandId = await resolveBrandId(req);
    return listImportJobs(brandId);
  });

  app.get<{ Params: { id: string } }>('/api/import/jobs/:id/errors', async (req, reply) => {
    const brandId = await resolveBrandId(req);
    const errors = await getImportJobErrors(req.params.id, brandId);
    return reply.send(errors);
  });
}
