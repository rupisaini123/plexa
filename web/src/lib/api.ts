let csrfToken: string | null = null;

export async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/auth/csrf');
  if (!res.ok) throw new Error('Failed to fetch CSRF token');
  const data = await res.json() as { csrfToken: string };
  csrfToken = data.csrfToken;
  return csrfToken;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.method && options.method !== 'GET' && csrfToken) {
    headers.set('X-CSRF-Token', csrfToken);
  }
  let res: Response;
  try {
    res = await fetch(path, { ...options, headers, credentials: 'include' });
  } catch (err) {
    if (options.signal?.aborted || (err as Error).name === 'AbortError') {
      const abortError = new Error('AbortError');
      abortError.name = 'AbortError';
      throw abortError;
    }
    throw err;
  }
  if (res.status === 401) {
    throw new Error('unauthorized');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string; message?: string | string[] };
    const msg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message ?? body.error ?? 'Request failed';
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export interface PublicSettings {
  plexUrl: string | null;
  hasPlexToken: boolean;
  hasPlexAccountToken: boolean;
  musicLibraryId: string | null;
  publicUrl: string | null;
  alexaSkillId: string | null;
  invocationName: string;
  locale: string;
  plexAccountEmail: string | null;
  plexServerName: string | null;
  plexServerMachineId: string | null;
  alexaEventsRetentionDays: number;
  updatedAt: string;
}

export interface TrackItem {
  ratingKey: string;
  title: string;
  artist?: string;
  album?: string;
  durationMs?: number;
  thumb?: string;
  streamUrl?: string;
  artUrl?: string;
  playlistItemId?: string;
  year?: number;
  leafCount?: number;
}

export interface PlaylistSummary {
  ratingKey: string;
  title: string;
  leafCount?: number;
  duration?: number;
  artUrl?: string;
}

export type LibraryKind = 'artists' | 'albums' | 'tracks';
export type LibrarySort = 'title' | 'titleDesc' | 'addedAt' | 'year' | 'yearDesc';
export type LibraryView = 'grid' | 'list';
/** @deprecated Use LibraryView — grid maps to comfortable, list maps to compact */
export type LibraryDensity = 'comfortable' | 'compact';
export type SearchMediaType = 'tracks' | 'albums' | 'artists' | 'playlists';

export interface PageResult<T> {
  items: T[];
  nextStart: number;
  hasMore: boolean;
}

export interface AlexaEventItem {
  id: number;
  event_type: string;
  summary: string;
  created_at: string;
}

export async function fetchAlexaEventsPage(
  start: number,
  size: number,
  signal?: AbortSignal,
): Promise<PageResult<AlexaEventItem>> {
  return api<PageResult<AlexaEventItem>>(`/api/alexa/events?start=${start}&size=${size}`, { signal });
}

export async function fetchAlexaEventsAfter(
  afterId: number,
  size = 20,
  signal?: AbortSignal,
): Promise<PageResult<AlexaEventItem>> {
  return api<PageResult<AlexaEventItem>>(`/api/alexa/events?afterId=${afterId}&size=${size}`, { signal });
}

export interface SearchGroupedResults {
  tracks: TrackItem[];
  albums: TrackItem[];
  artists: TrackItem[];
  playlists: TrackItem[];
}

export interface QueueItem extends TrackItem {}

export interface PlaybackQueue {
  items: QueueItem[];
  currentIndex: number;
  shuffle: boolean;
}

export interface PlexOAuthStart {
  authId: string;
  authUrl: string;
  expiresAt: string;
}

export interface PlexServerOption {
  clientIdentifier: string;
  name: string;
  owned: boolean;
  product: string;
  platform: string;
  presence: boolean;
  connections: { uri: string; local: boolean; relay: boolean }[];
}

export interface PlexOAuthStatus {
  status: 'pending' | 'completed' | 'expired' | 'error';
  authUrl?: string;
  expiresAt?: string;
  accountEmail?: string;
  servers?: PlexServerOption[];
  error?: string;
}

export async function login(username: string, password: string): Promise<void> {
  await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  await fetchCsrf();
}

export async function logout(): Promise<void> {
  await api('/api/auth/logout', { method: 'POST' });
  csrfToken = null;
}

export async function changePassword(
  username: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await fetchCsrf();
  await api('/api/auth/password', {
    method: 'POST',
    body: JSON.stringify({ username, currentPassword, newPassword }),
  });
}

export async function startPlexOAuth(): Promise<PlexOAuthStart> {
  await fetchCsrf();
  return api<PlexOAuthStart>('/api/plex/auth/start', { method: 'POST', body: '{}' });
}

export async function getPlexOAuthStatus(authId: string): Promise<PlexOAuthStatus> {
  return api<PlexOAuthStatus>(`/api/plex/auth/status/${authId}`);
}

export async function selectPlexServer(clientIdentifier: string, authId?: string | null) {
  await fetchCsrf();
  return api<{ url: string; name: string; email?: string; libraries: { key: string; title: string; type: string }[] }>(
    '/api/plex/auth/server',
    { method: 'POST', body: JSON.stringify({ clientIdentifier, authId: authId || undefined }) },
  );
}

export async function fetchPlexServers(): Promise<PlexServerOption[]> {
  const res = await api<{ items: PlexServerOption[] }>('/api/plex/servers');
  return res.items;
}

export async function disconnectPlex(): Promise<void> {
  await fetchCsrf();
  await api('/api/plex/disconnect', { method: 'POST', body: '{}' });
}

export async function cleanupAlexaEvents(): Promise<{ deletedCount: number; retentionDays: number }> {
  await fetchCsrf();
  return api<{ deletedCount: number; retentionDays: number }>('/api/alexa/events/cleanup', {
    method: 'POST',
    body: '{}',
  });
}

export async function listAllPlaylists(): Promise<PlaylistSummary[]> {
  const res = await api<PageResult<PlaylistSummary>>('/api/playlists?all=1');
  return res.items;
}

export async function addTracksToPlaylist(playlistKey: string, trackKeys: string[]): Promise<void> {
  await fetchCsrf();
  await api(`/api/playlists/${playlistKey}/tracks`, {
    method: 'POST',
    body: JSON.stringify({ trackKeys }),
  });
}

export async function createPlaylistWithTracks(
  title: string,
  trackKeys: string[],
): Promise<PlaylistSummary> {
  await fetchCsrf();
  return api<PlaylistSummary>('/api/playlists', {
    method: 'POST',
    body: JSON.stringify({ title, trackKeys }),
  });
}
