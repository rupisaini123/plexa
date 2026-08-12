import type { NextFunction, Request, Response } from 'express';
import { logger } from '../logger.js';

export type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function asyncHandler(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  logger.error({ err }, 'Request failed');
  if (res.headersSent) return;
  const message = err instanceof Error ? err.message : 'Internal server error';
  const status = message.includes('not found') ? 404 : message.includes('required') ? 400 : 500;
  res.status(status).json({ error: message });
}
