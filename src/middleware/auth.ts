import { randomBytes } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { getEnv, signPayload } from '../config/index.js';
import {
  createSession,
  deleteExpiredSessions,
  deleteSession,
  getSession,
  verifyAdmin,
} from '../db/index.js';

const SESSION_COOKIE = 'plexa_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AuthRequest extends Request {
  sessionId?: string;
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((part) => {
      const [key, ...rest] = part.trim().split('=');
      return [key, decodeURIComponent(rest.join('='))];
    }),
  );
}

export function createSessionCookie(): { sessionId: string; expiresAt: Date } {
  deleteExpiredSessions();
  const sessionId = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  createSession(sessionId, expiresAt);
  return { sessionId, expiresAt };
}

export function setSessionCookie(res: Response, sessionId: string, expiresAt: Date): void {
  const env = getEnv();
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    expires: expiresAt,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies[SESSION_COOKIE];
  if (!sessionId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const session = getSession(sessionId);
  if (!session || new Date(session.expires_at) < new Date()) {
    if (session) deleteSession(sessionId);
    res.status(401).json({ error: 'Session expired' });
    return;
  }
  req.sessionId = sessionId;
  next();
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies[SESSION_COOKIE];
  if (sessionId) {
    const session = getSession(sessionId);
    if (session && new Date(session.expires_at) >= new Date()) {
      req.sessionId = sessionId;
    }
  }
  next();
}

export function loginHandler(req: Request, res: Response): void {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }
  const admin = verifyAdmin(username, password);
  if (!admin) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const { sessionId, expiresAt } = createSessionCookie();
  setSessionCookie(res, sessionId, expiresAt);
  res.json({ ok: true, username: admin.username });
}

export function logoutHandler(req: AuthRequest, res: Response): void {
  if (req.sessionId) deleteSession(req.sessionId);
  clearSessionCookie(res);
  res.json({ ok: true });
}

export function csrfToken(req: AuthRequest, res: Response): void {
  const env = getEnv();
  const sessionId = req.sessionId ?? 'anonymous';
  const token = signPayload(sessionId, env.APP_SECRET);
  res.json({ csrfToken: token });
}

export function requireCsrf(req: AuthRequest, res: Response, next: NextFunction): void {
  const env = getEnv();
  const header = req.headers['x-csrf-token'] as string | undefined;
  const sessionId = req.sessionId ?? '';
  const expected = signPayload(sessionId, env.APP_SECRET);
  if (!header || header !== expected) {
    res.status(403).json({ error: 'Invalid CSRF token' });
    return;
  }
  next();
}

export function isPublicPath(path: string): boolean {
  if (path === '/alexa' || path === '/health' || path.startsWith('/media/') || path.startsWith('/artwork/')) {
    return true;
  }
  if (path.startsWith('/api/auth/login') || path.startsWith('/assets/')) return true;
  return false;
}
