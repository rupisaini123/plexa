import { deleteAlexaEventsOlderThan, getSettings } from '../db/index.js';
import { logger } from '../logger.js';

export function getAlexaEventsRetentionDays(): number {
  const row = getSettings();
  return row.alexa_events_retention_days ?? 7;
}

export function runAlexaEventsCleanup(): { deletedCount: number; retentionDays: number } {
  const retentionDays = getAlexaEventsRetentionDays();
  try {
    const deletedCount = deleteAlexaEventsOlderThan(retentionDays);
    logger.info({ deletedCount, retentionDays }, 'Alexa events cleanup completed');
    return { deletedCount, retentionDays };
  } catch (err) {
    logger.error({ err, retentionDays }, 'Alexa events cleanup failed');
    throw err;
  }
}
