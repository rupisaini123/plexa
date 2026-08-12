import { createApp } from './app.js';
import { getEnv } from './config/index.js';
import { startBackgroundJobs } from './jobs/scheduler.js';
import { logger } from './logger.js';
import { ensurePlexConnectedFromSettings } from './plex/auth.js';

const app = createApp();
const port = getEnv().PORT;

void ensurePlexConnectedFromSettings()
  .then((creds) => {
    if (creds) logger.info({ url: creds.url }, 'Plex connected on startup');
  })
  .catch((err) => {
    logger.warn({ err }, 'Plex warm connect on startup failed');
  });

app.listen(port, () => {
  logger.info({ port }, 'Plexa server listening');
  startBackgroundJobs();
});
