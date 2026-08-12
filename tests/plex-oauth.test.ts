import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { encryptSecret, resetEnvForTests } from '../src/config/index.js';
import {
  closeDb,
  getSettings,
  savePlexOAuth,
  getPlexOAuth,
  updateSettings,
} from '../src/db/index.js';
import { disconnectPlex } from '../src/plex/auth.js';

describe('plex oauth persistence', () => {
  beforeEach(() => {
    closeDb();
    resetEnvForTests();
  });

  it('stores and expires oauth rows', () => {
    savePlexOAuth({
      id: 'auth-1',
      pin_id: 42,
      client_identifier: 'client-1',
      auth_url: 'https://app.plex.tv/auth#?code=abc',
      status: 'pending',
      account_token_enc: null,
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    const row = getPlexOAuth('auth-1');
    expect(row?.pin_id).toBe(42);
    expect(new Date(row!.expires_at) < new Date()).toBe(true);
  });

  it('requires auth for oauth start', async () => {
    const app = createApp();
    const res = await request(app).post('/api/plex/auth/start').send({});
    expect(res.status).toBe(401);
  });

  it('clears account token on disconnect', () => {
    const enc = encryptSecret('account-token', process.env.APP_SECRET!);
    updateSettings({
      plex_url: 'http://plex.local:32400',
      plex_token_enc: enc,
      plex_account_token_enc: enc,
      plex_account_email: 'user@example.com',
      plex_server_name: 'Home',
      plex_server_machine_id: 'machine-1',
      music_library_id: '1',
    });
    expect(getSettings().plex_account_token_enc).toBeTruthy();

    disconnectPlex();

    const row = getSettings();
    expect(row.plex_account_token_enc).toBeNull();
    expect(row.plex_token_enc).toBeNull();
    expect(row.plex_url).toBeNull();
    expect(row.plex_server_name).toBeNull();
  });

  it('requires auth for plex servers list', async () => {
    const app = createApp();
    const res = await request(app).get('/api/plex/servers');
    expect(res.status).toBe(401);
  });

  it('rejects select without authId when account token missing', async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'testpass' });
    const csrf = await agent.get('/api/auth/csrf');
    const token = csrf.body.csrfToken as string;

    const res = await agent
      .post('/api/plex/auth/server')
      .set('X-CSRF-Token', token)
      .send({ clientIdentifier: 'server-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/authId required/i);
  });

  it('returns empty servers list when account token missing', async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'testpass' });

    const res = await agent.get('/api/plex/servers');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });
});
