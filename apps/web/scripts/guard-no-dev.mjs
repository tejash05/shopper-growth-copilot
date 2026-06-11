#!/usr/bin/env node
/**
 * Prevent `next build` while `next dev` is running — both share `.next` and
 * corrupting the cache causes webpack runtime errors and missing CSS chunks.
 */
import { execSync } from 'node:child_process';

if (process.env.SKIP_DEV_GUARD !== '1') {
  try {
    execSync('lsof -ti :3000', { stdio: 'ignore' });
    console.error(
      '\n❌ Dev server is running on port 3000.\n' +
        '   Stop it before `pnpm build` (shared port causes webpack/CSS errors).\n' +
        '   Fix a broken dev UI: pnpm dev:clean\n',
    );
    process.exit(1);
  } catch {
    // Port 3000 is free — safe to build.
  }
}
