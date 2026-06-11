#!/usr/bin/env node
/**
 * Prepare a reliable local Next dev session:
 * - Free port 3000 if a stale next/node process is holding it (common after Ctrl+C).
 */
import { execSync } from 'node:child_process';

function freePort(port) {
  try {
    const raw = execSync(`lsof -ti :${port}`, { encoding: 'utf8' }).trim();
    if (!raw) return;
    for (const pid of raw.split('\n')) {
      if (!pid) continue;
      console.log(`[web] Freeing port ${port} (pid ${pid})…`);
      execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
    }
  } catch {
    // Port is already free.
  }
}

freePort(3000);
