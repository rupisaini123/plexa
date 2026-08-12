import pino from 'pino';
import { getEnv } from './config/index.js';

export const logger = pino({
  level: getEnv().NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'plexToken', 'password', 'token'],
    remove: true,
  },
});
