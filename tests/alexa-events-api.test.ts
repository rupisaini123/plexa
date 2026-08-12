import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closeDb, getDb, recordAlexaEvent } from '../src/db/index.js';

async function loginAgent(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ username: 'admin', password: 'testpass' });
  expect(login.status).toBe(200);
  return agent;
}

describe('GET /api/alexa/events', () => {
  beforeEach(() => {
    closeDb();
    getDb().prepare('DELETE FROM alexa_events').run();
    for (let i = 1; i <= 5; i += 1) {
      recordAlexaEvent({ type: 'PlayPlaylistIntent', summary: `Playing event ${i}` });
    }
  });

  it('requires authentication', async () => {
    const app = createApp();
    const res = await request(app).get('/api/alexa/events');
    expect(res.status).toBe(401);
  });

  it('returns paginated events newest first', async () => {
    const app = createApp();
    const agent = await loginAgent(app);

    const first = await agent.get('/api/alexa/events?start=0&size=2');
    expect(first.status).toBe(200);
    expect(first.body.items).toHaveLength(2);
    expect(first.body.items[0].summary).toBe('Playing event 5');
    expect(first.body.hasMore).toBe(true);
    expect(first.body.nextStart).toBe(2);

    const second = await agent.get(`/api/alexa/events?start=${first.body.nextStart}&size=2`);
    expect(second.status).toBe(200);
    expect(second.body.items.map((item: { summary: string }) => item.summary)).toEqual([
      'Playing event 3',
      'Playing event 2',
    ]);
  });

  it('returns only events newer than afterId', async () => {
    const app = createApp();
    const agent = await loginAgent(app);

    const first = await agent.get('/api/alexa/events?start=0&size=5');
    const afterId = first.body.items.find((item: { summary: string }) => item.summary === 'Playing event 3').id;

    const newer = await agent.get(`/api/alexa/events?afterId=${afterId}&size=10`);
    expect(newer.status).toBe(200);
    expect(newer.body.items.map((item: { summary: string }) => item.summary)).toEqual([
      'Playing event 5',
      'Playing event 4',
    ]);
  });
});
