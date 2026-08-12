import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closeDb } from '../src/db/index.js';

describe('auth boundaries', () => {
  beforeEach(() => {
    closeDb();
  });

  it('returns health without auth', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('blocks protected API without session', async () => {
    const app = createApp();
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(401);
  });

  it('allows login and fetches settings', async () => {
    const app = createApp();
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send({ username: 'admin', password: 'testpass' });
    expect(login.status).toBe(200);

    const csrf = await agent.get('/api/auth/csrf');
    expect(csrf.status).toBe(200);

    const settings = await agent.get('/api/settings');
    expect(settings.status).toBe(200);
    expect(settings.body.invocationName).toBe('plexa');
  });
});
