import { createApp } from './app.js';
import { getEnv } from './config/index.js';
import { startBackgroundJobs } from './jobs/scheduler.js';
import { logger } from './logger.js';

const app = createApp();
const port = getEnv().PORT;

app.listen(port, () => {
  logger.info({ port }, 'Plexa server listening');
  startBackgroundJobs();
});
