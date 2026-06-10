import { buildServer } from './server.js';
import { startSendWorker } from './worker/send-worker.js';
import { env } from './env.js';

async function main() {
  const app = await buildServer();
  const worker = startSendWorker();

  await app.listen({ port: env.CRM_API_PORT, host: '0.0.0.0' });
  app.log.info(`CRM API ready on :${env.CRM_API_PORT} (AI provider: ${env.AI_PROVIDER})`);

  const shutdown = async () => {
    app.log.info('Shutting down...');
    await worker.close();
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error('Failed to start CRM API:', e);
  process.exit(1);
});
