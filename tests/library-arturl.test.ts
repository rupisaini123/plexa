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
      listTracks: vi.fn(),
      listTracksPage: vi.fn().mockResolvedValue({
        items: [
          {
            ratingKey: '101',
            title: 'Neon Skyline',
            artist: 'Aurora',
            album: 'Night Drive',
            durationMs: 180000,
            thumb: '/library/metadata/101/thumb/0',
          },
          {
            ratingKey: '102',
            title: 'No Cover',
            artist: 'Unknown',
            durationMs: 120000,
          },
        ],
        nextStart: 2,
        hasMore: true,
      }),
      listArtists: vi.fn(),
      listArtistsPage: vi.fn().mockResolvedValue({ items: [], nextStart: 0, hasMore: false }),
      listAlbums: vi.fn(),
      listAlbumsPage: vi.fn().mockResolvedValue({ items: [], nextStart: 0, hasMore: false }),
      searchMusic: vi.fn().mockResolvedValue({
        tracks: [
          {
            ratingKey: '101',
            title: 'Neon Skyline',
            artist: 'Aurora',
            thumb: '/library/metadata/101/thumb/0',
          },
        ],
        albums: [],
        artists: [],
        playlists: [],
      }),
      searchMusicType: vi.fn().mockResolvedValue({
        items: [
          {
            ratingKey: '101',
            title: 'Neon Skyline',
            artist: 'Aurora',
            thumb: '/library/metadata/101/thumb/0',
          },
        ],
        nextStart: 1,
        hasMore: false,
      }),
      listPlaylists: vi.fn().mockResolvedValue([]),
      listPlaylistsPage: vi.fn().mockResolvedValue({ items: [], nextStart: 0, hasMore: false }),
      getPlaylistTracks: vi.fn().mockResolvedValue([
        {
          ratingKey: '201',
          title: 'Playlist Hit',
          artist: 'Band',
          thumb: '/library/metadata/201/thumb/0',
          playlistItemId: 'pi-1',
        },
      ]),
      getPlaylistTracksPage: vi.fn().mockResolvedValue({
        items: [
          {
            ratingKey: '201',
            title: 'Playlist Hit',
            artist: 'Band',
            thumb: '/library/metadata/201/thumb/0',
            playlistItemId: 'pi-1',
          },
        ],
        nextStart: 1,
        hasMore: false,
      }),
      getAlbumTracks: vi.fn().mockResolvedValue([]),
      getAlbumTracksPage: vi.fn().mockResolvedValue({ items: [], nextStart: 0, hasMore: false }),
      getArtistTracks: vi.fn().mockResolvedValue([]),
      getArtistTracksPage: vi.fn().mockResolvedValue({ items: [], nextStart: 0, hasMore: false }),
      getArtistAlbums: vi.fn().mockResolvedValue([]),
      getArtistAlbumsPage: vi.fn().mockResolvedValue({ items: [], nextStart: 0, hasMore: false }),
      getArtist: vi.fn(),
      getAlbum: vi.fn(),
      getTrack: vi.fn(),
    },
  };
});

vi.mock('../src/services/settings.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/settings.js')>('../src/services/settings.js');
  return {
    ...actual,
    getPublicSettings: () => ({
      ...actual.getPublicSettings(),
      musicLibraryId: '1',
    }),
    getPlexCredentials: () => ({ url: 'http://plex.local', token: 'token' }),
  };
});

async function authedAgent() {
  const app = createApp();
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ username: 'admin', password: 'testpass' });
  expect(login.status).toBe(200);
  return agent;
}

describe('library and playlist artwork enrichment', () => {
  beforeEach(() => {
    closeDb();
  });

  it('adds signed artUrl to library tracks when thumb exists', async () => {
    const agent = await authedAgent();
    const res = await agent.get('/api/library/tracks');

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].artUrl).toMatch(/^\/artwork\/.+\..+$/);
    expect(res.body.items[1].artUrl).toBeUndefined();
    expect(res.body.hasMore).toBe(true);
    expect(res.body.nextStart).toBe(2);
  });

  it('adds signed artUrl to search track results', async () => {
    const agent = await authedAgent();
    const res = await agent.get('/api/search?q=neon');

    expect(res.status).toBe(200);
    expect(res.body.tracks[0].artUrl).toMatch(/^\/artwork\/.+\..+$/);
  });

  it('adds signed artUrl to playlist tracks', async () => {
    const agent = await authedAgent();
    const res = await agent.get('/api/playlists/pl1/tracks');

    expect(res.status).toBe(200);
    expect(res.body.items[0].artUrl).toMatch(/^\/artwork\/.+\..+$/);
  });

  it('supports typed search pagination', async () => {
    const agent = await authedAgent();
    const res = await agent.get('/api/search?q=neon&type=tracks&start=0&size=25');

    expect(res.status).toBe(200);
    expect(res.body.items[0].artUrl).toMatch(/^\/artwork\/.+\..+$/);
    expect(res.body.hasMore).toBe(false);
    expect(plexAdapter.searchMusicType).toHaveBeenCalled();
  });

  it('passes validated sort to library page methods', async () => {
    const agent = await authedAgent();
    const res = await agent.get('/api/library/tracks?start=0&size=25&sort=titleDesc');
    expect(res.status).toBe(200);
    expect(plexAdapter.listTracksPage).toHaveBeenCalledWith('1', {
      start: 0,
      size: 25,
      sort: 'titleDesc',
    });
  });
});
