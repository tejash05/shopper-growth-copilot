import { buildServer } from './server.js';
import { startCallbackWorker } from './worker.js';
import { env } from './env.js';

async function main() {
  const app = await buildServer();
  const worker = startCallbackWorker();

  await app.listen({ port: env.CHANNEL_SERVICE_PORT, host: '0.0.0.0' });
  app.log.info(`Channel service ready on :${env.CHANNEL_SERVICE_PORT}`);

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
  console.error('Failed to start channel service:', e);
  process.exit(1);
});
