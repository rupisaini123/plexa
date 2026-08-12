import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pinoHttp = require('pino-http');
import { ExpressAdapter } from 'ask-sdk-express-adapter';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { getEnv } from './config/index.js';
import { logger } from './logger.js';
import {
  csrfToken,
  loginHandler,
  logoutHandler,
  optionalAuth,
  requireAuth,
} from './middleware/auth.js';
import { errorHandler } from './middleware/errors.js';
import { apiRouter } from './routes/api.js';
import { handleArtworkRequest, handleMediaRequest, handleSegmentRequest } from './media/gateway.js';
import { buildAlexaSkill } from './alexa/handlers.js';
import { ApplicationIdVerifier } from './alexa/verifier.js';
import { applyEnvDefaultsOnBoot } from './services/settings.js';

export function createApp(): express.Application {
  applyEnvDefaultsOnBoot();

  const app = express();
  app.set('trust proxy', 1);
  app.use(pinoHttp({ logger }));
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));
  app.use(cookieParser());
  if (getEnv().NODE_ENV === 'production') {
    app.use(rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 500,
      standardHeaders: true,
      legacyHeaders: false,
    }));
  }

  const skill = buildAlexaSkill();
  const alexaAdapter = new ExpressAdapter(skill, true, true, [new ApplicationIdVerifier()]);

  app.post('/alexa', ...alexaAdapter.getRequestHandlers());

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'plexa' });
  });

  app.head('/media/:token', handleMediaRequest);
  app.get('/media/:token', handleMediaRequest);
  app.head('/media/seg/:token', handleSegmentRequest);
  app.get('/media/seg/:token', handleSegmentRequest);
  app.head('/artwork/:token', handleArtworkRequest);
  app.get('/artwork/:token', handleArtworkRequest);

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts' },
  });

  app.post('/api/auth/login', loginLimiter, express.json(), loginHandler);
  app.post('/api/auth/logout', optionalAuth, logoutHandler);
  app.get('/api/auth/csrf', optionalAuth, requireAuth, csrfToken);

  app.use('/api', express.json(), apiRouter);

  const webDist = resolve(process.cwd(), 'web/dist');
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('*', optionalAuth, (req, res, next) => {
      if (req.path.startsWith('/api') || req.path === '/alexa' || req.path.startsWith('/media') || req.path.startsWith('/artwork')) {
        return next();
      }
      res.sendFile(resolve(webDist, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.type('text').send('Plexa API is running. Build the web UI with npm run build -w web.');
    });
  }

  app.use(errorHandler);

  return app;
}
