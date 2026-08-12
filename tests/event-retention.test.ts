import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  closeDb,
  deleteAlexaEventsOlderThan,
  getDb,
  recordAlexaEvent,
} from '../src/db/index.js';
import { runAlexaEventsCleanup } from '../src/services/eventRetention.js';
import { getPublicSettings, updateSettingsFromInput } from '../src/services/settings.js';

async function loginAgent(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ username: 'admin', password: 'testpass' });
  expect(login.status).toBe(200);
  return agent;
}

function insertEventWithCreatedAt(summary: string, createdAt: string): void {
  getDb()
    .prepare('INSERT INTO alexa_events (event_type, summary, created_at) VALUES (?, ?, ?)')
    .run('TestIntent', summary, createdAt);
}

describe('deleteAlexaEventsOlderThan', () => {
  beforeEach(() => {
    closeDb();
    getDb().prepare('DELETE FROM alexa_events').run();
  });

  it('deletes only events older than the retention period', () => {
    const now = Date.now();
    const oldDate = new Date(now - 10 * 86_400_000).toISOString();
    const recentDate = new Date(now - 2 * 86_400_000).toISOString();

    insertEventWithCreatedAt('Old event', oldDate);
    insertEventWithCreatedAt('Recent event', recentDate);

    const deleted = deleteAlexaEventsOlderThan(7);
    expect(deleted).toBe(1);

    const remaining = getDb()
      .prepare('SELECT summary FROM alexa_events ORDER BY id')
      .all() as { summary: string }[];
    expect(remaining).toHaveLength(1);
    expect(remaining[0].summary).toBe('Recent event');
  });

  it('returns zero when no events match', () => {
    recordAlexaEvent({ type: 'TestIntent', summary: 'Fresh event' });
    const deleted = deleteAlexaEventsOlderThan(7);
    expect(deleted).toBe(0);
  });
});

describe('updateSettingsFromInput retention validation', () => {
  beforeEach(() => {
    closeDb();
  });

  it('accepts valid retention days', () => {
    const updated = updateSettingsFromInput({ alexaEventsRetentionDays: 30 });
    expect(updated.alexaEventsRetentionDays).toBe(30);
  });

  it('rejects retention days below 1', () => {
    expect(() => updateSettingsFromInput({ alexaEventsRetentionDays: 0 })).toThrow(
      'Event retention days must be an integer between 1 and 365',
    );
  });

  it('rejects retention days above 365', () => {
    expect(() => updateSettingsFromInput({ alexaEventsRetentionDays: 400 })).toThrow(
      'Event retention days must be an integer between 1 and 365',
    );
  });
});

describe('runAlexaEventsCleanup', () => {
  beforeEach(() => {
    closeDb();
    getDb().prepare('DELETE FROM alexa_events').run();
    updateSettingsFromInput({ alexaEventsRetentionDays: 7 });
  });

  it('uses configured retention days from settings', () => {
    const oldDate = new Date(Date.now() - 10 * 86_400_000).toISOString();
    insertEventWithCreatedAt('Stale event', oldDate);

    const result = runAlexaEventsCleanup();
    expect(result.retentionDays).toBe(7);
    expect(result.deletedCount).toBe(1);
  });
});

describe('POST /api/alexa/events/cleanup', () => {
  beforeEach(() => {
    closeDb();
    getDb().prepare('DELETE FROM alexa_events').run();
    updateSettingsFromInput({ alexaEventsRetentionDays: 7 });
  });

  it('requires authentication', async () => {
    const app = createApp();
    const res = await request(app).post('/api/alexa/events/cleanup');
    expect(res.status).toBe(401);
  });

  it('deletes old events and returns count', async () => {
    const app = createApp();
    const agent = await loginAgent(app);
    const csrf = await agent.get('/api/auth/csrf');
    const csrfToken = csrf.body.csrfToken as string;

    const oldDate = new Date(Date.now() - 10 * 86_400_000).toISOString();
    insertEventWithCreatedAt('Old event', oldDate);
    insertEventWithCreatedAt('Recent event', new Date().toISOString());

    const res = await agent
      .post('/api/alexa/events/cleanup')
      .set('X-CSRF-Token', csrfToken)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deletedCount: 1, retentionDays: 7 });
  });
});

describe('GET /api/settings retention field', () => {
  beforeEach(() => {
    closeDb();
  });

  it('includes alexaEventsRetentionDays with default 7', async () => {
    const app = createApp();
    const agent = await loginAgent(app);
    const res = await agent.get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body.alexaEventsRetentionDays).toBe(7);
    expect(getPublicSettings().alexaEventsRetentionDays).toBe(7);
  });
});
