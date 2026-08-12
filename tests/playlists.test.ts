import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closeDb } from '../src/db/index.js';
import { plexAdapter } from '../src/plex/adapter.js';

vi.mock('../src/plex/adapter.js', async () => {
  const actual = await vi.importActual<typeof import('../src/plex/adapter.js')>('../src/plex/adapter.js');
  return {
    ...actual,
    plexAdapter: {
      connect: vi.fn().mockResolvedValue({ name: 'Test Plex' }),
      listPlaylists: vi.fn().mockResolvedValue([
        { ratingKey: 'pl1', title: 'Favorites', leafCount: 2 },
      ]),
      listPlaylistsPage: vi.fn(),
      createPlaylist: vi.fn().mockResolvedValue({
        ratingKey: 'pl-new',
        title: 'New Mix',
        leafCount: 1,
      }),
      addTracksToPlaylist: vi.fn().mockResolvedValue(undefined),
      getPlaylistTracks: vi.fn(),
      getPlaylistTracksPage: vi.fn(),
      renamePlaylist: vi.fn(),
      deletePlaylist: vi.fn(),
      removePlaylistItem: vi.fn(),
      reorderPlaylistItem: vi.fn(),
    },
  };
});

vi.mock('../src/services/settings.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/settings.js')>('../src/services/settings.js');
  return {
    ...actual,
    getPlexCredentials: () => ({ url: 'http://plex.local', token: 'token' }),
  };
});

async function authedAgent() {
  const app = createApp();
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ username: 'admin', password: 'testpass' });
  expect(login.status).toBe(200);
  const csrf = await agent.get('/api/auth/csrf');
  expect(csrf.status).toBe(200);
  return { agent, csrfToken: csrf.body.csrfToken as string };
}

describe('playlist mutations', () => {
  beforeEach(() => {
    closeDb();
    vi.mocked(plexAdapter.addTracksToPlaylist).mockClear();
    vi.mocked(plexAdapter.createPlaylist).mockClear();
  });

  it('blocks playlist mutations without auth', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/playlists/pl1/tracks')
      .send({ trackKeys: ['101'] });
    expect(res.status).toBe(401);
  });

  it('requires CSRF for add tracks', async () => {
    const { agent } = await authedAgent();
    const res = await agent
      .post('/api/playlists/pl1/tracks')
      .send({ trackKeys: ['101'] });
    expect(res.status).toBe(403);
  });

  it('validates trackKeys on add tracks', async () => {
    const { agent, csrfToken } = await authedAgent();

    const missing = await agent
      .post('/api/playlists/pl1/tracks')
      .set('X-CSRF-Token', csrfToken)
      .send({});
    expect(missing.status).toBe(400);
    expect(missing.body.error).toBe('trackKeys required');

    const empty = await agent
      .post('/api/playlists/pl1/tracks')
      .set('X-CSRF-Token', csrfToken)
      .send({ trackKeys: [] });
    expect(empty.status).toBe(400);

    const invalid = await agent
      .post('/api/playlists/pl1/tracks')
      .set('X-CSRF-Token', csrfToken)
      .send({ trackKeys: ['', '  '] });
    expect(invalid.status).toBe(400);
  });

  it('forwards add tracks to PlexAdapter', async () => {
    const { agent, csrfToken } = await authedAgent();
    const res = await agent
      .post('/api/playlists/pl1/tracks')
      .set('X-CSRF-Token', csrfToken)
      .send({ trackKeys: ['101', '102'] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(plexAdapter.addTracksToPlaylist).toHaveBeenCalledWith('pl1', ['101', '102']);
  });

  it('propagates Plex adapter failures on add tracks', async () => {
    vi.mocked(plexAdapter.addTracksToPlaylist).mockRejectedValueOnce(new Error('Playlist not found'));
    const { agent, csrfToken } = await authedAgent();
    const res = await agent
      .post('/api/playlists/pl1/tracks')
      .set('X-CSRF-Token', csrfToken)
      .send({ trackKeys: ['101'] });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Playlist not found');
  });

  it('creates a playlist with initial tracks', async () => {
    const { agent, csrfToken } = await authedAgent();
    const res = await agent
      .post('/api/playlists')
      .set('X-CSRF-Token', csrfToken)
      .send({ title: 'New Mix', trackKeys: ['101'] });

    expect(res.status).toBe(200);
    expect(plexAdapter.createPlaylist).toHaveBeenCalledWith('New Mix', ['101']);
    expect(res.body.ratingKey).toBe('pl-new');
    expect(res.body.title).toBe('New Mix');
  });

  it('validates optional trackKeys on create playlist', async () => {
    const { agent, csrfToken } = await authedAgent();
    const res = await agent
      .post('/api/playlists')
      .set('X-CSRF-Token', csrfToken)
      .send({ title: 'Empty Mix', trackKeys: [''] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('trackKeys required');
    expect(plexAdapter.createPlaylist).not.toHaveBeenCalled();
  });
});
