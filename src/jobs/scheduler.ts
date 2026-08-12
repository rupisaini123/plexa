import { runAlexaEventsCleanup } from '../services/eventRetention.js';
import { logger } from '../logger.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const BOOT_DELAY_MS = 30_000;

function scheduleCleanup(): void {
  try {
    runAlexaEventsCleanup();
  } catch {
    // Errors are logged in runAlexaEventsCleanup
  }
}

export function startBackgroundJobs(): void {
  const bootTimer = setTimeout(() => {
    scheduleCleanup();
    const interval = setInterval(scheduleCleanup, DAY_MS);
    interval.unref();
  }, BOOT_DELAY_MS);
  bootTimer.unref();
  logger.info({ bootDelayMs: BOOT_DELAY_MS, intervalMs: DAY_MS }, 'Background jobs scheduled');
}
