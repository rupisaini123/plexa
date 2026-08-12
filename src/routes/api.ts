import { Router } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { requireAuth, requireCsrf } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errors.js';
import {
  getPublicSettings,
  getPlexAccountToken,
  getPlexCredentials,
  updateSettingsFromInput,
} from '../services/settings.js';
import {
  disconnectPlex,
  getPlexOAuthStatus,
  listPlexServers,
  loadLibrariesForCurrentPlex,
  selectPlexServer,
  startPlexOAuth,
} from '../plex/auth.js';
import { plexAdapter } from '../plex/adapter.js';
import { runAlexaEventsCleanup } from '../services/eventRetention.js';
import { getAlexaEventsAfter, getAlexaEventsPage, updateAdminPassword, verifyAdmin } from '../db/index.js';
import {
  advanceQueue,
  createQueueFromTracks,
  getCurrentTrack,
  loadQueue,
  previousTrack,
  saveQueue,
} from '../services/playback.js';
import { artUrlForTrack } from '../media/gateway.js';

export const apiRouter = Router();

apiRouter.use(requireAuth);

apiRouter.get('/settings', (_req, res) => {
  res.json(getPublicSettings());
});

apiRouter.put('/settings', requireCsrf, (req: AuthRequest, res) => {
  try {
    const updated = updateSettingsFromInput(req.body);
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid settings';
    res.status(400).json({ error: message });
  }
});

apiRouter.post('/auth/password', requireCsrf, (req: AuthRequest, res) => {
  const { username, currentPassword, newPassword } = req.body as {
    username?: string;
    currentPassword?: string;
    newPassword?: string;
  };
  if (!username || !currentPassword || !newPassword || newPassword.length < 8) {
    res.status(400).json({ error: 'Username, current password, and new password (8+ chars) required' });
    return;
  }
  const admin = verifyAdmin(username, currentPassword);
  if (!admin) {
    res.status(401).json({ error: 'Current password is incorrect' });
    return;
  }
  updateAdminPassword(admin.username, newPassword);
  res.json({ ok: true });
});

apiRouter.get('/status', asyncHandler(async (_req, res) => {
  const settings = getPublicSettings();
  const creds = getPlexCredentials();
  let plexOk = false;
  let plexName: string | undefined;
  let libraries: { key: string; title: string; type: string }[] = [];

  if (creds) {
    try {
      const info = await plexAdapter.connect(creds.url, creds.token);
      plexOk = true;
      plexName = settings.plexServerName ?? info.name;
      libraries = await plexAdapter.listLibraries();
    } catch {
      plexOk = false;
    }
  }

  let publicReachable = false;
  if (settings.publicUrl) {
    try {
      const resp = await fetch(settings.publicUrl, { method: 'HEAD', redirect: 'follow' });
      publicReachable = resp.ok || resp.status < 500;
    } catch {
      publicReachable = false;
    }
  }

  res.json({
    settings,
    plex: { ok: plexOk, name: plexName, libraries },
    public: { reachable: publicReachable },
    alexa: {
      skillIdConfigured: Boolean(settings.alexaSkillId),
    },
  });
}));

apiRouter.get('/alexa/events', asyncHandler(async (req, res) => {
  const query = req.query as Record<string, unknown>;
  const afterIdRaw = query.afterId;
  if (afterIdRaw !== undefined && afterIdRaw !== '') {
    const afterId = Number(afterIdRaw);
    if (!Number.isInteger(afterId) || afterId < 0) {
      res.status(400).json({ error: 'Invalid afterId' });
      return;
    }
    const sizeRaw = Number(query.size ?? 20);
    const size = Number.isFinite(sizeRaw) ? sizeRaw : 20;
    res.json(getAlexaEventsAfter(afterId, size));
    return;
  }
  const { start, size } = parsePageQuery(query);
  res.json(getAlexaEventsPage(start, size));
}));

apiRouter.post('/alexa/events/cleanup', requireCsrf, asyncHandler(async (_req, res) => {
  const result = runAlexaEventsCleanup();
  res.json(result);
}));

apiRouter.post('/plex/auth/start', requireCsrf, asyncHandler(async (_req, res) => {
  const start = await startPlexOAuth();
  res.json(start);
}));

apiRouter.get('/plex/auth/status/:authId', asyncHandler(async (req, res) => {
  const status = await getPlexOAuthStatus(String(req.params.authId));
  res.json(status);
}));

apiRouter.post('/plex/auth/server', requireCsrf, asyncHandler(async (req, res) => {
  const { authId, clientIdentifier } = req.body as { authId?: string; clientIdentifier?: string };
  if (!clientIdentifier) {
    res.status(400).json({ error: 'clientIdentifier required' });
    return;
  }
  if (!authId && !getPlexAccountToken()) {
    res.status(400).json({ error: 'authId required when Plex account is not connected' });
    return;
  }
  const result = await selectPlexServer(clientIdentifier, authId);
  res.json(result);
}));

apiRouter.get('/plex/servers', asyncHandler(async (_req, res) => {
  const servers = await listPlexServers();
  res.json({ items: servers });
}));

apiRouter.post('/plex/disconnect', requireCsrf, (_req, res) => {
  disconnectPlex();
  res.json({ ok: true });
});

apiRouter.get('/plex/libraries', asyncHandler(async (_req, res) => {
  const libraries = await loadLibrariesForCurrentPlex();
  res.json({ items: libraries });
}));

apiRouter.post('/plex/test', requireCsrf, asyncHandler(async (req, res) => {
  const { url, token } = req.body as { url?: string; token?: string };
  const creds = getPlexCredentials();
  const testUrl = url ?? creds?.url;
  const testToken = token ?? creds?.token;
  if (!testUrl || !testToken) {
    res.status(400).json({ error: 'Plex URL and token required' });
    return;
  }
  const info = await plexAdapter.connect(testUrl, testToken);
  const libraries = await plexAdapter.listLibraries();
  res.json({ ok: true, info, libraries });
}));

function getSectionKey(): string | null {
  return getPublicSettings().musicLibraryId;
}

async function ensurePlexConnected(): Promise<void> {
  const creds = getPlexCredentials();
  if (!creds) throw new Error('Plex not configured');
  await plexAdapter.connect(creds.url, creds.token);
}

function withArtUrl<T extends { ratingKey: string; thumb?: string }>(item: T): T & { artUrl?: string } {
  return {
    ...item,
    artUrl: artUrlForTrack(item.ratingKey, item.thumb),
  };
}

const ALLOWED_SORTS = new Set(['title', 'titleDesc', 'addedAt', 'year', 'yearDesc']);
const SEARCH_TYPES = new Set(['tracks', 'albums', 'artists', 'playlists']);

function parsePageQuery(query: Record<string, unknown>) {
  const start = Number(query.start ?? 0);
  const size = Number(query.size ?? 50);
  const sortRaw = typeof query.sort === 'string' ? query.sort : undefined;
  const sort = sortRaw && ALLOWED_SORTS.has(sortRaw) ? sortRaw : undefined;
  return {
    start: Number.isFinite(start) ? start : 0,
    size: Number.isFinite(size) ? size : 50,
    sort,
  };
}

function parseTrackKeys(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const keys = value.filter((key): key is string => typeof key === 'string' && key.trim().length > 0);
  return keys.length > 0 ? keys : null;
}

function pageResponse<T extends { ratingKey: string; thumb?: string }>(page: {
  items: T[];
  nextStart: number;
  hasMore: boolean;
}) {
  return {
    items: page.items.map(withArtUrl),
    nextStart: page.nextStart,
    hasMore: page.hasMore,
  };
}

apiRouter.get('/library/artists', asyncHandler(async (req, res) => {
  const sectionKey = getSectionKey();
  if (!sectionKey) {
    res.status(400).json({ error: 'Music library not configured' });
    return;
  }
  await ensurePlexConnected();
  const { start, size, sort } = parsePageQuery(req.query as Record<string, unknown>);
  const page = await plexAdapter.listArtistsPage(sectionKey, { start, size, sort });
  res.json(pageResponse(page));
}));

apiRouter.get('/library/albums', asyncHandler(async (req, res) => {
  const sectionKey = getSectionKey();
  if (!sectionKey) {
    res.status(400).json({ error: 'Music library not configured' });
    return;
  }
  await ensurePlexConnected();
  const { start, size, sort } = parsePageQuery(req.query as Record<string, unknown>);
  const page = await plexAdapter.listAlbumsPage(sectionKey, { start, size, sort });
  res.json(pageResponse(page));
}));

apiRouter.get('/library/tracks', asyncHandler(async (req, res) => {
  const sectionKey = getSectionKey();
  if (!sectionKey) {
    res.status(400).json({ error: 'Music library not configured' });
    return;
  }
  await ensurePlexConnected();
  const { start, size, sort } = parsePageQuery(req.query as Record<string, unknown>);
  const page = await plexAdapter.listTracksPage(sectionKey, { start, size, sort });
  res.json(pageResponse(page));
}));

apiRouter.get('/search', asyncHandler(async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const sectionKey = getSectionKey();
  if (!sectionKey || !q) {
    res.status(400).json({ error: 'Query and music library required' });
    return;
  }
  await ensurePlexConnected();
  const typeRaw = typeof req.query.type === 'string' ? req.query.type : undefined;
  if (typeRaw && SEARCH_TYPES.has(typeRaw)) {
    const { start, size } = parsePageQuery(req.query as Record<string, unknown>);
    const page = await plexAdapter.searchMusicType(
      sectionKey,
      q,
      typeRaw as 'tracks' | 'albums' | 'artists' | 'playlists',
      { start, size },
    );
    res.json(pageResponse(page));
    return;
  }
  const results = await plexAdapter.searchMusic(sectionKey, q, 8);
  res.json({
    tracks: results.tracks.map(withArtUrl),
    albums: results.albums.map(withArtUrl),
    artists: results.artists.map(withArtUrl),
    playlists: results.playlists.map(withArtUrl),
  });
}));

apiRouter.get('/artists/:key', asyncHandler(async (req, res) => {
  await ensurePlexConnected();
  const artist = await plexAdapter.getArtist(String(req.params.key));
  if (!artist) {
    res.status(404).json({ error: 'Artist not found' });
    return;
  }
  const albums = await plexAdapter.getArtistAlbumsPage(artist.ratingKey, { start: 0, size: 50 });
  res.json({
    artist: withArtUrl(artist),
    albums: albums.items.map(withArtUrl),
    albumsHasMore: albums.hasMore,
    albumsNextStart: albums.nextStart,
  });
}));

apiRouter.get('/albums/:key', asyncHandler(async (req, res) => {
  await ensurePlexConnected();
  const album = await plexAdapter.getAlbum(String(req.params.key));
  if (!album) {
    res.status(404).json({ error: 'Album not found' });
    return;
  }
  const tracks = await plexAdapter.getAlbumTracksPage(album.ratingKey, { start: 0, size: 50 });
  res.json({
    album: withArtUrl(album),
    tracks: tracks.items.map(withArtUrl),
    tracksHasMore: tracks.hasMore,
    tracksNextStart: tracks.nextStart,
  });
}));

apiRouter.get('/tracks/:key', asyncHandler(async (req, res) => {
  await ensurePlexConnected();
  const track = await plexAdapter.getTrack(String(req.params.key));
  if (!track) {
    res.status(404).json({ error: 'Track not found' });
    return;
  }
  res.json({ track: withArtUrl(track) });
}));

apiRouter.get('/albums/:key/tracks', asyncHandler(async (req, res) => {
  await ensurePlexConnected();
  const all = req.query.all === '1' || req.query.all === 'true';
  if (all) {
    const tracks = await plexAdapter.getAlbumTracks(String(req.params.key));
    res.json({ items: tracks.map(withArtUrl), nextStart: tracks.length, hasMore: false });
    return;
  }
  const { start, size } = parsePageQuery(req.query as Record<string, unknown>);
  const page = await plexAdapter.getAlbumTracksPage(String(req.params.key), { start, size });
  res.json(pageResponse(page));
}));

apiRouter.get('/artists/:key/albums', asyncHandler(async (req, res) => {
  await ensurePlexConnected();
  const all = req.query.all === '1' || req.query.all === 'true';
  if (all) {
    const albums = await plexAdapter.getArtistAlbums(String(req.params.key));
    res.json({ items: albums.map(withArtUrl), nextStart: albums.length, hasMore: false });
    return;
  }
  const { start, size, sort } = parsePageQuery(req.query as Record<string, unknown>);
  const page = await plexAdapter.getArtistAlbumsPage(String(req.params.key), { start, size, sort });
  res.json(pageResponse(page));
}));

apiRouter.get('/artists/:key/tracks', asyncHandler(async (req, res) => {
  await ensurePlexConnected();
  const all = req.query.all === '1' || req.query.all === 'true';
  if (all) {
    const tracks = await plexAdapter.getArtistTracks(String(req.params.key));
    res.json({ items: tracks.map(withArtUrl), nextStart: tracks.length, hasMore: false });
    return;
  }
  const { start, size } = parsePageQuery(req.query as Record<string, unknown>);
  const page = await plexAdapter.getArtistTracksPage(String(req.params.key), { start, size });
  res.json(pageResponse(page));
}));

apiRouter.get('/playlists', asyncHandler(async (req, res) => {
  await ensurePlexConnected();
  const all = req.query.all === '1' || req.query.all === 'true';
  if (all) {
    const playlists = await plexAdapter.listPlaylists();
    res.json({ items: playlists.map(withArtUrl), nextStart: playlists.length, hasMore: false });
    return;
  }
  const { start, size } = parsePageQuery(req.query as Record<string, unknown>);
  const page = await plexAdapter.listPlaylistsPage({ start, size });
  res.json(pageResponse(page));
}));

apiRouter.get('/playlists/:key/tracks', asyncHandler(async (req, res) => {
  await ensurePlexConnected();
  const all = req.query.all === '1' || req.query.all === 'true';
  if (all) {
    const tracks = await plexAdapter.getPlaylistTracks(String(req.params.key));
    res.json({ items: tracks.map(withArtUrl), nextStart: tracks.length, hasMore: false });
    return;
  }
  const { start, size } = parsePageQuery(req.query as Record<string, unknown>);
  const page = await plexAdapter.getPlaylistTracksPage(String(req.params.key), { start, size });
  res.json(pageResponse(page));
}));

apiRouter.post('/playlists', requireCsrf, asyncHandler(async (req, res) => {
  const { title, trackKeys } = req.body as { title?: string; trackKeys?: unknown };
  if (!title?.trim()) {
    res.status(400).json({ error: 'Title required' });
    return;
  }
  const keys = trackKeys === undefined ? [] : parseTrackKeys(trackKeys);
  if (trackKeys !== undefined && keys === null) {
    res.status(400).json({ error: 'trackKeys required' });
    return;
  }
  await ensurePlexConnected();
  const playlist = await plexAdapter.createPlaylist(title.trim(), keys ?? []);
  res.json(withArtUrl(playlist));
}));

apiRouter.patch('/playlists/:key', requireCsrf, asyncHandler(async (req, res) => {
  const { title } = req.body as { title?: string };
  if (!title) {
    res.status(400).json({ error: 'Title required' });
    return;
  }
  await ensurePlexConnected();
  await plexAdapter.renamePlaylist(String(req.params.key), title);
  res.json({ ok: true });
}));

apiRouter.delete('/playlists/:key', requireCsrf, asyncHandler(async (req, res) => {
  await ensurePlexConnected();
  await plexAdapter.deletePlaylist(String(req.params.key));
  res.json({ ok: true });
}));

apiRouter.post('/playlists/:key/tracks', requireCsrf, asyncHandler(async (req, res) => {
  const { trackKeys } = req.body as { trackKeys?: unknown };
  const keys = parseTrackKeys(trackKeys);
  if (!keys) {
    res.status(400).json({ error: 'trackKeys required' });
    return;
  }
  await ensurePlexConnected();
  await plexAdapter.addTracksToPlaylist(String(req.params.key), keys);
  res.json({ ok: true });
}));

apiRouter.delete('/playlists/:key/tracks/:itemId', requireCsrf, asyncHandler(async (req, res) => {
  await ensurePlexConnected();
  await plexAdapter.removePlaylistItem(String(req.params.key), String(req.params.itemId));
  res.json({ ok: true });
}));

apiRouter.post('/playlists/:key/reorder', requireCsrf, asyncHandler(async (req, res) => {
  const { playlistItemId, afterPlaylistItemId } = req.body as {
    playlistItemId?: string;
    afterPlaylistItemId?: string;
  };
  if (!playlistItemId) {
    res.status(400).json({ error: 'playlistItemId required' });
    return;
  }
  await ensurePlexConnected();
  await plexAdapter.reorderPlaylistItem(
    String(req.params.key),
    playlistItemId,
    afterPlaylistItemId,
  );
  res.json({ ok: true });
}));

apiRouter.post('/player/queue', requireCsrf, asyncHandler(async (req: AuthRequest, res) => {
  const { tracks, shuffle } = req.body as {
    tracks?: {
      ratingKey: string;
      title: string;
      artist?: string;
      album?: string;
      durationMs?: number;
      thumb?: string;
    }[];
    shuffle?: boolean;
  };
  if (!tracks?.length) {
    res.status(400).json({ error: 'tracks required' });
    return;
  }

  let enriched = tracks;
  if (tracks.some((track) => !track.thumb)) {
    await ensurePlexConnected();
    enriched = await Promise.all(
      tracks.map(async (track) => {
        if (track.thumb) return track;
        const meta = await plexAdapter.getTrack(track.ratingKey);
        if (!meta) return track;
        return {
          ...track,
          title: track.title || meta.title,
          artist: track.artist ?? meta.artist,
          album: track.album ?? meta.album,
          durationMs: track.durationMs ?? meta.durationMs,
          thumb: meta.thumb,
        };
      }),
    );
  }

  const userId = req.sessionId ?? 'web';
  const queue = createQueueFromTracks(userId, enriched, { shuffle });
  res.json({ queue, current: getCurrentTrack(queue) });
}));

apiRouter.get('/player/queue', (req: AuthRequest, res) => {
  const userId = req.sessionId ?? 'web';
  const queue = loadQueue(userId);
  res.json({ queue, current: queue ? getCurrentTrack(queue) : null });
});

apiRouter.post('/player/next', requireCsrf, (req: AuthRequest, res) => {
  const userId = req.sessionId ?? 'web';
  const queue = loadQueue(userId);
  if (!queue) {
    res.status(404).json({ error: 'No queue' });
    return;
  }
  const next = advanceQueue(queue);
  if (!next) {
    res.json({ queue, current: getCurrentTrack(queue) });
    return;
  }
  res.json({ queue, current: next });
});

apiRouter.post('/player/prev', requireCsrf, (req: AuthRequest, res) => {
  const userId = req.sessionId ?? 'web';
  const queue = loadQueue(userId);
  if (!queue) {
    res.status(404).json({ error: 'No queue' });
    return;
  }
  const prev = previousTrack(queue);
  if (!prev) {
    res.json({ queue, current: getCurrentTrack(queue) });
    return;
  }
  res.json({ queue, current: prev });
});

apiRouter.post('/player/jump', requireCsrf, (req: AuthRequest, res) => {
  const { index } = req.body as { index?: number };
  const userId = req.sessionId ?? 'web';
  const queue = loadQueue(userId);
  if (!queue || index === undefined || index < 0 || index >= queue.items.length) {
    res.status(400).json({ error: 'Invalid queue index' });
    return;
  }
  queue.currentIndex = index;
  saveQueue(queue);
  res.json({ queue, current: getCurrentTrack(queue) });
});
